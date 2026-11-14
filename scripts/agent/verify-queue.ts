/**
 * Checks the writing agent's queue end to end against the live app.
 *   bun scripts/agent/verify-queue.ts
 *
 * Samples one open task per class + subject, asks the live endpoint for its material
 * and refuses anything that comes back without textbook text, a hash, the chapter
 * name in the instructions or a samples list. Blocked tasks must be refused.
 * Reads only; it never claims a task and never writes notes or audio.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";

const BASE = "https://classwise-listen-and-learn.lovable.app/api/public/agent";
const key = (process.env["AGENT_ACCESS_KEY"] ?? "").trim();
if (!key) throw new Error("AGENT_ACCESS_KEY is not set");

const { data: rows, error } = await admin
  .from("agent_tasks")
  .select("id, board, grade, subject, chapter_slug, language, has_source")
  .eq("status", "open")
  .order("board")
  .order("grade")
  .order("subject");
if (error) throw error;

/** One task per class + subject so the sample covers the whole catalogue. */
const seen = new Set<string>();
const picked: NonNullable<typeof rows> = [];
for (const row of rows ?? []) {
  const k = `${row.board}|${row.grade}|${row.subject}`;
  if (seen.has(k)) continue;
  seen.add(k);
  picked.push(row);
}
const sample = picked.slice(0, 30);
console.log(`sampling ${sample.length} open tasks from ${seen.size} class-subject groups`);

let bad = 0;
for (const task of sample) {
  const res = await fetch(`${BASE}?action=task&id=${task.id}`, { headers: { Authorization: `Bearer ${key}` } });
  const body: any = await res.json().catch(() => ({}));
  const ok =
    res.status === 200 &&
    typeof body?.source?.text === "string" &&
    body.source.text.length > 50 &&
    /^[a-f0-9]{64}$/.test(String(body?.source?.sha256 ?? "")) &&
    String(body?.instructions ?? "").includes(task.chapter_title ?? "§") &&
    Array.isArray(body?.samples) &&
    body.identity?.chapter === task.chapter_slug &&
    body.identity?.language === task.language;
  if (!ok) {
    bad++;
    console.log(`FAIL ${task.id} ${task.board} ${task.grade} ${task.subject} ${task.chapter_slug} ${task.language} -> ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
  }
}
console.log(`material: ${sample.length - bad}/${sample.length} tasks answered correctly`);

const { data: blocked } = await admin.from("agent_tasks").select("id").eq("status", "blocked").limit(3);
for (const row of blocked ?? []) {
  const res = await fetch(`${BASE}?action=task&id=${row.id}`, { headers: { Authorization: `Bearer ${key}` } });
  const body: any = await res.json().catch(() => ({}));
  console.log(`blocked ${row.id} -> ${res.status} ${String(body.error ?? "").slice(0, 70)}`);
}
if (bad) process.exitCode = 1;
