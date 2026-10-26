/**
 * JEE / NEET section: shared shapes and helpers (browser-safe).
 * Data comes from real past papers stored by scripts/exam/* and is read through
 * src/lib/exam.functions.ts.
 */

export type ExamGroup = "jee" | "neet";
export type ExamSubject = "physics" | "chemistry" | "maths" | "biology";
export type ExamName = "jee-main" | "jee-advanced" | "neet";

export const EXAM_GROUPS: Record<
  ExamGroup,
  { name: string; short: string; exams: ExamName[]; subjects: ExamSubject[]; blurb: string }
> = {
  jee: {
    name: "IIT-JEE (Main + Advanced)",
    short: "JEE",
    exams: ["jee-main", "jee-advanced"],
    subjects: ["physics", "chemistry", "maths"],
    blurb: "Engineering ke liye — Physics, Chemistry, Maths",
  },
  neet: {
    name: "NEET UG",
    short: "NEET",
    exams: ["neet"],
    subjects: ["physics", "chemistry", "biology"],
    blurb: "Medical ke liye — Physics, Chemistry, Biology",
  },
};

export const EXAM_NAMES: Record<ExamName, string> = {
  "jee-main": "JEE Main",
  "jee-advanced": "JEE Advanced",
  neet: "NEET",
};

export const SUBJECT_NAMES: Record<ExamSubject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  maths: "Maths",
  biology: "Biology",
};

export const isExamGroup = (v: unknown): v is ExamGroup => v === "jee" || v === "neet";
export const isExamSubject = (v: unknown): v is ExamSubject =>
  v === "physics" || v === "chemistry" || v === "maths" || v === "biology";

/** URL part for a chapter: "11-b1-c3-motion-in-a-plane" (class first, then the book chapter slug). */
export const chapterParam = (grade: number, slug: string) => `${grade}-${slug}`;
export function parseChapterParam(p: string): { grade: 11 | 12; slug: string } | null {
  const m = /^(11|12)-(b\d{1,2}-c\d{1,2}-[a-z0-9-]{1,90})$/.exec(p);
  return m ? { grade: Number(m[1]) as 11 | 12, slug: m[2]! } : null;
}

export interface ExamChapterStat {
  grade: number;
  slug: string;
  title: string;
  questions: number;
  main: number;
  advanced: number;
  neet: number;
  years: number[];
  topConcept: string | null;
  hasIndex: boolean;
}

export interface ExamSubjectOverview {
  subject: ExamSubject;
  total: number;
  chapters: ExamChapterStat[];
  /** Questions from topics that the current NCERT books no longer teach. */
  outOfSyllabus: number;
}

export interface ExamPaperInfo {
  exam: ExamName;
  slug: string;
  label: string;
  year: number;
  answerSource: "official" | "coaching" | "none";
  questions: number;
  sourceUrl: string;
}

export interface ExamOverview {
  group: ExamGroup;
  subjects: ExamSubjectOverview[];
  papers: ExamPaperInfo[];
  totalQuestions: number;
}

export interface NcertPlace {
  kind: string;
  ref: string;
  heading: string;
  page: number;
  printedPage: number | null;
  pdfUrl: string;
}

export interface ExamSolution {
  steps: string;
  trick: string;
  analysis: string;
  trap: string;
  answer: string;
  /** False when the worked answer did not match the key (kept hidden from students). */
  ok: boolean;
  /** "key" = checked against the paper's answer key; "self" = no key, solved twice and both agreed. */
  checkedBy: "key" | "self";
}

export interface ExamQuestionView {
  id: string;
  exam: ExamName;
  year: number;
  paper: string;
  paperSlug: string;
  answerSource: "official" | "coaching" | "none";
  qno: string | null;
  kind: string;
  passage: string | null;
  body: string;
  options: string[];
  answer: string | null;
  page: number | null;
  hasFigure: boolean;
  figureBox: [number, number, number, number] | null;
  conceptId: string | null;
  source: "ncert-example" | "ncert-exercise" | "ncert-text" | "beyond-ncert" | null;
  ncert: NcertPlace | null;
  solution: ExamSolution | null;
}

export interface ExamConcept {
  id: string;
  name: string;
  ncert: string[];
  explain?: string;
  key?: string | null;
  hook?: string;
  why?: string;
  next?: string;
  trap?: string;
}

export interface ExamChapterView {
  group: ExamGroup;
  subject: ExamSubject;
  grade: number;
  slug: string;
  title: string;
  /** Link to the PadhoSuno notes of the same chapter. */
  notesSubject: string;
  pdfUrl: string | null;
  concepts: (ExamConcept & { count: number; years: number[]; exams: Partial<Record<ExamName, number>> })[];
  revision: string[];
  plan: string | null;
  questions: ExamQuestionView[];
  /** Asked in past papers, but on a topic the current NCERT book of this chapter no longer has. */
  oldSyllabus: (ExamQuestionView & { topic: string })[];
  places: Record<string, NcertPlace>;
  ready: boolean;
}

/** "section 3.6" → { kind, ref } */
export const placeKey = (kind: string, ref: string) => `${kind} ${ref}`;

export function placeLabel(p: Pick<NcertPlace, "kind" | "ref">): string {
  switch (p.kind) {
    case "section":
      return `Section ${p.ref}`;
    case "example":
      return `Example ${p.ref}`;
    case "exercise":
      return /^Misc/i.test(p.ref) ? `Miscellaneous Exercise ${p.ref.replace(/^Misc\s*/i, "Q")}` : `Exercise ${p.ref.replace(/\.Q/, " Q")}`;
    case "figure":
      return `Fig. ${p.ref}`;
    case "table":
      return `Table ${p.ref}`;
    default:
      return p.ref;
  }
}

/** Opens the NCERT chapter PDF at the right page. */
export const pdfAtPage = (p: Pick<NcertPlace, "pdfUrl" | "page">) => `${p.pdfUrl}#page=${p.page}`;

export const SOURCE_LABELS: Record<NonNullable<ExamQuestionView["source"]>, string> = {
  "ncert-example": "NCERT Example jaisa",
  "ncert-exercise": "NCERT Exercise jaisa",
  "ncert-text": "NCERT text se",
  "beyond-ncert": "NCERT se aage",
};

// ---------------------------------------------------------------- spaced revision

/** Days until the next revision after the n-th one (1st → 1 day, 2nd → 3 days, …). */
export const REVISION_GAPS = [1, 3, 7, 15, 30, 60];

export interface Revision {
  /** How many times the chapter was revised. */
  n: number;
  /** Local date (YYYY-MM-DD) of the last revision. */
  last: string;
  /** Local date of the next planned revision. */
  next: string;
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** Record one more revision done today. Revising twice on one day does not count twice. */
export function nextRevision(prev: Revision | undefined, today: string): Revision {
  if (prev && prev.last === today) return prev;
  const n = (prev?.n ?? 0) + 1;
  const gap = REVISION_GAPS[Math.min(n, REVISION_GAPS.length) - 1]!;
  return { n, last: today, next: addDays(today, gap) };
}

export type RevisionState = "new" | "due" | "later";

export function revisionState(r: Revision | undefined, today: string): RevisionState {
  if (!r) return "new";
  return r.next <= today ? "due" : "later";
}

export const revisionKey = (group: ExamGroup, subject: string, grade: number, slug: string) =>
  `${group}/${subject}/${grade}/${slug}`;
