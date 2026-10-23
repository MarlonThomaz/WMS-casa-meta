import { supabase } from '../lib/supabase';

export type StockBalance = {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_movement_at: string;
  created_at: string;
  updated_at: string;
};

export type StockBalanceWithDetails = StockBalance & {
  product?: {
    id: string;
    sku: string;
    name: string;
    unit_base: string;
  };
  location?: {
    id: string;
    code: string;
    zone: string;
    location_type: string;
  };
};

// Buscar saldo de um produto em uma localização
export async function getStockBalance(productId: string, locationId: string): Promise<StockBalance | null> {
  const { data, error } = await supabase
    .from('stock_balances')
    .select('*')
    .eq('product_id', productId)
    .eq('location_id', locationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Buscar todos os saldos de um produto
export async function getProductStockBalances(productId: string): Promise<StockBalance[]> {
  const { data, error } = await supabase
    .from('stock_balances')
    .select('*')
    .eq('product_id', productId)
    .order('location_id');

  if (error) throw error;
  return data || [];
}

// Buscar todos os saldos de uma localização
export async function getLocationStockBalances(locationId: string): Promise<StockBalance[]> {
  const { data, error } = await supabase
    .from('stock_balances')
    .select('*')
    .eq('location_id', locationId)
    .order('product_id');

  if (error) throw error;
  return data || [];
}

// Buscar estoque total de um produto
export async function getProductTotalStock(productId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_product_total_stock', { p_product_id: productId });

  if (error) throw error;
  return data || 0;
}

// Buscar estoque disponível de um produto
export async function getProductAvailableStock(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from('stock_balances')
    .select('available_quantity')
    .eq('product_id', productId);

  if (error) throw error;
  
  const total = data?.reduce((sum, balance) => sum + balance.available_quantity, 0) || 0;
  return total;
}

// Buscar estoque reservado de um produto
export async function getProductReservedStock(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from('stock_balances')
    .select('reserved_quantity')
    .eq('product_id', productId);

  if (error) throw error;
  
  const total = data?.reduce((sum, balance) => sum + balance.reserved_quantity, 0) || 0;
  return total;
}

// Buscar saldos com detalhes (produto e localização)
export async function getStockBalancesWithDetails(filters?: {
  product_id?: string;
  location_id?: string;
  min_quantity?: number;
}): Promise<StockBalanceWithDetails[]> {
  let query = supabase
    .from('stock_balances')
    .select(`
      *,
      products (id, sku, name, unit_base),
      locations (id, code, zone, location_type)
    `);

  if (filters?.product_id) {
    query = query.eq('product_id', filters.product_id);
  }

  if (filters?.location_id) {
    query = query.eq('location_id', filters.location_id);
  }

  if (filters?.min_quantity !== undefined) {
    query = query.gte('quantity', filters.min_quantity);
  }

  const { data, error } = await query.order('location_id');

  if (error) throw error;
  return data || [];
}

// Buscar produtos com estoque baixo
export async function getLowStockProducts(): Promise<StockBalanceWithDetails[]> {
  const { data, error } = await supabase
    .from('stock_balances')
    .select(`
      *,
      products (id, sku, name, unit_base, min_stock),
      locations (id, code, zone, location_type)
    `)
    .order('product_id');

  if (error) throw error;

  // Agrupar por produto e calcular total
  const productStocks: Record<string, { total: number; details: StockBalanceWithDetails[] }> = {};

  data?.forEach(balance => {
    const productId = balance.product_id;
    if (!productStocks[productId]) {
      productStocks[productId] = { total: 0, details: [] };
    }
    productStocks[productId].total += balance.quantity;
    productStocks[productId].details.push(balance as StockBalanceWithDetails);
  });

  // Filtrar produtos com estoque abaixo do mínimo
  const lowStockProducts: StockBalanceWithDetails[] = [];
  
  Object.values(productStocks).forEach(({ total, details }) => {
    const firstDetail = details[0] as any;
    if (firstDetail?.products && firstDetail.products.min_stock) {
      if (total < firstDetail.products.min_stock) {
        lowStockProducts.push(...details);
      }
    }
  });

  return lowStockProducts;
}

// Buscar produtos sem estoque
export async function getOutOfStockProducts(): Promise<any[]> {
  // Buscar todos os produtos
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, sku, name, min_stock')
    .eq('active', true);

  if (productsError) throw productsError;

  // Buscar produtos com estoque
  const { data: balances, error: balancesError } = await supabase
    .from('stock_balances')
    .select('product_id, quantity');

  if (balancesError) throw balancesError;

  // Agrupar saldos por produto
  const productStocks: Record<string, number> = {};
  balances?.forEach(balance => {
    productStocks[balance.product_id] = (productStocks[balance.product_id] || 0) + balance.quantity;
  });

  // Filtrar produtos sem estoque
  const outOfStock = products?.filter(product => {
    const stock = productStocks[product.id] || 0;
    return stock === 0;
  }) || [];

  return outOfStock;
}

// Verificar se há estoque suficiente
export async function checkStockAvailability(
  productId: string,
  quantity: number,
  locationId?: string
): Promise<{ available: boolean; available_quantity: number }> {
  let availableQuantity: number;

  if (locationId) {
    // Verificar em localização específica
    const balance = await getStockBalance(productId, locationId);
    availableQuantity = balance?.available_quantity || 0;
  } else {
    // Verificar estoque total disponível
    availableQuantity = await getProductAvailableStock(productId);
  }

  return {
    available: availableQuantity >= quantity,
    available_quantity: availableQuantity,
  };
}

// Reservar estoque
export async function reserveStock(
  productId: string,
  locationId: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase.rpc('reserve_stock', {
    p_product_id: productId,
    p_location_id: locationId,
    p_quantity: quantity,
  });

  if (error) throw error;
}

// Liberar reserva
export async function releaseReservation(
  productId: string,
  locationId: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase.rpc('release_reservation', {
    p_product_id: productId,
    p_location_id: locationId,
    p_quantity: quantity,
  });

  if (error) throw error;
}

// Confirmar estoque separado (picking)
export async function confirmPickedStock(
  productId: string,
  locationId: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase.rpc('confirm_picked_stock', {
    p_product_id: productId,
    p_location_id: locationId,
    p_quantity: quantity,
  });

  if (error) throw error;
}

// Resumo de estoque
export async function getStockSummary() {
  const { data: balances, error } = await supabase
    .from('stock_balances')
    .select('quantity, reserved_quantity');

  if (error) throw error;

  const summary = {
    total_items: balances?.length || 0,
    total_quantity: balances?.reduce((sum, b) => sum + b.quantity, 0) || 0,
    total_reserved: balances?.reduce((sum, b) => sum + b.reserved_quantity, 0) || 0,
    total_available: balances?.reduce((sum, b) => sum + (b.quantity - b.reserved_quantity), 0) || 0,
  };

  return summary;
}
