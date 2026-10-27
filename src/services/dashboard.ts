import { supabase, isDemoMode } from '../lib/supabase';
import { demoLocations, demoMovements, demoProducts, demoReceipts, demoShipments } from '../demoStore';

export type DashboardStats = {
  totalProducts: number;
  totalStock: number;
  lowStockProducts: number;
  occupiedLocations: number;
  totalLocations: number;
  pendingReceipts: number;
  pendingShipments: number;
};

export type CategoryStock = { category: string; total_quantity: number };
export type ZoneOccupancy = { zone: string; total_capacity: number; total_occupied: number; occupancy_percentage: number };
export type MovementSummary = { date: string; inbound: number; outbound: number };

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) {
    const active = demoProducts.filter((p) => p.active);
    return {
      totalProducts: active.length,
      totalStock: active.reduce((sum, p) => sum + p.total_stock, 0),
      lowStockProducts: active.filter((p) => p.total_stock <= p.min_stock).length,
      occupiedLocations: demoLocations.filter((l) => l.status === 'occupied').length,
      totalLocations: demoLocations.length,
      pendingReceipts: demoReceipts.filter((r) => r.status === 'pending' || r.status === 'partial').length,
      pendingShipments: demoShipments.filter((s) => s.status === 'pending' || s.status === 'picking').length,
    };
  }

  const { data: productsWithStock, error: productsError } = await supabase.rpc('get_products_with_stock');
  if (productsError) throw productsError;

  const products = (productsWithStock || []) as Array<{ total_stock: number; min_stock: number }>;
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + Number(product.total_stock || 0), 0);
  const lowStockProducts = products.filter(
    (product) => Number(product.total_stock || 0) <= Number(product.min_stock || 0)
  ).length;

  const { data: locations, error: locationsError } = await supabase.from('locations').select('status');
  if (locationsError) throw locationsError;

  const { count: pendingReceipts, error: receiptsError } = await supabase
    .from('receipts').select('*', { count: 'exact', head: true }).in('status', ['pending', 'partial']);
  if (receiptsError) throw receiptsError;

  const { count: pendingShipments, error: shipmentsError } = await supabase
    .from('shipments').select('*', { count: 'exact', head: true }).in('status', ['pending', 'picking']);
  if (shipmentsError) throw shipmentsError;

  return {
    totalProducts,
    totalStock,
    lowStockProducts,
    occupiedLocations: locations?.filter((l: any) => l.status === 'occupied').length || 0,
    totalLocations: locations?.length || 0,
    pendingReceipts: pendingReceipts || 0,
    pendingShipments: pendingShipments || 0,
  };
}

export async function getStockByCategory(): Promise<CategoryStock[]> {
  if (isDemoMode) {
    const grouped = new Map<string, number>();
    demoProducts.filter((p) => p.active).forEach((p) => {
      const category = p.category || 'Sem Categoria';
      grouped.set(category, (grouped.get(category) || 0) + p.total_stock);
    });
    return [...grouped.entries()].map(([category, total_quantity]) => ({ category, total_quantity }));
  }

  const { data: balances, error: balancesError } = await supabase.from('stock_balances').select('product_id, quantity');
  if (balancesError) throw balancesError;
  const { data: products, error: productsError } = await supabase.from('products').select('id, category').eq('active', true);
  if (productsError) throw productsError;

  const categoryMap: Record<string, number> = {};
  balances?.forEach((balance: any) => {
    const product = products?.find((p: any) => p.id === balance.product_id);
    if (!product) return;
    const category = product.category || 'Sem Categoria';
    categoryMap[category] = (categoryMap[category] || 0) + Number(balance.quantity || 0);
  });
  return Object.entries(categoryMap).map(([category, total_quantity]) => ({ category, total_quantity }));
}

export async function getZoneOccupancy(): Promise<ZoneOccupancy[]> {
  if (isDemoMode) {
    const grouped = new Map<string, { capacity: number; occupied: number }>();
    demoLocations.forEach((l) => {
      const current = grouped.get(l.zone) || { capacity: 0, occupied: 0 };
      current.capacity += l.capacity || 0;
      current.occupied += l.total_quantity;
      grouped.set(l.zone, current);
    });
    return [...grouped.entries()].map(([zone, value]) => ({
      zone,
      total_capacity: value.capacity,
      total_occupied: value.occupied,
      occupancy_percentage: value.capacity > 0 ? (value.occupied / value.capacity) * 100 : 0,
    }));
  }

  const { data: locations, error: locationsError } = await supabase.from('locations').select('id, zone, capacity');
  if (locationsError) throw locationsError;
  const { data: balances, error: balancesError } = await supabase.from('stock_balances').select('location_id, quantity');
  if (balancesError) throw balancesError;

  const locationZoneMap: Record<string, string> = {};
  const zoneMap: Record<string, { capacity: number; occupied: number }> = {};
  locations?.forEach((loc: any) => {
    locationZoneMap[loc.id] = loc.zone;
    zoneMap[loc.zone] ||= { capacity: 0, occupied: 0 };
    zoneMap[loc.zone].capacity += Number(loc.capacity || 0);
  });
  balances?.forEach((balance: any) => {
    const zone = locationZoneMap[balance.location_id];
    if (zone && zoneMap[zone]) zoneMap[zone].occupied += Number(balance.quantity || 0);
  });
  return Object.entries(zoneMap).map(([zone, value]) => ({
    zone,
    total_capacity: value.capacity,
    total_occupied: value.occupied,
    occupancy_percentage: value.capacity > 0 ? (value.occupied / value.capacity) * 100 : 0,
  }));
}

export async function getMovementSummary(): Promise<MovementSummary[]> {
  const dailyMap: Record<string, { inbound: number; outbound: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dailyMap[date.toISOString().split('T')[0]] = { inbound: 0, outbound: 0 };
  }

  if (isDemoMode) {
    demoMovements.filter((m) => m.status === 'completed').forEach((m) => {
      const date = m.created_at.slice(0, 10);
      if (!dailyMap[date]) return;
      if (m.movement_type === 'inbound') dailyMap[date].inbound++;
      if (m.movement_type === 'outbound') dailyMap[date].outbound++;
    });
  } else {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: movements, error } = await supabase
      .from('movements')
      .select('movement_type, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .eq('status', 'completed');
    if (error) throw error;
    movements?.forEach((m: any) => {
      const date = m.created_at.slice(0, 10);
      if (!dailyMap[date]) return;
      if (m.movement_type === 'inbound') dailyMap[date].inbound++;
      if (m.movement_type === 'outbound') dailyMap[date].outbound++;
    });
  }

  return Object.entries(dailyMap)
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
