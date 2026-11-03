-- ========================================
-- Annona Mercis WMS - Migration 022
-- Agrega precisão de inventário no banco para evitar baixar histórico completo no cliente
-- ========================================

CREATE OR REPLACE FUNCTION public.get_inventory_accuracy(
  p_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
  accuracy NUMERIC,
  total_lines BIGINT,
  accurate_lines BIGINT,
  discrepancies BIGINT
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
  WITH metrics AS (
    SELECT
      COUNT(*)::BIGINT AS total_lines,
      COUNT(*) FILTER (
        WHERE scl.system_quantity = scl.counted_quantity
      )::BIGINT AS accurate_lines
    FROM public.stock_count_lines scl
    JOIN public.stock_counts sc ON sc.id = scl.stock_count_id
    WHERE sc.status = 'completed'
      AND (p_location_id IS NULL OR scl.location_id = p_location_id)
  )
  SELECT
    CASE
      WHEN metrics.total_lines = 0 THEN 100::NUMERIC
      ELSE (metrics.accurate_lines::NUMERIC * 100) / metrics.total_lines::NUMERIC
    END AS accuracy,
    metrics.total_lines,
    metrics.accurate_lines,
    (metrics.total_lines - metrics.accurate_lines)::BIGINT AS discrepancies
  FROM metrics;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_accuracy(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_inventory_accuracy(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_accuracy(UUID) TO authenticated;
