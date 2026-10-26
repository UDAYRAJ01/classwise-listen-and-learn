import { queryOptions } from "@tanstack/react-query";

import type { ExamGroup, ExamSubject } from "./exam";
import { fetchExamChapter, fetchExamOldUnit, fetchExamOverview, fetchPaperPage } from "./exam.functions";

export const examOverviewQuery = (group: ExamGroup) =>
  queryOptions({
    queryKey: ["exam-overview", group],
    queryFn: () => fetchExamOverview({ data: { group } }),
    staleTime: 1000 * 60 * 10,
  });

export const examChapterQuery = (group: ExamGroup, subject: ExamSubject, chapter: string) =>
  queryOptions({
    queryKey: ["exam-chapter", group, subject, chapter],
    queryFn: () => fetchExamChapter({ data: { group, subject, chapter } }),
    staleTime: 1000 * 60 * 10,
  });

/** Signed links last an hour; refresh a little before that. */
export const paperPageQuery = (paper: string, page: number) =>
  queryOptions({
    queryKey: ["paper-page", paper, page],
    queryFn: () => fetchPaperPage({ data: { paper, page } }),
    staleTime: 1000 * 60 * 50,
    gcTime: 1000 * 60 * 55,
  });

export const examOldUnitQuery = (group: ExamGroup, subject: ExamSubject, unit: string) =>
  queryOptions({
    queryKey: ["exam-old-unit", group, subject, unit],
    queryFn: () => fetchExamOldUnit({ data: { group, subject, unit } }),
    staleTime: 1000 * 60 * 10,
  });
