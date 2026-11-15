/**
 * Imports one approved writing draft into the app.
 *   bun scripts/agent/import-draft.ts --id=<submission uuid> [--reviewed="what the owner checked"]
 *
 * The draft must already be in `agent_content_submissions` (the writer sends it
 * through the key-protected inbox). This script only accepts what it can prove:
 * a paired check draft must exist for these exact bytes and say pass; the draft must
 * be built on the textbook text we store (exact hash, or the checker's cited book
 * lines found in our copy — the writer keeps its own cleaned copy of the PDF text),
 * or the owner passes --reviewed after reading it against the book; and the content
 * has to pass the app's own note normalizer. Nothing is generated here.
 *
 * After a successful import the submission row and the matching queue row are
 * marked `applied`, so the writer's to-do list shrinks by exactly one chapter.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject, isBoard, isLang, type BoardId, type Lang } from "@/lib/catalog";
import { sha256 } from "./submission-schema.ts";
import { evidenceCoverage, sourceProof } from "./review-gates.ts";
import { submissionSchema } from "@/lib/agent-submissions";
import { loadChapterContext, saveNote } from "@/lib/server/note-pipeline.server";
import { normalizeNote } from "@/lib/server/normalize.server";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k ?? "", v ?? ""] as const;
  }),
);
const id = args.get("id") ?? "";
const reviewed = (args.get("reviewed") ?? "").trim();
if (!id) throw new Error("usage: bun scripts/agent/import-draft.ts --id=<submission uuid>");

const { data: row, error: rowError } = await admin
  .from("agent_content_submissions")
  .select("id, kind, task, sha256, status, payload, raw_json")
  .eq("id", id)
  .maybeSingle();
if (rowError) throw rowError;
if (!row) throw new Error(`no submission with id ${id}`);
if (row.kind !== "write") throw new Error(`submission ${id} is a ${row.kind} draft; only writing drafts are imported`);
if (row.status === "applied") {
  console.log("already applied:", id);
  process.exit(0);
}

const parsed = submissionSchema.safeParse(row.payload);
if (!parsed.success) throw new Error(`draft fails the submission schema: ${JSON.stringify(parsed.error.issues).slice(0, 400)}`);
const draft = parsed.data;
// The stored sha256 covers the writer's exact bytes; JSONB re-serialization loses
// key order and spacing, so the real integrity check is the source hash below.

const board = draft.board;
const grade = draft.grade;
const language = draft.language as Lang;
if (!isBoard(board) || !isLang(language)) throw new Error("draft identity is not a known board/language");
const subject = getSubject(board as BoardId, grade, draft.subject);
if (!subject) throw new Error(`subject ${draft.subject} is not offered for ${board} class ${grade}`);

const where = { board: board as BoardId, grade, subject, chapter: draft.chapter };
const ctx = await loadChapterContext(admin, where);

const { data: srcRows, error: srcError } = await admin
  .from("chapter_sources")
  .select("body")
  .eq("board", board)
  .eq("grade", grade)
  .eq("subject", subject.slug)
  .eq("chapter_slug", draft.chapter)
  .order("body_chars", { ascending: false })
  .limit(1);
if (srcError) throw srcError;
const source = (srcRows?.[0]?.body as string | undefined) ?? "";
if (!source) throw new Error("this chapter has no stored textbook text, so nothing can be verified against it");

// The paired check must cover these exact bytes and pass.
const { data: checkRows, error: checkError } = await admin
  .from("agent_content_submissions")
  .select("id, payload, status")
  .eq("kind", "check")
  .eq("task", row.task);
if (checkError) throw checkError;
const check = (checkRows ?? [])
  .map((c) => ({ id: c.id as string, parsed: submissionSchema.safeParse(c.payload) }))
  .find((c) => c.parsed.success && c.parsed.data.kind === "check" && c.parsed.data.noteSha256 === sha256(row.raw_json ?? ""));
if (!check || !check.parsed.success || check.parsed.data.kind !== "check") throw new Error("no check draft covers these exact bytes");
if (check.parsed.data.verdict !== "pass") throw new Error("the check draft asks for changes");

const proof = sourceProof(draft.source.sha256, sha256(source), evidenceCoverage(check.parsed.data.checks, source));
if (!proof.ok && !reviewed) throw new Error(`source not proven (${proof.how}); read it against the book and pass --reviewed="..."`);
const reviewNote = `imported by owner script; source: ${proof.how}${reviewed ? `; owner review: ${reviewed}` : ""}`;

const content = normalizeNote(draft.content as never, ctx.chapterTitle);
if (content.keyPoints.length === 0) throw new Error("normalized notes came back empty");

const saved = await saveNote(admin, ctx, language, content);
console.log(`saved note ${saved.id} for ${board} ${grade} ${subject.slug} ${draft.chapter} (${language})`);

const now = new Date().toISOString();
const { error: markError } = await admin
  .from("agent_content_submissions")
  .update({ status: "applied", reviewed_at: now, review_note: reviewNote })
  .in("id", [id, check.id]);
if (markError) throw markError;

const { error: queueError } = await admin
  .from("agent_tasks")
  .update({ status: "applied", applied_at: now })
  .eq("board", board)
  .eq("grade", grade)
  .eq("subject", subject.slug)
  .eq("chapter_slug", draft.chapter)
  .eq("language", language);
if (queueError) throw queueError;

const { count } = await admin
  .from("agent_tasks")
  .select("id", { count: "exact", head: true })
  .eq("board", board)
  .eq("grade", grade)
  .eq("subject", subject.slug)
  .eq("chapter_slug", draft.chapter)
  .eq("language", language)
  .eq("status", "applied");
console.log(`queue row marked applied (${count ?? 0})`);
