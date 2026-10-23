-- ========================================
-- WMS Casa Meta - Motor de Estoque
-- Migration 002: Funções transacionais
-- ========================================

-- ========================================
-- FUNÇÃO: process_stock_movement
-- Função central para processar movimentações de estoque
-- Garante atomicidade e consistência
-- ========================================
CREATE OR REPLACE FUNCTION process_stock_movement(
  p_movement_id UUID,
  p_product_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_quantity NUMERIC,
  p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movement_type TEXT;
  v_movement_status TEXT;
  v_current_balance_from NUMERIC;
  v_current_balance_to NUMERIC;
BEGIN
  -- Buscar dados da movimentação
  SELECT movement_type, status 
  INTO v_movement_type, v_movement_status
  FROM movements 
  WHERE id = p_movement_id;
  
  -- Validar status da movimentação
  IF v_movement_status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'Movimentação já foi processada ou cancelada';
  END IF;
  
  -- Validar quantidade
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  
  -- Processar conforme tipo de movimentação
  CASE v_movement_type
    WHEN 'inbound' THEN
      -- Entrada: creditar no destino
      INSERT INTO stock_balances (product_id, location_id, quantity)
      VALUES (p_product_id, p_to_location_id, p_quantity)
      ON CONFLICT (product_id, location_id) 
      DO UPDATE SET 
        quantity = stock_balances.quantity + p_quantity,
        last_movement_at = NOW(),
        updated_at = NOW();
        
    WHEN 'outbound' THEN
      -- Saída: debitar da origem
      SELECT quantity INTO v_current_balance_from
      FROM stock_balances
      WHERE product_id = p_product_id AND location_id = p_from_location_id;
      
      IF v_current_balance_from IS NULL OR v_current_balance_from < p_quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', 
          COALESCE(v_current_balance_from, 0), p_quantity;
      END IF;
      
      UPDATE stock_balances
      SET quantity = quantity - p_quantity,
          last_movement_at = NOW(),
          updated_at = NOW()
      WHERE product_id = p_product_id AND location_id = p_from_location_id;
      
    WHEN 'transfer' THEN
      -- Transferência: debitar da origem e creditar no destino
      IF p_from_location_id = p_to_location_id THEN
        RAISE EXCEPTION 'Origem e destino não podem ser iguais';
      END IF;
      
      -- Validar saldo na origem
      SELECT quantity INTO v_current_balance_from
      FROM stock_balances
      WHERE product_id = p_product_id AND location_id = p_from_location_id;
      
      IF v_current_balance_from IS NULL OR v_current_balance_from < p_quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente na origem. Disponível: %, Solicitado: %', 
          COALESCE(v_current_balance_from, 0), p_quantity;
      END IF;
      
      -- Debitar da origem
      UPDATE stock_balances
      SET quantity = quantity - p_quantity,
          last_movement_at = NOW(),
          updated_at = NOW()
      WHERE product_id = p_product_id AND location_id = p_from_location_id;
      
      -- Creditar no destino
      INSERT INTO stock_balances (product_id, location_id, quantity)
      VALUES (p_product_id, p_to_location_id, p_quantity)
      ON CONFLICT (product_id, location_id) 
      DO UPDATE SET 
        quantity = stock_balances.quantity + p_quantity,
        last_movement_at = NOW(),
        updated_at = NOW();
        
    WHEN 'adjustment' THEN
      -- Ajuste: pode ser positivo ou negativo
      IF p_from_location_id IS NOT NULL THEN
        -- Ajuste negativo (perda, quebra, etc)
        SELECT quantity INTO v_current_balance_from
        FROM stock_balances
        WHERE product_id = p_product_id AND location_id = p_from_location_id;
        
        IF v_current_balance_from IS NULL OR v_current_balance_from < p_quantity THEN
          RAISE EXCEPTION 'Saldo insuficiente para ajuste. Disponível: %, Solicitado: %', 
            COALESCE(v_current_balance_from, 0), p_quantity;
        END IF;
        
        UPDATE stock_balances
        SET quantity = quantity - p_quantity,
            last_movement_at = NOW(),
            updated_at = NOW()
        WHERE product_id = p_product_id AND location_id = p_from_location_id;
      ELSIF p_to_location_id IS NOT NULL THEN
        -- Ajuste positivo (encontrado, correção, etc)
        INSERT INTO stock_balances (product_id, location_id, quantity)
        VALUES (p_product_id, p_to_location_id, p_quantity)
        ON CONFLICT (product_id, location_id) 
        DO UPDATE SET 
          quantity = stock_balances.quantity + p_quantity,
          last_movement_at = NOW(),
          updated_at = NOW();
      END IF;
      
    ELSE
      RAISE EXCEPTION 'Tipo de movimentação inválido: %', v_movement_type;
  END CASE;
  
  -- Atualizar status da movimentação
  UPDATE movements
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_movement_id;
END;
$$;

-- ========================================
-- FUNÇÃO: get_product_total_stock
-- Retorna o estoque total de um produto
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
-- Retorna o estoque de um produto por endereço
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
-- Retorna a ocupação de um endereço
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
-- FUNÇÃO: reserve_stock
-- Reserva estoque para expedição
-- ========================================
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_location_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  -- Verificar disponibilidade
  SELECT available_quantity INTO v_available
  FROM stock_balances
  WHERE product_id = p_product_id AND location_id = p_location_id;
  
  IF v_available IS NULL OR v_available < p_quantity THEN
    RAISE EXCEPTION 'Estoque disponível insuficiente. Disponível: %, Solicitado: %', 
      COALESCE(v_available, 0), p_quantity;
  END IF;
  
  -- Reservar
  UPDATE stock_balances
  SET reserved_quantity = reserved_quantity + p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id AND location_id = p_location_id;
END;
$$;

-- ========================================
-- FUNÇÃO: release_reservation
-- Libera reserva de estoque
-- ========================================
CREATE OR REPLACE FUNCTION release_reservation(
  p_product_id UUID,
  p_location_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stock_balances
  SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
      updated_at = NOW()
  WHERE product_id = p_product_id AND location_id = p_location_id;
END;
$$;

-- ========================================
-- FUNÇÃO: confirm_picked_stock
-- Confirma estoque separado (picking)
-- Debita quantidade física e libera reserva
-- ========================================
CREATE OR REPLACE FUNCTION confirm_picked_stock(
  p_product_id UUID,
  p_location_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reserved NUMERIC;
BEGIN
  -- Verificar reserva
  SELECT reserved_quantity INTO v_reserved
  FROM stock_balances
  WHERE product_id = p_product_id AND location_id = p_location_id;
  
  IF v_reserved IS NULL OR v_reserved < p_quantity THEN
    RAISE EXCEPTION 'Reserva insuficiente. Reservado: %, Solicitado: %', 
      COALESCE(v_reserved, 0), p_quantity;
  END IF;
  
  -- Debitar quantidade física e liberar reserva
  UPDATE stock_balances
  SET 
    quantity = quantity - p_quantity,
    reserved_quantity = reserved_quantity - p_quantity,
    last_movement_at = NOW(),
    updated_at = NOW()
  WHERE product_id = p_product_id AND location_id = p_location_id;
END;
$$;

-- ========================================
-- FUNÇÃO: find_product_by_barcode
-- Busca produto por código de barras
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
-- FUNÇÃO: generate_movement_reference
-- Gera referência única para movimentação
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
  v_reference TEXT;
BEGIN
  -- Definir prefixo conforme tipo
  CASE p_type
    WHEN 'inbound' THEN v_prefix := 'IN';
    WHEN 'outbound' THEN v_prefix := 'OUT';
    WHEN 'transfer' THEN v_prefix := 'TR';
    WHEN 'adjustment' THEN v_prefix := 'ADJ';
    WHEN 'count' THEN v_prefix := 'CNT';
    ELSE v_prefix := 'MOV';
  END CASE;
  
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Buscar próximo número da sequência
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM '...-....-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM movements
  WHERE reference LIKE v_prefix || '-' || v_year || '-%';
  
  v_reference := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_reference;
END;
$$;

-- ========================================
-- FUNÇÃO: generate_receipt_number
-- Gera número único para recebimento
-- ========================================
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(receipt_number FROM 'RC-....-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM receipts
  WHERE receipt_number LIKE 'RC-' || v_year || '-%';
  
  v_number := 'RC-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$;

-- ========================================
-- FUNÇÃO: generate_shipment_number
-- Gera número único para expedição
-- ========================================
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(shipment_number FROM 'SP-....-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM shipments
  WHERE shipment_number LIKE 'SP-' || v_year || '-%';
  
  v_number := 'SP-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$;

-- ========================================
-- FUNÇÃO: generate_count_number
-- Gera número único para contagem
-- ========================================
CREATE OR REPLACE FUNCTION generate_count_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(count_number FROM 'CNT-....-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM stock_counts
  WHERE count_number LIKE 'CNT-' || v_year || '-%';
  
  v_number := 'CNT-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$;

-- ========================================
-- COMENTÁRIOS DAS FUNÇÕES
-- ========================================

COMMENT ON FUNCTION process_stock_movement IS 'Processa movimentação de estoque de forma transacional';
COMMENT ON FUNCTION get_product_total_stock IS 'Retorna estoque total de um produto';
COMMENT ON FUNCTION get_product_stock_by_location IS 'Retorna estoque de um produto por endereço';
COMMENT ON FUNCTION get_location_occupancy IS 'Retorna ocupação de um endereço';
COMMENT ON FUNCTION reserve_stock IS 'Reserva estoque para expedição';
COMMENT ON FUNCTION release_reservation IS 'Libera reserva de estoque';
COMMENT ON FUNCTION confirm_picked_stock IS 'Confirma estoque separado (picking)';
COMMENT ON FUNCTION find_product_by_barcode IS 'Busca produto por código de barras';
COMMENT ON FUNCTION generate_movement_reference IS 'Gera referência única para movimentação';
COMMENT ON FUNCTION generate_receipt_number IS 'Gera número único para recebimento';
COMMENT ON FUNCTION generate_shipment_number IS 'Gera número único para expedição';
COMMENT ON FUNCTION generate_count_number IS 'Gera número único para contagem';
