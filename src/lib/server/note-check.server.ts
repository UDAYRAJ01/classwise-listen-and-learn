import type { BoardId, SubjectMeta } from "@/lib/catalog";
import { BOARDS } from "@/lib/catalog";
import { stripEmphasis } from "@/lib/text";
import type { NoteContent } from "@/lib/types";

import { streamStructured } from "./ai.server";

export const CHECK_SECTIONS = [
  "summary",
  "notes",
  "terms",
  "formulas",
  "tricks",
  "mistakes",
  "questions",
  "quiz",
  "revision",
  "tips",
  "funfact",
] as const;
export type CheckSection = (typeof CHECK_SECTIONS)[number];

export interface CheckIssue {
  section: CheckSection;
  /** wrong = contradicts the textbook / false; missing = exam-important topic left out; trick = memory trick encodes a wrong or incomplete list. */
  kind: "wrong" | "missing" | "trick";
  wrong: string;
  correct: string;
}

const checkSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issues"],
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "kind", "wrong", "correct"],
        properties: {
          section: { type: "string", enum: [...CHECK_SECTIONS] },
          kind: { type: "string", enum: ["wrong", "missing", "trick"] },
          wrong: { type: "string" },
          correct: { type: "string" },
        },
      },
    },
  },
} as const;

/** Plain-text view of the notes with section labels, for the checker to read. */
export function noteAsText(c: NoteContent): string {
  const out: string[] = [];
  const sec = (name: string, lines: string[]) => {
    if (lines.length) out.push(`[${name}]`, ...lines, "");
  };
  sec("summary", [c.oneLiner, c.summary].filter(Boolean));
  sec(
    "notes",
    c.keyPoints.flatMap((g) => [`## ${g.heading}`, ...g.points.map((p) => `- ${p}`)]),
  );
  sec(
    "terms",
    c.keyTerms.map((t) => `- ${t.term}: ${t.meaning}`),
  );
  sec(
    "formulas",
    c.formulas.map((f) => `- ${f.name}: ${f.formula}${f.note ? ` (${f.note})` : ""}`),
  );
  sec(
    "tricks",
    c.tricks.map((t) => `- ${t.title} [${t.kind}]: ${t.trick} — ${t.explanation}`),
  );
  sec(
    "mistakes",
    (c.mistakes ?? []).map((m) => `- Mistake: ${m.mistake} | Correct: ${m.correct}`),
  );
  sec(
    "questions",
    c.questions.map((q) => `- (${q.marks} marks) Q: ${q.question}\n  A: ${q.answer}`),
  );
  sec(
    "quiz",
    (c.mcqs ?? []).map(
      (m) =>
        `- Q: ${m.question}\n  Options: ${m.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("  ")}\n  Marked answer: ${String.fromCharCode(65 + m.answer)} — ${m.explanation}`,
    ),
  );
  sec(
    "revision",
    c.quickRevision.map((r) => `- ${r}`),
  );
  sec(
    "tips",
    c.examTips.map((t) => `- ${t}`),
  );
  sec("funfact", c.funFact ? [c.funFact] : []);
  // Drop highlight marks only: the checker must see code operators like ** exactly as written.
  return out.map(stripEmphasis).join("\n");
}

const INSTRUCTIONS = [
  "You are a strict, experienced board-exam examiner. You check a student's chapter notes for correctness.",
  "Report ONLY real problems a teacher would mark wrong:",
  "1) wrong: any fact, definition, number, unit, date, name, formula, equation, example, answer or explanation that is false or contradicts the textbook;",
  "2) quiz: an MCQ whose marked answer is not the single correct option, or with two correct options — report it as kind 'wrong', section 'quiz';",
  "3) trick: a memory trick whose letters/words do not match the real list or order, or that teaches a wrong fact;",
  "4) missing: an exam-important topic, definition, law or formula of the chapter that the notes leave out completely (not small details).",
  "Do NOT report style, language mix, spelling, formatting, brevity, or things that are merely simplified but still correct. Hinglish/Hindi wording is intended.",
  "For every issue, 'wrong' quotes or paraphrases the faulty line (empty for missing) and 'correct' is one self-contained, precise statement in English of the correct fact, written so a note writer can follow it without seeing the textbook.",
  "If everything is correct, return an empty issues list. Never invent problems.",
].join("\n");

export async function checkNote(opts: {
  board: BoardId;
  grade: number;
  subject: SubjectMeta;
  chapterTitle: string;
  content: NoteContent;
  source: string | null;
}): Promise<CheckIssue[]> {
  const prompt = [
    `Board: ${BOARDS[opts.board].name}. Class ${opts.grade}. Subject: ${opts.subject.name}. Chapter: ${opts.chapterTitle}.`,
    opts.source
      ? `OFFICIAL TEXTBOOK CHAPTER TEXT (extracted from the PDF; may contain layout noise). This is the reference — judge the notes against it:\n<<<\n${opts.source}\n>>>`
      : "No textbook text is available for this chapter. Judge against the standard syllabus and well-established facts; report only problems you are certain about.",
    "",
    "NOTES TO CHECK:",
    "<<<",
    noteAsText(opts.content),
    ">>>",
  ].join("\n");
  const out = await streamStructured<{ issues?: CheckIssue[] }>({
    instructions: INSTRUCTIONS,
    prompt,
    schema: checkSchema,
    effort: "medium",
  });
  return (out.issues ?? [])
    .filter((i) => CHECK_SECTIONS.includes(i.section) && i.correct?.trim())
    .map((i) => ({
      ...i,
      wrong: i.wrong.trim().slice(0, 600),
      correct: i.correct.trim().slice(0, 600),
    }))
    .slice(0, 25);
}
