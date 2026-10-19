import { createFileRoute } from "@tanstack/react-router";

import type { Lang } from "@/lib/catalog";
import { buildTracks } from "@/lib/tracks";
import type { NoteContent } from "@/lib/types";

const BUCKET = "note-audio";
const SIGNED_SECONDS = 60 * 60 * 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Send PCM to the browser in ~0.4s blocks. */
const FLUSH_BYTES = 24000 * 2 * 0.4;

/**
 * Returns `{ url }` JSON when the part is already stored. Otherwise streams
 * NDJSON: `{t:"a",d:<base64 pcm>}` blocks while speaking, then
 * `{t:"done",url}` once the audio is saved (or `{t:"error"}`).
 */
export const Route = createFileRoute("/api/audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonError, ndjsonStream } = await import("@/lib/server/ndjson.server");
        const { isVoice } = await import("@/lib/server/tts.server");
        let body: { noteId?: unknown; track?: unknown; voice?: unknown };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid request");
        }
        const noteId =
          typeof body.noteId === "string" && UUID.test(body.noteId) ? body.noteId : null;
        const trackIndex =
          typeof body.track === "number" && Number.isInteger(body.track) ? body.track : -1;
        if (!noteId || trackIndex < 0 || !isVoice(body.voice))
          return jsonError(400, "Invalid request");
        const voice = body.voice;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const sign = async (path: string) => {
          const { data, error } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(path, SIGNED_SECONDS);
          if (error || !data) throw error ?? new Error("sign failed");
          return data.signedUrl;
        };

        const [cached, note] = await Promise.all([
          supabaseAdmin
            .from("note_audio")
            .select("storage_path")
            .eq("note_id", noteId)
            .eq("track_index", trackIndex)
            .eq("voice", voice)
            .maybeSingle(),
          supabaseAdmin
            .from("notes")
            .select("id, language, content")
            .eq("id", noteId)
            .maybeSingle(),
        ]);
        if (cached.data) {
          try {
            return Response.json({ url: await sign(cached.data.storage_path) });
          } catch (error) {
            console.error("sign cached audio failed", error);
          }
        }

        if (!note.data) return jsonError(404, "Notes nahi mile");
        const tracks = buildTracks(
          note.data.content as unknown as NoteContent,
          note.data.language as Lang,
        );
        const track = tracks[trackIndex];
        if (!track) return jsonError(404, "Ye audio part nahi mila");

        const { consumeRateLimit } = await import("@/lib/server/rate-limit.server");
        if (!(await consumeRateLimit(supabaseAdmin, request, "audio"))) {
          return jsonError(
            429,
            "Is ghante ki audio limit poori ho gayi. Tab tak phone ki awaaz use karein.",
          );
        }

        const { streamTrack, buildWav, bytesToB64 } = await import("@/lib/server/tts.server");
        const { toGatewayError, friendlyMessage } = await import("@/lib/server/ai.server");

        return ndjsonStream(async (send) => {
          let pending: Uint8Array[] = [];
          let pendingBytes = 0;
          const flush = () => {
            if (!pendingBytes) return;
            const block = new Uint8Array(pendingBytes);
            let o = 0;
            for (const p of pending) {
              block.set(p, o);
              o += p.byteLength;
            }
            pending = [];
            pendingBytes = 0;
            send({ t: "a", d: bytesToB64(block) });
          };
          try {
            const pcm = await streamTrack(track.text, voice, (chunk) => {
              pending.push(chunk);
              pendingBytes += chunk.byteLength;
              if (pendingBytes >= FLUSH_BYTES) flush();
            });
            flush();
            const path = `${noteId}/${voice}/${trackIndex}.wav`;
            const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buildWav(pcm), {
              contentType: "audio/wav",
              upsert: true,
              cacheControl: "31536000",
            });
            if (up.error) throw up.error;
            await supabaseAdmin
              .from("note_audio")
              .upsert(
                { note_id: noteId, track_index: trackIndex, voice, storage_path: path },
                { onConflict: "note_id,track_index,voice", ignoreDuplicates: true },
              );
            send({ t: "done", url: await sign(path) });
          } catch (error) {
            const err = toGatewayError(error);
            console.error("audio generation failed", err.status, err.message);
            send({ t: "error", status: err.status, message: friendlyMessage(err, "audio") });
          }
        });
      },
    },
  },
});
