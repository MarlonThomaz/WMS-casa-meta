-- ========================================
-- WMS Casa Meta - Migration 005: Correções Críticas
-- Terceira Rodada Corretiva
-- ========================================

-- IMPORTANTE: Esta migration NÃO edita migrations anteriores
-- Apenas adiciona novas correções e substituições

-- ========================================
-- 1. CORREÇÃO: Política de Profiles sem Recursão
-- ========================================
-- Problema: A política anterior fazia SELECT na mesma tabela, risking recursion
-- Solução: Usar OLD.role e simplificar a lógica

DROP POLICY IF EXISTS "profiles_update_self_limited" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self_safe" ON profiles;

-- Política segura: usuário só pode atualizar seu próprio perfil
-- e NÃO pode alterar o próprio role (apenas admin pode)
-- Usa OLD.role para evitar recursão
CREATE POLICY "profiles_update_self_safe" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Usuário só pode atualizar seu próprio registro
    auth.uid() = id
    -- E não pode alterar o role (deve manter o mesmo)
    AND NEW.role = OLD.role
    -- E não pode alterar o id (óbvio, mas explícito)
    AND NEW.id = OLD.id
  );

-- Política para admin alterar qualquer perfil (incluindo roles)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (
    -- Verificar se o usuário que está fazendo a atualização é admin
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ========================================
-- 2. CORREÇÃO: release_shipment_reservations com Proteção contra Duplicação
-- ========================================
-- Problema: Chamadas repetidas reduziam reservas de outras expedições
-- Solução: Adicionar campo para rastrear se reservas já foram liberadas

-- Adicionar campo para rastrear liberação de reservas
ALTER TABLE shipment_lines
ADD COLUMN IF NOT EXISTS reservations_released BOOLEAN DEFAULT false;

-- Criar função corrigida
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
  
  -- Validar que a expedição pertence ao usuário (exceto admin/manager)
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
  
  -- Verificar se já foi liberado
  SELECT EXISTS(
    SELECT 1 FROM shipment_lines 
    WHERE shipment_id = p_shipment_id AND reservations_released = true
  ) INTO v_already_released;
  
  IF v_already_released THEN
    RAISE EXCEPTION 'Reservas desta expedição já foram liberadas';
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
-- 3. CORREÇÃO: Validação de Propriedade nas Funções
-- ========================================

-- 3.1. process_stock_movement com validação de propriedade
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
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui perfil';
  END IF;
  
  -- BLOQUEAR movimentação com FOR UPDATE
  SELECT movement_type, status, created_by
  INTO v_movement_type, v_movement_status, v_movement_created_by
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;
  
  -- Validar propriedade do registro
  IF v_user_role = 'operator' THEN
    -- Operador só pode processar suas próprias movimentações
    IF v_movement_created_by != auth.uid() THEN
      RAISE EXCEPTION 'Operador só pode processar suas próprias movimentações';
    END IF;
  ELSIF v_user_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- Validar status (impede processamento duplicado)
  IF v_movement_status != 'pending' THEN
    RAISE EXCEPTION 'Movimentação já foi processada ou cancelada (status: %)', v_movement_status;
  END IF;
  
  -- Marcar como em processamento imediatamente
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
          RAISE EXCEPTION 'Saldo insuficiente na origem';
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

-- 3.2. reserve_stock_for_shipment com validação de propriedade
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
  -- Validar papel do usuário
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado (role: %)', v_user_role;
  END IF;
  
  -- BLOQUEAR expedição e validar estado
  SELECT status, created_by INTO v_shipment_status, v_shipment_created_by
  FROM shipments
  WHERE id = p_shipment_id
  FOR UPDATE;
  
  -- Validar propriedade do registro
  IF v_user_role = 'operator' THEN
    IF v_shipment_created_by != auth.uid() THEN
      RAISE EXCEPTION 'Operador só pode separar suas próprias expedições';
    END IF;
  END IF;
  
  -- Impedir reservas duplicadas
  IF v_shipment_status != 'pending' THEN
    RAISE EXCEPTION 'Expedição não está pendente (status: %)', v_shipment_status;
  END IF;
  
  -- Validar todas as linhas ANTES de reservar
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida';
    END IF;
    
    IF v_line.requested_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade solicitada deve ser positiva';
    END IF;
    
    SELECT available_quantity INTO v_available
    FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
    FOR UPDATE;
    
    IF v_available IS NULL OR v_available < v_line.requested_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente';
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

-- 3.3. confirm_shipment_picked com validação de propriedade
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
      RAISE EXCEPTION 'Quantidade separada não pode exceder a solicitada';
    END IF;
  END LOOP;
  
  -- Criar cabeçalho da movimentação
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
    
    IF v_line.picked_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade separada não pode ser negativa';
    END IF;
    
    IF v_line.picked_quantity = 0 THEN
      CONTINUE;
    END IF;
    
    SELECT reserved_quantity INTO v_reserved
    FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
    FOR UPDATE;
    
    IF v_reserved IS NULL OR v_reserved < v_line.picked_quantity THEN
      RAISE EXCEPTION 'Reserva insuficiente';
    END IF;
    
    UPDATE stock_balances
    SET
      quantity = quantity - v_line.picked_quantity,
      reserved_quantity = reserved_quantity - v_line.picked_quantity,
      last_movement_at = NOW(),
      updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
    
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
  
  UPDATE shipments
  SET status = 'packed'
  WHERE id = p_shipment_id;
  
  PERFORM log_audit_event('shipment_picked', 'shipment', p_shipment_id,
    jsonb_build_object('movement_id', v_movement_id));
END;
$$;

-- ========================================
-- FIM DA MIGRATION 005
-- ========================================
