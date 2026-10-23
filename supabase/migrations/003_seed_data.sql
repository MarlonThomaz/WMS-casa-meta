-- ========================================
-- WMS Casa Meta - Seed Data Idempotente
-- Migration 003: Dados de exemplo para testes
-- ========================================

-- ========================================
-- INSERIR LOCALIZAÇÕES (IDEMPOTENTE)
-- ========================================
INSERT INTO locations (code, zone, aisle, rack, level, location_type, capacity, status)
VALUES
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
  -- Zona C - Picking
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
  ('QUAR-02', 'E', '01', '01', '02', 'quarantine', 30, 'available')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- INSERIR PRODUTOS (IDEMPOTENTE)
-- ========================================
INSERT INTO products (sku, name, description, category, unit_base, min_stock, max_stock)
VALUES
  ('SKU-001', 'Notebook Dell Inspiron 15', 'Notebook Dell Inspiron 15 polegadas', 'Eletrônicos', 'un', 10, 100),
  ('SKU-002', 'Mouse Logitech MX Master', 'Mouse sem fio Logitech MX Master', 'Periféricos', 'un', 20, 200),
  ('SKU-003', 'Teclado Mecânico Redragon', 'Teclado mecânico RGB Redragon', 'Periféricos', 'un', 15, 150),
  ('SKU-004', 'Monitor Samsung 27"', 'Monitor LED Samsung 27 polegadas', 'Eletrônicos', 'un', 5, 50),
  ('SKU-005', 'Cabo HDMI 2m', 'Cabo HDMI 2 metros alta velocidade', 'Cabos', 'un', 50, 500),
  ('SKU-006', 'Webcam Logitech C920', 'Webcam Full HD Logitech C920', 'Periféricos', 'un', 10, 80),
  ('SKU-007', 'SSD Kingston 480GB', 'SSD Kingston A400 480GB SATA', 'Componentes', 'un', 15, 120),
  ('SKU-008', 'Memória RAM 16GB DDR4', 'Memória RAM 16GB DDR4 3200MHz', 'Componentes', 'un', 20, 150),
  ('SKU-009', 'Fonte Corsair 650W', 'Fonte Corsair CV650 650W 80 Plus', 'Componentes', 'un', 8, 60),
  ('SKU-010', 'Headset HyperX Cloud', 'Headset gamer HyperX Cloud II', 'Periféricos', 'un', 10, 100)
ON CONFLICT (sku) DO NOTHING;

-- ========================================
-- INSERIR CÓDIGOS DE BARRAS VÁLIDOS (IDEMPOTENTE)
-- Códigos EAN-13 válidos para teste (com dígito verificador correto)
-- ========================================
INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100013', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-001'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100013');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100020', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-002'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100020');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100037', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-003'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100037');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100044', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-004'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100044');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100051', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-005'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100051');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100068', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-006'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100068');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100075', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-007'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100075');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100082', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-008'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100082');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100099', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-009'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100099');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, '7891000100105', 'EAN13', 'unit', 1, true
FROM products p WHERE p.sku = 'SKU-010'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = '7891000100105');

-- Códigos de embalagem (Code 128)
INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, 'BOX-SKU-005', 'CODE128', 'box', 50, false
FROM products p WHERE p.sku = 'SKU-005'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = 'BOX-SKU-005');

INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging_type, quantity_per_package, is_primary)
SELECT p.id, 'BOX-SKU-002', 'CODE128', 'box', 24, false
FROM products p WHERE p.sku = 'SKU-002'
AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE barcode = 'BOX-SKU-002');

-- ========================================
-- INSERIR SALDOS DE ESTOQUE (IDEMPOTENTE E DETERMINÍSTICO)
-- Cada produto em localização específica e conhecida
-- ========================================
INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 45
FROM products p, locations l
WHERE p.sku = 'SKU-001' AND l.code = 'A-01-01-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 120
FROM products p, locations l
WHERE p.sku = 'SKU-002' AND l.code = 'A-02-01-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 8
FROM products p, locations l
WHERE p.sku = 'SKU-003' AND l.code = 'A-02-01-02'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 32
FROM products p, locations l
WHERE p.sku = 'SKU-004' AND l.code = 'B-01-01-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 250
FROM products p, locations l
WHERE p.sku = 'SKU-005' AND l.code = 'B-02-01-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 5
FROM products p, locations l
WHERE p.sku = 'SKU-006' AND l.code = 'A-03-01-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 67
FROM products p, locations l
WHERE p.sku = 'SKU-007' AND l.code = 'B-01-02-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 89
FROM products p, locations l
WHERE p.sku = 'SKU-008' AND l.code = 'B-02-02-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 3
FROM products p, locations l
WHERE p.sku = 'SKU-009' AND l.code = 'B-02-02-02'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 42
FROM products p, locations l
WHERE p.sku = 'SKU-010' AND l.code = 'A-03-01-02'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

-- Alguns produtos em múltiplas localizações (picking)
INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 20
FROM products p, locations l
WHERE p.sku = 'SKU-002' AND l.code = 'PICK-01'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

INSERT INTO stock_balances (product_id, location_id, quantity)
SELECT p.id, l.id, 50
FROM products p, locations l
WHERE p.sku = 'SKU-005' AND l.code = 'PICK-02'
AND NOT EXISTS (
  SELECT 1 FROM stock_balances sb
  WHERE sb.product_id = p.id AND sb.location_id = l.id
);

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
