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

interface NotebookState {
  saved: ChapterRef[];
  recent: ChapterRef[];
  done: string[];
  prefs: Prefs;
}

const KEY = "padhosuno:v1";
const DEFAULT_PREFS: Prefs = { lang: null, voice: "didi", rate: 1, follow: true };
const EMPTY: NotebookState = { saved: [], recent: [], done: [], prefs: DEFAULT_PREFS };

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

function commit(next: NotebookState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked; keep in memory
  }
  listeners.forEach((l) => l());
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
    commit({
      ...state,
      recent: [{ ...ref, at: Date.now() }, ...state.recent.filter((s) => refKey(s) !== k)].slice(
        0,
        12,
      ),
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
