import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoProducts, toDbProduct } from '../demoStore';
import type { DBProduct, ProductWithStock } from '../types';

export async function getProductsWithStock(): Promise<ProductWithStock[]> {
  if (isDemoMode) return demoProducts.filter((product) => product.active).map((product) => ({ ...product }));
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_products_with_stock');
  if (error) throw error;
  return (data || []) as ProductWithStock[];
}

export async function createProduct(
  product: Omit<DBProduct, 'id' | 'created_at' | 'updated_at'>
): Promise<DBProduct> {
  if (isDemoMode) {
    if (demoProducts.some((item) => item.sku.toLowerCase() === product.sku.toLowerCase())) {
      throw new Error('SKU já cadastrado na demonstração');
    }

    const created: ProductWithStock = {
      ...product,
      id: demoId('product'),
      total_stock: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    demoProducts.unshift(created);
    return toDbProduct(created);
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.from('products').insert([product]).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<DBProduct>): Promise<DBProduct> {
  if (isDemoMode) {
    const product = demoProducts.find((item) => item.id === id);
    if (!product) throw new Error('Produto não encontrado');
    Object.assign(product, updates, { updated_at: new Date().toISOString() });
    return toDbProduct(product);
  }

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

export async function deactivateProduct(id: string): Promise<void> {
  if (isDemoMode) {
    const product = demoProducts.find((item) => item.id === id);
    if (!product) throw new Error('Produto não encontrado');
    product.active = false;
    product.updated_at = new Date().toISOString();
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase
    .from('products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
