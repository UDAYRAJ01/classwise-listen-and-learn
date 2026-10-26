/**
 * Paper figures are shown as a crop of the real page. Some papers print the answer (or a
 * coaching solution) right under each question — "Answer: C", "Ans. (3)", "Sol." — and a
 * crop that includes it gives the answer away before the student taps "Answer dekho".
 * These helpers find such lines on the page and cut the crop above them.
 */
import { execFileSync } from "node:child_process";

import type { Box, TextLine } from "@/lib/exam-figure";

export { trimAnswerFromBox } from "@/lib/exam-figure";

/** Text lines of one PDF page, on the 0–1000 page scale used by figure boxes. */
export function pageLines(pdf: string, page: number): TextLine[] {
  let xml: string;
  try {
    xml = execFileSync("pdftotext", ["-bbox-layout", "-f", String(page), "-l", String(page), pdf, "-"], {
      maxBuffer: 32 << 20,
    }).toString();
  } catch {
    return [];
  }
  const size = /<page width="([\d.]+)" height="([\d.]+)"/.exec(xml);
  if (!size) return [];
  const [w, h] = [Number(size[1]), Number(size[2])];
  const lines: TextLine[] = [];
  for (const m of xml.matchAll(
    /<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g,
  )) {
    const text = [...m[5]!.matchAll(/<word[^>]*>([^<]*)<\/word>/g)]
      .map((x) => x[1]!.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
      .join(" ");
    const box: Box = [
      (Number(m[1]) / w) * 1000,
      (Number(m[2]) / h) * 1000,
      (Number(m[3]) / w) * 1000,
      (Number(m[4]) / h) * 1000,
    ];
    lines.push({ text, box });
  }
  return lines;
}

export interface PdfSpec {
  slug: string;
  file?: string;
  pageRange?: [number, number];
}

/** The PDF a paper's page numbers refer to (the cut-out part when the file holds more). */
export const paperPdf = (spec: PdfSpec) =>
  spec.pageRange ? `/tmp/exam/pdf/${spec.slug}-part.pdf` : (spec.file ?? `/tmp/exam/pdf/${spec.slug}.pdf`);
