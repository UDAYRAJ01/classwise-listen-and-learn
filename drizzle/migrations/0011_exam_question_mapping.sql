ALTER TABLE public.exam_questions ADD COLUMN topic text;
ALTER TABLE public.exam_questions ADD COLUMN concept_id text;
ALTER TABLE public.exam_questions ADD COLUMN ncert_kind text;
ALTER TABLE public.exam_questions ADD COLUMN ncert_ref text;
ALTER TABLE public.exam_questions ADD COLUMN source_type text CHECK (source_type IN ('ncert-example', 'ncert-exercise', 'ncert-text', 'beyond-ncert'));
CREATE INDEX exam_questions_concept_idx ON public.exam_questions (chapter_slug, concept_id);