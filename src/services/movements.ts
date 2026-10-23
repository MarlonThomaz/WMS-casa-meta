import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DBMovement, MovementWithDetails } from '../types';

export type Movement = DBMovement;
export type MovementWithLines = MovementWithDetails;

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

export async function getMovementsByType(
  type: DBMovement['movement_type'],
  limit = 100
): Promise<DBMovement[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .eq('movement_type', type)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getMovementsByStatus(
  status: DBMovement['status'],
  limit = 100
): Promise<DBMovement[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .eq('status', status)
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

  if (movementError) {
    if (movementError.code === 'PGRST116') return null;
    throw movementError;
  }
  if (!movement) return null;

  const { data: lines, error: linesError } = await supabase
    .from('movement_lines')
    .select('*')
    .eq('movement_id', id)
    .order('created_at');

  if (linesError) throw linesError;
  return { ...movement, lines: lines || [] };
}

export async function createAndProcessMovement(params: {
  movement_type: Exclude<DBMovement['movement_type'], 'count'>;
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
  if (params.lines.length === 0) throw new Error('Movimentação precisa ter ao menos uma linha');

  for (const line of params.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }
  }

  const { data: movementId, error } = await supabase.rpc('create_and_process_movement', {
    p_movement_type: params.movement_type,
    p_source_reference: params.source_reference || null,
    p_notes: params.notes || null,
    p_lines: params.lines,
  });

  if (error) throw error;
  if (!movementId) throw new Error('Banco não retornou o ID da movimentação');

  const result = await getMovementById(movementId as string);
  if (!result) throw new Error('Movimentação criada, mas não pôde ser recarregada');

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
    .eq('id', id)
    .in('status', ['pending', 'in_progress']);

  if (error) throw error;
}
