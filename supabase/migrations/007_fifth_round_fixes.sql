-- ========================================
-- WMS Casa Meta - Migration 007: Quinta Rodada Corretiva
-- Correções Específicas e Testes de Regressão
-- ========================================

-- ========================================
-- 1. CORREÇÃO: shipment_cancelled_empty
-- ========================================
-- Problema: Expedições sem itens separados não eram canceladas atomicamente
-- Correção: Garantir cancelamento atômico com liberação de reservas

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
  
  -- Calcular totais
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
  
  -- Se nada foi separado, cancelar atomicamente
  IF v_total_picked = 0 THEN
    -- Liberar todas as reservas PRIMEIRO
    FOR v_line IN
      SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    LOOP
      IF v_line.from_location_id IS NOT NULL AND v_line.requested_quantity > 0 THEN
        UPDATE stock_balances
        SET reserved_quantity = GREATEST(0, reserved_quantity - v_line.requested_quantity),
            updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
      END IF;
    END LOOP;
    
    -- Marcar linhas como liberadas
    UPDATE shipment_lines
    SET reservations_released = true
    WHERE shipment_id = p_shipment_id;
    
    -- Cancelar expedição
    UPDATE shipments
    SET status = 'cancelled',
        notes = COALESCE(notes, '') || ' Cancelado: nenhuma quantidade separada'
    WHERE id = p_shipment_id;
    
    PERFORM log_audit_event('shipment_cancelled_empty', 'shipment', p_shipment_id,
      jsonb_build_object('reason', 'no_items_picked'));
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
-- 2. CORREÇÃO: process_receipt_atomically
-- ========================================
-- Problema: Segunda execução marcava como completed mesmo com received < expected
-- Correção: Verificar status atual antes de atualizar

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
      SELECT COALESCE(SUM(ml.quantity), 0) INTO v_already_processed
      FROM movement_lines ml
      JOIN movements m ON m.id = ml.movement_id
      WHERE m.source_reference = v_receipt_number
        AND m.movement_type = 'inbound'
        AND ml.product_id = v_line.product_id
        AND ml.to_location_id = v_line.location_id
        AND m.status = 'completed'
        AND ml.notes LIKE '%Linha ID: ' || v_line.id || '%';
      
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
        format('Linha ID: %s', v_line.id)
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
    
    -- Verificar se TODAS as linhas estão completas
    IF v_line.received_quantity < v_line.expected_quantity THEN
      v_all_received := false;
    END IF;
  END LOOP;
  
  IF NOT v_has_received_items THEN
    RAISE EXCEPTION 'Nenhum item foi recebido ainda';
  END IF;
  
  -- CORREÇÃO: Só marcar como completed se realmente todas as linhas estão completas
  -- E se o status atual ainda é partial (não foi completado antes)
  IF v_all_received AND v_receipt_status = 'partial' THEN
    UPDATE receipts
    SET
      status = 'completed',
      actual_date = NOW(),
      completed_at = NOW()
    WHERE id = p_receipt_id;
  ELSIF NOT v_all_received THEN
    -- Manter como partial
    UPDATE receipts
    SET
      status = 'partial',
      actual_date = NOW()
    WHERE id = p_receipt_id;
  END IF;
  
  PERFORM log_audit_event(
    'receipt_processed',
    'receipt',
    p_receipt_id,
    jsonb_build_object('all_received', v_all_received, 'receipt_number', v_receipt_number, 'previous_status', v_receipt_status)
  );
END;
$$;

-- ========================================
-- 3. CORREÇÃO: prevent_direct_status_change
-- ========================================
-- Problema: Bloqueava operações legítimas ou permitia bypass
-- Correção: Validação mais precisa de papéis e estados

CREATE OR REPLACE FUNCTION prevent_direct_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_is_function_call BOOLEAN;
BEGIN
  v_user_role := public.user_role();
  
  -- Detectar se está sendo chamado de uma função transacional
  -- (funções definem search_path ou usam SECURITY DEFINER)
  v_is_function_call := (current_setting('search_path') LIKE '%pg_temp%');
  
  -- Admin pode fazer qualquer coisa
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;
  
  -- Se NÃO é chamada de função, aplicar restrições rigorosas
  IF NOT v_is_function_call THEN
    -- Manager pode alterar para completed/failed apenas via função
    IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
      RAISE EXCEPTION 'Status % só pode ser alterado via funções transacionais', NEW.status;
    END IF;
    
    -- Operador pode cancelar apenas se estava pending/in_progress
    IF v_user_role = 'operator' AND NEW.status = 'cancelled' THEN
      IF OLD.status NOT IN ('pending', 'in_progress') THEN
        RAISE EXCEPTION 'Operador só pode cancelar movimentações pendentes ou em andamento';
      END IF;
      RETURN NEW;
    END IF;
    
    -- Viewer não pode alterar nada
    IF v_user_role = 'viewer' THEN
      RAISE EXCEPTION 'Visualizador não pode alterar status';
    END IF;
    
    -- Operador não pode alterar para completed/failed diretamente
    IF v_user_role = 'operator' AND NEW.status IN ('completed', 'failed') THEN
      RAISE EXCEPTION 'Operador não pode alterar status para % diretamente', NEW.status;
    END IF;
  END IF;
  
  -- Impedir voltar de completed/failed (exceto admin)
  IF OLD.status IN ('completed', 'failed') AND NEW.status != OLD.status THEN
    IF v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Não é possível alterar status de % para %', OLD.status, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- 4. CORREÇÃO: process_stock_count_adjustments
-- ========================================
-- Problema: Não lidava com concorrência e saldos inexistentes
-- Correção: Validar e criar saldo se não existir, usar FOR UPDATE

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
      -- Verificar se existe saldo para este produto/localização
      SELECT EXISTS(
        SELECT 1 FROM stock_balances 
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id
      ) INTO v_balance_exists;
      
      -- BLOQUEAR saldo com FOR UPDATE (ou criar se não existir)
      IF v_balance_exists THEN
        SELECT quantity INTO v_current_stock
        FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id
        FOR UPDATE;
      ELSE
        -- Criar saldo com quantidade zero se não existir
        INSERT INTO stock_balances (product_id, location_id, quantity, reserved_quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.location_id, 0, 0, NOW())
        ON CONFLICT (product_id, location_id) DO NOTHING;
        
        -- Buscar novamente com lock
        SELECT quantity INTO v_current_stock
        FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.location_id
        FOR UPDATE;
        
        v_current_stock := 0;
      END IF;
      
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
        
        -- Atualizar ou criar saldo
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
-- 5. CORREÇÃO: log_audit_event
-- ========================================
-- Problema: Permitia falsificação de eventos e não validava created_by NULL
-- Correção: Validação rigorosa de eventos e propriedade

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
  
  -- Validar tipo de evento (lista branca estrita)
  IF p_event_type NOT IN (
    'movement_processed',
    'shipment_picking_started',
    'shipment_picked',
    'shipment_reservations_released',
    'shipment_cancelled_empty',
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
  
  -- Validar propriedade do registro (impedir que usuário altere registro de outro)
  IF p_entity_type = 'movement' THEN
    SELECT created_by INTO v_entity_created_by FROM movements WHERE id = p_entity_id;
  ELSIF p_entity_type = 'receipt' THEN
    SELECT created_by INTO v_entity_created_by FROM receipts WHERE id = p_entity_id;
  ELSIF p_entity_type = 'shipment' THEN
    SELECT created_by INTO v_entity_created_by FROM shipments WHERE id = p_entity_id;
  ELSIF p_entity_type = 'stock_count' THEN
    SELECT created_by INTO v_entity_created_by FROM stock_counts WHERE id = p_entity_id;
  END IF;
  
  -- Se created_by não é NULL, validar propriedade (exceto para admin/manager)
  IF v_entity_created_by IS NOT NULL AND v_user_role NOT IN ('admin', 'manager') THEN
    IF v_entity_created_by != v_user_id THEN
      RAISE EXCEPTION 'Usuário não pode registrar evento para registro de outro usuário';
    END IF;
  END IF;
  
  -- Inserir evento
  INSERT INTO audit_events (event_type, entity_type, entity_id, user_id, user_email, details)
  VALUES (p_event_type, p_entity_type, p_entity_id, v_user_id, v_user_email, p_details);
END;
$$;

-- ========================================
-- FIM DA MIGRATION 007
-- ========================================
