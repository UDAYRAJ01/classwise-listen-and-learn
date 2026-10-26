CREATE TABLE public.exam_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam text NOT NULL CHECK (exam IN ('jee-main', 'jee-advanced', 'neet')),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  held_on date,
  source_url text NOT NULL,
  key_url text,
  pages integer,
  status text NOT NULL DEFAULT 'new',
  question_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_papers TO anon, authenticated;
GRANT ALL ON public.exam_papers TO service_role;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Past papers are public" ON public.exam_papers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
  number integer NOT NULL,
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'maths', 'biology')),
  kind text NOT NULL DEFAULT 'single',
  body text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text,
  page integer,
  has_figure boolean NOT NULL DEFAULT false,
  figure jsonb,
  grade integer,
  chapter_slug text,
  concept text,
  in_syllabus boolean NOT NULL DEFAULT true,
  solution jsonb,
  solution_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paper_id, number)
);
CREATE INDEX exam_questions_chapter_idx ON public.exam_questions (subject, grade, chapter_slug);
GRANT SELECT ON public.exam_questions TO anon, authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Past questions are public" ON public.exam_questions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.exam_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_group text NOT NULL CHECK (exam_group IN ('jee', 'neet')),
  grade integer NOT NULL,
  subject text NOT NULL,
  chapter_slug text NOT NULL,
  content jsonb NOT NULL,
  question_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_group, grade, subject, chapter_slug)
);
GRANT SELECT ON public.exam_chapters TO anon, authenticated;
GRANT ALL ON public.exam_chapters TO service_role;
ALTER TABLE public.exam_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exam chapter indexes are public" ON public.exam_chapters FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.ncert_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade integer NOT NULL,
  subject text NOT NULL,
  chapter_slug text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('section', 'example', 'exercise', 'figure', 'table', 'box')),
  ref text NOT NULL,
  heading text NOT NULL DEFAULT '',
  page integer NOT NULL,
  printed_page integer,
  pdf_url text NOT NULL,
  UNIQUE (grade, subject, chapter_slug, kind, ref)
);
GRANT SELECT ON public.ncert_sections TO anon, authenticated;
GRANT ALL ON public.ncert_sections TO service_role;
ALTER TABLE public.ncert_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NCERT section index is public" ON public.ncert_sections FOR SELECT TO anon, authenticated USING (true);