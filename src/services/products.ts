import { supabase } from '../lib/supabase';

export type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit_base: string;
  min_stock: number;
  max_stock?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductBarcode = {
  id: string;
  product_id: string;
  barcode: string;
  barcode_type?: string;
  packaging_type: string;
  quantity_per_package: number;
  is_primary: boolean;
  created_at: string;
};

export type ProductWithStock = Product & {
  total_stock: number;
  barcodes?: ProductBarcode[];
};

// Buscar todos os produtos ativos
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sku');

  if (error) throw error;
  return data || [];
}

// Buscar produto por ID
export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Buscar produto por SKU
export async function getProductBySku(sku: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

// Buscar produto por código de barras
export async function getProductByBarcode(barcode: string): Promise<ProductWithStock | null> {
  const { data, error } = await supabase
    .rpc('find_product_by_barcode', { p_barcode: barcode });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const result = data[0];
  
  // Buscar estoque total
  const { data: stockData } = await supabase
    .rpc('get_product_total_stock', { p_product_id: result.product_id });

  return {
    id: result.product_id,
    sku: result.sku,
    name: result.name,
    unit_base: 'un', // Default
    min_stock: 0,
    active: true,
    created_at: '',
    updated_at: '',
    total_stock: stockData || 0,
  };
}

// Buscar produtos com estoque total
export async function getProductsWithStock(): Promise<ProductWithStock[]> {
  const products = await getProducts();
  
  const productsWithStock = await Promise.all(
    products.map(async (product) => {
      const { data: stockData } = await supabase
        .rpc('get_product_total_stock', { p_product_id: product.id });

      return {
        ...product,
        total_stock: stockData || 0,
      };
    })
  );

  return productsWithStock;
}

// Buscar estoque de um produto por localização
export async function getProductStockByLocation(productId: string) {
  const { data, error } = await supabase
    .rpc('get_product_stock_by_location', { p_product_id: productId });

  if (error) throw error;
  return data || [];
}

// Criar novo produto
export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar produto
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
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
  const { error } = await supabase
    .from('products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Criar código de barras para produto
export async function createProductBarcode(barcode: Omit<ProductBarcode, 'id' | 'created_at'>): Promise<ProductBarcode> {
  const { data, error } = await supabase
    .from('product_barcodes')
    .insert([barcode])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Buscar códigos de barras de um produto
export async function getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
  const { data, error } = await supabase
    .from('product_barcodes')
    .select('*')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Buscar produto por código de barras (detalhado)
export async function findProductByBarcodeDetailed(barcode: string) {
  const { data, error } = await supabase
    .from('product_barcodes')
    .select(`
      *,
      products (*)
    `)
    .eq('barcode', barcode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}
