-- ========================================
-- WMS Casa Meta - Migration 009
-- Estabilização estrutural de autorização, RLS e estados
-- ========================================

-- ========================================
-- 1. PERFIS ATIVOS: usuário desativado não possui papel operacional
-- ========================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
    FROM public.profiles
   WHERE id = auth.uid()
     AND active = true;
$$;

REVOKE ALL ON FUNCTION public.user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- ========================================
-- 2. created_by é responsabilidade do banco, não do navegador
-- ========================================
CREATE OR REPLACE FUNCTION public.enforce_operation_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Em chamadas autenticadas, o criador real sempre é auth.uid().
  -- Migrations/service-role sem auth.uid() podem preservar valor explícito.
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();

    IF NEW.operator_id IS NULL THEN
      NEW.operator_id := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_operation_creator() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_movement_creator ON public.movements;
CREATE TRIGGER trg_enforce_movement_creator
  BEFORE INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_operation_creator();

DROP TRIGGER IF EXISTS trg_enforce_receipt_creator ON public.receipts;
CREATE TRIGGER trg_enforce_receipt_creator
  BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_operation_creator();

DROP TRIGGER IF EXISTS trg_enforce_shipment_creator ON public.shipments;
CREATE TRIGGER trg_enforce_shipment_creator
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_operation_creator();

DROP TRIGGER IF EXISTS trg_enforce_stock_count_creator ON public.stock_counts;
CREATE TRIGGER trg_enforce_stock_count_creator
  BEFORE INSERT ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_operation_creator();

-- ========================================
-- 3. RLS: políticas ausentes e acesso apenas para perfis ativos
-- ========================================

-- Leituras principais: apenas usuário autenticado com perfil ativo.
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "stock_balances_select" ON public.stock_balances;
CREATE POLICY "stock_balances_select" ON public.stock_balances FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "movements_select" ON public.movements;
CREATE POLICY "movements_select" ON public.movements FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "receipts_select" ON public.receipts;
CREATE POLICY "receipts_select" ON public.receipts FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "shipments_select" ON public.shipments;
CREATE POLICY "shipments_select" ON public.shipments FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "stock_counts_select" ON public.stock_counts;
CREATE POLICY "stock_counts_select" ON public.stock_counts FOR SELECT
  USING (public.user_role() IS NOT NULL);

-- Localizações
DROP POLICY IF EXISTS "locations_select" ON public.locations;
DROP POLICY IF EXISTS "locations_insert" ON public.locations;
DROP POLICY IF EXISTS "locations_update" ON public.locations;
DROP POLICY IF EXISTS "locations_delete" ON public.locations;

CREATE POLICY "locations_select" ON public.locations FOR SELECT
  USING (public.user_role() IS NOT NULL);

CREATE POLICY "locations_insert" ON public.locations FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager'));

CREATE POLICY "locations_update" ON public.locations FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager'))
  WITH CHECK (public.user_role() IN ('admin', 'manager'));

CREATE POLICY "locations_delete" ON public.locations FOR DELETE
  USING (public.user_role() IN ('admin', 'manager'));

-- Códigos de barras
DROP POLICY IF EXISTS "product_barcodes_select" ON public.product_barcodes;
DROP POLICY IF EXISTS "product_barcodes_insert" ON public.product_barcodes;
DROP POLICY IF EXISTS "product_barcodes_update" ON public.product_barcodes;
DROP POLICY IF EXISTS "product_barcodes_delete" ON public.product_barcodes;

CREATE POLICY "product_barcodes_select" ON public.product_barcodes FOR SELECT
  USING (public.user_role() IS NOT NULL);

CREATE POLICY "product_barcodes_insert" ON public.product_barcodes FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

CREATE POLICY "product_barcodes_update" ON public.product_barcodes FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'))
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

CREATE POLICY "product_barcodes_delete" ON public.product_barcodes FOR DELETE
  USING (public.user_role() IN ('admin', 'manager'));

-- Linhas de movimentação
DROP POLICY IF EXISTS "movement_lines_select" ON public.movement_lines;
DROP POLICY IF EXISTS "movement_lines_insert" ON public.movement_lines;
DROP POLICY IF EXISTS "movement_lines_insert_limited" ON public.movement_lines;
DROP POLICY IF EXISTS "movement_lines_update" ON public.movement_lines;
DROP POLICY IF EXISTS "movement_lines_delete" ON public.movement_lines;

CREATE POLICY "movement_lines_select" ON public.movement_lines FOR SELECT
  USING (public.user_role() IS NOT NULL);

CREATE POLICY "movement_lines_insert" ON public.movement_lines FOR INSERT
  WITH CHECK (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND EXISTS (
        SELECT 1
          FROM public.movements m
         WHERE m.id = movement_id
           AND m.created_by = auth.uid()
           AND m.status = 'pending'
      )
    )
  );

CREATE POLICY "movement_lines_update" ON public.movement_lines FOR UPDATE
  USING (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND EXISTS (
        SELECT 1
          FROM public.movements m
         WHERE m.id = movement_id
           AND m.created_by = auth.uid()
           AND m.status = 'pending'
      )
    )
  )
  WITH CHECK (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND EXISTS (
        SELECT 1
          FROM public.movements m
         WHERE m.id = movement_id
           AND m.created_by = auth.uid()
           AND m.status = 'pending'
      )
    )
  );

CREATE POLICY "movement_lines_delete" ON public.movement_lines FOR DELETE
  USING (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND EXISTS (
        SELECT 1
          FROM public.movements m
         WHERE m.id = movement_id
           AND m.created_by = auth.uid()
           AND m.status = 'pending'
      )
    )
  );

-- Linhas de recebimento
DROP POLICY IF EXISTS "receipt_lines_select" ON public.receipt_lines;
DROP POLICY IF EXISTS "receipt_lines_insert" ON public.receipt_lines;
DROP POLICY IF EXISTS "receipt_lines_update" ON public.receipt_lines;
DROP POLICY IF EXISTS "receipt_lines_delete" ON public.receipt_lines;

CREATE POLICY "receipt_lines_select" ON public.receipt_lines FOR SELECT
  USING (public.user_role() IS NOT NULL);

CREATE POLICY "receipt_lines_insert" ON public.receipt_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.receipts r
       WHERE r.id = receipt_id
         AND r.status = 'pending'
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND r.created_by = auth.uid())
         )
    )
  );

CREATE POLICY "receipt_lines_update" ON public.receipt_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM public.receipts r
       WHERE r.id = receipt_id
         AND r.status IN ('pending', 'partial')
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND r.created_by = auth.uid())
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.receipts r
       WHERE r.id = receipt_id
         AND r.status IN ('pending', 'partial')
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND r.created_by = auth.uid())
         )
    )
  );

CREATE POLICY "receipt_lines_delete" ON public.receipt_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1
        FROM public.receipts r
       WHERE r.id = receipt_id
         AND r.status = 'pending'
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND r.created_by = auth.uid())
         )
    )
  );

-- Linhas de expedição
DROP POLICY IF EXISTS "shipment_lines_select" ON public.shipment_lines;
DROP POLICY IF EXISTS "shipment_lines_insert" ON public.shipment_lines;
DROP POLICY IF EXISTS "shipment_lines_update" ON public.shipment_lines;
DROP POLICY IF EXISTS "shipment_lines_delete" ON public.shipment_lines;

CREATE POLICY "shipment_lines_select" ON public.shipment_lines FOR SELECT
  USING (public.user_role() IS NOT NULL);

CREATE POLICY "shipment_lines_insert" ON public.shipment_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.shipments s
       WHERE s.id = shipment_id
         AND s.status = 'pending'
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND s.created_by = auth.uid())
         )
    )
  );

CREATE POLICY "shipment_lines_update" ON public.shipment_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM public.shipments s
       WHERE s.id = shipment_id
         AND s.status IN ('pending', 'picking')
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND s.created_by = auth.uid())
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.shipments s
       WHERE s.id = shipment_id
         AND s.status IN ('pending', 'picking')
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND s.created_by = auth.uid())
         )
    )
  );

CREATE POLICY "shipment_lines_delete" ON public.shipment_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1
        FROM public.shipments s
       WHERE s.id = shipment_id
         AND s.status = 'pending'
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND s.created_by = auth.uid())
         )
    )
  );

-- Linhas de contagem
DROP POLICY IF EXISTS "stock_count_lines_select" ON public.stock_count_lines;
DROP POLICY IF EXISTS "stock_count_lines_insert" ON public.stock_count_lines;
DROP POLICY IF EXISTS "stock_count_lines_update" ON public.stock_count_lines;
DROP POLICY IF EXISTS "stock_count_lines_delete" ON public.stock_count_lines;

CREATE POLICY "stock_count_lines_select" ON public.stock_count_lines FOR SELECT
  USING (public.user_role() IS NOT NULL);

CREATE POLICY "stock_count_lines_insert" ON public.stock_count_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.stock_counts c
       WHERE c.id = stock_count_id
         AND c.status = 'pending'
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND c.created_by = auth.uid())
         )
    )
  );

CREATE POLICY "stock_count_lines_update" ON public.stock_count_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM public.stock_counts c
       WHERE c.id = stock_count_id
         AND c.status IN ('pending', 'in_progress')
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND c.created_by = auth.uid())
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.stock_counts c
       WHERE c.id = stock_count_id
         AND c.status IN ('pending', 'in_progress')
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND c.created_by = auth.uid())
         )
    )
  );

CREATE POLICY "stock_count_lines_delete" ON public.stock_count_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1
        FROM public.stock_counts c
       WHERE c.id = stock_count_id
         AND c.status = 'pending'
         AND (
           public.user_role() IN ('admin', 'manager')
           OR (public.user_role() = 'operator' AND c.created_by = auth.uid())
         )
    )
  );

-- ========================================
-- 4. processed_quantity é interno ao banco
-- ========================================
CREATE OR REPLACE FUNCTION public.update_receipt_line_processed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.processed_quantity IS DISTINCT FROM OLD.processed_quantity
     AND COALESCE(current_setting('wms.internal_status_transition', true), '') <> 'on'
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'processed_quantity é campo interno e só pode ser alterado pela função de recebimento';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_receipt_line_processed() FROM PUBLIC;

-- Evita que o cliente escolha processed_quantity no INSERT.
CREATE OR REPLACE FUNCTION public.force_new_receipt_line_unprocessed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.processed_quantity := 0;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.force_new_receipt_line_unprocessed() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_force_new_receipt_line_unprocessed ON public.receipt_lines;
CREATE TRIGGER trg_force_new_receipt_line_unprocessed
  BEFORE INSERT ON public.receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.force_new_receipt_line_unprocessed();

-- ========================================
-- 5. Máquina de estados: contexto explícito para RPCs transacionais
-- ========================================
CREATE OR REPLACE FUNCTION public.prevent_direct_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_internal BOOLEAN;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_internal := COALESCE(current_setting('wms.internal_status_transition', true), '') = 'on';

  -- RPCs SECURITY DEFINER autorizadas habilitam este marcador apenas na transação atual.
  IF v_internal THEN
    RETURN NEW;
  END IF;

  -- service_role é reservado para manutenção/integrações confiáveis do servidor.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_role := public.user_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Usuário sem perfil ativo não pode alterar status';
  END IF;

  IF v_role = 'viewer' THEN
    RAISE EXCEPTION 'Visualizador não pode alterar status';
  END IF;

  IF v_role = 'operator' AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode alterar registros próprios';
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'movements' THEN
      IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'in_progress') THEN
        RETURN NEW;
      END IF;

    WHEN 'receipts' THEN
      IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'partial') THEN
        RETURN NEW;
      END IF;

    WHEN 'shipments' THEN
      -- Cancelamento de picking deve passar por release_shipment_reservations,
      -- pois há reserva de estoque a liberar.
      IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
        RETURN NEW;
      END IF;

      -- packed -> shipped não altera saldo; é uma transição operacional segura.
      IF NEW.status = 'shipped' AND OLD.status = 'packed' THEN
        RETURN NEW;
      END IF;

    WHEN 'stock_counts' THEN
      IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
        RETURN NEW;
      END IF;

      IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'in_progress') THEN
        RETURN NEW;
      END IF;
  END CASE;

  RAISE EXCEPTION 'Transição direta de status não permitida em %: % -> %',
    TG_TABLE_NAME, OLD.status, NEW.status;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_direct_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_direct_status_change() FROM authenticated;

-- ========================================
-- 6. Envolver funções transacionais existentes em contexto interno seguro
-- ========================================
ALTER FUNCTION public.process_stock_movement(UUID, UUID)
  RENAME TO process_stock_movement_internal_v8;
ALTER FUNCTION public.reserve_stock_for_shipment(UUID)
  RENAME TO reserve_stock_for_shipment_internal_v8;
ALTER FUNCTION public.release_shipment_reservations(UUID)
  RENAME TO release_shipment_reservations_internal_v8;
ALTER FUNCTION public.confirm_shipment_picked(UUID)
  RENAME TO confirm_shipment_picked_internal_v8;
ALTER FUNCTION public.process_stock_count_adjustments(UUID)
  RENAME TO process_stock_count_adjustments_internal_v8;

REVOKE ALL ON FUNCTION public.process_stock_movement_internal_v8(UUID, UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.reserve_stock_for_shipment_internal_v8(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.release_shipment_reservations_internal_v8(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.confirm_shipment_picked_internal_v8(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.process_stock_count_adjustments_internal_v8(UUID) FROM PUBLIC, authenticated;

CREATE FUNCTION public.process_stock_movement(
  p_movement_id UUID,
  p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('wms.internal_status_transition', 'on', true);
  PERFORM public.process_stock_movement_internal_v8(p_movement_id, p_operator_id);
END;
$$;

CREATE FUNCTION public.reserve_stock_for_shipment(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('wms.internal_status_transition', 'on', true);
  PERFORM public.reserve_stock_for_shipment_internal_v8(p_shipment_id);
END;
$$;

CREATE FUNCTION public.release_shipment_reservations(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('wms.internal_status_transition', 'on', true);
  PERFORM public.release_shipment_reservations_internal_v8(p_shipment_id);
END;
$$;

CREATE FUNCTION public.confirm_shipment_picked(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('wms.internal_status_transition', 'on', true);
  PERFORM public.confirm_shipment_picked_internal_v8(p_shipment_id);
END;
$$;

CREATE FUNCTION public.process_stock_count_adjustments(p_count_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('wms.internal_status_transition', 'on', true);
  PERFORM public.process_stock_count_adjustments_internal_v8(p_count_id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_stock_movement(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_stock_for_shipment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_shipment_reservations(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_shipment_picked(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_stock_count_adjustments(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.process_stock_movement(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_shipment_reservations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_shipment_picked(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_stock_count_adjustments(UUID) TO authenticated;

-- ========================================
-- 7. Recebimento atômico/idempotente usando processed_quantity real
-- ========================================
CREATE OR REPLACE FUNCTION public.process_receipt_atomically(p_receipt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_has_received_items BOOLEAN := false;
  v_all_received BOOLEAN := true;
  v_receipt_status TEXT;
  v_receipt_number TEXT;
  v_receipt_created_by UUID;
  v_movement_id UUID;
  v_to_process NUMERIC;
  v_user_role TEXT;
BEGIN
  PERFORM set_config('wms.internal_status_transition', 'on', true);

  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  SELECT status, receipt_number, created_by
    INTO v_receipt_status, v_receipt_number, v_receipt_created_by
    FROM public.receipts
   WHERE id = p_receipt_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  IF v_user_role = 'operator'
     AND v_receipt_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar seus próprios recebimentos';
  END IF;

  IF v_receipt_status NOT IN ('pending', 'partial') THEN
    RAISE EXCEPTION 'Recebimento já concluído ou cancelado (status: %)', v_receipt_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.receipt_lines WHERE receipt_id = p_receipt_id
  ) THEN
    RAISE EXCEPTION 'Recebimento não possui linhas';
  END IF;

  -- Primeiro passe: valida TODAS as linhas e calcula completude antes de CONTINUE.
  FOR v_line IN
    SELECT *
      FROM public.receipt_lines
     WHERE receipt_id = p_receipt_id
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_line.received_quantity < 0 OR v_line.expected_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidades inválidas na linha %', v_line.id;
    END IF;

    IF v_line.received_quantity > v_line.expected_quantity THEN
      RAISE EXCEPTION 'Quantidade recebida (%) excede a esperada (%) na linha %',
        v_line.received_quantity, v_line.expected_quantity, v_line.id;
    END IF;

    IF COALESCE(v_line.processed_quantity, 0) > v_line.received_quantity THEN
      RAISE EXCEPTION 'Linha % possui processed_quantity (%) maior que received_quantity (%)',
        v_line.id, v_line.processed_quantity, v_line.received_quantity;
    END IF;

    IF v_line.received_quantity > 0 THEN
      v_has_received_items := true;
      IF v_line.location_id IS NULL THEN
        RAISE EXCEPTION 'Localização não definida para a linha %', v_line.id;
      END IF;
    END IF;

    IF v_line.received_quantity < v_line.expected_quantity THEN
      v_all_received := false;
    END IF;
  END LOOP;

  IF NOT v_has_received_items THEN
    RAISE EXCEPTION 'Nenhum item foi recebido';
  END IF;

  -- Segundo passe: processa apenas o delta ainda não contabilizado.
  FOR v_line IN
    SELECT *
      FROM public.receipt_lines
     WHERE receipt_id = p_receipt_id
     ORDER BY id
     FOR UPDATE
  LOOP
    v_to_process := v_line.received_quantity - COALESCE(v_line.processed_quantity, 0);

    IF v_to_process = 0 THEN
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
      public.generate_movement_reference('inbound'),
      'inbound',
      'completed',
      auth.uid(),
      auth.uid(),
      v_receipt_number,
      format('Recebimento %s - linha %s - delta %s', v_receipt_number, v_line.id, v_to_process),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_movement_id;

    INSERT INTO public.movement_lines (
      movement_id, product_id, to_location_id, quantity, unit, notes
    ) VALUES (
      v_movement_id,
      v_line.product_id,
      v_line.location_id,
      v_to_process,
      v_line.unit,
      format('Linha ID: %s', v_line.id)
    );

    INSERT INTO public.stock_balances (
      product_id, location_id, quantity, reserved_quantity, last_movement_at
    ) VALUES (
      v_line.product_id, v_line.location_id, v_to_process, 0, NOW()
    )
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET
      quantity = public.stock_balances.quantity + EXCLUDED.quantity,
      last_movement_at = NOW(),
      updated_at = NOW();

    UPDATE public.receipt_lines
       SET processed_quantity = COALESCE(processed_quantity, 0) + v_to_process,
           updated_at = NOW()
     WHERE id = v_line.id;
  END LOOP;

  UPDATE public.receipts
     SET status = CASE WHEN v_all_received THEN 'completed' ELSE 'partial' END,
         actual_date = CURRENT_DATE,
         completed_at = CASE WHEN v_all_received THEN NOW() ELSE NULL END
   WHERE id = p_receipt_id;

  PERFORM public.log_audit_event(
    'receipt_processed',
    'receipt',
    p_receipt_id,
    jsonb_build_object(
      'receipt_number', v_receipt_number,
      'all_received', v_all_received,
      'previous_status', v_receipt_status
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_receipt_atomically(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_receipt_atomically(UUID) TO authenticated;

-- ========================================
-- FIM DA MIGRATION 009
-- ========================================
