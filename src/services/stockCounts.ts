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
  counted_at?: string | null;
  created_at: string;
};

export type StockCountLineWithDetails = StockCountLine & {
  products?: { id: string; sku: string; name: string; category?: string } | null;
  locations?: { id: string; code: string; zone?: string } | null;
};

export type StockCountListItem = StockCount & { location_code?: string };
export type StockCountPage = { items: StockCountListItem[]; total: number };
export type StockCountLinePage = { items: StockCountLineWithDetails[]; total: number };
export type CountProgress = { total: number; confirmed: number; discrepancies: number };
export const EMPTY_PROGRESS: CountProgress = { total: 0, confirmed: 0, discrepancies: 0 };

export type StockCountStats = {
  byStatus: {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  byType: {
    full: number;
    cycle: number;
    spot: number;
    reconciliation: number;
  };
  total: number;
};

export type InventoryAccuracy = {
  accuracy: number;
  total_lines: number;
  accurate_lines: number;
  discrepancies: number;
};

const EMPTY_ACCURACY: InventoryAccuracy = {
  accuracy: 100,
  total_lines: 0,
  accurate_lines: 0,
  discrepancies: 0,
};

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
      ? demoLocations.filter((location) => location.location_type === 'storage' || location.location_type === 'picking')
      : demoLocations.filter((location) => location.id === params.location_id);

    const productLocationMap: Record<string, string> = {
      'demo-p1': 'demo-l1',
      'demo-p2': 'demo-l2',
      'demo-p3': 'demo-l3',
      'demo-p4': 'demo-l4',
      'demo-p5': 'demo-l5',
    };

    for (const product of demoProducts.filter((item) => item.active)) {
      const locationId = productLocationMap[product.id];
      if (!locationId || !targets.some((location) => location.id === locationId)) continue;
      demoStockCountLines.push({
        id: demoId('count-line'),
        stock_count_id: id,
        product_id: product.id,
        location_id: locationId,
        system_quantity: product.total_stock,
        counted_quantity: product.total_stock,
        difference: 0,
        counted_at: undefined,
        created_at: createdAt,
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

export async function updateCountedQuantity(
  lineId: string,
  countedQuantity: number,
  notes?: string
): Promise<void> {
  if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
    throw new Error('Quantidade contada não pode ser negativa');
  }

  if (isDemoMode) {
    const line = demoStockCountLines.find((item) => item.id === lineId);
    if (!line) throw new Error('Linha não encontrada');
    line.counted_quantity = countedQuantity;
    line.difference = countedQuantity - line.system_quantity;
    if (notes !== undefined) line.notes = notes;
    line.counted_at = new Date().toISOString();
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const payload: { counted_quantity: number; counted_at: string; notes?: string } = {
    counted_quantity: countedQuantity,
    counted_at: new Date().toISOString(),
  };
  if (notes !== undefined) payload.notes = notes;

  const { data, error } = await supabase
    .from('stock_count_lines')
    .update(payload)
    .eq('id', lineId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Erro ao atualizar quantidade: ${error.message}`);
  if (!data) throw new Error('Linha de contagem não encontrada ou não disponível para alteração');
}

export async function startStockCount(countId: string): Promise<void> {
  if (isDemoMode) {
    const count = demoStockCounts.find((item) => item.id === countId);
    if (!count) throw new Error('Contagem não encontrada');
    if (count.status !== 'pending') throw new Error('Contagem não está pendente');
    count.status = 'in_progress';
    count.operator_id = 'demo-user-id';
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('stock_counts')
    .update({ status: 'in_progress' })
    .eq('id', countId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Erro ao iniciar contagem: ${error.message}`);
  if (!data) throw new Error('Contagem não está mais pendente; atualize a tela');
}

export async function completeStockCount(
  countId: string
): Promise<{ adjustments: number | null; discrepancies: number | null }> {
  if (isDemoMode) {
    const count = demoStockCounts.find((item) => item.id === countId);
    if (!count) throw new Error('Contagem não encontrada');
    if (count.status !== 'in_progress') throw new Error('Contagem não está em andamento');

    const lines = demoStockCountLines.filter((line) => line.stock_count_id === countId);
    if (lines.length === 0) throw new Error('Contagem não possui linhas');
    if (lines.some((line) => !line.counted_at)) {
      throw new Error('Confirme fisicamente todas as linhas antes de concluir a contagem');
    }

    let discrepancies = 0;
    for (const line of lines) {
      line.difference = Number(line.counted_quantity) - Number(line.system_quantity);
      if (line.difference !== 0) {
        discrepancies++;
        const product = demoProducts.find((item) => item.id === line.product_id);
        if (product) product.total_stock = Math.max(0, product.total_stock + line.difference);
      }
    }

    count.status = 'completed';
    count.completed_at = new Date().toISOString();
    count.operator_id = 'demo-user-id';
    return { adjustments: discrepancies, discrepancies };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { error } = await supabase.rpc('process_stock_count_adjustments', { p_count_id: countId });
  if (error) throw new Error(`Erro ao concluir contagem: ${error.message}`);

  // The write has committed. A failure to reload statistics must not be reported
  // as a failed stock adjustment or encourage retrying a completed operation.
  try {
    const progress = await getStockCountProgress(countId);
    return { adjustments: progress.discrepancies, discrepancies: progress.discrepancies };
  } catch (error) {
    console.warn('Contagem concluída; não foi possível consultar o resultado:', error);
    return { adjustments: null, discrepancies: null };
  }
}

export async function cancelStockCount(countId: string): Promise<void> {
  if (isDemoMode) {
    const count = demoStockCounts.find((item) => item.id === countId);
    if (!count) throw new Error('Contagem não encontrada');
    if (count.status !== 'pending' && count.status !== 'in_progress') {
      throw new Error('Contagem não pode mais ser cancelada');
    }
    count.status = 'cancelled';
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('stock_counts')
    .update({ status: 'cancelled' })
    .eq('id', countId)
    .in('status', ['pending', 'in_progress'])
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Erro ao cancelar contagem: ${error.message}`);
  if (!data) throw new Error('Contagem não está mais aberta; atualize a tela');
}

export async function getStockCountById(id: string): Promise<StockCount | null> {
  if (isDemoMode) {
    const count = demoStockCounts.find((item) => item.id === id);
    return count ? { ...count } : null;
  }
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('stock_counts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Erro ao buscar contagem: ${error.message}`);
  return data as StockCount | null;
}

export async function getStockCountsPage(page = 1, limit = 50): Promise<StockCountPage> {
  const size = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
  const offset = (Math.max(1, Math.trunc(page) || 1) - 1) * size;
  if (isDemoMode) {
    const sorted = [...demoStockCounts].sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return {
      items: sorted.slice(offset, offset + size).map(count => ({
        ...count, location_code: demoLocations.find(l => l.id === count.location_id)?.code,
      })),
      total: sorted.length,
    };
  }
  if (!isSupabaseConfigured) return { items: [], total: 0 };
  const { data, error, count } = await supabase.from('stock_counts')
    .select('*, locations(code)', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + size - 1);
  if (error) throw new Error(`Erro ao buscar contagens: ${error.message}`);
  if (count === null) throw new Error('Total de contagens indisponível');
  const rows = (data || []) as unknown as Array<StockCount & { locations?: {code:string} | null }>;
  return { items: rows.map(({locations, ...row}) => ({ ...row, location_code: locations?.code })), total: count };
}

export async function getStockCountStats(): Promise<StockCountStats> {
  const byStatus: StockCountStats['byStatus'] = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
  const byType: StockCountStats['byType'] = { full: 0, cycle: 0, spot: 0, reconciliation: 0 };
  if (isDemoMode) {
    for (const row of demoStockCounts) { byStatus[row.status]++; byType[row.count_type]++; }
    return { byStatus, byType, total: demoStockCounts.length };
  }
  if (!isSupabaseConfigured) return { byStatus, byType, total: 0 };
  // Exact count requests return no rows and do not inherit the response row cap.
  const countRows = async (column?: string, value?: string): Promise<number> => {
    let query = supabase.from('stock_counts').select('id', {count:'exact',head:true});
    if (column && value) query = query.eq(column, value);
    const { count, error } = await query;
    if (error || count === null) throw new Error(`Erro ao consultar estatísticas: ${error?.message || 'total indisponível'}`);
    return count;
  };
  const statusKeys = Object.keys(byStatus) as Array<keyof typeof byStatus>;
  const typeKeys = Object.keys(byType) as Array<keyof typeof byType>;
  const [total] = await Promise.all([
    countRows(),
    ...statusKeys.map(async key => { byStatus[key] = await countRows('status', key); }),
    ...typeKeys.map(async key => { byType[key] = await countRows('count_type', key); }),
  ]);
  return { byStatus, byType, total };
}

type CountLineRpc = {
  id: string; stock_count_id: string; product_id: string; location_id: string;
  system_quantity: number | string; counted_quantity: number | string; discrepancy: number | string;
  notes: string | null; counted_at: string | null; created_at: string;
  product_sku: string; product_name: string; location_code: string; total_count: number | string;
};

export function countLineFromRpc(row: CountLineRpc): StockCountLineWithDetails {
  return {
    id: row.id, stock_count_id: row.stock_count_id, product_id: row.product_id,
    location_id: row.location_id, system_quantity: Number(row.system_quantity),
    counted_quantity: Number(row.counted_quantity), difference: Number(row.discrepancy),
    notes: row.notes ?? undefined, counted_at: row.counted_at, created_at: row.created_at,
    products: { id: row.product_id, sku: row.product_sku, name: row.product_name },
    locations: { id: row.location_id, code: row.location_code },
  };
}

export async function getStockCountLinesPage(countId: string, query = '', page = 1, limit = 50): Promise<StockCountLinePage> {
  const size = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
  const offset = (Math.max(1, Math.trunc(page) || 1) - 1) * size;
  const search = query.trim().toLowerCase();
  if (isDemoMode) {
    const rows = demoStockCountLines.filter(line => line.stock_count_id === countId)
      .map(line => ({ ...line,
        products: demoProducts.find(product => product.id === line.product_id) || null,
        locations: demoLocations.find(location => location.id === line.location_id) || null,
      }))
      .filter(line => !search || [line.products?.sku,line.products?.name,line.locations?.code]
        .some(value => value?.toLowerCase().includes(search)))
      .sort((a,b) => (a.locations?.code || '').localeCompare(b.locations?.code || '')
        || (a.products?.sku || '').localeCompare(b.products?.sku || '') || a.id.localeCompare(b.id));
    return {items:rows.slice(offset,offset+size),total:rows.length};
  }
  if (!isSupabaseConfigured) return {items:[],total:0};
  const { data, error } = await supabase.rpc('search_stock_count_lines', {
    p_count_id: countId, p_query: query.trim() || null, p_limit: size, p_offset: offset,
  });
  if (error) throw new Error(`Erro ao buscar linhas: ${error.message}`);
  const rows = (data || []) as CountLineRpc[];
  // An empty out-of-range page has no total_count row: recover the filtered total.
  if (!rows.length && offset > 0) {
    const first = await getStockCountLinesPage(countId, query, 1, size);
    return {items:[],total:first.total};
  }
  return {items:rows.map(countLineFromRpc),total:rows.length ? Number(rows[0].total_count) : 0};
}

export function canCompleteCount(progress: CountProgress | null): boolean {
  return Boolean(progress && progress.total > 0 && progress.confirmed === progress.total);
}

export async function getStockCountProgress(countId: string): Promise<CountProgress> {
  if (isDemoMode) {
    const lines = demoStockCountLines.filter(line => line.stock_count_id === countId);
    const confirmed = lines.filter(line => Boolean(line.counted_at));
    return {total: lines.length, confirmed: confirmed.length,
      discrepancies:confirmed.filter(line => Number(line.counted_quantity) !== Number(line.system_quantity)).length};
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc('get_stock_count_progress', {p_count_id:countId});
  const row = data?.[0];
  if (error || !row) throw new Error(`Erro ao consultar progresso: ${error?.message || 'sem resultado'}`);
  return {total:Number(row.total_lines), confirmed:Number(row.confirmed_lines), discrepancies:Number(row.discrepancy_lines)};
}

export async function getInventoryAccuracy(locationId?: string): Promise<InventoryAccuracy> {
  if (isDemoMode) {
    const completedIds = new Set(
      demoStockCounts.filter((count) => count.status === 'completed').map((count) => count.id)
    );
    const data = demoStockCountLines.filter(
      (line) => completedIds.has(line.stock_count_id) && (!locationId || line.location_id === locationId)
    );

    if (data.length === 0) return { ...EMPTY_ACCURACY };

    const accurateLines = data.filter(
      (line) => Number(line.system_quantity) === Number(line.counted_quantity)
    ).length;

    return {
      accuracy: (accurateLines / data.length) * 100,
      total_lines: data.length,
      accurate_lines: accurateLines,
      discrepancies: data.length - accurateLines,
    };
  }

  if (!isSupabaseConfigured) return { ...EMPTY_ACCURACY };

  const { data, error } = await supabase.rpc('get_inventory_accuracy', {
    p_location_id: locationId || null,
  });

  if (error) throw new Error(`Erro ao calcular precisão: ${error.message}`);

  const row = (data as Array<{
    accuracy?: number | string;
    total_lines?: number | string;
    accurate_lines?: number | string;
    discrepancies?: number | string;
  }> | null)?.[0];

  if (!row) return { ...EMPTY_ACCURACY };

  return {
    accuracy: Number(row.accuracy ?? 100),
    total_lines: Number(row.total_lines ?? 0),
    accurate_lines: Number(row.accurate_lines ?? 0),
    discrepancies: Number(row.discrepancies ?? 0),
  };
}
