-- Roles (owner/admin access)
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- The very first account becomes the owner (admin).
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_first_admin
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_first_admin();

-- Reports keep their chapter even if the note is re-created
ALTER TABLE public.note_reports
  ADD COLUMN board text, ADD COLUMN grade integer, ADD COLUMN subject text,
  ADD COLUMN chapter_slug text, ADD COLUMN chapter_title text, ADD COLUMN language text,
  ADD COLUMN status text NOT NULL DEFAULT 'open',
  ADD COLUMN correction text,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN applied_at timestamptz;

UPDATE public.note_reports r SET board = n.board, grade = n.grade, subject = n.subject,
  chapter_slug = n.chapter_slug, chapter_title = n.chapter_title, language = n.language
FROM public.notes n WHERE n.id = r.note_id;

ALTER TABLE public.note_reports DROP CONSTRAINT note_reports_note_id_fkey;
ALTER TABLE public.note_reports ALTER COLUMN note_id DROP NOT NULL;
ALTER TABLE public.note_reports ADD CONSTRAINT note_reports_note_id_fkey
  FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE SET NULL;
ALTER TABLE public.note_reports ADD CONSTRAINT note_reports_status_check CHECK (status IN ('open','resolved','dismissed'));
CREATE INDEX note_reports_chapter_idx ON public.note_reports (board, grade, subject, chapter_slug);
CREATE INDEX note_reports_status_idx ON public.note_reports (status, created_at DESC);
