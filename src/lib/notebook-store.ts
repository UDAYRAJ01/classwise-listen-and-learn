// Per-device study memory: saved chapters, recently read, read / memorised
// chapters and listening preferences. Stored in the browser so no login is needed.

import { useSyncExternalStore } from "react";

import type { BoardId, Lang } from "./catalog";
import { nextRevision, type Revision } from "./exam";

export interface ChapterRef {
  board: BoardId;
  grade: number;
  subject: string;
  chapter: string;
  title: string;
  custom?: boolean;
  at: number;
}

export interface Prefs {
  lang: Lang | null;
  voice: "didi" | "bhaiya";
  rate: number;
  follow: boolean;
}

export interface NotebookState {
  saved: ChapterRef[];
  recent: ChapterRef[];
  /** Chapters the student marked "yaad ho gaya" (memorised). */
  done: string[];
  /** Chapters fully read: every part read or heard, or marked by hand. */
  read: string[];
  /** Parts already read of chapters that are not finished yet. */
  progress: Record<string, string[]>;
  /** Local dates (YYYY-MM-DD) on which a chapter was opened. */
  days: string[];
  /** JEE / NEET chapter revisions (spaced repetition), keyed by revisionKey(). */
  revisions: Record<string, Revision>;
  prefs: Prefs;
}

export type ChapterStatus = "done" | "read" | "started" | "new";

type RefKeyParts = Pick<ChapterRef, "board" | "grade" | "subject" | "chapter">;

const KEY = "padhosuno:v1";
const MAX_PROGRESS = 400;
const DEFAULT_PREFS: Prefs = { lang: null, voice: "didi", rate: 1, follow: true };
const EMPTY: NotebookState = {
  saved: [],
  recent: [],
  done: [],
  read: [],
  progress: {},
  days: [],
  revisions: {},
  prefs: DEFAULT_PREFS,
};

let state: NotebookState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? sanitize(JSON.parse(raw) as Partial<NotebookState>) : EMPTY;
  } catch {
    state = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      listeners.forEach((l) => l());
    }
  });
}

const commitHooks = new Set<(s: NotebookState) => void>();

/** Called after every local change (used by account sync). */
export function onNotebookCommit(fn: (s: NotebookState) => void) {
  commitHooks.add(fn);
  return () => commitHooks.delete(fn);
}

export function getNotebookState(): NotebookState {
  load();
  return state;
}

/** Replace the whole notebook (e.g. with the copy from the account). Does not fire commit hooks. */
export function replaceNotebook(next: Partial<NotebookState>) {
  load();
  writeLocal(sanitize(next));
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function sanitizeProgress(v: unknown, read: string[]): Record<string, string[]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const readSet = new Set(read);
  const out: Record<string, string[]> = {};
  for (const [k, parts] of Object.entries(v as Record<string, unknown>).slice(-MAX_PROGRESS)) {
    const list = strings(parts);
    if (!readSet.has(k) && list.length > 0) out[k] = [...new Set(list)];
  }
  return out;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeRevisions(v: unknown): Record<string, Revision> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, Revision> = {};
  for (const [k, r] of Object.entries(v as Record<string, Partial<Revision>>).slice(-MAX_PROGRESS)) {
    if (r && typeof r.n === "number" && r.n > 0 && DAY.test(String(r.last)) && DAY.test(String(r.next)))
      out[k] = { n: Math.floor(r.n), last: String(r.last), next: String(r.next) };
  }
  return out;
}

export function sanitize(p: Partial<NotebookState> | null | undefined): NotebookState {
  const read = strings(p?.read);
  return {
    saved: Array.isArray(p?.saved) ? p.saved : [],
    recent: Array.isArray(p?.recent) ? p.recent : [],
    done: strings(p?.done),
    read,
    progress: sanitizeProgress(p?.progress, read),
    days: strings(p?.days),
    revisions: sanitizeRevisions(p?.revisions),
    prefs: { ...DEFAULT_PREFS, ...(p?.prefs ?? {}) },
  };
}

/** Union of two notebooks: nothing saved on either side is lost. */
export function mergeNotebooks(a: NotebookState, b: NotebookState): NotebookState {
  const byKey = (lists: ChapterRef[][], max: number) => {
    const m = new Map<string, ChapterRef>();
    for (const r of lists.flat()) {
      const k = refKey(r);
      const prev = m.get(k);
      if (!prev || r.at > prev.at) m.set(k, r);
    }
    return [...m.values()].sort((x, y) => y.at - x.at).slice(0, max);
  };
  const read = [...new Set([...a.read, ...b.read])];
  const progress: Record<string, string[]> = {};
  for (const src of [b.progress, a.progress]) {
    for (const [k, parts] of Object.entries(src)) {
      progress[k] = [...new Set([...(progress[k] ?? []), ...parts])];
    }
  }
  return sanitize({
    saved: byKey([a.saved, b.saved], 200),
    recent: byKey([a.recent, b.recent], 12),
    done: [...new Set([...a.done, ...b.done])],
    read,
    progress,
    days: [...new Set([...a.days, ...b.days])].sort().slice(-120),
    // Per chapter, the side that has revised more (then the more recent) wins.
    revisions: Object.fromEntries(
      [...new Set([...Object.keys(a.revisions), ...Object.keys(b.revisions)])].map((k) => {
        const x = a.revisions[k];
        const y = b.revisions[k];
        const win = !x ? y! : !y ? x : y.n > x.n || (y.n === x.n && y.last > x.last) ? y : x;
        return [k, win];
      }),
    ),
    prefs: { ...b.prefs, ...a.prefs },
  });
}

function commit(next: NotebookState) {
  writeLocal(next);
  commitHooks.forEach((h) => h(next));
}

function writeLocal(next: NotebookState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked; keep in memory
  }
  listeners.forEach((l) => l());
}

export function localDay(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Consecutive study days ending today (or yesterday, so the streak survives until tonight). */
export function streakFrom(days: string[], today = new Date()): number {
  const set = new Set(days);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (set.has(localDay(cursor))) {
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export function refKey(r: RefKeyParts): string {
  return `${r.board}/${r.grade}/${r.subject}/${r.chapter}`;
}

/** Where a student stands with one chapter. Memorised beats read beats started. */
export function chapterStatus(
  s: Pick<NotebookState, "done" | "read" | "progress">,
  key: string,
): ChapterStatus {
  if (s.done.includes(key)) return "done";
  if (s.read.includes(key)) return "read";
  if ((s.progress[key]?.length ?? 0) > 0) return "started";
  return "new";
}

/** Share (0–1) of a chapter's parts already read. */
export function readShare(
  s: Pick<NotebookState, "done" | "read" | "progress">,
  key: string,
  totalParts: number,
): number {
  const st = chapterStatus(s, key);
  if (st === "done" || st === "read") return 1;
  if (totalParts <= 0) return 0;
  return Math.min(1, (s.progress[key]?.length ?? 0) / totalParts);
}

/** True once every required part has been read. */
export function allPartsRead(seen: readonly string[], required: readonly string[]): boolean {
  return required.length > 0 && required.every((id) => seen.includes(id));
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot() {
  load();
  return state;
}

export function useNotebook(): NotebookState {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

function withoutProgress(progress: Record<string, string[]>, key: string) {
  if (!(key in progress)) return progress;
  const next = { ...progress };
  delete next[key];
  return next;
}

export const notebook = {
  toggleSaved(ref: Omit<ChapterRef, "at">) {
    load();
    const k = refKey(ref);
    const exists = state.saved.some((s) => refKey(s) === k);
    commit({
      ...state,
      saved: exists
        ? state.saved.filter((s) => refKey(s) !== k)
        : [{ ...ref, at: Date.now() }, ...state.saved].slice(0, 200),
    });
    return !exists;
  },
  visit(ref: Omit<ChapterRef, "at">) {
    load();
    const k = refKey(ref);
    const today = localDay();
    commit({
      ...state,
      recent: [{ ...ref, at: Date.now() }, ...state.recent.filter((s) => refKey(s) !== k)].slice(
        0,
        12,
      ),
      days: state.days.includes(today) ? state.days : [...state.days, today].slice(-120),
    });
  },
  /** Memorised implies read, so marking "yaad ho gaya" also marks the chapter read. */
  toggleDone(ref: RefKeyParts) {
    load();
    const k = refKey(ref);
    const isDone = state.done.includes(k);
    commit({
      ...state,
      done: isDone ? state.done.filter((d) => d !== k) : [...state.done, k],
      read: isDone || state.read.includes(k) ? state.read : [...state.read, k],
      progress: isDone ? state.progress : withoutProgress(state.progress, k),
    });
    return !isDone;
  },
  /** Mark a chapter read / not read by hand. */
  setRead(ref: RefKeyParts, read: boolean) {
    load();
    const k = refKey(ref);
    const has = state.read.includes(k);
    if (read === has) return;
    commit({
      ...state,
      read: read ? [...state.read, k] : state.read.filter((r) => r !== k),
      done: read ? state.done : state.done.filter((d) => d !== k),
      progress: withoutProgress(state.progress, k),
    });
  },
  /**
   * Record parts the student has read or heard. When every required part is
   * covered the chapter becomes "read". Returns true only at that moment.
   */
  markParts(ref: RefKeyParts, parts: string[], required: string[]): boolean {
    load();
    const k = refKey(ref);
    if (state.read.includes(k) || state.done.includes(k)) return false;
    const prev = state.progress[k] ?? [];
    const merged = [...new Set([...prev, ...parts])];
    if (allPartsRead(merged, required)) {
      commit({
        ...state,
        read: [...state.read, k],
        progress: withoutProgress(state.progress, k),
      });
      return true;
    }
    if (merged.length === prev.length) return false;
    const entries = Object.entries({ ...withoutProgress(state.progress, k), [k]: merged });
    commit({ ...state, progress: Object.fromEntries(entries.slice(-MAX_PROGRESS)) });
    return false;
  },
  removeRecent(ref: ChapterRef) {
    load();
    const k = refKey(ref);
    commit({ ...state, recent: state.recent.filter((s) => refKey(s) !== k) });
  },
  clearRecent() {
    load();
    commit({ ...state, recent: [] });
  },
  /** "Revise kiya": schedules the next revision of a JEE / NEET chapter (1, 3, 7, 15, 30, 60 days). */
  revise(key: string) {
    load();
    const today = localDay();
    commit({ ...state, revisions: { ...state.revisions, [key]: nextRevision(state.revisions[key], today) } });
    // Revising counts as a study day for the streak.
    if (!state.days.includes(today)) commit({ ...state, days: [...state.days, today].slice(-120) });
  },
  /** Undo the revision schedule of a chapter. */
  resetRevision(key: string) {
    load();
    if (!(key in state.revisions)) return;
    const next = { ...state.revisions };
    delete next[key];
    commit({ ...state, revisions: next });
  },
  setPrefs(patch: Partial<Prefs>) {
    load();
    commit({ ...state, prefs: { ...state.prefs, ...patch } });
  },
};
