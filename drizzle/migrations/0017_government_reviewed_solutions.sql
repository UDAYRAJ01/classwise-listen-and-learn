ALTER TABLE public.gov_exam_topics ADD COLUMN jurisdiction text NOT NULL DEFAULT 'national';
CREATE TABLE public.gov_exam_solutions (
 question_id uuid PRIMARY KEY REFERENCES public.gov_exam_questions(id) ON DELETE CASCADE,
 answer text NOT NULL, content jsonb NOT NULL, evidence_hash text NOT NULL,
 verification text NOT NULL CHECK (verification IN ('independent_agreement','official_final','official_provisional')),
 reviewed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gov_exam_solutions TO anon, authenticated;
GRANT ALL ON public.gov_exam_solutions TO service_role;
ALTER TABLE public.gov_exam_solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY gov_solutions_read ON public.gov_exam_solutions FOR SELECT TO anon, authenticated USING (reviewed AND EXISTS (SELECT 1 FROM public.gov_exam_questions q JOIN public.gov_exam_papers p ON p.id=q.paper_id WHERE q.id=question_id AND q.reviewed AND p.status='ready' AND p.source_kind IN ('official','verified_copy')));
COMMENT ON TABLE public.gov_exam_solutions IS 'Only independently checked original-paper solutions. Independent agreement is not an official answer key. Book references require stored evidence.';