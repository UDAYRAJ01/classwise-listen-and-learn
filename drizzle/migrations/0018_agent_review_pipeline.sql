CREATE TABLE public.agent_code_files (
  path text PRIMARY KEY,
  content text NOT NULL,
  size integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.agent_code_files TO service_role;
ALTER TABLE public.agent_code_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agent_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  files text[] NOT NULL DEFAULT '{}',
  patch text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT ALL ON public.agent_fixes TO service_role;
ALTER TABLE public.agent_fixes ENABLE ROW LEVEL SECURITY;