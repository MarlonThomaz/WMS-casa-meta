import type {
  DBLocation,
  DBMovement,
  DBMovementLine,
  DBProduct,
  DBProductBarcode,
  DBReceipt,
  DBReceiptLine,
  DBShipment,
  DBShipmentLine,
  LocationWithOccupancy,
  ProductWithStock,
} from './types';

const now = '2026-10-23T20:00:00-03:00';
const yesterday = '2026-10-22T16:30:00-03:00';
const twoDaysAgo = '2026-10-21T10:15:00-03:00';

export const demoProducts: ProductWithStock[] = [
  {
    id: 'demo-p1', sku: 'SKU-001', name: 'Notebook Dell Inspiron 15',
    description: 'Notebook de demonstração', category: 'Eletrônicos', unit_base: 'un',
    min_stock: 10, max_stock: 100, active: true, total_stock: 45,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-p2', sku: 'SKU-002', name: 'Mouse Logitech MX Master',
    description: 'Mouse sem fio', category: 'Periféricos', unit_base: 'un',
    min_stock: 20, max_stock: 200, active: true, total_stock: 120,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-p3', sku: 'SKU-003', name: 'Teclado Mecânico Redragon',
    description: 'Teclado mecânico', category: 'Periféricos', unit_base: 'un',
    min_stock: 15, max_stock: 150, active: true, total_stock: 8,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-p4', sku: 'SKU-004', name: 'Monitor Samsung 27"',
    description: 'Monitor QHD', category: 'Eletrônicos', unit_base: 'un',
    min_stock: 5, max_stock: 50, active: true, total_stock: 32,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-p5', sku: 'SKU-005', name: 'Cabo HDMI 2m',
    description: 'Cabo HDMI', category: 'Cabos', unit_base: 'un',
    min_stock: 50, max_stock: 500, active: true, total_stock: 250,
    created_at: twoDaysAgo, updated_at: now,
  },
];

export const demoLocations: LocationWithOccupancy[] = [
  {
    id: 'demo-l1', code: 'A-01-01-01', zone: 'A', aisle: '01', rack: '01', level: '01',
    location_type: 'storage', capacity: 100, status: 'occupied',
    total_items: 1, total_quantity: 45, occupancy_percentage: 45,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-l2', code: 'A-02-01-01', zone: 'A', aisle: '02', rack: '01', level: '01',
    location_type: 'picking', capacity: 200, status: 'occupied',
    total_items: 1, total_quantity: 120, occupancy_percentage: 60,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-l3', code: 'A-02-01-02', zone: 'A', aisle: '02', rack: '01', level: '02',
    location_type: 'picking', capacity: 150, status: 'occupied',
    total_items: 1, total_quantity: 8, occupancy_percentage: 5.3,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-l4', code: 'B-01-01-01', zone: 'B', aisle: '01', rack: '01', level: '01',
    location_type: 'storage', capacity: 120, status: 'occupied',
    total_items: 1, total_quantity: 32, occupancy_percentage: 26.7,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-l5', code: 'B-02-01-01', zone: 'B', aisle: '02', rack: '01', level: '01',
    location_type: 'storage', capacity: 500, status: 'occupied',
    total_items: 1, total_quantity: 250, occupancy_percentage: 50,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-l6', code: 'RECV-01', zone: 'R', aisle: '01', rack: 'DOCA', level: '00',
    location_type: 'receiving', capacity: 300, status: 'available',
    total_items: 0, total_quantity: 0, occupancy_percentage: 0,
    created_at: twoDaysAgo, updated_at: now,
  },
  {
    id: 'demo-l7', code: 'SHIP-01', zone: 'S', aisle: '01', rack: 'DOCA', level: '00',
    location_type: 'shipping', capacity: 200, status: 'reserved',
    total_items: 0, total_quantity: 0, occupancy_percentage: 0,
    created_at: twoDaysAgo, updated_at: now,
  },
];

export const demoBarcodes: DBProductBarcode[] = [
  { id: 'demo-b1', product_id: 'demo-p1', barcode: '7890000000011', barcode_type: 'EAN13', packaging_type: 'unit', quantity_per_package: 1, is_primary: true, created_at: twoDaysAgo },
  { id: 'demo-b2', product_id: 'demo-p2', barcode: '7890000000028', barcode_type: 'EAN13', packaging_type: 'unit', quantity_per_package: 1, is_primary: true, created_at: twoDaysAgo },
  { id: 'demo-b3', product_id: 'demo-p3', barcode: '7890000000035', barcode_type: 'EAN13', packaging_type: 'unit', quantity_per_package: 1, is_primary: true, created_at: twoDaysAgo },
];

export const demoReceipts: DBReceipt[] = [
  {
    id: 'demo-r1', receipt_number: 'REC-2026-0018', supplier_name: 'Distribuidora Sul',
    supplier_reference: 'NF 88421', expected_date: '2026-10-23', dock: 'Doca 1',
    status: 'partial', notes: 'Conferência parcial em andamento', created_at: yesterday,
    created_by: 'demo-user-id', operator_id: 'demo-user-id',
  },
  {
    id: 'demo-r2', receipt_number: 'REC-2026-0019', supplier_name: 'Tech Supply SC',
    supplier_reference: 'NF 88457', expected_date: '2026-10-24', dock: 'Doca 2',
    status: 'pending', notes: 'Aguardando descarga', created_at: now,
    created_by: 'demo-user-id',
  },
];

export const demoReceiptLines: DBReceiptLine[] = [
  {
    id: 'demo-rl1', receipt_id: 'demo-r1', product_id: 'demo-p3', expected_quantity: 20,
    received_quantity: 12, processed_quantity: 12, location_id: 'demo-l3', unit: 'un',
    created_at: yesterday, updated_at: now,
  },
  {
    id: 'demo-rl2', receipt_id: 'demo-r1', product_id: 'demo-p5', expected_quantity: 100,
    received_quantity: 100, processed_quantity: 100, location_id: 'demo-l5', unit: 'un',
    created_at: yesterday, updated_at: now,
  },
  {
    id: 'demo-rl3', receipt_id: 'demo-r2', product_id: 'demo-p1', expected_quantity: 10,
    received_quantity: 0, processed_quantity: 0, location_id: 'demo-l1', unit: 'un',
    created_at: now, updated_at: now,
  },
];

export const demoShipments: DBShipment[] = [
  {
    id: 'demo-s1', shipment_number: 'EXP-2026-0042', customer_name: 'Loja Centro Floripa',
    customer_reference: 'PED-55210', carrier: 'Jadlog', priority: 'high', expected_date: '2026-10-23',
    status: 'picking', notes: 'Separação em andamento', created_at: yesterday,
    created_by: 'demo-user-id', operator_id: 'demo-user-id',
  },
  {
    id: 'demo-s2', shipment_number: 'EXP-2026-0043', customer_name: 'Cliente Marketplace',
    customer_reference: 'PED-55244', carrier: 'Correios', priority: 'medium', expected_date: '2026-10-24',
    status: 'pending', created_at: now, created_by: 'demo-user-id',
  },
];

export const demoShipmentLines: DBShipmentLine[] = [
  {
    id: 'demo-sl1', shipment_id: 'demo-s1', product_id: 'demo-p2', requested_quantity: 12,
    picked_quantity: 8, from_location_id: 'demo-l2', unit: 'un', reservations_released: false,
    created_at: yesterday, updated_at: now,
  },
  {
    id: 'demo-sl2', shipment_id: 'demo-s1', product_id: 'demo-p5', requested_quantity: 30,
    picked_quantity: 30, from_location_id: 'demo-l5', unit: 'un', reservations_released: false,
    created_at: yesterday, updated_at: now,
  },
  {
    id: 'demo-sl3', shipment_id: 'demo-s2', product_id: 'demo-p4', requested_quantity: 4,
    picked_quantity: 0, from_location_id: 'demo-l4', unit: 'un', reservations_released: false,
    created_at: now, updated_at: now,
  },
];

export const demoMovements: DBMovement[] = [
  { id: 'demo-m1', reference: 'MOV-2026-0130', movement_type: 'inbound', status: 'completed', source_reference: 'REC-2026-0018', created_at: twoDaysAgo, completed_at: twoDaysAgo, created_by: 'demo-user-id' },
  { id: 'demo-m2', reference: 'MOV-2026-0131', movement_type: 'transfer', status: 'completed', source_reference: 'Reposição picking', created_at: yesterday, completed_at: yesterday, created_by: 'demo-user-id' },
  { id: 'demo-m3', reference: 'MOV-2026-0132', movement_type: 'outbound', status: 'completed', source_reference: 'EXP-2026-0041', created_at: yesterday, completed_at: yesterday, created_by: 'demo-user-id' },
  { id: 'demo-m4', reference: 'MOV-2026-0133', movement_type: 'adjustment', status: 'pending', source_reference: 'Contagem cíclica', created_at: now, created_by: 'demo-user-id' },
];

export const demoMovementLines: DBMovementLine[] = [
  { id: 'demo-ml1', movement_id: 'demo-m1', product_id: 'demo-p5', to_location_id: 'demo-l5', quantity: 100, unit: 'un', created_at: twoDaysAgo },
  { id: 'demo-ml2', movement_id: 'demo-m2', product_id: 'demo-p2', from_location_id: 'demo-l1', to_location_id: 'demo-l2', quantity: 20, unit: 'un', created_at: yesterday },
  { id: 'demo-ml3', movement_id: 'demo-m3', product_id: 'demo-p4', from_location_id: 'demo-l4', quantity: 3, unit: 'un', created_at: yesterday },
];

export const demoStockCounts = [
  {
    id: 'demo-c1', count_number: 'CNT-2026-0021', count_type: 'cycle' as const,
    status: 'in_progress' as const, location_id: 'demo-l3', operator_id: 'demo-user-id',
    notes: 'Contagem cíclica do picking A-02', created_at: now, created_by: 'demo-user-id',
  },
  {
    id: 'demo-c2', count_number: 'CNT-2026-0020', count_type: 'spot' as const,
    status: 'completed' as const, location_id: 'demo-l5', operator_id: 'demo-user-id',
    notes: 'Validação de divergência', created_at: yesterday, completed_at: yesterday, created_by: 'demo-user-id',
  },
];

export const demoStockCountLines = [
  { id: 'demo-cl1', stock_count_id: 'demo-c1', product_id: 'demo-p3', location_id: 'demo-l3', system_quantity: 8, counted_quantity: 7, difference: -1, created_at: now },
  { id: 'demo-cl2', stock_count_id: 'demo-c2', product_id: 'demo-p5', location_id: 'demo-l5', system_quantity: 250, counted_quantity: 250, difference: 0, counted_at: yesterday, created_at: yesterday },
];

export function demoId(prefix: string) {
  return `demo-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toDbLocation(location: LocationWithOccupancy): DBLocation {
  const { total_items: _items, total_quantity: _qty, occupancy_percentage: _pct, ...dbLocation } = location;
  return dbLocation;
}

export function toDbProduct(product: ProductWithStock): DBProduct {
  const { total_stock: _stock, ...dbProduct } = product;
  return dbProduct;
}
