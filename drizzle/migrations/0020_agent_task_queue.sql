create table public.agent_tasks (
  id bigint generated always as identity primary key,
  board text not null,
  grade integer not null,
  subject text not null,
  chapter_slug text not null,
  chapter_title text not null,
  book_name text,
  language text not null,
  source_url text,
  source_chars integer not null default 0,
  has_source boolean not null default false,
  status text not null default 'open',
  claimed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_tasks_identity_unique unique (board, grade, subject, chapter_slug, language)
);

create index agent_tasks_status_idx on public.agent_tasks (status, board, grade, subject, chapter_slug, language);

grant all on public.agent_tasks to service_role;

alter table public.agent_tasks enable row level security;