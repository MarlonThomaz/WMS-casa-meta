import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoBarcodes, demoId, demoProducts, toDbProduct } from '../demoStore';
import { DBProduct, DBProductBarcode, ProductWithStock } from '../types';

export async function getProductsWithStock(): Promise<ProductWithStock[]> {
  if (isDemoMode) return demoProducts.filter((p) => p.active).map((p) => ({ ...p }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_products_with_stock');
  if (error) throw error;
  return (data || []) as ProductWithStock[];
}

export async function getProductById(id: string): Promise<DBProduct | null> {
  if (isDemoMode) {
    const product = demoProducts.find((p) => p.id === id);
    return product ? toDbProduct(product) : null;
  }
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getProductBySku(sku: string): Promise<DBProduct | null> {
  if (isDemoMode) {
    const product = demoProducts.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
    return product ? toDbProduct(product) : null;
  }
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('products').select('*').eq('sku', sku).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createProduct(product: Omit<DBProduct, 'id' | 'created_at' | 'updated_at'>): Promise<DBProduct> {
  if (isDemoMode) {
    if (demoProducts.some((p) => p.sku.toLowerCase() === product.sku.toLowerCase())) {
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
    const product = demoProducts.find((p) => p.id === id);
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
    const product = demoProducts.find((p) => p.id === id);
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

export async function findProductByBarcode(barcode: string) {
  if (isDemoMode) {
    const entry = demoBarcodes.find((b) => b.barcode === barcode);
    if (!entry) return null;
    const product = demoProducts.find((p) => p.id === entry.product_id);
    if (!product) return null;
    return {
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      barcode_id: entry.id,
      barcode: entry.barcode,
      packaging_type: entry.packaging_type,
      quantity_per_package: entry.quantity_per_package,
    };
  }
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('find_product_by_barcode', { p_barcode: barcode });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}

export async function createProductBarcode(barcode: Omit<DBProductBarcode, 'id' | 'created_at'>): Promise<DBProductBarcode> {
  if (isDemoMode) {
    if (demoBarcodes.some((b) => b.barcode === barcode.barcode)) throw new Error('Código de barras já cadastrado');
    const created: DBProductBarcode = {
      ...barcode,
      id: demoId('barcode'),
      created_at: new Date().toISOString(),
    };
    demoBarcodes.unshift(created);
    return created;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.from('product_barcodes').insert([barcode]).select().single();
  if (error) throw error;
  return data;
}

export async function getProductBarcodes(productId: string): Promise<DBProductBarcode[]> {
  if (isDemoMode) return demoBarcodes.filter((b) => b.product_id === productId).map((b) => ({ ...b }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('product_barcodes')
    .select('*')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return data || [];
}
