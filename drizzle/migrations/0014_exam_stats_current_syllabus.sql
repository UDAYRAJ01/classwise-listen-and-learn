-- Chapter and concept weightage count only questions on topics the current NCERT books teach.
-- Questions on topics removed from NCERT keep a home chapter (in_syllabus = false) and are
-- listed separately on the chapter page.
CREATE OR REPLACE VIEW public.exam_chapter_stats WITH (security_invoker = true) AS
SELECT
  CASE WHEN p.exam = 'neet' THEN 'neet' ELSE 'jee' END AS exam_group,
  q.subject,
  q.grade,
  q.chapter_slug,
  count(*)::int AS questions,
  count(*) FILTER (WHERE p.exam = 'jee-main')::int AS main_count,
  count(*) FILTER (WHERE p.exam = 'jee-advanced')::int AS advanced_count,
  count(*) FILTER (WHERE p.exam = 'neet')::int AS neet_count,
  array_agg(DISTINCT p.year ORDER BY p.year) AS years,
  count(DISTINCT p.id)::int AS papers
FROM public.exam_questions q
JOIN public.exam_papers p ON p.id = q.paper_id
WHERE q.chapter_slug IS NOT NULL AND q.in_syllabus
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW public.exam_concept_stats WITH (security_invoker = true) AS
SELECT
  CASE WHEN p.exam = 'neet' THEN 'neet' ELSE 'jee' END AS exam_group,
  q.subject,
  q.grade,
  q.chapter_slug,
  q.concept_id,
  max(q.concept) AS concept,
  count(*)::int AS questions
FROM public.exam_questions q
JOIN public.exam_papers p ON p.id = q.paper_id
WHERE q.chapter_slug IS NOT NULL AND q.concept_id IS NOT NULL AND q.in_syllabus
GROUP BY 1, 2, 3, 4, 5;

CREATE OR REPLACE VIEW public.exam_subject_stats WITH (security_invoker = true) AS
SELECT
  CASE WHEN p.exam = 'neet' THEN 'neet' ELSE 'jee' END AS exam_group,
  q.subject,
  count(*)::int AS questions,
  count(*) FILTER (WHERE q.topic IS NOT NULL AND NOT q.in_syllabus)::int AS out_of_syllabus,
  count(*) FILTER (WHERE q.topic IS NULL)::int AS unmapped
FROM public.exam_questions q
JOIN public.exam_papers p ON p.id = q.paper_id
GROUP BY 1, 2;

GRANT SELECT ON public.exam_chapter_stats TO anon, authenticated;
GRANT SELECT ON public.exam_chapter_stats TO service_role;
GRANT SELECT ON public.exam_concept_stats TO anon, authenticated;
GRANT SELECT ON public.exam_concept_stats TO service_role;
GRANT SELECT ON public.exam_subject_stats TO anon, authenticated;
GRANT SELECT ON public.exam_subject_stats TO service_role;