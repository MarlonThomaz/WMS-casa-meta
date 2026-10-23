import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DBMovement, DBMovementLine, MovementWithDetails } from '../types';

export async function getMovements(limit = 100): Promise<DBMovement[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getMovementById(id: string): Promise<MovementWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  
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

  return { ...movement, lines: lines || [] };
}

// CORREÇÃO: Criar e processar movimentação de forma atômica
export async function createAndProcessMovement(params: {
  movement_type: DBMovement['movement_type'];
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
}): Promise<MovementWithDetails> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Gerar referência única usando sequência
  const { data: reference, error: refError } = await supabase
    .rpc('generate_movement_reference', { p_type: params.movement_type });

  if (refError) throw refError;

  // Criar cabeçalho da movimentação
  const { data: movement, error: movementError } = await supabase
    .from('movements')
    .insert([{
      reference,
      movement_type: params.movement_type,
      status: 'pending',
      operator_id: params.operator_id,
      source_reference: params.source_reference,
      notes: params.notes,
      created_by: params.operator_id,
    }])
    .select()
    .single();

  if (movementError) throw movementError;

  // Adicionar linhas
  for (const line of params.lines) {
    const { error: lineError } = await supabase
      .from('movement_lines')
      .insert([{
        movement_id: movement.id,
        product_id: line.product_id,
        from_location_id: line.from_location_id,
        to_location_id: line.to_location_id,
        quantity: line.quantity,
        unit: line.unit || 'un',
        notes: line.notes,
      }]);

    if (lineError) throw lineError;
  }

  // Processar movimentação usando função SQL segura (com FOR UPDATE)
  const { error: processError } = await supabase.rpc('process_stock_movement', {
    p_movement_id: movement.id,
    p_operator_id: params.operator_id,
  });

  if (processError) {
    // Cancelar movimentação em caso de falha
    await supabase
      .from('movements')
      .update({ status: 'failed', notes: `Falha: ${processError.message}` })
      .eq('id', movement.id);
    throw processError;
  }

  const result = await getMovementById(movement.id);
  if (!result) throw new Error('Erro ao buscar movimentação após processamento');
  
  return result;
}

export async function cancelMovement(id: string, reason?: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('movements')
    .update({
      status: 'cancelled',
      notes: reason || 'Movimentação cancelada',
    })
    .eq('id', id);

  if (error) throw error;
}
