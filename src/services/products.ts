import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoProducts, toDbProduct } from '../demoStore';
import type { DBProduct, ProductWithStock } from '../types';

export type ProductSearchPage = {
  items: ProductWithStock[];
  total: number;
};

export async function getProductsWithStock(): Promise<ProductWithStock[]> {
  if (isDemoMode) return demoProducts.filter((product) => product.active).map((product) => ({ ...product }));
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('get_products_with_stock');
  if (error) throw error;
  return (data || []) as ProductWithStock[];
}

export async function searchProductsPage(
  query = '',
  limit = 50,
  offset = 0
): Promise<ProductSearchPage> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
  const normalizedQuery = query.trim().toLowerCase();

  if (isDemoMode) {
    const filtered = demoProducts
      .filter((product) => product.active)
      .filter((product) => {
        if (!normalizedQuery) return true;
        return (
          product.sku.toLowerCase().includes(normalizedQuery) ||
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.category?.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => a.sku.localeCompare(b.sku));

    return {
      items: filtered.slice(safeOffset, safeOffset + safeLimit).map((product) => ({ ...product })),
      total: filtered.length,
    };
  }

  if (!isSupabaseConfigured) return { items: [], total: 0 };

  const { data, error } = await supabase.rpc('search_products_with_stock', {
    p_query: query.trim() || null,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });

  if (error) throw error;

  const rows = (data || []) as Array<ProductWithStock & { total_count?: number | string | null }>;
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const items = rows.map(({ total_count: _totalCount, ...product }) => ({
    ...product,
    min_stock: Number(product.min_stock || 0),
    max_stock: product.max_stock == null ? undefined : Number(product.max_stock),
    total_stock: Number(product.total_stock || 0),
  }));

  return { items, total };
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
    if (!product.active) throw new Error('Produto já está inativo');
    product.active = false;
    product.updated_at = new Date().toISOString();
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('active', true)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Produto não encontrado ou já está inativo; atualize a tela');
}
