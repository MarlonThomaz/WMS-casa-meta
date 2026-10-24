-- ========================================
-- WMS Casa Meta - Migration 001
-- Baseline limpa e reproduzível do banco
-- ========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- Sequências
-- ========================================
CREATE SEQUENCE IF NOT EXISTS movement_ref_seq START 1;
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS shipment_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS stock_count_number_seq START 1;

-- ========================================
-- Tabelas principais
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_base TEXT NOT NULL DEFAULT 'un',
  min_stock NUMERIC NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  max_stock NUMERIC CHECK (max_stock IS NULL OR max_stock >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode TEXT UNIQUE NOT NULL,
  barcode_type TEXT CHECK (barcode_type IN ('EAN13', 'EAN8', 'CODE128', 'CODE39', 'QR', 'OTHER')),
  packaging_type TEXT NOT NULL DEFAULT 'unit',
  quantity_per_package NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_per_package > 0),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.locations (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity NUMERIC GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  last_movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, location_id),
  CONSTRAINT chk_reserved_lte_quantity CHECK (reserved_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS public.movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('inbound', 'outbound', 'transfer', 'adjustment', 'count')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'failed')),
  operator_id UUID REFERENCES public.profiles(id),
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.movement_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movement_id UUID NOT NULL REFERENCES public.movements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  from_location_id UUID REFERENCES public.locations(id),
  to_location_id UUID REFERENCES public.locations(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_reference TEXT,
  expected_date DATE,
  actual_date DATE,
  dock TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  operator_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  expected_quantity NUMERIC NOT NULL CHECK (expected_quantity > 0),
  received_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  location_id UUID REFERENCES public.locations(id),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_reference TEXT,
  carrier TEXT,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  expected_date DATE,
  actual_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'picking', 'packed', 'shipped', 'cancelled')),
  operator_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.shipment_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  requested_quantity NUMERIC NOT NULL CHECK (requested_quantity > 0),
  picked_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
  from_location_id UUID REFERENCES public.locations(id),
  unit TEXT NOT NULL DEFAULT 'un',
  notes TEXT,
  reservations_released BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number TEXT UNIQUE NOT NULL,
  count_type TEXT NOT NULL DEFAULT 'cycle'
    CHECK (count_type IN ('full', 'cycle', 'spot', 'reconciliation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  location_id UUID REFERENCES public.locations(id),
  operator_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.stock_count_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  system_quantity NUMERIC NOT NULL CHECK (system_quantity >= 0),
  counted_quantity NUMERIC NOT NULL CHECK (counted_quantity >= 0),
  difference NUMERIC GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
  notes TEXT,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID REFERENCES public.profiles(id),
  user_email TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- Índices
-- ========================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON public.product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_locations_code ON public.locations(code);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product_location
  ON public.stock_balances(product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON public.movements(reference);
CREATE INDEX IF NOT EXISTS idx_movements_status ON public.movements(status);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);

-- ========================================
-- updated_at
-- ========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_balances_updated_at ON public.stock_balances;
CREATE TRIGGER update_stock_balances_updated_at
  BEFORE UPDATE ON public.stock_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_receipt_lines_updated_at ON public.receipt_lines;
CREATE TRIGGER update_receipt_lines_updated_at
  BEFORE UPDATE ON public.receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipment_lines_updated_at ON public.shipment_lines;
CREATE TRIGGER update_shipment_lines_updated_at
  BEFORE UPDATE ON public.shipment_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Perfil automático para auth.users
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'operator'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- RLS baseline
-- ========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
    FROM public.profiles
   WHERE id = auth.uid()
     AND active = true;
$$;

-- Profiles: a proteção contra troca de role é reforçada por migration posterior.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Products
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE
  USING (public.user_role() IN ('admin', 'manager', 'operator'))
  WITH CHECK (public.user_role() IN ('admin', 'manager', 'operator'));

-- Stock balances: somente leitura direta.
DROP POLICY IF EXISTS "stock_balances_select" ON public.stock_balances;
CREATE POLICY "stock_balances_select" ON public.stock_balances FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "stock_balances_write" ON public.stock_balances;
CREATE POLICY "stock_balances_write" ON public.stock_balances FOR ALL
  USING (false)
  WITH CHECK (false);

-- Cabeçalhos operacionais
DROP POLICY IF EXISTS "movements_select" ON public.movements;
CREATE POLICY "movements_select" ON public.movements FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "movements_insert" ON public.movements;
CREATE POLICY "movements_insert" ON public.movements FOR INSERT
  WITH CHECK (
    public.user_role() IN ('admin', 'manager', 'operator')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "receipts_select" ON public.receipts;
CREATE POLICY "receipts_select" ON public.receipts FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "receipts_insert" ON public.receipts;
CREATE POLICY "receipts_insert" ON public.receipts FOR INSERT
  WITH CHECK (
    public.user_role() IN ('admin', 'manager', 'operator')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "shipments_select" ON public.shipments;
CREATE POLICY "shipments_select" ON public.shipments FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "shipments_insert" ON public.shipments;
CREATE POLICY "shipments_insert" ON public.shipments FOR INSERT
  WITH CHECK (
    public.user_role() IN ('admin', 'manager', 'operator')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "stock_counts_select" ON public.stock_counts;
CREATE POLICY "stock_counts_select" ON public.stock_counts FOR SELECT
  USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS "stock_counts_insert" ON public.stock_counts;
CREATE POLICY "stock_counts_insert" ON public.stock_counts FOR INSERT
  WITH CHECK (
    public.user_role() IN ('admin', 'manager', 'operator')
    AND created_by = auth.uid()
  );

-- Auditoria: leitura administrativa e escrita somente via funções privilegiadas.
DROP POLICY IF EXISTS "audit_events_select" ON public.audit_events;
CREATE POLICY "audit_events_select" ON public.audit_events FOR SELECT
  USING (public.user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "audit_events_insert" ON public.audit_events;
CREATE POLICY "audit_events_insert" ON public.audit_events FOR INSERT
  WITH CHECK (false);
