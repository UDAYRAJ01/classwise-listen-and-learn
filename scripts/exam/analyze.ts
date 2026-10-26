/**
 * Turns extracted past-paper questions into the JEE / NEET chapter index.
 *
 *   bun scripts/exam/analyze.ts --stage=classify   # each question → NCERT Class 11/12 chapter (or "not in NCERT now")
 *   bun scripts/exam/analyze.ts --stage=concepts   # per chapter: exam concepts, each question → concept + NCERT location
 *   bun scripts/exam/analyze.ts --stage=index      # per chapter and exam group: explanation, memory hook, why / next, revision sheet
 *   options: --only=physics  --workers=4  --redo
 *
 * Every stage skips work already stored, so it can be re-run after new papers are added.
 * Frequencies are never asked from the model: they are counted from the stored questions.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { SyllabusBook } from "@/lib/types";

import { args, askJson, pool } from "./lib";

const STAGE = args.get("stage") ?? "classify";
const ONLY = args.get("only")?.split(",");
const WORKERS = Number(args.get("workers") ?? 4);
const REDO = args.has("redo");

type Subject = "physics" | "chemistry" | "maths" | "biology";
const SUBJECTS: Subject[] = ["physics", "chemistry", "maths", "biology"];
const GROUP_SUBJECTS: Record<"jee" | "neet", Subject[]> = {
  jee: ["physics", "chemistry", "maths"],
  neet: ["physics", "chemistry", "biology"],
};
const groupOf = (exam: string) => (exam === "neet" ? "neet" : "jee");

interface Chapter {
  key: string; // "11:b1-c3-motion-in-a-plane"
  grade: number;
  slug: string;
  title: string;
}

async function chaptersFor(subject: Subject): Promise<Chapter[]> {
  const out: Chapter[] = [];
  for (const grade of [11, 12]) {
    const r = await admin
      .from("syllabi")
      .select("books")
      .eq("board", "cbse")
      .eq("grade", grade)
      .eq("subject", subject)
      .maybeSingle();
    if (r.error) throw r.error;
    for (const book of (r.data?.books ?? []) as unknown as SyllabusBook[]) {
      for (const ch of book.chapters) {
        out.push({ key: `${grade}:${ch.slug}`, grade, slug: ch.slug, title: ch.title });
      }
    }
  }
  return out;
}

interface QRow {
  id: string;
  subject: Subject;
  kind: string;
  body: string;
  passage: string | null;
  options: Json;
  answer: string | null;
  has_figure: boolean;
  figure: Json;
  grade: number | null;
  chapter_slug: string | null;
  topic: string | null;
  concept_id: string | null;
  exam_papers: { exam: string; year: number; label: string };
}

async function loadQuestions(subject: Subject): Promise<QRow[]> {
  const rows: QRow[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await admin
      .from("exam_questions")
      .select(
        "id, subject, kind, body, passage, options, answer, has_figure, figure, grade, chapter_slug, topic, concept_id, exam_papers!inner(exam, year, label)",
      )
      .eq("subject", subject)
      .order("id")
      .range(from, from + 999);
    if (r.error) throw r.error;
    rows.push(...(r.data as unknown as QRow[]));
    if ((r.data?.length ?? 0) < 1000) break;
  }
  return rows;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function questionText(q: QRow, bodyChars = 700): string {
  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
  const fig = q.has_figure ? ` [figure: ${(q.figure as { note?: string } | null)?.note ?? "diagram"}]` : "";
  return [
    q.passage ? `Passage: ${clip(q.passage, 300)}` : "",
    clip(q.body, bodyChars) + fig,
    opts.length ? `Options: ${opts.map((o, i) => `(${"ABCD"[i]}) ${clip(o, 90)}`).join(" ")}` : "",
    q.answer ? `Answer: ${q.answer}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------- stage 1: chapter
const CLASSIFY_INSTRUCTIONS = `You map Indian entrance-exam questions (JEE Main, JEE Advanced, NEET) to the chapter of the CURRENT rationalised NCERT Class 11 / Class 12 textbooks (2023 onwards) where the question's main concept is taught.
Rules:
- Pick exactly one chapter key from the given list. Choose the chapter whose core idea the question tests (e.g. a projectile question is "Motion in a Plane" even if it uses energy).
- If the main concept is NOT taught in any listed chapter (topics removed from NCERT such as Solid State, Surface Chemistry, Polymers, s-/p-block of Class 11, Hydrogen, Environmental Chemistry, Semiconductor logic gates, Mathematical Reasoning, communication systems, etc.), answer "none".
- "topic": a short English topic name (3–6 words) for the question, e.g. "Projectile motion range", "Solid state – unit cell (removed)".`;

async function classify() {
  for (const subject of SUBJECTS) {
    if (ONLY && !ONLY.includes(subject)) continue;
    const chapters = await chaptersFor(subject);
    const keys = chapters.map((c) => c.key);
    const list = chapters.map((c) => `${c.key} — Class ${c.grade}: ${c.title}`).join("\n");
    const todo = (await loadQuestions(subject)).filter((q) => REDO || !q.topic);
    console.log(`${subject}: ${todo.length} questions to map`);
    const batches: QRow[][] = [];
    for (let i = 0; i < todo.length; i += 12) batches.push(todo.slice(i, i + 12));
    let done = 0;
    await pool(batches, WORKERS, async (batch) => {
      const out = await askJson<{ items: { n: number; chapter: string; topic: string }[] }>({
        instructions: CLASSIFY_INSTRUCTIONS,
        text: `Chapters (${subject}):\n${list}\n\nQuestions:\n${batch
          .map((q, i) => `#${i + 1} (${q.exam_papers.label})\n${questionText(q, 600)}`)
          .join("\n\n")}`,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["n", "chapter", "topic"],
                properties: {
                  n: { type: "integer" },
                  chapter: { type: "string", enum: [...keys, "none"] },
                  topic: { type: "string" },
                },
              },
            },
          },
        },
        effort: "low",
      });
      for (const item of out.items) {
        const q = batch[item.n - 1];
        if (!q) continue;
        const ch = chapters.find((c) => c.key === item.chapter);
        const up = await admin
          .from("exam_questions")
          .update({
            topic: item.topic.slice(0, 120),
            grade: ch?.grade ?? null,
            chapter_slug: ch?.slug ?? null,
            in_syllabus: Boolean(ch),
            concept_id: null,
          })
          .eq("id", q.id);
        if (up.error) throw up.error;
      }
      done += batch.length;
      console.log(`${subject}: mapped ${done}/${todo.length}`);
    });
  }
}

// ---------------------------------------------------------------- stage 2: concepts
interface Section {
  kind: string;
  ref: string;
  heading: string;
  page: number;
  printed_page: number | null;
}

async function sectionsFor(grade: number, subject: string, slug: string): Promise<Section[]> {
  const r = await admin
    .from("ncert_sections")
    .select("kind, ref, heading, page, printed_page")
    .eq("grade", grade)
    .eq("subject", subject)
    .eq("chapter_slug", slug)
    .order("page");
  if (r.error) throw r.error;
  return r.data;
}

const CONCEPT_INSTRUCTIONS = `You analyse all past JEE / NEET questions of ONE NCERT chapter and build its exam concept map.
1. "concepts": 4–14 exam concepts that together cover every question (merge near-duplicates; a concept is what a student must know to solve, e.g. "Range & max height of projectile", "Relative velocity – river crossing"). id = short kebab-case English, name = short English (≤ 6 words). For each concept give "ncert": the 1–3 location refs from the NCERT list where it is taught (format "section 3.6", "example 3.4", "exercise 3.12").
2. "questions": for EVERY question number: its concept id, "source" and "ref":
   - source "ncert-example" / "ncert-exercise" when the question is clearly modelled on that NCERT worked example / exercise question (same situation or same calculation with changed numbers) — ref = that row, e.g. "example 3.4";
   - source "ncert-text" when it tests a fact, formula or statement written in the chapter text — ref = the section where it is written, e.g. "section 3.6";
   - source "beyond-ncert" when it needs ideas beyond the NCERT text — ref = the closest section.
   Only use refs that appear in the NCERT list. Be strict: do not claim an example/exercise match unless it is really similar.`;

async function concepts() {
  for (const subject of SUBJECTS) {
    if (ONLY && !ONLY.includes(subject)) continue;
    const chapters = await chaptersFor(subject);
    const all = await loadQuestions(subject);
    const work = chapters
      .map((ch) => ({
        ch,
        qs: all.filter((q) => q.grade === ch.grade && q.chapter_slug === ch.slug),
      }))
      .filter((w) => w.qs.length > 0 && (REDO || w.qs.some((q) => !q.concept_id)));
    console.log(`${subject}: ${work.length} chapters need a concept map`);
    await pool(work, WORKERS, async ({ ch, qs }) => {
      const sections = await sectionsFor(ch.grade, subject, ch.slug);
      const refList = sections.map((s) => `${s.kind} ${s.ref}`);
      const ncert = sections
        .map((s) => `${s.kind} ${s.ref} — ${clip(s.heading, 80)} (page ${s.printed_page ?? `pdf ${s.page}`})`)
        .join("\n");
      const out = await askJson<{
        concepts: { id: string; name: string; ncert: string[] }[];
        questions: { n: number; concept: string; source: string; ref: string }[];
      }>({
        instructions: CONCEPT_INSTRUCTIONS,
        text: `Chapter: Class ${ch.grade} ${subject} — ${ch.title}\n\nNCERT locations:\n${ncert || "(none indexed)"}\n\nQuestions (${qs.length}):\n${qs
          .map((q, i) => `#${i + 1} (${q.exam_papers.label})\n${questionText(q, 450)}`)
          .join("\n\n")}`,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["concepts", "questions"],
          properties: {
            concepts: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "name", "ncert"],
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  ncert: { type: "array", items: { type: "string", ...(refList.length ? { enum: refList } : {}) } },
                },
              },
            },
            questions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["n", "concept", "source", "ref"],
                properties: {
                  n: { type: "integer" },
                  concept: { type: "string" },
                  source: { type: "string", enum: ["ncert-example", "ncert-exercise", "ncert-text", "beyond-ncert"] },
                  ref: { type: refList.length ? "string" : "string", ...(refList.length ? { enum: refList } : {}) },
                },
              },
            },
          },
        },
        effort: "medium",
      });
      const ids = new Set(out.concepts.map((c) => c.id));
      let mapped = 0;
      for (const a of out.questions) {
        const q = qs[a.n - 1];
        if (!q || !ids.has(a.concept)) continue;
        const [kind, ...rest] = a.ref.split(" ");
        let source = a.source;
        // The source label must agree with the kind of location it points at.
        if (source === "ncert-example" && kind !== "example") source = "ncert-text";
        if (source === "ncert-exercise" && kind !== "exercise") source = "ncert-text";
        const up = await admin
          .from("exam_questions")
          .update({
            concept_id: a.concept,
            concept: out.concepts.find((c) => c.id === a.concept)!.name,
            ncert_kind: refList.length ? kind : null,
            ncert_ref: refList.length ? rest.join(" ") : null,
            source_type: source as "ncert-example" | "ncert-exercise" | "ncert-text" | "beyond-ncert",
          })
          .eq("id", q.id);
        if (up.error) throw up.error;
        mapped++;
      }
      // Store the concept list for both exam groups that use this subject.
      for (const group of ["jee", "neet"] as const) {
        if (!GROUP_SUBJECTS[group].includes(subject)) continue;
        const prev = await admin
          .from("exam_chapters")
          .select("content")
          .eq("exam_group", group)
          .eq("grade", ch.grade)
          .eq("subject", subject)
          .eq("chapter_slug", ch.slug)
          .maybeSingle();
        const content = {
          ...((prev.data?.content as Record<string, unknown> | null) ?? {}),
          conceptMap: out.concepts,
          mappedAt: new Date().toISOString(),
        };
        const up = await admin.from("exam_chapters").upsert(
          {
            exam_group: group,
            grade: ch.grade,
            subject,
            chapter_slug: ch.slug,
            content: content as unknown as Json,
            question_count: qs.filter((q) => groupOf(q.exam_papers.exam) === group).length,
          },
          { onConflict: "exam_group,grade,subject,chapter_slug" },
        );
        if (up.error) throw up.error;
      }
      console.log(`${subject} ${ch.key}: ${out.concepts.length} concepts, ${mapped}/${qs.length} questions mapped`);
    });
  }
}

// ---------------------------------------------------------------- stage 3: index
const INDEX_INSTRUCTIONS = `You write the compact exam-revision index of ONE NCERT chapter for Indian students preparing for {EXAM}.
Language: simple Hinglish (Hindi in Roman script, technical terms in English), friendly and very short. Maths / physics / chemistry in LaTeX inside $...$ (chemistry with \\ce{}).
No filler, no motivational lines, no history. Every line must help solve exam questions.
For EVERY given concept (keep its id):
- "explain": the concept in 2–4 short lines, the easiest way to understand it.
- "key": the one formula / fact / rule to remember (LaTeX allowed), or null.
- "hook": a memory trick that makes it stick in one go (mnemonic, pattern, analogy, shortcut). Must be correct.
- "why": one line — why examiners keep asking it (what it checks).
- "next": 1–2 lines — how a new question on it can be framed next (a twist that keeps the idea), realistic for {EXAM}.
- "trap": the most common mistake students make on it.
Also:
- "revision": 6–12 one-line points (formulas / facts / rules) that revise the whole chapter for {EXAM} in one screen, most important first.
- "plan": one line on how to revise this chapter (what to do first, which concept to practise most), based on the counts.
Base everything on the concept names, the sample past questions and NCERT. Do not invent statistics.`;

async function index() {
  for (const group of ["jee", "neet"] as const) {
    if (ONLY && !ONLY.includes(group) && !ONLY.some((o) => GROUP_SUBJECTS[group].includes(o as Subject))) continue;
    for (const subject of GROUP_SUBJECTS[group]) {
      if (ONLY && SUBJECTS.some((s) => ONLY.includes(s)) && !ONLY.includes(subject)) continue;
      const chapters = await chaptersFor(subject);
      const all = (await loadQuestions(subject)).filter((q) => groupOf(q.exam_papers.exam) === group);
      const rows = await admin
        .from("exam_chapters")
        .select("grade, chapter_slug, content")
        .eq("exam_group", group)
        .eq("subject", subject);
      if (rows.error) throw rows.error;
      const work = rows.data.filter((r) => {
        const c = r.content as { conceptMap?: unknown; concepts?: unknown } | null;
        return c?.conceptMap && (REDO || !c.concepts) && all.some((q) => q.grade === r.grade && q.chapter_slug === r.chapter_slug);
      });
      console.log(`${group}/${subject}: ${work.length} chapter indexes to write`);
      await pool(work, WORKERS, async (row) => {
        const ch = chapters.find((c) => c.grade === row.grade && c.slug === row.chapter_slug)!;
        const content = row.content as { conceptMap: { id: string; name: string; ncert: string[] }[] };
        const qs = all.filter((q) => q.grade === row.grade && q.chapter_slug === row.chapter_slug);
        const exam = group === "jee" ? "JEE Main and JEE Advanced" : "NEET UG";
        const conceptText = content.conceptMap
          .map((c) => {
            const cq = qs.filter((q) => q.concept_id === c.id);
            const years = [...new Set(cq.map((q) => q.exam_papers.year))].sort();
            const samples = cq.slice(0, 4).map((q) => `  - (${q.exam_papers.label}) ${clip(q.body.replace(/\s+/g, " "), 260)}`);
            return `[${c.id}] ${c.name} — asked ${cq.length} times (${years.join(", ") || "not yet in " + group.toUpperCase()}); NCERT: ${c.ncert.join(", ")}\n${samples.join("\n")}`;
          })
          .join("\n\n");
        const out = await askJson<{
          concepts: { id: string; explain: string; key: string | null; hook: string; why: string; next: string; trap: string }[];
          revision: string[];
          plan: string;
        }>({
          instructions: INDEX_INSTRUCTIONS.replaceAll("{EXAM}", exam),
          text: `Chapter: Class ${ch.grade} ${subject} — ${ch.title}\nPast ${exam} questions in this chapter: ${qs.length}\n\nConcepts:\n${conceptText}`,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["concepts", "revision", "plan"],
            properties: {
              concepts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "explain", "key", "hook", "why", "next", "trap"],
                  properties: {
                    id: { type: "string", enum: content.conceptMap.map((c) => c.id) },
                    explain: { type: "string" },
                    key: { type: ["string", "null"] },
                    hook: { type: "string" },
                    why: { type: "string" },
                    next: { type: "string" },
                    trap: { type: "string" },
                  },
                },
              },
              revision: { type: "array", items: { type: "string" } },
              plan: { type: "string" },
            },
          },
          effort: "medium",
        });
        const concepts = content.conceptMap.map((c) => ({
          ...c,
          ...(out.concepts.find((x) => x.id === c.id) ?? {}),
        }));
        const up = await admin
          .from("exam_chapters")
          .update({
            content: { ...content, concepts, revision: out.revision.slice(0, 12), plan: out.plan, writtenAt: new Date().toISOString() } as unknown as Json,
            question_count: qs.length,
          })
          .eq("exam_group", group)
          .eq("grade", row.grade)
          .eq("subject", subject)
          .eq("chapter_slug", row.chapter_slug);
        if (up.error) throw up.error;
        console.log(`${group}/${subject} ${ch.key}: index written (${concepts.length} concepts)`);
      });
    }
  }
}

const stages: Record<string, () => Promise<void>> = { classify, concepts, index };
const run = stages[STAGE];
if (!run) {
  console.error(`unknown stage ${STAGE}`);
  process.exit(1);
}
void run().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
