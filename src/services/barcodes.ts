import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoBarcodes, demoId, demoLocations, demoProducts } from '../demoStore';

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

const demoProductLocation: Record<string, string> = {
  'demo-p1': 'demo-l1',
  'demo-p2': 'demo-l2',
  'demo-p3': 'demo-l3',
  'demo-p4': 'demo-l4',
  'demo-p5': 'demo-l5',
};

export async function findProductByBarcode(barcode: string): Promise<ProductWithBarcode | null> {
  if (isDemoMode) {
    const normalized = barcode.trim();
    const entry = demoBarcodes.find((b) => b.barcode === normalized);
    if (!entry) return null;
    const product = demoProducts.find((p) => p.id === entry.product_id && p.active);
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
  return data[0] as ProductWithBarcode;
}

export async function getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
  if (isDemoMode) return demoBarcodes.filter((b) => b.product_id === productId).map((b) => ({ ...b }));
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
  if (isDemoMode) {
    if (demoBarcodes.some((b) => b.barcode === barcode.barcode.trim())) {
      throw new Error('Código de barras já cadastrado');
    }
    const created: ProductBarcode = {
      id: demoId('barcode'),
      product_id: barcode.product_id,
      barcode: barcode.barcode.trim(),
      barcode_type: barcode.barcode_type,
      packaging_type: barcode.packaging_type || 'unit',
      quantity_per_package: barcode.quantity_per_package || 1,
      is_primary: barcode.is_primary || false,
      created_at: new Date().toISOString(),
    };
    demoBarcodes.unshift(created);
    return created;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('product_barcodes')
    .insert([{ ...barcode, packaging_type: barcode.packaging_type || 'unit', quantity_per_package: barcode.quantity_per_package || 1, is_primary: barcode.is_primary || false }])
    .select()
    .single();
  if (error) throw error;
  return data as ProductBarcode;
}

export async function updateProductBarcode(id: string, updates: Partial<ProductBarcode>): Promise<ProductBarcode> {
  if (isDemoMode) {
    const barcode = demoBarcodes.find((b) => b.id === id);
    if (!barcode) throw new Error('Código de barras não encontrado');
    Object.assign(barcode, updates);
    return { ...barcode };
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase.from('product_barcodes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ProductBarcode;
}

export async function deleteProductBarcode(id: string): Promise<void> {
  if (isDemoMode) {
    const index = demoBarcodes.findIndex((b) => b.id === id);
    if (index >= 0) demoBarcodes.splice(index, 1);
    return;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { error } = await supabase.from('product_barcodes').delete().eq('id', id);
  if (error) throw error;
}

export async function getProductDetailsByBarcode(barcode: string): Promise<ProductBarcodeDetails | null> {
  const productInfo = await findProductByBarcode(barcode);
  if (!productInfo) return null;

  if (isDemoMode) {
    const product = demoProducts.find((p) => p.id === productInfo.product_id);
    if (!product) return null;
    const locationId = demoProductLocation[product.id];
    const location = demoLocations.find((l) => l.id === locationId);
    return {
      ...productInfo,
      total_stock: product.total_stock,
      stock_by_location: location ? [{
        location_id: location.id,
        location_code: location.code,
        quantity: product.total_stock,
        reserved_quantity: 0,
        available_quantity: product.total_stock,
      }] : [],
      all_barcodes: await getProductBarcodes(product.id),
    };
  }
  if (!isSupabaseConfigured) return null;

  const { data: totalStockData, error: stockError } = await supabase.rpc('get_product_total_stock', { p_product_id: productInfo.product_id });
  if (stockError) throw stockError;
  const { data: stockByLocationData, error: locationError } = await supabase.rpc('get_product_stock_by_location', { p_product_id: productInfo.product_id });
  if (locationError) throw locationError;

  return {
    ...productInfo,
    total_stock: Number(totalStockData || 0),
    stock_by_location: ((stockByLocationData || []) as ProductStockLocation[]).map((row) => ({ ...row, quantity: Number(row.quantity), reserved_quantity: Number(row.reserved_quantity), available_quantity: Number(row.available_quantity) })),
    all_barcodes: await getProductBarcodes(productInfo.product_id),
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
  const validation = validateBarcode(params.barcode);
  if (!validation.valid) throw new Error('Código de barras inválido');

  if (isDemoMode) {
    if (demoProducts.some((p) => p.sku.toLowerCase() === params.sku.trim().toLowerCase())) throw new Error('SKU já cadastrado');
    if (demoBarcodes.some((b) => b.barcode === params.barcode.trim())) throw new Error('Código de barras já cadastrado');
    const productId = demoId('product');
    const quantity = Math.max(0, Number(params.initial_quantity || 0));
    demoProducts.unshift({
      id: productId,
      sku: params.sku.trim(),
      name: params.name.trim(),
      description: params.description,
      category: params.category,
      unit_base: params.unit_base || 'un',
      min_stock: params.min_stock ?? 0,
      max_stock: params.max_stock,
      active: true,
      total_stock: quantity,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    demoBarcodes.unshift({
      id: demoId('barcode'),
      product_id: productId,
      barcode: params.barcode.trim(),
      barcode_type: params.barcode_type || validation.type,
      packaging_type: params.packaging_type || 'unit',
      quantity_per_package: params.quantity_per_package ?? 1,
      is_primary: true,
      created_at: new Date().toISOString(),
    });
    if (params.initial_location_id) demoProductLocation[productId] = params.initial_location_id;
    return productId;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

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

export function calculateBaseUnits(scannedQuantity: number, quantityPerPackage: number): number {
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
