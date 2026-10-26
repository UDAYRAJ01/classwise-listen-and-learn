/**
 * Answer handling for past exam questions, shared by the paper pipeline (scripts/exam)
 * and the solution route, so a stored key and a worked answer are compared the same way.
 */

/** Option-style question kinds (answer is one or more of A–D). */
export const OPTION_KINDS = new Set(["single", "multiple", "matrix"]);

/** Normalises an answer to the stored form: "A".."D", "A,C", "BONUS", or a number / range "3.9-4.1". */
export function normalizeAnswer(raw: string | null | undefined, kind: string): string | null {
  if (!raw) return null;
  let s = raw
    .trim()
    .toUpperCase()
    .replace(/^ANS(WER)?\s*(Q\s*\d+)?\s*[:.-]?\s*/, "")
    .replace(/^\[(.*)\]$/, "$1")
    .trim();
  if (!s) return null;
  if (/DROP|BONUS|DELETED|CANCEL|MARKS TO ALL/.test(s)) return "BONUS";
  if (OPTION_KINDS.has(kind)) {
    s = s.replace(/[()[\]]/g, " ").replace(/\bOR\b|\bAND\b|&|\//g, ",");
    const map: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
    const letters = s
      .split(/[\s,]+/)
      .filter(Boolean)
      // "ACD" printed without separators means A, C and D.
      .flatMap((x) => (/^[A-D]{2,4}$/.test(x) ? x.split("") : [x]))
      .map((x) => map[x] ?? x)
      .filter((x) => /^[A-D]$/.test(x));
    if (letters.length === 0) return null;
    return [...new Set(letters)].sort().join(",");
  }
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*\bTO\b\s*/g, "-")
    .replace(/\s*–\s*/g, "-")
    .trim();
}

/** True when a worked answer means the same as the key (numeric keys may be a range). */
export function answersMatch(given: string | null, official: string | null): boolean {
  if (!given || !official) return false;
  if (official === "BONUS") return true;
  const a = given.replace(/\s/g, "");
  const b = official.replace(/\s/g, "");
  if (a === b) return true;
  // A key can list alternatives: "A,D" or "D" both accepted is printed as "[A, D] or [D]".
  const num = (x: string) => Number(x.replace(/,/g, ""));
  const range = /^(-?[\d.]+)-(-?[\d.]+)$/.exec(b);
  const ga = num(a);
  if (range && !Number.isNaN(ga)) return ga >= num(range[1]!) - 1e-9 && ga <= num(range[2]!) + 1e-9;
  if (!Number.isNaN(ga) && !Number.isNaN(num(b)))
    return Math.abs(ga - num(b)) <= 1e-6 + Math.abs(num(b)) * 0.01;
  return false;
}
