import { createFileRoute } from "@tanstack/react-router";

import { getSubject, isBoard, isLang, parseGrade } from "@/lib/catalog";
import type { NoteRecord } from "@/lib/types";

export const Route = createFileRoute("/api/notes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonError, ndjsonStream, throttle } = await import("@/lib/server/ndjson.server");
        let body: {
          board?: unknown;
          grade?: unknown;
          lang?: unknown;
          chapter?: unknown;
          subject?: unknown;
          title?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid request");
        }
        const board = body.board;
        const grade = parseGrade(body.grade as number);
        const lang = body.lang;
        const chapter = typeof body.chapter === "string" ? body.chapter : "";
        if (
          !isBoard(board) ||
          grade === null ||
          !isLang(lang) ||
          typeof body.subject !== "string" ||
          !chapter
        ) {
          return jsonError(400, "Invalid request");
        }
        const subject = getSubject(board, grade, body.subject);
        if (!subject) return jsonError(404, "Subject not found for this class");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const pipeline = await import("@/lib/server/note-pipeline.server");
        const where = { board, grade, subject, chapter };

        const existing = await pipeline.findNote(supabaseAdmin, where, lang);
        if (existing.data) {
          return ndjsonStream(async (send) =>
            send({ type: "done", data: existing.data as unknown as NoteRecord }),
          );
        }

        let ctx: Awaited<ReturnType<typeof pipeline.loadChapterContext>>;
        try {
          ctx = await pipeline.loadChapterContext(
            supabaseAdmin,
            where,
            typeof body.title === "string" ? body.title : undefined,
          );
        } catch (error) {
          if (error instanceof pipeline.ChapterLookupError) {
            return jsonError(error.status, error.message);
          }
          throw error;
        }

        const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
        if (!(await consumeRateLimit(supabaseAdmin, request, "notes"))) {
          return jsonError(
            429,
            "Is ghante ke notes ki limit poori ho gayi. Thodi der baad try karein.",
          );
        }

        const { friendlyMessage, toGatewayError } = await import("@/lib/server/ai.server");

        return ndjsonStream(async (send) => {
          const partial = throttle<unknown>((data) => send({ type: "partial", data }), 300);
          try {
            const content = await pipeline.writeNoteContent(ctx, lang, (p) => partial.push(p));
            partial.cancel();
            if (content.keyPoints.length === 0) {
              send({
                type: "error",
                status: 502,
                message: "Notes poore nahi ban paaye. Dobara try karein.",
              });
              return;
            }
            const saved = await pipeline.saveNote(supabaseAdmin, ctx, lang, content);
            send({ type: "done", data: saved });
          } catch (error) {
            partial.cancel();
            const err = toGatewayError(error);
            console.error("notes generation failed", err.status, err.message);
            send({ type: "error", status: err.status, message: friendlyMessage(err, "notes") });
          }
        });
      },
    },
  },
});
