/**
 * Proof checks shared by review-drafts.ts and import-draft.ts. No AI, no writes.
 */
const deva = (s: string) => (s.match(/\p{Script=Devanagari}/gu) ?? []).length;
const latin = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;

export const normText = (s: string) =>
  s.toLowerCase().normalize("NFC").replace(/[\u200b-\u200d]/g, "").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

export function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsOf);
  return [];
}

/** Share of the note's letters in the promised script. */
export function scriptShare(content: unknown) {
  const all = stringsOf(content).join(" ");
  const d = deva(all), l = latin(all);
  return { devanagari: d / Math.max(1, d + l), latin: l / Math.max(1, d + l) };
}

/** Quoted book lines the checker cited as evidence, and how many occur in our stored text. */
export function evidenceCoverage(checkItems: { evidence: string }[], source: string) {
  const src = normText(source);
  const quotes = checkItems.flatMap((c) => [...c.evidence.matchAll(/[“"]([^“”"]{8,400})[”"]/g)].map((m) => m[1]));
  const usable = quotes.map(normText).filter((q) => q.split(" ").length >= 2);
  const found = usable.filter((q) => src.includes(q));
  return { quotes: usable.length, found: found.length, missing: usable.filter((q) => !src.includes(q)) };
}

/** Highlighted / quoted words in the note written in the book's script that the book never contains. */
export function missingAnchors(content: unknown, source: string) {
  const src = normText(source);
  const srcIsDeva = deva(source) > latin(source);
  const anchors = new Set<string>();
  for (const s of stringsOf(content)) {
    for (const m of s.matchAll(/\*\*(.+?)\*\*/g)) anchors.add(m[1]);
    for (const m of s.matchAll(/[“"‘]([^“”"’]{2,80})[”"’]/g)) anchors.add(m[1]);
  }
  return [...anchors].filter((a) => {
    const n = normText(a);
    if (n.length < 3) return false;
    if (deva(a) > latin(a) !== srcIsDeva) return false;
    return !src.includes(n);
  });
}

/** The draft must be built on our textbook: exact hash, or a copy whose cited lines all occur in it. */
export function sourceProof(draftHash: string, storedHash: string, coverage: { quotes: number; found: number }) {
  if (draftHash === storedHash) return { ok: true, how: "exact hash" };
  const ok = coverage.quotes >= 5 && coverage.found / coverage.quotes >= 0.9;
  return { ok, how: `hash differs; ${coverage.found}/${coverage.quotes} cited book lines found in stored text` };
}
