import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DBStockBalance } from '../types';

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

export async function getProductTotalStock(productId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  
  const { data, error } = await supabase
    .rpc('get_product_total_stock', { p_product_id: productId });

  if (error) throw error;
  return data || 0;
}

export async function getStockSummary() {
  if (!isSupabaseConfigured) return { total_items: 0, total_quantity: 0, total_reserved: 0, total_available: 0 };
  
  const balances = await getStockBalances();

  return {
    total_items: balances.length,
    total_quantity: balances.reduce((sum, b) => sum + b.quantity, 0),
    total_reserved: balances.reduce((sum, b) => sum + b.reserved_quantity, 0),
    total_available: balances.reduce((sum, b) => sum + b.available_quantity, 0),
  };
}
