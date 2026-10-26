/**
 * One-off repair (the extractor now does this itself): cut every stored paper-figure crop
 * above an answer / solution line printed inside it, so the picture never shows the answer.
 *   bun scripts/exam/trim-figures.ts [--dry]
 */
import { existsSync, readFileSync } from "node:fs";

import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import type { Box } from "@/lib/exam-figure";

import { pageLines, paperPdf, trimAnswerFromBox, type PdfSpec } from "./figure-box";
import { args } from "./lib";

const DRY = args.has("dry");
const PAPERS: PdfSpec[] = JSON.parse(readFileSync(new URL("./papers.json", import.meta.url), "utf8"));

const { data: papers, error } = await admin.from("exam_papers").select("id, slug");
if (error) throw error;
let changed = 0;
let checked = 0;
for (const p of papers) {
  const spec = PAPERS.find((s) => s.slug === p.slug);
  const pdf = spec ? paperPdf(spec) : null;
  if (!pdf || !existsSync(pdf)) {
    console.log(`${p.slug}: paper file not found, skipped`);
    continue;
  }
  const qs = await admin
    .from("exam_questions")
    .select("id, qno, page, figure")
    .eq("paper_id", p.id)
    .eq("has_figure", true);
  if (qs.error) throw qs.error;
  const linesByPage = new Map<number, ReturnType<typeof pageLines>>();
  for (const q of qs.data) {
    const fig = q.figure as { page?: number; box?: number[]; note?: string | null } | null;
    if (!fig?.box || fig.box.length !== 4 || !q.page) continue;
    checked++;
    if (!linesByPage.has(q.page)) linesByPage.set(q.page, pageLines(pdf, q.page));
    const box = fig.box as Box;
    const next = trimAnswerFromBox(box, linesByPage.get(q.page)!);
    if (next[3] === box[3]) continue;
    changed++;
    console.log(`${p.slug} Q${q.qno}: bottom ${box[3]} → ${next[3]}`);
    if (!DRY) {
      const up = await admin.from("exam_questions").update({ figure: { ...fig, box: next } }).eq("id", q.id);
      if (up.error) throw up.error;
    }
  }
}
console.log(`${checked} figures checked, ${changed} cut above a printed answer${DRY ? " (dry run)" : ""}`);
