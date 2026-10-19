-- Chapter search across cached syllabi (public, read-only)
CREATE OR REPLACE FUNCTION public.search_chapters(q text, max_results integer DEFAULT 20)
RETURNS TABLE(board text, grade integer, subject text, slug text, title text, book text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.board, s.grade, s.subject, c->>'slug', c->>'title', b->>'name'
  FROM public.syllabi s,
       jsonb_array_elements(s.books) AS b,
       jsonb_array_elements(b->'chapters') AS c
  WHERE length(trim(q)) >= 2
    AND (c->>'title') ILIKE '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  ORDER BY s.grade, s.subject, c->>'title'
  LIMIT least(greatest(max_results, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.search_chapters(text, integer) TO anon, authenticated;
