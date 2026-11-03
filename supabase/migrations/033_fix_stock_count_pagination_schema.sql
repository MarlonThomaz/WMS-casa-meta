-- ========================================
-- Annona Mercis WMS - Migration 033
-- Compatibilidade da busca paginada com o schema real de contagens
-- Preserva assinatura pública da RPC da migration 032.
-- ========================================

CREATE OR REPLACE FUNCTION public.search_stock_count_lines(
  p_count_id UUID,
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  stock_count_id UUID,
  product_id UUID,
  location_id UUID,
  system_quantity NUMERIC,
  counted_quantity NUMERIC,
  discrepancy NUMERIC,
  unit TEXT,
  notes TEXT,
  counted_by UUID,
  counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_sku TEXT,
  product_name TEXT,
  location_code TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
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

  IF p_count_id IS NULL THEN
    RAISE EXCEPTION 'Contagem é obrigatória';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      scl.id AS line_id,
      scl.stock_count_id AS line_count_id,
      scl.product_id AS line_product_id,
      scl.location_id AS line_location_id,
      scl.system_quantity AS line_system_quantity,
      scl.counted_quantity AS line_counted_quantity,
      scl.difference AS line_discrepancy,
      p.unit_base AS line_unit,
      scl.notes AS line_notes,
      NULL::UUID AS line_counted_by,
      scl.counted_at AS line_counted_at,
      scl.created_at AS line_created_at,
      NULL::TIMESTAMPTZ AS line_updated_at,
      p.sku AS line_product_sku,
      p.name AS line_product_name,
      l.code AS line_location_code
    FROM public.stock_count_lines scl
    JOIN public.products p ON p.id = scl.product_id
    JOIN public.locations l ON l.id = scl.location_id
    WHERE scl.stock_count_id = p_count_id
      AND (
        v_query IS NULL
        OR p.sku ILIKE '%' || v_query || '%'
        OR p.name ILIKE '%' || v_query || '%'
        OR l.code ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER ()::BIGINT AS result_total_count
    FROM filtered f
  )
  SELECT
    c.line_id,
    c.line_count_id,
    c.line_product_id,
    c.line_location_id,
    c.line_system_quantity,
    c.line_counted_quantity,
    c.line_discrepancy,
    c.line_unit,
    c.line_notes,
    c.line_counted_by,
    c.line_counted_at,
    c.line_created_at,
    c.line_updated_at,
    c.line_product_sku,
    c.line_product_name,
    c.line_location_code,
    c.result_total_count
  FROM counted c
  ORDER BY c.line_location_code ASC, c.line_product_sku ASC, c.line_id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- Campos de compatibilidade sem coluna própria no schema:
-- counted_by e updated_at permanecem NULL até serem modelados em uma
-- alteração deliberada de auditoria, sem inventar dados de operador ou data.
