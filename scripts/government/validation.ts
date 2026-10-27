export interface ExtractedQuestion { number: number; page: number; body: string; options: string[]; kind: "single" | "multiple" | "numeric" | "descriptive"; section: string; topic: string; concept: string }
export function validatePaperQuestions(input: ExtractedQuestion[], expected: number) {
  const out = new Map<number, ExtractedQuestion>();
  for (const q of input) {
    if (!Number.isInteger(q.number) || q.number < 1 || q.number > expected) throw new Error(`Unexpected question number ${q.number}`);
    if (out.has(q.number)) throw new Error(`Duplicate English question ${q.number}: manual review required`);
    if (!q.body.trim() || !q.topic.trim() || !q.concept.trim() || q.body.includes("[CONTINUED]") || (q.kind === "single" && q.options.length !== 4)) throw new Error(`Incomplete question ${q.number}`);
    out.set(q.number,q);
  }
  for (let n=1;n<=expected;n++) if (!out.has(n)) throw new Error(`Missing question ${n}; partial papers never count`);
  return [...out.values()].sort((a,b)=>a.number-b.number);
}