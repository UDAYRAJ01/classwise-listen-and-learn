alter table public.chapter_sources add column if not exists body_chars integer not null default 0;

create or replace function public.set_chapter_source_chars()
returns trigger
language plpgsql
as $$
begin
  new.body_chars := length(new.body);
  return new;
end;
$$;

drop trigger if exists chapter_sources_body_chars on public.chapter_sources;
create trigger chapter_sources_body_chars
  before insert or update of body on public.chapter_sources
  for each row execute function public.set_chapter_source_chars();

update public.chapter_sources set body_chars = length(body) where body_chars <> length(body);