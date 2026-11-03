import { supabase, isDemoMode } from '../lib/supabase';
import { demoLocations, demoProducts, demoReceipts, demoShipments } from '../demoStore';

export type DashboardStats = {
  totalProducts: number;
  totalStock: number;
  lowStockProducts: number;
  occupiedLocations: number;
  totalLocations: number;
  pendingReceipts: number;
  pendingShipments: number;
};

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
    .from('receipts')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'partial']);
  if (receiptsError) throw receiptsError;

  const { count: pendingShipments, error: shipmentsError } = await supabase
    .from('shipments')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'picking']);
  if (shipmentsError) throw shipmentsError;

  return {
    totalProducts,
    totalStock,
    lowStockProducts,
    occupiedLocations: locations?.filter((location) => location.status === 'occupied').length || 0,
    totalLocations: locations?.length || 0,
    pendingReceipts: pendingReceipts || 0,
    pendingShipments: pendingShipments || 0,
  };
}
