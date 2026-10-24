-- ========================================
-- WMS Casa Meta - Migration 010
-- Perfil/autoridade e criação atômica de operações
-- ========================================

-- ========================================
-- 1. Usuário comum não altera role nem active
-- ========================================
CREATE OR REPLACE FUNCTION public.validate_profile_privilege_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_role := public.user_role();

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    IF v_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Apenas administradores ativos podem alterar role ou active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_profile_privilege_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_profile_privilege_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_validate_role_change ON public.profiles;
DROP TRIGGER IF EXISTS trg_validate_profile_privilege_change ON public.profiles;
CREATE TRIGGER trg_validate_profile_privilege_change
  BEFORE UPDATE OF role, active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_privilege_change();

-- ========================================
-- 2. created_by e operator_id confiáveis
-- ========================================
CREATE OR REPLACE FUNCTION public.enforce_operation_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := public.user_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Usuário sem perfil ativo não pode criar operações';
  END IF;

  NEW.created_by := auth.uid();

  -- Operador nunca pode atribuir a operação a outra pessoa.
  -- Admin/manager podem atribuir outro operador quando necessário.
  IF v_role = 'operator' OR NEW.operator_id IS NULL THEN
    NEW.operator_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- ========================================
-- 3. Criação atômica de recebimento + linhas
-- ========================================
CREATE OR REPLACE FUNCTION public.create_receipt_with_lines(
  p_supplier_name TEXT,
  p_supplier_reference TEXT DEFAULT NULL,
  p_expected_date DATE DEFAULT NULL,
  p_dock TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_receipt_id UUID;
  v_receipt_number TEXT;
  v_line JSONB;
  v_product_id UUID;
  v_location_id UUID;
  v_expected NUMERIC;
  v_unit TEXT;
BEGIN
  v_role := public.user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  IF NULLIF(BTRIM(p_supplier_name), '') IS NULL THEN
    RAISE EXCEPTION 'Fornecedor é obrigatório';
  END IF;

  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Recebimento precisa ter ao menos uma linha';
  END IF;

  v_receipt_number := public.generate_receipt_number();

  INSERT INTO public.receipts (
    receipt_number,
    supplier_name,
    supplier_reference,
    expected_date,
    dock,
    status,
    operator_id,
    created_by,
    notes
  ) VALUES (
    v_receipt_number,
    BTRIM(p_supplier_name),
    NULLIF(BTRIM(p_supplier_reference), ''),
    p_expected_date,
    NULLIF(BTRIM(p_dock), ''),
    'pending',
    auth.uid(),
    auth.uid(),
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_product_id := NULLIF(v_line->>'product_id', '')::UUID;
      v_location_id := NULLIF(v_line->>'location_id', '')::UUID;
      v_expected := NULLIF(v_line->>'expected_quantity', '')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Linha de recebimento possui UUID ou quantidade inválida: %', v_line;
    END;

    v_unit := COALESCE(NULLIF(BTRIM(v_line->>'unit'), ''), 'un');

    IF v_product_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.products
          WHERE id = v_product_id AND active = true
       ) THEN
      RAISE EXCEPTION 'Produto inválido ou inativo na linha: %', v_line;
    END IF;

    IF v_location_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.locations WHERE id = v_location_id
       ) THEN
      RAISE EXCEPTION 'Localização inválida na linha: %', v_line;
    END IF;

    IF v_expected IS NULL OR v_expected <= 0 THEN
      RAISE EXCEPTION 'Quantidade esperada deve ser maior que zero';
    END IF;

    INSERT INTO public.receipt_lines (
      receipt_id,
      product_id,
      expected_quantity,
      received_quantity,
      location_id,
      unit,
      notes
    ) VALUES (
      v_receipt_id,
      v_product_id,
      v_expected,
      0,
      v_location_id,
      v_unit,
      NULLIF(BTRIM(v_line->>'notes'), '')
    );
  END LOOP;

  RETURN v_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_receipt_with_lines(TEXT, TEXT, DATE, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_receipt_with_lines(TEXT, TEXT, DATE, TEXT, TEXT, JSONB) TO authenticated;

-- ========================================
-- 4. Criação atômica de expedição + linhas
-- ========================================
CREATE OR REPLACE FUNCTION public.create_shipment_with_lines(
  p_customer_name TEXT,
  p_customer_reference TEXT DEFAULT NULL,
  p_carrier TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_expected_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_shipment_id UUID;
  v_shipment_number TEXT;
  v_line JSONB;
  v_product_id UUID;
  v_location_id UUID;
  v_requested NUMERIC;
  v_unit TEXT;
BEGIN
  v_role := public.user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  IF NULLIF(BTRIM(p_customer_name), '') IS NULL THEN
    RAISE EXCEPTION 'Cliente é obrigatório';
  END IF;

  IF p_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Prioridade inválida: %', p_priority;
  END IF;

  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Expedição precisa ter ao menos uma linha';
  END IF;

  v_shipment_number := public.generate_shipment_number();

  INSERT INTO public.shipments (
    shipment_number,
    customer_name,
    customer_reference,
    carrier,
    priority,
    expected_date,
    status,
    operator_id,
    created_by,
    notes
  ) VALUES (
    v_shipment_number,
    BTRIM(p_customer_name),
    NULLIF(BTRIM(p_customer_reference), ''),
    NULLIF(BTRIM(p_carrier), ''),
    p_priority,
    p_expected_date,
    'pending',
    auth.uid(),
    auth.uid(),
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING id INTO v_shipment_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_product_id := NULLIF(v_line->>'product_id', '')::UUID;
      v_location_id := NULLIF(v_line->>'from_location_id', '')::UUID;
      v_requested := NULLIF(v_line->>'requested_quantity', '')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Linha de expedição possui UUID ou quantidade inválida: %', v_line;
    END;

    v_unit := COALESCE(NULLIF(BTRIM(v_line->>'unit'), ''), 'un');

    IF v_product_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.products
          WHERE id = v_product_id AND active = true
       ) THEN
      RAISE EXCEPTION 'Produto inválido ou inativo na linha: %', v_line;
    END IF;

    IF v_location_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.locations WHERE id = v_location_id
       ) THEN
      RAISE EXCEPTION 'Localização de origem inválida na linha: %', v_line;
    END IF;

    IF v_requested IS NULL OR v_requested <= 0 THEN
      RAISE EXCEPTION 'Quantidade solicitada deve ser maior que zero';
    END IF;

    INSERT INTO public.shipment_lines (
      shipment_id,
      product_id,
      requested_quantity,
      picked_quantity,
      from_location_id,
      unit,
      notes
    ) VALUES (
      v_shipment_id,
      v_product_id,
      v_requested,
      0,
      v_location_id,
      v_unit,
      NULLIF(BTRIM(v_line->>'notes'), '')
    );
  END LOOP;

  RETURN v_shipment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_shipment_with_lines(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shipment_with_lines(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB) TO authenticated;

-- ========================================
-- FIM DA MIGRATION 010
-- ========================================
