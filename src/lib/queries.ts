import { queryOptions } from "@tanstack/react-query";

import type { BoardId, Lang } from "./catalog";
import { fetchNote, fetchNoteLanguages, fetchSyllabus } from "./content.functions";

export const syllabusQuery = (board: BoardId, grade: number, subject: string) =>
  queryOptions({
    queryKey: ["syllabus", board, grade, subject],
    queryFn: () => fetchSyllabus({ data: { board, grade, subject } }),
    staleTime: 1000 * 60 * 60,
  });

export const noteQuery = (
  board: BoardId,
  grade: number,
  subject: string,
  chapter: string,
  lang: Lang,
) =>
  queryOptions({
    queryKey: ["note", board, grade, subject, chapter, lang],
    queryFn: () => fetchNote({ data: { board, grade, subject, chapter, lang } }),
    staleTime: 1000 * 60 * 60,
  });

export const noteLanguagesQuery = (
  board: BoardId,
  grade: number,
  subject: string,
  chapter: string,
) =>
  queryOptions({
    queryKey: ["note-langs", board, grade, subject, chapter],
    queryFn: () => fetchNoteLanguages({ data: { board, grade, subject, chapter } }),
    staleTime: 1000 * 60,
  });
