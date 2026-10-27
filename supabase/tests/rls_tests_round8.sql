-- ========================================
-- WMS Casa Meta - RLS Round 8
-- Requer fixtures de CI e grants equivalentes ao ambiente Supabase.
-- ========================================

BEGIN;
SET LOCAL ROLE authenticated;

-- ========================================
-- RLS-8.1: viewer lê catálogo, mas não cria produto
-- ========================================
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_visible INTEGER;
  v_blocked BOOLEAN := false;
BEGIN
  SELECT COUNT(*) INTO v_visible FROM public.products;
  IF v_visible = 0 THEN
    RAISE EXCEPTION 'RLS-8.1: viewer não conseguiu ler catálogo';
  END IF;

  BEGIN
    INSERT INTO public.products (sku, name, unit_base, min_stock, active)
    VALUES ('TEST-R8-VIEWER-PRODUCT', 'Produto indevido viewer', 'un', 0, true);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'RLS-8.1: viewer conseguiu criar produto';
  END IF;
END $$;

-- ========================================
-- RLS-8.2: operator pode criar produto, mas não localização
-- ========================================
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_product UUID;
  v_location_blocked BOOLEAN := false;
BEGIN
  INSERT INTO public.products (sku, name, unit_base, min_stock, active)
  VALUES ('TEST-R8-OP-PRODUCT', 'Produto operator', 'un', 0, true)
  RETURNING id INTO v_product;

  IF v_product IS NULL THEN
    RAISE EXCEPTION 'RLS-8.2: operator não conseguiu criar produto';
  END IF;

  BEGIN
    INSERT INTO public.locations (code, zone, location_type, status)
    VALUES ('TEST-R8-OP-LOC', 'T', 'storage', 'available');
  EXCEPTION WHEN insufficient_privilege THEN
    v_location_blocked := true;
  WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      v_location_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_location_blocked THEN
    RAISE EXCEPTION 'RLS-8.2: operator conseguiu criar localização';
  END IF;
END $$;

-- ========================================
-- RLS-8.3: manager pode manter localização
-- ========================================
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_location UUID;
BEGIN
  INSERT INTO public.locations (
    code, zone, location_type, status, capacity
  ) VALUES (
    'TEST-R8-MGR-LOC', 'T', 'storage', 'available', 100
  )
  RETURNING id INTO v_location;

  UPDATE public.locations
     SET capacity = 120
   WHERE id = v_location;

  IF NOT EXISTS (
    SELECT 1
      FROM public.locations
     WHERE id = v_location
       AND capacity = 120
  ) THEN
    RAISE EXCEPTION 'RLS-8.3: manager não conseguiu manter localização';
  END IF;
END $$;

-- ========================================
-- RLS-8.4: operator não edita linha de recebimento alheia
-- ========================================
RESET ROLE;

-- O owner cria uma operação pertencente ao admin para o teste de isolamento.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_admin UUID := '10000000-0000-0000-0000-000000000001';
  v_product UUID;
  v_location UUID;
  v_receipt UUID;
BEGIN
  SELECT id INTO STRICT v_product FROM public.products WHERE sku = 'SKU-001';
  SELECT id INTO STRICT v_location FROM public.locations WHERE code = 'RECV-01';

  INSERT INTO public.receipts (
    id, receipt_number, supplier_name, status, operator_id, created_by
  ) VALUES (
    gen_random_uuid(), 'TEST-R8-ADMIN-RECEIPT', 'Admin Supplier', 'pending', v_admin, v_admin
  ) RETURNING id INTO v_receipt;

  INSERT INTO public.receipt_lines (
    receipt_id, product_id, expected_quantity, received_quantity, location_id, unit
  ) VALUES (
    v_receipt, v_product, 5, 0, v_location, 'un'
  );
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.receipt_lines rl
     SET received_quantity = 1
    FROM public.receipts r
   WHERE r.id = rl.receipt_id
     AND r.receipt_number = 'TEST-R8-ADMIN-RECEIPT';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 0 THEN
    RAISE EXCEPTION 'RLS-8.4: operator alterou linha de recebimento alheia';
  END IF;
END $$;

ROLLBACK;
