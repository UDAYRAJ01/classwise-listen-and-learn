import { createFileRoute } from "@tanstack/react-router";

import { getSubject, isBoard, isLang, parseGrade } from "@/lib/catalog";
import { customTopicSlug, isCustomSlug, normalizeTopic, TOPIC_MAX, TOPIC_MIN } from "@/lib/slugs";
import type { NoteRecord, SyllabusBook } from "@/lib/types";

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

        const findNote = () =>
          supabaseAdmin
            .from("notes")
            .select("*")
            .eq("board", board)
            .eq("grade", grade)
            .eq("subject", subject.slug)
            .eq("chapter_slug", chapter)
            .eq("language", lang)
            .maybeSingle();

        const existing = await findNote();
        if (existing.data) {
          return ndjsonStream(async (send) =>
            send({ type: "done", data: existing.data as unknown as NoteRecord }),
          );
        }

        // Resolve what chapter this is: an official syllabus chapter or a typed topic.
        let chapterTitle = "";
        let bookName: string | null = null;
        let gist: string | null = null;
        const custom = isCustomSlug(chapter);
        if (custom) {
          const title = normalizeTopic(typeof body.title === "string" ? body.title : "");
          if (
            title.length < TOPIC_MIN ||
            title.length > TOPIC_MAX ||
            customTopicSlug(title) !== chapter
          ) {
            return jsonError(400, "Topic ka naam sahi se likhein (3–120 letters).");
          }
          chapterTitle = title;
        } else {
          const syl = await supabaseAdmin
            .from("syllabi")
            .select("books")
            .eq("board", board)
            .eq("grade", grade)
            .eq("subject", subject.slug)
            .maybeSingle();
          const books = (syl.data?.books ?? []) as unknown as SyllabusBook[];
          for (const b of books) {
            const c = b.chapters.find((x) => x.slug === chapter);
            if (c) {
              chapterTitle = c.title;
              bookName = b.name;
              gist = c.gist || null;
              break;
            }
          }
          if (!chapterTitle) return jsonError(404, "Ye chapter is subject ki list mein nahi mila.");
        }

        const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
        if (!(await consumeRateLimit(supabaseAdmin, request, "notes"))) {
          return jsonError(
            429,
            "Is ghante ke notes ki limit poori ho gayi. Thodi der baad try karein.",
          );
        }

        const { streamStructured, friendlyMessage, toGatewayError } =
          await import("@/lib/server/ai.server");
        const { notesInstructions, notesPrompt } = await import("@/lib/server/prompts.server");
        const { notePartSchemas } = await import("@/lib/server/schemas.server");
        const { normalizeNote } = await import("@/lib/server/normalize.server");

        const fixes = await supabaseAdmin
          .from("note_reports")
          .select("correction")
          .eq("board", board)
          .eq("grade", grade)
          .eq("subject", subject.slug)
          .eq("chapter_slug", chapter)
          .eq("status", "resolved")
          .not("correction", "is", null)
          .order("resolved_at", { ascending: true })
          .limit(20);
        const corrections = (fixes.data ?? []).map((f) => f.correction as string);
        const src = custom
          ? null
          : await supabaseAdmin
              .from("chapter_sources")
              .select("body")
              .eq("board", board)
              .eq("grade", grade)
              .eq("subject", subject.slug)
              .eq("chapter_slug", chapter)
              .maybeSingle();
        const source = src?.data?.body ? src.data.body.slice(0, 60000) : null;

        return ndjsonStream(async (send) => {
          const partial = throttle<unknown>((data) => send({ type: "partial", data }), 300);
          try {
            type Part = "core" | "practice" | "quiz";
            const halves: Record<Part, Record<string, unknown>> = {
              core: {},
              practice: {},
              quiz: {},
            };
            const run = (part: Part) =>
              streamStructured<Record<string, unknown>>({
                instructions: notesInstructions(),
                prompt: notesPrompt({
                  board,
                  grade,
                  subject,
                  chapterTitle,
                  bookName,
                  gist,
                  lang,
                  custom,
                  part,
                  corrections,
                  source,
                }),
                schema: notePartSchemas[part],
                effort: "low",
                onPartial: (p) => {
                  halves[part] = (p ?? {}) as Record<string, unknown>;
                  partial.push({ ...halves.core, ...halves.practice, ...halves.quiz });
                },
              });
            // The quiz + mistakes part is a bonus: if only it fails, still save the notes.
            const [core, practice, quiz] = await Promise.all([
              run("core"),
              run("practice"),
              run("quiz").catch((error: unknown) => {
                console.error("quiz generation failed", error);
                return { mcqs: [], mistakes: [] };
              }),
            ]);
            partial.cancel();
            const content = normalizeNote({ ...core, ...practice, ...quiz }, chapterTitle);
            if (content.keyPoints.length === 0) {
              send({
                type: "error",
                status: 502,
                message: "Notes poore nahi ban paaye. Dobara try karein.",
              });
              return;
            }
            await supabaseAdmin.from("notes").upsert(
              {
                board,
                grade,
                subject: subject.slug,
                chapter_slug: chapter,
                chapter_title: chapterTitle,
                book_name: bookName,
                language: lang,
                is_custom: custom,
                content: content as never,
              },
              { onConflict: "board,grade,subject,chapter_slug,language", ignoreDuplicates: true },
            );
            const saved = await findNote();
            if (saved.error || !saved.data) throw saved.error ?? new Error("save failed");
            send({ type: "done", data: saved.data as unknown as NoteRecord });
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
