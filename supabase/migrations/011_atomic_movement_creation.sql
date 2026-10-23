-- ========================================
-- WMS Casa Meta - Migration 011
-- Criação + processamento atômico de movimentações
-- ========================================

CREATE OR REPLACE FUNCTION public.create_and_process_movement(
  p_movement_type TEXT,
  p_source_reference TEXT DEFAULT NULL,
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
  v_movement_id UUID;
  v_line JSONB;
  v_product_id UUID;
  v_from_location_id UUID;
  v_to_location_id UUID;
  v_quantity NUMERIC;
  v_unit TEXT;
BEGIN
  v_role := public.user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  IF p_movement_type NOT IN ('inbound', 'outbound', 'transfer', 'adjustment') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type;
  END IF;

  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Linhas da movimentação devem ser um array JSON';
  END IF;

  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Movimentação precisa ter ao menos uma linha';
  END IF;

  INSERT INTO public.movements (
    reference,
    movement_type,
    status,
    operator_id,
    created_by,
    source_reference,
    notes
  ) VALUES (
    public.generate_movement_reference(p_movement_type),
    p_movement_type,
    'pending',
    auth.uid(),
    auth.uid(),
    NULLIF(BTRIM(p_source_reference), ''),
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING id INTO v_movement_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_product_id := NULLIF(v_line->>'product_id', '')::UUID;
      v_from_location_id := NULLIF(v_line->>'from_location_id', '')::UUID;
      v_to_location_id := NULLIF(v_line->>'to_location_id', '')::UUID;
      v_quantity := NULLIF(v_line->>'quantity', '')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Linha possui UUID ou quantidade inválida: %', v_line;
    END;

    v_unit := COALESCE(NULLIF(BTRIM(v_line->>'unit'), ''), 'un');

    IF v_product_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.products
          WHERE id = v_product_id AND active = true
       ) THEN
      RAISE EXCEPTION 'Produto inválido ou inativo na linha: %', v_line;
    END IF;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser maior que zero';
    END IF;

    IF v_from_location_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.locations WHERE id = v_from_location_id) THEN
      RAISE EXCEPTION 'Localização de origem inválida';
    END IF;

    IF v_to_location_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.locations WHERE id = v_to_location_id) THEN
      RAISE EXCEPTION 'Localização de destino inválida';
    END IF;

    CASE p_movement_type
      WHEN 'inbound' THEN
        IF v_from_location_id IS NOT NULL OR v_to_location_id IS NULL THEN
          RAISE EXCEPTION 'Entrada exige apenas localização de destino';
        END IF;
      WHEN 'outbound' THEN
        IF v_from_location_id IS NULL OR v_to_location_id IS NOT NULL THEN
          RAISE EXCEPTION 'Saída exige apenas localização de origem';
        END IF;
      WHEN 'transfer' THEN
        IF v_from_location_id IS NULL OR v_to_location_id IS NULL
           OR v_from_location_id = v_to_location_id THEN
          RAISE EXCEPTION 'Transferência exige origem e destino diferentes';
        END IF;
      WHEN 'adjustment' THEN
        IF (v_from_location_id IS NULL AND v_to_location_id IS NULL)
           OR (v_from_location_id IS NOT NULL AND v_to_location_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Ajuste exige somente origem ou somente destino';
        END IF;
    END CASE;

    INSERT INTO public.movement_lines (
      movement_id,
      product_id,
      from_location_id,
      to_location_id,
      quantity,
      unit,
      notes
    ) VALUES (
      v_movement_id,
      v_product_id,
      v_from_location_id,
      v_to_location_id,
      v_quantity,
      v_unit,
      NULLIF(BTRIM(v_line->>'notes'), '')
    );
  END LOOP;

  -- A função pública é um wrapper transacional seguro criado na migration 009.
  PERFORM public.process_stock_movement(v_movement_id, auth.uid());

  RETURN v_movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_process_movement(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_and_process_movement(TEXT, TEXT, TEXT, JSONB) TO authenticated;
