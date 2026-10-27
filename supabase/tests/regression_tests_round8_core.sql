-- ========================================
-- WMS Casa Meta - Regressões Round 8
-- Requer fixtures de CI com os profiles abaixo.
-- Executar somente em banco descartável de teste.
-- ========================================

BEGIN;

-- IDs preparados pelo workflow de CI.
-- admin:    10000000-0000-0000-0000-000000000001
-- operator: 10000000-0000-0000-0000-000000000002
-- viewer:   10000000-0000-0000-0000-000000000003
-- disabled: 10000000-0000-0000-0000-000000000004

-- ========================================
-- REG-8.1: perfil inativo não recebe role operacional
-- ========================================
DO $$
DECLARE
  v_disabled UUID := '10000000-0000-0000-0000-000000000004';
  v_role TEXT;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_disabled, 'role', 'authenticated')::text,
    true
  );

  SELECT public.user_role() INTO v_role;
  IF v_role IS NOT NULL THEN
    RAISE EXCEPTION 'REG-8.1: perfil inativo recebeu role %', v_role;
  END IF;
END $$;

-- ========================================
-- REG-8.2: operator não consegue falsificar created_by/operator_id
-- ========================================
DO $$
DECLARE
  v_admin UUID := '10000000-0000-0000-0000-000000000001';
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_receipt UUID;
  v_created_by UUID;
  v_operator_id UUID;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );

  INSERT INTO public.receipts (
    receipt_number,
    supplier_name,
    status,
    created_by,
    operator_id
  ) VALUES (
    'TEST-R8-SPOOF',
    'Fornecedor Teste',
    'pending',
    v_admin,
    v_admin
  )
  RETURNING id, created_by, operator_id
  INTO v_receipt, v_created_by, v_operator_id;

  IF v_created_by IS DISTINCT FROM v_operator
     OR v_operator_id IS DISTINCT FROM v_operator THEN
    RAISE EXCEPTION 'REG-8.2: autoria falsificada persistiu';
  END IF;

  DELETE FROM public.receipts WHERE id = v_receipt;
END $$;

-- ========================================
-- REG-8.3: admin de aplicação não finaliza movimento via UPDATE direto
-- ========================================
DO $$
DECLARE
  v_admin UUID := '10000000-0000-0000-0000-000000000001';
  v_movement UUID;
  v_blocked BOOLEAN := false;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  INSERT INTO public.movements (
    reference,
    movement_type,
    status,
    operator_id,
    created_by
  ) VALUES (
    'TEST-R8-DIRECT-STATUS',
    'transfer',
    'pending',
    v_admin,
    v_admin
  )
  RETURNING id INTO v_movement;

  BEGIN
    UPDATE public.movements
       SET status = 'completed'
     WHERE id = v_movement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Transição direta de status não permitida%' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'REG-8.3: UPDATE direto para completed foi aceito';
  END IF;

  DELETE FROM public.movements WHERE id = v_movement;
END $$;

-- ========================================
-- REG-8.4: recebimento parcial é idempotente e completa só o delta
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product UUID;
  v_location UUID;
  v_receipt UUID;
  v_line UUID;
  v_receipt_number TEXT;
  v_initial NUMERIC;
  v_after_first NUMERIC;
  v_after_retry NUMERIC;
  v_after_complete NUMERIC;
  v_status TEXT;
  v_processed NUMERIC;
  v_balance_existed BOOLEAN;
BEGIN
  SELECT id INTO STRICT v_product
    FROM public.products
   WHERE sku = 'SKU-001';

  SELECT id INTO STRICT v_location
    FROM public.locations
   WHERE code = 'RECV-01';

  SELECT EXISTS (
    SELECT 1
      FROM public.stock_balances
     WHERE product_id = v_product
       AND location_id = v_location
  ) INTO v_balance_existed;

  SELECT COALESCE(MAX(quantity), 0)
    INTO v_initial
    FROM public.stock_balances
   WHERE product_id = v_product
     AND location_id = v_location;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  v_receipt := public.create_receipt_with_lines(
    'Fornecedor Round8',
    'TEST-R8-IDEMPOTENCY',
    CURRENT_DATE,
    'RECV-01',
    'Teste de idempotência',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product,
        'expected_quantity', 10,
        'location_id', v_location,
        'unit', 'un'
      )
    )
  );

  SELECT receipt_number
    INTO v_receipt_number
    FROM public.receipts
   WHERE id = v_receipt;

  SELECT id
    INTO STRICT v_line
    FROM public.receipt_lines
   WHERE receipt_id = v_receipt;

  UPDATE public.receipt_lines
     SET received_quantity = 5
   WHERE id = v_line;

  PERFORM public.process_receipt_atomically(v_receipt);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT status INTO v_status
    FROM public.receipts
   WHERE id = v_receipt;

  SELECT quantity INTO v_after_first
    FROM public.stock_balances
   WHERE product_id = v_product
     AND location_id = v_location;

  IF v_status <> 'partial' OR v_after_first <> v_initial + 5 THEN
    RAISE EXCEPTION 'REG-8.4 primeira execução: status %, saldo %',
      v_status, v_after_first;
  END IF;

  PERFORM public.process_receipt_atomically(v_receipt);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT quantity INTO v_after_retry
    FROM public.stock_balances
   WHERE product_id = v_product
     AND location_id = v_location;

  SELECT status INTO v_status
    FROM public.receipts
   WHERE id = v_receipt;

  IF v_after_retry <> v_after_first OR v_status <> 'partial' THEN
    RAISE EXCEPTION 'REG-8.4 retry: status %, saldo %',
      v_status, v_after_retry;
  END IF;

  UPDATE public.receipt_lines
     SET received_quantity = 10
   WHERE id = v_line;

  PERFORM public.process_receipt_atomically(v_receipt);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT quantity INTO v_after_complete
    FROM public.stock_balances
   WHERE product_id = v_product
     AND location_id = v_location;

  SELECT status INTO v_status
    FROM public.receipts
   WHERE id = v_receipt;

  SELECT processed_quantity INTO v_processed
    FROM public.receipt_lines
   WHERE id = v_line;

  IF v_status <> 'completed'
     OR v_after_complete <> v_initial + 10
     OR v_processed <> 10 THEN
    RAISE EXCEPTION 'REG-8.4 conclusão: status %, saldo %, processed %',
      v_status, v_after_complete, v_processed;
  END IF;

  DELETE FROM public.audit_events WHERE entity_id = v_receipt;
  DELETE FROM public.movements WHERE source_reference = v_receipt_number;
  DELETE FROM public.receipts WHERE id = v_receipt;

  IF v_balance_existed THEN
    UPDATE public.stock_balances
       SET quantity = v_initial,
           reserved_quantity = LEAST(reserved_quantity, v_initial)
     WHERE product_id = v_product
       AND location_id = v_location;
  ELSE
    DELETE FROM public.stock_balances
     WHERE product_id = v_product
       AND location_id = v_location;
  END IF;
END $$;

-- ========================================
-- REG-8.5: RPC de criação faz rollback integral se uma linha for inválida
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product UUID;
  v_location UUID;
  v_failed BOOLEAN := false;
  v_headers INTEGER;
BEGIN
  SELECT id INTO STRICT v_product
    FROM public.products
   WHERE sku = 'SKU-002';

  SELECT id INTO STRICT v_location
    FROM public.locations
   WHERE code = 'RECV-01';

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.create_receipt_with_lines(
      'Fornecedor Rollback',
      'TEST-R8-ROLLBACK',
      CURRENT_DATE,
      'RECV-01',
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product,
          'expected_quantity', 1,
          'location_id', v_location
        ),
        jsonb_build_object(
          'product_id', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          'expected_quantity', 1,
          'location_id', v_location
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Produto inválido ou inativo%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'REG-8.5: linha inválida não abortou a RPC';
  END IF;

  SELECT COUNT(*)
    INTO v_headers
    FROM public.receipts
   WHERE supplier_reference = 'TEST-R8-ROLLBACK';

  IF v_headers <> 0 THEN
    RAISE EXCEPTION 'REG-8.5: cabeçalho órfão persistiu';
  END IF;
END $$;

-- ========================================
-- REG-8.6: funções internas e audit logger não são executáveis pelo cliente
-- ========================================
DO $$
BEGIN
  IF has_function_privilege(
    'authenticated',
    'public.process_stock_movement_internal_v8(uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'REG-8.6: authenticated executa função interna de movimento';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.process_stock_count_adjustments_internal_v8(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'REG-8.6: authenticated executa função interna de contagem';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.log_audit_event(text,text,uuid,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'REG-8.6: authenticated pode fabricar evento de auditoria';
  END IF;
END $$;

ROLLBACK;
