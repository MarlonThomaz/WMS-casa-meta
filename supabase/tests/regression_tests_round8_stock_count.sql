-- ========================================
-- WMS Casa Meta - Regressões de estoque e contagem
-- Executar somente em banco descartável de teste.
-- ========================================

BEGIN;

-- ========================================
-- STOCK-8.1: movimentação manual não consome estoque reservado
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product UUID;
  v_location UUID;
  v_shipment UUID;
  v_quantity_before NUMERIC;
  v_reserved_before NUMERIC;
  v_failed BOOLEAN := false;
  v_reference_count INTEGER;
BEGIN
  SELECT id INTO STRICT v_product FROM public.products WHERE sku = 'SKU-005';
  SELECT id INTO STRICT v_location FROM public.locations WHERE code = 'PICK-02';
  SELECT quantity, reserved_quantity
    INTO v_quantity_before, v_reserved_before
    FROM public.stock_balances
   WHERE product_id = v_product AND location_id = v_location;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  v_shipment := public.create_shipment_with_lines(
    'Cliente reserva',
    'TEST-R8-RESERVED-GUARD',
    NULL,
    'medium',
    CURRENT_DATE,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product,
        'requested_quantity', 45,
        'from_location_id', v_location,
        'unit', 'un'
      )
    )
  );

  PERFORM public.reserve_stock_for_shipment(v_shipment);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  BEGIN
    PERFORM public.create_and_process_movement(
      'outbound',
      'TEST-R8-OUTBOUND-RESERVED',
      'Não pode consumir unidades já reservadas',
      jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product,
          'from_location_id', v_location,
          'quantity', 10,
          'unit', 'un'
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Estoque disponível insuficiente%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  PERFORM set_config('wms.internal_status_transition', 'off', true);

  IF NOT v_failed THEN
    RAISE EXCEPTION 'STOCK-8.1: saída manual consumiu estoque reservado';
  END IF;

  IF (SELECT quantity FROM public.stock_balances
       WHERE product_id = v_product AND location_id = v_location) <> v_quantity_before THEN
    RAISE EXCEPTION 'STOCK-8.1: tentativa rejeitada alterou quantidade';
  END IF;

  SELECT COUNT(*) INTO v_reference_count
    FROM public.movements
   WHERE source_reference = 'TEST-R8-OUTBOUND-RESERVED';

  IF v_reference_count <> 0 THEN
    RAISE EXCEPTION 'STOCK-8.1: tentativa rejeitada deixou movimento órfão';
  END IF;

  PERFORM public.release_shipment_reservations(v_shipment);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  IF (SELECT reserved_quantity FROM public.stock_balances
       WHERE product_id = v_product AND location_id = v_location) <> v_reserved_before THEN
    RAISE EXCEPTION 'STOCK-8.1: reserva não voltou ao valor inicial após cancelamento';
  END IF;
END $$;

-- ========================================
-- COUNT-8.1: movimento posterior ao instante contado é preservado
-- snapshot=Q, contado=Q-5, entrada posterior=+7 => final=Q+2
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product UUID;
  v_location UUID;
  v_count UUID;
  v_line UUID;
  v_initial NUMERIC;
  v_final NUMERIC;
  v_status TEXT;
  v_count_number TEXT;
  v_adjustment_sum NUMERIC;
BEGIN
  SELECT id INTO STRICT v_product FROM public.products WHERE sku = 'SKU-002';
  SELECT id INTO STRICT v_location FROM public.locations WHERE code = 'PICK-01';
  SELECT quantity INTO STRICT v_initial
    FROM public.stock_balances
   WHERE product_id = v_product AND location_id = v_location;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  v_count := public.create_stock_count_with_snapshot('cycle', v_location, 'Regressão movimentos posteriores');
  SELECT count_number INTO v_count_number FROM public.stock_counts WHERE id = v_count;

  UPDATE public.stock_counts
     SET status = 'in_progress'
   WHERE id = v_count;

  SELECT id INTO STRICT v_line
    FROM public.stock_count_lines
   WHERE stock_count_id = v_count
     AND product_id = v_product
     AND location_id = v_location;

  -- Simula uma contagem física registrada antes da movimentação posterior.
  UPDATE public.stock_count_lines
     SET counted_quantity = v_initial - 5,
         counted_at = '2020-01-01 00:00:00+00'::timestamptz
   WHERE id = v_line;

  PERFORM public.create_and_process_movement(
    'inbound',
    'TEST-R8-POST-COUNT-INBOUND',
    'Entrada legítima após a contagem física',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product,
        'to_location_id', v_location,
        'quantity', 7,
        'unit', 'un'
      )
    )
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  IF (SELECT quantity FROM public.stock_balances
       WHERE product_id = v_product AND location_id = v_location) <> v_initial + 7 THEN
    RAISE EXCEPTION 'COUNT-8.1: movimento posterior não foi aplicado antes da reconciliação';
  END IF;

  PERFORM public.process_stock_count_adjustments(v_count);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT quantity INTO v_final
    FROM public.stock_balances
   WHERE product_id = v_product AND location_id = v_location;

  SELECT status INTO v_status FROM public.stock_counts WHERE id = v_count;

  IF v_status <> 'completed' THEN
    RAISE EXCEPTION 'COUNT-8.1: contagem não concluiu: %', v_status;
  END IF;

  IF v_final <> v_initial + 2 THEN
    RAISE EXCEPTION 'COUNT-8.1: esperado saldo final %, recebido %', v_initial + 2, v_final;
  END IF;

  -- A reconciliação deve aplicar -5, preservando a entrada +7.
  SELECT COALESCE(SUM(
    CASE WHEN ml.to_location_id = v_location THEN ml.quantity ELSE 0 END
    - CASE WHEN ml.from_location_id = v_location THEN ml.quantity ELSE 0 END
  ), 0)
    INTO v_adjustment_sum
    FROM public.movement_lines ml
    JOIN public.movements m ON m.id = ml.movement_id
   WHERE m.source_reference = v_count_number
     AND m.movement_type = 'adjustment'
     AND m.status = 'completed'
     AND ml.product_id = v_product;

  IF v_adjustment_sum <> -5 THEN
    RAISE EXCEPTION 'COUNT-8.1: ajuste esperado -5, recebido %', v_adjustment_sum;
  END IF;
END $$;

-- ========================================
-- COUNT-8.2: precisão considera somente contagens concluídas
-- e respeita filtro por localização.
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_location UUID;
  v_count UUID;
  v_line_count BIGINT;
  v_before_total BIGINT;
  v_before_accurate BIGINT;
  v_before_discrepancies BIGINT;
  v_pending_total BIGINT;
  v_pending_accurate BIGINT;
  v_pending_discrepancies BIGINT;
  v_after_total BIGINT;
  v_after_accurate BIGINT;
  v_after_discrepancies BIGINT;
BEGIN
  SELECT id INTO STRICT v_location FROM public.locations WHERE code = 'PICK-02';

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT total_lines, accurate_lines, discrepancies
    INTO v_before_total, v_before_accurate, v_before_discrepancies
    FROM public.get_inventory_accuracy(v_location);

  v_count := public.create_stock_count_with_snapshot(
    'cycle',
    v_location,
    'Regressão da precisão agregada'
  );

  UPDATE public.stock_count_lines
     SET counted_quantity = system_quantity + 999,
         counted_at = NOW()
   WHERE stock_count_id = v_count;

  SELECT COUNT(*) INTO v_line_count
    FROM public.stock_count_lines
   WHERE stock_count_id = v_count;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'COUNT-8.2: fixture não criou linhas para PICK-02';
  END IF;

  -- Enquanto a contagem estiver pendente, ela não pode alterar a precisão.
  SELECT total_lines, accurate_lines, discrepancies
    INTO v_pending_total, v_pending_accurate, v_pending_discrepancies
    FROM public.get_inventory_accuracy(v_location);

  IF v_pending_total <> v_before_total
     OR v_pending_accurate <> v_before_accurate
     OR v_pending_discrepancies <> v_before_discrepancies THEN
    RAISE EXCEPTION 'COUNT-8.2: contagem pendente afetou a métrica';
  END IF;

  -- Promove somente a fixture para concluída sem reconciliar estoque;
  -- o objetivo aqui é testar a leitura agregada, não o processamento da contagem.
  PERFORM set_config('wms.internal_status_transition', 'on', true);
  UPDATE public.stock_counts
     SET status = 'completed', completed_at = NOW()
   WHERE id = v_count;
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT total_lines, accurate_lines, discrepancies
    INTO v_after_total, v_after_accurate, v_after_discrepancies
    FROM public.get_inventory_accuracy(v_location);

  IF v_after_total <> v_before_total + v_line_count THEN
    RAISE EXCEPTION 'COUNT-8.2: total esperado %, recebido %',
      v_before_total + v_line_count, v_after_total;
  END IF;

  IF v_after_accurate <> v_before_accurate THEN
    RAISE EXCEPTION 'COUNT-8.2: linhas divergentes foram contadas como corretas';
  END IF;

  IF v_after_discrepancies <> v_before_discrepancies + v_line_count THEN
    RAISE EXCEPTION 'COUNT-8.2: divergências esperadas %, recebidas %',
      v_before_discrepancies + v_line_count, v_after_discrepancies;
  END IF;
END $$;

-- ========================================
-- COUNT-8.3: contagem não pode concluir com linhas não confirmadas
-- e uma tentativa rejeitada não pode deixar ajuste parcial.
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_location UUID;
  v_count UUID;
  v_count_number TEXT;
  v_total_before NUMERIC;
  v_total_after NUMERIC;
  v_unconfirmed BIGINT;
  v_movements BIGINT;
  v_status TEXT;
  v_failed BOOLEAN := false;
BEGIN
  SELECT id INTO STRICT v_location FROM public.locations WHERE code = 'PICK-01';

  SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_before
    FROM public.stock_balances
   WHERE location_id = v_location;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  v_count := public.create_stock_count_with_snapshot(
    'cycle',
    v_location,
    'Regressão exige confirmação física'
  );

  SELECT count_number INTO v_count_number
    FROM public.stock_counts
   WHERE id = v_count;

  UPDATE public.stock_counts
     SET status = 'in_progress'
   WHERE id = v_count;

  SELECT COUNT(*) INTO v_unconfirmed
    FROM public.stock_count_lines
   WHERE stock_count_id = v_count
     AND counted_at IS NULL;

  IF v_unconfirmed = 0 THEN
    RAISE EXCEPTION 'COUNT-8.3: snapshot nasceu indevidamente como já contado';
  END IF;

  -- Cria divergência artificial, mas NÃO confirma fisicamente counted_at.
  -- Se a conclusão falhar no fim da RPC, todo ajuste intermediário deve ser revertido.
  UPDATE public.stock_count_lines
     SET counted_quantity = system_quantity + 1
   WHERE stock_count_id = v_count;

  BEGIN
    PERFORM public.process_stock_count_adjustments(v_count);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Contagem possui linhas ainda não confirmadas fisicamente%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  PERFORM set_config('wms.internal_status_transition', 'off', true);

  IF NOT v_failed THEN
    RAISE EXCEPTION 'COUNT-8.3: contagem não confirmada foi concluída';
  END IF;

  SELECT status INTO v_status
    FROM public.stock_counts
   WHERE id = v_count;

  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION 'COUNT-8.3: status mudou apesar da conclusão rejeitada: %', v_status;
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_after
    FROM public.stock_balances
   WHERE location_id = v_location;

  IF v_total_after <> v_total_before THEN
    RAISE EXCEPTION 'COUNT-8.3: tentativa rejeitada alterou saldo: antes %, depois %',
      v_total_before, v_total_after;
  END IF;

  SELECT COUNT(*) INTO v_movements
    FROM public.movements
   WHERE source_reference = v_count_number;

  IF v_movements <> 0 THEN
    RAISE EXCEPTION 'COUNT-8.3: tentativa rejeitada deixou ajuste órfão';
  END IF;
END $$;

ROLLBACK;