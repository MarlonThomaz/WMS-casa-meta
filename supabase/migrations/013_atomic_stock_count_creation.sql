-- ========================================
-- WMS Casa Meta - Migration 013
-- Criação atômica de contagem + snapshot das linhas
-- ========================================

CREATE OR REPLACE FUNCTION public.create_stock_count_with_snapshot(
  p_count_type TEXT,
  p_location_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_count_id UUID;
  v_count_number TEXT;
  v_line_count INTEGER;
BEGIN
  v_role := public.user_role();

  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  IF p_count_type NOT IN ('full', 'cycle', 'spot', 'reconciliation') THEN
    RAISE EXCEPTION 'Tipo de contagem inválido: %', p_count_type;
  END IF;

  IF p_count_type <> 'full' AND p_location_id IS NULL THEN
    RAISE EXCEPTION 'Contagens %, %, e % exigem uma localização',
      'cycle', 'spot', 'reconciliation';
  END IF;

  IF p_location_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.locations
        WHERE id = p_location_id
     ) THEN
    RAISE EXCEPTION 'Localização não encontrada';
  END IF;

  v_count_number := public.generate_count_number();

  INSERT INTO public.stock_counts (
    count_number,
    count_type,
    status,
    location_id,
    operator_id,
    created_by,
    notes
  ) VALUES (
    v_count_number,
    p_count_type,
    'pending',
    p_location_id,
    auth.uid(),
    auth.uid(),
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING id INTO v_count_id;

  -- Snapshot consistente dos saldos existentes. A função de conclusão
  -- da migration 008/009 preserva movimentações legítimas posteriores.
  INSERT INTO public.stock_count_lines (
    stock_count_id,
    product_id,
    location_id,
    system_quantity,
    counted_quantity,
    notes
  )
  SELECT
    v_count_id,
    sb.product_id,
    sb.location_id,
    sb.quantity,
    sb.quantity,
    'Snapshot automático da abertura da contagem'
  FROM public.stock_balances sb
  JOIN public.products p ON p.id = sb.product_id
  JOIN public.locations l ON l.id = sb.location_id
  WHERE p.active = true
    AND (p_location_id IS NULL OR sb.location_id = p_location_id)
  ORDER BY sb.location_id, sb.product_id;

  GET DIAGNOSTICS v_line_count = ROW_COUNT;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Nenhum saldo encontrado para o escopo da contagem';
  END IF;

  PERFORM public.log_audit_event(
    'stock_count_created',
    'stock_count',
    v_count_id,
    jsonb_build_object(
      'count_type', p_count_type,
      'location_id', p_location_id,
      'snapshot_lines', v_line_count
    )
  );

  RETURN v_count_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_count_with_snapshot(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_count_with_snapshot(TEXT, UUID, TEXT) TO authenticated;
