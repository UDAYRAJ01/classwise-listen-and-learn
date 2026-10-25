/**
 * Offline run: make and store the narration for every chapter ahead of time, so students
 * never wait for the voice. Each audio part is stored exactly like a first listen in the app
 * would store it (note-audio bucket + note_audio row), so the app just plays it.
 *
 *   WORKERS=6 bun scripts/audio-batch.ts                    # Didi voice, Hinglish notes
 *   bun scripts/audio-batch.ts --voice=bhaiya --lang=hindi
 *   bun scripts/audio-batch.ts --board=cbse --grades=9-12 --loop
 *   bun scripts/audio-batch.ts --skip=12/hindi/b1-c1,11/hindi/b2-c4   # notes about to change
 *
 * Only notes that passed the textbook check (check newer than the notes) get audio, so voice
 * is never made for notes that are still being rewritten. With --loop the run keeps looking
 * for newly finished notes. Progress lives in the database; the run can be restarted any time.
 */
import { supabaseAdmin as admin } from "@/integrations/supabase/client.server";
import { isLang, type Lang } from "@/lib/catalog";
import { buildWav, isVoice, streamTrack, type VoiceId } from "@/lib/server/tts.server";
import { buildTracks } from "@/lib/tracks";
import type { NoteContent } from "@/lib/types";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k ?? "", v ?? "true"] as const;
  }),
);
const VOICE = (args.get("voice") ?? "didi") as VoiceId;
const LANG = (args.get("lang") ?? "hinglish") as Lang;
if (!isVoice(VOICE) || !isLang(LANG)) throw new Error("bad --voice or --lang");
const ONLY_BOARD = args.get("board");
const [G_FROM, G_TO] = (args.get("grades") ?? "1-12").split("-").map(Number);
const SKIP = new Set((args.get("skip") ?? "").split(",").filter(Boolean));
const LOOP = args.has("loop");
const WORKERS = Number(process.env["WORKERS"] ?? 6);
const BUCKET = "note-audio";
// Board-exam classes first, then the rest.
const GRADE_ORDER = [10, 12, 9, 11, 8, 7, 6, 5, 4, 3, 2, 1];

interface Job {
  noteId: string;
  label: string;
  index: number;
  text: string;
}

async function pageAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 500) {
    const r = await query(from, from + 499);
    if (r.error) throw r.error;
    out.push(...(r.data ?? []));
    if ((r.data ?? []).length < 500) return out;
  }
}

async function buildJobs(): Promise<{ jobs: Job[]; notes: number; waiting: number }> {
  const notes = await pageAll<{
    id: string;
    board: string;
    grade: number;
    subject: string;
    chapter_slug: string;
    created_at: string;
  }>((from, to) =>
    admin
      .from("notes")
      .select("id, board, grade, subject, chapter_slug, created_at")
      .eq("language", LANG)
      .eq("is_custom", false)
      .order("id")
      .range(from, to),
  );
  const checks = new Map(
    (
      await pageAll<{ note_id: string; checked_at: string }>((from, to) =>
        admin.from("note_checks").select("note_id, checked_at").order("note_id").range(from, to),
      )
    ).map((c) => [c.note_id, c.checked_at]),
  );
  const have = new Map<string, Set<number>>();
  for (const a of await pageAll<{ note_id: string; track_index: number }>((from, to) =>
    admin
      .from("note_audio")
      .select("note_id, track_index")
      .eq("voice", VOICE)
      .order("note_id")
      .order("track_index")
      .range(from, to),
  )) {
    if (!have.has(a.note_id)) have.set(a.note_id, new Set());
    have.get(a.note_id)!.add(a.track_index);
  }

  const ready = notes
    .filter(
      (n) =>
        (!ONLY_BOARD || n.board === ONLY_BOARD) &&
        n.grade >= (G_FROM ?? 1) &&
        n.grade <= (G_TO ?? 12) &&
        !SKIP.has(`${n.grade}/${n.subject}/${n.chapter_slug}`),
    )
    .sort(
      (a, b) =>
        (a.board === b.board ? 0 : a.board === "cbse" ? -1 : 1) ||
        GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade) ||
        a.subject.localeCompare(b.subject) ||
        a.chapter_slug.localeCompare(b.chapter_slug, undefined, { numeric: true }),
    );

  const jobs: Job[] = [];
  let waiting = 0;
  let count = 0;
  for (const n of ready) {
    const checked = checks.get(n.id);
    if (!checked || checked < n.created_at) {
      waiting++;
      continue;
    }
    const done = have.get(n.id) ?? new Set<number>();
    // Content is read only for notes that still miss audio (it is large).
    if (done.size > 0 && done.size >= 8) {
      // Cheap pre-check failed to prove completeness; fall through to an exact count below.
    }
    const full = await admin.from("notes").select("content").eq("id", n.id).maybeSingle();
    if (!full.data) continue;
    const tracks = buildTracks(full.data.content as unknown as NoteContent, LANG);
    const label = `${n.board}/${n.grade}/${n.subject}/${n.chapter_slug}`;
    let missing = 0;
    for (const t of tracks) {
      if (done.has(t.index)) continue;
      missing++;
      jobs.push({ noteId: n.id, label, index: t.index, text: t.text });
    }
    if (missing) count++;
  }
  return { jobs, notes: count, waiting };
}

let stopAll = false;
const stats = { made: 0, failed: 0, gone: 0, seconds: 0 };

async function makeOne(job: Job) {
  const pcm = await streamTrack(job.text, VOICE, () => {});
  // The notes may have been rewritten meanwhile; never store audio for notes that are gone.
  const still = await admin.from("notes").select("id").eq("id", job.noteId).maybeSingle();
  if (!still.data) {
    stats.gone++;
    return;
  }
  const path = `${job.noteId}/${VOICE}/${job.index}.wav`;
  const up = await admin.storage.from(BUCKET).upload(path, buildWav(pcm), {
    contentType: "audio/wav",
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) throw up.error;
  const row = await admin
    .from("note_audio")
    .upsert(
      { note_id: job.noteId, track_index: job.index, voice: VOICE, storage_path: path },
      { onConflict: "note_id,track_index,voice", ignoreDuplicates: true },
    );
  if (row.error) {
    await admin.storage.from(BUCKET).remove([path]);
    throw row.error;
  }
  stats.made++;
  stats.seconds += pcm.byteLength / 2 / 24000;
}

async function worker(queue: Job[]) {
  while (!stopAll) {
    const job = queue.shift();
    if (!job) return;
    for (let attempt = 1; attempt <= 4 && !stopAll; attempt++) {
      try {
        await makeOne(job);
        break;
      } catch (error) {
        const e = error as { status?: number; message?: string };
        if (e.status === 402) {
          console.error("AI credits are used up — stopping.");
          stopAll = true;
          return;
        }
        if (attempt === 4) {
          stats.failed++;
          console.error(`${job.label} #${job.index} failed:`, e.status ?? "", e.message);
          break;
        }
        await new Promise((r) => setTimeout(r, (e.status === 429 ? 60_000 : 8_000) * attempt));
      }
    }
  }
}

async function main() {
  for (;;) {
    const { jobs, notes, waiting } = await buildJobs();
    console.log(
      `${new Date().toISOString()} · ${jobs.length} audio parts for ${notes} chapters · ` +
        `${waiting} chapters still being checked · voice ${VOICE} · ${WORKERS} workers`,
    );
    if (jobs.length) {
      const queue = [...jobs];
      const timer = setInterval(() => {
        const hours = (stats.seconds / 3600).toFixed(1);
        console.log(`… ${queue.length} left · ${JSON.stringify(stats)} · ${hours} h of audio`);
      }, 120_000);
      await Promise.all(Array.from({ length: WORKERS }, () => worker(queue)));
      clearInterval(timer);
    }
    if (stopAll || !LOOP) break;
    await new Promise((r) => setTimeout(r, 5 * 60_000));
  }
  console.log("finished", JSON.stringify(stats));
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
