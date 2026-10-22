export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  minStock: number;
  maxStock: number;
  lastUpdate: string;
}

export interface Location {
  id: string;
  code: string;
  zone: string;
  aisle: string;
  rack: string;
  level: string;
  capacity: number;
  occupied: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
}

export interface Movement {
  id: string;
  type: 'inbound' | 'outbound' | 'transfer' | 'adjustment';
  productId: string;
  productName: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  date: string;
  operator: string;
  status: 'pending' | 'completed' | 'cancelled';
  reference: string;
}

export interface ReceivingOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  date: string;
  items: { productId: string; productName: string; expected: number; received: number }[];
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  dock: string;
}

export interface ShippingOrder {
  id: string;
  orderNumber: string;
  customer: string;
  date: string;
  items: { productId: string; productName: string; quantity: number }[];
  status: 'pending' | 'picking' | 'packed' | 'shipped' | 'cancelled';
  carrier: string;
  priority: 'low' | 'medium' | 'high';
}

export type Page = 'dashboard' | 'inventory' | 'locations' | 'receiving' | 'shipping' | 'movements' | 'barcode-kit';
