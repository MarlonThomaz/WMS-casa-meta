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

type DashboardStatsRow = {
  total_products: number | string | null;
  total_stock: number | string | null;
  low_stock_products: number | string | null;
  low_stock_items: unknown;
  occupied_locations: number | string | null;
  total_locations: number | string | null;
  pending_receipts: number | string | null;
  pending_shipments: number | string | null;
};

function normalizeLowStockItems(value: unknown): DashboardLowStockItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];

    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.sku !== 'string' || typeof row.name !== 'string') {
      return [];
    }

    return [{
      id: row.id,
      sku: row.sku,
      name: row.name,
      total_stock: Number(row.total_stock || 0),
      min_stock: Number(row.min_stock || 0),
      unit_base: typeof row.unit_base === 'string' ? row.unit_base : 'un',
    }];
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) {
    const active = demoProducts.filter((product) => product.active);
    const lowStockItems = active
      .filter((product) => product.total_stock <= product.min_stock)
      .sort((a, b) => a.total_stock - b.total_stock || a.sku.localeCompare(b.sku))
      .slice(0, 6)
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
      lowStockProducts: active.filter((product) => product.total_stock <= product.min_stock).length,
      lowStockItems,
      occupiedLocations: demoLocations.filter((location) => Number(location.total_quantity || 0) > 0).length,
      totalLocations: demoLocations.length,
      pendingReceipts: demoReceipts.filter((receipt) => receipt.status === 'pending' || receipt.status === 'partial').length,
      pendingShipments: demoShipments.filter((shipment) => shipment.status === 'pending' || shipment.status === 'picking').length,
    };
  }

  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw error;

  const row = ((data || []) as DashboardStatsRow[])[0];
  if (!row) {
    throw new Error('Banco não retornou as estatísticas do dashboard');
  }

  return {
    totalProducts: Number(row.total_products || 0),
    totalStock: Number(row.total_stock || 0),
    lowStockProducts: Number(row.low_stock_products || 0),
    lowStockItems: normalizeLowStockItems(row.low_stock_items),
    occupiedLocations: Number(row.occupied_locations || 0),
    totalLocations: Number(row.total_locations || 0),
    pendingReceipts: Number(row.pending_receipts || 0),
    pendingShipments: Number(row.pending_shipments || 0),
  };
}
