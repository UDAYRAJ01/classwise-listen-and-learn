CREATE TABLE public.gov_exam_papers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, category text NOT NULL, exam text NOT NULL, jurisdiction text NOT NULL DEFAULT 'national', stage text NOT NULL, section text NOT NULL, year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100), label text NOT NULL, source_url text NOT NULL, source_kind text NOT NULL CHECK (source_kind IN ('official','verified_copy','memory_based','model')), key_url text, key_source text NOT NULL DEFAULT 'none' CHECK (key_source IN ('official_final','official_provisional','unofficial','none')), expected_questions integer, status text NOT NULL DEFAULT 'located' CHECK (status IN ('located','extracting','review','ready','failed')), checksum text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gov_exam_papers TO anon, authenticated;
GRANT ALL ON public.gov_exam_papers TO service_role;
ALTER TABLE public.gov_exam_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY gov_papers_read ON public.gov_exam_papers FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.gov_exam_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), paper_id uuid NOT NULL REFERENCES public.gov_exam_papers(id) ON DELETE CASCADE, number integer NOT NULL, page integer NOT NULL, body text NOT NULL, options jsonb NOT NULL DEFAULT '[]', kind text NOT NULL DEFAULT 'single' CHECK (kind IN ('single','multiple','numeric','descriptive')), section text NOT NULL, topic text NOT NULL, concept text NOT NULL, answer text, solution jsonb, solution_ok boolean NOT NULL DEFAULT false, reviewed boolean NOT NULL DEFAULT false, UNIQUE(paper_id, number)
);
GRANT SELECT (id,paper_id,number,page,body,options,kind,section,topic,concept,reviewed) ON public.gov_exam_questions TO anon, authenticated;
GRANT ALL ON public.gov_exam_questions TO service_role;
ALTER TABLE public.gov_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY gov_questions_read ON public.gov_exam_questions FOR SELECT TO anon, authenticated USING (reviewed AND EXISTS (SELECT 1 FROM public.gov_exam_papers p WHERE p.id = paper_id AND p.status = 'ready' AND p.source_kind IN ('official','verified_copy')));
CREATE INDEX gov_questions_topic ON public.gov_exam_questions(paper_id,topic);
CREATE TABLE public.gov_exam_topics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exam text NOT NULL, stage text NOT NULL, section text NOT NULL, topic text NOT NULL, content jsonb NOT NULL, reviewed boolean NOT NULL DEFAULT false, evidence_hash text NOT NULL, UNIQUE(exam,stage,section,topic)
);
GRANT SELECT ON public.gov_exam_topics TO anon, authenticated;
GRANT ALL ON public.gov_exam_topics TO service_role;
ALTER TABLE public.gov_exam_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY gov_topics_read ON public.gov_exam_topics FOR SELECT TO anon, authenticated USING (reviewed);
COMMENT ON TABLE public.gov_exam_papers IS 'Separate recruitment exam archive; missing years are not fabricated and only ready papers count in analysis.';