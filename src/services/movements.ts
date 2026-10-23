import { supabase } from '../lib/supabase';

export type Movement = {
  id: string;
  reference: string;
  movement_type: 'inbound' | 'outbound' | 'transfer' | 'adjustment' | 'count';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  operator_id?: string;
  source_reference?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
};

export type MovementLine = {
  id: string;
  movement_id: string;
  product_id: string;
  from_location_id?: string;
  to_location_id?: string;
  quantity: number;
  unit: string;
  notes?: string;
  created_at: string;
};

export type MovementWithLines = Movement & {
  lines: MovementLine[];
};

// Buscar todas as movimentações
export async function getMovements(limit = 100): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Buscar movimentação por ID com linhas
export async function getMovementById(id: string): Promise<MovementWithLines | null> {
  const { data: movement, error: movementError } = await supabase
    .from('movements')
    .select('*')
    .eq('id', id)
    .single();

  if (movementError) throw movementError;
  if (!movement) return null;

  const { data: lines, error: linesError } = await supabase
    .from('movement_lines')
    .select('*')
    .eq('movement_id', id);

  if (linesError) throw linesError;

  return {
    ...movement,
    lines: lines || [],
  };
}

// Buscar movimentação por referência
export async function getMovementByReference(reference: string): Promise<MovementWithLines | null> {
  const { data: movement, error: movementError } = await supabase
    .from('movements')
    .select('*')
    .eq('reference', reference)
    .single();

  if (movementError) {
    if (movementError.code === 'PGRST116') return null;
    throw movementError;
  }
  if (!movement) return null;

  const { data: lines, error: linesError } = await supabase
    .from('movement_lines')
    .select('*')
    .eq('movement_id', movement.id);

  if (linesError) throw linesError;

  return {
    ...movement,
    lines: lines || [],
  };
}

// Buscar movimentações por tipo
export async function getMovementsByType(type: Movement['movement_type']): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .eq('movement_type', type)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Buscar movimentações por status
export async function getMovementsByStatus(status: Movement['status']): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Buscar movimentações de um produto
export async function getMovementsByProduct(productId: string): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('movement_lines')
    .select('movement_id')
    .eq('product_id', productId);

  if (error) throw error;

  const movementIds = [...new Set(data?.map(l => l.movement_id) || [])];
  if (movementIds.length === 0) return [];

  const { data: movements, error: movementsError } = await supabase
    .from('movements')
    .select('*')
    .in('id', movementIds)
    .order('created_at', { ascending: false });

  if (movementsError) throw movementsError;
  return movements || [];
}

// Criar nova movimentação
export async function createMovement(movement: {
  movement_type: Movement['movement_type'];
  operator_id?: string;
  source_reference?: string;
  notes?: string;
}): Promise<Movement> {
  // Gerar referência única
  const { data: reference, error: refError } = await supabase
    .rpc('generate_movement_reference', { p_type: movement.movement_type });

  if (refError) throw refError;

  const { data, error } = await supabase
    .from('movements')
    .insert([{
      ...movement,
      reference,
      status: 'pending',
      created_by: movement.operator_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Adicionar linha à movimentação
export async function addMovementLine(line: {
  movement_id: string;
  product_id: string;
  from_location_id?: string;
  to_location_id?: string;
  quantity: number;
  unit?: string;
  notes?: string;
}): Promise<MovementLine> {
  const { data, error } = await supabase
    .from('movement_lines')
    .insert([{
      ...line,
      unit: line.unit || 'un',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Processar movimentação (executa transação de estoque)
export async function processMovement(movementId: string): Promise<void> {
  // Buscar movimentação e linhas
  const movement = await getMovementById(movementId);
  if (!movement) throw new Error('Movimentação não encontrada');

  if (movement.status !== 'pending') {
    throw new Error('Movimentação já foi processada ou cancelada');
  }

  // Processar cada linha
  for (const line of movement.lines) {
    const { error } = await supabase.rpc('process_stock_movement', {
      p_movement_id: movementId,
      p_product_id: line.product_id,
      p_from_location_id: line.from_location_id,
      p_to_location_id: line.to_location_id,
      p_quantity: line.quantity,
      p_operator_id: movement.operator_id,
    });

    if (error) {
      // Em caso de erro, cancelar movimentação
      await cancelMovement(movementId, `Erro ao processar: ${error.message}`);
      throw error;
    }
  }
}

// Cancelar movimentação
export async function cancelMovement(id: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('movements')
    .update({
      status: 'cancelled',
      notes: reason || 'Movimentação cancelada',
    })
    .eq('id', id);

  if (error) throw error;
}

// Atualizar status da movimentação
export async function updateMovementStatus(
  id: string,
  status: Movement['status']
): Promise<void> {
  const updates: Partial<Movement> = { status };
  
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('movements')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// Criar movimentação completa (cabeçalho + linhas + processar)
export async function createAndProcessMovement(params: {
  movement_type: Movement['movement_type'];
  operator_id?: string;
  source_reference?: string;
  notes?: string;
  lines: Array<{
    product_id: string;
    from_location_id?: string;
    to_location_id?: string;
    quantity: number;
    unit?: string;
    notes?: string;
  }>;
}): Promise<MovementWithLines> {
  // Criar cabeçalho
  const movement = await createMovement({
    movement_type: params.movement_type,
    operator_id: params.operator_id,
    source_reference: params.source_reference,
    notes: params.notes,
  });

  // Adicionar linhas
  for (const line of params.lines) {
    await addMovementLine({
      movement_id: movement.id,
      ...line,
    });
  }

  // Processar movimentação
  await processMovement(movement.id);

  // Retornar movimentação completa
  const result = await getMovementById(movement.id);
  if (!result) throw new Error('Erro ao buscar movimentação após processamento');
  
  return result;
}

// Contar movimentações por tipo
export async function countMovementsByType() {
  const { data, error } = await supabase
    .from('movements')
    .select('movement_type');

  if (error) throw error;

  const counts: Record<string, number> = {};

  data?.forEach(m => {
    counts[m.movement_type] = (counts[m.movement_type] || 0) + 1;
  });

  return counts;
}

// Contar movimentações por status
export async function countMovementsByStatus() {
  const { data, error } = await supabase
    .from('movements')
    .select('status');

  if (error) throw error;

  const counts: Record<string, number> = {};

  data?.forEach(m => {
    counts[m.status] = (counts[m.status] || 0) + 1;
  });

  return counts;
}

// Buscar movimentações recentes
export async function getRecentMovements(limit = 10): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
