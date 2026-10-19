-- Shared AI-generated study content (public read, server-only writes)

CREATE TABLE public.syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  grade integer NOT NULL,
  subject text NOT NULL,
  books jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT syllabi_board_check CHECK (board IN ('cbse', 'icse')),
  CONSTRAINT syllabi_grade_check CHECK (grade BETWEEN 1 AND 12),
  CONSTRAINT syllabi_unique UNIQUE (board, grade, subject)
);

GRANT SELECT ON public.syllabi TO anon, authenticated;
GRANT ALL ON public.syllabi TO service_role;
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Syllabi are readable by everyone" ON public.syllabi FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  grade integer NOT NULL,
  subject text NOT NULL,
  chapter_slug text NOT NULL,
  chapter_title text NOT NULL,
  book_name text,
  language text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notes_board_check CHECK (board IN ('cbse', 'icse')),
  CONSTRAINT notes_grade_check CHECK (grade BETWEEN 1 AND 12),
  CONSTRAINT notes_language_check CHECK (language IN ('en', 'hi', 'hinglish')),
  CONSTRAINT notes_unique UNIQUE (board, grade, subject, chapter_slug, language)
);

GRANT SELECT ON public.notes TO anon, authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notes are readable by everyone" ON public.notes FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.note_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  track_index integer NOT NULL,
  voice text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_audio_unique UNIQUE (note_id, track_index, voice)
);

GRANT SELECT ON public.note_audio TO anon, authenticated;
GRANT ALL ON public.note_audio TO service_role;
ALTER TABLE public.note_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Note audio is readable by everyone" ON public.note_audio FOR SELECT TO anon, authenticated USING (true);

-- Rate-limit ledger for AI generation (server only, no client access)
CREATE TABLE public.generation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.generation_events TO service_role;
ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX generation_events_lookup_idx ON public.generation_events (ip_hash, kind, created_at DESC);
CREATE INDEX notes_lookup_idx ON public.notes (board, grade, subject);
