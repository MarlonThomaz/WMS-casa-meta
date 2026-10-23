-- ========================================
-- WMS Casa Meta - Motor de Estoque Seguro
-- Migration 002: Funções transacionais com validações
-- ========================================

-- ========================================
-- FUNÇÃO: generate_movement_reference (USANDO SEQUÊNCIA)
-- ========================================
CREATE OR REPLACE FUNCTION generate_movement_reference(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ========================================
-- FUNÇÃO: generate_receipt_number (USANDO SEQUÊNCIA)
-- ========================================
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_sequence := nextval('receipt_number_seq');
  RETURN 'RC-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$;

-- ========================================
-- FUNÇÃO: generate_shipment_number (USANDO SEQUÊNCIA)
-- ========================================
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_sequence := nextval('shipment_number_seq');
  RETURN 'SP-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$;

-- ========================================
-- FUNÇÃO: generate_count_number (USANDO SEQUÊNCIA)
-- ========================================
CREATE OR REPLACE FUNCTION generate_count_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_sequence := nextval('stock_count_number_seq');
  RETURN 'CNT-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$;

-- ========================================
-- FUNÇÃO: log_audit_event
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
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT email INTO v_user_email
  FROM profiles
  WHERE id = v_user_id;
  
  INSERT INTO audit_events (event_type, entity_type, entity_id, user_id, user_email, details)
  VALUES (p_event_type, p_entity_type, p_entity_id, v_user_id, v_user_email, p_details);
END;
$$;

-- ========================================
-- FUNÇÃO: get_product_total_stock
-- ========================================
CREATE OR REPLACE FUNCTION get_product_total_stock(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total
  FROM stock_balances
  WHERE product_id = p_product_id;
  
  RETURN v_total;
END;
$$;

-- ========================================
-- FUNÇÃO: get_product_stock_by_location
-- ========================================
CREATE OR REPLACE FUNCTION get_product_stock_by_location(p_product_id UUID)
RETURNS TABLE (
  location_id UUID,
  location_code TEXT,
  quantity NUMERIC,
  reserved_quantity NUMERIC,
  available_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sb.location_id,
    l.code AS location_code,
    sb.quantity,
    sb.reserved_quantity,
    sb.available_quantity
  FROM stock_balances sb
  JOIN locations l ON l.id = sb.location_id
  WHERE sb.product_id = p_product_id
  ORDER BY l.code;
END;
$$;

-- ========================================
-- FUNÇÃO: get_location_occupancy
-- ========================================
CREATE OR REPLACE FUNCTION get_location_occupancy(p_location_id UUID)
RETURNS TABLE (
  total_items NUMERIC,
  total_quantity NUMERIC,
  capacity NUMERIC,
  occupancy_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity NUMERIC;
BEGIN
  SELECT capacity INTO v_capacity
  FROM locations
  WHERE id = p_location_id;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::NUMERIC AS total_items,
    COALESCE(SUM(sb.quantity), 0) AS total_quantity,
    v_capacity,
    CASE 
      WHEN v_capacity > 0 THEN (COALESCE(SUM(sb.quantity), 0) / v_capacity * 100)
      ELSE 0
    END AS occupancy_percentage
  FROM stock_balances sb
  WHERE sb.location_id = p_location_id;
END;
$$;

-- ========================================
-- FUNÇÃO: find_product_by_barcode
-- ========================================
CREATE OR REPLACE FUNCTION find_product_by_barcode(p_barcode TEXT)
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  barcode_id UUID,
  barcode TEXT,
  packaging_type TEXT,
  quantity_per_package NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.sku,
    p.name,
    pb.id AS barcode_id,
    pb.barcode,
    pb.packaging_type,
    pb.quantity_per_package
  FROM product_barcodes pb
  JOIN products p ON p.id = pb.product_id
  WHERE pb.barcode = p_barcode AND p.active = true;
END;
$$;

-- ========================================
-- FUNÇÃO: process_stock_movement (COM FOR UPDATE E VALIDAÇÕES)
-- ========================================
CREATE OR REPLACE FUNCTION process_stock_movement(
  p_movement_id UUID,
  p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movement_type TEXT;
  v_movement_status TEXT;
  v_line RECORD;
  v_current_quantity NUMERIC;
BEGIN
  -- Validar usuário
  IF p_operator_id IS NULL OR p_operator_id != auth.uid() THEN
    IF public.user_role() NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Usuário não autorizado';
    END IF;
  END IF;
  
  -- BLOQUEAR movimentação com FOR UPDATE para evitar processamento duplicado
  SELECT movement_type, status
  INTO v_movement_type, v_movement_status
  FROM movements
  WHERE id = p_movement_id
  FOR UPDATE;
  
  -- Validar status
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
    -- Validar quantidade
    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    
    CASE v_movement_type
      WHEN 'inbound' THEN
        -- Validar destino
        IF v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Localização de destino é obrigatória para entrada';
        END IF;
        
        -- Creditar no destino
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = stock_balances.quantity + v_line.quantity,
          last_movement_at = NOW(),
          updated_at = NOW();
          
      WHEN 'outbound' THEN
        -- Validar origem
        IF v_line.from_location_id IS NULL THEN
          RAISE EXCEPTION 'Localização de origem é obrigatória para saída';
        END IF;
        
        -- BLOQUEAR saldo com FOR UPDATE
        SELECT quantity INTO v_current_quantity
        FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
        FOR UPDATE;
        
        IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %',
            COALESCE(v_current_quantity, 0), v_line.quantity;
        END IF;
        
        -- Debitar da origem
        UPDATE stock_balances
        SET quantity = quantity - v_line.quantity,
            last_movement_at = NOW(),
            updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        
      WHEN 'transfer' THEN
        -- Validar origem e destino
        IF v_line.from_location_id IS NULL OR v_line.to_location_id IS NULL THEN
          RAISE EXCEPTION 'Origem e destino são obrigatórios para transferência';
        END IF;
        
        IF v_line.from_location_id = v_line.to_location_id THEN
          RAISE EXCEPTION 'Origem e destino não podem ser iguais';
        END IF;
        
        -- BLOQUEAR saldo da origem com FOR UPDATE
        SELECT quantity INTO v_current_quantity
        FROM stock_balances
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
        FOR UPDATE;
        
        IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente na origem. Disponível: %, Solicitado: %',
            COALESCE(v_current_quantity, 0), v_line.quantity;
        END IF;
        
        -- Debitar da origem
        UPDATE stock_balances
        SET quantity = quantity - v_line.quantity,
            last_movement_at = NOW(),
            updated_at = NOW()
        WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        
        -- Creditar no destino
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = stock_balances.quantity + v_line.quantity,
          last_movement_at = NOW(),
          updated_at = NOW();
          
      WHEN 'adjustment' THEN
        -- Ajuste positivo (encontrado)
        IF v_line.to_location_id IS NOT NULL AND v_line.from_location_id IS NULL THEN
          INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
          VALUES (v_line.product_id, v_line.to_location_id, v_line.quantity, NOW())
          ON CONFLICT (product_id, location_id)
          DO UPDATE SET
            quantity = stock_balances.quantity + v_line.quantity,
            last_movement_at = NOW(),
            updated_at = NOW();
        -- Ajuste negativo (perda)
        ELSIF v_line.from_location_id IS NOT NULL AND v_line.to_location_id IS NULL THEN
          SELECT quantity INTO v_current_quantity
          FROM stock_balances
          WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
          FOR UPDATE;
          
          IF v_current_quantity IS NULL OR v_current_quantity < v_line.quantity THEN
            RAISE EXCEPTION 'Saldo insuficiente para ajuste. Disponível: %, Solicitado: %',
              COALESCE(v_current_quantity, 0), v_line.quantity;
          END IF;
          
          UPDATE stock_balances
          SET quantity = quantity - v_line.quantity,
              last_movement_at = NOW(),
              updated_at = NOW()
          WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
        ELSE
          RAISE EXCEPTION 'Ajuste deve ter apenas origem OU destino, não ambos';
        END IF;
        
      ELSE
        RAISE EXCEPTION 'Tipo de movimentação inválido: %', v_movement_type;
    END CASE;
  END LOOP;
  
  -- Marcar como concluída
  UPDATE movements
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_movement_id;
  
  -- Registrar auditoria
  PERFORM log_audit_event(
    'movement_processed',
    'movement',
    p_movement_id,
    jsonb_build_object('type', v_movement_type)
  );
END;
$$;

-- ========================================
-- FUNÇÃO: reserve_stock_for_shipment (ATÔMICA - NOVA)
-- Reserva todas as linhas de uma expedição de uma vez
-- ========================================
CREATE OR REPLACE FUNCTION reserve_stock_for_shipment(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line RECORD;
  v_available NUMERIC;
BEGIN
  -- Validar usuário
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Processar todas as linhas
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
    
    -- BLOQUEAR saldo com FOR UPDATE
    SELECT available_quantity INTO v_available
    FROM stock_balances
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id
    FOR UPDATE;
    
    IF v_available IS NULL OR v_available < v_line.requested_quantity THEN
      -- Rollback automático: nenhuma reserva será aplicada
      RAISE EXCEPTION 'Estoque insuficiente para produto %. Disponível: %, Solicitado: %',
        v_line.product_id, COALESCE(v_available, 0), v_line.requested_quantity;
    END IF;
  END LOOP;
  
  -- Se chegou aqui, todas as linhas têm estoque suficiente
  -- Aplicar todas as reservas
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
  LOOP
    UPDATE stock_balances
    SET reserved_quantity = reserved_quantity + v_line.requested_quantity,
        updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
  END LOOP;
  
  -- Atualizar status da expedição
  UPDATE shipments
  SET status = 'picking'
  WHERE id = p_shipment_id;
  
  -- Registrar auditoria
  PERFORM log_audit_event(
    'shipment_picking_started',
    'shipment',
    p_shipment_id
  );
END;
$$;

-- ========================================
-- FUNÇÃO: release_shipment_reservations
-- ========================================
CREATE OR REPLACE FUNCTION release_shipment_reservations(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line RECORD;
BEGIN
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
END;
$$;

-- ========================================
-- FUNÇÃO: confirm_shipment_picked (ATÔMICA)
-- ========================================
CREATE OR REPLACE FUNCTION confirm_shipment_picked(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line RECORD;
  v_reserved NUMERIC;
BEGIN
  -- Validar status
  IF (SELECT status FROM shipments WHERE id = p_shipment_id FOR UPDATE) != 'picking' THEN
    RAISE EXCEPTION 'Expedição não está em separação';
  END IF;
  
  -- Confirmar cada linha
  FOR v_line IN
    SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
    FOR UPDATE
  LOOP
    IF v_line.from_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização de origem não definida';
    END IF;
    
    IF v_line.picked_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade separada deve ser positiva';
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
    
    -- Criar movimentação de saída
    INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, completed_at)
    VALUES (
      generate_movement_reference('outbound'),
      'outbound',
      'completed',
      auth.uid(),
      (SELECT shipment_number FROM shipments WHERE id = p_shipment_id),
      NOW()
    )
    RETURNING id INTO v_line.id; -- Reutiliza variável
    
    -- Nota: a criação da movement_line deve ser feita separadamente
  END LOOP;
  
  -- Atualizar status da expedição
  UPDATE shipments
  SET status = 'packed'
  WHERE id = p_shipment_id;
  
  PERFORM log_audit_event('shipment_picked', 'shipment', p_shipment_id);
END;
$$;

-- ========================================
-- FUNÇÃO: process_receipt_atomically (ATÔMICA - NOVA)
-- Processa todo o recebimento de uma vez
-- ========================================
CREATE OR REPLACE FUNCTION process_receipt_atomically(p_receipt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line RECORD;
  v_has_received_items BOOLEAN := false;
  v_all_received BOOLEAN := true;
BEGIN
  -- Validar usuário
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- BLOQUEAR recebimento
  PERFORM 1 FROM receipts WHERE id = p_receipt_id FOR UPDATE;
  
  -- Validar status
  IF (SELECT status FROM receipts WHERE id = p_receipt_id) NOT IN ('pending', 'partial') THEN
    RAISE EXCEPTION 'Recebimento já foi concluído ou cancelado';
  END IF;
  
  -- Verificar se há itens recebidos e validar todos
  FOR v_line IN
    SELECT * FROM receipt_lines WHERE receipt_id = p_receipt_id FOR UPDATE
  LOOP
    IF v_line.received_quantity > 0 THEN
      v_has_received_items := true;
      
      IF v_line.location_id IS NULL THEN
        RAISE EXCEPTION 'Localização não definida para produto % com quantidade recebida', v_line.product_id;
      END IF;
    END IF;
    
    IF v_line.received_quantity < v_line.expected_quantity THEN
      v_all_received := false;
    END IF;
  END LOOP;
  
  IF NOT v_has_received_items THEN
    RAISE EXCEPTION 'Nenhum item foi recebido ainda';
  END IF;
  
  -- Processar cada linha com quantidade recebida
  FOR v_line IN
    SELECT * FROM receipt_lines WHERE receipt_id = p_receipt_id AND received_quantity > 0
  LOOP
    -- Criar movimentação de entrada
    INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, completed_at)
    VALUES (
      generate_movement_reference('inbound'),
      'inbound',
      'completed',
      auth.uid(),
      (SELECT receipt_number FROM receipts WHERE id = p_receipt_id),
      NOW()
    )
    RETURNING id INTO v_line.id;
    
    -- Adicionar linha da movimentação
    INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit)
    VALUES (v_line.id, v_line.product_id, v_line.location_id, v_line.received_quantity, v_line.unit);
    
    -- Atualizar estoque
    INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
    VALUES (v_line.product_id, v_line.location_id, v_line.received_quantity, NOW())
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET
      quantity = stock_balances.quantity + v_line.received_quantity,
      last_movement_at = NOW(),
      updated_at = NOW();
  END LOOP;
  
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
    jsonb_build_object('all_received', v_all_received)
  );
END;
$$;

-- ========================================
-- FUNÇÃO: process_stock_count_adjustments (ATÔMICA)
-- ========================================
CREATE OR REPLACE FUNCTION process_stock_count_adjustments(p_count_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line RECORD;
  v_difference NUMERIC;
BEGIN
  -- Validar usuário
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- BLOQUEAR contagem
  PERFORM 1 FROM stock_counts WHERE id = p_count_id FOR UPDATE;
  
  -- Validar status
  IF (SELECT status FROM stock_counts WHERE id = p_count_id) != 'in_progress' THEN
    RAISE EXCEPTION 'Contagem não está em andamento';
  END IF;
  
  -- Processar cada linha com divergência
  FOR v_line IN
    SELECT * FROM stock_count_lines WHERE stock_count_id = p_count_id
  LOOP
    v_difference := v_line.counted_quantity - v_line.system_quantity;
    
    IF v_difference != 0 THEN
      -- Criar movimentação de ajuste
      INSERT INTO movements (reference, movement_type, status, operator_id, source_reference, notes, completed_at)
      VALUES (
        generate_movement_reference('adjustment'),
        'adjustment',
        'completed',
        auth.uid(),
        (SELECT count_number FROM stock_counts WHERE id = p_count_id),
        format('Ajuste de contagem: Sistema=%s, Contado=%s, Diferença=%s',
          v_line.system_quantity, v_line.counted_quantity, v_difference),
        NOW()
      )
      RETURNING id INTO v_line.id;
      
      -- Adicionar linha da movimentação
      IF v_difference > 0 THEN
        INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity, unit)
        VALUES (v_line.id, v_line.product_id, v_line.location_id, v_difference, 'un');
        
        INSERT INTO stock_balances (product_id, location_id, quantity, last_movement_at)
        VALUES (v_line.product_id, v_line.location_id, v_difference, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
          quantity = stock_balances.quantity + v_difference,
          last_movement_at = NOW(),
          updated_at = NOW();
      ELSE
        INSERT INTO movement_lines (movement_id, product_id, from_location_id, quantity, unit)
        VALUES (v_line.id, v_line.product_id, v_line.location_id, ABS(v_difference), 'un');
        
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
  
  PERFORM log_audit_event('stock_count_completed', 'stock_count', p_count_id);
END;
$$;

-- ========================================
-- FUNÇÃO: get_products_with_stock (OTIMIZADA - evita N+1)
-- ========================================
CREATE OR REPLACE FUNCTION get_products_with_stock()
RETURNS TABLE (
  id UUID,
  sku TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  unit_base TEXT,
  min_stock NUMERIC,
  max_stock NUMERIC,
  active BOOLEAN,
  total_stock NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.sku,
    p.name,
    p.description,
    p.category,
    p.unit_base,
    p.min_stock,
    p.max_stock,
    p.active,
    COALESCE(SUM(sb.quantity), 0) AS total_stock,
    p.created_at,
    p.updated_at
  FROM products p
  LEFT JOIN stock_balances sb ON sb.product_id = p.id
  WHERE p.active = true
  GROUP BY p.id
  ORDER BY p.sku;
END;
$$;

-- ========================================
-- RESTRINGIR EXECUÇÃO DAS FUNÇÕES CRÍTICAS
-- ========================================
REVOKE ALL ON FUNCTION process_stock_movement(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_stock_movement(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION reserve_stock_for_shipment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_stock_for_shipment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION release_shipment_reservations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_shipment_reservations(UUID) TO authenticated;

REVOKE ALL ON FUNCTION confirm_shipment_picked(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_shipment_picked(UUID) TO authenticated;

REVOKE ALL ON FUNCTION process_receipt_atomically(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_receipt_atomically(UUID) TO authenticated;

REVOKE ALL ON FUNCTION process_stock_count_adjustments(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_stock_count_adjustments(UUID) TO authenticated;

REVOKE ALL ON FUNCTION log_audit_event(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, UUID, JSONB) TO authenticated;
