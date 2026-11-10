/**
 * Uploads the current source code so the external review agent can read it.
 *   bun scripts/agent/snapshot.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";

const ROOT = process.cwd();
const SKIP_DIR = new Set(["node_modules", ".git", "dist", ".output", ".wrangler", ".oj-cache", ".lovable", "public", ".tanstack"]);
const EXT = /\.(ts|tsx|js|mjs|cjs|css|json|md|sql|sh|toml|html)$/;

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name) || name.startsWith(".env")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.test(name) && st.size < 400_000 && !name.endsWith(".tsbuildinfo") && name !== "bun.lock") out.push(full);
  }
}

const files: string[] = [];
walk(ROOT, files);
const rows = files.map((f) => {
  const content = readFileSync(f, "utf8");
  return { path: relative(ROOT, f), content, size: content.length, updated_at: new Date().toISOString() };
});
for (let i = 0; i < rows.length; i += 50) {
  const { error } = await admin.from("agent_code_files").upsert(rows.slice(i, i + 50));
  if (error) throw error;
}
const keep = new Set(rows.map((r) => r.path));
const { data: old } = await admin.from("agent_code_files").select("path");
const gone = (old ?? []).map((r) => r.path).filter((p) => !keep.has(p));
if (gone.length) await admin.from("agent_code_files").delete().in("path", gone);
console.log(`uploaded ${rows.length} files, removed ${gone.length}`);
