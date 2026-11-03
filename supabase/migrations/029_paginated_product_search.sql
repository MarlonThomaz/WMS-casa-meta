-- ========================================
-- Annona Mercis WMS - Migration 029
-- Busca paginada de produtos com saldo agregado no banco
-- ========================================

CREATE OR REPLACE FUNCTION public.search_products_with_stock(
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  sku TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  unit_base TEXT,
  min_stock NUMERIC,
  max_stock NUMERIC,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_stock NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_query TEXT := NULLIF(BTRIM(COALESCE(p_query, '')), '');
BEGIN
  IF public.user_role() IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil ativo';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id AS product_id,
      p.sku AS product_sku,
      p.name AS product_name,
      p.description AS product_description,
      p.category AS product_category,
      p.unit_base AS product_unit_base,
      p.min_stock AS product_min_stock,
      p.max_stock AS product_max_stock,
      p.active AS product_active,
      p.created_at AS product_created_at,
      p.updated_at AS product_updated_at,
      COALESCE(SUM(sb.quantity), 0)::NUMERIC AS product_total_stock
    FROM public.products p
    LEFT JOIN public.stock_balances sb
      ON sb.product_id = p.id
    WHERE p.active = true
      AND (
        v_query IS NULL
        OR p.sku ILIKE '%' || v_query || '%'
        OR p.name ILIKE '%' || v_query || '%'
        OR COALESCE(p.category, '') ILIKE '%' || v_query || '%'
      )
    GROUP BY
      p.id,
      p.sku,
      p.name,
      p.description,
      p.category,
      p.unit_base,
      p.min_stock,
      p.max_stock,
      p.active,
      p.created_at,
      p.updated_at
  ),
  counted AS (
    SELECT
      f.*,
      COUNT(*) OVER ()::BIGINT AS result_total_count
    FROM filtered f
  )
  SELECT
    c.product_id,
    c.product_sku,
    c.product_name,
    c.product_description,
    c.product_category,
    c.product_unit_base,
    c.product_min_stock,
    c.product_max_stock,
    c.product_active,
    c.product_created_at,
    c.product_updated_at,
    c.product_total_stock,
    c.result_total_count
  FROM counted c
  ORDER BY c.product_sku ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_products_with_stock(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_products_with_stock(TEXT, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_products_with_stock(TEXT, INTEGER, INTEGER) TO authenticated;
