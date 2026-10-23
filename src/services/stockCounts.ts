import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  counted_at?: string;
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
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { data: countNumber, error: refError } = await supabase
    .rpc('generate_count_number');

  if (refError) throw new Error(`Erro ao gerar número: ${refError.message}`);

  const { data, error } = await supabase
    .from('stock_counts')
    .insert([{
      ...params,
      count_number: countNumber as string,
      status: 'pending',
      created_by: params.operator_id,
    }])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar contagem: ${error.message}`);
  return data as StockCount;
}

// Adicionar linha à contagem
export async function addStockCountLine(line: {
  stock_count_id: string;
  product_id: string;
  location_id: string;
}): Promise<StockCountLine> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Buscar quantidade do sistema
  const { data: balanceData, error: balanceError } = await supabase
    .from('stock_balances')
    .select('quantity')
    .eq('product_id', line.product_id)
    .eq('location_id', line.location_id)
    .maybeSingle();

  if (balanceError && balanceError.code !== 'PGRST116') {
    throw new Error(`Erro ao buscar saldo: ${balanceError.message}`);
  }

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

  if (error) throw new Error(`Erro ao adicionar linha: ${error.message}`);
  return data as StockCountLine;
}

// Atualizar quantidade contada
export async function updateCountedQuantity(
  lineId: string,
  countedQuantity: number,
  notes?: string
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  if (countedQuantity < 0) {
    throw new Error('Quantidade contada não pode ser negativa');
  }
  
  const { error } = await supabase
    .from('stock_count_lines')
    .update({
      counted_quantity: countedQuantity,
      notes,
      counted_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw new Error(`Erro ao atualizar quantidade: ${error.message}`);
}

// Iniciar contagem
export async function startStockCount(countId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('stock_counts')
    .update({ status: 'in_progress' })
    .eq('id', countId)
    .eq('status', 'pending'); // Só pode iniciar se estiver pendente

  if (error) throw new Error(`Erro ao iniciar contagem: ${error.message}`);
}

// CORREÇÃO: Concluir contagem usando função SQL atômica
// Não cria movimentações manualmente - a função SQL faz isso
export async function completeStockCount(countId: string): Promise<{
  adjustments: number;
}> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Usar função SQL atômica que:
  // 1. Valida status da contagem
  // 2. Cria movimentações de ajuste com reference obrigatório
  // 3. Atualiza estoque
  // 4. Finaliza a contagem
  const { error } = await supabase.rpc('process_stock_count_adjustments', {
    p_count_id: countId,
  });

  if (error) {
    throw new Error(`Erro ao concluir contagem: ${error.message}`);
  }
  
  // Contar quantos ajustes foram feitos
  const { data: lines, error: linesError } = await supabase
    .from('stock_count_lines')
    .select('difference')
    .eq('stock_count_id', countId);
    
  if (linesError) {
    throw new Error(`Erro ao buscar linhas: ${linesError.message}`);
  }
  
  const adjustments = lines?.filter(l => l.difference !== 0).length || 0;
  
  return { adjustments };
}

// Cancelar contagem
export async function cancelStockCount(countId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('stock_counts')
    .update({ status: 'cancelled' })
    .eq('id', countId)
    .in('status', ['pending', 'in_progress']); // Só pode cancelar se não estiver concluída

  if (error) throw new Error(`Erro ao cancelar contagem: ${error.message}`);
}

// Buscar contagem por ID com linhas
export async function getStockCountById(id: string): Promise<StockCountWithLines | null> {
  if (!isSupabaseConfigured) return null;
  
  const { data: count, error: countError } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('id', id)
    .single();

  if (countError) {
    if (countError.code === 'PGRST116') return null;
    throw new Error(`Erro ao buscar contagem: ${countError.message}`);
  }
  if (!count) return null;

  const { data: lines, error: linesError } = await supabase
    .from('stock_count_lines')
    .select('*')
    .eq('stock_count_id', id);

  if (linesError) throw new Error(`Erro ao buscar linhas: ${linesError.message}`);

  return {
    ...(count as StockCount),
    lines: (lines || []) as StockCountLine[],
  };
}

// Buscar todas as contagens
export async function getStockCounts(limit = 100): Promise<StockCount[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao buscar contagens: ${error.message}`);
  return (data || []) as StockCount[];
}

// Buscar contagens por status
export async function getStockCountsByStatus(status: StockCount['status']): Promise<StockCount[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Erro ao buscar contagens: ${error.message}`);
  return (data || []) as StockCount[];
}

// Estatísticas de contagens
export async function getStockCountStats() {
  if (!isSupabaseConfigured) {
    return { byStatus: { pending: 0, in_progress: 0, completed: 0, cancelled: 0 }, byType: { full: 0, cycle: 0, spot: 0, reconciliation: 0 }, total: 0 };
  }
  
  const { data, error } = await supabase
    .from('stock_counts')
    .select('status, count_type');

  if (error) throw new Error(`Erro ao buscar estatísticas: ${error.message}`);

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
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('stock_count_lines')
    .select(`
      *,
      products (id, sku, name, category),
      locations (id, code, zone)
    `)
    .eq('stock_count_id', countId);

  if (error) throw new Error(`Erro ao buscar linhas: ${error.message}`);
  return data || [];
}

// Calcular precisão do inventário
export async function getInventoryAccuracy(locationId?: string) {
  if (!isSupabaseConfigured) {
    return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
  }
  
  let query = supabase
    .from('stock_count_lines')
    .select('system_quantity, counted_quantity');

  if (locationId) {
    query = query.eq('location_id', locationId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Erro ao calcular precisão: ${error.message}`);
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
