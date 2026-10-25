import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportStatus = "open" | "resolved" | "dismissed";

export interface AdminReport {
  id: string;
  noteId: string | null;
  board: string | null;
  grade: number | null;
  subject: string | null;
  chapterSlug: string | null;
  chapterTitle: string | null;
  language: string | null;
  section: string | null;
  message: string;
  status: ReportStatus;
  correction: string | null;
  createdAt: string;
  resolvedAt: string | null;
  appliedAt: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertAdmin(ctx: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  const sb = ctx.supabase as unknown as import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Ye page sirf owner ke liye hai.");
}

/** Is the signed-in user the owner? */
export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const s = (input as { status?: unknown })?.status;
    return { status: s === "resolved" || s === "dismissed" ? s : ("open" as ReportStatus) };
  })
  .handler(async ({ data, context }): Promise<AdminReport[]> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("note_reports")
      .select("*")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Reports load nahi hui.");
    return (rows ?? []).map((r) => ({
      id: r.id,
      noteId: r.note_id,
      board: r.board,
      grade: r.grade,
      subject: r.subject,
      chapterSlug: r.chapter_slug,
      chapterTitle: r.chapter_title,
      language: r.language,
      section: r.section,
      message: r.message,
      status: r.status as ReportStatus,
      correction: r.correction,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      appliedAt: r.applied_at,
    }));
  });

export const reportCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<ReportStatus, number> = { open: 0, resolved: 0, dismissed: 0 };
    for (const s of ["open", "resolved", "dismissed"] as const) {
      const { count } = await supabaseAdmin
        .from("note_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      out[s] = count ?? 0;
    }
    return out;
  });

/** Save the owner's correction (or dismiss the report). */
export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const i = input as { id?: unknown; status?: unknown; correction?: unknown };
    if (typeof i?.id !== "string" || !UUID.test(i.id)) throw new Error("Invalid report");
    const status =
      i.status === "dismissed" ? "dismissed" : i.status === "open" ? "open" : "resolved";
    const correction =
      typeof i.correction === "string"
        ? i.correction.replace(/\s+/g, " ").trim().slice(0, 1000)
        : "";
    if (status === "resolved" && correction.length < 3)
      throw new Error("Sahi jaankari kam se kam 3 letters mein likhein.");
    return { id: i.id, status, correction: correction || null };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("note_reports")
      .update({
        status: data.status,
        correction: data.status === "resolved" ? data.correction : null,
        resolved_at: data.status === "open" ? null : new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error("Save nahi hua. Dobara try karein.");
    return { ok: true };
  });

/**
 * Throws away the cached notes (all languages) and their audio for one chapter, so the
 * next visit writes them again — this time with the owner's saved corrections.
 */
export const rebuildChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const i = input as { board?: unknown; grade?: unknown; subject?: unknown; chapter?: unknown };
    if (
      typeof i?.board !== "string" ||
      typeof i.grade !== "number" ||
      typeof i.subject !== "string" ||
      typeof i.chapter !== "string"
    )
      throw new Error("Invalid chapter");
    return { board: i.board, grade: i.grade, subject: i.subject, chapter: i.chapter };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { purgeNotes } = await import("@/lib/server/note-pipeline.server");
    const removed = await purgeNotes(supabaseAdmin, data);
    await supabaseAdmin
      .from("note_reports")
      .update({ applied_at: new Date().toISOString() })
      .eq("board", data.board)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .eq("chapter_slug", data.chapter)
      .eq("status", "resolved");
    return { removed };
  });

export interface CheckLeftover {
  noteId: string;
  board: string;
  grade: number;
  subject: string;
  chapterSlug: string;
  chapterTitle: string;
  language: string;
  checkedAt: string;
  issues: { section: string; kind: string; wrong: string; correct: string }[];
}

export interface CheckSummary {
  notes: number;
  checked: number;
  withTextbook: number;
  textbookFixes: number;
  leftovers: CheckLeftover[];
}

/** How far the chapter-by-chapter textbook check has got, and what it could not fix. */
export const checkSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckSummary> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const head = { count: "exact" as const, head: true };
    const [notes, checked, sources, fixes, left] = await Promise.all([
      supabaseAdmin.from("notes").select("id", head),
      supabaseAdmin.from("note_checks").select("note_id", head),
      supabaseAdmin.from("chapter_sources").select("chapter_slug", head),
      supabaseAdmin
        .from("note_reports")
        .select("id", head)
        .like("message", "[Textbook check%"),
      supabaseAdmin
        .from("note_checks")
        .select(
          "note_id, checked_at, issues, notes(board, grade, subject, chapter_slug, chapter_title, language)",
        )
        .neq("issues", "[]")
        .order("checked_at", { ascending: false })
        .limit(100),
    ]);
    if (left.error) throw new Error("Check ki jaankari load nahi hui.");
    return {
      notes: notes.count ?? 0,
      checked: checked.count ?? 0,
      withTextbook: sources.count ?? 0,
      textbookFixes: fixes.count ?? 0,
      leftovers: (left.data ?? []).flatMap((r) => {
        const n = r.notes as unknown as {
          board: string;
          grade: number;
          subject: string;
          chapter_slug: string;
          chapter_title: string;
          language: string;
        } | null;
        if (!n) return [];
        return [
          {
            noteId: r.note_id,
            board: n.board,
            grade: n.grade,
            subject: n.subject,
            chapterSlug: n.chapter_slug,
            chapterTitle: n.chapter_title,
            language: n.language,
            checkedAt: r.checked_at,
            issues: (Array.isArray(r.issues) ? r.issues : []) as CheckLeftover["issues"],
          },
        ];
      }),
    };
  });
