import { supabase } from '../lib/supabase';

export type DashboardStats = {
  totalProducts: number;
  totalStock: number;
  lowStockProducts: number;
  occupiedLocations: number;
  totalLocations: number;
  pendingReceipts: number;
  pendingShipments: number;
};

export type CategoryStock = {
  category: string;
  total_quantity: number;
};

export type ZoneOccupancy = {
  zone: string;
  total_capacity: number;
  total_occupied: number;
  occupancy_percentage: number;
};

export type MovementSummary = {
  date: string;
  inbound: number;
  outbound: number;
};

// Buscar estatísticas gerais do dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Total de produtos ativos
    const { count: productsCount, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    if (productsError) throw productsError;

    // Estoque total
    const { data: stockData, error: stockError } = await supabase
      .from('stock_balances')
      .select('quantity');

    if (stockError) throw stockError;
    const totalStock = stockData?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;

    // Localizações
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('status');

    if (locationsError) throw locationsError;

    const occupiedLocations = locations?.filter((l: any) => l.status === 'occupied').length || 0;
    const totalLocations = locations?.length || 0;

    // Recebimentos pendentes
    const { count: pendingReceipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'partial']);

    if (receiptsError) throw receiptsError;

    // Expedições pendentes
    const { count: pendingShipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'picking']);

    if (shipmentsError) throw shipmentsError;

    return {
      totalProducts: productsCount || 0,
      totalStock,
      lowStockProducts: 0, // Simplificado por enquanto
      occupiedLocations,
      totalLocations,
      pendingReceipts: pendingReceipts || 0,
      pendingShipments: pendingShipments || 0,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    throw error;
  }
}

// Buscar estoque por categoria
export async function getStockByCategory(): Promise<CategoryStock[]> {
  try {
    const { data: balances, error: balancesError } = await supabase
      .from('stock_balances')
      .select('product_id, quantity');

    if (balancesError) throw balancesError;

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, category')
      .eq('active', true);

    if (productsError) throw productsError;

    // Agrupar por categoria
    const categoryMap: Record<string, number> = {};
    
    balances?.forEach((balance: any) => {
      const product = products?.find((p: any) => p.id === balance.product_id);
      if (product) {
        const category = product.category || 'Sem Categoria';
        categoryMap[category] = (categoryMap[category] || 0) + balance.quantity;
      }
    });

    // Converter para array
    return Object.entries(categoryMap).map(([category, total_quantity]) => ({
      category,
      total_quantity,
    }));
  } catch (error) {
    console.error('Erro ao buscar estoque por categoria:', error);
    throw error;
  }
}

// Buscar ocupação por zona
export async function getZoneOccupancy(): Promise<ZoneOccupancy[]> {
  try {
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('id, zone, capacity');

    if (locationsError) throw locationsError;

    const { data: balances, error: balancesError } = await supabase
      .from('stock_balances')
      .select('location_id, quantity');

    if (balancesError) throw balancesError;

    // Mapear location_id para zone
    const locationZoneMap: Record<string, string> = {};
    
    locations?.forEach((loc: any) => {
      locationZoneMap[loc.id] = loc.zone;
    });

    // Agrupar por zona
    const zoneMap: Record<string, { capacity: number; occupied: number }> = {};
    
    locations?.forEach((loc: any) => {
      if (!zoneMap[loc.zone]) {
        zoneMap[loc.zone] = { capacity: 0, occupied: 0 };
      }
      zoneMap[loc.zone].capacity += loc.capacity || 0;
    });

    balances?.forEach((balance: any) => {
      const zone = locationZoneMap[balance.location_id];
      if (zone && zoneMap[zone]) {
        zoneMap[zone].occupied += balance.quantity;
      }
    });

    // Converter para array
    return Object.entries(zoneMap).map(([zone, data]) => ({
      zone,
      total_capacity: data.capacity,
      total_occupied: data.occupied,
      occupancy_percentage: data.capacity > 0 ? (data.occupied / data.capacity) * 100 : 0,
    }));
  } catch (error) {
    console.error('Erro ao buscar ocupação por zona:', error);
    throw error;
  }
}

// Buscar resumo de movimentações dos últimos 7 dias
export async function getMovementSummary(): Promise<MovementSummary[]> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: movements, error } = await supabase
      .from('movements')
      .select('movement_type, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .eq('status', 'completed');

    if (error) throw error;

    // Agrupar por data
    const dailyMap: Record<string, { inbound: number; outbound: number }> = {};

    // Inicializar últimos 7 dias
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap[dateStr] = { inbound: 0, outbound: 0 };
    }

    // Contar movimentações
    movements?.forEach((m: any) => {
      const dateStr = m.created_at.split('T')[0];
      if (dailyMap[dateStr]) {
        if (m.movement_type === 'inbound') {
          dailyMap[dateStr].inbound++;
        } else if (m.movement_type === 'outbound') {
          dailyMap[dateStr].outbound++;
        }
      }
    });

    // Converter para array ordenado
    return Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        inbound: data.inbound,
        outbound: data.outbound,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Erro ao buscar resumo de movimentações:', error);
    throw error;
  }
}
