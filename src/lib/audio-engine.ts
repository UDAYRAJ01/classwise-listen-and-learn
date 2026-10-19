// Browser audio engine for AI narration.
// - Audio "jobs" fetch one spoken part: a stored file URL, or a live PCM stream
//   that is saved on the server and turns into a URL when finished.
// - PcmPlayer plays a job while it is still streaming (fast first play).

export const PCM_RATE = 24000;

export interface AudioJob {
  key: string;
  status: "loading" | "streaming" | "done" | "error";
  url: string | null;
  chunks: Int16Array[];
  samples: number;
  error: { status: number; message: string } | null;
  players: number;
  listeners: Set<() => void>;
}

const jobs = new Map<string, AudioJob>();

function notify(job: AudioJob) {
  job.listeners.forEach((l) => l());
}

function b64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const len = bin.length - (bin.length % 2);
  const out = new Int16Array(len / 2);
  for (let i = 0, j = 0; i < len; i += 2, j++) {
    const v = bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8);
    out[j] = v >= 0x8000 ? v - 0x10000 : v;
  }
  return out;
}

function fail(job: AudioJob, status: number, message: string) {
  job.status = "error";
  job.error = { status, message };
  notify(job);
}

async function runJob(job: AudioJob, body: { noteId: string; voice: string; track: number }) {
  let res: Response;
  try {
    res = await fetch("/api/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    fail(job, 0, "Internet connection check karein.");
    return;
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("application/json")) {
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && json.url) {
      job.url = json.url;
      job.status = "done";
      notify(job);
    } else fail(job, res.status, json.error ?? "Audio load nahi hua.");
    return;
  }
  if (!res.body) {
    fail(job, 502, "Audio load nahi hua.");
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let e: {
      t?: string;
      type?: string;
      d?: string;
      url?: string;
      status?: number;
      message?: string;
    };
    try {
      e = JSON.parse(line);
    } catch {
      return;
    }
    if (e.t === "a" && e.d) {
      const pcm = b64ToInt16(e.d);
      job.chunks.push(pcm);
      job.samples += pcm.length;
      job.status = "streaming";
      notify(job);
    } else if (e.t === "done" && e.url) {
      finished = true;
      job.url = e.url;
      job.status = "done";
      notify(job);
      if (job.players === 0) job.chunks = [];
    } else if (e.t === "error" || e.type === "error") {
      finished = true;
      fail(job, e.status ?? 500, e.message ?? "Audio load nahi hua.");
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handle(buffer);
  } catch {
    if (!finished) fail(job, 0, "Audio beech mein ruk gaya. Dobara play karein.");
    return;
  }
  if (!finished) fail(job, 499, "Audio beech mein ruk gaya. Dobara play karein.");
}

/** Returns the job for a part, starting (or restarting a failed) download. */
export function getAudioJob(noteId: string, voice: string, track: number): AudioJob {
  const key = `${noteId}:${voice}:${track}`;
  const existing = jobs.get(key);
  if (existing && existing.status !== "error") return existing;
  const job: AudioJob = {
    key,
    status: "loading",
    url: null,
    chunks: [],
    samples: 0,
    error: null,
    players: 0,
    listeners: existing?.listeners ?? new Set(),
  };
  jobs.set(key, job);
  void runJob(job, { noteId, voice, track });
  return job;
}

export function subscribeAudioJob(job: AudioJob, fn: () => void) {
  job.listeners.add(fn);
  return () => job.listeners.delete(fn);
}

let ctx: AudioContext | null = null;

/** Must be called from a user gesture the first time (autoplay rules). */
export function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === "closed") ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Plays a (possibly still streaming) job through Web Audio. */
export class PcmPlayer {
  private sources = new Set<AudioBufferSourceNode>();
  private scheduled = 0;
  private playhead = 0;
  private startedAt = -1;
  private scheduledSeconds = 0;
  private unsubscribe: (() => void) | null = null;
  private stopped = false;
  private endedFired = false;

  constructor(
    private context: AudioContext,
    private job: AudioJob,
    private rate: number,
    private onEnded: () => void,
    private onError: (e: { status: number; message: string }) => void,
  ) {}

  start() {
    this.job.players++;
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
    this.pump();
    this.unsubscribe = subscribeAudioJob(this.job, () => this.pump());
  }

  private pump() {
    if (this.stopped) return;
    while (this.scheduled < this.job.chunks.length) {
      const pcm = this.job.chunks[this.scheduled++]!;
      const buffer = this.context.createBuffer(1, pcm.length, PCM_RATE);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) data[i] = pcm[i]! / 32768;
      const src = this.context.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = this.rate;
      src.connect(this.context.destination);
      const now = this.context.currentTime;
      this.playhead = Math.max(this.playhead, now + 0.06);
      if (this.startedAt < 0) this.startedAt = this.playhead;
      src.start(this.playhead);
      const dur = buffer.duration / this.rate;
      this.playhead += dur;
      this.scheduledSeconds += dur;
      this.sources.add(src);
      src.onended = () => {
        this.sources.delete(src);
        this.checkEnd();
      };
    }
    if (this.job.status === "error" && this.sources.size === 0) {
      this.detach();
      if (this.job.error) this.onError(this.job.error);
    }
    this.checkEnd();
  }

  private checkEnd() {
    if (this.stopped || this.endedFired) return;
    if (
      this.job.status === "done" &&
      this.scheduled >= this.job.chunks.length &&
      this.sources.size === 0
    ) {
      this.endedFired = true;
      this.detach();
      this.onEnded();
    }
  }

  /** 0..1 progress through the part (estimate while still streaming). */
  progress(): number {
    if (this.startedAt < 0) return 0;
    const played = Math.max(0, this.context.currentTime - this.startedAt);
    const total =
      this.job.status === "done"
        ? this.job.samples / PCM_RATE / this.rate
        : Math.max(this.scheduledSeconds, played + 1);
    return total > 0 ? Math.min(played / total, 1) : 0;
  }

  pause() {
    void this.context.suspend().catch(() => {});
  }

  resume() {
    void this.context.resume().catch(() => {});
  }

  private detach() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.job.players > 0) this.job.players--;
    if (this.job.players === 0 && this.job.status === "done") this.job.chunks = [];
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const s of this.sources) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    this.detach();
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
  }
}

/** Drops a finished job (e.g. its link expired) so the next request refetches. */
export function forgetAudioJob(key: string) {
  const job = jobs.get(key);
  if (job && job.players === 0) jobs.delete(key);
}
