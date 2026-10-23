import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DBProduct, DBProductBarcode, ProductWithStock } from '../types';

// Buscar produtos com estoque total (USANDO FUNÇÃO SQL OTIMIZADA - evita N+1)
export async function getProductsWithStock(): Promise<ProductWithStock[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .rpc('get_products_with_stock');

  if (error) throw error;
  return (data || []) as ProductWithStock[];
}

// Buscar produto por ID
export async function getProductById(id: string): Promise<DBProduct | null> {
  if (!isSupabaseConfigured) return null;
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Buscar produto por SKU
export async function getProductBySku(sku: string): Promise<DBProduct | null> {
  if (!isSupabaseConfigured) return null;
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Criar novo produto
export async function createProduct(product: Omit<DBProduct, 'id' | 'created_at' | 'updated_at'>): Promise<DBProduct> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar produto
export async function updateProduct(id: string, updates: Partial<DBProduct>): Promise<DBProduct> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Desativar produto (soft delete)
export async function deactivateProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Buscar produto por código de barras
export async function findProductByBarcode(barcode: string) {
  if (!isSupabaseConfigured) return null;
  
  const { data, error } = await supabase
    .rpc('find_product_by_barcode', { p_barcode: barcode });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return data[0];
}

// Criar código de barras para produto
export async function createProductBarcode(barcode: Omit<DBProductBarcode, 'id' | 'created_at'>): Promise<DBProductBarcode> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { data, error } = await supabase
    .from('product_barcodes')
    .insert([barcode])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Buscar códigos de barras de um produto
export async function getProductBarcodes(productId: string): Promise<DBProductBarcode[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('product_barcodes')
    .select('*')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return data || [];
}
