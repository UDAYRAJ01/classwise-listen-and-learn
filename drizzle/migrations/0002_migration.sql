-- Student-reported mistakes in notes (written by the server only)
CREATE TABLE public.note_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  section text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_reports_message_length CHECK (char_length(message) BETWEEN 3 AND 600)
);

GRANT ALL ON public.note_reports TO service_role;
ALTER TABLE public.note_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX note_reports_note_idx ON public.note_reports (note_id, created_at DESC);
