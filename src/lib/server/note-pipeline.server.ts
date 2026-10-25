import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { BoardId, Lang, SubjectMeta } from "@/lib/catalog";
import { customTopicSlug, isCustomSlug, normalizeTopic, TOPIC_MAX, TOPIC_MIN } from "@/lib/slugs";
import type { NoteContent, NoteRecord, SyllabusBook } from "@/lib/types";

import { streamStructured } from "./ai.server";
import { normalizeNote } from "./normalize.server";
import { notesInstructions, notesPrompt } from "./prompts.server";
import { notePartSchemas } from "./schemas.server";

type Admin = SupabaseClient<Database>;

export interface ChapterWhere {
  board: BoardId;
  grade: number;
  subject: SubjectMeta;
  chapter: string;
}

/** Everything the notes prompt needs to know about one chapter. */
export interface ChapterContext extends ChapterWhere {
  chapterTitle: string;
  bookName: string | null;
  gist: string | null;
  custom: boolean;
  corrections: string[];
  /** Official textbook text (trimmed), when we have it. */
  source: string | null;
}

export class ChapterLookupError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Max textbook characters sent with each prompt. */
export const SOURCE_CHARS = 60_000;

/** Resolves the chapter (official or typed topic), its verified corrections and textbook text. */
export async function loadChapterContext(
  admin: Admin,
  where: ChapterWhere,
  typedTitle?: string,
): Promise<ChapterContext> {
  const { board, grade, subject, chapter } = where;
  let chapterTitle = "";
  let bookName: string | null = null;
  let gist: string | null = null;
  const custom = isCustomSlug(chapter);

  if (custom) {
    const title = normalizeTopic(typedTitle ?? "");
    if (
      title.length < TOPIC_MIN ||
      title.length > TOPIC_MAX ||
      customTopicSlug(title) !== chapter
    ) {
      throw new ChapterLookupError(400, "Topic ka naam sahi se likhein (3–120 letters).");
    }
    chapterTitle = title;
  } else {
    const syl = await admin
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
    if (!chapterTitle) {
      throw new ChapterLookupError(404, "Ye chapter is subject ki list mein nahi mila.");
    }
  }

  const fixes = await admin
    .from("note_reports")
    .select("correction")
    .eq("board", board)
    .eq("grade", grade)
    .eq("subject", subject.slug)
    .eq("chapter_slug", chapter)
    .eq("status", "resolved")
    .not("correction", "is", null)
    .order("resolved_at", { ascending: true })
    .limit(30);
  const corrections = (fixes.data ?? []).map((f) => f.correction as string);

  let source: string | null = null;
  if (!custom) {
    const src = await admin
      .from("chapter_sources")
      .select("body")
      .eq("board", board)
      .eq("grade", grade)
      .eq("subject", subject.slug)
      .eq("chapter_slug", chapter)
      .maybeSingle();
    source = src.data?.body ? src.data.body.slice(0, SOURCE_CHARS) : null;
  }

  return { ...where, chapterTitle, bookName, gist, custom, corrections, source };
}

type Part = "core" | "practice" | "quiz";

/**
 * Writes the notes in three parallel parts and merges them.
 * The quiz part (MCQs + common mistakes) is a bonus: if only it fails, the notes still count.
 */
export async function writeNoteContent(
  ctx: ChapterContext,
  lang: Lang,
  onPartial?: (merged: Record<string, unknown>) => void,
): Promise<NoteContent> {
  const parts: Record<Part, Record<string, unknown>> = { core: {}, practice: {}, quiz: {} };
  const run = (part: Part) =>
    streamStructured<Record<string, unknown>>({
      instructions: notesInstructions(),
      prompt: notesPrompt({
        board: ctx.board,
        grade: ctx.grade,
        subject: ctx.subject,
        chapterTitle: ctx.chapterTitle,
        bookName: ctx.bookName,
        gist: ctx.gist,
        lang,
        custom: ctx.custom,
        part,
        corrections: ctx.corrections,
        source: ctx.source,
      }),
      schema: notePartSchemas[part],
      effort: "low",
      onPartial: (p) => {
        parts[part] = (p ?? {}) as Record<string, unknown>;
        onPartial?.({ ...parts.core, ...parts.practice, ...parts.quiz });
      },
    });
  const [core, practice, quiz] = await Promise.all([
    run("core"),
    run("practice"),
    run("quiz").catch((error: unknown) => {
      console.error("quiz generation failed", error);
      return { mcqs: [], mistakes: [] };
    }),
  ]);
  return normalizeNote({ ...core, ...practice, ...quiz }, ctx.chapterTitle);
}

export function findNote(admin: Admin, where: ChapterWhere, lang: Lang) {
  return admin
    .from("notes")
    .select("*")
    .eq("board", where.board)
    .eq("grade", where.grade)
    .eq("subject", where.subject.slug)
    .eq("chapter_slug", where.chapter)
    .eq("language", lang)
    .maybeSingle();
}

/** Saves the notes unless someone else saved this chapter first; returns the stored row. */
export async function saveNote(
  admin: Admin,
  ctx: ChapterContext,
  lang: Lang,
  content: NoteContent,
): Promise<NoteRecord> {
  await admin.from("notes").upsert(
    {
      board: ctx.board,
      grade: ctx.grade,
      subject: ctx.subject.slug,
      chapter_slug: ctx.chapter,
      chapter_title: ctx.chapterTitle,
      book_name: ctx.bookName,
      language: lang,
      is_custom: ctx.custom,
      content: content as never,
    },
    { onConflict: "board,grade,subject,chapter_slug,language", ignoreDuplicates: true },
  );
  const saved = await findNote(admin, ctx, lang);
  if (saved.error || !saved.data) throw saved.error ?? new Error("save failed");
  return saved.data as unknown as NoteRecord;
}

/**
 * Deletes stored notes (and their audio files) so the next visit writes them fresh.
 * Pass `noteIds` to remove only those rows; otherwise every language of the chapter goes.
 */
export async function purgeNotes(
  admin: Admin,
  where: { board: string; grade: number; subject: string; chapter: string },
  noteIds?: string[],
): Promise<number> {
  let ids = noteIds;
  if (!ids) {
    const notes = await admin
      .from("notes")
      .select("id")
      .eq("board", where.board)
      .eq("grade", where.grade)
      .eq("subject", where.subject)
      .eq("chapter_slug", where.chapter);
    ids = (notes.data ?? []).map((n) => n.id);
  }
  if (ids.length === 0) return 0;
  const audio = await admin.from("note_audio").select("storage_path").in("note_id", ids);
  const paths = (audio.data ?? []).map((a) => a.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from("note-audio").remove(paths.slice(i, i + 100));
  }
  const del = await admin.from("notes").delete().in("id", ids);
  if (del.error) throw new Error("Purane notes hata nahi paaye.");
  return ids.length;
}
