-- ========================================
-- Annona Mercis WMS - Regressões de disponibilidade de endereços
-- Executar somente em banco descartável de teste.
-- ========================================

BEGIN;

DO $$
DECLARE
  v_operator UUID := '10000000-0000-0000-0000-000000000002';
  v_product UUID;
  v_origin UUID;
  v_blocked UUID;
  v_receipt UUID;
  v_receipt_number TEXT;
  v_failed BOOLEAN := false;
  v_count INTEGER;
BEGIN
  SELECT id INTO STRICT v_product FROM public.products WHERE sku = 'SKU-005';
  SELECT id INTO STRICT v_origin FROM public.locations WHERE code = 'PICK-02';

  INSERT INTO public.locations (
    code, zone, aisle, rack, level, location_type, capacity, status
  ) VALUES (
    'TEST-BLOCKED-R8', 'TEST', 'B', '01', '01', 'storage', 1000, 'blocked'
  )
  RETURNING id INTO v_blocked;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_operator, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('wms.internal_status_transition', 'off', true);

  -- LOC-8.1: transferência manual para endereço bloqueado é rejeitada
  BEGIN
    PERFORM public.create_and_process_movement(
      'transfer',
      'TEST-R8-BLOCKED-TRANSFER',
      'Não deve armazenar em posição bloqueada',
      jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product,
          'from_location_id', v_origin,
          'to_location_id', v_blocked,
          'quantity', 1,
          'unit', 'un'
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Localização de destino % está indisponível (blocked)%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'LOC-8.1: transferência para endereço bloqueado foi aceita';
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.movements
   WHERE source_reference = 'TEST-R8-BLOCKED-TRANSFER';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'LOC-8.1: tentativa rejeitada deixou movimento órfão';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.stock_balances
     WHERE product_id = v_product
       AND location_id = v_blocked
       AND quantity <> 0
  ) THEN
    RAISE EXCEPTION 'LOC-8.1: tentativa rejeitada alterou saldo no endereço bloqueado';
  END IF;

  -- LOC-8.2: recebimento pode ter sido criado antes do bloqueio, mas o
  -- processamento deve revalidar a disponibilidade no instante da entrada.
  v_receipt := public.create_receipt_with_lines(
    'Fornecedor endereço bloqueado',
    'TEST-R8-BLOCKED-RECEIPT',
    CURRENT_DATE,
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product,
        'expected_quantity', 2,
        'location_id', v_blocked,
        'unit', 'un'
      )
    )
  );

  SELECT receipt_number INTO v_receipt_number
    FROM public.receipts
   WHERE id = v_receipt;

  UPDATE public.receipt_lines
     SET received_quantity = 2
   WHERE receipt_id = v_receipt;

  v_failed := false;
  BEGIN
    PERFORM public.process_receipt_atomically(v_receipt);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Localização de destino % está indisponível (blocked)%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  PERFORM set_config('wms.internal_status_transition', 'off', true);

  IF NOT v_failed THEN
    RAISE EXCEPTION 'LOC-8.2: recebimento para endereço bloqueado foi processado';
  END IF;

  IF (SELECT status FROM public.receipts WHERE id = v_receipt) <> 'pending' THEN
    RAISE EXCEPTION 'LOC-8.2: recebimento mudou de status apesar da rejeição';
  END IF;

  IF (SELECT processed_quantity FROM public.receipt_lines WHERE receipt_id = v_receipt LIMIT 1) <> 0 THEN
    RAISE EXCEPTION 'LOC-8.2: linha rejeitada foi marcada como processada';
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.movements
   WHERE source_reference = v_receipt_number;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'LOC-8.2: recebimento rejeitado deixou movimento órfão';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.stock_balances
     WHERE product_id = v_product
       AND location_id = v_blocked
       AND quantity <> 0
  ) THEN
    RAISE EXCEPTION 'LOC-8.2: recebimento rejeitado alterou saldo';
  END IF;
END $$;

ROLLBACK;
