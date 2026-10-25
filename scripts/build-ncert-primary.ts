/**
 * Rebuild CBSE Class 1–8 chapter lists from the official NCERT chapter PDFs.
 *
 *   bun scripts/build-ncert-primary.ts [--dry] [--grade=6] [--subject=english]
 *
 * Input (prepared before the run):
 *   /tmp/ph/books-clean.json  { "<book code>": [["<chapter pdf code>", "<title hint>"], ...] }
 *   /tmp/ph/txt/<chapter pdf code>.txt  text extracted from each official chapter PDF
 *
 * For every PDF the AI reads the start of the text and returns the lesson(s) it holds with
 * the exact printed title and a one-line gist. One PDF can hold several lessons (Sarangi pairs a
 * story with a poem, Poorvi has one PDF per unit); each lesson becomes its own chapter that keeps
 * the PDF number for the textbook link, and the PDF text is stored as its source.
 * Stored notes of chapters that disappear are deleted.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject } from "@/lib/catalog";
import { streamStructured } from "@/lib/server/ai.server";
import { purgeNotes } from "@/lib/server/note-pipeline.server";
import { chapterSlug } from "@/lib/slugs";
import type { SyllabusBook } from "@/lib/types";

interface PlanBook {
  code: string;
  name: string;
  /** Chapters typed in by hand when the official PDFs are not reachable. */
  manual?: string[];
}
interface PlanSubject {
  grade: number;
  subject: string;
  books: PlanBook[];
}

const PLAN: PlanSubject[] = [
  { grade: 1, subject: "english", books: [{ code: "aemr1", name: "Mridang" }] },
  { grade: 1, subject: "hindi", books: [{ code: "ahsr1", name: "सारंगी" }] },
  { grade: 1, subject: "maths", books: [{ code: "aejm1", name: "Joyful Mathematics" }] },
  { grade: 2, subject: "english", books: [{ code: "bemr1", name: "Mridang" }] },
  { grade: 2, subject: "hindi", books: [{ code: "bhsr1", name: "सारंगी" }] },
  { grade: 2, subject: "maths", books: [{ code: "bejm1", name: "Joyful Mathematics" }] },
  { grade: 3, subject: "english", books: [{ code: "cesa1", name: "Santoor" }] },
  { grade: 3, subject: "hindi", books: [{ code: "chve1", name: "वीणा" }] },
  { grade: 3, subject: "maths", books: [{ code: "cemm1", name: "Maths Mela" }] },
  { grade: 3, subject: "evs", books: [{ code: "ceev1", name: "Our Wondrous World" }] },
  { grade: 4, subject: "english", books: [{ code: "desa1", name: "Santoor" }] },
  { grade: 4, subject: "hindi", books: [{ code: "dhve1", name: "वीणा" }] },
  { grade: 4, subject: "maths", books: [{ code: "demm1", name: "Maths Mela" }] },
  { grade: 4, subject: "evs", books: [{ code: "deev1", name: "Our Wondrous World" }] },
  { grade: 5, subject: "english", books: [{ code: "eesa1", name: "Santoor" }] },
  { grade: 5, subject: "hindi", books: [{ code: "ehve1", name: "वीणा" }] },
  { grade: 5, subject: "maths", books: [{ code: "eemm1", name: "Maths Mela" }] },
  { grade: 5, subject: "evs", books: [{ code: "eeev1", name: "Our Wondrous World" }] },
  { grade: 6, subject: "english", books: [{ code: "fepr1", name: "Poorvi" }] },
  { grade: 6, subject: "hindi", books: [{ code: "fhml1", name: "मल्हार" }] },
  { grade: 6, subject: "maths", books: [{ code: "fegp1", name: "Ganita Prakash" }] },
  { grade: 6, subject: "science", books: [{ code: "fecu1", name: "Curiosity" }] },
  {
    grade: 6,
    subject: "social-science",
    books: [{ code: "fees1", name: "Exploring Society: India and Beyond" }],
  },
  { grade: 6, subject: "sanskrit", books: [{ code: "fsde1", name: "दीपकम्" }] },
  { grade: 7, subject: "english", books: [{ code: "gepr1", name: "Poorvi" }] },
  { grade: 7, subject: "hindi", books: [{ code: "ghml1", name: "मल्हार" }] },
  {
    grade: 7,
    subject: "maths",
    books: [
      { code: "gegp1", name: "Ganita Prakash — Part I" },
      { code: "gegp2", name: "Ganita Prakash — Part II" },
    ],
  },
  { grade: 7, subject: "science", books: [{ code: "gecu1", name: "Curiosity" }] },
  {
    grade: 7,
    subject: "social-science",
    books: [
      { code: "gees1", name: "Exploring Society: India and Beyond — Part 1" },
      { code: "gees2", name: "Exploring Society: India and Beyond — Part 2" },
    ],
  },
  { grade: 7, subject: "sanskrit", books: [{ code: "gsde1", name: "दीपकम्" }] },
  { grade: 8, subject: "english", books: [{ code: "hepr1", name: "Poorvi" }] },
  { grade: 8, subject: "hindi", books: [{ code: "hhml1", name: "मल्हार" }] },
  {
    grade: 8,
    subject: "maths",
    books: [
      { code: "hegp1", name: "Ganita Prakash — Part I" },
      { code: "hegp2", name: "Ganita Prakash — Part II" },
    ],
  },
  { grade: 8, subject: "science", books: [{ code: "hecu1", name: "Curiosity" }] },
  {
    grade: 8,
    subject: "social-science",
    books: [
      { code: "hees1", name: "Exploring Society: India and Beyond — Part 1" },
      {
        // Revised edition released July 2026; its PDFs are not reachable from here yet.
        code: "hees2",
        name: "Exploring Society: India and Beyond — Part 2",
        manual: [
          "World Geography: Some Glimpses",
          "India's Long Road to Independence",
          "A Journey Through Indian Architecture",
          "The Role of the Judiciary in Our Society",
          "Citizenship: Rights and Duties",
          "Dynamics of Population",
          "India's Urban Landscape",
          "Cultural Currents: 13th to 17th Centuries",
        ],
      },
    ],
  },
  { grade: 8, subject: "sanskrit", books: [{ code: "hsde1", name: "दीपकम्" }] },
];

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k ?? "", v ?? "true"] as const;
  }),
);
const DRY = args.has("dry");
const ONLY_GRADE = args.get("grade") ? Number(args.get("grade")) : null;
const ONLY_SUBJECT = args.get("subject") ?? null;
const CACHE = "/tmp/ph/lessons.json";

const hints = JSON.parse(readFileSync("/tmp/ph/books-clean.json", "utf8")) as Record<
  string,
  [string, string][]
>;
const lessonCache: Record<string, Lesson[]> = existsSync(CACHE)
  ? JSON.parse(readFileSync(CACHE, "utf8"))
  : {};

interface Lesson {
  title: string;
  gist: string;
  noText?: boolean;
}

/** Letters only, so OCR spacing/punctuation differences do not matter. */
const letters = (s: string) => s.replace(/[^\p{L}\p{M}]/gu, "").toLowerCase();

/** Dice similarity of character pairs. */
function similar(a: string, b: string): number {
  const x = letters(a);
  const y = letters(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 1;
  const pairs = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const px = pairs(x);
  const py = pairs(y);
  let hit = 0;
  for (const [k, n] of px) hit += Math.min(n, py.get(k) ?? 0);
  return (2 * hit) / Math.max(1, x.length - 1 + y.length - 1);
}

/**
 * The contents page can list a lesson whose text is not extractable (a poem printed as a
 * picture). Keep every lesson the contents page names, in its order.
 */
function withHintLessons(hint: string, lessons: Lesson[], text: string): Lesson[] {
  // "Unit 2: Wit and Humour – A | B | C" or "Unit 1: Wit and Wisdom: A; B; C" or "A | B".
  const body = hint.replace(/^unit\s+[\divx]+\s*:\s*[^:–]+[:–]\s*/i, "");
  const parts = body
    .split(/\s*[|;]\s*/)
    .map(clean)
    .filter(Boolean);
  // Only a contents entry that names several lessons is a full list; trust it over the AI.
  if (parts.length < 2) return lessons;
  const inText = letters(text);
  const out: Lesson[] = [];
  const used = new Set<Lesson>();
  for (const part of parts) {
    const match = lessons.find((l) => !used.has(l) && similar(l.title, part) >= 0.6);
    if (match) {
      used.add(match);
      out.push(match);
    } else {
      const key = letters(part).slice(0, 10);
      out.push({ title: part, gist: "", noText: !key || !inText.includes(key) });
    }
  }
  return out;
}

/** PDFs whose first heading is not the chapter (e.g. a book introduction before chapter 1). */
const OVERRIDES: Record<string, Lesson[]> = {
  fees101: [
    {
      title: "Locating Places on the Earth",
      gist: "How maps, the globe, latitudes and longitudes help us locate places on Earth.",
    },
  ],
  // The contents page misspells both titles; the printed lesson reads like this.
  hhml110: [
    {
      title: "तरुण के स्वप्न",
      gist: "Subhas Chandra Bose shares his dream of a free, equal and strong India with the youth.",
    },
    {
      title: "भारति, जय, विजय करे!",
      gist: "Nirala's musical poem praising Mother India; given for reading pleasure.",
    },
  ],
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Strip PDF layout noise but keep the reading order. */
function cleanSource(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/\t+/g, " ").trimEnd())
    .filter(
      (l) =>
        !/^\s*Reprint\s+20\d\d-\d\d\s*$/i.test(l) &&
        !/\.indd\s+\d+/i.test(l) &&
        !/^\s*\d{1,2}-[A-Za-z]{3}-\d{2}\s+\d{1,2}:\d\d/.test(l) &&
        !/^\s*\d{1,3}\s*$/.test(l),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const LESSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lessons"],
  properties: {
    lessons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "gist"],
        properties: { title: { type: "string" }, gist: { type: "string" } },
      },
    },
  },
} as const;

async function lessonsOf(
  plan: PlanSubject,
  book: PlanBook,
  pdfCode: string,
  hint: string,
  text: string,
): Promise<Lesson[]> {
  if (lessonCache[pdfCode]) return lessonCache[pdfCode]!;
  const subject = getSubject("cbse", plan.grade, plan.subject)!;
  const multi = hint.includes("|") || /^unit\b/i.test(hint) || book.code.endsWith("pr1");
  const out = await streamStructured<{ lessons: Lesson[] }>({
    instructions: [
      "You read the text extracted from one official NCERT textbook PDF and list the lesson(s) it contains.",
      "Return the exact lesson title as printed in the textbook, in the textbook's own script (Devanagari for Hindi/Sanskrit, English otherwise).",
      "The extracted text can break Devanagari matras or split words; write the title with correct spelling and spacing as it would appear in print.",
      "Do not add numbering words such as 'Chapter 1', 'Unit 2', 'प्रथमः पाठः' or the genre label in brackets such as (कविता).",
      "For mathematics chapters whose hint has the topic in brackets, keep that bracket, e.g. 'Mango Treat (Numbers 1 to 9)'.",
      "gist: one plain-English sentence (max 14 words) saying what the lesson is about, based only on the text.",
    ].join("\n"),
    prompt: [
      `Class ${plan.grade}. Subject: ${subject.name}. Book: ${book.name}.`,
      `Title hint from the book's table of contents (may contain typos): ${hint}`,
      multi
        ? "This PDF can contain several lessons/poems (for example a story and a poem, or a whole unit). Return every lesson and poem in reading order, but not the unit name itself and not 'Let us read'-type activity headings."
        : "This PDF contains one lesson; return exactly one item.",
      "",
      "Extracted text:",
      "<<<",
      text.slice(0, multi ? 120000 : 5000),
      ">>>",
    ].join("\n"),
    schema: LESSON_SCHEMA,
    effort: "low",
  });
  const lessons = out.lessons
    .map((l) => ({ title: clean(l.title), gist: clean(l.gist) }))
    .filter((l) => l.title.length > 0);
  if (lessons.length === 0) throw new Error(`no lesson found in ${pdfCode}`);
  lessonCache[pdfCode] = lessons;
  writeFileSync(CACHE, JSON.stringify(lessonCache, null, 1));
  return lessons;
}

interface BuiltChapter {
  title: string;
  gist: string;
  pdf: number;
  pdfCode: string | null;
  source: string | null;
  shared: boolean;
}

async function buildBook(plan: PlanSubject, book: PlanBook): Promise<BuiltChapter[]> {
  if (book.manual) {
    return book.manual.map((title, i) => ({
      title,
      gist: "",
      pdf: i + 1,
      pdfCode: null,
      source: null,
      shared: false,
    }));
  }
  const list = hints[book.code];
  if (!list?.length) throw new Error(`no chapter list for ${book.code}`);
  const chapters: BuiltChapter[] = [];
  for (const [pdfCode, hint] of list) {
    const path = `/tmp/ph/txt/${pdfCode}.txt`;
    if (!existsSync(path)) throw new Error(`missing text ${pdfCode}`);
    const text = cleanSource(readFileSync(path, "utf8"));
    if (text.length < 200) throw new Error(`text too short ${pdfCode}`);
    const lessons =
      OVERRIDES[pdfCode] ?? withHintLessons(hint, await lessonsOf(plan, book, pdfCode, hint, text), text);
    const pdf = Number(pdfCode.slice(-2));
    const appendix = /परिशिष्ट|अतिरिक्तम्/.test(hint);
    for (const l of lessons) {
      chapters.push({
        title: appendix && !/परिशिष्ट/.test(l.title) ? `${l.title} (परिशिष्टम्)` : l.title,
        gist: l.gist,
        pdf,
        pdfCode,
        // A lesson the contents page lists but whose text is not in the PDF (printed as a picture).
        source: l.noText ? null : text,
        shared: lessons.length > 1,
      });
    }
  }
  return chapters;
}

async function writeGists(plan: PlanSubject, chapters: BuiltChapter[]) {
  const missing = chapters.filter((c) => !c.gist);
  if (!missing.length) return;
  const subject = getSubject("cbse", plan.grade, plan.subject)!;
  const out = await streamStructured<{ lessons: Lesson[] }>({
    instructions:
      "You write one plain-English sentence (max 14 words) per NCERT chapter saying what it is about. Only say what the title clearly implies; no invented details.",
    prompt: [`Class ${plan.grade}. Subject: ${subject.name}.`, ...missing.map((c) => `- ${c.title}`)].join(
      "\n",
    ),
    schema: LESSON_SCHEMA,
    effort: "low",
  });
  missing.forEach((c, i) => {
    c.gist = clean(out.lessons[i]?.gist ?? "");
  });
}

async function apply(plan: PlanSubject) {
  const label = `cbse/${plan.grade}/${plan.subject}`;
  if (!getSubject("cbse", plan.grade, plan.subject)) throw new Error(`unknown subject ${label}`);
  const built: { book: PlanBook; chapters: BuiltChapter[] }[] = [];
  for (const book of plan.books) built.push({ book, chapters: await buildBook(plan, book) });
  for (const b of built) await writeGists(plan, b.chapters);

  const books: SyllabusBook[] = built.map(({ book, chapters }, bi) => ({
    name: book.name,
    code: book.code,
    chapters: chapters.map((c, ci) => ({
      slug: chapterSlug(bi, ci, c.title),
      number: ci + 1,
      pdf: c.pdf,
      title: c.title,
      gist: c.gist,
    })),
  }));
  const slugs = new Set(books.flatMap((b) => b.chapters.map((c) => c.slug)));
  console.log(
    `${label}: ${books.map((b) => `${b.name} ${b.chapters.length}`).join(" + ")} → ${books
      .flatMap((b) => b.chapters.map((c) => `${c.number}.${c.title}`))
      .join(" | ")}`,
  );
  if (DRY) return;

  const old = await admin
    .from("syllabi")
    .select("books")
    .eq("board", "cbse")
    .eq("grade", plan.grade)
    .eq("subject", plan.subject)
    .maybeSingle();
  const res = old.data
    ? await admin
        .from("syllabi")
        .update({ books: books as never })
        .eq("board", "cbse")
        .eq("grade", plan.grade)
        .eq("subject", plan.subject)
    : await admin
        .from("syllabi")
        .insert({ board: "cbse", grade: plan.grade, subject: plan.subject, books: books as never });
  if (res.error) throw res.error;

  // Textbook text for every chapter (replaces whatever was stored before).
  const del = await admin
    .from("chapter_sources")
    .delete()
    .eq("board", "cbse")
    .eq("grade", plan.grade)
    .eq("subject", plan.subject);
  if (del.error) throw del.error;
  const rows = built.flatMap(({ chapters }, bi) =>
    chapters
      .map((c, ci) => ({ c, slug: chapterSlug(bi, ci, c.title) }))
      .filter(({ c }) => c.source && c.pdfCode)
      .map(({ c, slug }) => ({
        board: "cbse",
        grade: plan.grade,
        subject: plan.subject,
        chapter_slug: slug,
        source_url: `https://ncert.nic.in/textbook/pdf/${c.pdfCode}.pdf`,
        body: c.shared
          ? `[This textbook PDF holds several lessons. This chapter is only the lesson "${c.title}".]\n\n${c.source}`
          : c.source!,
      })),
  );
  for (let i = 0; i < rows.length; i += 20) {
    const ins = await admin.from("chapter_sources").insert(rows.slice(i, i + 20));
    if (ins.error) throw ins.error;
  }

  // Notes made before the textbook text was stored were written from memory: drop them all so
  // the next visit writes them from the book.
  const notes = await admin
    .from("notes")
    .select("id, chapter_slug, is_custom")
    .eq("board", "cbse")
    .eq("grade", plan.grade)
    .eq("subject", plan.subject);
  const orphan = (notes.data ?? [])
    .filter((n) => !n.is_custom)
    .map((n) => n.id);
  if (orphan.length) {
    await purgeNotes(
      admin,
      { board: "cbse", grade: plan.grade, subject: plan.subject, chapter: "" },
      orphan,
    );
  }
  console.log(`  saved: ${slugs.size} chapters, ${rows.length} textbook texts, ${orphan.length} old notes removed (were not from the book)`);
}

const todo = PLAN.filter(
  (p) => (ONLY_GRADE === null || p.grade === ONLY_GRADE) && (!ONLY_SUBJECT || p.subject === ONLY_SUBJECT),
);
const WORKERS = Number(process.env["WORKERS"] ?? 4);
let next = 0;
await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    while (next < todo.length) {
      const plan = todo[next++]!;
      try {
        await apply(plan);
      } catch (error) {
        console.error(`cbse/${plan.grade}/${plan.subject} failed:`, (error as Error).message);
      }
    }
  }),
);
process.exit(0);
