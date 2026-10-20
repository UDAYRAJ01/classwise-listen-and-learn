ALTER TABLE public.chapter_sources ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body,''))) STORED;
CREATE INDEX IF NOT EXISTS chapter_sources_fts_idx ON public.chapter_sources USING gin (fts);
CREATE OR REPLACE FUNCTION public.search_chapter_sources(q text, n int DEFAULT 4)
RETURNS TABLE(board text, grade int, subject text, chapter_slug text, source_url text, snippet text, rank real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH query AS (SELECT websearch_to_tsquery('simple', replace(q, ' ', ' or ')) AS tq)
  SELECT s.board, s.grade, s.subject, s.chapter_slug, s.source_url,
    ts_headline('simple', s.body, query.tq, 'MaxFragments=4,MaxWords=60,MinWords=25,FragmentDelimiter= … ') AS snippet,
    ts_rank(s.fts, query.tq) AS rank
  FROM public.chapter_sources s, query
  WHERE s.fts @@ query.tq
  ORDER BY rank DESC LIMIT least(n, 8);
$$;
REVOKE ALL ON FUNCTION public.search_chapter_sources(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_chapter_sources(text, int) TO service_role;