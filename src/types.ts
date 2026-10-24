// ========================================
// TIPOS DO BANCO DE DADOS (persistidos)
// ========================================

export type Role = 'admin' | 'manager' | 'operator' | 'viewer';

export type DBProduct = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit_base: string;
  min_stock: number;
  max_stock?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DBProductBarcode = {
  id: string;
  product_id: string;
  barcode: string;
  barcode_type?: string;
  packaging_type: string;
  quantity_per_package: number;
  is_primary: boolean;
  created_at: string;
};

export type DBLocation = {
  id: string;
  code: string;
  zone: string;
  aisle?: string;
  rack?: string;
  level?: string;
  location_type: 'storage' | 'picking' | 'staging' | 'receiving' | 'shipping' | 'quarantine';
  capacity?: number;
  status: 'available' | 'occupied' | 'reserved' | 'blocked' | 'maintenance';
  created_at: string;
  updated_at: string;
};

export type DBStockBalance = {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_movement_at: string;
  created_at: string;
  updated_at: string;
};

export type DBMovement = {
  id: string;
  reference: string;
  movement_type: 'inbound' | 'outbound' | 'transfer' | 'adjustment' | 'count';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  operator_id?: string;
  source_reference?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
  processed_at?: string;
};

export type DBMovementLine = {
  id: string;
  movement_id: string;
  product_id: string;
  from_location_id?: string;
  to_location_id?: string;
  quantity: number;
  unit: string;
  notes?: string;
  created_at: string;
};

export type DBReceipt = {
  id: string;
  receipt_number: string;
  supplier_name: string;
  supplier_reference?: string;
  expected_date?: string;
  actual_date?: string;
  dock?: string;
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  operator_id?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
};

export type DBReceiptLine = {
  id: string;
  receipt_id: string;
  product_id: string;
  expected_quantity: number;
  received_quantity: number;
  processed_quantity: number;
  location_id?: string;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type DBShipment = {
  id: string;
  shipment_number: string;
  customer_name: string;
  customer_reference?: string;
  carrier?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expected_date?: string;
  actual_date?: string;
  status: 'pending' | 'picking' | 'packed' | 'shipped' | 'cancelled';
  operator_id?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
};

export type DBShipmentLine = {
  id: string;
  shipment_id: string;
  product_id: string;
  requested_quantity: number;
  picked_quantity: number;
  from_location_id?: string;
  unit: string;
  notes?: string;
  reservations_released: boolean;
  created_at: string;
  updated_at: string;
};

export type DBProfile = {
  id: string;
  email: string;
  full_name?: string;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DBAuditEvent = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  user_email?: string;
  details?: unknown;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

// ========================================
// TIPOS DA INTERFACE (derivados do banco)
// ========================================

export type Page =
  | 'dashboard'
  | 'inventory'
  | 'locations'
  | 'receiving'
  | 'shipping'
  | 'movements'
  | 'barcode-kit'
  | 'stock-count'
  | 'pilot-dashboard'
  | 'help';

export type ProductWithStock = DBProduct & {
  total_stock: number;
};

export type LocationWithOccupancy = DBLocation & {
  total_items: number;
  total_quantity: number;
  occupancy_percentage: number;
};

export type MovementWithDetails = DBMovement & {
  lines: DBMovementLine[];
};

export type ReceiptWithLines = DBReceipt & {
  lines: DBReceiptLine[];
};

export type ShipmentWithLines = DBShipment & {
  lines: DBShipmentLine[];
};
