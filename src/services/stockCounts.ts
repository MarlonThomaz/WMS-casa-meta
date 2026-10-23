import { supabase } from '../lib/supabase';

export type StockCount = {
  id: string;
  count_number: string;
  count_type: 'full' | 'cycle' | 'spot' | 'reconciliation';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  location_id?: string;
  operator_id?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
};

export type StockCountLine = {
  id: string;
  stock_count_id: string;
  product_id: string;
  location_id: string;
  system_quantity: number;
  counted_quantity: number;
  difference: number;
  notes?: string;
  counted_at: string;
  created_at: string;
};

export type StockCountWithLines = StockCount & {
  lines: StockCountLine[];
};

// Criar nova contagem
export async function createStockCount(params: {
  count_type: StockCount['count_type'];
  location_id?: string;
  operator_id?: string;
  notes?: string;
}): Promise<StockCount> {
  const response = await supabase.rpc('generate_count_number');
  const countNumber = response.data as string;
  const refError = response.error;

  if (refError) throw refError;

  const { data, error } = await supabase
    .from('stock_counts')
    .insert([{
      ...params,
      count_number: countNumber,
      status: 'pending',
      created_by: params.operator_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as StockCount;
}

// Adicionar linha à contagem
export async function addStockCountLine(line: {
  stock_count_id: string;
  product_id: string;
  location_id: string;
}): Promise<StockCountLine> {
  // Buscar quantidade do sistema
  const { data: balanceData, error: balanceError } = await supabase
    .from('stock_balances')
    .select('quantity')
    .eq('product_id', line.product_id)
    .eq('location_id', line.location_id)
    .maybeSingle();

  if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;

  const systemQuantity = (balanceData as any)?.quantity || 0;

  const { data, error } = await supabase
    .from('stock_count_lines')
    .insert([{
      ...line,
      system_quantity: systemQuantity,
      counted_quantity: systemQuantity,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as StockCountLine;
}

// Atualizar quantidade contada
export async function updateCountedQuantity(
  lineId: string,
  countedQuantity: number,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('stock_count_lines')
    .update({
      counted_quantity: countedQuantity,
      notes,
      counted_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

// Iniciar contagem
export async function startStockCount(countId: string): Promise<void> {
  const { error } = await supabase
    .from('stock_counts')
    .update({ status: 'in_progress' })
    .eq('id', countId);

  if (error) throw error;
}

// Concluir contagem e gerar ajustes
export async function completeStockCount(countId: string): Promise<{
  adjustments: number;
  discrepancies: number;
}> {
  const count = await getStockCountById(countId);
  if (!count) throw new Error('Contagem não encontrada');

  let adjustments = 0;
  let discrepancies = 0;

  for (const line of count.lines) {
    const difference = line.counted_quantity - line.system_quantity;
    
    if (difference !== 0) {
      discrepancies++;
      
      const { data: movement, error: movementError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'adjustment',
          status: 'pending',
          source_reference: count.count_number,
          operator_id: count.operator_id,
          notes: `Ajuste de contagem ${count.count_number}: ${difference > 0 ? '+' : ''}${difference}`,
        }])
        .select()
        .single();

      if (movementError) throw movementError;

      if (difference > 0) {
        await supabase.from('movement_lines').insert([{
          movement_id: (movement as any).id,
          product_id: line.product_id,
          to_location_id: line.location_id,
          quantity: difference,
          unit: 'un',
          notes: `Sistema: ${line.system_quantity}, Contado: ${line.counted_quantity}`,
        }]);
      } else {
        await supabase.from('movement_lines').insert([{
          movement_id: (movement as any).id,
          product_id: line.product_id,
          from_location_id: line.location_id,
          quantity: Math.abs(difference),
          unit: 'un',
          notes: `Sistema: ${line.system_quantity}, Contado: ${line.counted_quantity}`,
        }]);
      }

      const { error: processError } = await supabase.rpc('process_stock_movement', {
        p_movement_id: (movement as any).id,
        p_product_id: line.product_id,
        p_from_location_id: difference < 0 ? line.location_id : null,
        p_to_location_id: difference > 0 ? line.location_id : null,
        p_quantity: Math.abs(difference),
        p_operator_id: count.operator_id,
      });

      if (processError) throw processError;
      adjustments++;
    }
  }

  const { error } = await supabase
    .from('stock_counts')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', countId);

  if (error) throw error;

  return { adjustments, discrepancies };
}

// Cancelar contagem
export async function cancelStockCount(countId: string): Promise<void> {
  const { error } = await supabase
    .from('stock_counts')
    .update({ status: 'cancelled' })
    .eq('id', countId);

  if (error) throw error;
}

// Buscar contagem por ID com linhas
export async function getStockCountById(id: string): Promise<StockCountWithLines | null> {
  const { data: count, error: countError } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('id', id)
    .single();

  if (countError) throw countError;
  if (!count) return null;

  const { data: lines, error: linesError } = await supabase
    .from('stock_count_lines')
    .select('*')
    .eq('stock_count_id', id);

  if (linesError) throw linesError;

  return {
    ...(count as StockCount),
    lines: (lines || []) as StockCountLine[],
  };
}

// Buscar todas as contagens
export async function getStockCounts(limit = 100): Promise<StockCount[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as StockCount[];
}

// Buscar contagens por status
export async function getStockCountsByStatus(status: StockCount['status']): Promise<StockCount[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as StockCount[];
}

// Estatísticas de contagens
export async function getStockCountStats() {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('status, count_type');

  if (error) throw error;

  const byStatus = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };

  const byType = {
    full: 0,
    cycle: 0,
    spot: 0,
    reconciliation: 0,
  };

  (data || []).forEach((c: any) => {
    byStatus[c.status as keyof typeof byStatus]++;
    byType[c.count_type as keyof typeof byType]++;
  });

  return { byStatus, byType, total: data?.length || 0 };
}

// Buscar linhas de contagem com detalhes
export async function getStockCountLinesWithDetails(countId: string) {
  const { data, error } = await supabase
    .from('stock_count_lines')
    .select(`
      *,
      products (id, sku, name, category),
      locations (id, code, zone)
    `)
    .eq('stock_count_id', countId);

  if (error) throw error;
  return data || [];
}

// Calcular precisão do inventário
export async function getInventoryAccuracy(locationId?: string) {
  let query = supabase
    .from('stock_count_lines')
    .select('system_quantity, counted_quantity');

  if (locationId) {
    query = query.eq('location_id', locationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) {
    return {
      accuracy: 100,
      total_lines: 0,
      accurate_lines: 0,
      discrepancies: 0,
    };
  }

  const accurateLines = data.filter((l: any) => l.system_quantity === l.counted_quantity).length;
  const discrepancies = data.filter((l: any) => l.system_quantity !== l.counted_quantity).length;

  return {
    accuracy: (accurateLines / data.length) * 100,
    total_lines: data.length,
    accurate_lines: accurateLines,
    discrepancies,
  };
}
