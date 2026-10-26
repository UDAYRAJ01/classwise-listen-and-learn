CREATE VIEW public.exam_concept_stats WITH (security_invoker = true) AS
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
WHERE q.chapter_slug IS NOT NULL AND q.concept_id IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;
GRANT SELECT ON public.exam_concept_stats TO anon, authenticated;
GRANT SELECT ON public.exam_concept_stats TO service_role;

CREATE VIEW public.exam_subject_stats WITH (security_invoker = true) AS
SELECT
  CASE WHEN p.exam = 'neet' THEN 'neet' ELSE 'jee' END AS exam_group,
  q.subject,
  count(*)::int AS questions,
  count(*) FILTER (WHERE q.topic IS NOT NULL AND q.chapter_slug IS NULL)::int AS out_of_syllabus,
  count(*) FILTER (WHERE q.topic IS NULL)::int AS unmapped
FROM public.exam_questions q
JOIN public.exam_papers p ON p.id = q.paper_id
GROUP BY 1, 2;
GRANT SELECT ON public.exam_subject_stats TO anon, authenticated;
GRANT SELECT ON public.exam_subject_stats TO service_role;