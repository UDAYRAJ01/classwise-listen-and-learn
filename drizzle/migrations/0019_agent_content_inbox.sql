CREATE TABLE public.agent_content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('write', 'check')),
  task integer NOT NULL,
  payload jsonb NOT NULL,
  raw_json text NOT NULL,
  sha256 text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT ALL ON public.agent_content_submissions TO service_role;
ALTER TABLE public.agent_content_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_content_submissions_status_idx ON public.agent_content_submissions (status, created_at);
CREATE INDEX agent_content_submissions_task_idx ON public.agent_content_submissions (task);
COMMENT ON TABLE public.agent_content_submissions IS 'Key-authenticated external writing and checking drafts; no automatic production import.';