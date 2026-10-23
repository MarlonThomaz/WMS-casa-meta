// Dados de demonstração para modo offline/demo
export const products = [
  { id: '1', sku: 'SKU-001', name: 'Notebook Dell Inspiron 15', category: 'Eletrônicos', quantity: 45, unit: 'un', location: 'A-01-01-01', minStock: 10, maxStock: 100, lastUpdate: '2026-01-15' },
  { id: '2', sku: 'SKU-002', name: 'Mouse Logitech MX Master', category: 'Periféricos', quantity: 120, unit: 'un', location: 'A-02-01-01', minStock: 20, maxStock: 200, lastUpdate: '2026-01-14' },
  { id: '3', sku: 'SKU-003', name: 'Teclado Mecânico Redragon', category: 'Periféricos', quantity: 8, unit: 'un', location: 'A-02-01-02', minStock: 15, maxStock: 150, lastUpdate: '2026-01-13' },
  { id: '4', sku: 'SKU-004', name: 'Monitor Samsung 27"', category: 'Eletrônicos', quantity: 32, unit: 'un', location: 'B-01-01-01', minStock: 5, maxStock: 50, lastUpdate: '2026-01-15' },
  { id: '5', sku: 'SKU-005', name: 'Cabo HDMI 2m', category: 'Cabos', quantity: 250, unit: 'un', location: 'B-02-01-01', minStock: 50, maxStock: 500, lastUpdate: '2026-01-12' },
];

export const locations = [
  { id: '1', code: 'A-01-01-01', zone: 'A', aisle: '01', rack: '01', level: '01', capacity: 100, occupied: 45, status: 'occupied' as const },
  { id: '2', code: 'A-02-01-01', zone: 'A', aisle: '02', rack: '01', level: '01', capacity: 200, occupied: 120, status: 'occupied' as const },
  { id: '3', code: 'A-02-01-02', zone: 'A', aisle: '02', rack: '01', level: '02', capacity: 150, occupied: 8, status: 'occupied' as const },
  { id: '4', code: 'B-01-01-01', zone: 'B', aisle: '01', rack: '01', level: '01', capacity: 120, occupied: 32, status: 'occupied' as const },
  { id: '5', code: 'B-02-01-01', zone: 'B', aisle: '02', rack: '01', level: '01', capacity: 500, occupied: 250, status: 'occupied' as const },
];
