import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoLocations, demoProducts, demoStockCountLines, demoStockCounts } from '../demoStore';

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

export type StockCountWithLines = StockCount & { lines: StockCountLine[] };

export async function createStockCount(params: {
  count_type: StockCount['count_type'];
  location_id?: string;
  notes?: string;
}): Promise<StockCount> {
  if (isDemoMode) {
    if (params.count_type !== 'full' && !params.location_id) throw new Error('Selecione uma localização');
    const id = demoId('count');
    const createdAt = new Date().toISOString();
    const count: StockCount = {
      id,
      count_number: `CNT-DEMO-${String(demoStockCounts.length + 22).padStart(4, '0')}`,
      count_type: params.count_type,
      status: 'pending',
      location_id: params.location_id,
      notes: params.notes,
      created_at: createdAt,
      created_by: 'demo-user-id',
    };
    const targets = params.count_type === 'full'
      ? demoLocations.filter((l) => l.location_type === 'storage' || l.location_type === 'picking')
      : demoLocations.filter((l) => l.id === params.location_id);
    const productLocationMap: Record<string, string> = {
      'demo-p1': 'demo-l1', 'demo-p2': 'demo-l2', 'demo-p3': 'demo-l3', 'demo-p4': 'demo-l4', 'demo-p5': 'demo-l5',
    };
    for (const product of demoProducts.filter((p) => p.active)) {
      const locationId = productLocationMap[product.id];
      if (!locationId || !targets.some((l) => l.id === locationId)) continue;
      demoStockCountLines.push({
        id: demoId('count-line'), stock_count_id: id, product_id: product.id, location_id: locationId,
        system_quantity: product.total_stock, counted_quantity: product.total_stock, difference: 0, created_at: createdAt,
      });
    }
    demoStockCounts.unshift(count);
    return { ...count };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data: countId, error } = await supabase.rpc('create_stock_count_with_snapshot', {
    p_count_type: params.count_type,
    p_location_id: params.location_id || null,
    p_notes: params.notes || null,
  });
  if (error) throw new Error(`Erro ao criar contagem: ${error.message}`);
  if (!countId) throw new Error('Banco não retornou o ID da contagem');
  const count = await getStockCountById(countId as string);
  if (!count) throw new Error('Contagem criada, mas não pôde ser recarregada');
  return count;
}

export async function addStockCountLine(line: {
  stock_count_id: string;
  product_id: string;
  location_id: string;
}): Promise<StockCountLine> {
  if (isDemoMode) {
    const product = demoProducts.find((p) => p.id === line.product_id);
    const systemQuantity = product?.total_stock ?? 0;
    const created: StockCountLine = {
      id: demoId('count-line'), ...line, system_quantity: systemQuantity,
      counted_quantity: systemQuantity, difference: 0, created_at: new Date().toISOString(),
    };
    demoStockCountLines.push(created);
    return { ...created };
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data: balanceData, error: balanceError } = await supabase.from('stock_balances').select('quantity').eq('product_id', line.product_id).eq('location_id', line.location_id).maybeSingle();
  if (balanceError) throw new Error(`Erro ao buscar saldo: ${balanceError.message}`);
  const systemQuantity = Number(balanceData?.quantity ?? 0);
  const { data, error } = await supabase.from('stock_count_lines').insert([{ ...line, system_quantity: systemQuantity, counted_quantity: systemQuantity }]).select().single();
  if (error) throw new Error(`Erro ao adicionar linha: ${error.message}`);
  return data as StockCountLine;
}

export async function updateCountedQuantity(lineId: string, countedQuantity: number, notes?: string): Promise<void> {
  if (!Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error('Quantidade contada não pode ser negativa');
  if (isDemoMode) {
    const line = demoStockCountLines.find((l) => l.id === lineId);
    if (!line) throw new Error('Linha não encontrada');
    line.counted_quantity = countedQuantity;
    line.difference = countedQuantity - line.system_quantity;
    line.notes = notes;
    line.counted_at = new Date().toISOString();
    return;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.from('stock_count_lines').update({ counted_quantity: countedQuantity, notes, counted_at: new Date().toISOString() }).eq('id', lineId);
  if (error) throw new Error(`Erro ao atualizar quantidade: ${error.message}`);
}

export async function startStockCount(countId: string): Promise<void> {
  if (isDemoMode) {
    const count = demoStockCounts.find((c) => c.id === countId);
    if (!count) throw new Error('Contagem não encontrada');
    if (count.status === 'pending') {
      count.status = 'in_progress';
      count.operator_id = 'demo-user-id';
    }
    return;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.from('stock_counts').update({ status: 'in_progress' }).eq('id', countId).eq('status', 'pending');
  if (error) throw new Error(`Erro ao iniciar contagem: ${error.message}`);
}

export async function completeStockCount(countId: string): Promise<{ adjustments: number; discrepancies: number }> {
  if (isDemoMode) {
    const count = demoStockCounts.find((c) => c.id === countId);
    if (!count) throw new Error('Contagem não encontrada');
    if (count.status !== 'in_progress' && count.status !== 'pending') throw new Error('Contagem não está aberta');
    const lines = demoStockCountLines.filter((l) => l.stock_count_id === countId);
    let discrepancies = 0;
    for (const line of lines) {
      line.difference = Number(line.counted_quantity) - Number(line.system_quantity);
      if (line.difference !== 0) {
        discrepancies++;
        const product = demoProducts.find((p) => p.id === line.product_id);
        if (product) product.total_stock = Math.max(0, product.total_stock + line.difference);
      }
      line.counted_at ||= new Date().toISOString();
    }
    count.status = 'completed';
    count.completed_at = new Date().toISOString();
    count.operator_id = 'demo-user-id';
    return { adjustments: discrepancies, discrepancies };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.rpc('process_stock_count_adjustments', { p_count_id: countId });
  if (error) throw new Error(`Erro ao concluir contagem: ${error.message}`);
  const { data: lines, error: linesError } = await supabase.from('stock_count_lines').select('difference').eq('stock_count_id', countId);
  if (linesError) throw new Error(`Erro ao buscar linhas: ${linesError.message}`);
  const discrepancies = (lines || []).filter((line) => Number(line.difference) !== 0).length;
  return { adjustments: discrepancies, discrepancies };
}

export async function cancelStockCount(countId: string): Promise<void> {
  if (isDemoMode) {
    const count = demoStockCounts.find((c) => c.id === countId);
    if (!count) throw new Error('Contagem não encontrada');
    if (count.status === 'pending' || count.status === 'in_progress') count.status = 'cancelled';
    return;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.from('stock_counts').update({ status: 'cancelled' }).eq('id', countId).in('status', ['pending', 'in_progress']);
  if (error) throw new Error(`Erro ao cancelar contagem: ${error.message}`);
}

export async function getStockCountById(id: string): Promise<StockCountWithLines | null> {
  if (isDemoMode) {
    const count = demoStockCounts.find((c) => c.id === id);
    if (!count) return null;
    return { ...count, lines: demoStockCountLines.filter((l) => l.stock_count_id === id).map((l) => ({ ...l })) };
  }
  if (!isSupabaseConfigured) return null;
  const { data: count, error: countError } = await supabase.from('stock_counts').select('*').eq('id', id).single();
  if (countError) {
    if (countError.code === 'PGRST116') return null;
    throw new Error(`Erro ao buscar contagem: ${countError.message}`);
  }
  const { data: lines, error: linesError } = await supabase.from('stock_count_lines').select('*').eq('stock_count_id', id).order('created_at');
  if (linesError) throw new Error(`Erro ao buscar linhas: ${linesError.message}`);
  return { ...(count as StockCount), lines: (lines || []) as StockCountLine[] };
}

export async function getStockCounts(limit = 100): Promise<StockCount[]> {
  if (isDemoMode) return demoStockCounts.slice(0, limit).map((c) => ({ ...c }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('stock_counts').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`Erro ao buscar contagens: ${error.message}`);
  return (data || []) as StockCount[];
}

export async function getStockCountsByStatus(status: StockCount['status']): Promise<StockCount[]> {
  if (isDemoMode) return demoStockCounts.filter((c) => c.status === status).map((c) => ({ ...c }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('stock_counts').select('*').eq('status', status).order('created_at', { ascending: false });
  if (error) throw new Error(`Erro ao buscar contagens: ${error.message}`);
  return (data || []) as StockCount[];
}

export async function getStockCountStats() {
  const source = isDemoMode ? demoStockCounts : null;
  if (!isSupabaseConfigured && !isDemoMode) {
    return { byStatus: { pending: 0, in_progress: 0, completed: 0, cancelled: 0 }, byType: { full: 0, cycle: 0, spot: 0, reconciliation: 0 }, total: 0 };
  }
  let data: Array<{ status: string; count_type: string }> = source || [];
  if (!isDemoMode) {
    const result = await supabase.from('stock_counts').select('status, count_type');
    if (result.error) throw new Error(`Erro ao buscar estatísticas: ${result.error.message}`);
    data = result.data || [];
  }
  const byStatus = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
  const byType = { full: 0, cycle: 0, spot: 0, reconciliation: 0 };
  for (const count of data) {
    byStatus[count.status as keyof typeof byStatus]++;
    byType[count.count_type as keyof typeof byType]++;
  }
  return { byStatus, byType, total: data.length };
}

export async function getStockCountLinesWithDetails(countId: string) {
  if (isDemoMode) {
    return demoStockCountLines.filter((l) => l.stock_count_id === countId).map((line) => ({
      ...line,
      products: demoProducts.find((p) => p.id === line.product_id) || null,
      locations: demoLocations.find((l) => l.id === line.location_id) || null,
    }));
  }
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('stock_count_lines').select(`*, products (id, sku, name, category), locations (id, code, zone)`).eq('stock_count_id', countId).order('created_at');
  if (error) throw new Error(`Erro ao buscar linhas: ${error.message}`);
  return data || [];
}

export async function getInventoryAccuracy(locationId?: string) {
  if (isDemoMode) {
    const data = demoStockCountLines.filter((line) => !locationId || line.location_id === locationId);
    if (data.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
    const accurateLines = data.filter((line) => Number(line.system_quantity) === Number(line.counted_quantity)).length;
    return { accuracy: (accurateLines / data.length) * 100, total_lines: data.length, accurate_lines: accurateLines, discrepancies: data.length - accurateLines };
  }
  if (!isSupabaseConfigured) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
  let query = supabase.from('stock_count_lines').select('system_quantity, counted_quantity');
  if (locationId) query = query.eq('location_id', locationId);
  const { data, error } = await query;
  if (error) throw new Error(`Erro ao calcular precisão: ${error.message}`);
  if (!data || data.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
  const accurateLines = data.filter((line) => Number(line.system_quantity) === Number(line.counted_quantity)).length;
  return { accuracy: (accurateLines / data.length) * 100, total_lines: data.length, accurate_lines: accurateLines, discrepancies: data.length - accurateLines };
}
