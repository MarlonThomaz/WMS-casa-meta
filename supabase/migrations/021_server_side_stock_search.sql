-- ========================================
-- Annona Mercis WMS - Migration 021
-- Busca de estoque no servidor para evitar carregar todo o armazém no cliente
-- ========================================

CREATE OR REPLACE FUNCTION public.search_stock_locations(
  p_query TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  location_id UUID,
  quantity NUMERIC,
  reserved_quantity NUMERIC,
  available_quantity NUMERIC,
  last_movement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_sku TEXT,
  product_name TEXT,
  product_category TEXT,
  product_unit_base TEXT,
  location_code TEXT,
  location_zone TEXT,
  location_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := lower(trim(coalesce(p_query, '')));
  v_limit INTEGER := least(greatest(coalesce(p_limit, 100), 1), 200);
BEGIN
  IF public.user_role() IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil ativo';
  END IF;

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sb.id,
    sb.product_id,
    sb.location_id,
    sb.quantity,
    sb.reserved_quantity,
    sb.available_quantity,
    sb.last_movement_at,
    sb.created_at,
    sb.updated_at,
    p.sku::TEXT,
    p.name::TEXT,
    p.category::TEXT,
    p.unit_base::TEXT,
    l.code::TEXT,
    l.zone::TEXT,
    l.location_type::TEXT
  FROM public.stock_balances sb
  JOIN public.products p ON p.id = sb.product_id
  JOIN public.locations l ON l.id = sb.location_id
  WHERE sb.quantity > 0
    AND p.active = true
    AND (
      lower(p.sku) LIKE '%' || v_query || '%'
      OR lower(p.name) LIKE '%' || v_query || '%'
      OR lower(coalesce(p.category, '')) LIKE '%' || v_query || '%'
      OR lower(l.code) LIKE '%' || v_query || '%'
      OR lower(l.zone) LIKE '%' || v_query || '%'
      OR lower(l.location_type::TEXT) LIKE '%' || v_query || '%'
    )
  ORDER BY
    CASE
      WHEN lower(p.sku) = v_query THEN 0
      WHEN lower(l.code) = v_query THEN 1
      WHEN lower(p.sku) LIKE v_query || '%' THEN 2
      WHEN lower(l.code) LIKE v_query || '%' THEN 3
      WHEN lower(p.name) LIKE v_query || '%' THEN 4
      ELSE 5
    END,
    p.sku,
    l.code
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_stock_locations(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_stock_locations(TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_stock_locations(TEXT, INTEGER) TO authenticated;
