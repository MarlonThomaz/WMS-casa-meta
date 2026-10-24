import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DBLocation, DBProduct, DBStockBalance } from '../types';

export type StockBalance = DBStockBalance;

export type StockBalanceWithDetails = DBStockBalance & {
  products?: Pick<DBProduct, 'id' | 'sku' | 'name' | 'category' | 'unit_base'> | null;
  locations?: Pick<DBLocation, 'id' | 'code' | 'zone' | 'location_type'> | null;
};

export async function getStockBalances(): Promise<DBStockBalance[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('stock_balances')
    .select('*');

  if (error) throw error;
  return data || [];
}

export async function getProductStockBalances(productId: string): Promise<DBStockBalance[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('stock_balances')
    .select('*')
    .eq('product_id', productId);

  if (error) throw error;
  return data || [];
}

export async function getStockBalancesWithDetails(filters?: {
  product_id?: string;
  location_id?: string;
  min_quantity?: number;
}): Promise<StockBalanceWithDetails[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('stock_balances')
    .select(`
      *,
      products (id, sku, name, category, unit_base),
      locations (id, code, zone, location_type)
    `)
    .order('updated_at', { ascending: false });

  if (filters?.product_id) query = query.eq('product_id', filters.product_id);
  if (filters?.location_id) query = query.eq('location_id', filters.location_id);
  if (filters?.min_quantity !== undefined) query = query.gte('quantity', filters.min_quantity);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as unknown as StockBalanceWithDetails[];
}

export async function getProductTotalStock(productId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { data, error } = await supabase
    .rpc('get_product_total_stock', { p_product_id: productId });

  if (error) throw error;
  return Number(data || 0);
}

export async function getStockSummary() {
  if (!isSupabaseConfigured) {
    return { total_items: 0, total_quantity: 0, total_reserved: 0, total_available: 0 };
  }

  const balances = await getStockBalances();

  return {
    total_items: balances.length,
    total_quantity: balances.reduce((sum, balance) => sum + Number(balance.quantity), 0),
    total_reserved: balances.reduce((sum, balance) => sum + Number(balance.reserved_quantity), 0),
    total_available: balances.reduce((sum, balance) => sum + Number(balance.available_quantity), 0),
  };
}
