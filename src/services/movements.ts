import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoMovementLines, demoMovements, demoProducts } from '../demoStore';
import type { DBMovement, DBMovementLine, MovementWithDetails } from '../types';

export type Movement = DBMovement;
export type MovementWithLines = MovementWithDetails;

export async function getMovements(limit = 100): Promise<DBMovement[]> {
  if (isDemoMode) return demoMovements.slice(0, limit).map((m) => ({ ...m }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getMovementsByType(type: DBMovement['movement_type'], limit = 100): Promise<DBMovement[]> {
  if (isDemoMode) return demoMovements.filter((m) => m.movement_type === type).slice(0, limit).map((m) => ({ ...m }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('movements').select('*').eq('movement_type', type).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getMovementsByStatus(status: DBMovement['status'], limit = 100): Promise<DBMovement[]> {
  if (isDemoMode) return demoMovements.filter((m) => m.status === status).slice(0, limit).map((m) => ({ ...m }));
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('movements').select('*').eq('status', status).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getMovementById(id: string): Promise<MovementWithDetails | null> {
  if (isDemoMode) {
    const movement = demoMovements.find((m) => m.id === id);
    if (!movement) return null;
    return { ...movement, lines: demoMovementLines.filter((l) => l.movement_id === id).map((l) => ({ ...l })) };
  }
  if (!isSupabaseConfigured) return null;
  const { data: movement, error: movementError } = await supabase.from('movements').select('*').eq('id', id).single();
  if (movementError) {
    if (movementError.code === 'PGRST116') return null;
    throw movementError;
  }
  if (!movement) return null;
  const { data: lines, error: linesError } = await supabase.from('movement_lines').select('*').eq('movement_id', id).order('created_at');
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
  if (params.lines.length === 0) throw new Error('Movimentação precisa ter ao menos uma linha');
  for (const line of params.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('Quantidade deve ser maior que zero');
  }

  if (isDemoMode) {
    for (const line of params.lines) {
      const product = demoProducts.find((p) => p.id === line.product_id);
      if (!product) throw new Error('Produto não encontrado');
      const removesStock = params.movement_type === 'outbound' || (params.movement_type === 'adjustment' && !!line.from_location_id && !line.to_location_id);
      if (removesStock && product.total_stock < line.quantity) throw new Error(`Estoque insuficiente para ${product.name}`);
    }

    const id = demoId('movement');
    const createdAt = new Date().toISOString();
    const movement: DBMovement = {
      id,
      reference: `MOV-DEMO-${String(demoMovements.length + 134).padStart(4, '0')}`,
      movement_type: params.movement_type,
      status: 'completed',
      source_reference: params.source_reference,
      notes: params.notes,
      created_at: createdAt,
      completed_at: createdAt,
      created_by: 'demo-user-id',
      operator_id: 'demo-user-id',
    };
    const lines: DBMovementLine[] = params.lines.map((line) => ({
      id: demoId('movement-line'),
      movement_id: id,
      product_id: line.product_id,
      from_location_id: line.from_location_id,
      to_location_id: line.to_location_id,
      quantity: line.quantity,
      unit: line.unit || 'un',
      notes: line.notes,
      created_at: createdAt,
    }));

    for (const line of lines) {
      const product = demoProducts.find((p) => p.id === line.product_id);
      if (!product) continue;
      if (params.movement_type === 'inbound') product.total_stock += Number(line.quantity);
      else if (params.movement_type === 'outbound') product.total_stock -= Number(line.quantity);
      else if (params.movement_type === 'adjustment') {
        if (line.to_location_id && !line.from_location_id) product.total_stock += Number(line.quantity);
        if (line.from_location_id && !line.to_location_id) product.total_stock -= Number(line.quantity);
      }
    }

    demoMovements.unshift(movement);
    demoMovementLines.push(...lines);
    return { ...movement, lines: lines.map((l) => ({ ...l })) };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
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
  if (isDemoMode) {
    const movement = demoMovements.find((m) => m.id === id);
    if (!movement) throw new Error('Movimentação não encontrada');
    if (movement.status !== 'pending' && movement.status !== 'in_progress') throw new Error('Apenas movimentações abertas podem ser canceladas');
    movement.status = 'cancelled';
    movement.notes = reason || 'Movimentação cancelada';
    return;
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.from('movements').update({ status: 'cancelled', notes: reason || 'Movimentação cancelada' }).eq('id', id).in('status', ['pending', 'in_progress']);
  if (error) throw error;
}
