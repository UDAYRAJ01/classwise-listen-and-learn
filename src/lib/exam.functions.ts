import { createServerFn } from "@tanstack/react-start";

import {
  EXAM_GROUPS,
  isExamGroup,
  isExamSubject,
  isOldUnit,
  OLD_UNITS,
  parseChapterParam,
  placeKey,
  type ExamChapterView,
  type ExamConcept,
  type ExamGroup,
  type ExamName,
  type ExamOldUnitView,
  type ExamOverview,
  type ExamQuestionView,
  type ExamSolution,
  type ExamSubject,
  type NcertPlace,
} from "@/lib/exam";
import type { SyllabusBook } from "@/lib/types";

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

type Sb = Awaited<ReturnType<typeof publicClient>>;

const QUESTION_COLUMNS =
  "id, qno, kind, passage, body, options, answer, page, has_figure, figure, concept_id, source_type, ncert_kind, ncert_ref, solution, solution_ok, in_syllabus, topic, exam_papers!inner(exam, year, label, slug, answer_source)";

interface QuestionRow {
  id: string;
  qno: string | null;
  kind: string;
  passage: string | null;
  body: string;
  options: unknown;
  answer: string | null;
  page: number | null;
  has_figure: boolean;
  figure: unknown;
  concept_id: string | null;
  source_type: string | null;
  ncert_kind: string | null;
  ncert_ref: string | null;
  solution: unknown;
  solution_ok: boolean;
  in_syllabus: boolean;
  topic: string | null;
  exam_papers: unknown;
}

/** A stored question as students see it (a solution that failed its check is never sent). */
function questionView(q: QuestionRow, places: Map<string, NcertPlace>): ExamQuestionView & { inSyllabus: boolean; topic: string } {
  const paper = q.exam_papers as { exam: string; year: number; label: string; slug: string; answer_source: string };
  const fig = q.figure as { box?: number[] } | null;
  const sol = q.solution as Omit<ExamSolution, "ok"> | null;
  return {
    id: q.id,
    exam: paper.exam as ExamName,
    year: paper.year,
    paper: paper.label,
    paperSlug: paper.slug,
    answerSource: paper.answer_source as ExamQuestionView["answerSource"],
    qno: q.qno,
    kind: q.kind,
    passage: q.passage,
    body: q.body,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    answer: q.answer,
    page: q.page,
    hasFigure: q.has_figure,
    figureBox: fig?.box?.length === 4 ? (fig.box as [number, number, number, number]) : null,
    conceptId: q.concept_id,
    source: q.source_type as ExamQuestionView["source"],
    ncert: q.ncert_kind && q.ncert_ref ? (places.get(placeKey(q.ncert_kind, q.ncert_ref)) ?? null) : null,
    solution: sol && q.solution_ok ? { ...sol, ok: true } : null,
    inSyllabus: q.in_syllabus,
    topic: (q.topic ?? "").replace(/\s*\(removed\)\s*$/i, ""),
  };
}

/** Newest first: the latest pattern matters most. */
const newestFirst = (a: ExamQuestionView, b: ExamQuestionView) =>
  b.year - a.year || a.paper.localeCompare(b.paper) || Number(a.qno) - Number(b.qno);

/** Chapter titles of the CBSE (NCERT) Class 11 and 12 books of one subject. */
async function chapterTitles(sb: Sb, subject: ExamSubject) {
  const { data, error } = await sb
    .from("syllabi")
    .select("grade, books")
    .eq("board", "cbse")
    .in("grade", [11, 12])
    .eq("subject", subject);
  if (error) throw new Error("Could not load chapters");
  const out = new Map<string, { title: string; order: number }>();
  for (const row of data ?? []) {
    let order = 0;
    for (const book of (row.books ?? []) as unknown as SyllabusBook[]) {
      for (const ch of book.chapters) out.set(`${row.grade}:${ch.slug}`, { title: ch.title, order: order++ });
    }
  }
  return out;
}

export const fetchExamOverview = createServerFn({ method: "GET" })
  .validator((input: unknown): { group: ExamGroup } => {
    const g = (input as { group?: unknown })?.group;
    if (!isExamGroup(g)) throw new Error("Invalid input");
    return { group: g };
  })
  .handler(async ({ data }): Promise<ExamOverview> => {
    const sb = await publicClient();
    const meta = EXAM_GROUPS[data.group];
    const [stats, concepts, subjects, papers, indexes, oldUnits] = await Promise.all([
      sb.from("exam_chapter_stats").select("*").eq("exam_group", data.group),
      sb.from("exam_concept_stats").select("*").eq("exam_group", data.group),
      sb.from("exam_subject_stats").select("*").eq("exam_group", data.group),
      sb.from("exam_coverage").select("*").eq("exam_group", data.group).order("year", { ascending: false }),
      sb.from("exam_chapters").select("grade, subject, chapter_slug, content").eq("exam_group", data.group),
      sb.from("exam_old_unit_stats").select("*").eq("exam_group", data.group),
    ]);
    for (const r of [stats, concepts, subjects, papers, indexes, oldUnits]) {
      if (r.error) throw new Error("Could not load the exam index");
    }
    const written = new Set(
      (indexes.data ?? [])
        .filter((r) => (r.content as { concepts?: unknown } | null)?.concepts)
        .map((r) => `${r.subject}:${r.grade}:${r.chapter_slug}`),
    );
    const titles = new Map<ExamSubject, Map<string, { title: string; order: number }>>();
    for (const s of meta.subjects) titles.set(s, await chapterTitles(sb, s));

    const out: ExamOverview = {
      group: data.group,
      subjects: meta.subjects.map((subject) => {
        const t = titles.get(subject)!;
        const rows = (stats.data ?? []).filter((r) => r.subject === subject);
        const chapters = rows
          .map((r) => {
            const top = (concepts.data ?? [])
              .filter((c) => c.subject === subject && c.grade === r.grade && c.chapter_slug === r.chapter_slug)
              .sort((a, b) => (b.questions ?? 0) - (a.questions ?? 0))[0];
            return {
              grade: r.grade ?? 0,
              slug: r.chapter_slug ?? "",
              title: t.get(`${r.grade}:${r.chapter_slug}`)?.title ?? r.chapter_slug ?? "",
              questions: r.questions ?? 0,
              main: r.main_count ?? 0,
              advanced: r.advanced_count ?? 0,
              neet: r.neet_count ?? 0,
              years: (r.years ?? []) as number[],
              topConcept: top?.concept ?? null,
              hasIndex: written.has(`${subject}:${r.grade}:${r.chapter_slug}`),
            };
          })
          .filter((c) => t.has(`${c.grade}:${c.slug}`))
          .sort((a, b) => b.questions - a.questions || a.grade - b.grade);
        const s = (subjects.data ?? []).find((x) => x.subject === subject);
        return {
          subject,
          total: chapters.reduce((n, c) => n + c.questions, 0),
          chapters,
          outOfSyllabus: s?.out_of_syllabus ?? 0,
          oldUnits: (oldUnits.data ?? [])
            .filter((u) => u.subject === subject && isOldUnit(subject, u.old_unit))
            .map((u) => ({
              unit: u.old_unit!,
              name: OLD_UNITS[subject][u.old_unit!]!,
              questions: u.questions ?? 0,
              years: (u.years ?? []) as number[],
            }))
            // "Baaki" (stray topics) last, the rest by how often they were asked.
            .sort((a, b) => Number(a.unit === "other") - Number(b.unit === "other") || b.questions - a.questions),
        };
      }),
      papers: (papers.data ?? []).map((p) => ({
        exam: p.exam as ExamName,
        slug: p.slug ?? "",
        label: p.label ?? "",
        year: p.year ?? 0,
        answerSource: (p.answer_source ?? "none") as "official" | "coaching" | "none",
        questions: p.question_count ?? 0,
        sourceUrl: p.source_url ?? "",
      })),
      totalQuestions: 0,
    };
    out.totalQuestions = out.subjects.reduce((n, s) => n + s.total, 0);
    return out;
  });

type ChapterInput = { group: ExamGroup; subject: ExamSubject; chapter: string };

export const fetchExamChapter = createServerFn({ method: "GET" })
  .validator((input: unknown): ChapterInput => {
    const i = input as Partial<ChapterInput>;
    if (!isExamGroup(i?.group) || !isExamSubject(i?.subject) || typeof i?.chapter !== "string")
      throw new Error("Invalid input");
    if (!EXAM_GROUPS[i.group].subjects.includes(i.subject)) throw new Error("Invalid input");
    if (!parseChapterParam(i.chapter)) throw new Error("Invalid input");
    return { group: i.group, subject: i.subject, chapter: i.chapter };
  })
  .handler(async ({ data }): Promise<ExamChapterView | null> => {
    const { grade, slug } = parseChapterParam(data.chapter)!;
    const sb = await publicClient();
    const titles = await chapterTitles(sb, data.subject);
    const title = titles.get(`${grade}:${slug}`)?.title;
    if (!title) return null;

    const exams = EXAM_GROUPS[data.group].exams;
    const [row, qs, secs] = await Promise.all([
      sb
        .from("exam_chapters")
        .select("content")
        .eq("exam_group", data.group)
        .eq("grade", grade)
        .eq("subject", data.subject)
        .eq("chapter_slug", slug)
        .maybeSingle(),
      sb
        .from("exam_questions")
        .select(QUESTION_COLUMNS)
        .eq("subject", data.subject)
        .eq("grade", grade)
        .eq("chapter_slug", slug)
        .in("exam_papers.exam", exams)
        .limit(1000),
      sb
        .from("ncert_sections")
        .select("kind, ref, heading, page, printed_page, pdf_url")
        .eq("grade", grade)
        .eq("subject", data.subject)
        .eq("chapter_slug", slug),
    ]);
    if (row.error || qs.error || secs.error) throw new Error("Could not load the chapter index");

    const allPlaces = new Map<string, NcertPlace>();
    for (const s of secs.data ?? []) {
      allPlaces.set(placeKey(s.kind, s.ref), {
        kind: s.kind,
        ref: s.ref,
        heading: s.heading,
        page: s.page,
        printedPage: s.printed_page,
        pdfUrl: s.pdf_url,
      });
    }

    const all = ((qs.data ?? []) as unknown as QuestionRow[]).map((q) => questionView(q, allPlaces));
    all.sort(newestFirst);
    const questions: ExamQuestionView[] = all.filter((q) => q.inSyllabus).map(({ inSyllabus: _i, topic: _t, ...q }) => q);
    const oldSyllabus = all.filter((q) => !q.inSyllabus).map(({ inSyllabus: _i, ...q }) => q);

    const content = (row.data?.content ?? {}) as {
      conceptMap?: ExamConcept[];
      concepts?: ExamConcept[];
      revision?: string[];
      plan?: string;
    };
    const base = content.concepts ?? content.conceptMap ?? [];
    const concepts = base
      .map((c) => {
        const cq = questions.filter((q) => q.conceptId === c.id);
        const examCounts: Partial<Record<ExamName, number>> = {};
        for (const q of cq) examCounts[q.exam] = (examCounts[q.exam] ?? 0) + 1;
        return {
          ...c,
          count: cq.length,
          years: [...new Set(cq.map((q) => q.year))].sort((a, b) => b - a),
          exams: examCounts,
        };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count || (b.years[0] ?? 0) - (a.years[0] ?? 0));

    // Only the NCERT places the page points at.
    const used = new Set<string>();
    for (const c of concepts) for (const r of c.ncert ?? []) used.add(r);
    for (const q of questions) if (q.ncert) used.add(placeKey(q.ncert.kind, q.ncert.ref));
    const places: Record<string, NcertPlace> = {};
    for (const k of used) {
      const p = allPlaces.get(k);
      if (p) places[k] = p;
    }
    const anyPlace = secs.data?.[0];

    return {
      group: data.group,
      subject: data.subject,
      grade,
      slug,
      title,
      notesSubject: data.subject,
      pdfUrl: anyPlace?.pdf_url ?? null,
      concepts,
      revision: content.revision ?? [],
      plan: content.plan ?? null,
      questions,
      oldSyllabus,
      places,
      ready: Boolean(content.concepts),
    };
  });

/** Short-lived link to the scanned page of the real paper (stored privately). */
export const fetchPaperPage = createServerFn({ method: "GET" })
  .validator((input: unknown): { paper: string; page: number } => {
    const i = input as { paper?: unknown; page?: unknown };
    const page = Number(i?.page);
    if (typeof i?.paper !== "string" || !/^[a-z0-9-]{3,60}$/.test(i.paper)) throw new Error("Invalid input");
    if (!Number.isInteger(page) || page < 1 || page > 200) throw new Error("Invalid input");
    return { paper: i.paper, page };
  })
  .handler(async ({ data }): Promise<{ url: string } | null> => {
    const sb = await publicClient();
    const paper = await sb.from("exam_coverage").select("slug").eq("slug", data.paper).maybeSingle();
    if (paper.error || !paper.data) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("exam-pages")
      .createSignedUrl(`${data.paper}/${data.page}.webp`, 60 * 60);
    if (error || !signed) return null;
    return { url: signed.signedUrl };
  });

type OldUnitInput = { group: ExamGroup; subject: ExamSubject; unit: string };

/** Past questions of one unit that the current NCERT books dropped. */
export const fetchExamOldUnit = createServerFn({ method: "GET" })
  .validator((input: unknown): OldUnitInput => {
    const i = input as Partial<OldUnitInput>;
    if (!isExamGroup(i?.group) || !isExamSubject(i?.subject)) throw new Error("Invalid input");
    if (!EXAM_GROUPS[i.group].subjects.includes(i.subject) || !isOldUnit(i.subject, i.unit))
      throw new Error("Invalid input");
    return { group: i.group, subject: i.subject, unit: i.unit };
  })
  .handler(async ({ data }): Promise<ExamOldUnitView> => {
    const sb = await publicClient();
    const { data: rows, error } = await sb
      .from("exam_questions")
      .select(QUESTION_COLUMNS)
      .eq("subject", data.subject)
      .eq("old_unit", data.unit)
      .eq("in_syllabus", false)
      .is("chapter_slug", null)
      .in("exam_papers.exam", EXAM_GROUPS[data.group].exams)
      .limit(500);
    if (error) throw new Error("Could not load the questions");
    const questions = ((rows ?? []) as unknown as QuestionRow[])
      .map((q) => questionView(q, new Map()))
      .sort(newestFirst)
      .map(({ inSyllabus: _i, topic: _t, ...q }) => q);
    return {
      group: data.group,
      subject: data.subject,
      unit: data.unit,
      name: OLD_UNITS[data.subject][data.unit]!,
      questions,
    };
  });
