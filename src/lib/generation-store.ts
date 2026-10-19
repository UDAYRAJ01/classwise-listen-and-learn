// Client-side registry of in-flight AI generations. A job is keyed by what it
// generates, so re-mounting a page (or StrictMode double effects) re-attaches
// to the same stream instead of paying for a second generation.

export type JobStatus = "running" | "done" | "error";

export interface JobState {
  status: JobStatus;
  partial: unknown;
  result: unknown;
  error: { status: number; message: string } | null;
}

const jobs = new Map<string, JobState>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function update(key: string, patch: Partial<JobState>) {
  const prev = jobs.get(key);
  if (!prev) return;
  jobs.set(key, { ...prev, ...patch });
  emit(key);
}

async function run(key: string, url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      let message = "Kuch gadbad ho gayi. Dobara try karein.";
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) message = j.error;
      } catch {
        // keep default message
      }
      update(key, { status: "error", error: { status: res.status, message } });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    const handle = (line: string) => {
      if (!line.trim()) return;
      let event: { type: string; data?: unknown; status?: number; message?: string };
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "partial") update(key, { partial: event.data ?? null });
      else if (event.type === "done") {
        finished = true;
        update(key, { status: "done", result: event.data ?? null });
      } else if (event.type === "error") {
        finished = true;
        update(key, {
          status: "error",
          error: { status: event.status ?? 500, message: event.message ?? "Kuch gadbad ho gayi." },
        });
      }
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handle(buffer);
    if (!finished) {
      update(key, {
        status: "error",
        error: { status: 499, message: "Connection beech mein toot gaya. Dobara try karein." },
      });
    }
  } catch {
    update(key, {
      status: "error",
      error: { status: 0, message: "Internet connection check karein aur dobara try karein." },
    });
  }
}

/** Starts a job unless one is already running/finished. `retry` restarts a failed job. */
export function startJob(key: string, url: string, body: unknown, { retry = false } = {}) {
  const existing = jobs.get(key);
  if (existing && (existing.status !== "error" || !retry)) return;
  jobs.set(key, { status: "running", partial: null, result: null, error: null });
  emit(key);
  void run(key, url, body);
}

export function subscribeJob(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function getJob(key: string): JobState | null {
  return jobs.get(key) ?? null;
}
