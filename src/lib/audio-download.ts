// Saves a whole chapter's AI narration as one WAV file the student can keep on the device
// and play offline in any music player. Parts come from the same audio jobs the player
// uses, so already-made parts are just downloaded and nothing is generated twice.
import { useSyncExternalStore } from "react";

import { forgetAudioJob, getAudioJob, PCM_RATE, subscribeAudioJob, type AudioJob } from "@/lib/audio-engine";
import type { Track } from "@/lib/tracks";

export interface DownloadState {
  /** Which chapter + voice this state belongs to. */
  key: string | null;
  status: "idle" | "working" | "done" | "error";
  done: number;
  total: number;
  /** Size of the saved file (bytes), once done. */
  bytes: number;
  message: string | null;
}

const IDLE: DownloadState = {
  key: null,
  status: "idle",
  done: 0,
  total: 0,
  bytes: 0,
  message: null,
};

let state: DownloadState = IDLE;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<DownloadState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useAudioDownload(): DownloadState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}

/** Silence between two parts, so the file sounds like the player. */
export const GAP_SECONDS = 0.5;
const PARALLEL = 3;

class DownloadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Reads the 16-bit mono PCM samples out of a WAV file. */
export function pcmFromWav(buf: ArrayBuffer): Int16Array {
  const v = new DataView(buf);
  const tag = (o: number) =>
    String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (buf.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new DownloadError(0, "Audio file sahi nahi mili.");
  }
  let o = 12;
  let rate = PCM_RATE;
  let bits = 16;
  let channels = 1;
  while (o + 8 <= buf.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === "fmt ") {
      channels = v.getUint16(body + 2, true);
      rate = v.getUint32(body + 4, true);
      bits = v.getUint16(body + 14, true);
    } else if (id === "data") {
      if (bits !== 16 || channels !== 1 || rate !== PCM_RATE) {
        throw new DownloadError(0, "Audio file ka format alag hai.");
      }
      const len = Math.min(size, buf.byteLength - body) >> 1;
      // Copy so the samples sit on an aligned buffer of their own.
      return new Int16Array(buf.slice(body, body + len * 2));
    }
    o = body + size + (size % 2);
  }
  throw new DownloadError(0, "Audio file mein awaaz nahi mili.");
}

/** One WAV file: every part in order with a short silence between them. */
export function joinToWav(parts: Int16Array[], gapSamples = Math.round(PCM_RATE * GAP_SECONDS)): Blob {
  const gap = new Int16Array(gapSamples);
  const samples = parts.reduce((n, p) => n + p.length, 0) + gapSamples * Math.max(0, parts.length - 1);
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, PCM_RATE, true);
  v.setUint32(28, PCM_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, samples * 2, true);
  const pieces: BlobPart[] = [header];
  parts.forEach((p, i) => {
    if (i > 0 && gapSamples > 0) pieces.push(gap);
    pieces.push(p as Int16Array<ArrayBuffer>);
  });
  return new Blob(pieces, { type: "audio/wav" });
}

/** Safe file name for phones and laptops (keeps Hindi letters). */
export function audioFileName(title: string, voice: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const who = voice === "bhaiya" ? "Bhaiya" : "Didi";
  return `PadhoSuno - ${clean || "Chapter"} (${who}).wav`;
}

function waitForUrl(job: AudioJob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (signal.aborted) {
        stop();
        reject(new DOMException("aborted", "AbortError"));
      } else if (job.url) {
        stop();
        resolve(job.url);
      } else if (job.status === "error") {
        stop();
        reject(new DownloadError(job.error?.status ?? 0, job.error?.message ?? "Audio nahi bana."));
      }
    };
    const unsub = subscribeAudioJob(job, check);
    const onAbort = () => check();
    signal.addEventListener("abort", onAbort);
    const stop = () => {
      unsub();
      signal.removeEventListener("abort", onAbort);
    };
    check();
  });
}

async function fetchPart(
  noteId: string,
  voice: string,
  track: number,
  signal: AbortSignal,
): Promise<Int16Array> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const job = getAudioJob(noteId, voice, track);
    const url = await waitForUrl(job, signal);
    const res = await fetch(url, { signal });
    if (res.ok) return pcmFromWav(await res.arrayBuffer());
    // The stored link may have expired: forget it and ask for a fresh one.
    forgetAudioJob(job.key);
  }
  throw new DownloadError(0, "Audio file download nahi hui.");
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadKey(noteId: string, voice: string) {
  return `${noteId}:${voice}`;
}

/** Fetches every part (making missing ones), joins them and saves one file. */
export async function downloadChapterAudio(opts: {
  noteId: string;
  tracks: Track[];
  voice: string;
  fileName: string;
}): Promise<void> {
  if (state.status === "working") return;
  const { noteId, tracks, voice, fileName } = opts;
  const key = downloadKey(noteId, voice);
  const ctrl = new AbortController();
  controller = ctrl;
  update({ key, status: "working", done: 0, total: tracks.length, bytes: 0, message: null });

  const parts: Int16Array[] = new Array(tracks.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < tracks.length && !ctrl.signal.aborted) {
      const i = next++;
      const t = tracks[i]!;
      parts[i] = await fetchPart(t.noteId ?? noteId, voice, t.sourceIndex ?? i, ctrl.signal);
      done += 1;
      update({ done });
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL, tracks.length) }, worker));
    if (ctrl.signal.aborted) throw new DOMException("aborted", "AbortError");
    const blob = joinToWav(parts);
    saveBlob(blob, fileName);
    update({ status: "done", bytes: blob.size });
  } catch (error) {
    ctrl.abort();
    if ((error as DOMException)?.name === "AbortError") {
      update({ ...IDLE });
      return;
    }
    const status = error instanceof DownloadError ? error.status : 0;
    const message =
      status === 429
        ? "Is ghante ki audio limit poori ho gayi. Thodi der baad dobara download karein — jo parts ban chuke hain wo dobara nahi banenge."
        : error instanceof DownloadError
          ? error.message
          : "Download ruk gaya. Internet check karke dobara try karein.";
    update({ status: "error", message });
  } finally {
    if (controller === ctrl) controller = null;
  }
}

export function cancelAudioDownload() {
  controller?.abort();
}
