/**
 * Review the agent's submitted fixes.
 *   bun scripts/agent/inbox.ts                 list pending
 *   bun scripts/agent/inbox.ts show <id>       print patch to /tmp/agent-fix-<id>.patch
 *   bun scripts/agent/inbox.ts mark <id> applied|rejected "note"
 */
import { writeFileSync } from "node:fs";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";

const args = process.argv.slice(2);
const contentInbox = args[0] === "content";
const [cmd, id, status, note] = contentInbox ? args.slice(1) : args;
if (contentInbox) {
  if (!cmd) {
    const { data, error } = await admin.from("agent_content_submissions").select("id, task, kind, sha256, created_at").eq("status", "pending").order("created_at");
    if (error) throw error;
    for (const draft of data) console.log(`${draft.id} task=${draft.task} ${draft.kind} sha256=${draft.sha256}`);
    console.log(`${data.length} pending content drafts`);
  } else if (cmd === "show" && id) {
    const { data, error } = await admin.from("agent_content_submissions").select("raw_json, task, kind").eq("id", id).single();
    if (error) throw error;
    const path = `/tmp/agent-content-${id}.json`;
    writeFileSync(path, data.raw_json);
    console.log(`Task ${data.task} ${data.kind} -> ${path}`);
  } else if (cmd === "mark" && id && (status === "applied" || status === "rejected")) {
    const { error } = await admin.from("agent_content_submissions").update({ status, review_note: note ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    console.log("ok");
  } else throw new Error('Use: inbox.ts content [show <id> | mark <id> applied|rejected "note"]');
} else if (!cmd) {
  const { data, error } = await admin.from("agent_fixes").select("id, title, files, created_at").eq("status", "pending").order("created_at");
  if (error) throw error;
  for (const f of data) console.log(`${f.id}  ${f.title}  [${f.files.join(", ")}]`);
  console.log(`${data.length} pending`);
} else if (cmd === "show") {
  const { data, error } = await admin.from("agent_fixes").select("*").eq("id", id).single();
  if (error) throw error;
  const path = `/tmp/agent-fix-${id}.patch`;
  writeFileSync(path, data.patch);
  console.log(`# ${data.title}\n${data.description}\n-> ${path}`);
} else if (cmd === "mark" && (status === "applied" || status === "rejected")) {
  const { error } = await admin.from("agent_fixes").update({ status, review_note: note ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  console.log("ok");
} else console.log("unknown command");
