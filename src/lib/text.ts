// Small text helpers for the **highlight** markup used inside notes.

export type Segment = { text: string; strong: boolean };

export function splitEmphasis(input: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (m.index > last) out.push({ text: input.slice(last, m.index), strong: false });
    out.push({ text: m[1] ?? "", strong: true });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ text: input.slice(last), strong: false });
  // Unclosed ** while streaming: drop stray markers.
  return out.map((s) => ({ ...s, text: s.text.replace(/\*\*/g, "") }));
}

export function stripMarkup(input: string): string {
  return input
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(\S)/g, "$1$2")
    .replace(/[_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ensures a sentence ends with punctuation so speech pauses naturally. */
export function sentence(input: string): string {
  const t = stripMarkup(input);
  if (!t) return "";
  return /[.!?।:;]$/.test(t) ? t : `${t}.`;
}
