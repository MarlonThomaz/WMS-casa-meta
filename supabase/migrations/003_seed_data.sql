-- ========================================
-- WMS Casa Meta - Dados de Exemplo
-- Migration 003: Seed data para testes
-- ========================================

-- ========================================
-- INSERIR LOCALIZAÇÕES DE EXEMPLO
-- ========================================
INSERT INTO locations (code, zone, aisle, rack, level, location_type, capacity, status) VALUES
-- Zona A - Armazenamento principal
('A-01-01-01', 'A', '01', '01', '01', 'storage', 100, 'available'),
('A-01-01-02', 'A', '01', '01', '02', 'storage', 100, 'available'),
('A-01-02-01', 'A', '01', '02', '01', 'storage', 100, 'available'),
('A-01-02-02', 'A', '01', '02', '02', 'storage', 100, 'available'),
('A-02-01-01', 'A', '02', '01', '01', 'storage', 150, 'available'),
('A-02-01-02', 'A', '02', '01', '02', 'storage', 150, 'available'),
('A-02-02-01', 'A', '02', '02', '01', 'storage', 150, 'available'),
('A-02-02-02', 'A', '02', '02', '02', 'storage', 150, 'available'),
('A-03-01-01', 'A', '03', '01', '01', 'storage', 200, 'available'),
('A-03-01-02', 'A', '03', '01', '02', 'storage', 200, 'available'),

-- Zona B - Armazenamento secundário
('B-01-01-01', 'B', '01', '01', '01', 'storage', 120, 'available'),
('B-01-01-02', 'B', '01', '01', '02', 'storage', 120, 'available'),
('B-01-02-01', 'B', '01', '02', '01', 'storage', 120, 'available'),
('B-01-02-02', 'B', '01', '02', '02', 'storage', 120, 'available'),
('B-02-01-01', 'B', '02', '01', '01', 'storage', 180, 'available'),
('B-02-01-02', 'B', '02', '01', '02', 'storage', 180, 'available'),
('B-02-02-01', 'B', '02', '02', '01', 'storage', 180, 'available'),
('B-02-02-02', 'B', '02', '02', '02', 'storage', 180, 'available'),

-- Zona C - picking
('PICK-01', 'C', '01', '01', '01', 'picking', 50, 'available'),
('PICK-02', 'C', '01', '01', '02', 'picking', 50, 'available'),
('PICK-03', 'C', '01', '02', '01', 'picking', 50, 'available'),
('PICK-04', 'C', '01', '02', '02', 'picking', 50, 'available'),

-- Zona D - Recebimento e expedição
('RECV-01', 'D', '01', '01', '01', 'receiving', 100, 'available'),
('RECV-02', 'D', '01', '01', '02', 'receiving', 100, 'available'),
('SHIP-01', 'D', '02', '01', '01', 'shipping', 100, 'available'),
('SHIP-02', 'D', '02', '01', '02', 'shipping', 100, 'available'),
('STAGE-01', 'D', '03', '01', '01', 'staging', 80, 'available'),
('STAGE-02', 'D', '03', '01', '02', 'staging', 80, 'available'),

-- Zona E - Quarentena
('QUAR-01', 'E', '01', '01', '01', 'quarantine', 30, 'available'),
('QUAR-02', 'E', '01', '01', '02', 'quarantine', 30, 'available');

-- ========================================
-- INSERIR PRODUTOS DE EXEMPLO
-- ========================================
INSERT INTO products (sku, name, description, category, unit_base, min_stock, max_stock) VALUES
('SKU-001', 'Notebook Dell Inspiron 15', 'Notebook Dell Inspiron 15 polegadas', 'Eletrônicos', 'un', 10, 100),
('SKU-002', 'Mouse Logitech MX Master', 'Mouse sem fio Logitech MX Master', 'Periféricos', 'un', 20, 200),
('SKU-003', 'Teclado Mecânico Redragon', 'Teclado mecânico RGB Redragon', 'Periféricos', 'un', 15, 150),
('SKU-004', 'Monitor Samsung 27"', 'Monitor LED Samsung 27 polegadas', 'Eletrônicos', 'un', 5, 50),
('SKU-005', 'Cabo HDMI 2m', 'Cabo HDMI 2 metros alta velocidade', 'Cabos', 'un', 50, 500),
('SKU-006', 'Webcam Logitech C920', 'Webcam Full HD Logitech C920', 'Periféricos', 'un', 10, 80),
('SKU-007', 'SSD Kingston 480GB', 'SSD Kingston A400 480GB SATA', 'Componentes', 'un', 15, 120),
('SKU-008', 'Memória RAM 16GB DDR4', 'Memória RAM 16GB DDR4 3200MHz', 'Componentes', 'un', 20, 150),
('SKU-009', 'Fonte Corsair 650W', 'Fonte Corsair CV650 650W 80 Plus', 'Componentes', 'un', 8, 60),
('SKU-010', 'Headset HyperX Cloud', 'Headset gamer HyperX Cloud II', 'Periféricos', 'un', 10, 100);

-- ========================================
-- INSERIR CÓDIGOS DE BARRAS DE EXEMPLO
-- ========================================
INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary) 
SELECT 
  p.id,
  '789' || LPAD(p.id::TEXT, 10, '0'),
  'EAN13',
  'unit',
  1,
  true
FROM products p;

-- Adicionar códigos de barras adicionais para embalagens
INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary) 
SELECT 
  p.id,
  'BOX' || LPAD(p.id::TEXT, 7, '0'),
  'CODE128',
  'box',
  CASE 
    WHEN p.sku = 'SKU-005' THEN 50  -- Cabos vêm em caixa com 50
    WHEN p.sku = 'SKU-002' THEN 24  -- Mouses vêm em caixa com 24
    ELSE 10  -- Demais produtos vêm em caixa com 10
  END,
  false
FROM products p;

-- ========================================
-- INSERIR SALDOS DE ESTOQUE INICIAIS
-- ========================================
INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT 
  p.id,
  l.id,
  CASE 
    WHEN p.sku = 'SKU-001' THEN 45
    WHEN p.sku = 'SKU-002' THEN 120
    WHEN p.sku = 'SKU-003' THEN 8
    WHEN p.sku = 'SKU-004' THEN 32
    WHEN p.sku = 'SKU-005' THEN 250
    WHEN p.sku = 'SKU-006' THEN 5
    WHEN p.sku = 'SKU-007' THEN 67
    WHEN p.sku = 'SKU-008' THEN 89
    WHEN p.sku = 'SKU-009' THEN 3
    WHEN p.sku = 'SKU-010' THEN 42
    ELSE 0
  END
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM locations 
  WHERE location_type = 'storage' 
  ORDER BY RANDOM() 
  LIMIT 1
) l
WHERE p.sku IN ('SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005', 'SKU-006', 'SKU-007', 'SKU-008', 'SKU-009', 'SKU-010');

-- Adicionar alguns produtos em múltiplas localizações
INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT 
  (SELECT id FROM products WHERE sku = 'SKU-002'),
  (SELECT id FROM locations WHERE code = 'PICK-01'),
  20
ON CONFLICT (product_id, location_id) DO NOTHING;

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT 
  (SELECT id FROM products WHERE sku = 'SKU-005'),
  (SELECT id FROM locations WHERE code = 'PICK-02'),
  50
ON CONFLICT (product_id, location_id) DO NOTHING;

-- ========================================
-- VERIFICAÇÃO
-- ========================================
DO $$
DECLARE
  v_products_count INTEGER;
  v_locations_count INTEGER;
  v_barcodes_count INTEGER;
  v_balances_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_products_count FROM products;
  SELECT COUNT(*) INTO v_locations_count FROM locations;
  SELECT COUNT(*) INTO v_barcodes_count FROM product_barcodes;
  SELECT COUNT(*) INTO v_balances_count FROM stock_balances;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed Data Inserido com Sucesso!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Produtos: %', v_products_count;
  RAISE NOTICE 'Localizações: %', v_locations_count;
  RAISE NOTICE 'Códigos de Barras: %', v_barcodes_count;
  RAISE NOTICE 'Saldos de Estoque: %', v_balances_count;
  RAISE NOTICE '========================================';
END $$;
