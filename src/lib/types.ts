import type { BoardId, Lang } from "./catalog";

export interface SyllabusChapter {
  slug: string;
  number: number;
  title: string;
  gist: string;
}

export interface SyllabusBook {
  name: string;
  chapters: SyllabusChapter[];
}

export interface SyllabusRecord {
  id: string;
  board: BoardId;
  grade: number;
  subject: string;
  books: SyllabusBook[];
  created_at: string;
}

export type TrickKind = "acronym" | "rhyme" | "story" | "visual" | "pattern" | "shortcut";

export interface NoteContent {
  title: string;
  oneLiner: string;
  summary: string;
  keyPoints: { heading: string; points: string[] }[];
  keyTerms: { term: string; meaning: string }[];
  formulas: { name: string; formula: string; spoken: string; note: string }[];
  tricks: { title: string; kind: TrickKind; trick: string; explanation: string }[];
  questions: { question: string; answer: string; marks: number }[];
  quickRevision: string[];
  examTips: string[];
  funFact: string;
  /** Multiple-choice self test. Older notes may not have it. */
  mcqs?: { question: string; options: string[]; answer: number; explanation: string }[];
}

export interface NoteRecord {
  id: string;
  board: BoardId;
  grade: number;
  subject: string;
  chapter_slug: string;
  chapter_title: string;
  book_name: string | null;
  language: Lang;
  is_custom: boolean;
  content: NoteContent;
  created_at: string;
}

/** Deep-partial shape used while notes are still streaming in. */
export type PartialNote = {
  [K in keyof NoteContent]?: NoteContent[K] extends (infer U)[]
    ? (U extends object ? Partial<U> : U)[]
    : NoteContent[K];
};

export type PartialSyllabus = {
  books?: { name?: string; chapters?: { title?: string; gist?: string }[] }[];
};

/** Events sent line-by-line (NDJSON) from the generation routes. */
export type StreamEvent<TPartial, TFinal> =
  | { type: "partial"; data: TPartial }
  | { type: "done"; data: TFinal }
  | { type: "error"; status: number; message: string };
