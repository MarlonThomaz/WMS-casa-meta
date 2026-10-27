-- ========================================
-- WMS Casa Meta - Regressões de expedição
-- Executar somente em banco descartável de teste.
-- ========================================

BEGIN;

DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product_a UUID;
  v_product_b UUID;
  v_location_a UUID;
  v_location_b UUID;
  v_shipment UUID;
  v_shipment_number TEXT;
  v_line_a UUID;
  v_line_b UUID;
  v_qty_a_before NUMERIC;
  v_qty_b_before NUMERIC;
  v_reserved_a_before NUMERIC;
  v_reserved_b_before NUMERIC;
  v_qty_a_after NUMERIC;
  v_qty_b_after NUMERIC;
  v_reserved_a_after NUMERIC;
  v_reserved_b_after NUMERIC;
  v_status TEXT;
  v_released_count INTEGER;
  v_movement_lines INTEGER;
BEGIN
  SELECT id INTO STRICT v_product_a FROM public.products WHERE sku = 'SKU-002';
  SELECT id INTO STRICT v_product_b FROM public.products WHERE sku = 'SKU-005';
  SELECT id INTO STRICT v_location_a FROM public.locations WHERE code = 'PICK-01';
  SELECT id INTO STRICT v_location_b FROM public.locations WHERE code = 'PICK-02';

  SELECT quantity, reserved_quantity
    INTO v_qty_a_before, v_reserved_a_before
    FROM public.stock_balances
   WHERE product_id = v_product_a AND location_id = v_location_a;

  SELECT quantity, reserved_quantity
    INTO v_qty_b_before, v_reserved_b_before
    FROM public.stock_balances
   WHERE product_id = v_product_b AND location_id = v_location_b;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  v_shipment := public.create_shipment_with_lines(
    'Cliente regressão expedição',
    'TEST-R8-SHIP-PARTIAL-ZERO',
    'Transportadora Teste',
    'medium',
    CURRENT_DATE,
    'Picking parcial com uma linha zerada',
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_a,
        'requested_quantity', 10,
        'from_location_id', v_location_a,
        'unit', 'un'
      ),
      jsonb_build_object(
        'product_id', v_product_b,
        'requested_quantity', 5,
        'from_location_id', v_location_b,
        'unit', 'un'
      )
    )
  );

  SELECT shipment_number INTO v_shipment_number
    FROM public.shipments WHERE id = v_shipment;

  SELECT id INTO STRICT v_line_a
    FROM public.shipment_lines
   WHERE shipment_id = v_shipment AND product_id = v_product_a;

  SELECT id INTO STRICT v_line_b
    FROM public.shipment_lines
   WHERE shipment_id = v_shipment AND product_id = v_product_b;

  PERFORM public.reserve_stock_for_shipment(v_shipment);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  IF (SELECT reserved_quantity FROM public.stock_balances
       WHERE product_id = v_product_a AND location_id = v_location_a)
       <> v_reserved_a_before + 10 THEN
    RAISE EXCEPTION 'SHIP-8.1: reserva da linha A não foi criada corretamente';
  END IF;

  IF (SELECT reserved_quantity FROM public.stock_balances
       WHERE product_id = v_product_b AND location_id = v_location_b)
       <> v_reserved_b_before + 5 THEN
    RAISE EXCEPTION 'SHIP-8.1: reserva da linha B não foi criada corretamente';
  END IF;

  UPDATE public.shipment_lines SET picked_quantity = 6 WHERE id = v_line_a;
  UPDATE public.shipment_lines SET picked_quantity = 0 WHERE id = v_line_b;

  PERFORM public.confirm_shipment_picked(v_shipment);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment;
  IF v_status <> 'packed' THEN
    RAISE EXCEPTION 'SHIP-8.1: status esperado packed, recebido %', v_status;
  END IF;

  SELECT quantity, reserved_quantity
    INTO v_qty_a_after, v_reserved_a_after
    FROM public.stock_balances
   WHERE product_id = v_product_a AND location_id = v_location_a;

  SELECT quantity, reserved_quantity
    INTO v_qty_b_after, v_reserved_b_after
    FROM public.stock_balances
   WHERE product_id = v_product_b AND location_id = v_location_b;

  IF v_qty_a_after <> v_qty_a_before - 6 THEN
    RAISE EXCEPTION 'SHIP-8.1: quantidade A esperada %, recebida %', v_qty_a_before - 6, v_qty_a_after;
  END IF;

  IF v_qty_b_after <> v_qty_b_before THEN
    RAISE EXCEPTION 'SHIP-8.1: linha B com picked=0 alterou quantidade física';
  END IF;

  IF v_reserved_a_after <> v_reserved_a_before OR v_reserved_b_after <> v_reserved_b_before THEN
    RAISE EXCEPTION 'SHIP-8.1: reserva fantasma após picking parcial: A %, B %', v_reserved_a_after, v_reserved_b_after;
  END IF;

  SELECT COUNT(*) INTO v_released_count
    FROM public.shipment_lines
   WHERE shipment_id = v_shipment
     AND reservations_released = true;

  IF v_released_count <> 2 THEN
    RAISE EXCEPTION 'SHIP-8.1: todas as linhas deveriam estar com reservas liberadas';
  END IF;

  SELECT COUNT(*) INTO v_movement_lines
    FROM public.movement_lines ml
    JOIN public.movements m ON m.id = ml.movement_id
   WHERE m.source_reference = v_shipment_number
     AND m.movement_type = 'outbound'
     AND m.status = 'completed';

  IF v_movement_lines <> 1 THEN
    RAISE EXCEPTION 'SHIP-8.1: esperado 1 movimento físico de saída, encontrado %', v_movement_lines;
  END IF;

  -- packed -> shipped é uma transição operacional segura e deve funcionar.
  UPDATE public.shipments
     SET status = 'shipped',
         actual_date = CURRENT_DATE,
         completed_at = NOW()
   WHERE id = v_shipment;

  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment;
  IF v_status <> 'shipped' THEN
    RAISE EXCEPTION 'SHIP-8.1: despacho final não chegou a shipped';
  END IF;
END $$;

-- ========================================
-- SHIP-8.2: nenhuma unidade separada cancela e libera tudo
-- ========================================
DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product UUID;
  v_location UUID;
  v_shipment UUID;
  v_reserved_before NUMERIC;
  v_reserved_after NUMERIC;
  v_quantity_before NUMERIC;
  v_quantity_after NUMERIC;
  v_status TEXT;
BEGIN
  SELECT id INTO STRICT v_product FROM public.products WHERE sku = 'SKU-002';
  SELECT id INTO STRICT v_location FROM public.locations WHERE code = 'PICK-01';
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
    'Cliente regressão zero',
    'TEST-R8-SHIP-ZERO',
    NULL,
    'low',
    CURRENT_DATE,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product,
        'requested_quantity', 2,
        'from_location_id', v_location,
        'unit', 'un'
      )
    )
  );

  PERFORM public.reserve_stock_for_shipment(v_shipment);
  PERFORM set_config('wms.internal_status_transition', 'off', true);
  PERFORM public.confirm_shipment_picked(v_shipment);
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  SELECT status INTO v_status FROM public.shipments WHERE id = v_shipment;
  SELECT quantity, reserved_quantity
    INTO v_quantity_after, v_reserved_after
    FROM public.stock_balances
   WHERE product_id = v_product AND location_id = v_location;

  IF v_status <> 'cancelled' THEN
    RAISE EXCEPTION 'SHIP-8.2: expected cancelled, received %', v_status;
  END IF;

  IF v_quantity_after <> v_quantity_before OR v_reserved_after <> v_reserved_before THEN
    RAISE EXCEPTION 'SHIP-8.2: cancelamento vazio alterou saldo/reserva';
  END IF;
END $$;

ROLLBACK;
