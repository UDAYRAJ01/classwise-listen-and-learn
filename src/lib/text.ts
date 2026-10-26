// Small text helpers for the **highlight** markup used inside notes.

export type Segment = { text: string; strong: boolean };

// A highlight is **word**: the opening ** touches the next character and the closing ** touches
// the previous one. A bare ** with spaces around it (Python's x ** 2), **= (x **= 3) or ** between
// a letter and a digit (x**2) is code, not markup, and must survive untouched; so are star
// patterns like "***; **; *". Inside a word a
// highlight may still mark letters (stala**G**mite), and "** * **" highlights one operator.
const OPEN = String.raw`(?:(?<![\p{L}\p{N}*])|(?<=\p{L})(?=\*\*\p{L}))\*\*(?![\s*;,)\]}]|=(?!=))`;
// Inside a highlight: anything but a new "**", except a spaced Python operator (i ** 3) or the
// star of a starred symbol right before the closing marks (p*** = highlighted "p*").
const BODY = String.raw`(?:[^*]|\*(?!\*)|\*(?=\*\*(?!\*))|(?<=\s)\*\*(?=\s))`;
const EMPHASIS = new RegExp(
  [
    String.raw`${OPEN}(${BODY}{1,160}?)(?<=\S)\*\*(?!\*)`,
    // "** * **" highlights a lone operator.
    String.raw`\*\* ([^\s\p{L}\p{N}]{1,3}) \*\*`,
    // "**=**", "**= aur ==**" or "**;**" highlight a sign; a bare "x **= 3" stays code.
    String.raw`\*\*([=;](?:[^*]{0,40}?[^\s*])?)\*\*(?!\*)`,
  ].join("|"),
  "gu",
);
const DANGLING = new RegExp(OPEN, "gu");

export function splitEmphasis(input: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of input.matchAll(EMPHASIS)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: input.slice(last, at), strong: false });
    out.push({ text: m[1] ?? m[2] ?? m[3] ?? "", strong: true });
    last = at + m[0].length;
  }
  if (last < input.length) out.push({ text: input.slice(last), strong: false });
  // An unclosed highlight while the notes are still streaming: drop the stray marker only.
  return out.map((s) => (s.strong ? s : { ...s, text: s.text.replace(DANGLING, "") }));
}

/** Removes highlight marks but keeps code operators such as ** and **=. */
export function stripEmphasis(input: string): string {
  return splitEmphasis(input)
    .map((s) => s.text)
    .join("");
}

export function stripMarkup(input: string): string {
  return stripEmphasis(input)
    .replace(/(^|\s)\*(?=[^\s*])/g, "$1")
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

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with"]);

/**
 * Chapter titles copied from book PDFs are sometimes ALL CAPS or all lower case. Those become
 * Title Case ("LAWS OF MOTION" → "Laws of Motion"); titles with mixed case, roman numerals
 * and non-Latin scripts are left as they are.
 */
export function tidyTitle(input: string): string {
  // "Biotechnology : Principles" (a PDF gap) → "Biotechnology: Principles"; Hindi "कबीर : साखी" keeps its style.
  const title = input.replace(/\s+/g, " ").replace(/([A-Za-z)])\s+([:;,])/g, "$1$2").trim();
  if (!/[A-Za-z]/.test(title)) return title;
  if (title !== title.toUpperCase() && title !== title.toLowerCase()) return title;
  let first = true;
  return title
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      const out =
        /^[IVX]+[.:,]?$/.test(word) || /\d/.test(word) || !/[A-Za-z]/.test(word)
          ? word
          : !first && SMALL_WORDS.has(lower)
            ? lower
            : lower.replace(/(^|[-‘'“(])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
      // The word after a colon or dash starts a new phrase.
      first = /[:–—]$/.test(word) || word === "–" || word === ":";
      return out;
    })
    .join(" ");
}

/**
 * NCERT section headings read from the book PDFs: ALL CAPS becomes Title Case and a capital
 * split off its word by the PDF ("PHYSICAL Q UANTITIES") is joined back.
 */
export function tidyHeading(input: string): string {
  const joined = input
    // "POISSON ’ S" → "POISSON’S"; the PDF font also drops the Q of "EQUATIONS".
    .replace(/\s*’\s*S\b/g, "’S")
    .replace(/\bE U ATION/g, "EQUATION")
    // English has no one-letter capital words except "A" and "I", so any other one standing
    // alone before a word is a split ("Q UANTITIES"); a possessive S is not.
    .replace(/(?<![’'\w])([B-HJ-Z]) (?=[A-Z]{3,}\b)/g, "$1");
  return tidyTitle(joined);
}
