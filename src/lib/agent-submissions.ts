import { z } from 'zod';

const text = z.string().trim().min(1).max(40000);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(160);
const identity = {
  task: z.number().int().positive(),
  board: z.enum(['cbse', 'icse']),
  grade: z.number().int().min(1).max(12),
  subject: slug,
  chapter: slug,
  language: z.enum(['hinglish', 'hi', 'en']),
  source: z.object({ reference: text, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
};
const optionalText = z.string().max(40000);
export const draftNoteSchema = z.object({
  title: text, oneLiner: text, summary: text,
  keyPoints: z.array(z.object({ heading: text, points: z.array(text).min(1) }).strict()).min(1),
  keyTerms: z.array(z.object({ term: text, meaning: text }).strict()),
  formulas: z.array(z.object({ name: text, formula: text, spoken: optionalText, note: optionalText }).strict()),
  tricks: z.array(z.object({ title: text, kind: z.enum(['acronym','rhyme','story','visual','pattern','shortcut']), trick: text, explanation: text }).strict()).min(1),
  questions: z.array(z.object({ question: text, answer: text, marks: z.number().int().min(1).max(6) }).strict()).min(1),
  quickRevision: z.array(text).min(1), examTips: z.array(text).min(1), funFact: optionalText,
  mcqs: z.array(z.object({ question: text, options: z.array(text).length(4), answer: z.number().int().min(0).max(3), explanation: text }).strict()).min(1),
  mistakes: z.array(z.object({ mistake: text, correct: text }).strict()).min(1),
}).strict();
export const submissionSchema = z.discriminatedUnion('kind', [
  z.object({ ...identity, kind: z.literal('write'), content: draftNoteSchema }).strict(),
  z.object({ ...identity, kind: z.literal('check'), noteSha256: z.string().regex(/^[a-f0-9]{64}$/),
    verdict: z.enum(['pass', 'changes-needed']),
    checks: z.array(z.object({ section: text, evidence: text, finding: text, correction: optionalText }).strict()).min(1),
  }).strict(),
  z.object({ ...identity, kind: z.literal('speak'), noteFile: z.string().regex(/^agent-workspace\/submissions\/[a-zA-Z0-9_-]+\.json$/),
    voice: z.enum(['didi','bhaiya']),
    tracks: z.array(z.object({ index: z.number().int().nonnegative(), textSha256: z.string().regex(/^[a-f0-9]{64}$/), file: z.string().regex(/^agent-workspace\/submissions\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.wav$/) }).strict()).min(1),
  }).strict(),
]);

/** Preserve exact bytes so checker noteSha256 can reference the original draft. */
export function parseContentSubmission(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > 2_000_000) throw new Error('Draft exceeds 2 MB');
  const draft = submissionSchema.parse(JSON.parse(raw));
  if (draft.kind === 'speak') throw new Error('Direct inbox accepts write/check only; audio uses the repository workflow');
  if (draft.kind === 'check' && draft.verdict === 'pass' && draft.checks.some(c => c.correction.trim())) {
    throw new Error('Pass verdict cannot contain pending corrections');
  }
  return draft;
}
