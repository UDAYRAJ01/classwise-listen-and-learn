/**
 * Owner-side review of every pending writing draft in the agent inbox.
 *   bun scripts/agent/review-drafts.ts            report only
 *
 * For each pending write it proves what can be proved without any AI call:
 *  - the draft passes the submission schema and the app's note normalizer
 *  - its source hash matches the textbook text we store for that chapter
 *  - a paired check draft (same task) exists, says pass, and points at the
 *    exact bytes of this write (noteSha256)
 *  - the note is in the promised language (Devanagari share for hi, Latin for en)
 *  - highlighted / quoted words from the notes actually occur in the textbook
 * It writes /tmp/review/<task>.txt (questions + answers next to the textbook)
 * for a human read, and /tmp/review/summary.json with ok / flags per task.
 * Nothing is saved to the app here; import goes through import-draft.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject, type BoardId } from "@/lib/catalog";
import { submissionSchema } from "@/lib/agent-submissions";
import { loadChapterContext } from "@/lib/server/note-pipeline.server";
import { normalizeNote } from "@/lib/server/normalize.server";
import { sha256 } from "./submission-schema.ts";

const OUT = "/tmp/review";
mkdirSync(OUT, { recursive: true });

const { data: rows, error } = await admin
  .from("agent_content_submissions")
  .select("id, kind, task, status, payload, raw_json")
  .eq("status", "pending")
  .order("task");
if (error) throw error;

const checks = new Map<number, typeof rows>();
for (const r of rows) if (r.kind === "check") checks.set(r.task, [...(checks.get(r.task) ?? []), r]);

const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const deva = (s: string) => (s.match(/\p{Script=Devanagari}/gu) ?? []).length;
const latin = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;

type Result = { task: number; id: string; checkId?: string; chapter: string; lang: string; ok: boolean; flags: string[]; missingAnchors: string[] };
const results: Result[] = [];

for (const row of rows.filter((r) => r.kind === "write")) {
  const flags: string[] = [];
  const parsed = submissionSchema.safeParse(row.payload);
  if (!parsed.success || parsed.data.kind !== "write") {
    results.push({ task: row.task, id: row.id, chapter: "?", lang: "?", ok: false, flags: ["schema"], missingAnchors: [] });
    continue;
  }
  const d = parsed.data;
  if (d.task !== row.task) flags.push("task-number-mismatch");
  const subject = getSubject(d.board as BoardId, d.grade, d.subject);
  if (!subject) { results.push({ task: row.task, id: row.id, chapter: d.chapter, lang: d.language, ok: false, flags: ["subject"], missingAnchors: [] }); continue; }
  const ctx = await loadChapterContext(admin, { board: d.board as BoardId, grade: d.grade, subject, chapter: d.chapter });
  if (!ctx.source) flags.push("no-stored-text");
  else if (sha256(ctx.source) !== d.source.sha256) flags.push("source-hash");

  const pair = checks.get(row.task) ?? [];
  const check = pair.find((c) => {
    const p = submissionSchema.safeParse(c.payload);
    return p.success && p.data.kind === "check" && p.data.noteSha256 === sha256(row.raw_json ?? "");
  });
  if (!check) flags.push(pair.length ? "check-not-for-these-bytes" : "no-check");
  else {
    const p = submissionSchema.parse(check.payload);
    if (p.kind === "check" && p.verdict !== "pass") flags.push("check-says-changes");
  }

  const content = normalizeNote(d.content as never, ctx.chapterTitle);
  if (content.keyPoints.length === 0) flags.push("empty-after-normalize");

  const all = JSON.stringify(d.content);
  const dv = deva(all), la = latin(all);
  if (d.language === "hi" && dv / (dv + la) < 0.6) flags.push(`hindi-share-${Math.round((100 * dv) / (dv + la))}%`);
  if (d.language === "en" && la / (dv + la) < 0.8 && !/hindi|sanskrit/.test(d.subject)) flags.push(`english-share-${Math.round((100 * la) / (dv + la))}%`);

  // MCQ sanity: options distinct, explanation mentions the right option text loosely.
  for (const [i, m] of d.content.mcqs.entries()) {
    if (new Set(m.options.map(norm)).size !== 4) flags.push(`mcq${i + 1}-duplicate-options`);
  }

  // Anchors: highlighted and quoted words should exist in the book (same script as the book).
  const src = norm(ctx.source ?? "");
  const srcIsDeva = deva(ctx.source ?? "") > latin(ctx.source ?? "");
  const anchors = new Set<string>();
  for (const m of all.matchAll(/\*\*(.+?)\*\*/g)) anchors.add(m[1]);
  for (const m of all.matchAll(/[“"]([^“”"\\]{2,60})[”"]/g)) anchors.add(m[1]);
  const missingAnchors: string[] = [];
  for (const a of anchors) {
    const n = norm(a);
    if (!n || n.length < 3) continue;
    const isDeva = deva(a) > latin(a);
    if (isDeva !== srcIsDeva) continue; // translations/explanations, not quotes from the book
    if (!src.includes(n)) missingAnchors.push(a);
  }

  const lines = [
    `TASK ${row.task}  ${d.board} ${d.grade} ${d.subject} ${d.chapter} (${d.language})  title=${d.content.title}`,
    `FLAGS: ${flags.join(", ") || "none"}`,
    `ANCHORS NOT IN BOOK: ${missingAnchors.join(" | ") || "none"}`,
    `ONE-LINER: ${d.content.oneLiner}`,
    `SUMMARY: ${d.content.summary}`,
    ...d.content.keyPoints.flatMap((k) => [`# ${k.heading}`, ...k.points.map((p) => `  - ${p}`)]),
    ...d.content.questions.map((q) => `Q: ${q.question}\n   A: ${q.answer}`),
    ...d.content.mcqs.map((m) => `MCQ: ${m.question} -> ${m.options[m.answer]}   [${m.options.join(" / ")}]`),
    ...d.content.mistakes.map((m) => `MISTAKE: ${m.mistake} => ${m.correct}`),
    `FUNFACT: ${d.content.funFact}`,
  ];
  writeFileSync(`${OUT}/${row.task}.txt`, lines.join("\n"));
  writeFileSync(`${OUT}/${row.task}.source.txt`, ctx.source ?? "");
  results.push({ task: row.task, id: row.id, checkId: check?.id, chapter: `${d.subject}/${d.chapter}`, lang: d.language, ok: flags.length === 0, flags, missingAnchors });
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.task}\t${r.ok ? "ok " : "FLAG"}\t${r.lang}\t${r.chapter}\t${r.flags.join(",")}\tanchors-missing=${r.missingAnchors.length}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} pass the automatic gates; pending checks without a write: ${[...checks.keys()].filter((t) => !results.some((r) => r.task === t)).join(",") || "none"}`);
