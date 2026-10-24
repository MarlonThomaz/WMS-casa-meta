-- ========================================
-- WMS Casa Meta - Barcode registration regressions
-- Executar somente em banco descartável de teste.
-- ========================================

BEGIN;

DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_location UUID;
  v_product UUID;
  v_balance NUMERIC;
  v_movement_count INTEGER;
  v_failed BOOLEAN := false;
  v_orphans INTEGER;
BEGIN
  SELECT id INTO STRICT v_location
    FROM public.locations
   WHERE code = 'RECV-01';

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  v_product := public.register_product_with_barcode(
    'TEST-R8-BARCODE-SKU',
    'Produto Barcode Round8',
    'Cadastro atômico de regressão',
    'Teste',
    'un',
    1,
    20,
    '7891234567890',
    'EAN13',
    'unit',
    1,
    v_location,
    3
  );

  IF v_product IS NULL THEN
    RAISE EXCEPTION 'BAR-8.1: RPC não retornou produto';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.product_barcodes
     WHERE product_id = v_product
       AND barcode = '7891234567890'
       AND is_primary = true
  ) THEN
    RAISE EXCEPTION 'BAR-8.1: barcode principal não foi persistido';
  END IF;

  SELECT quantity INTO v_balance
    FROM public.stock_balances
   WHERE product_id = v_product
     AND location_id = v_location;

  IF v_balance <> 3 THEN
    RAISE EXCEPTION 'BAR-8.1: estoque inicial esperado 3, recebido %', v_balance;
  END IF;

  SELECT COUNT(*) INTO v_movement_count
    FROM public.movements
   WHERE source_reference = 'INITIAL:TEST-R8-BARCODE-SKU'
     AND movement_type = 'inbound'
     AND status = 'completed';

  IF v_movement_count <> 1 THEN
    RAISE EXCEPTION 'BAR-8.1: esperado um movimento inbound concluído, encontrado %', v_movement_count;
  END IF;

  -- Um barcode duplicado deve abortar produto + barcode + eventual estoque
  -- como uma única transação, sem SKU órfão.
  BEGIN
    PERFORM public.register_product_with_barcode(
      'TEST-R8-BARCODE-ORPHAN',
      'Produto que deve fazer rollback',
      NULL,
      'Teste',
      'un',
      0,
      NULL,
      '7891234567890',
      'EAN13',
      'unit',
      1,
      NULL,
      0
    );
  EXCEPTION WHEN unique_violation THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'BAR-8.2: barcode duplicado foi aceito';
  END IF;

  SELECT COUNT(*) INTO v_orphans
    FROM public.products
   WHERE sku = 'TEST-R8-BARCODE-ORPHAN';

  IF v_orphans <> 0 THEN
    RAISE EXCEPTION 'BAR-8.2: produto órfão persistiu após rollback';
  END IF;
END $$;

ROLLBACK;
