import { Product, Location, Movement, ReceivingOrder, ShippingOrder } from './types';

export const products: Product[] = [
  { id: '1', sku: 'SKU-001', name: 'Notebook Dell Inspiron 15', category: 'Eletrônicos', quantity: 45, unit: 'un', location: 'A-01-03-02', minStock: 10, maxStock: 100, lastUpdate: '2026-01-15' },
  { id: '2', sku: 'SKU-002', name: 'Mouse Logitech MX Master', category: 'Periféricos', quantity: 120, unit: 'un', location: 'A-02-01-01', minStock: 20, maxStock: 200, lastUpdate: '2026-01-14' },
  { id: '3', sku: 'SKU-003', name: 'Teclado Mecânico Redragon', category: 'Periféricos', quantity: 8, unit: 'un', location: 'A-02-01-02', minStock: 15, maxStock: 150, lastUpdate: '2026-01-13' },
  { id: '4', sku: 'SKU-004', name: 'Monitor Samsung 27"', category: 'Eletrônicos', quantity: 32, unit: 'un', location: 'B-01-02-01', minStock: 5, maxStock: 50, lastUpdate: '2026-01-15' },
  { id: '5', sku: 'SKU-005', name: 'Cabo HDMI 2m', category: 'Cabos', quantity: 250, unit: 'un', location: 'C-01-01-03', minStock: 50, maxStock: 500, lastUpdate: '2026-01-12' },
  { id: '6', sku: 'SKU-006', name: 'Webcam Logitech C920', category: 'Periféricos', quantity: 5, unit: 'un', location: 'A-03-02-01', minStock: 10, maxStock: 80, lastUpdate: '2026-01-15' },
  { id: '7', sku: 'SKU-007', name: 'SSD Kingston 480GB', category: 'Componentes', quantity: 67, unit: 'un', location: 'B-02-01-01', minStock: 15, maxStock: 120, lastUpdate: '2026-01-14' },
  { id: '8', sku: 'SKU-008', name: 'Memória RAM 16GB DDR4', category: 'Componentes', quantity: 89, unit: 'un', location: 'B-02-02-01', minStock: 20, maxStock: 150, lastUpdate: '2026-01-13' },
  { id: '9', sku: 'SKU-009', name: 'Fonte Corsair 650W', category: 'Componentes', quantity: 3, unit: 'un', location: 'B-03-01-02', minStock: 8, maxStock: 60, lastUpdate: '2026-01-15' },
  { id: '10', sku: 'SKU-010', name: 'Headset HyperX Cloud', category: 'Periféricos', quantity: 42, unit: 'un', location: 'A-03-03-01', minStock: 10, maxStock: 100, lastUpdate: '2026-01-14' },
];

export const locations: Location[] = [
  { id: '1', code: 'A-01-03-02', zone: 'A', aisle: '01', rack: '03', level: '02', capacity: 100, occupied: 45, status: 'occupied' },
  { id: '2', code: 'A-02-01-01', zone: 'A', aisle: '02', rack: '01', level: '01', capacity: 200, occupied: 120, status: 'occupied' },
  { id: '3', code: 'A-02-01-02', zone: 'A', aisle: '02', rack: '01', level: '02', capacity: 150, occupied: 8, status: 'occupied' },
  { id: '4', code: 'B-01-02-01', zone: 'B', aisle: '01', rack: '02', level: '01', capacity: 50, occupied: 32, status: 'occupied' },
  { id: '5', code: 'C-01-01-03', zone: 'C', aisle: '01', rack: '01', level: '03', capacity: 500, occupied: 250, status: 'occupied' },
  { id: '6', code: 'A-03-02-01', zone: 'A', aisle: '03', rack: '02', level: '01', capacity: 80, occupied: 5, status: 'occupied' },
  { id: '7', code: 'B-02-01-01', zone: 'B', aisle: '02', rack: '01', level: '01', capacity: 120, occupied: 67, status: 'occupied' },
  { id: '8', code: 'B-02-02-01', zone: 'B', aisle: '02', rack: '02', level: '01', capacity: 150, occupied: 89, status: 'occupied' },
  { id: '9', code: 'B-03-01-02', zone: 'B', aisle: '03', rack: '01', level: '02', capacity: 60, occupied: 3, status: 'occupied' },
  { id: '10', code: 'A-03-03-01', zone: 'A', aisle: '03', rack: '03', level: '01', capacity: 100, occupied: 42, status: 'occupied' },
  { id: '11', code: 'C-02-01-01', zone: 'C', aisle: '02', rack: '01', level: '01', capacity: 200, occupied: 0, status: 'available' },
  { id: '12', code: 'C-02-01-02', zone: 'C', aisle: '02', rack: '01', level: '02', capacity: 200, occupied: 0, status: 'available' },
  { id: '13', code: 'D-01-01-01', zone: 'D', aisle: '01', rack: '01', level: '01', capacity: 300, occupied: 0, status: 'reserved' },
  { id: '14', code: 'D-01-02-01', zone: 'D', aisle: '01', rack: '02', level: '01', capacity: 300, occupied: 0, status: 'maintenance' },
];

export const movements: Movement[] = [
  { id: '1', type: 'inbound', productId: '1', productName: 'Notebook Dell Inspiron 15', quantity: 20, fromLocation: 'Doca 1', toLocation: 'A-01-03-02', date: '2026-01-15 08:30', operator: 'Carlos Silva', status: 'completed', reference: 'RC-2026-001' },
  { id: '2', type: 'outbound', productId: '2', productName: 'Mouse Logitech MX Master', quantity: 5, fromLocation: 'A-02-01-01', toLocation: 'Doca 2', date: '2026-01-15 09:15', operator: 'Ana Souza', status: 'completed', reference: 'SP-2026-001' },
  { id: '3', type: 'transfer', productId: '7', productName: 'SSD Kingston 480GB', quantity: 10, fromLocation: 'B-02-01-01', toLocation: 'B-02-02-01', date: '2026-01-15 10:00', operator: 'Pedro Lima', status: 'completed', reference: 'TR-2026-001' },
  { id: '4', type: 'outbound', productId: '4', productName: 'Monitor Samsung 27"', quantity: 3, fromLocation: 'B-01-02-01', toLocation: 'Doca 1', date: '2026-01-15 11:30', operator: 'Ana Souza', status: 'pending', reference: 'SP-2026-002' },
  { id: '5', type: 'adjustment', productId: '3', productName: 'Teclado Mecânico Redragon', quantity: -2, fromLocation: 'A-02-01-02', toLocation: 'A-02-01-02', date: '2026-01-14 14:00', operator: 'Carlos Silva', status: 'completed', reference: 'AJ-2026-001' },
  { id: '6', type: 'inbound', productId: '5', productName: 'Cabo HDMI 2m', quantity: 100, fromLocation: 'Doca 2', toLocation: 'C-01-01-03', date: '2026-01-14 15:30', operator: 'Pedro Lima', status: 'completed', reference: 'RC-2026-002' },
  { id: '7', type: 'outbound', productId: '8', productName: 'Memória RAM 16GB DDR4', quantity: 15, fromLocation: 'B-02-02-01', toLocation: 'Doca 3', date: '2026-01-15 13:00', operator: 'Ana Souza', status: 'pending', reference: 'SP-2026-003' },
  { id: '8', type: 'transfer', productId: '10', productName: 'Headset HyperX Cloud', quantity: 8, fromLocation: 'A-03-03-01', toLocation: 'A-03-02-01', date: '2026-01-15 14:00', operator: 'Carlos Silva', status: 'pending', reference: 'TR-2026-002' },
];

export const receivingOrders: ReceivingOrder[] = [
  { id: '1', orderNumber: 'RC-2026-003', supplier: 'Dell Brasil', date: '2026-01-16', items: [{ productId: '1', productName: 'Notebook Dell Inspiron 15', expected: 50, received: 0 }], status: 'pending', dock: 'Doca 1' },
  { id: '2', orderNumber: 'RC-2026-004', supplier: 'Logitech', date: '2026-01-16', items: [{ productId: '2', productName: 'Mouse Logitech MX Master', expected: 100, received: 50 }, { productId: '6', productName: 'Webcam Logitech C920', expected: 30, received: 30 }], status: 'partial', dock: 'Doca 2' },
  { id: '3', orderNumber: 'RC-2026-005', supplier: 'Kingston', date: '2026-01-15', items: [{ productId: '7', productName: 'SSD Kingston 480GB', expected: 60, received: 60 }, { productId: '8', productName: 'Memória RAM 16GB DDR4', expected: 40, received: 40 }], status: 'completed', dock: 'Doca 1' },
  { id: '4', orderNumber: 'RC-2026-006', supplier: 'Corsair', date: '2026-01-17', items: [{ productId: '9', productName: 'Fonte Corsair 650W', expected: 25, received: 0 }], status: 'pending', dock: 'Doca 3' },
];

export const shippingOrders: ShippingOrder[] = [
  { id: '1', orderNumber: 'SP-2026-004', customer: 'TechStore Ltda', date: '2026-01-16', items: [{ productId: '1', productName: 'Notebook Dell Inspiron 15', quantity: 10 }, { productId: '4', productName: 'Monitor Samsung 27"', quantity: 5 }], status: 'pending', carrier: 'Transportadora ABC', priority: 'high' },
  { id: '2', orderNumber: 'SP-2026-005', customer: 'InfoShop', date: '2026-01-16', items: [{ productId: '2', productName: 'Mouse Logitech MX Master', quantity: 20 }, { productId: '3', productName: 'Teclado Mecânico Redragon', quantity: 15 }], status: 'picking', carrier: 'Jadlog', priority: 'medium' },
  { id: '3', orderNumber: 'SP-2026-006', customer: 'MegaByte', date: '2026-01-15', items: [{ productId: '7', productName: 'SSD Kingston 480GB', quantity: 30 }, { productId: '8', productName: 'Memória RAM 16GB DDR4', quantity: 25 }], status: 'packed', carrier: 'Correios', priority: 'low' },
  { id: '4', orderNumber: 'SP-2026-007', customer: 'DataCenter Pro', date: '2026-01-15', items: [{ productId: '5', productName: 'Cabo HDMI 2m', quantity: 50 }, { productId: '10', productName: 'Headset HyperX Cloud', quantity: 10 }], status: 'shipped', carrier: 'SEDEX', priority: 'high' },
  { id: '5', orderNumber: 'SP-2026-008', customer: 'GameZone', date: '2026-01-17', items: [{ productId: '3', productName: 'Teclado Mecânico Redragon', quantity: 8 }, { productId: '6', productName: 'Webcam Logitech C920', quantity: 12 }], status: 'pending', carrier: 'Transportadora XYZ', priority: 'medium' },
];
