-- Read-only verification; intended for privileged, isolated recovery operator.
BEGIN READ ONLY;
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['profiles','products','product_barcodes','locations','stock_balances','movements','movement_lines','receipts','receipt_lines','shipments','shipment_lines','stock_counts','stock_count_lines','audit_events']
  LOOP
    IF to_regclass('public.'||v_table) IS NULL THEN RAISE EXCEPTION 'Tabela ausente: %',v_table; END IF;
  END LOOP;
  IF to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'auth.users ausente'; END IF;
  IF EXISTS(SELECT 1 FROM public.stock_balances WHERE quantity<0 OR reserved_quantity<0 OR reserved_quantity>quantity OR available_quantity IS DISTINCT FROM quantity-reserved_quantity)
  THEN RAISE EXCEPTION 'Invariante de saldo violada'; END IF;
  IF EXISTS(SELECT 1 FROM public.shipment_lines WHERE picked_quantity<0 OR picked_quantity>requested_quantity)
  THEN RAISE EXCEPTION 'Invariante de separação violada'; END IF;
  IF EXISTS(SELECT 1 FROM public.receipt_lines WHERE processed_quantity<0 OR processed_quantity>received_quantity)
  THEN RAISE EXCEPTION 'Invariante de recebimento violada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='import_product_catalog')
  THEN RAISE EXCEPTION 'RPC Round 11 ausente'; END IF;
END $$;
ROLLBACK;
