/** Resumable original-paper ingestion. Run: bun scripts/government/import.ts --only=upsc-cse-prelims-2018-gs */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { askJson, pool, args } from "../exam/lib";
import { validatePaperQuestions, type ExtractedQuestion } from "./validation";

interface Spec { slug: string; category: string; exam: string; jurisdiction: string; stage: string; section: string; year: number; label: string; source_url: string; source_kind: string; key_source: string; expected_questions: number }
const specs: Spec[] = JSON.parse(readFileSync(new URL("./papers.json", import.meta.url), "utf8"));
const ROOT = "/tmp/government", ONLY = args.get("only"), WORKERS = Number(args.get("workers") ?? 3);
const itemSchema = { type: "object", additionalProperties: false, properties: {
  number: { type: "integer" }, page: { type: "integer" }, body: { type: "string" }, options: { type: "array", items: { type: "string" } },
  kind: { type: "string", enum: ["single", "multiple", "numeric", "descriptive"] }, section: { type: "string" }, topic: { type: "string" }, concept: { type: "string" },
}, required: ["number", "page", "body", "options", "kind", "section", "topic", "concept"] };
const schema = { type: "object", additionalProperties: false, properties: { questions: { type: "array", items: itemSchema } }, required: ["questions"] };
async function ingest(p: Spec) {
  const saved = await admin.from("gov_exam_papers").select("id,status").eq("slug", p.slug).maybeSingle();
  if (saved.error) throw saved.error;
  if (saved.data?.status === "ready") { console.log(p.slug, "already checked"); return; }
  const dir = `${ROOT}/${p.slug}`; mkdirSync(dir, { recursive: true });
  const pdf = `${dir}/paper.pdf`;
  if (!existsSync(pdf)) {
    const response = await fetch(p.source_url); const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.subarray(0,5).toString() !== "%PDF-") throw new Error(`${p.slug}: PDF unavailable`);
    writeFileSync(pdf, bytes);
  }
  const checksum = createHash("sha256").update(readFileSync(pdf)).digest("hex");
  const put = await admin.from("gov_exam_papers").upsert({ ...p, checksum, status: "extracting" }, { onConflict: "slug" }).select("id").single();
  if (put.error || !put.data) throw new Error(put.error?.message ?? "Paper save failed");
  const paperId = put.data.id;
  const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  const pages = Number(/Pages:\s*(\d+)/.exec(info)?.[1]);
  if (!pages) throw new Error("No PDF pages");
  const all: ExtractedQuestion[] = [];
  await pool(Array.from({ length: pages }, (_, i) => i + 1), WORKERS, async (page) => {
    const cache = `${dir}/${page}.review.json`;
    if (existsSync(cache)) { all.push(...JSON.parse(readFileSync(cache, "utf8"))); return; }
    const image = `${dir}/${page}.png`;
    if (!existsSync(image)) execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-scale-to", "1800", "-png", "-singlefile", pdf, `${dir}/${page}`]);
    const bytes = new Uint8Array(readFileSync(image));
    const instructions = `Transcribe ONLY English questions from this official ${p.label} page ${page}. Hindi duplicates and instruction pages must produce an empty questions array. Preserve EVERY statement, table, passage, option and number; do not solve or invent. Include question numbers printed on the page, not your own numbering. No answer hints. kind single unless paper specifies otherwise. section must be '${p.section}'. Classify topic using a stable compact topic name: Polity, History, Geography, Economy, Environment, Science & Technology, Current Affairs, Reading Comprehension, Quantitative Aptitude, Reasoning. concept specific but compact. Output page=${page}. If question continues onto another page retain exact visible text and mark [CONTINUED]; never invent missing text.`;
    const first = await askJson<{ questions: ExtractedQuestion[] }>({ instructions, text: `Read PDF page ${page}.`, images: [bytes], schema, effort: "low" });
    const checked = await askJson<{ questions: ExtractedQuestion[] }>({
      instructions: `${instructions} You are an independent transcription reviewer. Compare the candidate to the original image character by character. Correct omissions, wrong numbers, options, assertions and passage text. Add omitted English questions. Remove Hindi duplicates. Return the full corrected transcription, not a summary. Never approve a cut-off question by filling in guessed words.`,
      text: `Candidate: ${JSON.stringify(first)}`, images: [bytes], schema, effort: "medium",
    });
    writeFileSync(cache, JSON.stringify(checked.questions)); all.push(...checked.questions);
    console.log(p.slug, `page ${page}/${pages}`, `${checked.questions.length} questions reviewed`);
  });
  const qs = validatePaperQuestions(all, p.expected_questions);
  const existing = await admin.from("gov_exam_questions").select("id,number,body,options").eq("paper_id", paperId);
  if (existing.error) throw existing.error;
  const old = new Map((existing.data ?? []).map((q) => [q.number, q]));
  for (const q of qs) {
    const before = old.get(q.number);
    const changed = before && (before.body !== q.body || JSON.stringify(before.options) !== JSON.stringify(q.options));
    const r = await admin.from("gov_exam_questions").upsert({ ...q, paper_id: paperId, reviewed: true, ...(changed ? { solution: null, solution_ok: false, answer: null } : {}) }, { onConflict: "paper_id,number" });
    if (r.error) throw r.error;
  }
  const finish = await admin.from("gov_exam_papers").update({ status: "ready" }).eq("id", paperId);
  if (finish.error) throw finish.error;
  console.log(p.slug, "READY", qs.length);
}
for (const p of specs.filter((s) => !ONLY || s.slug === ONLY)) {
  try { await ingest(p); } catch (error) {
    console.error(p.slug, (error as Error).message);
    await admin.from("gov_exam_papers").update({ status: "review" }).eq("slug", p.slug);
    if ((error as Error).name === "StopRun") throw error;
  }
}