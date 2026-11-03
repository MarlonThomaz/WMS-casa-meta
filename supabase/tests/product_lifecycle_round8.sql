-- ========================================
-- Annona Mercis WMS - Regressões do ciclo de vida de produto
-- Executar somente em banco descartável de teste.
-- ========================================

BEGIN;

DO $$
DECLARE
  v_product_with_stock UUID;
  v_free_product UUID;
  v_open_product UUID;
  v_location UUID;
  v_receipt UUID;
  v_failed BOOLEAN := false;
BEGIN
  SELECT id INTO STRICT v_product_with_stock
    FROM public.products
   WHERE sku = 'SKU-005';

  SELECT id INTO STRICT v_location
    FROM public.locations
   WHERE code = 'PICK-02';

  -- LIFE-8.1: SKU com saldo físico não pode ser desativado.
  BEGIN
    UPDATE public.products
       SET active = false
     WHERE id = v_product_with_stock;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Produto não pode ser desativado enquanto possuir saldo físico ou reservado%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'LIFE-8.1: produto com saldo foi desativado';
  END IF;

  IF NOT (SELECT active FROM public.products WHERE id = v_product_with_stock) THEN
    RAISE EXCEPTION 'LIFE-8.1: tentativa rejeitada alterou active';
  END IF;

  -- LIFE-8.2: SKU sem saldo e sem operação aberta pode ser arquivado.
  INSERT INTO public.products (
    sku, name, category, unit_base, min_stock, active
  ) VALUES (
    'TEST-R8-LIFECYCLE-FREE', 'Produto livre para desativação', 'TEST', 'un', 0, true
  ) RETURNING id INTO v_free_product;

  UPDATE public.products
     SET active = false
   WHERE id = v_free_product;

  IF (SELECT active FROM public.products WHERE id = v_free_product) THEN
    RAISE EXCEPTION 'LIFE-8.2: produto sem uso não foi desativado';
  END IF;

  -- LIFE-8.3: mesmo sem saldo, recebimento aberto impede desativação,
  -- porque ele poderia voltar a introduzir estoque depois.
  INSERT INTO public.products (
    sku, name, category, unit_base, min_stock, active
  ) VALUES (
    'TEST-R8-LIFECYCLE-OPEN', 'Produto com operação aberta', 'TEST', 'un', 0, true
  ) RETURNING id INTO v_open_product;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', '10000000-0000-0000-0000-000000000002',
      'role', 'authenticated'
    )::text,
    true
  );

  v_receipt := public.create_receipt_with_lines(
    'Fornecedor ciclo de vida',
    'TEST-R8-LIFECYCLE-RECEIPT',
    CURRENT_DATE,
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'product_id', v_open_product,
        'expected_quantity', 1,
        'location_id', v_location,
        'unit', 'un'
      )
    )
  );

  v_failed := false;
  BEGIN
    UPDATE public.products
       SET active = false
     WHERE id = v_open_product;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Produto não pode ser desativado enquanto participar de recebimento aberto%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'LIFE-8.3: produto com recebimento aberto foi desativado';
  END IF;

  IF NOT (SELECT active FROM public.products WHERE id = v_open_product) THEN
    RAISE EXCEPTION 'LIFE-8.3: tentativa rejeitada alterou active';
  END IF;
END $$;

ROLLBACK;
