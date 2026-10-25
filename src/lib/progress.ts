// Read / left counts for a subject's chapter list. Pure, so it is easy to test.

import type { BoardId } from "./catalog";
import { chapterStatus, refKey, type ChapterStatus, type NotebookState } from "./notebook-store";

/** Which chapters a list shows. "left" = not read yet, "read" = read or memorised. */
export type ChapterFilter = "all" | "left" | "read" | "done";
export const CHAPTER_FILTERS: ChapterFilter[] = ["all", "left", "read", "done"];

export function isChapterFilter(v: unknown): v is ChapterFilter {
  return CHAPTER_FILTERS.includes(v as ChapterFilter);
}

export function matchesFilter(status: ChapterStatus, filter: ChapterFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "left":
      return status === "new" || status === "started";
    case "read":
      return status === "read" || status === "done";
    case "done":
      return status === "done";
  }
}

export interface SubjectProgress {
  total: number;
  /** Memorised ("yaad ho gaya"). */
  done: number;
  /** Read but not yet memorised. */
  read: number;
  /** Opened and partly read. */
  started: number;
  /** Not read yet (new + started). */
  left: number;
  /** First chapter, in book order, that is not read yet. */
  nextSlug: string | null;
}

type Progressish = Pick<NotebookState, "done" | "read" | "progress">;

export function subjectProgress(
  nb: Progressish,
  where: { board: BoardId; grade: number; subject: string },
  chapterSlugs: readonly string[],
): SubjectProgress {
  const out: SubjectProgress = {
    total: chapterSlugs.length,
    done: 0,
    read: 0,
    started: 0,
    left: 0,
    nextSlug: null,
  };
  for (const slug of chapterSlugs) {
    const st = chapterStatus(nb, refKey({ ...where, chapter: slug }));
    if (st === "done") out.done += 1;
    else if (st === "read") out.read += 1;
    else {
      if (st === "started") out.started += 1;
      out.left += 1;
      out.nextSlug ??= slug;
    }
  }
  return out;
}

/** Chapters of one subject the student has touched, from notebook keys alone. */
export function touchedInSubject(
  nb: Progressish,
  where: { board: BoardId; grade: number; subject: string },
): { done: number; read: number; started: number } {
  const prefix = `${where.board}/${where.grade}/${where.subject}/`;
  const done = new Set(nb.done.filter((k) => k.startsWith(prefix)));
  const read = nb.read.filter((k) => k.startsWith(prefix) && !done.has(k)).length;
  const started = Object.keys(nb.progress).filter(
    (k) => k.startsWith(prefix) && !done.has(k) && !nb.read.includes(k),
  ).length;
  return { done: done.size, read, started };
}
