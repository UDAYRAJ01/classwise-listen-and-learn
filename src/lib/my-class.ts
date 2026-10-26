// "Meri class": the class whose books the Home screen and the Books tab open.
import { BOARDS, gradeLabel, type BoardId } from "./catalog";
import type { ChapterRef, Prefs } from "./notebook-store";

export interface ClassRef {
  board: BoardId;
  grade: number;
}

/** The class the student picked; else the class of the chapter read last; else none. */
export function myClass(prefs: Pick<Prefs, "board" | "grade">, recent: readonly ChapterRef[]): ClassRef | null {
  if (prefs.board && prefs.grade) return { board: prefs.board, grade: prefs.grade };
  const last = recent[0];
  return last ? { board: last.board, grade: last.grade } : null;
}

/** Where the Books tab goes when no class is known yet. */
export const DEFAULT_CLASS: ClassRef = { board: "cbse", grade: 10 };

/** "Class 10 · CBSE", "ISC Class 12" (the ISC label already names the board). */
export function classLabel({ board, grade }: ClassRef): string {
  const label = gradeLabel(board, grade);
  return board === "icse" && grade >= 11 ? label : `${label} · ${BOARDS[board].short}`;
}
