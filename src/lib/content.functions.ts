import { createServerFn } from "@tanstack/react-start";

import { getSubject, isBoard, isLang, parseGrade, type BoardId, type Lang } from "@/lib/catalog";
import type { NoteRecord, SyllabusRecord } from "@/lib/types";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type SubjectInput = { board: BoardId; grade: number; subject: string };

function validateSubject(input: unknown): SubjectInput {
  const i = input as Partial<SubjectInput>;
  const grade = parseGrade(i?.grade as number);
  if (!isBoard(i?.board) || grade === null || typeof i?.subject !== "string")
    throw new Error("Invalid input");
  if (!getSubject(i.board, grade, i.subject)) throw new Error("Unknown subject");
  return { board: i.board, grade, subject: i.subject };
}

export const fetchSyllabus = createServerFn({ method: "GET" })
  .validator(validateSubject)
  .handler(async ({ data }): Promise<SyllabusRecord | null> => {
    const sb = await publicClient();
    const { data: row, error } = await sb
      .from("syllabi")
      .select("id, board, grade, subject, books, created_at")
      .eq("board", data.board)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .maybeSingle();
    if (error) throw new Error("Could not load chapters");
    return (row as SyllabusRecord | null) ?? null;
  });

/** Chapter slugs (in book order) of every subject of a class that has a chapter list. */
export const fetchClassChapters = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const i = input as { board?: unknown; grade?: unknown };
    const grade = parseGrade(i?.grade as number);
    if (!isBoard(i?.board) || grade === null) throw new Error("Invalid input");
    return { board: i.board, grade };
  })
  .handler(async ({ data }): Promise<Record<string, string[]>> => {
    const sb = await publicClient();
    const { data: rows, error } = await sb
      .from("syllabi")
      .select("subject, books")
      .eq("board", data.board)
      .eq("grade", data.grade);
    if (error) throw new Error("Could not load chapters");
    const out: Record<string, string[]> = {};
    for (const r of rows ?? []) {
      const books = (r.books ?? []) as unknown as { chapters?: { slug?: string }[] }[];
      out[r.subject as string] = books.flatMap((b) =>
        (b.chapters ?? []).map((c) => c.slug).filter((s): s is string => !!s),
      );
    }
    return out;
  });

/** One textbook on a class shelf. */
export interface ShelfBook {
  name: string;
  code: string | null;
  /** Chapter slugs in book order (for per-book progress). */
  slugs: string[];
}

/** subject → its textbooks (in book order) for one class; only subjects whose list exists. */
export const fetchClassBooks = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const i = input as { board?: unknown; grade?: unknown };
    const grade = parseGrade(i?.grade as number);
    if (!isBoard(i?.board) || grade === null) throw new Error("Invalid input");
    return { board: i.board, grade };
  })
  .handler(async ({ data }): Promise<Record<string, ShelfBook[]>> => {
    const sb = await publicClient();
    const { data: rows, error } = await sb
      .from("syllabi")
      .select("subject, books")
      .eq("board", data.board)
      .eq("grade", data.grade);
    if (error) throw new Error("Could not load books");
    const out: Record<string, ShelfBook[]> = {};
    for (const r of rows ?? []) {
      const books = (r.books ?? []) as unknown as {
        name?: string;
        code?: string;
        chapters?: { slug?: string }[];
      }[];
      const list = books
        .map((b) => ({
          name: typeof b.name === "string" && b.name.trim() ? b.name.trim() : "",
          code: typeof b.code === "string" && b.code ? b.code : null,
          slugs: (b.chapters ?? []).map((c) => c.slug).filter((s): s is string => !!s),
        }))
        .filter((b) => b.slugs.length > 0);
      if (list.length) out[r.subject as string] = list;
    }
    return out;
  });

type NoteInput = SubjectInput & { chapter: string; lang: Lang };

export const fetchNote = createServerFn({ method: "GET" })
  .validator((input: unknown): NoteInput => {
    const base = validateSubject(input);
    const i = input as Partial<NoteInput>;
    if (typeof i.chapter !== "string" || i.chapter.length > 120 || !isLang(i.lang))
      throw new Error("Invalid input");
    return { ...base, chapter: i.chapter, lang: i.lang };
  })
  .handler(async ({ data }): Promise<NoteRecord | null> => {
    const sb = await publicClient();
    const { data: row, error } = await sb
      .from("notes")
      .select("*")
      .eq("board", data.board)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .eq("chapter_slug", data.chapter)
      .eq("language", data.lang)
      .maybeSingle();
    if (error) throw new Error("Could not load notes");
    return (row as NoteRecord | null) ?? null;
  });

export const fetchNoteLanguages = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const base = validateSubject(input);
    const i = input as { chapter?: unknown };
    if (typeof i.chapter !== "string" || i.chapter.length > 120) throw new Error("Invalid input");
    return { ...base, chapter: i.chapter };
  })
  .handler(async ({ data }): Promise<Lang[]> => {
    const sb = await publicClient();
    const { data: rows } = await sb
      .from("notes")
      .select("language")
      .eq("board", data.board)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .eq("chapter_slug", data.chapter);
    return (rows ?? []).map((r) => r.language as Lang);
  });

export interface ChapterHit {
  board: BoardId;
  grade: number;
  subject: string;
  slug: string;
  title: string;
  book: string;
}

export const searchChapters = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const q =
      typeof (input as { q?: unknown })?.q === "string"
        ? (input as { q: string }).q.trim().slice(0, 80)
        : "";
    return { q };
  })
  .handler(async ({ data }): Promise<ChapterHit[]> => {
    if (data.q.length < 2) return [];
    const sb = await publicClient();
    const { data: rows, error } = await sb.rpc("search_chapters", { q: data.q, max_results: 20 });
    if (error) throw new Error("Search failed");
    return ((rows ?? []) as ChapterHit[]).filter(
      (r) => isBoard(r.board) && getSubject(r.board, r.grade, r.subject),
    );
  });

export interface RevisionItem {
  noteId: string;
  chapter: string;
  title: string;
  points: string[];
  trackIndex: number;
}

/** 1-minute revisions of every chapter in a subject that already has notes in `lang`. */
export const fetchSubjectRevisions = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const base = validateSubject(input);
    const lang = (input as { lang?: unknown })?.lang;
    if (!isLang(lang)) throw new Error("Invalid input");
    return { ...base, lang };
  })
  .handler(async ({ data }): Promise<RevisionItem[]> => {
    const { buildTracks } = await import("@/lib/tracks");
    const sb = await publicClient();
    const { data: rows, error } = await sb
      .from("notes")
      .select("id, chapter_slug, chapter_title, content")
      .eq("board", data.board)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .eq("language", data.lang)
      .eq("is_custom", false);
    if (error) throw new Error("Could not load revisions");
    return (rows ?? []).flatMap((r) => {
      const content = r.content as unknown as import("@/lib/types").NoteContent;
      const trackIndex = buildTracks(content, data.lang).findIndex((t) => t.blockId === "revision");
      if (trackIndex < 0 || !content.quickRevision?.length) return [];
      return [
        {
          noteId: r.id as string,
          chapter: r.chapter_slug as string,
          title: r.chapter_title as string,
          points: content.quickRevision,
          trackIndex,
        },
      ];
    });
  });
