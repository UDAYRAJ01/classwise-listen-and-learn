/**
 * Replace stored chapter lists with verified ones.
 *
 *   bun scripts/set-syllabus.ts path/to/lists.json [--dry]
 *
 * lists.json = [{ board, grade, subject, books: [{ name, code?, chapters: [{ title, gist?, pdf? }] }] }]
 *
 * - Chapter slugs are rebuilt from position + title (same rule as the app).
 * - Missing gists are written by the AI in one call per subject.
 * - Stored notes (and audio) for chapters that are no longer in the list are deleted, so the
 *   app never shows notes for a chapter the book does not have.
 */
import { readFileSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject, isBoard, type BoardId } from "@/lib/catalog";
import { streamStructured } from "@/lib/server/ai.server";
import { purgeNotes } from "@/lib/server/note-pipeline.server";
import { chapterSlug } from "@/lib/slugs";
import type { SyllabusBook } from "@/lib/types";

interface InChapter {
  title: string;
  gist?: string;
  pdf?: number;
}
interface InList {
  board: BoardId;
  grade: number;
  subject: string;
  books: { name: string; code?: string; chapters: InChapter[] }[];
}

const file = process.argv[2];
const DRY = process.argv.includes("--dry");
if (!file) throw new Error("usage: bun scripts/set-syllabus.ts lists.json [--dry]");
const lists = JSON.parse(readFileSync(file, "utf8")) as InList[];

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

async function writeGists(list: InList, missing: InChapter[]): Promise<void> {
  if (missing.length === 0) return;
  const subject = getSubject(list.board, list.grade, list.subject)!;
  const out = await streamStructured<{ gists: { title: string; gist: string }[] }>({
    instructions:
      "You write one plain-English sentence (max 14 words) per school chapter saying what it is about. Be accurate to the textbook; no invented details.",
    prompt: [
      `Board: ${list.board.toUpperCase()}. Class ${list.grade}. Subject: ${subject.name}.`,
      `Books: ${list.books.map((b) => b.name).join("; ")}.`,
      "Chapters:",
      ...missing.map((c) => `- ${c.title}`),
    ].join("\n"),
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["gists"],
      properties: {
        gists: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "gist"],
            properties: { title: { type: "string" }, gist: { type: "string" } },
          },
        },
      },
    },
    effort: "low",
  });
  const byTitle = new Map(out.gists.map((g) => [clean(g.title), clean(g.gist)]));
  missing.forEach((c, i) => {
    c.gist = byTitle.get(clean(c.title)) ?? clean(out.gists[i]?.gist ?? "");
  });
}

async function apply(list: InList) {
  if (!isBoard(list.board) || !getSubject(list.board, list.grade, list.subject)) {
    throw new Error(`unknown subject ${list.board}/${list.grade}/${list.subject}`);
  }
  // Keep existing gists for chapters whose title did not change.
  const old = await admin
    .from("syllabi")
    .select("books")
    .eq("board", list.board)
    .eq("grade", list.grade)
    .eq("subject", list.subject)
    .maybeSingle();
  const oldBooks = (old.data?.books ?? []) as unknown as SyllabusBook[];
  const oldGist = new Map(
    oldBooks.flatMap((b) => b.chapters.map((c) => [clean(c.title), c.gist] as const)),
  );
  const missing: InChapter[] = [];
  for (const b of list.books)
    for (const c of b.chapters) {
      c.title = clean(c.title);
      c.gist = c.gist ? clean(c.gist) : (oldGist.get(c.title) ?? "");
      if (!c.gist) missing.push(c);
    }
  if (!DRY) await writeGists(list, missing);

  const books: SyllabusBook[] = list.books.map((b, bi) => ({
    name: clean(b.name),
    ...(b.code ? { code: b.code } : {}),
    chapters: b.chapters.map((c, ci) => ({
      slug: chapterSlug(bi, ci, c.title),
      number: ci + 1,
      ...(c.pdf ? { pdf: c.pdf } : {}),
      title: c.title,
      gist: c.gist ?? "",
    })),
  }));
  const slugs = new Set(books.flatMap((b) => b.chapters.map((c) => c.slug)));
  const oldSlugs = oldBooks.flatMap((b) => b.chapters.map((c) => c.slug));
  const gone = oldSlugs.filter((s) => !slugs.has(s));
  const label = `${list.board}/${list.grade}/${list.subject}`;
  console.log(
    `${label}: ${slugs.size} chapters (${oldSlugs.length} before), ${gone.length} old chapter links gone`,
  );
  if (DRY) return;

  const row = { board: list.board, grade: list.grade, subject: list.subject, books: books as never };
  const res = old.data
    ? await admin
        .from("syllabi")
        .update({ books: row.books })
        .eq("board", list.board)
        .eq("grade", list.grade)
        .eq("subject", list.subject)
    : await admin.from("syllabi").insert(row);
  if (res.error) throw res.error;

  // Notes for chapters that are no longer in the book.
  const notes = await admin
    .from("notes")
    .select("id, chapter_slug, is_custom")
    .eq("board", list.board)
    .eq("grade", list.grade)
    .eq("subject", list.subject);
  const orphan = (notes.data ?? [])
    .filter((n) => !n.is_custom && !slugs.has(n.chapter_slug))
    .map((n) => n.id);
  if (orphan.length) {
    await purgeNotes(
      admin,
      { board: list.board, grade: list.grade, subject: list.subject, chapter: "" },
      orphan,
    );
    console.log(`  removed ${orphan.length} notes of chapters no longer in the book`);
  }
}

for (const list of lists) {
  try {
    await apply(list);
  } catch (error) {
    console.error(`${list.board}/${list.grade}/${list.subject} failed:`, (error as Error).message);
  }
}
process.exit(0);
