/**
 * Turns extracted past-paper questions into the JEE / NEET chapter index.
 *
 *   bun scripts/exam/analyze.ts --stage=classify   # each question → NCERT Class 11/12 chapter (or "not in NCERT now")
 *   bun scripts/exam/analyze.ts --stage=home       # removed-from-NCERT topics → the current chapter of their unit (listed apart)
 *   bun scripts/exam/analyze.ts --stage=units      # the rest → the dropped NCERT unit (p-Block, Solid State…)
 *   bun scripts/exam/analyze.ts --stage=concepts   # per chapter: exam concepts, each question → concept + NCERT location
 *   bun scripts/exam/analyze.ts --stage=index      # per chapter and exam group: explanation, memory hook, why / next, revision sheet
 *   options: --only=physics  --workers=4  --redo
 *
 * Every stage skips work already stored, so it can be re-run after new papers are added.
 * Frequencies are never asked from the model: they are counted from the stored questions.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { OLD_UNITS } from "@/lib/exam";
import type { SyllabusBook } from "@/lib/types";

import { args, askJson, pool } from "./lib";
import { ncertSnippet } from "./ncert-snippet";

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
  in_syllabus: boolean;
  old_unit: string | null;
  concept_id: string | null;
  exam_papers: { exam: string; year: number; label: string };
}

async function loadQuestions(subject: Subject): Promise<QRow[]> {
  const rows: QRow[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await admin
      .from("exam_questions")
      .select(
        "id, subject, kind, body, passage, options, answer, has_figure, figure, grade, chapter_slug, topic, in_syllabus, old_unit, concept_id, exam_papers!inner(exam, year, label)",
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
    // Main section headings tell the model what the current (shortened) books still teach.
    const heads = await admin
      .from("ncert_sections")
      .select("grade, chapter_slug, ref, heading")
      .eq("subject", subject)
      .eq("kind", "section");
    if (heads.error) throw heads.error;
    const list = chapters
      .map((c) => {
        const h = heads.data
          .filter((x) => x.grade === c.grade && x.chapter_slug === c.slug && x.ref.split(".").length === 2)
          .sort((a, b) => Number(a.ref.split(".")[1]) - Number(b.ref.split(".")[1]))
          .map((x) => clip(x.heading, 45));
        return `${c.key} — Class ${c.grade}: ${c.title}${h.length ? ` [${h.join("; ")}]` : ""}`;
      })
      .join("\n");
    // --exam=jee-advanced,neet limits mapping to some exams (e.g. while other papers are still being read).
    const exams = args.get("exam")?.split(",");
    const todo = (await loadQuestions(subject)).filter(
      (q) => (REDO || !q.topic) && (!exams || exams.includes(q.exam_papers.exam)),
    );
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

// ---------------------------------------------------------------- stage 1b: home chapter
const HOME_INSTRUCTIONS = `These past JEE / NEET questions test topics that are NOT in the current rationalised NCERT Class 11–12 books (removed in 2023). For each, pick the current chapter of the same unit where a student would revise it (e.g. arithmetic progression → Sequences and Series; logic gates → Semiconductor Electronics; sound Doppler effect → Waves; error propagation → Units and Measurement).
Answer "none" when the whole chapter / unit is gone and no current chapter is its natural home (e.g. Solid State, Surface Chemistry, Polymers, Chemistry in Everyday Life, Hydrogen, s-Block, Environmental Chemistry, Communication Systems, Mathematical Reasoning).`;

/** Questions on removed topics get the current chapter of their unit, still marked not-in-syllabus. */
async function home() {
  for (const subject of SUBJECTS) {
    if (ONLY && !ONLY.includes(subject)) continue;
    const chapters = await chaptersFor(subject);
    const keys = chapters.map((c) => c.key);
    const list = chapters.map((c) => `${c.key} — Class ${c.grade}: ${c.title}`).join("\n");
    const todo = (await loadQuestions(subject)).filter((q) => q.topic && !q.in_syllabus && (REDO || !q.chapter_slug));
    console.log(`${subject}: ${todo.length} removed-topic questions to place`);
    const batches: QRow[][] = [];
    for (let i = 0; i < todo.length; i += 15) batches.push(todo.slice(i, i + 15));
    let placed = 0;
    await pool(batches, WORKERS, async (batch) => {
      const out = await askJson<{ items: { n: number; chapter: string }[] }>({
        instructions: HOME_INSTRUCTIONS,
        text: `Chapters (${subject}):\n${list}\n\nQuestions:\n${batch
          .map((q, i) => `#${i + 1} (topic: ${q.topic})\n${questionText(q, 300)}`)
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
                required: ["n", "chapter"],
                properties: { n: { type: "integer" }, chapter: { type: "string", enum: [...keys, "none"] } },
              },
            },
          },
        },
        effort: "low",
      });
      for (const item of out.items) {
        const q = batch[item.n - 1];
        const ch = chapters.find((c) => c.key === item.chapter);
        if (!q || !ch) continue;
        const up = await admin
          .from("exam_questions")
          .update({ grade: ch.grade, chapter_slug: ch.slug, in_syllabus: false, concept_id: null })
          .eq("id", q.id);
        if (up.error) throw up.error;
        placed++;
      }
    });
    console.log(`${subject}: ${placed}/${todo.length} placed in a current chapter`);
  }
}

// ---------------------------------------------------------------- stage 1c: dropped units
/** Removed-topic questions with no current chapter are grouped under the NCERT unit that was dropped. */
async function units() {
  for (const subject of SUBJECTS) {
    if (ONLY && !ONLY.includes(subject)) continue;
    const names = OLD_UNITS[subject];
    const ids = Object.keys(names);
    const todo = (await loadQuestions(subject)).filter(
      (q) => q.topic && !q.in_syllabus && !q.chapter_slug && (REDO || !q.old_unit),
    );
    console.log(`${subject}: ${todo.length} questions to group by dropped unit`);
    const batches: QRow[][] = [];
    for (let i = 0; i < todo.length; i += 20) batches.push(todo.slice(i, i + 20));
    await pool(batches, WORKERS, async (batch) => {
      const out = await askJson<{ items: { n: number; unit: string }[] }>({
        instructions: `Each past JEE / NEET question below is on a topic that the current NCERT Class 11–12 ${subject} books dropped. Pick the old NCERT unit it belongs to; "other" when none fits.`,
        text: `Units:\n${ids.map((id) => `${id} — ${names[id]}`).join("\n")}\n\nQuestions:\n${batch
          .map((q, i) => `#${i + 1} (topic: ${q.topic})\n${questionText(q, 250)}`)
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
                required: ["n", "unit"],
                properties: { n: { type: "integer" }, unit: { type: "string", enum: ids } },
              },
            },
          },
        },
        effort: "low",
      });
      for (const item of out.items) {
        const q = batch[item.n - 1];
        if (!q || !ids.includes(item.unit)) continue;
        const up = await admin.from("exam_questions").update({ old_unit: item.unit }).eq("id", q.id);
        if (up.error) throw up.error;
      }
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

async function chapterText(grade: number, subject: string, slug: string): Promise<string> {
  const r = await admin
    .from("chapter_sources")
    .select("body")
    .eq("board", "cbse")
    .eq("grade", grade)
    .eq("subject", subject)
    .eq("chapter_slug", slug)
    .maybeSingle();
  if (r.error) throw r.error;
  return r.data?.body ?? "";
}

const CONCEPT_INSTRUCTIONS = `You analyse all past JEE / NEET questions of ONE NCERT chapter and build its exam concept map.
1. "concepts": 4–14 exam concepts that together cover every question (merge near-duplicates; a concept is what a student must know to solve, e.g. "Range & max height of projectile", "Relative velocity – river crossing"). id = short kebab-case English, name = short English (≤ 6 words). For each concept give "ncert": the 1–3 location refs from the NCERT list where it is taught (format "section 3.6", "example 3.4", "exercise 3.12").
2. "questions": for EVERY question number: its concept id, "source" and "ref":
   - source "ncert-example" / "ncert-exercise" when the question is clearly modelled on that NCERT worked example / exercise question (same situation or same calculation with changed numbers) — ref = that row, e.g. "example 3.4";
   - source "ncert-text" when it tests a fact, formula or statement written in the chapter text — ref = the section where it is written, e.g. "section 3.6";
   - source "beyond-ncert" when it needs ideas beyond the NCERT text — ref = the closest section.
   Only use refs that appear in the NCERT list. Be strict: do not claim an example/exercise match unless it is really similar.`;

const ASSIGN_INSTRUCTIONS = `Assign each past exam question to exactly one of the given concepts of this NCERT chapter (the one a student must know to solve it), and give the NCERT section where that idea is written (a ref from the list, e.g. "section 3.6").`;

const MATCH_INSTRUCTIONS = `For each pair, decide whether the past exam question is really modelled on the NCERT worked example / exercise question shown: the same situation or the same calculation (numbers may change). Merely using the same topic or formula is NOT enough. Answer same = true only when a teacher would say "yeh NCERT ke us example / exercise jaisa hi hai".`;

type Assignment = { q: QRow; concept: string; source: string; kind: string | null; ref: string | null };

async function concepts() {
  for (const subject of SUBJECTS) {
    if (ONLY && !ONLY.includes(subject)) continue;
    const chapters = await chaptersFor(subject);
    const all = await loadQuestions(subject);
    const work = chapters
      .map((ch) => ({
        ch,
        // Topics removed from NCERT have a home chapter for listing but are not part of its concept map.
        qs: all.filter((q) => q.in_syllabus && q.grade === ch.grade && q.chapter_slug === ch.slug),
      }))
      .filter((w) => w.qs.length > 0 && (REDO || w.qs.some((q) => !q.concept_id)));
    console.log(`${subject}: ${work.length} chapters need a concept map`);
    await pool(work, WORKERS, async ({ ch, qs }) => {
      const [sections, body] = await Promise.all([
        sectionsFor(ch.grade, subject, ch.slug),
        chapterText(ch.grade, subject, ch.slug),
      ]);
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
                  ncert: { type: "array", items: { type: "string" } },
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
                  ref: { type: "string" },
                },
              },
            },
          },
        },
        effort: "medium",
      });
      // Refs are checked against the index here (a schema enum would be too large for big chapters).
      const norm = (r: string) => r.trim().replace(/\s+/g, " ").toLowerCase();
      const byNorm = new Map(refList.map((r) => [norm(r), r]));
      const fixRef = (r: string) => byNorm.get(norm(r)) ?? null;
      const concepts = out.concepts
        .filter((c, i, arr) => c.id && arr.findIndex((x) => x.id === c.id) === i)
        .map((c) => ({ ...c, ncert: c.ncert.map(fixRef).filter((r): r is string => Boolean(r)) }));
      const ids = new Set(concepts.map((c) => c.id));
      const sectionOf = (id: string) => {
        const c = concepts.find((x) => x.id === id);
        return c?.ncert.find((r) => r.startsWith("section ")) ?? c?.ncert[0] ?? null;
      };

      const assigned = new Map<string, Assignment>();
      out.questions.forEach((a) => {
        const q = qs[a.n - 1];
        if (!q || !ids.has(a.concept) || assigned.has(q.id)) return;
        const ref = fixRef(a.ref) ?? sectionOf(a.concept);
        assigned.set(q.id, { q, concept: a.concept, source: a.source, kind: null, ref });
      });

      // Questions the model skipped: a short second pass with the concept list fixed.
      const missed = qs.filter((q) => !assigned.has(q.id));
      if (missed.length && concepts.length) {
        const extra = await askJson<{ items: { n: number; concept: string; ref: string }[] }>({
          instructions: ASSIGN_INSTRUCTIONS,
          text: `Chapter: Class ${ch.grade} ${subject} — ${ch.title}\n\nConcepts:\n${concepts
            .map((c) => `${c.id} — ${c.name}`)
            .join("\n")}\n\nNCERT sections:\n${refList.filter((r) => r.startsWith("section ")).join(", ")}\n\nQuestions:\n${missed
            .map((q, i) => `#${i + 1}\n${questionText(q, 450)}`)
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
                  required: ["n", "concept", "ref"],
                  properties: {
                    n: { type: "integer" },
                    concept: { type: "string", enum: [...ids] },
                    ref: { type: "string" },
                  },
                },
              },
            },
          },
          effort: "low",
        });
        for (const a of extra.items) {
          const q = missed[a.n - 1];
          if (!q || !ids.has(a.concept) || assigned.has(q.id)) continue;
          assigned.set(q.id, { q, concept: a.concept, source: "ncert-text", kind: null, ref: fixRef(a.ref) ?? sectionOf(a.concept) });
        }
      }

      // The source label must agree with the kind of place it points at.
      for (const a of assigned.values()) {
        a.kind = a.ref ? a.ref.split(" ")[0]! : null;
        if (!a.ref) a.source = a.source === "beyond-ncert" ? a.source : "ncert-text";
        if (a.source === "ncert-example" && a.kind !== "example") a.source = "ncert-text";
        if (a.source === "ncert-exercise" && a.kind !== "exercise") a.source = "ncert-text";
      }

      // Every "modelled on NCERT Example / Exercise" claim is checked against the printed book text.
      const claims = [...assigned.values()].filter((a) => a.source === "ncert-example" || a.source === "ncert-exercise");
      const withText = claims.map((a) => ({ a, text: ncertSnippet(body, a.kind!, a.ref!.split(" ").slice(1).join(" ")) }));
      const demote = (a: Assignment) => {
        a.source = "ncert-text";
        a.ref = sectionOf(a.concept);
        a.kind = a.ref ? a.ref.split(" ")[0]! : null;
      };
      for (const c of withText) if (!c.text) demote(c.a);
      const checkable = withText.filter((c) => c.text);
      for (let i = 0; i < checkable.length; i += 10) {
        const batch = checkable.slice(i, i + 10);
        const verdict = await askJson<{ items: { n: number; same: boolean }[] }>({
          instructions: MATCH_INSTRUCTIONS,
          text: batch
            .map(
              (c, k) =>
                `#${k + 1}\nPAST QUESTION:\n${questionText(c.a.q, 700)}\n\nNCERT ${c.a.ref}:\n${c.text}`,
            )
            .join("\n\n-----\n\n"),
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
                  required: ["n", "same"],
                  properties: { n: { type: "integer" }, same: { type: "boolean" } },
                },
              },
            },
          },
          effort: "medium",
        });
        batch.forEach((c, k) => {
          if (!verdict.items.find((v) => v.n === k + 1)?.same) demote(c.a);
        });
      }
      const kept = [...assigned.values()].filter((a) => a.source === "ncert-example" || a.source === "ncert-exercise").length;

      for (const a of assigned.values()) {
        const concept = concepts.find((c) => c.id === a.concept)!;
        const up = await admin
          .from("exam_questions")
          .update({
            concept_id: a.concept,
            concept: concept.name,
            ncert_kind: a.kind,
            ncert_ref: a.ref ? a.ref.split(" ").slice(1).join(" ") : null,
            source_type: a.source as "ncert-example" | "ncert-exercise" | "ncert-text" | "beyond-ncert",
          })
          .eq("id", a.q.id);
        if (up.error) throw up.error;
      }
      // One concept list per chapter, shared by both exam groups that use this subject. A new
      // map drops the old written index, whose concept ids no longer match.
      for (const group of ["jee", "neet"] as const) {
        if (!GROUP_SUBJECTS[group].includes(subject)) continue;
        const up = await admin.from("exam_chapters").upsert(
          {
            exam_group: group,
            grade: ch.grade,
            subject,
            chapter_slug: ch.slug,
            content: { conceptMap: concepts, mappedAt: new Date().toISOString() } as unknown as Json,
            question_count: qs.filter((q) => groupOf(q.exam_papers.exam) === group).length,
          },
          { onConflict: "exam_group,grade,subject,chapter_slug" },
        );
        if (up.error) throw up.error;
      }
      console.log(
        `${subject} ${ch.key}: ${concepts.length} concepts, ${assigned.size}/${qs.length} questions mapped, ${kept}/${claims.length} NCERT example/exercise matches confirmed`,
      );
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

const REVIEW_INSTRUCTIONS = `You are a strict subject expert checking a student revision index for {EXAM} before it is published. The NCERT chapter text is the reference.
Check EVERY line: formulas (signs, factors, units, conditions), facts, definitions, examples, mnemonics (each letter must map to the right item, in the right order), shortcuts (must always give the right answer in the stated case), and the "next" question ideas (must be solvable and within the syllabus).
Fix every error, ambiguity or unsupported claim in place, keeping the same short Hinglish style and the same ids. Remove anything that cannot be made correct. Keep correct lines unchanged.
Return the full corrected index plus "fixes": one short English line per change (empty if nothing was wrong).`;

const indexSchema = (ids: string[], withFixes: boolean) => ({
  type: "object",
  additionalProperties: false,
  required: ["concepts", "revision", "plan", ...(withFixes ? ["fixes"] : [])],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "explain", "key", "hook", "why", "next", "trap"],
        properties: {
          id: { type: "string", enum: ids },
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
    ...(withFixes ? { fixes: { type: "array", items: { type: "string" } } } : {}),
  },
});

type Written = {
  concepts: { id: string; explain: string; key: string | null; hook: string; why: string; next: string; trap: string }[];
  revision: string[];
  plan: string;
};

async function index() {
  // --group=jee|neet writes one exam group only (so the two can run side by side).
  const onlyGroup = args.get("group");
  for (const group of ["jee", "neet"] as const) {
    if (onlyGroup && onlyGroup !== group) continue;
    if (ONLY && !ONLY.includes(group) && !ONLY.some((o) => GROUP_SUBJECTS[group].includes(o as Subject))) continue;
    for (const subject of GROUP_SUBJECTS[group]) {
      if (ONLY && SUBJECTS.some((s) => ONLY.includes(s)) && !ONLY.includes(subject)) continue;
      const chapters = await chaptersFor(subject);
      const all = (await loadQuestions(subject)).filter((q) => q.in_syllabus && groupOf(q.exam_papers.exam) === group);
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
        // Another run may have written it since this list was loaded.
        if (!REDO) {
          const now = await admin
            .from("exam_chapters")
            .select("content")
            .eq("exam_group", group)
            .eq("grade", row.grade)
            .eq("subject", subject)
            .eq("chapter_slug", row.chapter_slug)
            .single();
          if ((now.data?.content as { concepts?: unknown } | null)?.concepts) return;
        }
        const content = row.content as { conceptMap: { id: string; name: string; ncert: string[] }[]; mappedAt?: string };
        const qs = all.filter((q) => q.grade === row.grade && q.chapter_slug === row.chapter_slug);
        const exam = group === "jee" ? "JEE Main and JEE Advanced" : "NEET UG";
        // Concepts this exam never asked are left out of its index.
        const used = content.conceptMap.filter((c) => qs.some((q) => q.concept_id === c.id));
        if (!used.length) return;
        const ids = used.map((c) => c.id);
        const conceptText = used
          .map((c) => {
            const cq = qs.filter((q) => q.concept_id === c.id);
            const years = [...new Set(cq.map((q) => q.exam_papers.year))].sort();
            const samples = cq.slice(0, 4).map((q) => `  - (${q.exam_papers.label}) ${clip(q.body.replace(/\s+/g, " "), 260)}`);
            return `[${c.id}] ${c.name} — asked ${cq.length} times (${years.join(", ")}); NCERT: ${c.ncert.join(", ")}\n${samples.join("\n")}`;
          })
          .join("\n\n");
        const draft = await askJson<Written>({
          instructions: INDEX_INSTRUCTIONS.replaceAll("{EXAM}", exam),
          text: `Chapter: Class ${ch.grade} ${subject} — ${ch.title}\nPast ${exam} questions in this chapter: ${qs.length}\n\nConcepts:\n${conceptText}`,
          schema: indexSchema(ids, false),
          effort: "medium",
        });
        // Second pass: an expert check against the NCERT chapter before anything is shown.
        const book = await chapterText(ch.grade, subject, ch.slug);
        const reviewed = await askJson<Written & { fixes: string[] }>({
          instructions: REVIEW_INSTRUCTIONS.replaceAll("{EXAM}", exam),
          text: `Chapter: Class ${ch.grade} ${subject} — ${ch.title}\n\nConcepts:\n${used
            .map((c) => `[${c.id}] ${c.name}`)
            .join("\n")}\n\nINDEX TO CHECK (JSON):\n${JSON.stringify(draft)}\n\nNCERT CHAPTER TEXT:\n${clip(book, 60000) || "(not stored — check from subject knowledge)"}`,
          schema: indexSchema(ids, true),
          effort: "high",
        });
        // Only reviewed text is published: a concept the reviewer dropped keeps its name and
        // NCERT places but no written lines (never the unchecked draft).
        const concepts = used.map((c) => ({ ...c, ...(reviewed.concepts.find((x) => x.id === c.id) ?? {}) }));
        const up = await admin
          .from("exam_chapters")
          .update({
            content: {
              ...content,
              concepts,
              revision: reviewed.revision.slice(0, 12),
              plan: reviewed.plan,
              reviewFixes: reviewed.fixes,
              writtenAt: new Date().toISOString(),
            } as unknown as Json,
            question_count: qs.length,
          })
          .eq("exam_group", group)
          .eq("grade", row.grade)
          .eq("subject", subject)
          .eq("chapter_slug", row.chapter_slug);
        if (up.error) throw up.error;
        console.log(`${group}/${subject} ${ch.key}: index written (${concepts.length} concepts, ${reviewed.fixes.length} fixes in review)`);
      });
    }
  }
}

const stages: Record<string, () => Promise<void>> = { classify, home, units, concepts, index };
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
