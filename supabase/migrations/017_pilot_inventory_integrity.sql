-- ========================================
-- WMS Casa Meta - Migration 017
-- Correções de integridade operacional antes do piloto
-- ========================================

-- ========================================
-- 1. Movimentações manuais só consomem estoque realmente disponível
-- ========================================
CREATE OR REPLACE FUNCTION public.process_stock_movement_internal_v8(
  p_movement_id UUID,
  p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement_type TEXT;
  v_movement_status TEXT;
  v_movement_created_by UUID;
  v_line RECORD;
  v_available_quantity NUMERIC;
  v_user_role TEXT;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  SELECT movement_type, status, created_by
    INTO v_movement_type, v_movement_status, v_movement_created_by
    FROM public.movements
   WHERE id = p_movement_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;

  IF v_user_role = 'operator'
     AND v_movement_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar suas próprias movimentações';
  END IF;

  IF v_movement_status <> 'pending' THEN
    RAISE EXCEPTION 'Movimentação já processada (status: %)', v_movement_status;
  END IF;

  UPDATE public.movements
     SET status = 'in_progress',
         processed_at = NOW(),
         operator_id = COALESCE(operator_id, auth.uid())
   WHERE id = p_movement_id;

  FOR v_line IN
    SELECT *
      FROM public.movement_lines
     WHERE movement_id = p_movement_id
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;

    CASE v_movement_type
      WHEN 'inbound' THEN
        IF v_line.from_location_id IS NOT NULL OR v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Entrada exige apenas localização de destino';
        END IF;

        INSERT INTO public.stock_balances (
          product_id, location_id, quantity, reserved_quantity, last_movement_at
        ) VALUES (
          v_line.product_id, v_line.to_location_id, v_line.quantity, 0, NOW()
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = public.stock_balances.quantity + EXCLUDED.quantity,
          last_movement_at = NOW(),
          updated_at = NOW();

      WHEN 'outbound' THEN
        IF v_line.from_location_id IS NULL OR v_line.to_location_id IS NOT NULL THEN
          RAISE EXCEPTION 'Saída exige apenas localização de origem';
        END IF;

        SELECT available_quantity
          INTO v_available_quantity
          FROM public.stock_balances
         WHERE product_id = v_line.product_id
           AND location_id = v_line.from_location_id
         FOR UPDATE;

        IF v_available_quantity IS NULL OR v_available_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Estoque disponível insuficiente';
        END IF;

        UPDATE public.stock_balances
           SET quantity = quantity - v_line.quantity,
               last_movement_at = NOW(),
               updated_at = NOW()
         WHERE product_id = v_line.product_id
           AND location_id = v_line.from_location_id;

      WHEN 'transfer' THEN
        IF v_line.from_location_id IS NULL OR v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Origem e destino obrigatórios';
        END IF;

        IF v_line.from_location_id = v_line.to_location_id THEN
          RAISE EXCEPTION 'Origem e destino não podem ser iguais';
        END IF;

        SELECT available_quantity
          INTO v_available_quantity
          FROM public.stock_balances
         WHERE product_id = v_line.product_id
           AND location_id = v_line.from_location_id
         FOR UPDATE;

        IF v_available_quantity IS NULL OR v_available_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Estoque disponível insuficiente';
        END IF;

        UPDATE public.stock_balances
           SET quantity = quantity - v_line.quantity,
               last_movement_at = NOW(),
               updated_at = NOW()
         WHERE product_id = v_line.product_id
           AND location_id = v_line.from_location_id;

        INSERT INTO public.stock_balances (
          product_id, location_id, quantity, reserved_quantity, last_movement_at
        ) VALUES (
          v_line.product_id, v_line.to_location_id, v_line.quantity, 0, NOW()
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = public.stock_balances.quantity + EXCLUDED.quantity,
          last_movement_at = NOW(),
          updated_at = NOW();

      WHEN 'adjustment' THEN
        IF v_line.to_location_id IS NOT NULL AND v_line.from_location_id IS NULL THEN
          INSERT INTO public.stock_balances (
            product_id, location_id, quantity, reserved_quantity, last_movement_at
          ) VALUES (
            v_line.product_id, v_line.to_location_id, v_line.quantity, 0, NOW()
          )
          ON CONFLICT (product_id, location_id)
          DO UPDATE SET
            quantity = public.stock_balances.quantity + EXCLUDED.quantity,
            last_movement_at = NOW(),
            updated_at = NOW();

        ELSIF v_line.from_location_id IS NOT NULL AND v_line.to_location_id IS NULL THEN
          SELECT available_quantity
            INTO v_available_quantity
            FROM public.stock_balances
           WHERE product_id = v_line.product_id
             AND location_id = v_line.from_location_id
           FOR UPDATE;

          IF v_available_quantity IS NULL OR v_available_quantity < v_line.quantity THEN
            RAISE EXCEPTION 'Estoque disponível insuficiente';
          END IF;

          UPDATE public.stock_balances
             SET quantity = quantity - v_line.quantity,
                 last_movement_at = NOW(),
                 updated_at = NOW()
           WHERE product_id = v_line.product_id
             AND location_id = v_line.from_location_id;
        ELSE
          RAISE EXCEPTION 'Ajuste exige somente origem ou somente destino';
        END IF;

      ELSE
        RAISE EXCEPTION 'Tipo de movimentação inválido: %', v_movement_type;
    END CASE;
  END LOOP;

  UPDATE public.movements
     SET status = 'completed',
         completed_at = NOW()
   WHERE id = p_movement_id;

  PERFORM public.log_audit_event(
    'movement_processed',
    'movement',
    p_movement_id,
    jsonb_build_object('type', v_movement_type, 'operator_id', p_operator_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_stock_movement_internal_v8(UUID, UUID) FROM PUBLIC, authenticated;

-- ========================================
-- 2. Liberação de reservas é idempotente por linha e respeita autoria
-- ========================================
CREATE OR REPLACE FUNCTION public.release_shipment_reservations_internal_v8(
  p_shipment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_shipment_status TEXT;
  v_shipment_created_by UUID;
  v_user_role TEXT;
  v_reserved NUMERIC;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  SELECT status, created_by
    INTO v_shipment_status, v_shipment_created_by
    FROM public.shipments
   WHERE id = p_shipment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedição não encontrada';
  END IF;

  IF v_user_role = 'operator'
     AND v_shipment_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode cancelar suas próprias expedições';
  END IF;

  IF v_shipment_status NOT IN ('picking', 'cancelled') THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;

  FOR v_line IN
    SELECT *
      FROM public.shipment_lines
     WHERE shipment_id = p_shipment_id
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_line.reservations_released THEN
      CONTINUE;
    END IF;

    IF v_line.from_location_id IS NULL OR v_line.requested_quantity <= 0 THEN
      RAISE EXCEPTION 'Linha de expedição inválida: %', v_line.id;
    END IF;

    SELECT reserved_quantity
      INTO v_reserved
      FROM public.stock_balances
     WHERE product_id = v_line.product_id
       AND location_id = v_line.from_location_id
     FOR UPDATE;

    IF v_reserved IS NULL OR v_reserved < v_line.requested_quantity THEN
      RAISE EXCEPTION 'Reserva inconsistente na linha %', v_line.id;
    END IF;

    UPDATE public.stock_balances
       SET reserved_quantity = reserved_quantity - v_line.requested_quantity,
           updated_at = NOW()
     WHERE product_id = v_line.product_id
       AND location_id = v_line.from_location_id;

    UPDATE public.shipment_lines
       SET reservations_released = true,
           updated_at = NOW()
     WHERE id = v_line.id;
  END LOOP;

  IF v_shipment_status = 'picking' THEN
    UPDATE public.shipments
       SET status = 'cancelled'
     WHERE id = p_shipment_id;
  END IF;

  PERFORM public.log_audit_event(
    'shipment_reservations_released',
    'shipment',
    p_shipment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_shipment_reservations_internal_v8(UUID) FROM PUBLIC, authenticated;

-- ========================================
-- 3. Picking parcial sempre libera TODA reserva não consumida,
--    inclusive linhas com picked_quantity = 0
-- ========================================
CREATE OR REPLACE FUNCTION public.confirm_shipment_picked_internal_v8(
  p_shipment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_quantity NUMERIC;
  v_reserved NUMERIC;
  v_shipment_status TEXT;
  v_shipment_number TEXT;
  v_shipment_created_by UUID;
  v_movement_id UUID;
  v_user_role TEXT;
  v_total_requested NUMERIC := 0;
  v_total_picked NUMERIC := 0;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  SELECT status, shipment_number, created_by
    INTO v_shipment_status, v_shipment_number, v_shipment_created_by
    FROM public.shipments
   WHERE id = p_shipment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expedição não encontrada';
  END IF;

  IF v_user_role = 'operator'
     AND v_shipment_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode confirmar suas próprias expedições';
  END IF;

  IF v_shipment_status <> 'picking' THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shipment_lines WHERE shipment_id = p_shipment_id
  ) THEN
    RAISE EXCEPTION 'Expedição não possui linhas';
  END IF;

  FOR v_line IN
    SELECT *
      FROM public.shipment_lines
     WHERE shipment_id = p_shipment_id
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida na linha %', v_line.id;
    END IF;

    IF v_line.requested_quantity <= 0
       OR v_line.picked_quantity < 0
       OR v_line.picked_quantity > v_line.requested_quantity THEN
      RAISE EXCEPTION 'Quantidades inválidas na linha %', v_line.id;
    END IF;

    IF v_line.reservations_released THEN
      RAISE EXCEPTION 'Reserva da linha % já foi liberada', v_line.id;
    END IF;

    v_total_requested := v_total_requested + v_line.requested_quantity;
    v_total_picked := v_total_picked + v_line.picked_quantity;
  END LOOP;

  -- Nada separado: libera integralmente as reservas e cancela.
  IF v_total_picked = 0 THEN
    FOR v_line IN
      SELECT *
        FROM public.shipment_lines
       WHERE shipment_id = p_shipment_id
       ORDER BY id
       FOR UPDATE
    LOOP
      SELECT reserved_quantity
        INTO v_reserved
        FROM public.stock_balances
       WHERE product_id = v_line.product_id
         AND location_id = v_line.from_location_id
       FOR UPDATE;

      IF v_reserved IS NULL OR v_reserved < v_line.requested_quantity THEN
        RAISE EXCEPTION 'Reserva inconsistente na linha %', v_line.id;
      END IF;

      UPDATE public.stock_balances
         SET reserved_quantity = reserved_quantity - v_line.requested_quantity,
             updated_at = NOW()
       WHERE product_id = v_line.product_id
         AND location_id = v_line.from_location_id;

      UPDATE public.shipment_lines
         SET reservations_released = true,
             updated_at = NOW()
       WHERE id = v_line.id;
    END LOOP;

    UPDATE public.shipments
       SET status = 'cancelled',
           notes = CONCAT_WS(' ', NULLIF(notes, ''), 'Cancelado: nenhuma quantidade separada')
     WHERE id = p_shipment_id;

    PERFORM public.log_audit_event(
      'shipment_cancelled_empty',
      'shipment',
      p_shipment_id,
      jsonb_build_object('reason', 'no_items_picked')
    );
    RETURN;
  END IF;

  INSERT INTO public.movements (
    reference,
    movement_type,
    status,
    operator_id,
    created_by,
    source_reference,
    notes,
    completed_at,
    processed_at
  ) VALUES (
    public.generate_movement_reference('outbound'),
    'outbound',
    'completed',
    auth.uid(),
    auth.uid(),
    v_shipment_number,
    format('Separação da expedição %s (%s de %s unidades)', v_shipment_number, v_total_picked, v_total_requested),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_movement_id;

  FOR v_line IN
    SELECT *
      FROM public.shipment_lines
     WHERE shipment_id = p_shipment_id
     ORDER BY id
     FOR UPDATE
  LOOP
    SELECT quantity, reserved_quantity
      INTO v_quantity, v_reserved
      FROM public.stock_balances
     WHERE product_id = v_line.product_id
       AND location_id = v_line.from_location_id
     FOR UPDATE;

    IF v_quantity IS NULL
       OR v_reserved IS NULL
       OR v_reserved < v_line.requested_quantity
       OR v_quantity < v_line.picked_quantity THEN
      RAISE EXCEPTION 'Saldo/reserva inconsistente na linha %', v_line.id;
    END IF;

    -- A reserva foi criada pela requested_quantity. Ao fechar o picking,
    -- toda ela deve sair: a parte picked vira saída física e o restante é liberado.
    UPDATE public.stock_balances
       SET quantity = quantity - v_line.picked_quantity,
           reserved_quantity = reserved_quantity - v_line.requested_quantity,
           last_movement_at = CASE
             WHEN v_line.picked_quantity > 0 THEN NOW()
             ELSE last_movement_at
           END,
           updated_at = NOW()
     WHERE product_id = v_line.product_id
       AND location_id = v_line.from_location_id;

    IF v_line.picked_quantity > 0 THEN
      INSERT INTO public.movement_lines (
        movement_id, product_id, from_location_id, quantity, unit, notes
      ) VALUES (
        v_movement_id,
        v_line.product_id,
        v_line.from_location_id,
        v_line.picked_quantity,
        v_line.unit,
        format('Separação da expedição %s', v_shipment_number)
      );
    END IF;

    UPDATE public.shipment_lines
       SET reservations_released = true,
           updated_at = NOW()
     WHERE id = v_line.id;
  END LOOP;

  UPDATE public.shipments
     SET status = 'packed'
   WHERE id = p_shipment_id;

  PERFORM public.log_audit_event(
    'shipment_picked',
    'shipment',
    p_shipment_id,
    jsonb_build_object(
      'movement_id', v_movement_id,
      'total_picked', v_total_picked,
      'total_requested', v_total_requested
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_shipment_picked_internal_v8(UUID) FROM PUBLIC, authenticated;

-- ========================================
-- 4. Contagem preserva movimentos concluídos DEPOIS do instante contado
-- ========================================
CREATE OR REPLACE FUNCTION public.process_stock_count_adjustments_internal_v8(
  p_count_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_count_status TEXT;
  v_count_number TEXT;
  v_count_created_by UUID;
  v_count_created_at TIMESTAMPTZ;
  v_user_role TEXT;
  v_current_stock NUMERIC;
  v_reserved NUMERIC;
  v_cutoff TIMESTAMPTZ;
  v_post_count_delta NUMERIC;
  v_target_quantity NUMERIC;
  v_adjustment NUMERIC;
  v_movement_id UUID;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  SELECT status, count_number, created_by, created_at
    INTO v_count_status, v_count_number, v_count_created_by, v_count_created_at
    FROM public.stock_counts
   WHERE id = p_count_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;

  IF v_user_role = 'operator'
     AND v_count_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar suas próprias contagens';
  END IF;

  IF v_count_status <> 'in_progress' THEN
    RAISE EXCEPTION 'Contagem não está em andamento (status: %)', v_count_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_count_lines WHERE stock_count_id = p_count_id
  ) THEN
    RAISE EXCEPTION 'Contagem não possui linhas';
  END IF;

  FOR v_line IN
    SELECT *
      FROM public.stock_count_lines
     WHERE stock_count_id = p_count_id
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_line.counted_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade contada não pode ser negativa';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.products
       WHERE id = v_line.product_id AND active = true
    ) THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo: %', v_line.product_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.locations WHERE id = v_line.location_id
    ) THEN
      RAISE EXCEPTION 'Localização não encontrada: %', v_line.location_id;
    END IF;

    INSERT INTO public.stock_balances (
      product_id, location_id, quantity, reserved_quantity, last_movement_at
    ) VALUES (
      v_line.product_id, v_line.location_id, 0, 0, NOW()
    )
    ON CONFLICT (product_id, location_id) DO NOTHING;

    SELECT quantity, reserved_quantity
      INTO v_current_stock, v_reserved
      FROM public.stock_balances
     WHERE product_id = v_line.product_id
       AND location_id = v_line.location_id
     FOR UPDATE;

    v_cutoff := COALESCE(v_line.counted_at, v_line.created_at, v_count_created_at);

    -- Movimentos concluídos após o instante da contagem física pertencem ao
    -- estoque atual e NÃO podem ser apagados pela reconciliação.
    SELECT COALESCE(SUM(
      CASE WHEN ml.to_location_id = v_line.location_id THEN ml.quantity ELSE 0 END
      - CASE WHEN ml.from_location_id = v_line.location_id THEN ml.quantity ELSE 0 END
    ), 0)
      INTO v_post_count_delta
      FROM public.movement_lines ml
      JOIN public.movements m ON m.id = ml.movement_id
     WHERE ml.product_id = v_line.product_id
       AND (ml.to_location_id = v_line.location_id OR ml.from_location_id = v_line.location_id)
       AND m.status = 'completed'
       AND COALESCE(m.completed_at, m.processed_at, m.created_at) > v_cutoff
       AND m.source_reference IS DISTINCT FROM v_count_number;

    v_target_quantity := v_line.counted_quantity + v_post_count_delta;

    IF v_target_quantity < 0 THEN
      RAISE EXCEPTION 'Contagem resultaria em estoque negativo na linha %', v_line.id;
    END IF;

    IF v_target_quantity < v_reserved THEN
      RAISE EXCEPTION 'Contagem da linha % conflita com estoque reservado (% reservado, % alvo)',
        v_line.id, v_reserved, v_target_quantity;
    END IF;

    v_adjustment := v_target_quantity - v_current_stock;

    IF v_adjustment = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.movements (
      reference,
      movement_type,
      status,
      operator_id,
      created_by,
      source_reference,
      notes,
      completed_at,
      processed_at
    ) VALUES (
      public.generate_movement_reference('adjustment'),
      'adjustment',
      'completed',
      auth.uid(),
      auth.uid(),
      v_count_number,
      format(
        'Ajuste contagem %s linha %s: contado=%s pós-contagem=%s alvo=%s atual=%s ajuste=%s',
        v_count_number,
        v_line.id,
        v_line.counted_quantity,
        v_post_count_delta,
        v_target_quantity,
        v_current_stock,
        v_adjustment
      ),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_movement_id;

    IF v_adjustment > 0 THEN
      INSERT INTO public.movement_lines (
        movement_id, product_id, to_location_id, quantity, unit, notes
      ) VALUES (
        v_movement_id,
        v_line.product_id,
        v_line.location_id,
        v_adjustment,
        'un',
        format('Contagem %s: ajuste positivo preservando movimentos posteriores', v_count_number)
      );
    ELSE
      INSERT INTO public.movement_lines (
        movement_id, product_id, from_location_id, quantity, unit, notes
      ) VALUES (
        v_movement_id,
        v_line.product_id,
        v_line.location_id,
        ABS(v_adjustment),
        'un',
        format('Contagem %s: ajuste negativo preservando movimentos posteriores', v_count_number)
      );
    END IF;

    UPDATE public.stock_balances
       SET quantity = v_target_quantity,
           last_movement_at = NOW(),
           updated_at = NOW()
     WHERE product_id = v_line.product_id
       AND location_id = v_line.location_id;
  END LOOP;

  UPDATE public.stock_counts
     SET status = 'completed',
         completed_at = NOW(),
         operator_id = COALESCE(operator_id, auth.uid())
   WHERE id = p_count_id;

  PERFORM public.log_audit_event(
    'stock_count_completed',
    'stock_count',
    p_count_id,
    jsonb_build_object('count_number', v_count_number)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_stock_count_adjustments_internal_v8(UUID) FROM PUBLIC, authenticated;

-- ========================================
-- FIM DA MIGRATION 017
-- ========================================
