import { queryOptions } from "@tanstack/react-query";
import type { GovernmentCategory } from "./government-exams";
import { fetchGovernmentExams } from "./government-exams.functions";
export const governmentExamQuery = (category: GovernmentCategory) => queryOptions({
  queryKey: ["government-exams", category], queryFn: () => fetchGovernmentExams({ data: { category } }), staleTime: 60_000,
});