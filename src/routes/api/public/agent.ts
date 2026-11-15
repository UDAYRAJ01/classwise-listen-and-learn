import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const FixInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(10000).default(""),
  patch: z.string().min(10).max(500_000),
});

const GUIDE = {
  about: "PadhoSuno agent API. Read code, submit code fixes or writing/checking drafts for review. No automatic import.",
  rules: "Read AGENTS.md (root) and sub-folder AGENTS.md first. One fix per submission. Paths relative to project root (git diff a/ b/ format).",
  endpoints: {
    "GET ?action=files": "list all files (path, size)",
    "GET ?action=file&path=src/lib/text.ts": "file content",
    "GET ?action=search&q=word": "files containing text (max 50)",
    "GET ?action=fixes": "your submitted fixes and their status",
    "POST {title, description, patch}": "submit one fix",
    "POST ?action=submit": "send the exact write/check JSON file bytes as application/json, no wrapper; returns id, sha256, pending status. Same bytes return the existing receipt.",
    "GET ?action=submissions&task=1": "list writing/checking receipts and review status (optional task filter)",
    "GET ?action=submission&id=<uuid>": "retrieve original draft JSON bytes; hash stays unchanged",
    "GET ?action=tasks&status=open&limit=25": "the writing to-do list (optional board, grade, subject, language filters)",
    "GET ?action=task&id=12": "one task's full material: textbook text + hash, style samples, teacher instructions",
    "POST ?action=claim&id=12": "take one open task so nobody else writes the same chapter",
  },
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const Route = createFileRoute("/api/public/agent")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { agentAuthorized, safeCodePath } = await import("@/lib/server/agent-auth.server");
        if (!agentAuthorized(request)) return json(401, { error: "Invalid key. Send Authorization: Bearer <key> or x-agent-key: <key>." });
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "guide";
        const admin = await db();
        if (action === "submissions") {
          const taskParam = url.searchParams.get("task");
          const task = taskParam === null ? undefined : Number(taskParam);
          if (task !== undefined && (!Number.isSafeInteger(task) || task < 1)) return json(400, { error: "Invalid task" });
          let query = admin.from("agent_content_submissions").select("id, kind, task, sha256, status, review_note, created_at, reviewed_at").order("created_at", { ascending: false }).limit(100);
          if (task !== undefined) query = query.eq("task", task);
          const { data, error } = await query;
          return error ? json(500, { error: error.message }) : json(200, { submissions: data });
        }
        if (action === "submission") {
          const id = z.string().uuid().safeParse(url.searchParams.get("id"));
          if (!id.success) return json(400, { error: "Invalid submission id" });
          const { data, error } = await admin.from("agent_content_submissions").select("raw_json").eq("id", id.data).maybeSingle();
          if (error) return json(500, { error: error.message });
          return data ? new Response(data.raw_json, { headers: { "content-type": "application/json", "cache-control": "no-store" } }) : json(404, { error: "Not found" });
        }
        if (action === "files") {
          const { data, error } = await admin.from("agent_code_files").select("path, size, updated_at").order("path");
          if (error) return json(500, { error: error.message });
          return json(200, { files: data });
        }
        if (action === "file") {
          const path = url.searchParams.get("path") ?? "";
          if (!safeCodePath(path)) return json(400, { error: "Bad path" });
          const { data } = await admin.from("agent_code_files").select("path, content, updated_at").eq("path", path).maybeSingle();
          return data ? json(200, data) : json(404, { error: "Not found" });
        }
        if (action === "search") {
          const q = (url.searchParams.get("q") ?? "").trim();
          if (q.length < 2 || q.length > 100) return json(400, { error: "q must be 2-100 chars" });
          const { data, error } = await admin.from("agent_code_files").select("path").ilike("content", `%${q.replace(/[%_]/g, "\\$&")}%`).limit(50);
          if (error) return json(500, { error: error.message });
          return json(200, { paths: data.map((r) => r.path) });
        }
        if (action === "fixes") {
          const { data, error } = await admin.from("agent_fixes").select("id, title, status, review_note, created_at, reviewed_at").order("created_at", { ascending: false }).limit(100);
          if (error) return json(500, { error: error.message });
          return json(200, { fixes: data });
        }
        if (action === "tasks") {
          const status = url.searchParams.get("status") ?? "open";
          if (!["open", "blocked", "claimed", "applied"].includes(status)) return json(400, { error: "status must be open, blocked, claimed or applied" });
          const limitRaw = Number(url.searchParams.get("limit") ?? 25);
          const limit = Number.isSafeInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100 ? limitRaw : 25;
          let query = admin
            .from("agent_tasks")
            .select("id, board, grade, subject, chapter_slug, chapter_title, book_name, language, has_source, source_url, source_chars, status")
            .eq("status", status)
            .order("board")
            .order("grade")
            .order("subject")
            .order("chapter_slug")
            .order("language")
            .limit(limit);
          const board = url.searchParams.get("board");
          if (board) query = query.eq("board", board);
          const grade = url.searchParams.get("grade");
          if (grade) {
            const g = Number(grade);
            if (!Number.isSafeInteger(g) || g < 1 || g > 12) return json(400, { error: "grade must be 1-12" });
            query = query.eq("grade", g);
          }
          const subject = url.searchParams.get("subject");
          if (subject) query = query.eq("subject", subject);
          const language = url.searchParams.get("language");
          if (language) {
            if (!["hinglish", "hi", "en"].includes(language)) return json(400, { error: "language must be hinglish, hi or en" });
            query = query.eq("language", language);
          }
          const { data, error } = await query;
          if (error) return json(500, { error: error.message });
          const { count } = await admin
            .from("agent_tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", status)
            .eq(board ? "board" : "id", board ?? "00000000-0000-0000-0000-000000000000");
          return json(200, { status, total: count ?? data.length, tasks: data });
        }
        if (action === "task") {
          const idRaw = url.searchParams.get("id");
          const id = Number(idRaw);
          if (!idRaw || !Number.isSafeInteger(id) || id < 1) return json(400, { error: "id must be a task number" });
          const { data: row, error } = await admin.from("agent_tasks").select("*").eq("id", id).maybeSingle();
          if (error) return json(500, { error: error.message });
          if (!row) return json(404, { error: "No such task" });
          if (!row.has_source) return json(409, { error: "This chapter has no stored textbook text, so it cannot be written from source", status: row.status });
          const { data: sourceRows, error: sourceError } = await admin
            .from("chapter_sources")
            .select("body, source_url, body_chars")
            .eq("board", row.board)
            .eq("grade", row.grade)
            .eq("subject", row.subject)
            .eq("chapter_slug", row.chapter_slug)
            .order("body_chars", { ascending: false })
            .limit(1);
          if (sourceError) return json(500, { error: sourceError.message });
          const source = sourceRows?.[0];
          if (!source?.body) return json(409, { error: "Textbook text row disappeared; re-run scripts/agent/tasks.ts" });
          const { createHash } = await import("node:crypto");
          const sha256 = createHash("sha256").update(source.body).digest("hex");
          const { getSubject, SUBJECTS } = await import("@/lib/catalog");
          const subject = getSubject(row.board as "cbse" | "icse", row.grade, row.subject) ?? SUBJECTS[row.subject] ?? { slug: row.subject, name: row.subject, hi: "", icon: "", tone: "ink" };
          const { agentWriterInstructions } = await import("@/lib/server/prompts.server");
          const instructions = agentWriterInstructions({
            board: row.board as "cbse" | "icse",
            grade: row.grade,
            subject,
            chapterTitle: row.chapter_title,
            bookName: row.book_name,
            gist: null,
            lang: row.language as "hinglish" | "hi" | "en",
            source: source.body,
          });
          const { data: openReports } = await admin.from("note_reports").select("chapter_slug, language").eq("status", "open");
          const reported = new Set((openReports ?? []).map((r) => `${r.chapter_slug}|${r.language}`));
          /** Closest style first: same class+subject, then same class, then anything checked. */
          const pools = [
            { board: row.board, grade: row.grade, subject: row.subject },
            { board: row.board, grade: row.grade },
            { board: row.board },
          ];
          const seen = new Set<string>();
          const scored: { score: number; sample: Record<string, unknown> }[] = [];
          for (const [poolIndex, filter] of pools.entries()) {
            if (scored.length >= 3) break;
            let query = admin
              .from("notes")
              .select("board, grade, subject, chapter_slug, chapter_title, book_name, language, content, created_at, note_checks(issues, checked_at)")
              .eq("is_custom", false)
              .neq("chapter_slug", row.chapter_slug)
              .limit(60);
            for (const [column, value] of Object.entries(filter)) query = query.eq(column, value);
            const { data: pool, error: poolError } = await query;
            if (poolError) return json(500, { error: poolError.message });
            for (const note of pool ?? []) {
              const identityKey = `${note.chapter_slug}|${note.language}`;
              if (seen.has(identityKey)) continue;
              seen.add(identityKey);
              const check = Array.isArray(note.note_checks) ? note.note_checks[0] : note.note_checks;
              if (!check || !Array.isArray(check.issues) || check.issues.length > 0) continue;
              if (!check.checked_at || new Date(check.checked_at).getTime() <= new Date(note.created_at).getTime()) continue;
              if (reported.has(identityKey)) continue;
              scored.push({
                score: poolIndex,
                sample: {
                  chapter: note.chapter_slug,
                  title: note.chapter_title,
                  book: note.book_name,
                  language: note.language,
                  reviewStatus: "stored-textbook-check-pass-not-human-approved",
                  checkedAt: check.checked_at,
                  content: note.content,
                },
              });
            }
          }
          scored.sort((a, b) => a.score - b.score);
          const samples = scored.slice(0, 3).map((s) => s.sample);
          return json(200, {
            task: row.id,
            status: row.status,
            identity: {
              board: row.board,
              grade: row.grade,
              subject: row.subject,
              chapter: row.chapter_slug,
              title: row.chapter_title,
              book: row.book_name,
              language: row.language,
            },
            source: {
              reference: source.source_url ?? row.source_url,
              sha256,
              characters: source.body.length,
              text: source.body,
              provenance: "Exact UTF-8 body stored by this app from the official textbook PDF. Hash these exact bytes. Layout noise and damaged Devanagari matras are possible; the printed PDF stays the authority for images and page numbers.",
            },
            samples,
            instructions,
            submit: {
              url: "https://classwise-listen-and-learn.lovable.app/api/public/agent?action=submit",
              headers: { Authorization: "Bearer <key>", "Content-Type": "application/json" },
              note: `Send the writing JSON and the checking JSON as two separate POSTs of the exact file bytes, each with "task": ${row.id}. The check must carry the writing file's byte hash as noteSha256.`,
            },
          });
        }
        return json(200, GUIDE);
      },
      POST: async ({ request }) => {
        const { agentAuthorized } = await import("@/lib/server/agent-auth.server");
        if (!agentAuthorized(request)) return json(401, { error: "Invalid key. Send Authorization: Bearer <key> or x-agent-key: <key>." });
        if (new URL(request.url).searchParams.get("action") === "claim") {
          const idRaw = new URL(request.url).searchParams.get("id");
          const id = Number(idRaw);
          if (!idRaw || !Number.isSafeInteger(id) || id < 1) return json(400, { error: "id must be a task number" });
          const admin = await db();
          const { data, error } = await admin
            .from("agent_tasks")
            .update({ status: "claimed", claimed_at: new Date().toISOString() })
            .eq("id", id)
            .eq("status", "open")
            .select("id, status, claimed_at");
          if (error) return json(500, { error: error.message });
          if (data?.length) return json(200, { claimed: data[0] });
          const { data: now } = await admin.from("agent_tasks").select("id, status").eq("id", id).maybeSingle();
          return now ? json(409, { error: `Task ${id} is ${now.status}, not open` }) : json(404, { error: "No such task" });
        }
        if (new URL(request.url).searchParams.get("action") === "submit") {
          const { parseContentSubmission } = await import("@/lib/agent-submissions");
          const { createHash } = await import("node:crypto");
          const raw = await request.text();
          let draft;
          try { draft = parseContentSubmission(raw); } catch (error) {
            return json(400, { error: error instanceof Error ? error.message : "Invalid draft" });
          }
          const hash = createHash("sha256").update(raw).digest("hex");
          const admin = await db();
          const existing = await admin.from("agent_content_submissions").select("id, sha256, status").eq("sha256", hash).maybeSingle();
          if (existing.error) return json(500, { error: existing.error.message });
          if (existing.data) return json(200, { ...existing.data, duplicate: true });
          const { count, error: countError } = await admin.from("agent_content_submissions").select("id", { count: "exact", head: true }).eq("status", "pending");
          if (countError) return json(500, { error: countError.message });
          if ((count ?? 0) >= 200) return json(429, { error: "Inbox full; wait for review" });
          const { data, error } = await admin.from("agent_content_submissions").insert({ kind: draft.kind, task: draft.task, payload: draft, raw_json: raw, sha256: hash }).select("id, sha256, status").single();
          if (error?.code === "23505") {
            const retry = await admin.from("agent_content_submissions").select("id, sha256, status").eq("sha256", hash).single();
            if (retry.data) return json(200, { ...retry.data, duplicate: true });
          }
          if (error) return json(500, { error: error.message });
          return json(201, data);
        }
        let body: unknown;
        try { body = await request.json(); } catch { return json(400, { error: "Invalid JSON" }); }
        const parsed = FixInput.safeParse(body);
        if (!parsed.success) return json(400, { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        const files = [...parsed.data.patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
        if (!files.length) return json(400, { error: "Patch must be a unified diff with +++ b/<path> lines" });
        const admin = await db();
        const { count } = await admin.from("agent_fixes").select("id", { count: "exact", head: true }).eq("status", "pending");
        if ((count ?? 0) >= 200) return json(429, { error: "Inbox full; wait for review" });
        const { data, error } = await admin.from("agent_fixes").insert({ ...parsed.data, files }).select("id").single();
        if (error) return json(500, { error: error.message });
        return json(201, { id: data.id, status: "pending", files });
      },
    },
  },
});
