-- ========================================
-- WMS Casa Meta - Migration 002
-- Funções Transacionais e Correções da Sexta Rodada
-- ========================================

-- ========================================
-- FUNÇÕES DE GERAÇÃO DE REFERÊNCIAS
-- ========================================
CREATE OR REPLACE FUNCTION generate_movement_reference(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_sequence INTEGER;
BEGIN
  CASE p_type
    WHEN 'inbound' THEN v_prefix := 'IN';
    WHEN 'outbound' THEN v_prefix := 'OUT';
    WHEN 'transfer' THEN v_prefix := 'TR';
    WHEN 'adjustment' THEN v_prefix := 'ADJ';
    WHEN 'count' THEN v_prefix := 'CNT';
    ELSE v_prefix := 'MOV';
  END CASE;
  
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_sequence := nextval('movement_ref_seq');
  
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'RC-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('receipt_number_seq')::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'SP-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('shipment_number_seq')::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_count_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'CNT-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('stock_count_number_seq')::TEXT, 6, '0');
END;
$$;

-- ========================================
-- FUNÇÃO: log_audit_event (CORRIGIDA)
-- ========================================
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_entity_created_by UUID;
  v_entity_exists BOOLEAN;
BEGIN
  -- Validar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  SELECT email, role INTO v_user_email, v_user_role
  FROM profiles WHERE id = v_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;
  
  -- Lista branca de eventos
  IF p_event_type NOT IN (
    'movement_processed', 'shipment_picking_started', 'shipment_picked',
    'shipment_reservations_released', 'shipment_cancelled_empty',
    'receipt_processed', 'stock_count_completed',
    'product_created', 'product_updated', 'location_created', 'location_updated',
    'user_login', 'user_logout'
  ) THEN
    RAISE EXCEPTION 'Tipo de evento inválido: %', p_event_type;
  END IF;
  
  -- Validar existência da entidade
  IF p_entity_type = 'movement' THEN
    SELECT EXISTS(SELECT 1 FROM movements WHERE id = p_entity_id) INTO v_entity_exists;
    SELECT created_by INTO v_entity_created_by FROM movements WHERE id = p_entity_id;
  ELSIF p_entity_type = 'receipt' THEN
    SELECT EXISTS(SELECT 1 FROM receipts WHERE id = p_entity_id) INTO v_entity_exists;
    SELECT created_by INTO v_entity_created_by FROM receipts WHERE id = p_entity_id;
  ELSIF p_entity_type = 'shipment' THEN
    SELECT EXISTS(SELECT 1 FROM shipments WHERE id = p_entity_id) INTO v_entity_exists;
    SELECT created_by INTO v_entity_created_by FROM shipments WHERE id = p_entity_id;
  ELSIF p_entity_type = 'stock_count' THEN
    SELECT EXISTS(SELECT 1 FROM stock_counts WHERE id = p_entity_id) INTO v_entity_exists;
    SELECT created_by INTO v_entity_created_by FROM stock_counts WHERE id = p_entity_id;
  ELSE
    v_entity_exists := true; -- Para outros tipos, não validar
  END IF;
  
  IF NOT v_entity_exists THEN
    RAISE EXCEPTION 'Entidade não encontrada: % %', p_entity_type, p_entity_id;
  END IF;
  
  -- CORRIGIDO: Política explícita para created_by NULL
  -- Se created_by é NULL, qualquer usuário autenticado pode registrar evento
  -- Se created_by não é NULL, validar propriedade (exceto admin/manager)
  IF v_entity_created_by IS NOT NULL AND v_user_role NOT IN ('admin', 'manager') THEN
    IF v_entity_created_by != v_user_id THEN
      RAISE EXCEPTION 'Usuário não pode registrar evento para registro de outro usuário';
    END IF;
  END IF;
  
  INSERT INTO audit_events (event_type, entity_type, entity_id, user_id, user_email, details)
  VALUES (p_event_type, p_entity_type, p_entity_id, v_user_id, v_user_email, p_details);
END;
$$;

-- ========================================
-- FUNÇÃO: process_stock_movement
-- ========================================
CREATE OR REPLACE FUNCTION process_stock_movement(
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
  v_current_quantity NUMERIC;
  v_user_role TEXT;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil';
  END IF;
  
  SELECT movement_type, status, created_by
  INTO v_movement_type, v_movement_status, v_movement_created_by
  FROM movements WHERE id = p_movement_id FOR UPDATE;
  
  IF v_movement_status IS NULL THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;
  
  -- Validar propriedade
  IF v_user_role = 'operator' AND v_movement_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar suas próprias movimentações';
  END IF;
  
  IF v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;
  
  IF v_movement_status != 'pending' THEN
    RAISE EXCEPTION 'Movimentação já processada (status: %)', v_movement_status;
  END IF;
  
  UPDATE movements SET status = 'in_progress', processed_at = NOW() WHERE id = p_movement_id;
  
  FOR v_line IN SELECT * FROM movement_lines WHERE movement_id = p_movement_id LOOP
    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    
    CASE v_movement_type
      WHEN 'inbound' THEN
        IF v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Localização de destino obrigatória';
        END IF;
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
        ON CONFLICT (product_id, location_id) DO UPDATE SET
          quantity = stock_balances.quantity + v_line.quantity,
          last_movement_at = NOW(), updated_at = NOW();
          
      WHEN 'outbound' THEN
        IF v_line.from_location_id IS NULL THEN
          RAISE EXCEPTION 'Localização de origem obrigatória';
        END IF;
        SELECT quantity INTO v_current_quantity FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id FOR UPDATE;
        IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente';
        END IF;
        UPDATE stock_balances SET quantity = quantity - v_line.quantity,
          last_movement_at = NOW(), updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        
      WHEN 'transfer' THEN
        IF v_line.from_location_id IS NULL OR v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Origem e destino obrigatórios';
        END IF;
        IF v_line.from_location_id = v_line.to_location_id THEN
          RAISE EXCEPTION 'Origem e destino não podem ser iguais';
        END IF;
        SELECT quantity INTO v_current_quantity FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id FOR UPDATE;
        IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente';
        END IF;
        UPDATE stock_balances SET quantity = quantity - v_line.quantity,
          last_movement_at = NOW(), updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
        ON CONFLICT (product_id, location_id) DO UPDATE SET
          quantity = stock_balances.quantity + v_line.quantity,
          last_movement_at = NOW(), updated_at = NOW();
          
      WHEN 'adjustment' THEN
        IF v_line.to_location_id IS NOT NULL AND v_line.from_location_id IS NULL THEN
          INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
          VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
          ON CONFLICT (product_id, location_id) DO UPDATE SET
            quantity = stock_balances.quantity + v_line.quantity,
            last_movement_at = NOW(), updated_at = NOW();
        ELSIF v_line.from_location_id IS NOT NULL AND v_line.to_location_id IS NULL THEN
          SELECT quantity INTO v_current_quantity FROM stock_balances
          WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id FOR UPDATE;
          IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
            RAISE EXCEPTION 'Saldo insuficiente';
          END IF;
          UPDATE stock_balances SET quantity = quantity - v_line.quantity,
            last_movement_at = NOW(), updated_at = NOW()
          WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        ELSE
          RAISE EXCEPTION 'Ajuste deve ter apenas origem OU destino';
        END IF;
    END CASE;
  END LOOP;
  
  UPDATE movements SET status = 'completed', completed_at = NOW() WHERE id = p_movement_id;
  PERFORM log_audit_event('movement_processed', 'movement', p_movement_id, jsonb_build_object('type', v_movement_type));
END;
$$;

-- ========================================
-- FUNÇÃO: reserve_stock_for_shipment
-- ========================================
CREATE OR REPLACE FUNCTION reserve_stock_for_shipment(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_available NUMERIC;
  v_shipment_status TEXT;
  v_shipment_created_by UUID;
  v_user_role TEXT;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;
  
  SELECT status, created_by INTO v_shipment_status, v_shipment_created_by
  FROM shipments WHERE id = p_shipment_id FOR UPDATE;
  
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Expedição não encontrada';
  END IF;
  
  IF v_user_role = 'operator' AND v_shipment_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode separar suas próprias expedições';
  END IF;
  
  IF v_shipment_status != 'pending' THEN
    RAISE EXCEPTION 'Expedição não está pendente (status: %)', v_shipment_status;
  END IF;
  
  FOR v_line IN SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id FOR UPDATE LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida';
    END IF;
    IF v_line.requested_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    SELECT available_quantity INTO v_available FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id FOR UPDATE;
    IF v_available IS NULL OR v_available < v_line.requested_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente';
    END IF;
  END LOOP;
  
  FOR v_line IN SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id LOOP
    UPDATE stock_balances SET reserved_quantity = reserved_quantity + v_line.requested_quantity,
      updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
  END LOOP;
  
  UPDATE shipments SET status = 'picking' WHERE id = p_shipment_id;
  PERFORM log_audit_event('shipment_picking_started', 'shipment', p_shipment_id);
END;
$$;

-- ========================================
-- FUNÇÃO: release_shipment_reservations (IDEMPOTENTE)
-- ========================================
CREATE OR REPLACE FUNCTION release_shipment_reservations(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_shipment_status TEXT;
  v_user_role TEXT;
  v_already_released BOOLEAN;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;
  
  SELECT status INTO v_shipment_status FROM shipments WHERE id = p_shipment_id FOR UPDATE;
  
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Expedição não encontrada';
  END IF;
  
  IF v_shipment_status NOT IN ('picking', 'cancelled') THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;
  
  -- Idempotência: verificar se já foi liberado
  SELECT EXISTS(SELECT 1 FROM shipment_lines WHERE shipment_id = p_shipment_id AND reservations_released = true)
  INTO v_already_released;
  
  IF v_already_released THEN
    RETURN; -- Já foi liberado, não fazer nada
  END IF;
  
  FOR v_line IN SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id FOR UPDATE LOOP
    IF v_line.from_location_id IS NOT NULL AND v_line.requested_quantity > 0 THEN
      UPDATE stock_balances SET reserved_quantity = GREATEST(0, reserved_quantity - v_line.requested_quantity),
        updated_at = NOW()
      WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
      UPDATE shipment_lines SET reservations_released = true WHERE id = v_line.id;
    END IF;
  END LOOP;
  
  IF v_shipment_status = 'picking' THEN
    UPDATE shipments SET status = 'cancelled' WHERE id = p_shipment_id;
  END IF;
  
  PERFORM log_audit_event('shipment_reservations_released', 'shipment', p_shipment_id);
END;
$$;

-- ========================================
-- FUNÇÃO: confirm_shipment_picked (CORRIGIDA)
-- ========================================
CREATE OR REPLACE FUNCTION confirm_shipment_picked(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
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
  FROM shipments WHERE id = p_shipment_id FOR UPDATE;
  
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Expedição não encontrada';
  END IF;
  
  IF v_user_role = 'operator' AND v_shipment_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode confirmar suas próprias expedições';
  END IF;
  
  IF v_shipment_status != 'picking' THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;
  
  -- Calcular totais
  FOR v_line IN SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id LOOP
    IF v_line.picked_quantity > v_line.requested_quantity THEN
      RAISE EXCEPTION 'Quantidade separada não pode exceder a solicitada';
    END IF;
    v_total_requested := v_total_requested + v_line.requested_quantity;
    v_total_picked := v_total_picked + v_line.picked_quantity;
  END LOOP;
  
  -- CORRIGIDO: Cancelamento atômico se nada foi separado
  IF v_total_picked = 0 THEN
    -- Liberar reservas PRIMEIRO
    FOR v_line IN SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id LOOP
      IF v_line.from_location_id IS NOT NULL AND v_line.requested_quantity > 0 THEN
        UPDATE stock_balances SET reserved_quantity = GREATEST(0, reserved_quantity - v_line.requested_quantity),
          updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
      END IF;
    END LOOP;
    UPDATE shipment_lines SET reservations_released = true WHERE shipment_id = p_shipment_id;
    UPDATE shipments SET status = 'cancelled', notes = COALESCE(notes, '') || ' Cancelado: nenhuma quantidade separada'
    WHERE id = p_shipment_id;
    PERFORM log_audit_event('shipment_cancelled_empty', 'shipment', p_shipment_id, jsonb_build_object('reason', 'no_items_picked'));
    RETURN;
  END IF;
  
  -- Criar movimentação de saída
  INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
  VALUES (generate_movement_reference('outbound'), 'outbound', 'completed', auth.uid(), v_shipment_number,
    format('Separação da expedição %s (%s de %s unidades)', v_shipment_number, v_total_picked, v_total_requested), NOW())
  RETURNING id INTO v_movement_id;
  
  FOR v_line IN SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id FOR UPDATE LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida';
    END IF;
    IF v_line.picked_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade não pode ser negativa';
    END IF;
    IF v_line.picked_quantity = 0 THEN
      CONTINUE;
    END IF;
    
    SELECT reserved_quantity INTO v_reserved FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id FOR UPDATE;
    IF v_reserved IS NULL OR v_reserved < v_line.picked_quantity THEN
      RAISE EXCEPTION 'Reserva insuficiente';
    END IF;
    
    UPDATE stock_balances SET quantity = quantity - v_line.picked_quantity,
      reserved_quantity = reserved_quantity - v_line.picked_quantity,
      last_movement_at = NOW(), updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
    
    INSERT INTO movement_lines (movement_id, product_id, from_location_id, quantity, unit, notes)
    VALUES (v_movement_id, v_line.product_id, v_line.from_location_id, v_line.picked_quantity, v_line.unit,
      format('Separação da expedição %s', v_shipment_number));
    
    -- Liberar reserva não utilizada se separação parcial
    IF v_line.picked_quantity < v_line.requested_quantity THEN
      UPDATE stock_balances SET reserved_quantity = reserved_quantity - (v_line.requested_quantity - v_line.picked_quantity),
        updated_at = NOW()
      WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
    END IF;
  END LOOP;
  
  UPDATE shipments SET status = 'packed' WHERE id = p_shipment_id;
  PERFORM log_audit_event('shipment_picked', 'shipment', p_shipment_id,
    jsonb_build_object('movement_id', v_movement_id, 'total_picked', v_total_picked, 'total_requested', v_total_requested));
END;
$$;

-- ========================================
-- FUNÇÃO: process_receipt_atomically (CORRIGIDA)
-- ========================================
CREATE OR REPLACE FUNCTION process_receipt_atomically(p_receipt_id UUID)
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
  v_already_processed NUMERIC;
  v_to_process NUMERIC;
  v_user_role TEXT;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;
  
  SELECT status, receipt_number, created_by INTO v_receipt_status, v_receipt_number, v_receipt_created_by
  FROM receipts WHERE id = p_receipt_id FOR UPDATE;
  
  IF v_receipt_status IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;
  
  IF v_user_role = 'operator' AND v_receipt_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar seus próprios recebimentos';
  END IF;
  
  IF v_receipt_status NOT IN ('pending', 'partial') THEN
    RAISE EXCEPTION 'Recebimento já concluído ou cancelado (status: %)', v_receipt_status;
  END IF;
  
  -- CORRIGIDO: Calcular completude ANTES de processar
  FOR v_line IN SELECT * FROM receipt_lines WHERE receipt_id = p_receipt_id LOOP
    IF v_line.received_quantity < v_line.expected_quantity THEN
      v_all_received := false;
    END IF;
  END LOOP;
  
  -- Processar cada linha
  FOR v_line IN SELECT * FROM receipt_lines WHERE receipt_id = p_receipt_id FOR UPDATE LOOP
    IF v_line.received_quantity > 0 THEN
      v_has_received_items := true;
      IF v_line.location_id IS NULL THEN
        RAISE EXCEPTION 'Localização não definida para produto %', v_line.product_id;
      END IF;
      
      -- Verificar quanto já foi processado desta linha específica
      SELECT COALESCE(SUM(ml.quantity), 0) INTO v_already_processed
      FROM movement_lines ml
      JOIN movements m ON m.id = ml.movement_id
      WHERE m.source_reference = v_receipt_number
        AND m.movement_type = 'inbound'
        AND ml.product_id = v_line.product_id
        AND ml.to_location_id = v_line.location_id
        AND m.status = 'completed'
        AND ml.notes LIKE '%Linha ID: ' || v_line.id || '%';
      
      v_to_process := v_line.received_quantity - v_already_processed;
      
      IF v_to_process < 0 THEN
        RAISE EXCEPTION 'Inconsistência na linha %', v_line.id;
      END IF;
      
      IF v_to_process = 0 THEN
        CONTINUE; -- Linha já processada
      END IF;
      
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (generate_movement_reference('inbound'), 'inbound', 'completed', auth.uid(), v_receipt_number,
        format('Recebimento linha %s: %s de %s unidades', v_line.id, v_to_process, v_line.received_quantity), NOW())
      RETURNING id INTO v_movement_id;
      
      INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit, notes)
      VALUES (v_movement_id, v_line.product_id, v_line.location_id, v_to_process, v_line.unit, format('Linha ID: %s', v_line.id));
      
      INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
      VALUES (v_line.product_id, v_line.location_id, v_to_process, NOW())
      ON CONFLICT (product_id, location_id) DO UPDATE SET
        quantity = stock_balances.quantity + v_to_process, last_movement_at = NOW(), updated_at = NOW();
    END IF;
  END LOOP;
  
  IF NOT v_has_received_items THEN
    RAISE EXCEPTION 'Nenhum item foi recebido';
  END IF;
  
  -- CORRIGIDO: Só marcar como completed se realmente todas as linhas estão completas
  -- E se o status atual é pending (primeira execução) ou partial (execuções anteriores)
  IF v_all_received THEN
    UPDATE receipts SET status = 'completed', actual_date = NOW(), completed_at = NOW() WHERE id = p_receipt_id;
  ELSE
    UPDATE receipts SET status = 'partial', actual_date = NOW() WHERE id = p_receipt_id;
  END IF;
  
  PERFORM log_audit_event('receipt_processed', 'receipt', p_receipt_id,
    jsonb_build_object('all_received', v_all_received, 'receipt_number', v_receipt_number, 'previous_status', v_receipt_status));
END;
$$;

-- ========================================
-- FUNÇÃO: process_stock_count_adjustments (CORRIGIDA)
-- ========================================
CREATE OR REPLACE FUNCTION process_stock_count_adjustments(p_count_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_difference NUMERIC;
  v_count_status TEXT;
  v_count_number TEXT;
  v_count_created_by UUID;
  v_movement_id UUID;
  v_user_role TEXT;
  v_product_exists BOOLEAN;
  v_location_exists BOOLEAN;
  v_current_stock NUMERIC;
  v_balance_exists BOOLEAN;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;
  
  SELECT status, count_number, created_by INTO v_count_status, v_count_number, v_count_created_by
  FROM stock_counts WHERE id = p_count_id FOR UPDATE;
  
  IF v_count_status IS NULL THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  
  IF v_user_role = 'operator' AND v_count_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar suas próprias contagens';
  END IF;
  
  IF v_count_status != 'in_progress' THEN
    RAISE EXCEPTION 'Contagem não está em andamento (status: %)', v_count_status;
  END IF;
  
  -- Validar linhas
  FOR v_line IN SELECT * FROM stock_count_lines WHERE stock_count_id = p_count_id LOOP
    SELECT EXISTS(SELECT 1 FROM products WHERE id = v_line.product_id AND active = true) INTO v_product_exists;
    IF NOT v_product_exists THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo: %', v_line.product_id;
    END IF;
    SELECT EXISTS(SELECT 1 FROM locations WHERE id = v_line.location_id) INTO v_location_exists;
    IF NOT v_location_exists THEN
      RAISE EXCEPTION 'Localização não encontrada: %', v_line.location_id;
    END IF;
    IF v_line.counted_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade contada não pode ser negativa';
    END IF;
  END LOOP;
  
  -- Processar divergências
  FOR v_line IN SELECT * FROM stock_count_lines WHERE stock_count_id = p_count_id LOOP
    v_difference := v_line.counted_quantity - v_line.system_quantity;
    
    IF v_difference != 0 THEN
      -- CORRIGIDO: Verificar se existe saldo
      SELECT EXISTS(SELECT 1 FROM stock_balances WHERE product_id = v_line.product_id AND location_id = v_line.location_id)
      INTO v_balance_exists;
      
      IF v_balance_exists THEN
        SELECT quantity INTO v_current_stock FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id FOR UPDATE;
      ELSE
        INSERT INTO stock_balances (product_id, location_id, quantity, reserved_quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.location_id, 0, 0, NOW())
        ON CONFLICT (product_id, location_id) DO NOTHING;
        SELECT quantity INTO v_current_stock FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id FOR UPDATE;
        v_current_stock := 0;
      END IF;
      
      -- CORRIGIDO: Recalcular diferença com saldo atual (pode ter mudado desde o snapshot)
      v_difference := v_line.counted_quantity - v_current_stock;
      
      IF v_difference = 0 THEN
        CONTINUE; -- Saldo já está correto
      END IF;
      
      IF v_difference < 0 AND v_current_stock < ABS(v_difference) THEN
        RAISE EXCEPTION 'Estoque insuficiente para ajuste na linha %', v_line.id;
      END IF;
      
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (generate_movement_reference('adjustment'), 'adjustment', 'completed', auth.uid(), v_count_number,
        format('Ajuste contagem %s linha %s: Diferença=%s', v_count_number, v_line.id, v_difference), NOW())
      RETURNING id INTO v_movement_id;
      
      IF v_difference > 0 THEN
        INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit, notes)
        VALUES (v_movement_id, v_line.product_id, v_line.location_id, v_difference, 'un',
          format('Contagem %s linha %s: diferença positiva', v_count_number, v_line.id));
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.location_id, v_difference, NOW())
        ON CONFLICT (product_id, location_id) DO UPDATE SET
          quantity = stock_balances.quantity + v_difference, last_movement_at = NOW(), updated_at = NOW();
      ELSE
        INSERT INTO movement_lines (movement_id, product_id, from_location_id, quantity, unit, notes)
        VALUES (v_movement_id, v_line.product_id, v_line.location_id, ABS(v_difference), 'un',
          format('Contagem %s linha %s: diferença negativa', v_count_number, v_line.id));
        UPDATE stock_balances SET quantity = quantity - ABS(v_difference),
          last_movement_at = NOW(), updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id;
      END IF;
    END IF;
  END LOOP;
  
  UPDATE stock_counts SET status = 'completed', completed_at = NOW() WHERE id = p_count_id;
  PERFORM log_audit_event('stock_count_completed', 'stock_count', p_count_id, jsonb_build_object('count_number', v_count_number));
END;
$$;

-- ========================================
-- FUNÇÕES DE LEITURA
-- ========================================
CREATE OR REPLACE FUNCTION get_product_total_stock(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_total FROM stock_balances WHERE product_id = p_product_id;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION get_product_stock_by_location(p_product_id UUID)
RETURNS TABLE (location_id UUID, location_code TEXT, quantity NUMERIC, reserved_quantity NUMERIC, available_quantity NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT sb.location_id, l.code, sb.quantity, sb.reserved_quantity, sb.available_quantity
  FROM stock_balances sb JOIN locations l ON l.id = sb.location_id
  WHERE sb.product_id = p_product_id ORDER BY l.code;
END;
$$;

CREATE OR REPLACE FUNCTION get_location_occupancy(p_location_id UUID)
RETURNS TABLE (total_items NUMERIC, total_quantity NUMERIC, capacity NUMERIC, occupancy_percentage NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity NUMERIC;
BEGIN
  SELECT capacity INTO v_capacity FROM locations WHERE id = p_location_id;
  RETURN QUERY
  SELECT COUNT(*)::NUMERIC, COALESCE(SUM(sb.quantity), 0), v_capacity,
    CASE WHEN v_capacity > 0 THEN (COALESCE(SUM(sb.quantity), 0) / v_capacity * 100) ELSE 0 END
  FROM stock_balances sb WHERE sb.location_id = p_location_id;
END;
$$;

CREATE OR REPLACE FUNCTION find_product_by_barcode(p_barcode TEXT)
RETURNS TABLE (product_id UUID, sku TEXT, name TEXT, barcode_id UUID, barcode TEXT, packaging_type TEXT, quantity_per_package NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.sku, p.name, pb.id, pb.barcode, pb.packaging_type, pb.quantity_per_package
  FROM product_barcodes pb JOIN products p ON p.id = pb.product_id
  WHERE pb.barcode = p_barcode AND p.active = true;
END;
$$;

CREATE OR REPLACE FUNCTION get_products_with_stock()
RETURNS TABLE (id UUID, sku TEXT, name TEXT, description TEXT, category TEXT, unit_base TEXT, min_stock NUMERIC, max_stock NUMERIC, active BOOLEAN, total_stock NUMERIC, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.sku, p.name, p.description, p.category, p.unit_base, p.min_stock, p.max_stock, p.active,
    COALESCE(SUM(sb.quantity), 0), p.created_at, p.updated_at
  FROM products p LEFT JOIN stock_balances sb ON sb.product_id = p.id
  WHERE p.active = true GROUP BY p.id ORDER BY p.sku;
END;
$$;

-- ========================================
-- RESTRINGIR EXECUTE
-- ========================================
REVOKE ALL ON FUNCTION process_stock_movement(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION reserve_stock_for_shipment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_shipment_reservations(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirm_shipment_picked(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_receipt_atomically(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_stock_count_adjustments(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION log_audit_event(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_movement_reference(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_receipt_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_shipment_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_count_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_product_total_stock(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_product_stock_by_location(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_location_occupancy(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION find_product_by_barcode(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_products_with_stock() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION process_stock_movement(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_stock_for_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_shipment_reservations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_shipment_picked(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_receipt_atomically(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_stock_count_adjustments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_movement_reference(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_receipt_number() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_shipment_number() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_count_number() TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_total_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_stock_by_location(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_occupancy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_product_by_barcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_with_stock() TO authenticated;
