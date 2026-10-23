import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

export type ProductWithBarcode = {
  product_id: string;
  sku: string;
  name: string;
  barcode_id: string;
  barcode: string;
  packaging_type: string;
  quantity_per_package: number;
};

export type ProductStockLocation = {
  location_id: string;
  location_code: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
};

export type ProductBarcodeDetails = ProductWithBarcode & {
  total_stock: number;
  stock_by_location: ProductStockLocation[];
  all_barcodes: ProductBarcode[];
};

export async function findProductByBarcode(barcode: string): Promise<ProductWithBarcode | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('find_product_by_barcode', {
    p_barcode: barcode,
  });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return data[0] as ProductWithBarcode;
}

export async function getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('product_barcodes')
    .select('*')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return (data || []) as ProductBarcode[];
}

export async function createProductBarcode(barcode: {
  product_id: string;
  barcode: string;
  barcode_type?: string;
  packaging_type?: string;
  quantity_per_package?: number;
  is_primary?: boolean;
}): Promise<ProductBarcode> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('product_barcodes')
    .insert([
      {
        ...barcode,
        packaging_type: barcode.packaging_type || 'unit',
        quantity_per_package: barcode.quantity_per_package || 1,
        is_primary: barcode.is_primary || false,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as ProductBarcode;
}

export async function updateProductBarcode(
  id: string,
  updates: Partial<ProductBarcode>
): Promise<ProductBarcode> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('product_barcodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProductBarcode;
}

export async function deleteProductBarcode(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('product_barcodes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getProductDetailsByBarcode(
  barcode: string
): Promise<ProductBarcodeDetails | null> {
  if (!isSupabaseConfigured) return null;

  const productInfo = await findProductByBarcode(barcode);
  if (!productInfo) return null;

  const { data: totalStockData, error: stockError } = await supabase.rpc(
    'get_product_total_stock',
    { p_product_id: productInfo.product_id }
  );
  if (stockError) throw stockError;

  const { data: stockByLocationData, error: locationError } = await supabase.rpc(
    'get_product_stock_by_location',
    { p_product_id: productInfo.product_id }
  );
  if (locationError) throw locationError;

  const barcodes = await getProductBarcodes(productInfo.product_id);

  return {
    ...productInfo,
    total_stock: Number(totalStockData || 0),
    stock_by_location: ((stockByLocationData || []) as ProductStockLocation[]).map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      reserved_quantity: Number(row.reserved_quantity),
      available_quantity: Number(row.available_quantity),
    })),
    all_barcodes: barcodes,
  };
}

export async function registerProductWithBarcode(params: {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit_base?: string;
  min_stock?: number;
  max_stock?: number;
  barcode: string;
  barcode_type?: string;
  packaging_type?: string;
  quantity_per_package?: number;
  initial_location_id?: string;
  initial_quantity?: number;
}): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const validation = validateBarcode(params.barcode);
  if (!validation.valid) throw new Error('Código de barras inválido');

  const { data, error } = await supabase.rpc('register_product_with_barcode', {
    p_sku: params.sku,
    p_name: params.name,
    p_description: params.description || null,
    p_category: params.category || null,
    p_unit_base: params.unit_base || 'un',
    p_min_stock: params.min_stock ?? 0,
    p_max_stock: params.max_stock ?? null,
    p_barcode: params.barcode,
    p_barcode_type: params.barcode_type || validation.type || null,
    p_packaging_type: params.packaging_type || 'unit',
    p_quantity_per_package: params.quantity_per_package ?? 1,
    p_initial_location_id: params.initial_location_id || null,
    p_initial_quantity: params.initial_quantity ?? 0,
  });

  if (error) throw error;
  if (!data) throw new Error('Banco não retornou o ID do produto');

  return data as string;
}

export function calculateBaseUnits(
  scannedQuantity: number,
  quantityPerPackage: number
): number {
  return scannedQuantity * quantityPerPackage;
}

export function validateBarcode(barcode: string): { valid: boolean; type?: string } {
  const normalized = barcode.trim();

  if (/^\d{13}$/.test(normalized)) return { valid: true, type: 'EAN13' };
  if (/^\d{8}$/.test(normalized)) return { valid: true, type: 'EAN8' };
  if (/^[A-Za-z0-9]{6,}$/.test(normalized)) return { valid: true, type: 'CODE128' };
  if (/^[A-Z0-9\-\.\$\/\+\%\s]{1,}$/.test(normalized)) return { valid: true, type: 'CODE39' };
  if (normalized.length > 0) return { valid: true, type: 'QR' };

  return { valid: false };
}
