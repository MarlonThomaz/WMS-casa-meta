-- ========================================
-- WMS Casa Meta - Migration 018
-- ACL de funções para Supabase hospedado
-- ========================================
-- Em projetos Supabase hospedados, default privileges podem conceder EXECUTE
-- explicitamente a anon/authenticated em funções novas. Como várias funções
-- do WMS usam SECURITY DEFINER, o acesso de cliente precisa ser uma allowlist.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Novas funções criadas pelo mesmo owner não devem nascer executáveis por clientes.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Função usada pelas políticas RLS.
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- RPCs operacionais públicas.
GRANT EXECUTE ON FUNCTION public.process_stock_movement(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_shipment_reservations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_shipment_picked(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_receipt_atomically(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_stock_count_adjustments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_receipt_with_lines(TEXT, TEXT, DATE, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shipment_with_lines(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_and_process_movement(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_count_with_snapshot(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_product_with_barcode(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, NUMERIC, UUID, NUMERIC
) TO authenticated;

-- RPCs de leitura usadas pelo frontend.
GRANT EXECUTE ON FUNCTION public.get_product_total_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_stock_by_location(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_location_occupancy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_product_by_barcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_products_with_stock() TO authenticated;
