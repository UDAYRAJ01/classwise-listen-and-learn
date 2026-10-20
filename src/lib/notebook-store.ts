// Per-device study memory: saved chapters, recently read, finished chapters
// and listening preferences. Stored in the browser so no login is needed.

import { useSyncExternalStore } from "react";

import type { BoardId, Lang } from "./catalog";

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
  done: string[];
  /** Local dates (YYYY-MM-DD) on which a chapter was opened. */
  days: string[];
  prefs: Prefs;
}

const KEY = "padhosuno:v1";
const DEFAULT_PREFS: Prefs = { lang: null, voice: "didi", rate: 1, follow: true };
const EMPTY: NotebookState = { saved: [], recent: [], done: [], days: [], prefs: DEFAULT_PREFS };

let state: NotebookState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotebookState>;
      state = {
        saved: Array.isArray(parsed.saved) ? parsed.saved : [],
        recent: Array.isArray(parsed.recent) ? parsed.recent : [],
        done: Array.isArray(parsed.done) ? parsed.done : [],
        days: Array.isArray(parsed.days) ? parsed.days : [],
        prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) },
      };
    }
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

export function sanitize(p: Partial<NotebookState> | null | undefined): NotebookState {
  return {
    saved: Array.isArray(p?.saved) ? p.saved : [],
    recent: Array.isArray(p?.recent) ? p.recent : [],
    done: Array.isArray(p?.done) ? p.done : [],
    days: Array.isArray(p?.days) ? p.days : [],
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
  return {
    saved: byKey([a.saved, b.saved], 200),
    recent: byKey([a.recent, b.recent], 12),
    done: [...new Set([...a.done, ...b.done])],
    days: [...new Set([...a.days, ...b.days])].sort().slice(-120),
    prefs: { ...b.prefs, ...a.prefs },
  };
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

export function refKey(r: Pick<ChapterRef, "board" | "grade" | "subject" | "chapter">): string {
  return `${r.board}/${r.grade}/${r.subject}/${r.chapter}`;
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
      recent: [{ ...ref, at: Date.now() }, ...state.recent.filter((s) => refKey(s) !== k)].slice(0, 12),
      days: state.days.includes(today) ? state.days : [...state.days, today].slice(-120),
    });
  },
  toggleDone(ref: Pick<ChapterRef, "board" | "grade" | "subject" | "chapter">) {
    load();
    const k = refKey(ref);
    const isDone = state.done.includes(k);
    commit({ ...state, done: isDone ? state.done.filter((d) => d !== k) : [...state.done, k] });
    return !isDone;
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
  setPrefs(patch: Partial<Prefs>) {
    load();
    commit({ ...state, prefs: { ...state.prefs, ...patch } });
  },
};
