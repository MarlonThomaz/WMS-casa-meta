-- ========================================
-- Annona Mercis WMS - Migration 026
-- Funções internas de trigger não fazem parte da API pública do WMS.
-- ========================================

REVOKE ALL ON FUNCTION public.require_confirmed_stock_count_lines() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.require_confirmed_stock_count_lines() FROM anon;
REVOKE ALL ON FUNCTION public.require_confirmed_stock_count_lines() FROM authenticated;
