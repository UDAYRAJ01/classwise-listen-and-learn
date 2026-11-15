/**
 * Imports one approved writing draft into the app.
 *   bun scripts/agent/import-draft.ts --id=<submission uuid>
 *
 * The draft must already be in `agent_content_submissions` (the writer sends it
 * through the key-protected inbox). This script only accepts what it can prove:
 * the draft's own source hash has to match the textbook text we store, and the
 * content has to pass the app's own note normalizer. Nothing is generated here.
 *
 * After a successful import the submission row and the matching queue row are
 * marked `applied`, so the writer's to-do list shrinks by exactly one chapter.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { getSubject, isBoard, isLang, type BoardId, type Lang } from "@/lib/catalog";
import { sha256 } from "./submission-schema.ts";
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
if (!id) throw new Error("usage: bun scripts/agent/import-draft.ts --id=<submission uuid>");

const { data: row, error: rowError } = await admin
  .from("agent_content_submissions")
  .select("id, kind, task, sha256, status, payload")
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

// The writer swears it wrote from this exact text; refuse if our copy differs.
if (!ctx.source) throw new Error("this chapter has no stored textbook text, so nothing can be verified against it");
const storedHash = sha256(ctx.source);
if (storedHash !== draft.source.sha256) {
  throw new Error(`source hash mismatch: draft says ${draft.source.sha256}, stored text is ${storedHash}`);
}

const content = normalizeNote(draft.content as never, ctx.chapterTitle);
if (content.keyPoints.length === 0) throw new Error("normalized notes came back empty");

const saved = await saveNote(admin, ctx, language, content);
console.log(`saved note ${saved.id} for ${board} ${grade} ${subject.slug} ${draft.chapter} (${language})`);

const now = new Date().toISOString();
const { error: markError } = await admin
  .from("agent_content_submissions")
  .update({ status: "applied", reviewed_at: now, review_note: "imported by owner script" })
  .eq("id", id);
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
