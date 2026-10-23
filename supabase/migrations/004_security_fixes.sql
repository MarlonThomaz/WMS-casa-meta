-- ========================================
-- WMS Casa Meta - Correções de Segurança e Funcionalidade
-- Migration 004: Revisão Corretiva
-- ========================================

-- ========================================
-- 1. SEGURANÇA: search_path seguro para funções privilegiadas
-- ========================================
-- Definir search_path explícito para evitar ataques de shadowing
ALTER FUNCTION public.user_role() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth;
ALTER FUNCTION public.process_stock_movement(UUID, UUID) SET search_path = public;
ALTER FUNCTION public.reserve_stock_for_shipment(UUID) SET search_path = public;
ALTER FUNCTION public.release_shipment_reservations(UUID) SET search_path = public;
ALTER FUNCTION public.confirm_shipment_picked(UUID) SET search_path = public;
ALTER FUNCTION public.process_receipt_atomically(UUID) SET search_path = public;
ALTER FUNCTION public.process_stock_count_adjustments(UUID) SET search_path = public;
ALTER FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB) SET search_path = public;
ALTER FUNCTION public.generate_movement_reference(TEXT) SET search_path = public;
ALTER FUNCTION public.generate_receipt_number() SET search_path = public;
ALTER FUNCTION public.generate_shipment_number() SET search_path = public;
ALTER FUNCTION public.generate_count_number() SET search_path = public;
ALTER FUNCTION public.find_product_by_barcode(TEXT) SET search_path = public;
ALTER FUNCTION public.get_product_total_stock(UUID) SET search_path = public;
ALTER FUNCTION public.get_product_stock_by_location(UUID) SET search_path = public;
ALTER FUNCTION public.get_location_occupancy(UUID) SET search_path = public;
ALTER FUNCTION public.get_products_with_stock() SET search_path = public;

-- ========================================
-- 2. SEGURANÇA: Corrigir política de profiles para evitar recursão
-- ========================================
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self_limited" ON profiles;

-- Política segura: usuário só pode atualizar seu próprio perfil
-- e NÃO pode alterar o próprio role (apenas admin pode)
CREATE POLICY "profiles_update_self_limited" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND id = (SELECT id FROM profiles WHERE id = auth.uid())
  );

-- Política para admin alterar qualquer perfil (incluindo roles)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (public.user_role() = 'admin');

-- ========================================
-- 3. SEGURANÇA: Impedir alteração direta de estados críticos
-- ========================================

-- 3.1. Movements - impedir UPDATE direto em status
DROP POLICY IF EXISTS "movements_update" ON movements;
DROP POLICY IF EXISTS "movements_update_limited" ON movements;

-- Operadores só podem inserir, não alterar status diretamente
CREATE POLICY "movements_update_limited" ON movements FOR UPDATE
  USING (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND status IN ('pending', 'in_progress')
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- Impedir que operador altere status para completed/failed diretamente
    CASE
      WHEN public.user_role() = 'operator' THEN
        status IN ('pending', 'in_progress', 'cancelled')
      ELSE true
    END
  );

-- 3.2. Receipts - impedir UPDATE direto em status
DROP POLICY IF EXISTS "receipts_update" ON receipts;
DROP POLICY IF EXISTS "receipts_update_limited" ON receipts;

CREATE POLICY "receipts_update_limited" ON receipts FOR UPDATE
  USING (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND status IN ('pending', 'partial')
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    CASE
      WHEN public.user_role() = 'operator' THEN
        status IN ('pending', 'partial', 'cancelled')
      ELSE true
    END
  );

-- 3.3. Shipments - impedir UPDATE direto em status
DROP POLICY IF EXISTS "shipments_update" ON shipments;
DROP POLICY IF EXISTS "shipments_update_limited" ON shipments;

CREATE POLICY "shipments_update_limited" ON shipments FOR UPDATE
  USING (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND status IN ('pending', 'picking', 'packed')
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    CASE
      WHEN public.user_role() = 'operator' THEN
        status IN ('pending', 'picking', 'packed', 'cancelled')
      ELSE true
    END
  );

-- 3.4. Stock_counts - impedir UPDATE direto em status
DROP POLICY IF EXISTS "stock_counts_update" ON stock_counts;
DROP POLICY IF EXISTS "stock_counts_update_limited" ON stock_counts;

CREATE POLICY "stock_counts_update_limited" ON stock_counts FOR UPDATE
  USING (
    public.user_role() IN ('admin', 'manager')
    OR (
      public.user_role() = 'operator'
      AND status IN ('pending', 'in_progress')
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    CASE
      WHEN public.user_role() = 'operator' THEN
        status IN ('pending', 'in_progress', 'cancelled')
      ELSE true
    END
  );

-- 3.5. Impedir UPDATE direto em stock_balances (apenas via funções)
DROP POLICY IF EXISTS "stock_balances_service_write" ON stock_balances;
CREATE POLICY "stock_balances_service_write" ON stock_balances FOR ALL
  USING (false); -- Ninguém pode alterar diretamente, apenas via funções SECURITY DEFINER

-- 3.6. Restringir INSERT/UPDATE em movement_lines
DROP POLICY IF EXISTS "movement_lines_insert" ON movement_lines;
DROP POLICY IF EXISTS "movement_lines_insert_limited" ON movement_lines;
CREATE POLICY "movement_lines_insert_limited" ON movement_lines FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager')); -- Apenas admin/manager via funções

-- ========================================
-- 4. SEGURANÇA: Validar papel em todas as funções SECURITY DEFINER
-- ========================================

-- Recriar funções com validação de papel explícita

-- 4.1. process_stock_movement com validação de papel
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
  v_line RECORD;
  v_current_quantity NUMERIC;
  v_user_role TEXT;
BEGIN
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil';
  END IF;
  
  IF v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR movimentação com FOR UPDATE
  SELECT movement_type, status
  INTO v_movement_type, v_movement_status
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;
  
  -- Validar status (impede processamento duplicado)
  IF v_movement_status != 'pending' THEN
    RAISE EXCEPTION 'Movimentação já foi processada ou cancelada (status: %)', v_movement_status;
  END IF;
  
  -- Marcar como em processamento imediatamente (previne race condition)
  UPDATE movements
  SET status = 'in_progress', processed_at = NOW()
  WHERE id = p_movement_id;
  
  -- Processar cada linha
  FOR v_line IN
    SELECT * FROM movement_lines WHERE movement_id = p_movement_id
  LOOP
    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    
    CASE v_movement_type
      WHEN 'inbound' THEN
        IF v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Localização de destino é obrigatória para entrada';
        END IF;
        
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = stock_balances.quantity + v_line.quantity,
          last_movement_at = NOW(),
          updated_at = NOW();
          
      WHEN 'outbound' THEN
        IF v_line.from_location_id IS NULL THEN
          RAISE EXCEPTION 'Localização de origem é obrigatória para saída';
        END IF;
        
        SELECT quantity INTO v_current_quantity
        FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
        FOR UPDATE;
        
        IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %',
            COALESCE(v_current_quantity, 0), v_line.quantity;
        END IF;
        
        UPDATE stock_balances
        SET quantity = quantity - v_line.quantity,
            last_movement_at = NOW(),
            updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        
      WHEN 'transfer' THEN
        IF v_line.from_location_id IS NULL OR v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Origem e destino são obrigatórios para transferência';
        END IF;
        
        IF v_line.from_location_id = v_line.to_location_id THEN
          RAISE EXCEPTION 'Origem e destino não podem ser iguais';
        END IF;
        
        SELECT quantity INTO v_current_quantity
        FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
        FOR UPDATE;
        
        IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente na origem. Disponível: %, Solicitado: %',
            COALESCE(v_current_quantity, 0), v_line.quantity;
        END IF;
        
        UPDATE stock_balances
        SET quantity = quantity - v_line.quantity,
            last_movement_at = NOW(),
            updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = stock_balances.quantity + v_line.quantity,
          last_movement_at = NOW(),
          updated_at = NOW();
          
      WHEN 'adjustment' THEN
        IF v_line.to_location_id IS NOT NULL AND v_line.from_location_id IS NULL THEN
          INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
          VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
          ON CONFLICT (product_id, location_id)
          DO UPDATE SET
            quantity = stock_balances.quantity + v_line.quantity,
            last_movement_at = NOW(),
            updated_at = NOW();
        ELSIF v_line.from_location_id IS NOT NULL AND v_line.to_location_id IS NULL THEN
          SELECT quantity INTO v_current_quantity
          FROM stock_balances
          WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
          FOR UPDATE;
          
          IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
            RAISE EXCEPTION 'Saldo insuficiente para ajuste';
          END IF;
          
          UPDATE stock_balances
          SET quantity = quantity - v_line.quantity,
              last_movement_at = NOW(),
              updated_at = NOW()
          WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        ELSE
          RAISE EXCEPTION 'Ajuste deve ter apenas origem OU destino';
        END IF;
        
      ELSE
        RAISE EXCEPTION 'Tipo de movimentação inválido: %', v_movement_type;
    END CASE;
  END LOOP;
  
  UPDATE movements
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_movement_id;
  
  PERFORM log_audit_event(
    'movement_processed',
    'movement',
    p_movement_id,
    jsonb_build_object('type', v_movement_type)
  );
END;
$$;

-- 4.2. reserve_stock_for_shipment com validação de estado
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
  v_user_role TEXT;
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
  
  -- Impedir reservas duplicadas
  IF v_shipment_status != 'pending' THEN
    RAISE EXCEPTION 'Expedição não está pendente (status: %). Reservas já foram aplicadas ou expedição cancelada.', v_shipment_status;
  END IF;
  
  -- Validar todas as linhas ANTES de reservar
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida para produto %', v_line.product_id;
    END IF;
    
    IF v_line.requested_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade solicitada deve ser positiva';
    END IF;
    
    SELECT available_quantity INTO v_available
    FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
    FOR UPDATE;
    
    IF v_available IS NULL OR v_available < v_line.requested_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para produto %. Disponível: %, Solicitado: %',
        v_line.product_id, COALESCE(v_available, 0), v_line.requested_quantity;
    END IF;
  END LOOP;
  
  -- Aplicar todas as reservas
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
  LOOP
    UPDATE stock_balances
    SET reserved_quantity = reserved_quantity + v_line.requested_quantity,
        updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
  END LOOP;
  
  UPDATE shipments
  SET status = 'picking'
  WHERE id = p_shipment_id;
  
  PERFORM log_audit_event('shipment_picking_started', 'shipment', p_shipment_id);
END;
$$;

-- 4.3. release_shipment_reservations com validação
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
  
  -- Só pode liberar reservas se estiver em picking ou se for cancelamento
  IF v_shipment_status NOT IN ('picking', 'cancelled') THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;
  
  -- Liberar reservas de cada linha
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
  
  -- Atualizar status para cancelled se ainda não estiver
  IF v_shipment_status = 'picking' THEN
    UPDATE shipments
    SET status = 'cancelled'
    WHERE id = p_shipment_id;
  END IF;
  
  PERFORM log_audit_event('shipment_reservations_released', 'shipment', p_shipment_id);
END;
$$;

-- 4.4. confirm_shipment_picked com validação completa
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
  v_movement_id UUID;
  v_user_role TEXT;
BEGIN
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR expedição e validar estado
  SELECT status, shipment_number INTO v_shipment_status, v_shipment_number
  FROM shipments
  WHERE id = p_shipment_id
  FOR UPDATE;
  
  IF v_shipment_status != 'picking' THEN
    RAISE EXCEPTION 'Expedição não está em separação (status: %)', v_shipment_status;
  END IF;
  
  -- Criar cabeçalho da movimentação de saída UMA VEZ
  INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
  VALUES (
    generate_movement_reference('outbound'),
    'outbound',
    'completed',
    auth.uid(),
    v_shipment_number,
    format('Separação da expedição %s', v_shipment_number),
    NOW()
  )
  RETURNING id INTO v_movement_id;
  
  -- Confirmar cada linha
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida';
    END IF;
    
    -- Validar picked_quantity <= requested_quantity
    IF v_line.picked_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade separada não pode ser negativa';
    END IF;
    
    IF v_line.picked_quantity > v_line.requested_quantity THEN
      RAISE EXCEPTION 'Quantidade separada (%) não pode exceder a solicitada (%) para produto %',
        v_line.picked_quantity, v_line.requested_quantity, v_line.product_id;
    END IF;
    
    IF v_line.picked_quantity = 0 THEN
      CONTINUE; -- Pular linhas não separadas
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
    
    -- Criar linha da movimentação NA MESMA TRANSAÇÃO
    INSERT INTO movement_lines (movement_id, product_id, from_location_id, quantity, unit, notes)
    VALUES (
      v_movement_id,
      v_line.product_id,
      v_line.from_location_id,
      v_line.picked_quantity,
      v_line.unit,
      format('Separação da expedição %s', v_shipment_number)
    );
  END LOOP;
  
  -- Atualizar status da expedição
  UPDATE shipments
  SET status = 'packed'
  WHERE id = p_shipment_id;
  
  PERFORM log_audit_event('shipment_picked', 'shipment', p_shipment_id,
    jsonb_build_object('movement_id', v_movement_id));
END;
$$;

-- 4.5. process_receipt_atomically com controle de duplicação
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
  SELECT status, receipt_number INTO v_receipt_status, v_receipt_number
  FROM receipts
  WHERE id = p_receipt_id
  FOR UPDATE;
  
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
      
      -- Verificar se já foi processado (evitar duplicação)
      SELECT COALESCE(SUM(ml.quantity), 0) INTO v_already_processed
      FROM movement_lines ml
      JOIN movements m ON m.id = ml.movement_id
      WHERE m.source_reference = v_receipt_number
        AND m.movement_type = 'inbound'
        AND ml.product_id = v_line.product_id
        AND ml.to_location_id = v_line.location_id
        AND m.status = 'completed';
      
      -- Calcular quanto ainda precisa ser processado
      v_to_process := v_line.received_quantity - v_already_processed;
      
      IF v_to_process < 0 THEN
        RAISE EXCEPTION 'Inconsistência: já foram processadas mais unidades (%) do que o recebido (%) para produto %',
          v_already_processed, v_line.received_quantity, v_line.product_id;
      END IF;
      
      IF v_to_process = 0 THEN
        CONTINUE; -- Esta linha já foi totalmente processada
      END IF;
      
      -- Criar movimentação de entrada para a quantidade pendente
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (
        generate_movement_reference('inbound'),
        'inbound',
        'completed',
        auth.uid(),
        v_receipt_number,
        format('Recebimento parcial: %s de %s unidades do produto %s', 
          v_to_process, v_line.received_quantity, v_line.product_id),
        NOW()
      )
      RETURNING id INTO v_movement_id;
      
      INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit)
      VALUES (v_movement_id, v_line.product_id, v_line.location_id, v_to_process, v_line.unit);
      
      -- Atualizar estoque apenas com a quantidade pendente
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

-- 4.6. process_stock_count_adjustments com validação completa
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
  v_movement_id UUID;
  v_user_role TEXT;
BEGIN
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR contagem e validar status
  SELECT status, count_number INTO v_count_status, v_count_number
  FROM stock_counts
  WHERE id = p_count_id
  FOR UPDATE;
  
  IF v_count_status != 'in_progress' THEN
    RAISE EXCEPTION 'Contagem não está em andamento (status: %)', v_count_status;
  END IF;
  
  -- Processar cada linha com divergência
  FOR v_line IN
    SELECT * FROM stock_count_lines WHERE stock_count_id = p_count_id
  LOOP
    v_difference := v_line.counted_quantity - v_line.system_quantity;
    
    IF v_difference != 0 THEN
      -- Criar movimentação de ajuste com reference obrigatório
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (
        generate_movement_reference('adjustment'),
        'adjustment',
        'completed',
        auth.uid(),
        v_count_number,
        format('Ajuste de contagem %s: Sistema=%s, Contado=%s, Diferença=%s',
          v_count_number, v_line.system_quantity, v_line.counted_quantity, v_difference),
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
          format('Contagem %s: diferença positiva', v_count_number)
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
          format('Contagem %s: diferença negativa', v_count_number)
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
-- 5. SEGURANÇA: Restringir execução das funções por papel
-- ========================================

-- Revogar execução pública de todas as funções críticas
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

-- Conceder execução apenas para authenticated (a validação de papel é feita dentro das funções)
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

-- ========================================
-- 6. CORREÇÃO: Campos processed_quantity em receipt_lines
-- ========================================
-- Adicionar campo para rastrear quanto já foi processado
ALTER TABLE receipt_lines
ADD COLUMN IF NOT EXISTS processed_quantity NUMERIC DEFAULT 0 CHECK (processed_quantity >= 0);

-- Trigger para atualizar processed_quantity quando received_quantity muda
CREATE OR REPLACE FUNCTION update_receipt_line_processed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- processed_quantity é atualizado apenas pela função process_receipt_atomically
  -- Não permitir alteração direta
  IF NEW.processed_quantity != OLD.processed_quantity AND 
     public.user_role() NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'processed_quantity só pode ser alterado via função process_receipt_atomically';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_line_processed ON receipt_lines;
CREATE TRIGGER trg_receipt_line_processed
  BEFORE UPDATE OF processed_quantity ON receipt_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_line_processed();

-- ========================================
-- 7. CORREÇÃO: Validar códigos de barras no seed
-- ========================================
-- Atualizar códigos de barras para usar formato OTHER em vez de EAN13 inválido
UPDATE product_barcodes
SET barcode_type = 'OTHER'
WHERE barcode_type = 'EAN13'
  AND barcode NOT SIMILAR TO '[0-9]{13}';

-- ========================================
-- 8. CORREÇÃO: Constraint para picked_quantity <= requested_quantity
-- ========================================
ALTER TABLE shipment_lines
ADD CONSTRAINT chk_picked_lte_requested 
CHECK (picked_quantity <= requested_quantity);

-- ========================================
-- 9. CORREÇÃO: Impedir UPDATE direto em status críticos
-- ========================================

-- Trigger para movements - impedir alteração direta de status para completed/failed
CREATE OR REPLACE FUNCTION prevent_direct_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se não for admin/manager, impedir alteração para completed/failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
    IF public.user_role() NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Status % só pode ser alterado via funções transacionais', NEW.status;
    END IF;
  END IF;
  
  -- Impedir voltar de completed/failed para outro status
  IF OLD.status IN ('completed', 'failed') AND NEW.status != OLD.status THEN
    IF public.user_role() NOT IN ('admin') THEN
      RAISE EXCEPTION 'Não é possível alterar status de % para %', OLD.status, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_status_movements ON movements;
CREATE TRIGGER trg_prevent_direct_status_movements
  BEFORE UPDATE OF status ON movements
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_status_change();

-- Aplicar trigger similar para receipts
DROP TRIGGER IF EXISTS trg_prevent_direct_status_receipts ON receipts;
CREATE TRIGGER trg_prevent_direct_status_receipts
  BEFORE UPDATE OF status ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_status_change();

-- Aplicar trigger similar para shipments
DROP TRIGGER IF EXISTS trg_prevent_direct_status_shipments ON shipments;
CREATE TRIGGER trg_prevent_direct_status_shipments
  BEFORE UPDATE OF status ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_status_change();

-- Aplicar trigger similar para stock_counts
DROP TRIGGER IF EXISTS trg_prevent_direct_status_stock_counts ON stock_counts;
CREATE TRIGGER trg_prevent_direct_status_stock_counts
  BEFORE UPDATE OF status ON stock_counts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_status_change();

-- ========================================
-- FIM DA MIGRATION 004
-- ========================================
