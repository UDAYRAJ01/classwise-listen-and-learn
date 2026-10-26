/**
 * Reads an NCERT chapter PDF into positioned text lines and finds its numbered sections,
 * worked examples, exercise questions, figures and tables with their page numbers.
 *
 * Plain `pdftotext` loses the link between a heading number ("13.3") and its title when
 * the book sets them in separate boxes, so this works from word positions instead: words
 * are grouped into lines by baseline, and a line is split where a wide gap separates columns.
 * Kept free of database code so it can be tested on its own.
 */
import { execFileSync } from "node:child_process";

export type SectionKind = "section" | "example" | "exercise" | "figure" | "table";

export interface Line {
  page: number;
  text: string;
  /** Glyph height: headings are set larger than body text. */
  size: number;
  x: number;
  y: number;
}

export interface Located {
  kind: SectionKind;
  ref: string;
  heading: string;
  page: number;
  printed_page: number | null;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** Parses `pdftotext -bbox` output into lines (one per baseline and column). */
export function linesFromBbox(html: string): Line[] {
  const out: Line[] = [];
  const pages = html.split(/<page\b/).slice(1);
  pages.forEach((pageHtml, pi) => {
    const words: { x0: number; x1: number; y0: number; y1: number; t: string }[] = [];
    for (const m of pageHtml.matchAll(
      /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g,
    )) {
      words.push({ x0: +m[1]!, y0: +m[2]!, x1: +m[3]!, y1: +m[4]!, t: decode(m[5]!) });
    }
    // Group by baseline (yMax), tolerant to small caps and superscripts.
    words.sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);
    const rows: (typeof words)[] = [];
    for (const w of words) {
      const row = rows.find((r) => Math.abs(r[0]!.y1 - w.y1) <= 2.5);
      if (row) row.push(w);
      else rows.push([w]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x0 - b.x0);
      let seg: typeof words = [];
      const flush = () => {
        if (!seg.length) return;
        let text = "";
        seg.forEach((w, i) => {
          const gap = i ? w.x0 - seg[i - 1]!.x1 : 0;
          text += i && gap > 1 ? ` ${w.t}` : w.t;
        });
        const size = Math.max(...seg.map((w) => w.y1 - w.y0));
        out.push({ page: pi + 1, text: text.trim(), size, x: seg[0]!.x0, y: seg[0]!.y1 });
        seg = [];
      };
      for (const w of row) {
        const prev = seg[seg.length - 1];
        // A wide gap means a new column (margin notes, two-column pages, tab stops after numbers are small).
        if (prev && w.x0 - prev.x1 > 14) flush();
        seg.push(w);
      }
      flush();
    }
  });
  // Reading order inside each page: top to bottom, then left to right.
  return out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

export function readLines(pdf: string): Line[] {
  const html = execFileSync("pdftotext", ["-bbox", pdf, "-"], { maxBuffer: 256 << 20 }).toString();
  return linesFromBbox(html);
}

/** Printed page = PDF page + the offset most pages agree on (page numbers sit at the top or bottom). */
export function printedOffset(lines: Line[]): number | null {
  const byPage = new Map<number, Line[]>();
  for (const l of lines) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l]);
  const votes = new Map<number, number>();
  for (const [page, ls] of byPage) {
    // "Reprint 2026-27" sits below the page number on every page; it is not the page edge.
    const ys = ls.filter((l) => !/^Reprint\b/i.test(l.text)).map((l) => l.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    for (const l of ls) {
      if (l.y - top > 40 && bottom - l.y > 40) continue;
      // "127", or a running head such as "BINOMIAL THEOREM 127" / "128 MATHEMATICS".
      const m =
        /^(\d{1,3})$/.exec(l.text) ??
        /^[A-Z][A-Za-z ,&\-–:]+\s(\d{1,3})$/.exec(l.text) ??
        /^(\d{1,3})\s[A-Z][A-Za-z ,&\-–:]+$/.exec(l.text);
      if (!m) continue;
      const off = Number(m[1]) - page;
      votes.set(off, (votes.get(off) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  let bestVotes = 0;
  for (const [off, v] of votes) if (v > bestVotes) [best, bestVotes] = [off, v];
  return bestVotes >= Math.max(2, Math.floor(byPage.size / 4)) ? best : null;
}

const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s+\d{1,3}$/, "")
    .trim()
    .slice(0, 140);

const upperCase = (s: string) => s === s.toUpperCase() && /[A-Z]{3}/.test(s);

const isTitle = (s: string) =>
  !/^E?XAMPLE\b/i.test(s) &&
  /^[A-Z(“"‘']/.test(s) && s.length >= 3 && s.length <= 100 && !/[=×÷]/.test(s) && !/\.\s*$/.test(s.replace(/\?$/, ""));

/**
 * Finds every location in a chapter.
 * - sections: "13.3 FORCED OSCILLATIONS" (title may sit on the next line); a chapter-opening
 *   contents box repeats the numbers, so the largest-type occurrence wins.
 * - examples: "Example 6.1", "u Example 6.1" (Physics bullet), "Example 3" (Maths), "Problem 1.2" (Chemistry XI).
 * - exercises: after an EXERCISE(S) heading — "1.4 …" (Physics/Chemistry) or "EXERCISE 7.1" then "3. …" (Maths);
 *   Maths "Miscellaneous Exercise" items become "Misc 3".
 */
export function locate(lines: Line[]): Located[] {
  const offset = printedOffset(lines);
  const printed = (p: number) => (offset === null ? null : p + offset);

  // Chapter number = the prefix most numbered headings share.
  const votes = new Map<string, number>();
  for (const l of lines) {
    // Only numbered headings vote (tables of values like "0.1  0.01" must not).
    const m = /^(\d{1,2})\.\d{1,2}(?:\.\d{1,2})?\.?\s+(.+)$/.exec(l.text);
    if (m && isTitle(m[2]!)) votes.set(m[1]!, (votes.get(m[1]!) ?? 0) + 1);
    const f = /^(?:Fig(?:ure)?\.?|Table|Example|EXERCISE)\s*(\d{1,2})\.\d{1,2}\b/.exec(l.text);
    if (f) votes.set(f[1]!, (votes.get(f[1]!) ?? 0) + 1);
  }
  const chapterNo = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!chapterNo) return [];

  const sections = new Map<string, { ref: string; title: string; page: number; size: number }[]>();
  const others = new Map<string, Located>();
  const add = (kind: SectionKind, ref: string, heading: string, page: number) => {
    const key = `${kind}:${ref}`;
    if (!others.has(key)) others.set(key, { kind, ref, heading: tidy(heading), page, printed_page: printed(page) });
  };

  const sec = new RegExp(`^(${chapterNo}\\.\\d{1,2}(?:\\.\\d{1,2})?)\\.?(?:\\s+(.*))?$`);

  // Pages with a contents box: many top-level section numbers listed together. Their
  // "Summary / Exercises" entries are not the real exercise headings.
  const topRefs = new Map<number, Set<string>>();
  for (const l of lines) {
    const m = new RegExp(`^(${chapterNo}\\.\\d{1,2})\\.?(?:\\s|$)`).exec(l.text);
    if (m) topRefs.set(l.page, (topRefs.get(l.page) ?? new Set()).add(m[1]!));
  }
  const contentsPage = (p: number) => (topRefs.get(p)?.size ?? 0) >= 4 && p <= 2;
  let exerciseSet: string | null = null; // "7.1" for Maths EXERCISE 7.1, "misc", or "" for Physics/Chemistry style
  let lastExercisePage = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const t = l.text.replace(/^[u•▪■]\s+/, "");
    let m: RegExpExecArray | null;

    if ((m = /^EXERCISES?(?:\s+(\d{1,2}\.\d{1,2}))?\s*$/i.exec(t)) && !contentsPage(l.page)) {
      exerciseSet = m[1] ?? "";
      lastExercisePage = l.page;
      continue;
    }
    if (/^Miscellaneous Exercises?\b/i.test(t)) {
      exerciseSet = "misc";
      lastExercisePage = l.page;
      continue;
    }
    if (/^(Summary|SUMMARY|Points to Ponder|POINTS TO PONDER|Additional Exercises|ADDITIONAL EXERCISES)\b/.test(t)) {
      if (!/Additional/i.test(t)) exerciseSet = null;
    }

    if ((m = /^(?:Example|EXAMPLE|Problem|PROBLEM)\s+(\d{1,2}(?:\.\d{1,2})?)\b\.?\s*(.*)$/.exec(t))) {
      // Kept as printed: "6.1" in Physics, plain "3" in Maths. A dotted number from another
      // chapter is a cross-reference in the text, not a worked example here.
      const ref = m[1]!;
      if (!ref.includes(".") || ref.startsWith(`${chapterNo}.`)) {
        add("example", ref, m[2] || lines[i + 1]?.text || "", l.page);
      }
      continue;
    }
    if ((m = new RegExp(`^Fig(?:ure)?\\.?\\s*(${chapterNo}\\.\\d{1,2})\\s*[:.]?\\s*(.*)$`).exec(t))) {
      if (m[2] && m[2].length > 3) add("figure", m[1]!, m[2], l.page);
      continue;
    }
    if ((m = new RegExp(`^Table\\s+(${chapterNo}\\.\\d{1,2})\\s*[:.]?\\s*(.*)$`).exec(t))) {
      if (m[2] && m[2].length > 3) add("table", m[1]!, m[2], l.page);
      continue;
    }

    if (exerciseSet !== null && l.page - lastExercisePage <= 6) {
      if (exerciseSet === "") {
        if ((m = new RegExp(`^(${chapterNo}\\.\\d{1,2})\\.?(?:\\s+(.*))?$`).exec(t))) {
          add("exercise", m[1]!, m[2] || lines[i + 1]?.text || "", l.page);
          lastExercisePage = l.page;
          continue;
        }
        if ((m = /^(\d{1,2})\.\s+(.+)$/.exec(t))) {
          add("exercise", `${chapterNo}.Q${m[1]}`, m[2]!, l.page);
          lastExercisePage = l.page;
          continue;
        }
      } else if ((m = /^(\d{1,2})\.(?:\s+(.*))?$/.exec(t))) {
        const ref = exerciseSet === "misc" ? `Misc ${m[1]}` : `${exerciseSet} Q${m[1]}`;
        add("exercise", ref, m[2] || lines[i + 1]?.text || "", l.page);
        lastExercisePage = l.page;
        continue;
      }
    }

    if ((m = sec.exec(t))) {
      const ref = m[1]!;
      let title = (m[2] ?? "").trim();
      if (!title) {
        const next = lines[i + 1];
        if (next && next.page === l.page && Math.abs(next.y - l.y) < 40) title = next.text;
      }
      if (!isTitle(title)) continue;
      // A long heading wraps onto the next line: join it when the wrap is obvious
      // (all-capitals heading, or a line ending in a joining word like "and" / "of").
      const next = lines[i + 1];
      if (
        next &&
        next.page === l.page &&
        next.y - l.y > 0 &&
        next.y - l.y < 16 &&
        Math.abs(next.size - l.size) < 0.6 &&
        next.text.length < 60 &&
        ((upperCase(title) && upperCase(next.text)) ||
          /\b(and|of|for|in|to|the|with|on|its|their|a)$/i.test(title))
      ) {
        title = `${title} ${next.text}`;
      }
      if (exerciseSet !== null && exerciseSet !== "") exerciseSet = null; // Maths: next section ends EXERCISE n.m
      const cand = { ref, title, page: l.page, size: l.size };
      sections.set(ref, [...(sections.get(ref) ?? []), cand]);
    }
  }

  // The real heading is the occurrence outside the contents box (usually set in capitals).
  const score = (c: { title: string; page: number; size: number }) =>
    (contentsPage(c.page) ? 0 : 100) + (upperCase(c.title) ? 10 : 0) + c.size / 100;
  const secs: Located[] = [];
  for (const [ref, cands] of sections) {
    const best = [...cands].sort((a, b) => score(b) - score(a) || a.page - b.page)[0]!;
    // A contents-box title is usually cut short; take the longer wording when it is the same heading.
    secs.push({ kind: "section", ref, heading: tidy(best.title), page: best.page, printed_page: printed(best.page) });
  }
  return [...secs, ...others.values()];
}
