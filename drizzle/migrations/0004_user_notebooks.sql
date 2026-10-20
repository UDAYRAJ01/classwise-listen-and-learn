CREATE TABLE public.user_notebooks (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notebooks TO authenticated;
GRANT ALL ON public.user_notebooks TO service_role;
ALTER TABLE public.user_notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notebook read" ON public.user_notebooks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notebook insert" ON public.user_notebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notebook update" ON public.user_notebooks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);