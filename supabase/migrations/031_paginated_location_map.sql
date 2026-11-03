-- ========================================
-- Annona Mercis WMS - Migration 031
-- Mapa de endereços paginado e agregado no banco
-- ========================================

CREATE OR REPLACE FUNCTION public.search_locations_with_occupancy(
  p_query TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  zone TEXT,
  aisle TEXT,
  rack TEXT,
  level TEXT,
  location_type TEXT,
  capacity NUMERIC,
  stored_status TEXT,
  display_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_items BIGINT,
  total_quantity NUMERIC,
  occupancy_percentage NUMERIC,
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
  v_status TEXT := NULLIF(BTRIM(COALESCE(p_status, '')), '');
BEGIN
  IF public.user_role() IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil ativo';
  END IF;

  IF v_status IS NOT NULL
     AND v_status NOT IN ('available', 'occupied', 'reserved', 'blocked', 'maintenance') THEN
    RAISE EXCEPTION 'Status de localização inválido: %', v_status;
  END IF;

  RETURN QUERY
  WITH location_totals AS (
    SELECT
      l.id AS location_id,
      l.code AS location_code,
      l.zone AS location_zone,
      l.aisle AS location_aisle,
      l.rack AS location_rack,
      l.level AS location_level,
      l.location_type AS location_kind,
      l.capacity AS location_capacity,
      l.status AS location_stored_status,
      l.created_at AS location_created_at,
      l.updated_at AS location_updated_at,
      COUNT(sb.id) FILTER (WHERE sb.quantity > 0)::BIGINT AS location_total_items,
      COALESCE(SUM(sb.quantity) FILTER (WHERE sb.quantity > 0), 0)::NUMERIC AS location_total_quantity
    FROM public.locations l
    LEFT JOIN public.stock_balances sb
      ON sb.location_id = l.id
    GROUP BY
      l.id,
      l.code,
      l.zone,
      l.aisle,
      l.rack,
      l.level,
      l.location_type,
      l.capacity,
      l.status,
      l.created_at,
      l.updated_at
  ),
  derived AS (
    SELECT
      lt.*,
      CASE
        WHEN lt.location_stored_status IN ('blocked', 'maintenance', 'reserved')
          THEN lt.location_stored_status
        WHEN lt.location_total_quantity > 0 THEN 'occupied'
        ELSE 'available'
      END AS location_display_status
    FROM location_totals lt
  ),
  filtered AS (
    SELECT d.*
    FROM derived d
    WHERE (
      v_query IS NULL
      OR d.location_code ILIKE '%' || v_query || '%'
      OR d.location_zone ILIKE '%' || v_query || '%'
      OR COALESCE(d.location_aisle, '') ILIKE '%' || v_query || '%'
      OR COALESCE(d.location_rack, '') ILIKE '%' || v_query || '%'
      OR COALESCE(d.location_level, '') ILIKE '%' || v_query || '%'
    )
    AND (v_status IS NULL OR d.location_display_status = v_status)
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER ()::BIGINT AS result_total_count
    FROM filtered f
  )
  SELECT
    c.location_id,
    c.location_code,
    c.location_zone,
    c.location_aisle,
    c.location_rack,
    c.location_level,
    c.location_kind,
    c.location_capacity,
    c.location_stored_status,
    c.location_display_status,
    c.location_created_at,
    c.location_updated_at,
    c.location_total_items,
    c.location_total_quantity,
    CASE
      WHEN COALESCE(c.location_capacity, 0) > 0
        THEN LEAST(100::NUMERIC, (c.location_total_quantity / c.location_capacity) * 100)
      ELSE 0::NUMERIC
    END,
    c.result_total_count
  FROM counted c
  ORDER BY c.location_zone ASC, c.location_code ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_location_map_stats()
RETURNS TABLE (
  total_locations BIGINT,
  available_locations BIGINT,
  occupied_locations BIGINT,
  unavailable_locations BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.user_role() IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil ativo';
  END IF;

  RETURN QUERY
  WITH location_totals AS (
    SELECT
      l.id,
      l.status,
      COALESCE(SUM(sb.quantity) FILTER (WHERE sb.quantity > 0), 0)::NUMERIC AS total_quantity
    FROM public.locations l
    LEFT JOIN public.stock_balances sb
      ON sb.location_id = l.id
    GROUP BY l.id, l.status
  ),
  derived AS (
    SELECT
      CASE
        WHEN lt.status IN ('blocked', 'maintenance', 'reserved') THEN lt.status
        WHEN lt.total_quantity > 0 THEN 'occupied'
        ELSE 'available'
      END AS display_status
    FROM location_totals lt
  )
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE d.display_status = 'available')::BIGINT,
    COUNT(*) FILTER (WHERE d.display_status = 'occupied')::BIGINT,
    COUNT(*) FILTER (WHERE d.display_status IN ('blocked', 'maintenance'))::BIGINT
  FROM derived d;
END;
$$;

REVOKE ALL ON FUNCTION public.search_locations_with_occupancy(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_locations_with_occupancy(TEXT, TEXT, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_locations_with_occupancy(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_location_map_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_location_map_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_location_map_stats() TO authenticated;
