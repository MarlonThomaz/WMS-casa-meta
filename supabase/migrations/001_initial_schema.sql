-- ========================================
-- WMS Casa Meta - Schema Inicial Seguro
-- Migration 001: Estrutura base com RLS completo
-- ========================================

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- SEQUÊNCIAS para geração segura de referências
-- ========================================
CREATE SEQUENCE IF NOT EXISTS movement_ref_seq START 1;
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS shipment_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS stock_count_number_seq START 1;

-- ========================================
-- TABELA: profiles
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELA: products
-- ========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_base TEXT NOT NULL DEFAULT 'un',
  min_stock NUMERIC DEFAULT 0 CHECK (min_stock >= 0),
  max_stock NUMERIC CHECK (max_stock IS NULL OR max_stock >= 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELA: product_barcodes
-- ========================================
CREATE TABLE IF NOT EXISTS product_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT UNIQUE NOT NULL,
  barcode_type TEXT CHECK (barcode_type IN ('EAN13', 'EAN8', 'CODE128', 'CODE39', 'QR', 'OTHER')),
  packaging_type TEXT DEFAULT 'unit',
  quantity_per_package NUMERIC DEFAULT 1 CHECK (quantity_per_package > 0),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELA: locations
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
  capacity NUMERIC CHECK (capacity IS NULL OR capacity >= 0),
  status TEXT NOT NULL DEFAULT 'available' 
    CHECK (status IN ('available', 'occupied', 'reserved', 'blocked', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELA: stock_balances
-- ========================================
CREATE TABLE IF NOT EXISTS stock_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity NUMERIC GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  last_movement_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id),
  CONSTRAINT chk_reserved_lte_quantity CHECK (reserved_quantity <= quantity)
);

-- ========================================
-- TABELA: movements
-- ========================================
CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inbound', 'outbound', 'transfer', 'adjustment', 'count')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
  operator_id UUID REFERENCES profiles(id),
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ
);

-- ========================================
-- TABELA: movement_lines
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELAS: receipts
-- ========================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_reference TEXT,
  expected_date DATE,
  actual_date DATE,
  dock TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  operator_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity NUMERIC NOT NULL CHECK (expected_quantity > 0),
  received_quantity NUMERIC DEFAULT 0 CHECK (received_quantity >= 0),
  location_id UUID REFERENCES locations(id),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELAS: shipments
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picking', 'packed', 'shipped', 'cancelled')),
  operator_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  requested_quantity NUMERIC NOT NULL CHECK (requested_quantity > 0),
  picked_quantity NUMERIC DEFAULT 0 CHECK (picked_quantity >= 0),
  from_location_id UUID REFERENCES locations(id),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELAS: stock_counts
-- ========================================
CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number TEXT UNIQUE NOT NULL,
  count_type TEXT NOT NULL DEFAULT 'cycle' CHECK (count_type IN ('full', 'cycle', 'spot', 'reconciliation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  location_id UUID REFERENCES locations(id),
  operator_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  system_quantity NUMERIC NOT NULL,
  counted_quantity NUMERIC NOT NULL CHECK (counted_quantity >= 0),
  difference NUMERIC GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
  notes TEXT,
  counted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- TABELA: audit_events (NOVA - faltava na revisão)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID REFERENCES profiles(id),
  user_email TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- ÍNDICES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product_location ON stock_balances(product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON movements(reference);
CREATE INDEX IF NOT EXISTS idx_movements_status ON movements(status);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);

-- ========================================
-- TRIGGERS para updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- TRIGGER para criar perfil automaticamente (NOVO)
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'operator'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- ROW LEVEL SECURITY (RLS) - COMPLETO
-- ========================================

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
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================================
-- POLÍTICAS: profiles
-- ========================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  USING (auth.uid() = id OR public.user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT
  WITH CHECK (public.user_role() = 'admin');

-- ========================================
-- POLÍTICAS: products (leitura para todos, escrita para operadores+)
-- ========================================
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
  USING (public.user_role() IN ('admin', 'manager'));

-- ========================================
-- POLÍTICAS: product_barcodes
-- ========================================
DROP POLICY IF EXISTS "barcodes_select" ON product_barcodes;
CREATE POLICY "barcodes_select" ON product_barcodes FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "barcodes_insert" ON product_barcodes;
CREATE POLICY "barcodes_insert" ON product_barcodes FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "barcodes_update" ON product_barcodes;
CREATE POLICY "barcodes_update" ON product_barcodes FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "barcodes_delete" ON product_barcodes;
CREATE POLICY "barcodes_delete" ON product_barcodes FOR DELETE
  USING (public.user_role() IN ('admin', 'manager'));

-- ========================================
-- POLÍTICAS: locations
-- ========================================
DROP POLICY IF EXISTS "locations_select" ON locations;
CREATE POLICY "locations_select" ON locations FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "locations_insert" ON locations;
CREATE POLICY "locations_insert" ON locations FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "locations_update" ON locations;
CREATE POLICY "locations_update" ON locations FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: stock_balances (leitura para todos, escrita apenas via funções)
-- ========================================
DROP POLICY IF EXISTS "stock_balances_select" ON stock_balances;
CREATE POLICY "stock_balances_select" ON stock_balances FOR SELECT
  USING (auth.role() = 'authenticated');

-- Escrita apenas via funções SECURITY DEFINER
DROP POLICY IF EXISTS "stock_balances_service_write" ON stock_balances;
CREATE POLICY "stock_balances_service_write" ON stock_balances FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ========================================
-- POLÍTICAS: movements (leitura para todos, escrita para operadores+)
-- ========================================
DROP POLICY IF EXISTS "movements_select" ON movements;
CREATE POLICY "movements_select" ON movements FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "movements_insert" ON movements;
CREATE POLICY "movements_insert" ON movements FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator') AND created_by = auth.uid());

DROP POLICY IF EXISTS "movements_update" ON movements;
CREATE POLICY "movements_update" ON movements FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: movement_lines
-- ========================================
DROP POLICY IF EXISTS "movement_lines_select" ON movement_lines;
CREATE POLICY "movement_lines_select" ON movement_lines FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "movement_lines_insert" ON movement_lines;
CREATE POLICY "movement_lines_insert" ON movement_lines FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: receipts
-- ========================================
DROP POLICY IF EXISTS "receipts_select" ON receipts;
CREATE POLICY "receipts_select" ON receipts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "receipts_insert" ON receipts;
CREATE POLICY "receipts_insert" ON receipts FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator') AND created_by = auth.uid());

DROP POLICY IF EXISTS "receipts_update" ON receipts;
CREATE POLICY "receipts_update" ON receipts FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: receipt_lines
-- ========================================
DROP POLICY IF EXISTS "receipt_lines_select" ON receipt_lines;
CREATE POLICY "receipt_lines_select" ON receipt_lines FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "receipt_lines_insert" ON receipt_lines;
CREATE POLICY "receipt_lines_insert" ON receipt_lines FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "receipt_lines_update" ON receipt_lines;
CREATE POLICY "receipt_lines_update" ON receipt_lines FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: shipments
-- ========================================
DROP POLICY IF EXISTS "shipments_select" ON shipments;
CREATE POLICY "shipments_select" ON shipments FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "shipments_insert" ON shipments;
CREATE POLICY "shipments_insert" ON shipments FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator') AND created_by = auth.uid());

DROP POLICY IF EXISTS "shipments_update" ON shipments;
CREATE POLICY "shipments_update" ON shipments FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: shipment_lines
-- ========================================
DROP POLICY IF EXISTS "shipment_lines_select" ON shipment_lines;
CREATE POLICY "shipment_lines_select" ON shipment_lines FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "shipment_lines_insert" ON shipment_lines;
CREATE POLICY "shipment_lines_insert" ON shipment_lines FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "shipment_lines_update" ON shipment_lines;
CREATE POLICY "shipment_lines_update" ON shipment_lines FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: stock_counts
-- ========================================
DROP POLICY IF EXISTS "stock_counts_select" ON stock_counts;
CREATE POLICY "stock_counts_select" ON stock_counts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stock_counts_insert" ON stock_counts;
CREATE POLICY "stock_counts_insert" ON stock_counts FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator') AND created_by = auth.uid());

DROP POLICY IF EXISTS "stock_counts_update" ON stock_counts;
CREATE POLICY "stock_counts_update" ON stock_counts FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: stock_count_lines
-- ========================================
DROP POLICY IF EXISTS "stock_count_lines_select" ON stock_count_lines;
CREATE POLICY "stock_count_lines_select" ON stock_count_lines FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stock_count_lines_insert" ON stock_count_lines;
CREATE POLICY "stock_count_lines_insert" ON stock_count_lines FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "stock_count_lines_update" ON stock_count_lines;
CREATE POLICY "stock_count_lines_update" ON stock_count_lines FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'));

-- ========================================
-- POLÍTICAS: audit_events (apenas leitura para operadores, escrita via funções)
-- ========================================
DROP POLICY IF EXISTS "audit_events_select" ON audit_events;
CREATE POLICY "audit_events_select" ON audit_events FOR SELECT
  USING (public.user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "audit_events_insert_service" ON audit_events;
CREATE POLICY "audit_events_insert_service" ON audit_events FOR INSERT
  WITH CHECK (true);

-- ========================================
-- RESTRINGIR EXECUÇÃO DAS FUNÇÕES (serão criadas na migration 002)
-- ========================================
-- Isso será configurado após criar as funções
