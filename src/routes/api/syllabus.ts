import { createFileRoute } from "@tanstack/react-router";

import { getSubject, isBoard, parseGrade } from "@/lib/catalog";
import type { SyllabusRecord } from "@/lib/types";

export const Route = createFileRoute("/api/syllabus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonError, ndjsonStream, throttle } = await import("@/lib/server/ndjson.server");
        let body: { board?: unknown; grade?: unknown; subject?: unknown };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid request");
        }
        const board = body.board;
        const grade = parseGrade(body.grade as number);
        if (!isBoard(board) || grade === null || typeof body.subject !== "string") {
          return jsonError(400, "Invalid board, class or subject");
        }
        const subject = getSubject(board, grade, body.subject);
        if (!subject) return jsonError(404, "Subject not found for this class");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const existing = await supabaseAdmin
          .from("syllabi")
          .select("*")
          .eq("board", board)
          .eq("grade", grade)
          .eq("subject", subject.slug)
          .maybeSingle();
        if (existing.data) {
          return ndjsonStream(async (send) =>
            send({ type: "done", data: existing.data as unknown as SyllabusRecord }),
          );
        }

        const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
        if (!(await consumeRateLimit(supabaseAdmin, request, "syllabus"))) {
          return jsonError(
            429,
            "Aaj ke liye bahut saari requests ho gayi. 1 ghante baad try karein.",
          );
        }

        const { streamStructured, friendlyMessage, toGatewayError } =
          await import("@/lib/server/ai.server");
        const { syllabusInstructions, syllabusPrompt } =
          await import("@/lib/server/prompts.server");
        const { syllabusJsonSchema } = await import("@/lib/server/schemas.server");
        const { normalizeSyllabus } = await import("@/lib/server/normalize.server");

        return ndjsonStream(async (send) => {
          const partial = throttle<unknown>((data) => send({ type: "partial", data }), 350);
          try {
            const raw = await streamStructured<{ books: unknown }>({
              instructions: syllabusInstructions(),
              prompt: syllabusPrompt(board, grade, subject),
              schema: syllabusJsonSchema,
              effort: "medium",
              onPartial: (p) => partial.push(p),
            });
            partial.cancel();
            const books = normalizeSyllabus(raw);
            if (books.length === 0) {
              send({
                type: "error",
                status: 502,
                message: "Chapter list nahi mil payi. Dobara try karein.",
              });
              return;
            }
            await supabaseAdmin
              .from("syllabi")
              .upsert(
                { board, grade, subject: subject.slug, books: books as never },
                { onConflict: "board,grade,subject", ignoreDuplicates: true },
              );
            const saved = await supabaseAdmin
              .from("syllabi")
              .select("*")
              .eq("board", board)
              .eq("grade", grade)
              .eq("subject", subject.slug)
              .single();
            if (saved.error || !saved.data) throw saved.error ?? new Error("save failed");
            send({ type: "done", data: saved.data as unknown as SyllabusRecord });
          } catch (error) {
            partial.cancel();
            const err = toGatewayError(error);
            console.error("syllabus generation failed", err.status, err.message);
            send({
              type: "error",
              status: err.status,
              message: friendlyMessage(err, "chapter list"),
            });
          }
        });
      },
    },
  },
});
