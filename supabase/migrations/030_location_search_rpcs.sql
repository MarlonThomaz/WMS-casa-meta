-- ========================================
-- Annona Mercis WMS - Migration 030
-- Busca de endereços sob demanda para operação física em galpões grandes
-- ========================================

CREATE OR REPLACE FUNCTION public.search_locations(
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_destination_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  location_id UUID,
  code TEXT,
  zone TEXT,
  aisle TEXT,
  rack TEXT,
  level TEXT,
  location_type TEXT,
  capacity NUMERIC,
  status TEXT,
  total_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  v_query TEXT := NULLIF(BTRIM(COALESCE(p_query, '')), '');
BEGIN
  IF public.user_role() IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil ativo';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.code,
    l.zone,
    l.aisle,
    l.rack,
    l.level,
    l.location_type,
    l.capacity,
    l.status,
    COALESCE(SUM(sb.quantity), 0)::NUMERIC AS location_total_quantity
  FROM public.locations l
  LEFT JOIN public.stock_balances sb
    ON sb.location_id = l.id
  WHERE
    (NOT COALESCE(p_destination_only, false) OR l.status NOT IN ('blocked', 'maintenance'))
    AND (
      v_query IS NULL
      OR l.code ILIKE '%' || v_query || '%'
      OR l.zone ILIKE '%' || v_query || '%'
      OR COALESCE(l.aisle, '') ILIKE '%' || v_query || '%'
      OR COALESCE(l.rack, '') ILIKE '%' || v_query || '%'
      OR COALESCE(l.level, '') ILIKE '%' || v_query || '%'
    )
  GROUP BY
    l.id,
    l.code,
    l.zone,
    l.aisle,
    l.rack,
    l.level,
    l.location_type,
    l.capacity,
    l.status
  ORDER BY
    CASE WHEN v_query IS NOT NULL AND LOWER(l.code) = LOWER(v_query) THEN 0 ELSE 1 END,
    l.code ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_product_source_locations(
  p_product_id UUID,
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  location_id UUID,
  code TEXT,
  zone TEXT,
  aisle TEXT,
  rack TEXT,
  level TEXT,
  location_type TEXT,
  capacity NUMERIC,
  status TEXT,
  quantity NUMERIC,
  reserved_quantity NUMERIC,
  available_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  v_query TEXT := NULLIF(BTRIM(COALESCE(p_query, '')), '');
BEGIN
  IF public.user_role() IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil ativo';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Produto é obrigatório para buscar endereços de origem';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.code,
    l.zone,
    l.aisle,
    l.rack,
    l.level,
    l.location_type,
    l.capacity,
    l.status,
    sb.quantity,
    sb.reserved_quantity,
    sb.available_quantity
  FROM public.stock_balances sb
  JOIN public.locations l
    ON l.id = sb.location_id
  WHERE sb.product_id = p_product_id
    AND sb.available_quantity > 0
    AND (
      v_query IS NULL
      OR l.code ILIKE '%' || v_query || '%'
      OR l.zone ILIKE '%' || v_query || '%'
      OR COALESCE(l.aisle, '') ILIKE '%' || v_query || '%'
      OR COALESCE(l.rack, '') ILIKE '%' || v_query || '%'
      OR COALESCE(l.level, '') ILIKE '%' || v_query || '%'
    )
  ORDER BY
    CASE WHEN v_query IS NOT NULL AND LOWER(l.code) = LOWER(v_query) THEN 0 ELSE 1 END,
    sb.available_quantity DESC,
    l.code ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_locations(TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_locations(TEXT, INTEGER, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_locations(TEXT, INTEGER, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.search_product_source_locations(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_product_source_locations(UUID, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_product_source_locations(UUID, TEXT, INTEGER) TO authenticated;
