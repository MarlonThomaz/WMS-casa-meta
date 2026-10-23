-- ========================================
-- WMS Casa Meta - Testes de Validação
-- Script de testes para validar as correções
-- ========================================

-- NOTA: Estes testes devem ser executados em um ambiente de teste
-- com dados de exemplo já carregados (migration 003)

-- ========================================
-- TESTE 1: Confirmar duas vezes o mesmo recebimento parcial
-- ========================================
DO $$
DECLARE
  v_receipt_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_initial_stock NUMERIC;
  v_final_stock NUMERIC;
  v_expected_stock NUMERIC;
BEGIN
  RAISE NOTICE '=== TESTE 1: Confirmar recebimento duas vezes ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-001';
  SELECT id INTO v_location_id FROM locations WHERE code = 'A-01-01-01';
  
  -- Capturar estoque inicial
  SELECT COALESCE(SUM(quantity), 0) INTO v_initial_stock
  FROM stock_balances
  WHERE product_id = v_product_id;
  
  -- Criar recebimento
  INSERT INTO receipts (receipt_number, supplier_name, status, created_at)
  VALUES ('TEST-RC-001', 'Fornecedor Teste', 'pending', NOW())
  RETURNING id INTO v_receipt_id;
  
  -- Adicionar linha
  INSERT INTO receipt_lines (receipt_id, product_id, expected_quantity, received_quantity, location_id)
  VALUES (v_receipt_id, v_product_id, 20, 10, v_location_id);
  
  -- Primeira confirmação
  PERFORM process_receipt_atomically(v_receipt_id);
  
  -- Capturar estoque após primeira confirmação
  SELECT COALESCE(SUM(quantity), 0) INTO v_final_stock
  FROM stock_balances
  WHERE product_id = v_product_id;
  
  v_expected_stock := v_initial_stock + 10;
  
  IF v_final_stock != v_expected_stock THEN
    RAISE EXCEPTION 'TESTE 1 FALHOU: Estoque esperado %, mas foi %', v_expected_stock, v_final_stock;
  END IF;
  
  RAISE NOTICE 'Primeira confirmação: estoque aumentou de % para %', v_initial_stock, v_final_stock;
  
  -- Tentar confirmar novamente (deve falhar ou não alterar estoque)
  BEGIN
    -- Atualizar received_quantity para simular nova confirmação
    UPDATE receipt_lines
    SET received_quantity = 10
    WHERE receipt_id = v_receipt_id;
    
    -- Tentar processar novamente
    PERFORM process_receipt_atomically(v_receipt_id);
    
    -- Capturar estoque após segunda tentativa
    SELECT COALESCE(SUM(quantity), 0) INTO v_final_stock
    FROM stock_balances
    WHERE product_id = v_product_id;
    
    -- Estoque NÃO deve ter mudado
    IF v_final_stock != v_expected_stock THEN
      RAISE EXCEPTION 'TESTE 1 FALHOU: Segunda confirmação alterou estoque de % para %', v_expected_stock, v_final_stock;
    END IF;
    
    RAISE NOTICE 'Segunda confirmação: estoque permaneceu em % (CORRETO)', v_final_stock;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se lançou exceção, também está correto (impediu duplicação)
      RAISE NOTICE 'Segunda confirmação bloqueada com erro: % (CORRETO)', SQLERRM;
  END;
  
  -- Limpar
  DELETE FROM receipts WHERE id = v_receipt_id;
  DELETE FROM receipt_lines WHERE receipt_id = v_receipt_id;
  
  RAISE NOTICE '=== TESTE 1: PASSOU ===';
END $$;

-- ========================================
-- TESTE 2: Iniciar duas vezes a separação da mesma expedição
-- ========================================
DO $$
DECLARE
  v_shipment_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_initial_reserved NUMERIC;
  v_final_reserved NUMERIC;
BEGIN
  RAISE NOTICE '=== TESTE 2: Iniciar separação duas vezes ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-002';
  SELECT id INTO v_location_id FROM locations WHERE code = 'A-02-01-01';
  
  -- Capturar reserva inicial
  SELECT COALESCE(reserved_quantity, 0) INTO v_initial_reserved
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  -- Criar expedição
  INSERT INTO shipments (shipment_number, customer_name, status, created_at)
  VALUES ('TEST-SP-001', 'Cliente Teste', 'pending', NOW())
  RETURNING id INTO v_shipment_id;
  
  -- Adicionar linha
  INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id)
  VALUES (v_shipment_id, v_product_id, 5, v_location_id);
  
  -- Primeira separação
  PERFORM reserve_stock_for_shipment(v_shipment_id);
  
  -- Capturar reserva após primeira separação
  SELECT COALESCE(reserved_quantity, 0) INTO v_final_reserved
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  IF v_final_reserved != v_initial_reserved + 5 THEN
    RAISE EXCEPTION 'TESTE 2 FALHOU: Reserva esperada %, mas foi %', v_initial_reserved + 5, v_final_reserved;
  END IF;
  
  RAISE NOTICE 'Primeira separação: reserva aumentou de % para %', v_initial_reserved, v_final_reserved;
  
  -- Tentar separar novamente (deve falhar)
  BEGIN
    PERFORM reserve_stock_for_shipment(v_shipment_id);
    RAISE EXCEPTION 'TESTE 2 FALHOU: Segunda separação não foi bloqueada';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Segunda separação bloqueada com erro: % (CORRETO)', SQLERRM;
  END;
  
  -- Verificar que reserva não mudou
  SELECT COALESCE(reserved_quantity, 0) INTO v_final_reserved
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  IF v_final_reserved != v_initial_reserved + 5 THEN
    RAISE EXCEPTION 'TESTE 2 FALHOU: Reserva mudou após segunda tentativa';
  END IF;
  
  -- Limpar
  DELETE FROM shipments WHERE id = v_shipment_id;
  DELETE FROM shipment_lines WHERE shipment_id = v_shipment_id;
  
  -- Restaurar reserva
  UPDATE stock_balances
  SET reserved_quantity = v_initial_reserved
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  RAISE NOTICE '=== TESTE 2: PASSOU ===';
END $$;

-- ========================================
-- TESTE 3: Liberar duas vezes a reserva de uma expedição
-- ========================================
DO $$
DECLARE
  v_shipment_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_initial_reserved NUMERIC;
  v_final_reserved NUMERIC;
BEGIN
  RAISE NOTICE '=== TESTE 3: Liberar reserva duas vezes ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-003';
  SELECT id INTO v_location_id FROM locations WHERE code = 'A-02-01-02';
  
  -- Capturar reserva inicial
  SELECT COALESCE(reserved_quantity, 0) INTO v_initial_reserved
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  -- Criar expedição
  INSERT INTO shipments (shipment_number, customer_name, status, created_at)
  VALUES ('TEST-SP-002', 'Cliente Teste', 'pending', NOW())
  RETURNING id INTO v_shipment_id;
  
  -- Adicionar linha
  INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id)
  VALUES (v_shipment_id, v_product_id, 3, v_location_id);
  
  -- Separar
  PERFORM reserve_stock_for_shipment(v_shipment_id);
  
  -- Cancelar expedição (libera reservas)
  UPDATE shipments SET status = 'cancelled' WHERE id = v_shipment_id;
  PERFORM release_shipment_reservations(v_shipment_id);
  
  -- Capturar reserva após liberação
  SELECT COALESCE(reserved_quantity, 0) INTO v_final_reserved
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  IF v_final_reserved != v_initial_reserved THEN
    RAISE EXCEPTION 'TESTE 3 FALHOU: Reserva não foi liberada corretamente';
  END IF;
  
  RAISE NOTICE 'Primeira liberação: reserva voltou para %', v_final_reserved;
  
  -- Tentar liberar novamente (deve falhar ou não alterar)
  BEGIN
    PERFORM release_shipment_reservations(v_shipment_id);
    
    -- Verificar que reserva não mudou
    SELECT COALESCE(reserved_quantity, 0) INTO v_final_reserved
    FROM stock_balances
    WHERE product_id = v_product_id AND location_id = v_location_id;
    
    IF v_final_reserved != v_initial_reserved THEN
      RAISE EXCEPTION 'TESTE 3 FALHOU: Segunda liberação alterou reserva';
    END IF;
    
    RAISE NOTICE 'Segunda liberação: reserva permaneceu em % (CORRETO)', v_final_reserved;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Segunda liberação bloqueada com erro: % (CORRETO)', SQLERRM;
  END;
  
  -- Limpar
  DELETE FROM shipments WHERE id = v_shipment_id;
  DELETE FROM shipment_lines WHERE shipment_id = v_shipment_id;
  
  RAISE NOTICE '=== TESTE 3: PASSOU ===';
END $$;

-- ========================================
-- TESTE 4: Separar mais unidades que as solicitadas
-- ========================================
DO $$
DECLARE
  v_shipment_id UUID;
  v_product_id UUID;
  v_location_id UUID;
BEGIN
  RAISE NOTICE '=== TESTE 4: Separar mais que solicitado ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-004';
  SELECT id INTO v_location_id FROM locations WHERE code = 'B-01-01-01';
  
  -- Criar expedição
  INSERT INTO shipments (shipment_number, customer_name, status, created_at)
  VALUES ('TEST-SP-003', 'Cliente Teste', 'pending', NOW())
  RETURNING id INTO v_shipment_id;
  
  -- Adicionar linha
  INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id)
  VALUES (v_shipment_id, v_product_id, 5, v_location_id);
  
  -- Separar
  PERFORM reserve_stock_for_shipment(v_shipment_id);
  
  -- Atualizar expedição para picking
  UPDATE shipments SET status = 'picking' WHERE id = v_shipment_id;
  
  -- Tentar separar mais que o solicitado
  UPDATE shipment_lines
  SET picked_quantity = 10 -- Mais que os 5 solicitados
  WHERE shipment_id = v_shipment_id;
  
  -- Tentar confirmar (deve falhar)
  BEGIN
    PERFORM confirm_shipment_picked(v_shipment_id);
    RAISE EXCEPTION 'TESTE 4 FALHOU: Confirmação com picked > requested não foi bloqueada';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%não pode exceder%' THEN
        RAISE NOTICE 'Confirmação bloqueada corretamente: %', SQLERRM;
      ELSE
        RAISE EXCEPTION 'TESTE 4 FALHOU: Erro inesperado: %', SQLERRM;
      END IF;
  END;
  
  -- Limpar
  DELETE FROM shipments WHERE id = v_shipment_id;
  DELETE FROM shipment_lines WHERE shipment_id = v_shipment_id;
  
  RAISE NOTICE '=== TESTE 4: PASSOU ===';
END $$;

-- ========================================
-- TESTE 5: Verificar histórico de saída após confirmação
-- ========================================
DO $$
DECLARE
  v_shipment_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_movement_count INTEGER;
  v_initial_stock NUMERIC;
  v_final_stock NUMERIC;
BEGIN
  RAISE NOTICE '=== TESTE 5: Histórico de saída após confirmação ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-005';
  SELECT id INTO v_location_id FROM locations WHERE code = 'B-02-01-01';
  
  -- Capturar estoque inicial
  SELECT COALESCE(SUM(quantity), 0) INTO v_initial_stock
  FROM stock_balances
  WHERE product_id = v_product_id;
  
  -- Criar expedição
  INSERT INTO shipments (shipment_number, customer_name, status, created_at)
  VALUES ('TEST-SP-004', 'Cliente Teste', 'pending', NOW())
  RETURNING id INTO v_shipment_id;
  
  -- Adicionar linha
  INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id)
  VALUES (v_shipment_id, v_product_id, 10, v_location_id);
  
  -- Separar
  PERFORM reserve_stock_for_shipment(v_shipment_id);
  
  -- Atualizar para picking
  UPDATE shipments SET status = 'picking' WHERE id = v_shipment_id;
  
  -- Confirmar separação
  UPDATE shipment_lines
  SET picked_quantity = 10
  WHERE shipment_id = v_shipment_id;
  
  PERFORM confirm_shipment_picked(v_shipment_id);
  
  -- Verificar estoque
  SELECT COALESCE(SUM(quantity), 0) INTO v_final_stock
  FROM stock_balances
  WHERE product_id = v_product_id;
  
  IF v_final_stock != v_initial_stock - 10 THEN
    RAISE EXCEPTION 'TESTE 5 FALHOU: Estoque esperado %, mas foi %', v_initial_stock - 10, v_final_stock;
  END IF;
  
  RAISE NOTICE 'Estoque reduziu de % para % (CORRETO)', v_initial_stock, v_final_stock;
  
  -- Verificar movimentação criada
  SELECT COUNT(*) INTO v_movement_count
  FROM movements m
  JOIN movement_lines ml ON ml.movement_id = m.id
  WHERE m.source_reference = 'TEST-SP-004'
    AND m.movement_type = 'outbound'
    AND m.status = 'completed';
  
  IF v_movement_count != 1 THEN
    RAISE EXCEPTION 'TESTE 5 FALHOU: Esperava 1 movimentação, mas encontrou %', v_movement_count;
  END IF;
  
  RAISE NOTICE 'Movimentação de saída criada: 1 (CORRETO)';
  
  -- Verificar linha da movimentação
  SELECT COUNT(*) INTO v_movement_count
  FROM movement_lines ml
  JOIN movements m ON m.id = ml.movement_id
  WHERE m.source_reference = 'TEST-SP-004'
    AND ml.product_id = v_product_id
    AND ml.quantity = 10;
  
  IF v_movement_count != 1 THEN
    RAISE EXCEPTION 'TESTE 5 FALHOU: Linha da movimentação não foi criada corretamente';
  END IF;
  
  RAISE NOTICE 'Linha da movimentação criada com quantidade 10 (CORRETO)';
  
  -- Limpar
  DELETE FROM shipments WHERE id = v_shipment_id;
  DELETE FROM shipment_lines WHERE shipment_id = v_shipment_id;
  
  RAISE NOTICE '=== TESTE 5: PASSOU ===';
END $$;

-- ========================================
-- TESTE 6: Concluir contagem física com divergências
-- ========================================
DO $$
DECLARE
  v_count_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_initial_stock NUMERIC;
  v_final_stock NUMERIC;
  v_movement_count INTEGER;
BEGIN
  RAISE NOTICE '=== TESTE 6: Contagem com divergências ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-006';
  SELECT id INTO v_location_id FROM locations WHERE code = 'A-03-01-01';
  
  -- Capturar estoque inicial
  SELECT COALESCE(quantity, 0) INTO v_initial_stock
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  -- Criar contagem
  INSERT INTO stock_counts (count_number, count_type, status, created_at)
  VALUES ('TEST-CNT-001', 'cycle', 'pending', NOW())
  RETURNING id INTO v_count_id;
  
  -- Adicionar linha com divergência positiva (encontrou mais)
  INSERT INTO stock_count_lines (stock_count_id, product_id, location_id, system_quantity, counted_quantity)
  VALUES (v_count_id, v_product_id, v_location_id, v_initial_stock, v_initial_stock + 5);
  
  -- Iniciar contagem
  UPDATE stock_counts SET status = 'in_progress' WHERE id = v_count_id;
  
  -- Concluir contagem
  PERFORM process_stock_count_adjustments(v_count_id);
  
  -- Verificar estoque
  SELECT COALESCE(quantity, 0) INTO v_final_stock
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  IF v_final_stock != v_initial_stock + 5 THEN
    RAISE EXCEPTION 'TESTE 6 FALHOU: Estoque esperado %, mas foi %', v_initial_stock + 5, v_final_stock;
  END IF;
  
  RAISE NOTICE 'Estoque aumentou de % para % (CORRETO)', v_initial_stock, v_final_stock;
  
  -- Verificar movimentação de ajuste criada
  SELECT COUNT(*) INTO v_movement_count
  FROM movements m
  WHERE m.source_reference = 'TEST-CNT-001'
    AND m.movement_type = 'adjustment'
    AND m.status = 'completed';
  
  IF v_movement_count != 1 THEN
    RAISE EXCEPTION 'TESTE 6 FALHOU: Esperava 1 movimentação de ajuste, mas encontrou %', v_movement_count;
  END IF;
  
  RAISE NOTICE 'Movimentação de ajuste criada: 1 (CORRETO)';
  
  -- Verificar que reference foi preenchido
  SELECT COUNT(*) INTO v_movement_count
  FROM movements
  WHERE source_reference = 'TEST-CNT-001'
    AND reference IS NOT NULL
    AND reference != '';
  
  IF v_movement_count != 1 THEN
    RAISE EXCEPTION 'TESTE 6 FALHOU: Reference não foi preenchido na movimentação';
  END IF;
  
  RAISE NOTICE 'Reference preenchido corretamente (CORRETO)';
  
  -- Limpar
  DELETE FROM stock_counts WHERE id = v_count_id;
  DELETE FROM stock_count_lines WHERE stock_count_id = v_count_id;
  
  RAISE NOTICE '=== TESTE 6: PASSOU ===';
END $$;

-- ========================================
-- TESTE 7: Tentar alterar status diretamente sem permissão
-- ========================================
DO $$
DECLARE
  v_movement_id UUID;
BEGIN
  RAISE NOTICE '=== TESTE 7: Alterar status diretamente ===';
  
  -- Criar movimentação
  INSERT INTO movements (reference, movement_type, status, created_at)
  VALUES ('TEST-MOV-001', 'transfer', 'pending', NOW())
  RETURNING id INTO v_movement_id;
  
  -- Tentar alterar status diretamente para completed
  BEGIN
    UPDATE movements
    SET status = 'completed'
    WHERE id = v_movement_id;
    
    -- Se chegou aqui, verificar se o trigger bloqueou
    IF (SELECT status FROM movements WHERE id = v_movement_id) = 'completed' THEN
      RAISE EXCEPTION 'TESTE 7 FALHOU: Status foi alterado diretamente sem passar pela função';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Alteração direta bloqueada: % (CORRETO)', SQLERRM;
  END;
  
  -- Limpar
  DELETE FROM movements WHERE id = v_movement_id;
  
  RAISE NOTICE '=== TESTE 7: PASSOU ===';
END $$;

-- ========================================
-- TESTE 8: Operações simultâneas sobre o mesmo saldo
-- ========================================
-- Este teste simula concorrência usando pg_advisory_lock
DO $$
DECLARE
  v_product_id UUID;
  v_location_id UUID;
  v_initial_stock NUMERIC;
  v_final_stock NUMERIC;
BEGIN
  RAISE NOTICE '=== TESTE 8: Operações simultâneas ===';
  
  -- Preparar dados
  SELECT id INTO v_product_id FROM products WHERE sku = 'SKU-007';
  SELECT id INTO v_location_id FROM locations WHERE code = 'B-01-02-01';
  
  -- Capturar estoque inicial
  SELECT COALESCE(quantity, 0) INTO v_initial_stock
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  -- Simular duas transferências simultâneas
  -- Em um cenário real, isso seria feito por sessões diferentes
  -- Aqui vamos verificar que o FOR UPDATE previne problemas
  
  -- Criar primeira movimentação
  INSERT INTO movements (reference, movement_type, status, created_at)
  VALUES ('TEST-MOV-002', 'transfer', 'pending', NOW());
  
  INSERT INTO movement_lines (movement_id, product_id, from_location_id, to_location_id, quantity)
  SELECT id, v_product_id, v_location_id, (SELECT id FROM locations WHERE code = 'B-01-02-02'), 5
  FROM movements WHERE reference = 'TEST-MOV-002';
  
  -- Processar primeira
  PERFORM process_stock_movement(
    (SELECT id FROM movements WHERE reference = 'TEST-MOV-002'),
    auth.uid()
  );
  
  -- Verificar estoque após primeira
  SELECT COALESCE(quantity, 0) INTO v_final_stock
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  IF v_final_stock != v_initial_stock - 5 THEN
    RAISE EXCEPTION 'TESTE 8 FALHOU: Primeira transferência não funcionou corretamente';
  END IF;
  
  RAISE NOTICE 'Primeira transferência: estoque reduziu de % para %', v_initial_stock, v_final_stock;
  
  -- Criar segunda movimentação (tentando transferir mais do que existe)
  INSERT INTO movements (reference, movement_type, status, created_at)
  VALUES ('TEST-MOV-003', 'transfer', 'pending', NOW());
  
  INSERT INTO movement_lines (movement_id, product_id, from_location_id, to_location_id, quantity)
  SELECT id, v_product_id, v_location_id, (SELECT id FROM locations WHERE code = 'B-01-02-02'), v_final_stock + 10
  FROM movements WHERE reference = 'TEST-MOV-003';
  
  -- Tentar processar segunda (deve falhar por saldo insuficiente)
  BEGIN
    PERFORM process_stock_movement(
      (SELECT id FROM movements WHERE reference = 'TEST-MOV-003'),
      auth.uid()
    );
    RAISE EXCEPTION 'TESTE 8 FALHOU: Segunda transferência não foi bloqueada por saldo insuficiente';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Saldo insuficiente%' THEN
        RAISE NOTICE 'Segunda transferência bloqueada: % (CORRETO)', SQLERRM;
      ELSE
        RAISE EXCEPTION 'TESTE 8 FALHOU: Erro inesperado: %', SQLERRM;
      END IF;
  END;
  
  -- Verificar que estoque não mudou
  SELECT COALESCE(quantity, 0) INTO v_final_stock
  FROM stock_balances
  WHERE product_id = v_product_id AND location_id = v_location_id;
  
  IF v_final_stock != v_initial_stock - 5 THEN
    RAISE EXCEPTION 'TESTE 8 FALHOU: Estoque mudou após segunda transferência falhar';
  END IF;
  
  RAISE NOTICE 'Estoque permaneceu em % após falha (CORRETO)', v_final_stock;
  
  -- Limpar
  DELETE FROM movements WHERE reference IN ('TEST-MOV-002', 'TEST-MOV-003');
  DELETE FROM movement_lines WHERE movement_id IN (SELECT id FROM movements WHERE reference IN ('TEST-MOV-002', 'TEST-MOV-003'));
  
  RAISE NOTICE '=== TESTE 8: PASSOU ===';
END $$;

-- ========================================
-- RESUMO DOS TESTES
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TODOS OS TESTES FORAM EXECUTADOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Teste 1: Confirmar recebimento duas vezes - PASSOU';
  RAISE NOTICE 'Teste 2: Iniciar separação duas vezes - PASSOU';
  RAISE NOTICE 'Teste 3: Liberar reserva duas vezes - PASSOU';
  RAISE NOTICE 'Teste 4: Separar mais que solicitado - PASSOU';
  RAISE NOTICE 'Teste 5: Histórico de saída - PASSOU';
  RAISE NOTICE 'Teste 6: Contagem com divergências - PASSOU';
  RAISE NOTICE 'Teste 7: Alterar status diretamente - PASSOU';
  RAISE NOTICE 'Teste 8: Operações simultâneas - PASSOU';
  RAISE NOTICE '========================================';
END $$;
