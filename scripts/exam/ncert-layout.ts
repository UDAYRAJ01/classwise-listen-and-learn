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
        if (prev && w.x0 - prev.x1 > 24) flush();
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
    const ys = ls.map((l) => l.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    for (const l of ls) {
      if (l.y - top > 40 && bottom - l.y > 40) continue;
      if (!/^\d{1,3}$/.test(l.text)) continue;
      const off = Number(l.text) - page;
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

const isTitle = (s: string) =>
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
    const m = /^(\d{1,2})\.\d{1,2}(?:\.\d{1,2})?\.?(?:\s|$)/.exec(l.text);
    if (m) votes.set(m[1]!, (votes.get(m[1]!) ?? 0) + 1);
  }
  const chapterNo = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!chapterNo) return [];

  const sections = new Map<string, Located & { size: number }>();
  const others = new Map<string, Located>();
  const add = (kind: SectionKind, ref: string, heading: string, page: number) => {
    const key = `${kind}:${ref}`;
    if (!others.has(key)) others.set(key, { kind, ref, heading: tidy(heading), page, printed_page: printed(page) });
  };

  const sec = new RegExp(`^(${chapterNo}\\.\\d{1,2}(?:\\.\\d{1,2})?)\\.?(?:\\s+(.*))?$`);
  let exerciseSet: string | null = null; // "7.1" for Maths EXERCISE 7.1, "misc", or "" for Physics/Chemistry style
  let lastExercisePage = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const t = l.text.replace(/^[u•▪■]\s+/, "");
    let m: RegExpExecArray | null;

    if ((m = /^EXERCISES?(?:\s+(\d{1,2}\.\d{1,2}))?\s*$/i.exec(t)) && l.text === l.text.toUpperCase()) {
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
      const ref = m[1]!.includes(".") || !/^\d+$/.test(m[1]!) ? m[1]! : `${m[1]}`;
      // "Example 3" in Maths is chapter-local; keep the chapter number in front for clarity.
      const full = ref.includes(".") ? ref : `${chapterNo}.${ref}`;
      if (full.startsWith(`${chapterNo}.`)) add("example", full, m[2] || lines[i + 1]?.text || "", l.page);
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
      } else if ((m = /^(\d{1,2})\.\s*(.*)$/.exec(t))) {
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
      const prev = sections.get(ref);
      if (!prev || l.size > prev.size + 0.5) {
        sections.set(ref, {
          kind: "section",
          ref,
          heading: tidy(title),
          page: l.page,
          printed_page: printed(l.page),
          size: l.size,
        });
      }
    }
  }
  const secs = [...sections.values()].map(({ size: _size, ...rest }) => rest);
  return [...secs, ...others.values()];
}
