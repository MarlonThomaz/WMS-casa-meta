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

export async function searchStockLocations(
  search: string,
  limit = 100
): Promise<StockBalanceWithDetails[]> {
  const normalized = search.trim();
  if (!isSupabaseConfigured || normalized.length < 2) return [];

  const { data, error } = await supabase.rpc('search_stock_locations', {
    p_query: normalized,
    p_limit: limit,
  });
  if (error) throw error;

  return ((data || []) as Array<{
    id: string;
    product_id: string;
    location_id: string;
    quantity: number | string;
    reserved_quantity: number | string;
    available_quantity: number | string;
    last_movement_at: string;
    created_at: string;
    updated_at: string;
    product_sku: string;
    product_name: string;
    product_category?: string | null;
    product_unit_base: string;
    location_code: string;
    location_zone: string;
    location_type: DBLocation['location_type'];
  }>).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    location_id: row.location_id,
    quantity: Number(row.quantity || 0),
    reserved_quantity: Number(row.reserved_quantity || 0),
    available_quantity: Number(row.available_quantity || 0),
    last_movement_at: row.last_movement_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    products: {
      id: row.product_id,
      sku: row.product_sku,
      name: row.product_name,
      category: row.product_category || undefined,
      unit_base: row.product_unit_base,
    },
    locations: {
      id: row.location_id,
      code: row.location_code,
      zone: row.location_zone,
      location_type: row.location_type,
    },
  }));
}
