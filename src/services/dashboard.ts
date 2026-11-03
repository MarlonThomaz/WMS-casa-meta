import { supabase, isDemoMode } from '../lib/supabase';
import { demoLocations, demoProducts, demoReceipts, demoShipments } from '../demoStore';

export type DashboardLowStockItem = {
  id: string;
  sku: string;
  name: string;
  total_stock: number;
  min_stock: number;
  unit_base: string;
};

export type DashboardStats = {
  totalProducts: number;
  totalStock: number;
  lowStockProducts: number;
  lowStockItems: DashboardLowStockItem[];
  occupiedLocations: number;
  totalLocations: number;
  pendingReceipts: number;
  pendingShipments: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) {
    const active = demoProducts.filter((product) => product.active);
    const lowStockItems = active
      .filter((product) => product.total_stock <= product.min_stock)
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        total_stock: product.total_stock,
        min_stock: product.min_stock,
        unit_base: product.unit_base,
      }));

    return {
      totalProducts: active.length,
      totalStock: active.reduce((sum, product) => sum + product.total_stock, 0),
      lowStockProducts: lowStockItems.length,
      lowStockItems,
      occupiedLocations: demoLocations.filter((location) => Number(location.total_quantity || 0) > 0).length,
      totalLocations: demoLocations.length,
      pendingReceipts: demoReceipts.filter((receipt) => receipt.status === 'pending' || receipt.status === 'partial').length,
      pendingShipments: demoShipments.filter((shipment) => shipment.status === 'pending' || shipment.status === 'picking').length,
    };
  }

  const { data: productsWithStock, error: productsError } = await supabase.rpc('get_products_with_stock');
  if (productsError) throw productsError;

  const products = (productsWithStock || []) as Array<{
    id: string;
    sku: string;
    name: string;
    total_stock: number;
    min_stock: number;
    unit_base: string;
  }>;
  const lowStockItems = products
    .filter((product) => Number(product.total_stock || 0) <= Number(product.min_stock || 0))
    .map((product) => ({
      ...product,
      total_stock: Number(product.total_stock || 0),
      min_stock: Number(product.min_stock || 0),
    }));

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + Number(product.total_stock || 0), 0);

  const { data: locations, error: locationsError } = await supabase
    .from('locations')
    .select('id, stock_balances(quantity)');
  if (locationsError) throw locationsError;

  const occupiedLocations = (locations || []).filter((location) => {
    const balances = (location.stock_balances || []) as Array<{ quantity: number | string | null }>;
    return balances.some((balance) => Number(balance.quantity || 0) > 0);
  }).length;

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
    lowStockProducts: lowStockItems.length,
    lowStockItems,
    occupiedLocations,
    totalLocations: locations?.length || 0,
    pendingReceipts: pendingReceipts || 0,
    pendingShipments: pendingShipments || 0,
  };
}
