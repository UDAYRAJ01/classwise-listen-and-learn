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
  about: "PadhoSuno code review API. Read code, then submit fixes as unified diffs.",
  rules: "Read AGENTS.md (root) and sub-folder AGENTS.md first. One fix per submission. Paths relative to project root (git diff a/ b/ format).",
  endpoints: {
    "GET ?action=files": "list all files (path, size)",
    "GET ?action=file&path=src/lib/text.ts": "file content",
    "GET ?action=search&q=word": "files containing text (max 50)",
    "GET ?action=fixes": "your submitted fixes and their status",
    "POST {title, description, patch}": "submit one fix",
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
        if (!agentAuthorized(request)) return json(401, { error: "Invalid key" });
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "guide";
        const admin = await db();
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
        return json(200, GUIDE);
      },
      POST: async ({ request }) => {
        const { agentAuthorized } = await import("@/lib/server/agent-auth.server");
        if (!agentAuthorized(request)) return json(401, { error: "Invalid key" });
        let body: unknown;
        try { body = await request.json(); } catch { return json(400, { error: "Invalid JSON" }); }
        const parsed = FixInput.safeParse(body);
        if (!parsed.success) return json(400, { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        const files = [...parsed.data.patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1].trim());
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
