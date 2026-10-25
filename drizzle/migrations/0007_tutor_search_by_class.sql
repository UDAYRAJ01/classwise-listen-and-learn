CREATE OR REPLACE FUNCTION public.search_book_passages(q text, n integer DEFAULT 4, g integer DEFAULT NULL, b text DEFAULT NULL)
RETURNS TABLE(board text, grade integer, subject text, chapter_slug text, source_url text, snippet text, rank real)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH query AS (SELECT websearch_to_tsquery('simple', replace(q, ' ', ' or ')) AS tq)
  SELECT s.board, s.grade, s.subject, s.chapter_slug, s.source_url,
    ts_headline('simple', s.body, query.tq, 'MaxFragments=4,MaxWords=60,MinWords=25,FragmentDelimiter= … ') AS snippet,
    ts_rank(s.fts, query.tq) AS rank
  FROM public.chapter_sources s, query
  WHERE s.fts @@ query.tq
  ORDER BY (g IS NOT NULL AND s.grade = g) DESC,
           (b IS NOT NULL AND s.board = b) DESC,
           rank DESC
  LIMIT least(n, 8);
$function$;

REVOKE ALL ON FUNCTION public.search_book_passages(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_book_passages(text, integer, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_book_passages(text, integer, integer, text) TO service_role;