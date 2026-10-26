-- Units dropped from the current NCERT books (p-Block, Solid State, Communication Systems…):
-- their past questions have no current chapter, so they are grouped by the old unit instead.
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS old_unit text;

CREATE VIEW public.exam_old_unit_stats WITH (security_invoker = true) AS
SELECT
  CASE WHEN p.exam = 'neet' THEN 'neet' ELSE 'jee' END AS exam_group,
  q.subject,
  q.old_unit,
  count(*)::int AS questions,
  count(*) FILTER (WHERE p.exam = 'jee-main')::int AS main_count,
  count(*) FILTER (WHERE p.exam = 'jee-advanced')::int AS advanced_count,
  count(*) FILTER (WHERE p.exam = 'neet')::int AS neet_count,
  array_agg(DISTINCT p.year ORDER BY p.year) AS years
FROM public.exam_questions q
JOIN public.exam_papers p ON p.id = q.paper_id
WHERE NOT q.in_syllabus AND q.chapter_slug IS NULL AND q.old_unit IS NOT NULL
GROUP BY 1, 2, 3;

GRANT SELECT ON public.exam_old_unit_stats TO anon, authenticated;
GRANT SELECT ON public.exam_old_unit_stats TO service_role;