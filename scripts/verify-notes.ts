/**
 * Offline run: make every chapter's notes in the current format, check them against
 * the official textbook text and fix what the check finds.
 *
 *   bun scripts/verify-notes.ts                 # full run (skips finished chapters)
 *   bun scripts/verify-notes.ts --dry --limit=3 # only check, change nothing
 *   WORKERS=6 bun scripts/verify-notes.ts --board=cbse --grades=9-12 --subject=science
 *   bun scripts/verify-notes.ts --reverse          # second run, from the end of the list
 *
 * A chapter counts as finished when its stored notes have the "common mistakes" part
 * and a textbook check newer than the notes. Progress lives in the database, so the run
 * can be stopped and restarted at any time.
 */
import { appendFileSync, mkdirSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject, isBoard, isLang, type BoardId, type Lang } from "@/lib/catalog";
import { checkNote, type CheckIssue } from "@/lib/server/note-check.server";
import {
  findNote,
  loadChapterContext,
  purgeNotes,
  saveNote,
  writeNoteContent,
  type ChapterContext,
} from "@/lib/server/note-pipeline.server";
import type { NoteContent, NoteRecord, SyllabusBook } from "@/lib/types";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k ?? "", v ?? "true"] as const;
  }),
);
const DRY = args.has("dry");
const LIMIT = Number(args.get("limit") ?? Infinity);
const WORKERS = Number(process.env["WORKERS"] ?? 6);
const MAX_FIX_ROUNDS = 2;
const ONLY_BOARD = args.get("board");
const ONLY_SUBJECT = args.get("subject");
const [G_FROM, G_TO] = (args.get("grades") ?? "1-12").split("-").map(Number);
const LOG_DIR = "/tmp/verify";
mkdirSync(LOG_DIR, { recursive: true });
const LOG = `${LOG_DIR}/log.ndjson`;

const log = (entry: Record<string, unknown>) => {
  appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
};

interface Job {
  board: BoardId;
  grade: number;
  subject: string;
  chapter: string;
  lang: Lang;
}

const inScope = (board: string, grade: number, subject: string) =>
  (!ONLY_BOARD || board === ONLY_BOARD) &&
  (!ONLY_SUBJECT || subject === ONLY_SUBJECT) &&
  grade >= (G_FROM ?? 1) &&
  grade <= (G_TO ?? 12);

async function buildJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const add = (j: Job) => {
    const k = `${j.board}/${j.grade}/${j.subject}/${j.chapter}/${j.lang}`;
    if (seen.has(k)) return;
    seen.add(k);
    jobs.push(j);
  };

  // 1) Every CBSE chapter that has official textbook text, in Hinglish (the default language).
  const sources = await admin
    .from("chapter_sources")
    .select("board, grade, subject, chapter_slug")
    .order("grade")
    .order("subject")
    .order("chapter_slug")
    .limit(5000);
  if (sources.error) throw sources.error;
  for (const s of sources.data ?? []) {
    if (!isBoard(s.board) || !inScope(s.board, s.grade, s.subject)) continue;
    add({
      board: s.board,
      grade: s.grade,
      subject: s.subject,
      chapter: s.chapter_slug,
      lang: "hinglish",
    });
  }

  // 2) Every other stored note (other languages, ICSE/ISC, lower classes) gets upgraded + checked.
  const notes = await admin
    .from("notes")
    .select("board, grade, subject, chapter_slug, language, is_custom")
    .eq("is_custom", false)
    .order("board")
    .order("grade")
    .limit(5000);
  if (notes.error) throw notes.error;
  for (const n of notes.data ?? []) {
    if (!isBoard(n.board) || !isLang(n.language) || !inScope(n.board, n.grade, n.subject)) continue;
    add({
      board: n.board,
      grade: n.grade,
      subject: n.subject,
      chapter: n.chapter_slug,
      lang: n.language,
    });
  }
  return jobs;
}

const isComplete = (c: NoteContent) =>
  c.keyPoints.length > 0 && (c.mcqs?.length ?? 0) > 0 && (c.mistakes?.length ?? 0) > 0;

async function lastCheck(noteId: string) {
  const r = await admin
    .from("note_checks")
    .select("checked_at, issues")
    .eq("note_id", noteId)
    .maybeSingle();
  return r.data;
}

async function write(ctx: ChapterContext, lang: Lang): Promise<NoteContent> {
  let last: NoteContent | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    last = await writeNoteContent(ctx, lang);
    if (isComplete(last)) return last;
  }
  if (!last || last.keyPoints.length === 0) throw new Error("notes came back empty");
  return last;
}

async function recordFixes(ctx: ChapterContext, lang: Lang, noteId: string, issues: CheckIssue[]) {
  const now = new Date().toISOString();
  const rows = issues.map((i) => ({
    note_id: null,
    board: ctx.board,
    grade: ctx.grade,
    subject: ctx.subject.slug,
    chapter_slug: ctx.chapter,
    chapter_title: ctx.chapterTitle,
    language: lang,
    section: i.section,
    message: `[Textbook check · ${i.kind}] ${i.wrong || "(missing in notes)"}`.slice(0, 1000),
    status: "resolved",
    correction: i.correct,
    resolved_at: now,
    // The chapter is rewritten with this correction straight away.
    applied_at: now,
  }));
  if (rows.length) {
    const r = await admin.from("note_reports").insert(rows);
    if (r.error) throw r.error;
  }
  void noteId;
}

async function saveCheck(noteId: string, issues: CheckIssue[]) {
  const r = await admin
    .from("note_checks")
    .upsert({ note_id: noteId, issues: issues as never, checked_at: new Date().toISOString() });
  if (r.error) throw r.error;
}

async function runJob(job: Job): Promise<string> {
  const subject = getSubject(job.board, job.grade, job.subject);
  if (!subject) return "skip:no-subject";
  const where = { board: job.board, grade: job.grade, subject, chapter: job.chapter };

  const existing = (await findNote(admin, where, job.lang)).data as unknown as NoteRecord | null;
  if (existing && existing.content.mistakes) {
    const chk = await lastCheck(existing.id);
    if (chk && chk.checked_at >= existing.created_at) return "skip:done";
  }

  let ctx = await loadChapterContext(admin, where);

  if (DRY) {
    if (!existing) return "dry:no-note";
    const issues = await checkNote({
      board: job.board,
      grade: job.grade,
      subject,
      chapterTitle: ctx.chapterTitle,
      content: existing.content,
      source: ctx.source,
    });
    log({ job, dry: true, issues });
    return `dry:${issues.length} issues`;
  }

  let note: NoteRecord;
  if (existing && existing.content.mistakes && isComplete(existing.content)) {
    note = existing;
  } else {
    if (existing) await purgeNotes(admin, { ...job, subject: job.subject }, [existing.id]);
    note = await saveNote(admin, ctx, job.lang, await write(ctx, job.lang));
  }

  let total = 0;
  for (let round = 0; ; round++) {
    const issues = await checkNote({
      board: job.board,
      grade: job.grade,
      subject,
      chapterTitle: ctx.chapterTitle,
      content: note.content,
      source: ctx.source,
    });
    if (issues.length === 0 || round >= MAX_FIX_ROUNDS) {
      await saveCheck(note.id, issues);
      log({ job, round, total, left: issues });
      return issues.length === 0
        ? `ok after ${round} fix${round === 1 ? "" : "es"} (${total} found)`
        : `left ${issues.length} after ${round} fixes`;
    }
    total += issues.length;
    log({ job, round, found: issues });
    await recordFixes(ctx, job.lang, note.id, issues);
    await purgeNotes(admin, { ...job, subject: job.subject }, [note.id]);
    ctx = await loadChapterContext(admin, where);
    note = await saveNote(admin, ctx, job.lang, await write(ctx, job.lang));
  }
}

let stopAll = false;

async function worker(id: number, queue: Job[], stats: Record<string, number>) {
  while (!stopAll) {
    const job = queue.shift();
    if (!job) return;
    const label = `${job.board}/${job.grade}/${job.subject}/${job.chapter} [${job.lang}]`;
    for (let attempt = 1; attempt <= 3 && !stopAll; attempt++) {
      const t0 = Date.now();
      try {
        const res = await runJob(job);
        const kind = res.split(/[: ]/)[0] ?? res;
        stats[kind] = (stats[kind] ?? 0) + 1;
        if (!res.startsWith("skip")) {
          console.log(`[w${id}] ${label} → ${res} (${Math.round((Date.now() - t0) / 1000)}s)`);
        }
        break;
      } catch (error) {
        const e = error as { status?: number; message?: string };
        console.error(`[w${id}] ${label} attempt ${attempt} failed:`, e.status ?? "", e.message);
        log({ job, error: e.message, status: e.status, attempt });
        if (e.status === 402) {
          console.error("AI credits are used up — stopping.");
          stopAll = true;
          return;
        }
        await new Promise((r) => setTimeout(r, (e.status === 429 ? 60_000 : 10_000) * attempt));
        if (attempt === 3) stats["failed"] = (stats["failed"] ?? 0) + 1;
      }
    }
  }
}

async function main() {
  const all = await buildJobs();
  // A second run can work from the other end of the list without colliding.
  if (args.has("reverse")) all.reverse();
  const jobs = all.slice(0, LIMIT);
  console.log(`${jobs.length} chapter jobs · ${WORKERS} workers${DRY ? " · DRY RUN" : ""}`);
  const stats: Record<string, number> = {};
  const queue = [...jobs];
  const timer = setInterval(
    () => console.log(`… ${queue.length} waiting · ${JSON.stringify(stats)}`),
    120_000,
  );
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1, queue, stats)));
  clearInterval(timer);
  console.log("finished", JSON.stringify(stats));
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

export type { SyllabusBook };
