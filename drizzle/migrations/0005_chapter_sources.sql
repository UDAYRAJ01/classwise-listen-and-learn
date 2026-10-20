CREATE TABLE public.chapter_sources (
  board text NOT NULL,
  grade int NOT NULL,
  subject text NOT NULL,
  chapter_slug text NOT NULL,
  source_url text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board, grade, subject, chapter_slug)
);
GRANT ALL ON public.chapter_sources TO service_role;
ALTER TABLE public.chapter_sources ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chapter_sources IS 'Official textbook text per chapter, used only by the backend to ground and check notes.';

CREATE TABLE public.note_checks (
  note_id uuid PRIMARY KEY REFERENCES public.notes(id) ON DELETE CASCADE,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.note_checks TO service_role;
ALTER TABLE public.note_checks ENABLE ROW LEVEL SECURITY;