import { supabase } from '../lib/supabase';

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

// Buscar produto por código de barras
export async function findProductByBarcode(barcode: string): Promise<ProductWithBarcode | null> {
  const { data, error } = await supabase
    .rpc('find_product_by_barcode', { p_barcode: barcode });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return data[0];
}

// Buscar todos os códigos de barras de um produto
export async function getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
  const { data, error } = await supabase
    .from('product_barcodes')
    .select('*')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Criar novo código de barras
export async function createProductBarcode(barcode: {
  product_id: string;
  barcode: string;
  barcode_type?: string;
  packaging_type?: string;
  quantity_per_package?: number;
  is_primary?: boolean;
}): Promise<ProductBarcode> {
  const { data, error } = await supabase
    .from('product_barcodes')
    .insert([{
      ...barcode,
      packaging_type: barcode.packaging_type || 'unit',
      quantity_per_package: barcode.quantity_per_package || 1,
      is_primary: barcode.is_primary || false,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar código de barras
export async function updateProductBarcode(
  id: string,
  updates: Partial<ProductBarcode>
): Promise<ProductBarcode> {
  const { data, error } = await supabase
    .from('product_barcodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Remover código de barras
export async function deleteProductBarcode(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_barcodes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Buscar produto com informações completas por código de barras
export async function getProductDetailsByBarcode(barcode: string) {
  // Buscar produto pelo código de barras
  const productInfo = await findProductByBarcode(barcode);
  if (!productInfo) return null;

  // Buscar estoque total
  const { data: totalStockData, error: stockError } = await supabase
    .rpc('get_product_total_stock', { p_product_id: productInfo.product_id });

  if (stockError) throw stockError;

  // Buscar estoque por localização
  const { data: stockByLocationData, error: locationError } = await supabase
    .rpc('get_product_stock_by_location', { p_product_id: productInfo.product_id });

  if (locationError) throw locationError;

  // Buscar todos os códigos de barras do produto
  const barcodes = await getProductBarcodes(productInfo.product_id);

  return {
    ...productInfo,
    total_stock: totalStockData || 0,
    stock_by_location: stockByLocationData || [],
    all_barcodes: barcodes,
  };
}

// Calcular quantidade em unidades base
export function calculateBaseUnits(
  scannedQuantity: number,
  quantityPerPackage: number
): number {
  return scannedQuantity * quantityPerPackage;
}

// Validar código de barras
export function validateBarcode(barcode: string): { valid: boolean; type?: string } {
  // EAN-13
  if (/^\d{13}$/.test(barcode)) {
    return { valid: true, type: 'EAN13' };
  }
  
  // EAN-8
  if (/^\d{8}$/.test(barcode)) {
    return { valid: true, type: 'EAN8' };
  }
  
  // Code 128 (alphanumeric)
  if (/^[A-Za-z0-9]{6,}$/.test(barcode)) {
    return { valid: true, type: 'CODE128' };
  }
  
  // Code 39
  if (/^[A-Z0-9\-\.\$\/\+\%\s]{1,}$/.test(barcode)) {
    return { valid: true, type: 'CODE39' };
  }
  
  // QR Code (qualquer string)
  if (barcode.length > 0) {
    return { valid: true, type: 'QR' };
  }
  
  return { valid: false };
}
