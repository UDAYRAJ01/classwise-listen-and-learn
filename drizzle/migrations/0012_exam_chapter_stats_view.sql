CREATE VIEW public.exam_chapter_stats WITH (security_invoker = true) AS
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
WHERE q.chapter_slug IS NOT NULL
GROUP BY 1, 2, 3, 4;
GRANT SELECT ON public.exam_chapter_stats TO anon, authenticated;
GRANT SELECT ON public.exam_chapter_stats TO service_role;

CREATE VIEW public.exam_coverage WITH (security_invoker = true) AS
SELECT
  CASE WHEN exam = 'neet' THEN 'neet' ELSE 'jee' END AS exam_group,
  exam,
  slug,
  label,
  year,
  held_on,
  answer_source,
  question_count,
  source_url
FROM public.exam_papers
WHERE status = 'extracted';
GRANT SELECT ON public.exam_coverage TO anon, authenticated;
GRANT SELECT ON public.exam_coverage TO service_role;