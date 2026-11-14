/**
 * Builds the writing agent's to-do list from what the app already stores.
 *   bun scripts/agent/tasks.ts
 *
 * One row per chapter + language that still has no notes. A row is `open` when the
 * official textbook text is stored (so the agent can write from it) and `blocked`
 * when it is not. Rows already claimed or applied by a reviewer are never reopened.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { SyllabusBook } from "@/lib/types";

const LANGS = ["hinglish", "hi", "en"] as const;
const PAGE = 1000;

/** Read a whole table one page at a time — the data API caps every response. */
async function all<Row extends Record<string, unknown>>(table: string, columns: string, filter?: (q: any) => any) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

const key = (board: string, grade: number, subject: string, chapter: string, language: string) =>
  `${board}|${grade}|${subject}|${chapter}|${language}`;

const syllabi = await all("syllabi", "board, grade, subject, books");
const storedNotes = await all<Record<string, unknown>>("notes", "board, grade, subject, chapter_slug, language", (q: any) =>
  q.eq("is_custom", false),
);
const sources = await all<Record<string, unknown>>("chapter_sources", "board, grade, subject, chapter_slug, source_url, body_chars");

const haveNote = new Set(storedNotes.map((n) => key(String(n.board), Number(n.grade), String(n.subject), String(n.chapter_slug), String(n.language))));
const sourceOf = new Map<string, { url: string | null; chars: number }>();
for (const s of sources) {
  const k = `${s.board}|${s.grade}|${s.subject}|${s.chapter_slug}`;
  const chars = Number(s.body_chars ?? 0);
  const prev = sourceOf.get(k);
  if (!prev || chars > prev.chars) sourceOf.set(k, { url: (s.source_url as string | null) ?? null, chars });
}

type Draft = {
  board: string;
  grade: number;
  subject: string;
  chapter_slug: string;
  chapter_title: string;
  book_name: string | null;
  language: string;
  source_url: string | null;
  source_chars: number;
  has_source: boolean;
  status: string;
};

const drafts: Draft[] = [];
const live = new Set<string>();
for (const row of syllabi) {
  const board = String(row.board);
  const grade = Number(row.grade);
  const subject = String(row.subject);
  for (const book of ((row.books ?? []) as SyllabusBook[])) {
    for (const chapter of book.chapters ?? []) {
      const source = sourceOf.get(`${board}|${grade}|${subject}|${chapter.slug}`);
      for (const language of LANGS) {
        const k = key(board, grade, subject, chapter.slug, language);
        live.add(k);
        if (haveNote.has(k)) continue;
        drafts.push({
          board,
          grade,
          subject,
          chapter_slug: chapter.slug,
          chapter_title: chapter.title,
          book_name: book.name ?? null,
          language,
          source_url: source?.url ?? null,
          source_chars: source?.chars ?? 0,
          has_source: Boolean(source && source.chars > 0),
          status: source && source.chars > 0 ? "open" : "blocked",
        });
      }
    }
  }
}

/** Insert only rows that are not there yet — a claimed or applied row keeps its status. */
let inserted = 0;
for (let i = 0; i < drafts.length; i += 200) {
  const { error } = await admin.from("agent_tasks").upsert(drafts.slice(i, i + 200), {
    onConflict: "board,grade,subject,chapter_slug,language",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  inserted += drafts.slice(i, i + 200).length;
}

/** Textbook text may have arrived (or a note been imported) since a row was written. */
const existing = await all<Record<string, unknown>>(
  "agent_tasks",
  "id, board, grade, subject, chapter_slug, language, status, has_source, source_url, source_chars",
);
const byKey = new Map(existing.map((r) => [key(String(r.board), Number(r.grade), String(r.subject), String(r.chapter_slug), String(r.language)), r]));
const wanted = new Map(drafts.map((d) => [key(d.board, d.grade, d.subject, d.chapter_slug, d.language), d]));

const reopen: { id: number; has_source: boolean; source_url: string | null; source_chars: number; status: string }[] = [];
const applied: number[] = [];
for (const [k, row] of byKey) {
  const status = String(row.status);
  if (status === "applied") continue;
  if (haveNote.has(k)) {
    applied.push(Number(row.id));
    continue;
  }
  if (status === "claimed") continue;
  const want = wanted.get(k);
  if (!want) continue;
  if (Boolean(row.has_source) !== want.has_source || String(row.source_url ?? "") !== String(want.source_url ?? "") || Number(row.source_chars) !== want.source_chars) {
    reopen.push({ id: Number(row.id), has_source: want.has_source, source_url: want.source_url, source_chars: want.source_chars, status: want.status });
  }
}
for (const patch of reopen) {
  const { error } = await admin.from("agent_tasks").update(patch).eq("id", patch.id);
  if (error) throw error;
}
if (applied.length) {
  const { error } = await admin
    .from("agent_tasks")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .in("id", applied);
  if (error) throw error;
}

/** Chapters a rebuilt syllabus dropped are no longer work. */
const stale = [...byKey.keys()].filter((k) => !live.has(k) && String(byKey.get(k)!.status) !== "applied");
if (stale.length) {
  const ids = stale.map((k) => Number(byKey.get(k)!.id));
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await admin.from("agent_tasks").delete().in("id", ids.slice(i, i + 500));
    if (error) throw error;
  }
}

const counts: Record<string, number> = {};
const after = await all<Record<string, unknown>>("agent_tasks", "status, has_source");
for (const r of after) {
  const status = String(r.status);
  counts[status] = (counts[status] ?? 0) + 1;
  if (status === "open" && !r.has_source) counts["open_without_text"] = (counts["open_without_text"] ?? 0) + 1;
}
console.log(
  `queue: ${after.length} rows (wanted ${drafts.length}, reopened ${reopen.length}, applied ${applied.length}, dropped ${stale.length})`,
);
console.log(counts);
