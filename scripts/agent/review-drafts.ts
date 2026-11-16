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
import { evidenceCoverage, missingAnchors as findMissing, scriptShare, sourceProof } from "./review-gates.ts";

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


type Result = { proof?: string; task: number; id: string; checkId?: string; chapter: string; lang: string; ok: boolean; flags: string[]; missingAnchors: string[] };
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
  let ctx: Awaited<ReturnType<typeof loadChapterContext>> | null = null;
  try {
    ctx = await loadChapterContext(admin, { board: d.board as BoardId, grade: d.grade, subject, chapter: d.chapter });
  } catch {
    flags.push("chapter-not-in-list");
  }
  const { data: srcRows } = await admin.from("chapter_sources").select("body").eq("board", d.board).eq("grade", d.grade)
    .eq("subject", subject.slug).eq("chapter_slug", d.chapter).order("body_chars", { ascending: false }).limit(1);
  const source = (srcRows?.[0]?.body as string | undefined) ?? "";
  if (!source) flags.push("no-stored-text");

  const pair = checks.get(row.task) ?? [];
  const check = pair.find((c) => {
    const p = submissionSchema.safeParse(c.payload);
    return p.success && p.data.kind === "check" && p.data.noteSha256 === sha256(row.raw_json ?? "");
  });
  let proof = "";
  if (!check) flags.push(pair.length ? "check-not-for-these-bytes" : "no-check");
  else {
    const p = submissionSchema.parse(check.payload);
    if (p.kind === "check") {
      if (p.verdict !== "pass") flags.push("check-says-changes");
      const cov = evidenceCoverage(p.checks, source);
      const sp = sourceProof(d.source.sha256, sha256(source), cov);
      proof = sp.how + (cov.missing.length ? `; not found: ${cov.missing.slice(0, 4).join(" | ")}` : "");
      if (!sp.ok) flags.push("source-not-proven");
    }
  }

  const content = normalizeNote(d.content as never, ctx?.chapterTitle ?? d.content.title);
  if (content.keyPoints.length === 0) flags.push("empty-after-normalize");

  const share = scriptShare(d.content);
  const bookIsEnglish = d.subject === "english";
  if (d.language === "hi" && share.devanagari < (bookIsEnglish ? 0.35 : 0.6)) flags.push(`hindi-share-${Math.round(100 * share.devanagari)}%`);
  if (d.language === "en" && share.latin < (bookIsEnglish ? 0.8 : 0.5)) flags.push(`english-share-${Math.round(100 * share.latin)}%`);

  for (const [i, m] of d.content.mcqs.entries()) {
    if (new Set(m.options.map((o) => o.trim().toLowerCase())).size !== 4) flags.push(`mcq${i + 1}-duplicate-options`);
  }
  const missingAnchors = findMissing(d.content, source);

  const lines = [
    `TASK ${row.task}  ${d.board} ${d.grade} ${d.subject} ${d.chapter} (${d.language})  title=${d.content.title}`,
    `FLAGS: ${flags.join(", ") || "none"}`,
    `SOURCE: ${proof}`,
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
  writeFileSync(`${OUT}/${row.task}.source.txt`, source);
  results.push({ task: row.task, id: row.id, checkId: check?.id, chapter: `${d.subject}/${d.chapter}`, lang: d.language, ok: flags.length === 0, flags, missingAnchors, proof });
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.task}\t${r.ok ? "ok " : "FLAG"}\t${r.lang}\t${r.chapter}\t${r.flags.join(",")}\tanchors-missing=${r.missingAnchors.length}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} pass the automatic gates; pending checks without a write: ${[...checks.keys()].filter((t) => !results.some((r) => r.task === t)).join(",") || "none"}`);
