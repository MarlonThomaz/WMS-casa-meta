-- ========================================
-- WMS Casa Meta - Migration 006: Correções de Segurança e Integridade
-- Quarta Rodada Corretiva - Auditoria Estática
-- ========================================

-- IMPORTANTE: Esta migration NÃO edita migrations anteriores
-- Apenas adiciona novas correções e substituições

-- ========================================
-- 1. SEGURANÇA: Revogar EXECUTE de funções de leitura do PUBLIC
-- ========================================
-- Problema: Funções de leitura estavam acessíveis ao PUBLIC
-- Correção: Restringir apenas para authenticated

REVOKE ALL ON FUNCTION get_product_total_stock(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_product_stock_by_location(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_location_occupancy(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION find_product_by_barcode(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_products_with_stock() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_product_total_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_stock_by_location(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_occupancy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_product_by_barcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_with_stock() TO authenticated;

-- ========================================
-- 2. SEGURANÇA: Corrigir função log_audit_event para validar usuário
-- ========================================
-- Problema: Permitia inserção de eventos sem validação adequada
-- Correção: Validar que o usuário existe e tem permissão

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
BEGIN
  -- Validar que há um usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado não pode registrar eventos de auditoria';
  END IF;
  
  -- Buscar informações do usuário
  SELECT email, role INTO v_user_email, v_user_role
  FROM profiles
  WHERE id = v_user_id;
  
  -- Validar que o usuário existe
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado';
  END IF;
  
  -- Validar tipo de evento (impedir eventos inventados)
  IF p_event_type NOT IN (
    'movement_processed',
    'shipment_picking_started',
    'shipment_picked',
    'shipment_reservations_released',
    'receipt_processed',
    'stock_count_completed',
    'product_created',
    'product_updated',
    'location_created',
    'location_updated',
    'user_login',
    'user_logout'
  ) THEN
    RAISE EXCEPTION 'Tipo de evento de auditoria inválido: %', p_event_type;
  END IF;
  
  -- Inserir evento
  INSERT INTO audit_events (event_type, entity_type, entity_id, user_id, user_email, details)
  VALUES (p_event_type, p_entity_type, p_entity_id, v_user_id, v_user_email, p_details);
END;
$$;

-- ========================================
-- 3. SEGURANÇA: Corrigir prevent_direct_status_change
-- ========================================
-- Problema: Bloqueava operadores legítimos
-- Correção: Permitir operadores alterarem status para cancelled

CREATE OR REPLACE FUNCTION prevent_direct_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  v_user_role := public.user_role();
  
  -- Admin pode alterar qualquer status
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;
  
  -- Manager pode alterar para completed/failed
  IF v_user_role = 'manager' AND NEW.status IN ('completed', 'failed') THEN
    RETURN NEW;
  END IF;
  
  -- Operador pode alterar para cancelled (cancelamento legítimo)
  IF v_user_role = 'operator' AND NEW.status = 'cancelled' THEN
    -- Validar que era pending ou in_progress
    IF OLD.status NOT IN ('pending', 'in_progress') THEN
      RAISE EXCEPTION 'Operador só pode cancelar movimentações pendentes ou em andamento';
    END IF;
    RETURN NEW;
  END IF;
  
  -- Impedir alteração para completed/failed por operador
  IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
    IF v_user_role NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Status % só pode ser alterado via funções transacionais por admin/manager', NEW.status;
    END IF;
  END IF;
  
  -- Impedir voltar de completed/failed
  IF OLD.status IN ('completed', 'failed') AND NEW.status != OLD.status THEN
    IF v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Não é possível alterar status de % para %', OLD.status, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- 4. SEGURANÇA: Impedir UPDATE em linhas após conclusão
-- ========================================
-- Problema: Permitia alteração de linhas após recebimento/expedição concluída
-- Correção: Trigger para bloquear alterações

CREATE OR REPLACE FUNCTION prevent_update_after_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_status TEXT;
  v_user_role TEXT;
BEGIN
  v_user_role := public.user_role();
  
  -- Admin pode alterar qualquer coisa
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;
  
  -- Verificar status do pai
  IF TG_TABLE_NAME = 'receipt_lines' THEN
    SELECT status INTO v_parent_status FROM receipts WHERE id = NEW.receipt_id;
  ELSIF TG_TABLE_NAME = 'shipment_lines' THEN
    SELECT status INTO v_parent_status FROM shipments WHERE id = NEW.shipment_id;
  ELSIF TG_TABLE_NAME = 'stock_count_lines' THEN
    SELECT status INTO v_parent_status FROM stock_counts WHERE id = NEW.stock_count_id;
  END IF;
  
  -- Bloquear alteração se pai estiver concluído
  IF v_parent_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Não é possível alterar linhas de operação concluída ou cancelada (status: %)', v_parent_status;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar triggers
DROP TRIGGER IF EXISTS trg_prevent_update_receipt_lines ON receipt_lines;
CREATE TRIGGER trg_prevent_update_receipt_lines
  BEFORE UPDATE ON receipt_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_update_after_completion();

DROP TRIGGER IF EXISTS trg_prevent_update_shipment_lines ON shipment_lines;
CREATE TRIGGER trg_prevent_update_shipment_lines
  BEFORE UPDATE ON shipment_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_update_after_completion();

DROP TRIGGER IF EXISTS trg_prevent_update_stock_count_lines ON stock_count_lines;
CREATE TRIGGER trg_prevent_update_stock_count_lines
  BEFORE UPDATE ON stock_count_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_update_after_completion();

-- ========================================
-- 5. INTEGRIDADE: release_shipment_reservations idempotente
-- ========================================
-- Problema: Chamadas repetidas reduziam reservas de outras expedições
-- Correção: Verificar se já foi liberado e usar FOR UPDATE

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
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR expedição e validar estado
  SELECT status INTO v_shipment_status
  FROM shipments
  WHERE id = p_shipment_id
  FOR UPDATE;
  
  -- Validar que a expedição existe
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Expedição não encontrada: %', p_shipment_id;
  END IF;
  
  -- Validar propriedade do registro
  IF v_user_role = 'operator' THEN
    IF NOT EXISTS (
      SELECT 1 FROM shipments 
      WHERE id = p_shipment_id AND created_by = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Operador só pode cancelar suas próprias expedições';
    END IF;
  END IF;
  
  -- Só pode liberar reservas se estiver em picking ou cancelled
  IF v_shipment_status NOT IN ('picking', 'cancelled') THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;
  
  -- Verificar se já foi liberado (idempotência)
  SELECT EXISTS(
    SELECT 1 FROM shipment_lines 
    WHERE shipment_id = p_shipment_id AND reservations_released = true
  ) INTO v_already_released;
  
  IF v_already_released THEN
    -- Já foi liberado, não fazer nada (idempotente)
    RETURN;
  END IF;
  
  -- Liberar reservas de cada linha E marcar como liberado
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NOT NULL AND v_line.requested_quantity > 0 THEN
      -- Liberar reserva
      UPDATE stock_balances
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_line.requested_quantity),
          updated_at = NOW()
      WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
      
      -- Marcar linha como liberada
      UPDATE shipment_lines
      SET reservations_released = true
      WHERE id = v_line.id;
    END IF;
  END LOOP;
  
  -- Atualizar status para cancelled se ainda não estiver
  IF v_shipment_status = 'picking' THEN
    UPDATE shipments
    SET status = 'cancelled'
    WHERE id = p_shipment_id;
  END IF;
  
  PERFORM log_audit_event('shipment_reservations_released', 'shipment', p_shipment_id);
END;
$$;

-- ========================================
-- 6. INTEGRIDADE: confirm_shipment_picked com tratamento de separação parcial
-- ========================================
-- Problema: Não tratava corretamente quantidade zero e deixava reservas órfãs
-- Correção: Liberar reservas não utilizadas

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
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR expedição e validar estado
  SELECT status, shipment_number, created_by 
  INTO v_shipment_status, v_shipment_number, v_shipment_created_by
  FROM shipments
  WHERE id = p_shipment_id
  FOR UPDATE;
  
  -- Validar que a expedição existe
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Expedição não encontrada: %', p_shipment_id;
  END IF;
  
  -- Validar propriedade do registro
  IF v_user_role = 'operator' THEN
    IF v_shipment_created_by != auth.uid() THEN
      RAISE EXCEPTION 'Operador só pode confirmar suas próprias expedições';
    END IF;
  END IF;
  
  IF v_shipment_status != 'picking' THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;
  
  -- Validar picked_quantity <= requested_quantity
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
  LOOP
    IF v_line.picked_quantity > v_line.requested_quantity THEN
      RAISE EXCEPTION 'Quantidade separada (%) não pode exceder a solicitada (%) para produto %',
        v_line.picked_quantity, v_line.requested_quantity, v_line.product_id;
    END IF;
    
    v_total_requested := v_total_requested + v_line.requested_quantity;
    v_total_picked := v_total_picked + v_line.picked_quantity;
  END LOOP;
  
  -- Se nada foi separado, cancelar em vez de criar movimentação vazia
  IF v_total_picked = 0 THEN
    UPDATE shipments
    SET status = 'cancelled',
        notes = COALESCE(notes, '') || ' Cancelado: nenhuma quantidade separada'
    WHERE id = p_shipment_id;
    
    -- Liberar todas as reservas
    PERFORM release_shipment_reservations(p_shipment_id);
    
    PERFORM log_audit_event('shipment_cancelled_empty', 'shipment', p_shipment_id);
    RETURN;
  END IF;
  
  -- Criar cabeçalho da movimentação de saída
  INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
  VALUES (
    generate_movement_reference('outbound'),
    'outbound',
    'completed',
    auth.uid(),
    v_shipment_number,
    format('Separação da expedição %s (%s de %s unidades)', v_shipment_number, v_total_picked, v_total_requested),
    NOW()
  )
  RETURNING id INTO v_movement_id;
  
  -- Confirmar cada linha
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida para produto %', v_line.product_id;
    END IF;
    
    IF v_line.picked_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade separada não pode ser negativa';
    END IF;
    
    -- Pular linhas não separadas
    IF v_line.picked_quantity = 0 THEN
      CONTINUE;
    END IF;
    
    -- Validar reserva
    SELECT reserved_quantity INTO v_reserved
    FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
    FOR UPDATE;
    
    IF v_reserved IS NULL OR v_reserved < v_line.picked_quantity THEN
      RAISE EXCEPTION 'Reserva insuficiente para produto %. Reservado: %, Separado: %',
        v_line.product_id, COALESCE(v_reserved, 0), v_line.picked_quantity;
    END IF;
    
    -- Debitar quantidade física e liberar reserva
    UPDATE stock_balances
    SET
      quantity = quantity - v_line.picked_quantity,
      reserved_quantity = reserved_quantity - v_line.picked_quantity,
      last_movement_at = NOW(),
      updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
    
    -- Criar linha da movimentação
    INSERT INTO movement_lines (movement_id, product_id, from_location_id, quantity, unit, notes)
    VALUES (
      v_movement_id,
      v_line.product_id,
      v_line.from_location_id,
      v_line.picked_quantity,
      v_line.unit,
      format('Separação da expedição %s', v_shipment_number)
    );
    
    -- Se separação parcial, liberar reserva não utilizada
    IF v_line.picked_quantity < v_line.requested_quantity THEN
      UPDATE stock_balances
      SET reserved_quantity = reserved_quantity - (v_line.requested_quantity - v_line.picked_quantity),
          updated_at = NOW()
      WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
    END IF;
  END LOOP;
  
  -- Atualizar status da expedição
  UPDATE shipments
  SET status = 'packed'
  WHERE id = p_shipment_id;
  
  PERFORM log_audit_event('shipment_picked', 'shipment', p_shipment_id,
    jsonb_build_object('movement_id', v_movement_id, 'total_picked', v_total_picked, 'total_requested', v_total_requested));
END;
$$;

-- ========================================
-- 7. INTEGRIDADE: process_receipt_atomically com controle por linha
-- ========================================
-- Problema: Agregava processamento por produto/localização
-- Correção: Controlar processamento por linha individual

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
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR recebimento e validar status
  SELECT status, receipt_number, created_by INTO v_receipt_status, v_receipt_number, v_receipt_created_by
  FROM receipts
  WHERE id = p_receipt_id
  FOR UPDATE;
  
  -- Validar que o recebimento existe
  IF v_receipt_status IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado: %', p_receipt_id;
  END IF;
  
  -- Validar propriedade do registro
  IF v_user_role = 'operator' THEN
    IF v_receipt_created_by != auth.uid() THEN
      RAISE EXCEPTION 'Operador só pode processar seus próprios recebimentos';
    END IF;
  END IF;
  
  IF v_receipt_status NOT IN ('pending', 'partial') THEN
    RAISE EXCEPTION 'Recebimento já foi concluído ou cancelado (status: %)', v_receipt_status;
  END IF;
  
  -- Validar todas as linhas
  FOR v_line IN
    SELECT * FROM receipt_lines WHERE receipt_id = p_receipt_id FOR UPDATE
  LOOP
    IF v_line.received_quantity > 0 THEN
      v_has_received_items := true;
      
      IF v_line.location_id IS NULL THEN
        RAISE EXCEPTION 'Localização não definida para produto % com quantidade recebida', v_line.product_id;
      END IF;
      
      -- Verificar se esta LINHA específica já foi processada
      -- Usar ID da linha para controle individual
      SELECT COALESCE(SUM(ml.quantity), 0) INTO v_already_processed
      FROM movement_lines ml
      JOIN movements m ON m.id = ml.movement_id
      WHERE m.source_reference = v_receipt_number
        AND m.movement_type = 'inbound'
        AND ml.product_id = v_line.product_id
        AND ml.to_location_id = v_line.location_id
        AND m.status = 'completed'
        AND ml.notes LIKE '%Linha ID: ' || v_line.id || '%'; -- Controle por linha
      
      -- Calcular quanto ainda precisa ser processado para ESTA LINHA
      v_to_process := v_line.received_quantity - v_already_processed;
      
      IF v_to_process < 0 THEN
        RAISE EXCEPTION 'Inconsistência na linha %: já foram processadas mais unidades (%) do que o recebido (%)',
          v_line.id, v_already_processed, v_line.received_quantity;
      END IF;
      
      IF v_to_process = 0 THEN
        CONTINUE; -- Esta linha já foi totalmente processada
      END IF;
      
      -- Criar movimentação de entrada para a quantidade pendente desta linha
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (
        generate_movement_reference('inbound'),
        'inbound',
        'completed',
        auth.uid(),
        v_receipt_number,
        format('Recebimento linha %s: %s de %s unidades do produto %s', 
          v_line.id, v_to_process, v_line.received_quantity, v_line.product_id),
        NOW()
      )
      RETURNING id INTO v_movement_id;
      
      INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit, notes)
      VALUES (
        v_movement_id, 
        v_line.product_id, 
        v_line.location_id, 
        v_to_process, 
        v_line.unit,
        format('Linha ID: %s', v_line.id) -- Rastrear por linha
      );
      
      -- Atualizar estoque apenas com a quantidade pendente desta linha
      INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
      VALUES (v_line.product_id, v_line.location_id, v_to_process, NOW())
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET
        quantity = stock_balances.quantity + v_to_process,
        last_movement_at = NOW(),
        updated_at = NOW();
    END IF;
    
    IF v_line.received_quantity < v_line.expected_quantity THEN
      v_all_received := false;
    END IF;
  END LOOP;
  
  IF NOT v_has_received_items THEN
    RAISE EXCEPTION 'Nenhum item foi recebido ainda';
  END IF;
  
  -- Atualizar status do recebimento
  UPDATE receipts
  SET
    status = CASE WHEN v_all_received THEN 'completed' ELSE 'partial' END,
    actual_date = NOW(),
    completed_at = CASE WHEN v_all_received THEN NOW() ELSE NULL END
  WHERE id = p_receipt_id;
  
  PERFORM log_audit_event(
    'receipt_processed',
    'receipt',
    p_receipt_id,
    jsonb_build_object('all_received', v_all_received, 'receipt_number', v_receipt_number)
  );
END;
$$;

-- ========================================
-- 8. INTEGRIDADE: process_stock_count_adjustments com validação de IDs
-- ========================================
-- Problema: Não validava IDs inexistentes
-- Correção: Validar existência de produto e localização

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
BEGIN
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR contagem e validar status
  SELECT status, count_number, created_by INTO v_count_status, v_count_number, v_count_created_by
  FROM stock_counts
  WHERE id = p_count_id
  FOR UPDATE;
  
  -- Validar que a contagem existe
  IF v_count_status IS NULL THEN
    RAISE EXCEPTION 'Contagem não encontrada: %', p_count_id;
  END IF;
  
  -- Validar propriedade do registro
  IF v_user_role = 'operator' THEN
    IF v_count_created_by != auth.uid() THEN
      RAISE EXCEPTION 'Operador só pode processar suas próprias contagens';
    END IF;
  END IF;
  
  IF v_count_status != 'in_progress' THEN
    RAISE EXCEPTION 'Contagem não está em andamento (status: %)', v_count_status;
  END IF;
  
  -- Validar todas as linhas ANTES de processar
  FOR v_line IN
    SELECT * FROM stock_count_lines WHERE stock_count_id = p_count_id
  LOOP
    -- Validar que o produto existe
    SELECT EXISTS(SELECT 1 FROM products WHERE id = v_line.product_id AND active = true)
    INTO v_product_exists;
    
    IF NOT v_product_exists THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo: %', v_line.product_id;
    END IF;
    
    -- Validar que a localização existe
    SELECT EXISTS(SELECT 1 FROM locations WHERE id = v_line.location_id)
    INTO v_location_exists;
    
    IF NOT v_location_exists THEN
      RAISE EXCEPTION 'Localização não encontrada: %', v_line.location_id;
    END IF;
    
    -- Validar quantidade contada não negativa
    IF v_line.counted_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade contada não pode ser negativa na linha %', v_line.id;
    END IF;
  END LOOP;
  
  -- Processar cada linha com divergência
  FOR v_line IN
    SELECT * FROM stock_count_lines WHERE stock_count_id = p_count_id
  LOOP
    v_difference := v_line.counted_quantity - v_line.system_quantity;
    
    IF v_difference != 0 THEN
      -- Validar estoque atual antes de ajustar (concorrência)
      SELECT COALESCE(quantity, 0) INTO v_current_stock
      FROM stock_balances
      WHERE product_id = v_line.product_id AND location_id = v_line.location_id
      FOR UPDATE;
      
      -- Se for ajuste negativo, validar que há estoque suficiente
      IF v_difference < 0 AND v_current_stock < ABS(v_difference) THEN
        RAISE EXCEPTION 'Estoque insuficiente para ajuste na linha %. Disponível: %, Necessário: %',
          v_line.id, v_current_stock, ABS(v_difference);
      END IF;
      
      -- Criar movimentação de ajuste
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (
        generate_movement_reference('adjustment'),
        'adjustment',
        'completed',
        auth.uid(),
        v_count_number,
        format('Ajuste de contagem %s linha %s: Sistema=%s, Contado=%s, Diferença=%s',
          v_count_number, v_line.id, v_line.system_quantity, v_line.counted_quantity, v_difference),
        NOW()
      )
      RETURNING id INTO v_movement_id;
      
      -- Adicionar linha da movimentação
      IF v_difference > 0 THEN
        INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit, notes)
        VALUES (
          v_movement_id,
          v_line.product_id,
          v_line.location_id,
          v_difference,
          'un',
          format('Contagem %s linha %s: diferença positiva', v_count_number, v_line.id)
        );
        
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.location_id, v_difference, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = stock_balances.quantity + v_difference,
          last_movement_at = NOW(),
          updated_at = NOW();
      ELSE
        INSERT INTO movement_lines (movement_id, product_id, from_location_id, quantity, unit, notes)
        VALUES (
          v_movement_id,
          v_line.product_id,
          v_line.location_id,
          ABS(v_difference),
          'un',
          format('Contagem %s linha %s: diferença negativa', v_count_number, v_line.id)
        );
        
        UPDATE stock_balances
        SET quantity = quantity - ABS(v_difference),
            last_movement_at = NOW(),
            updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id;
      END IF;
    END IF;
  END LOOP;
  
  -- Atualizar status da contagem
  UPDATE stock_counts
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_count_id;
  
  PERFORM log_audit_event('stock_count_completed', 'stock_count', p_count_id,
    jsonb_build_object('count_number', v_count_number));
END;
$$;

-- ========================================
-- FIM DA MIGRATION 006
-- ========================================
