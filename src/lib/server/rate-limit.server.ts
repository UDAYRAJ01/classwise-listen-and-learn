import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type GenerationKind = "syllabus" | "notes" | "audio" | "report";

/** Max fresh AI generations per visitor per hour. Cached content never counts. */
export const HOURLY_LIMITS: Record<GenerationKind, number> = {
  syllabus: 40,
  notes: 25,
  audio: 250,
  report: 15,
};

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Returns true (and records the event) when the visitor is under the limit. */
export async function consumeRateLimit(
  admin: SupabaseClient<Database>,
  request: Request,
  kind: GenerationKind,
): Promise<boolean> {
  const ipHash = await sha256(`padhosuno:${clientIp(request)}`);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("generation_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) {
    console.error("rate limit lookup failed", error.message);
    return true;
  }
  if ((count ?? 0) >= HOURLY_LIMITS[kind]) return false;
  const { error: insertError } = await admin
    .from("generation_events")
    .insert({ ip_hash: ipHash, kind });
  if (insertError) console.error("rate limit insert failed", insertError.message);
  return true;
}
