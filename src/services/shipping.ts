import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DBShipment, DBShipmentLine, ShipmentWithLines } from '../types';

// Buscar todas as expedições
export async function getShipments(limit = 100): Promise<DBShipment[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Buscar expedição por ID com linhas
export async function getShipmentById(id: string): Promise<ShipmentWithLines | null> {
  if (!isSupabaseConfigured) return null;
  
  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', id)
    .single();

  if (shipmentError) throw shipmentError;
  if (!shipment) return null;

  const { data: lines, error: linesError } = await supabase
    .from('shipment_lines')
    .select('*')
    .eq('shipment_id', id);

  if (linesError) throw linesError;

  return {
    ...shipment,
    lines: lines || [],
  };
}

// Criar nova expedição
export async function createShipment(shipment: {
  customer_name: string;
  customer_reference?: string;
  carrier?: string;
  priority?: DBShipment['priority'];
  expected_date?: string;
  operator_id?: string;
  notes?: string;
}): Promise<DBShipment> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Gerar número único usando sequência
  const { data: shipmentNumber, error: refError } = await supabase
    .rpc('generate_shipment_number');

  if (refError) throw refError;

  const { data, error } = await supabase
    .from('shipments')
    .insert([{
      ...shipment,
      shipment_number: shipmentNumber,
      priority: shipment.priority || 'medium',
      status: 'pending',
      created_by: shipment.operator_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Adicionar linha à expedição
export async function addShipmentLine(line: {
  shipment_id: string;
  product_id: string;
  requested_quantity: number;
  from_location_id?: string;
  unit?: string;
  notes?: string;
}): Promise<DBShipmentLine> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { data, error } = await supabase
    .from('shipment_lines')
    .insert([{
      ...line,
      picked_quantity: 0,
      unit: line.unit || 'un',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// CORREÇÃO CRÍTICA: Iniciar separação usando função atômica
// Reserva todas as linhas de uma vez - se uma falhar, nenhuma é reservada
export async function startPicking(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Usar função SQL atômica que reserva todas as linhas de uma vez
  const { error } = await supabase.rpc('reserve_stock_for_shipment', {
    p_shipment_id: shipmentId,
  });

  // CORREÇÃO: Verificar explicitamente o erro retornado
  if (error) {
    throw new Error(`Falha ao iniciar separação: ${error.message}`);
  }
}

// Confirmar quantidade separada
export async function confirmPickedQuantity(
  lineId: string,
  pickedQuantity: number
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('shipment_lines')
    .update({
      picked_quantity: pickedQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

// CORREÇÃO CRÍTICA: Confirmar embalagem usando função atômica
// Debita estoque e libera reservas de forma consistente
export async function confirmPacked(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Usar função SQL atômica
  const { error } = await supabase.rpc('confirm_shipment_picked', {
    p_shipment_id: shipmentId,
  });

  if (error) {
    throw new Error(`Falha ao confirmar embalagem: ${error.message}`);
  }
}

// Confirmar despacho
export async function confirmShipped(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');

  if (shipment.status !== 'packed') {
    throw new Error('Expedição não está embalada');
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      status: 'shipped',
      actual_date: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  if (error) throw error;
}

// Cancelar expedição - libera reservas se necessário
export async function cancelShipment(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');

  // Se estava em picking, liberar reservas
  if (shipment.status === 'picking') {
    const { error } = await supabase.rpc('release_shipment_reservations', {
      p_shipment_id: shipmentId,
    });

    if (error) {
      throw new Error(`Falha ao liberar reservas: ${error.message}`);
    }
  }

  // Atualizar status
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'cancelled' })
    .eq('id', shipmentId);

  if (error) throw error;
}
