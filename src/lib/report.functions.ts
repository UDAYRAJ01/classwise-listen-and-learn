import { createServerFn } from "@tanstack/react-start";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lets a student flag a wrong fact in a note. Rate-limited per visitor. */
export const reportMistake = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const i = input as { noteId?: unknown; section?: unknown; message?: unknown };
    const noteId = typeof i?.noteId === "string" && UUID.test(i.noteId) ? i.noteId : null;
    const message = typeof i?.message === "string" ? i.message.replace(/\s+/g, " ").trim() : "";
    const section = typeof i?.section === "string" ? i.section.slice(0, 40) : null;
    if (!noteId || message.length < 3 || message.length > 600)
      throw new Error("Galti ke baare mein 3–600 letters mein likhein.");
    return { noteId, message, section };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!(await consumeRateLimit(supabaseAdmin, request, "report"))) {
      throw new Error("Bahut saari reports ho gayi. Thodi der baad try karein.");
    }
    const note = await supabaseAdmin
      .from("notes")
      .select("board, grade, subject, chapter_slug, chapter_title, language")
      .eq("id", data.noteId)
      .maybeSingle();
    if (!note.data) throw new Error("Ye notes nahi mile.");
    const { error } = await supabaseAdmin.from("note_reports").insert({
      note_id: data.noteId,
      section: data.section,
      message: data.message,
      ...note.data,
    });
    if (error) throw new Error("Report save nahi hui. Dobara try karein.");
    return { ok: true };
  });
