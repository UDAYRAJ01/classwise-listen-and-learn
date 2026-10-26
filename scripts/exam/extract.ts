/**
 * Turns each real past paper (scripts/exam/papers.json) into stored questions:
 * page images → question text (Markdown + LaTeX), options, official answer, figure position.
 *
 *   bun scripts/exam/extract.ts                       # every paper not extracted yet
 *   bun scripts/exam/extract.ts --only=neet-2021 --redo
 *
 * Page images are kept in the private `exam-pages` bucket so questions with a diagram can
 * show the original paper. Answers come only from the official key / the answers printed
 * in the paper; nothing here is guessed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";

import { args, askJson, normalizeAnswer, pool, StopRun } from "./lib";
import { segmentSubjects } from "./segment";

interface PaperSpec {
  slug: string;
  exam: "jee-main" | "jee-advanced" | "neet";
  year: number;
  label: string;
  url: string;
  heldOn?: string;
  keyUrl?: string;
  /** Where the answers come from: the exam body's final key, a coaching key, or none. */
  answers: "official" | "coaching" | "none";
  /** Only these PDF pages (inclusive) belong to this paper. */
  pageRange?: [number, number];
  /** Optional local copy (used when the source needs a browser to download). */
  file?: string;
  keyFile?: string;
}

const ROOT = "/tmp/exam";
const PAPERS: PaperSpec[] = JSON.parse(
  readFileSync(new URL("./papers.json", import.meta.url), "utf8"),
);
const ONLY = args.get("only")?.split(",");
const REDO = args.has("redo");
const WORKERS = Number(args.get("workers") ?? 4);

async function download(url: string, file: string) {
  if (existsSync(file) && statSync(file).size > 2000) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && buf.subarray(0, 5).toString() === "%PDF-") {
      writeFileSync(file, buf);
      return;
    }
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
  throw new Error(`could not download ${url}`);
}

function renderPages(pdf: string, dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  if (!readdirSync(dir).some((f) => f.endsWith(".png"))) {
    execFileSync("pdftoppm", ["-r", "130", "-png", pdf, `${dir}/p`]);
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

function pageText(pdf: string, page: number): string {
  try {
    return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdf, "-"], {
      maxBuffer: 16 << 20,
    })
      .toString()
      .slice(0, 9000);
  } catch {
    return "";
  }
}

const SUBJECTS = ["physics", "chemistry", "maths", "biology"] as const;
const KINDS = ["single", "multiple", "integer", "numerical", "matrix"] as const;

const pageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["isAnswerKeyPage", "questions", "keyEntries"],
  properties: {
    isAnswerKeyPage: { type: "boolean" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "printedNumber",
          "subject",
          "kind",
          "passage",
          "body",
          "options",
          "printedAnswer",
          "hasFigure",
          "figureNote",
          "box",
        ],
        properties: {
          printedNumber: { type: "integer" },
          subject: { type: "string", enum: [...SUBJECTS] },
          kind: { type: "string", enum: [...KINDS] },
          passage: { type: ["string", "null"] },
          body: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          printedAnswer: { type: ["string", "null"] },
          hasFigure: { type: "boolean" },
          figureNote: { type: ["string", "null"] },
          box: { type: "array", items: { type: "integer" } },
        },
      },
    },
    keyEntries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "printedNumber", "answer"],
        properties: {
          subject: { type: ["string", "null"], enum: [...SUBJECTS, null] },
          printedNumber: { type: "integer" },
          answer: { type: "string" },
        },
      },
    },
  },
};

type PageOut = {
  isAnswerKeyPage: boolean;
  questions: {
    printedNumber: number;
    subject: (typeof SUBJECTS)[number];
    kind: (typeof KINDS)[number];
    passage: string | null;
    body: string;
    options: string[];
    printedAnswer: string | null;
    hasFigure: boolean;
    figureNote: string | null;
    box: number[];
  }[];
  keyEntries: { subject: string | null; printedNumber: number; answer: string }[];
};

const INSTRUCTIONS = `You transcribe Indian entrance-exam papers (JEE Main, JEE Advanced, NEET) exactly.
You get IMAGE 1 = the page to transcribe and, if present, IMAGE 2 = the next page (only to finish a question that is cut off at the bottom of image 1). Machine-extracted text of page 1 is given too; it can help with spelling but is often garbled — the image is the truth.

Rules:
- Transcribe ONLY the questions whose number STARTS on image 1, in English (skip Hindi text in bilingual papers). Finish a cut-off question from image 2.
- Copy wording, numbers, units and options exactly. Never solve, fix or shorten a question.
- Maths/physics: Markdown with LaTeX in $...$ (inline) or $$...$$ (display). Chemistry formulas and equations in LaTeX too, using \\ce{...} (mhchem) for formulas and reactions, e.g. $\\ce{H2SO4}$, $\\ce{A + B -> C}$.
- Tables and Match-the-column lists: Markdown tables inside "body" (List-I | List-II).
- "options": the option texts in order, WITHOUT their labels ((A)/(1) etc.). Empty array for integer / numerical questions.
- "kind": single = one correct option; multiple = "ONE OR MORE options correct"; integer = non-negative integer answer; numerical = decimal answer; matrix = match-the-following with options.
- "passage": for paragraph / comprehension questions, the full shared paragraph (repeat it for each question of the paragraph); otherwise null.
- "subject": from the section header (PART / SECTION / subject title) or, if not visible, from the content. Botany and zoology are "biology".
- "printedAnswer": only if the paper itself prints the answer for that question (e.g. "Answer: C", "Ans. (2)", a highlighted correct option in an answer-key paper). Write it as printed (option label or value). Otherwise null. Never work it out yourself.
- "hasFigure": true when the question needs a diagram, graph, circuit, structure drawing or image that is not fully expressible as text; describe it briefly in "figureNote" (else null).
- "box": [left, top, right, bottom] of the whole question (number, text, figure, options) on image 1, as integers 0–1000 relative to image 1's width and height. If it continues on image 2, use bottom = 1000.
- Skip instructions, marking schemes, blank pages and page furniture. Skip any printed solutions/explanations — never copy them.
- If image 1 is an answer-key table, set isAnswerKeyPage = true and list every entry in keyEntries (subject if the table shows it, question number, answer as printed). Otherwise keyEntries = [].`;

async function storePage(slug: string, png: string, n: number) {
  const webp = png.replace(/\.png$/, ".webp");
  const done = `${webp}.uploaded`;
  if (existsSync(done)) return;
  if (!existsSync(webp)) execFileSync("magick", [png, "-quality", "72", webp]);
  const path = `${slug}/${n}.webp`;
  const up = await admin.storage
    .from("exam-pages")
    .upload(path, readFileSync(webp), { contentType: "image/webp", upsert: true });
  if (up.error) throw up.error;
  writeFileSync(done, "");
}

async function extractPaper(spec: PaperSpec) {
  mkdirSync(`${ROOT}/pdf`, { recursive: true });
  let pdf = spec.file ?? `${ROOT}/pdf/${spec.slug}.pdf`;
  await download(spec.url, pdf);
  if (spec.pageRange) {
    const part = `${ROOT}/pdf/${spec.slug}-part.pdf`;
    if (!existsSync(part)) {
      const dir = `${ROOT}/split/${spec.slug}`;
      mkdirSync(dir, { recursive: true });
      const [from, to] = spec.pageRange;
      execFileSync("pdfseparate", ["-f", String(from), "-l", String(to), pdf, `${dir}/%04d.pdf`]);
      const parts = readdirSync(dir).filter((f) => f.endsWith(".pdf")).sort().map((f) => `${dir}/${f}`);
      execFileSync("pdfunite", [...parts, part]);
    }
    pdf = part;
  }

  const existing = await admin.from("exam_papers").select("id, status").eq("slug", spec.slug).maybeSingle();
  if (existing.data?.status && existing.data.status !== "new" && !REDO) {
    // Keep the label / answer source in step with papers.json without re-reading the paper.
    await admin
      .from("exam_papers")
      .update({ label: spec.label, answer_source: spec.answers, held_on: spec.heldOn ?? null })
      .eq("id", existing.data.id);
    console.log(`${spec.slug}: already ${existing.data.status}`);
    return;
  }

  const pages = renderPages(pdf, `${ROOT}/pages/${spec.slug}`);
  const paper = await admin
    .from("exam_papers")
    .upsert(
      {
        slug: spec.slug,
        exam: spec.exam,
        year: spec.year,
        label: spec.label,
        held_on: spec.heldOn ?? null,
        source_url: spec.url,
        key_url: spec.keyUrl ?? null,
        pages: pages.length,
        answer_source: spec.answers,
        status: "new",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (paper.error) throw paper.error;
  const paperId = paper.data.id;

  // Page by page (cached on disk so a restart never pays twice).
  const cacheDir = `${ROOT}/out/${spec.slug}`;
  mkdirSync(cacheDir, { recursive: true });
  const outs: (PageOut | null)[] = new Array(pages.length).fill(null);
  await pool(
    pages.map((_, i) => i),
    WORKERS,
    async (i) => {
      const cache = `${cacheDir}/${i + 1}.json`;
      await storePage(spec.slug, pages[i]!, i + 1);
      if (existsSync(cache)) {
        outs[i] = JSON.parse(readFileSync(cache, "utf8"));
        return;
      }
      const images = [readFileSync(pages[i]!)];
      if (pages[i + 1]) images.push(readFileSync(pages[i + 1]!));
      const out = await askJson<PageOut>({
        instructions: INSTRUCTIONS,
        text: `Paper: ${spec.label}. Page ${i + 1} of ${pages.length}.\n\nExtracted text of page ${i + 1}:\n${pageText(pdf, i + 1) || "(none — scanned page)"}`,
        images,
        schema: pageSchema,
        effort: "low",
      });
      writeFileSync(cache, JSON.stringify(out));
      outs[i] = out;
      console.log(`${spec.slug} p${i + 1}: ${out.questions.length} q, ${out.keyEntries.length} key`);
    },
  );
  if (outs.some((o) => !o)) throw new Error(`${spec.slug}: some pages failed`);

  // Optional separate answer key PDF.
  const keyEntries: PageOut["keyEntries"] = outs.flatMap((o) => o!.keyEntries);
  if (spec.keyUrl || spec.keyFile) {
    const keyPdf = spec.keyFile ?? `${ROOT}/pdf/${spec.slug}-key.pdf`;
    if (!spec.keyFile) await download(spec.keyUrl!, keyPdf);
    const keyPages = renderPages(keyPdf, `${ROOT}/pages/${spec.slug}-key`);
    for (let i = 0; i < keyPages.length; i++) {
      const cache = `${cacheDir}/key-${i + 1}.json`;
      let out: PageOut;
      if (existsSync(cache)) out = JSON.parse(readFileSync(cache, "utf8"));
      else {
        out = await askJson<PageOut>({
          instructions: INSTRUCTIONS,
          text: `This is the official ANSWER KEY of ${spec.label} (page ${i + 1}). Fill keyEntries.\n\nExtracted text:\n${pageText(keyPdf, i + 1)}`,
          images: [readFileSync(keyPages[i]!)],
          schema: pageSchema,
          effort: "low",
        });
        writeFileSync(cache, JSON.stringify(out));
      }
      keyEntries.push(...out.keyEntries);
    }
  }

  // Merge: one row per (subject order, printed number); a later duplicate only fills gaps.
  type Q = PageOut["questions"][number] & { page: number };
  const seq: Q[] = outs.flatMap((o, i) =>
    o!.questions.filter((q) => q.body.trim()).map((q) => ({ ...q, page: i + 1 })),
  );
  // JEE Advanced (2018 on) and per-subject PDFs restart numbering in every subject; other
  // papers number straight through. The numbers themselves tell which one this is.
  const maxNo = Math.max(0, ...seq.map((q) => q.printedNumber));
  const restarts = maxNo < 0.6 * new Set(seq.map((q) => `${q.subject}:${q.printedNumber}`)).size;
  // Reading order: page order for restarting papers, printed number otherwise.
  if (!restarts) seq.sort((a, b) => a.printedNumber - b.printedNumber || a.page - b.page);
  // Subjects are printed in blocks; the block decides a question's subject, not its wording.
  const fixed = segmentSubjects(seq.map((q) => q.subject));
  seq.forEach((q, i) => (q.subject = fixed[i]!));

  const subjectOrder: string[] = [];
  const merged = new Map<string, Q>();
  for (const q of seq) {
    if (!subjectOrder.includes(q.subject)) subjectOrder.push(q.subject);
    const k = restarts ? `${q.subject}:${q.printedNumber}` : String(q.printedNumber);
    const prev = merged.get(k);
    if (!prev || prev.body.length < q.body.length * 0.6) merged.set(k, q);
  }
  const keyFor = (q: Q) => {
    const hits = keyEntries.filter(
      (e) => e.printedNumber === q.printedNumber && (!restarts || !e.subject || e.subject === q.subject),
    );
    return hits.find((e) => e.subject === q.subject)?.answer ?? hits[0]?.answer ?? null;
  };
  // Papers that print their answers also print notes like "Due to printing inconsistency in
  // Q.29 … marks will be awarded to all candidates" — that question is a bonus.
  const bonus = new Set<number>();
  if (!restarts) {
    for (let i = 1; i <= pages.length; i++) {
      const text = pageText(pdf, i).replace(/\s+/g, " ");
      for (const m of text.matchAll(/Due to [^.]{0,80}?\bQ\.\s?(\d+)[^.]{0,200}?awarded to all candidates/gi)) {
        bonus.add(Number(m[1]));
      }
    }
  }

  const rows = [...merged.values()].map((q) => {
    const number = restarts
      ? (subjectOrder.indexOf(q.subject) + 1) * 100 + q.printedNumber
      : q.printedNumber;
    const raw = keyFor(q) ?? q.printedAnswer ?? (bonus.has(q.printedNumber) ? "BONUS" : null);
    return {
      paper_id: paperId,
      number,
      qno: String(q.printedNumber),
      subject: q.subject,
      kind: q.kind,
      passage: q.passage,
      body: q.body.trim(),
      options: q.options,
      answer: normalizeAnswer(raw, q.kind),
      page: q.page,
      has_figure: q.hasFigure,
      figure: {
        page: q.page,
        box: q.box.length === 4 ? q.box : [0, 0, 1000, 1000],
        note: q.figureNote,
      },
    };
  });

  await admin.from("exam_questions").delete().eq("paper_id", paperId);
  for (let i = 0; i < rows.length; i += 200) {
    const r = await admin.from("exam_questions").insert(rows.slice(i, i + 200));
    if (r.error) throw r.error;
  }
  const withAnswer = rows.filter((r) => r.answer).length;
  await admin
    .from("exam_papers")
    .update({ status: "extracted", question_count: rows.length })
    .eq("id", paperId);
  const bySubject = rows.reduce<Record<string, number>>((a, r) => ((a[r.subject] = (a[r.subject] ?? 0) + 1), a), {});
  console.log(`${spec.slug}: ${rows.length} questions ${JSON.stringify(bySubject)}, ${withAnswer} with official answer`);
}

async function main() {
  const todo = PAPERS.filter((p) => !ONLY || ONLY.includes(p.slug));
  for (const spec of todo) {
    try {
      await extractPaper(spec);
    } catch (error) {
      if (error instanceof StopRun) throw error;
      console.error(`${spec.slug} failed:`, (error as Error).message);
    }
  }
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
