-- ========================================
-- Annona Mercis WMS - Migration 028
-- Dashboard agregado no banco para evitar carregar todo o catálogo no cliente
-- ========================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  total_products BIGINT,
  total_stock NUMERIC,
  low_stock_products BIGINT,
  low_stock_items JSONB,
  occupied_locations BIGINT,
  total_locations BIGINT,
  pending_receipts BIGINT,
  pending_shipments BIGINT
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
  WITH product_totals AS (
    SELECT
      p.id,
      p.sku,
      p.name,
      p.unit_base,
      p.min_stock,
      COALESCE(SUM(sb.quantity), 0)::NUMERIC AS product_total_stock
    FROM public.products p
    LEFT JOIN public.stock_balances sb
      ON sb.product_id = p.id
    WHERE p.active = true
    GROUP BY p.id, p.sku, p.name, p.unit_base, p.min_stock
  ),
  low_stock_sample AS (
    SELECT
      pt.id,
      pt.sku,
      pt.name,
      pt.product_total_stock,
      pt.min_stock,
      pt.unit_base
    FROM product_totals pt
    WHERE pt.product_total_stock <= pt.min_stock
    ORDER BY pt.product_total_stock ASC, pt.sku ASC
    LIMIT 6
  ),
  low_stock_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ls.id,
          'sku', ls.sku,
          'name', ls.name,
          'total_stock', ls.product_total_stock,
          'min_stock', ls.min_stock,
          'unit_base', ls.unit_base
        )
        ORDER BY ls.product_total_stock ASC, ls.sku ASC
      ),
      '[]'::jsonb
    ) AS items
    FROM low_stock_sample ls
  )
  SELECT
    (SELECT COUNT(*) FROM product_totals)::BIGINT,
    (SELECT COALESCE(SUM(pt.product_total_stock), 0) FROM product_totals pt)::NUMERIC,
    (SELECT COUNT(*) FROM product_totals pt WHERE pt.product_total_stock <= pt.min_stock)::BIGINT,
    (SELECT lj.items FROM low_stock_json lj),
    (
      SELECT COUNT(*)
      FROM public.locations l
      WHERE EXISTS (
        SELECT 1
        FROM public.stock_balances sb
        WHERE sb.location_id = l.id
          AND sb.quantity > 0
      )
    )::BIGINT,
    (SELECT COUNT(*) FROM public.locations)::BIGINT,
    (
      SELECT COUNT(*)
      FROM public.receipts r
      WHERE r.status IN ('pending', 'partial')
    )::BIGINT,
    (
      SELECT COUNT(*)
      FROM public.shipments s
      WHERE s.status IN ('pending', 'picking')
    )::BIGINT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
