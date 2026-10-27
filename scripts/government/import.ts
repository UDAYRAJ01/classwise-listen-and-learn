/** Resumable original-paper ingestion. Run: bun scripts/government/import.ts --only=upsc-cse-prelims-2018-gs */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { askJson, pool, args } from "../exam/lib";
import { validatePaperQuestions, type ExtractedQuestion } from "./validation";

interface Spec { slug: string; category: string; exam: string; jurisdiction: string; stage: string; section: string; year: number; label: string; source_url: string; source_kind: string; key_source: string; expected_questions: number }
const specs: Spec[] = JSON.parse(readFileSync(args.get("manifest") ?? new URL("./papers.json", import.meta.url), "utf8"));
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
    const images = [new Uint8Array(readFileSync(image))];
    for (const neighbor of [page-1,page+1].filter(n=>n>=1&&n<=pages)) {
      const path=`${dir}/context-${neighbor}.png`;
      if(!existsSync(path)) execFileSync("pdftoppm",["-f",String(neighbor),"-l",String(neighbor),"-scale-to","1800","-png","-singlefile",pdf,`${dir}/context-${neighbor}`]);
      images.push(new Uint8Array(readFileSync(path)));
    }
    const instructions = `Transcribe ONLY English questions whose printed question number STARTS on the FIRST image (official ${p.label} page ${page}). Remaining images show neighboring pages (${[page-1,page+1].filter(n=>n>=1&&n<=pages).join(",")}) ONLY to recover continuation or shared passages for first-image questions; never output questions starting on those images. Hindi duplicates and instruction pages produce an empty array. Preserve EVERY statement, table, passage, option and number; do not solve or invent. Include printed numbers. No answer hints. kind single unless specified otherwise. section must be '${p.section}'. Classify into compact stable subject-appropriate topics (e.g. Polity, History, Geography, Economy, Environment, Science & Technology, Current Affairs, Reading Comprehension, Arithmetic, Algebra, Geometry, Reasoning, Pedagogy, Law). concept specific but compact. Output page=${page}. If continuation is not fully visible mark [CONTINUED]; never invent missing text.`;
    const first = await askJson<{ questions: ExtractedQuestion[] }>({ instructions, text: `Read PDF page ${page}, neighbors are context only.`, images, schema, effort: "low" });
    const checked = await askJson<{ questions: ExtractedQuestion[] }>({
      instructions: `${instructions} You are an independent transcription reviewer. Compare the candidate to the original image character by character. Correct omissions, wrong numbers, options, assertions and passage text. Add omitted English questions. Remove Hindi duplicates. Return the full corrected transcription, not a summary. Never approve a cut-off question by filling in guessed words.`,
      text: `Candidate: ${JSON.stringify(first)}`, images, schema, effort: "medium",
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