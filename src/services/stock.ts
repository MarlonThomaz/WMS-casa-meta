import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DBLocation, DBProduct, DBStockBalance } from '../types';

export type StockBalanceWithDetails = DBStockBalance & {
  products?: Pick<DBProduct, 'id' | 'sku' | 'name' | 'category' | 'unit_base'> | null;
  locations?: Pick<DBLocation, 'id' | 'code' | 'zone' | 'location_type'> | null;
};

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
