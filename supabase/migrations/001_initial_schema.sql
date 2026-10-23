-- ========================================
-- WMS Casa Meta - Estrutura Inicial do Banco
-- Migration 001: Estrutura base do sistema
-- ========================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABELA: profiles
-- Usuários do sistema e suas funções
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: products
-- Cadastro de produtos (SKUs)
-- ========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_base TEXT NOT NULL DEFAULT 'un', -- Unidade base (un, kg, m, etc)
  min_stock NUMERIC DEFAULT 0,
  max_stock NUMERIC,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: product_barcodes
-- Códigos de barras associados a produtos
-- Um produto pode ter múltiplos códigos (embalagens diferentes)
-- ========================================
CREATE TABLE IF NOT EXISTS product_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT UNIQUE NOT NULL,
  barcode_type TEXT CHECK (barcode_type IN ('EAN13', 'EAN8', 'CODE128', 'CODE39', 'QR', 'OTHER')),
  packaging_type TEXT DEFAULT 'unit', -- unit, box, pallet, etc
  quantity_per_package NUMERIC DEFAULT 1, -- Quantas unidades base contém esta embalagem
  is_primary BOOLEAN DEFAULT false, -- Código principal do produto
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: locations
-- Endereços físicos do armazém
-- ========================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  zone TEXT NOT NULL,
  aisle TEXT,
  rack TEXT,
  level TEXT,
  location_type TEXT NOT NULL DEFAULT 'storage' 
    CHECK (location_type IN ('storage', 'picking', 'staging', 'receiving', 'shipping', 'quarantine')),
  capacity NUMERIC,
  status TEXT NOT NULL DEFAULT 'available' 
    CHECK (status IN ('available', 'occupied', 'reserved', 'blocked', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: stock_balances
-- Saldos de estoque por produto e endereço
-- Esta é a tabela de VERDADE para quantidades
-- ========================================
CREATE TABLE IF NOT EXISTS stock_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity NUMERIC GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  last_movement_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Um produto só pode ter um saldo por endereço
  UNIQUE(product_id, location_id)
);

-- ========================================
-- TABELA: movements
-- Cabeçalho das movimentações (operações)
-- ========================================
CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL, -- Código único da movimentação (ex: MOV-2024-001)
  movement_type TEXT NOT NULL 
    CHECK (movement_type IN ('inbound', 'outbound', 'transfer', 'adjustment', 'count')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
  operator_id UUID REFERENCES profiles(id),
  source_reference TEXT, -- Referência externa (NF, pedido de venda, etc)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id)
);

-- ========================================
-- TABELA: movement_lines
-- Itens de cada movimentação
-- ========================================
CREATE TABLE IF NOT EXISTS movement_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movement_id UUID NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: receipts
-- Ordens de recebimento
-- ========================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_reference TEXT,
  expected_date DATE,
  actual_date DATE,
  dock TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  operator_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id)
);

-- ========================================
-- TABELA: receipt_lines
-- Itens de cada recebimento
-- ========================================
CREATE TABLE IF NOT EXISTS receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity NUMERIC NOT NULL,
  received_quantity NUMERIC DEFAULT 0,
  location_id UUID REFERENCES locations(id), -- Onde foi armazenado
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: shipments
-- Ordens de expedição
-- ========================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_reference TEXT,
  carrier TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  expected_date DATE,
  actual_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'picking', 'packed', 'shipped', 'cancelled')),
  operator_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id)
);

-- ========================================
-- TABELA: shipment_lines
-- Itens de cada expedição
-- ========================================
CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  requested_quantity NUMERIC NOT NULL,
  picked_quantity NUMERIC DEFAULT 0,
  from_location_id UUID REFERENCES locations(id),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: stock_counts
-- Contagens físicas de inventário
-- ========================================
CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number TEXT UNIQUE NOT NULL,
  count_type TEXT NOT NULL DEFAULT 'cycle'
    CHECK (count_type IN ('full', 'cycle', 'spot', 'reconciliation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  location_id UUID REFERENCES locations(id), -- Se for contagem por endereço
  operator_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id)
);

-- ========================================
-- TABELA: stock_count_lines
-- Itens contados em cada inventário
-- ========================================
CREATE TABLE IF NOT EXISTS stock_count_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  system_quantity NUMERIC NOT NULL,
  counted_quantity NUMERIC NOT NULL,
  difference NUMERIC GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
  notes TEXT,
  counted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================

-- Produtos
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Códigos de barras
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON product_barcodes(product_id);

-- Localizações
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
CREATE INDEX IF NOT EXISTS idx_locations_zone ON locations(zone);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);

-- Saldos de estoque
CREATE INDEX IF NOT EXISTS idx_stock_balances_product_id ON stock_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_location_id ON stock_balances(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product_location ON stock_balances(product_id, location_id);

-- Movimentações
CREATE INDEX IF NOT EXISTS idx_movements_reference ON movements(reference);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_status ON movements(status);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_operator_id ON movements(operator_id);

-- Linhas de movimentação
CREATE INDEX IF NOT EXISTS idx_movement_lines_movement_id ON movement_lines(movement_id);
CREATE INDEX IF NOT EXISTS idx_movement_lines_product_id ON movement_lines(product_id);

-- Recebimentos
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_expected_date ON receipts(expected_date);

-- Linhas de recebimento
CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt_id ON receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_product_id ON receipt_lines(product_id);

-- Expedições
CREATE INDEX IF NOT EXISTS idx_shipments_number ON shipments(shipment_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_priority ON shipments(priority);
CREATE INDEX IF NOT EXISTS idx_shipments_expected_date ON shipments(expected_date);

-- Linhas de expedição
CREATE INDEX IF NOT EXISTS idx_shipment_lines_shipment_id ON shipment_lines(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_product_id ON shipment_lines(product_id);

-- Contagens
CREATE INDEX IF NOT EXISTS idx_stock_counts_number ON stock_counts(count_number);
CREATE INDEX IF NOT EXISTS idx_stock_counts_status ON stock_counts(status);

-- Linhas de contagem
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_count_id ON stock_count_lines(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_product_id ON stock_count_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_location_id ON stock_count_lines(location_id);

-- ========================================
-- TRIGGERS PARA ATUALIZAR updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_balances_updated_at BEFORE UPDATE ON stock_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipt_lines_updated_at BEFORE UPDATE ON receipt_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipment_lines_updated_at BEFORE UPDATE ON shipment_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ROW LEVEL SECURITY (RLS) - Políticas Básicas
-- ========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;

-- Políticas temporárias para desenvolvimento
-- Em produção, ajustar conforme regras de negócio

-- Profiles: usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Products: todos autenticados podem ver
CREATE POLICY "Authenticated users can view products" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

-- Product barcodes: todos autenticados podem ver
CREATE POLICY "Authenticated users can view barcodes" ON product_barcodes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Locations: todos autenticados podem ver
CREATE POLICY "Authenticated users can view locations" ON locations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Stock balances: todos autenticados podem ver
CREATE POLICY "Authenticated users can view stock" ON stock_balances
  FOR SELECT USING (auth.role() = 'authenticated');

-- Movements: todos autenticados podem ver
CREATE POLICY "Authenticated users can view movements" ON movements
  FOR SELECT USING (auth.role() = 'authenticated');

-- Movement lines: todos autenticados podem ver
CREATE POLICY "Authenticated users can view movement lines" ON movement_lines
  FOR SELECT USING (auth.role() = 'authenticated');

-- Receipts: todos autenticados podem ver
CREATE POLICY "Authenticated users can view receipts" ON receipts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Receipt lines: todos autenticados podem ver
CREATE POLICY "Authenticated users can view receipt lines" ON receipt_lines
  FOR SELECT USING (auth.role() = 'authenticated');

-- Shipments: todos autenticados podem ver
CREATE POLICY "Authenticated users can view shipments" ON shipments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Shipment lines: todos autenticados podem ver
CREATE POLICY "Authenticated users can view shipment lines" ON shipment_lines
  FOR SELECT USING (auth.role() = 'authenticated');

-- Stock counts: todos autenticados podem ver
CREATE POLICY "Authenticated users can view counts" ON stock_counts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Stock count lines: todos autenticados podem ver
CREATE POLICY "Authenticated users can view count lines" ON stock_count_lines
  FOR SELECT USING (auth.role() = 'authenticated');

-- ========================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE profiles IS 'Usuários do sistema WMS e suas funções';
COMMENT ON TABLE products IS 'Cadastro de produtos (SKUs)';
COMMENT ON TABLE product_barcodes IS 'Códigos de barras associados a produtos';
COMMENT ON TABLE locations IS 'Endereços físicos do armazém';
COMMENT ON TABLE stock_balances IS 'Saldos de estoque por produto e endereço - FONTE DE VERDADE';
COMMENT ON TABLE movements IS 'Cabeçalho das movimentações de estoque';
COMMENT ON TABLE movement_lines IS 'Itens de cada movimentação';
COMMENT ON TABLE receipts IS 'Ordens de recebimento de mercadorias';
COMMENT ON TABLE receipt_lines IS 'Itens de cada recebimento';
COMMENT ON TABLE shipments IS 'Ordens de expedição de mercadorias';
COMMENT ON TABLE shipment_lines IS 'Itens de cada expedição';
COMMENT ON TABLE stock_counts IS 'Contagens físicas de inventário';
COMMENT ON TABLE stock_count_lines IS 'Itens contados em cada inventário';
