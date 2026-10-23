import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DBShipment, DBShipmentLine, ShipmentWithLines } from '../types';

export type Shipment = DBShipment;
export type { ShipmentWithLines };

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

export async function getShipmentsByStatus(
  status: DBShipment['status'],
  limit = 100
): Promise<DBShipment[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getShipmentsByPriority(
  priority: DBShipment['priority'],
  limit = 100
): Promise<DBShipment[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('priority', priority)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getShipmentById(id: string): Promise<ShipmentWithLines | null> {
  if (!isSupabaseConfigured) return null;

  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', id)
    .single();

  if (shipmentError) {
    if (shipmentError.code === 'PGRST116') return null;
    throw shipmentError;
  }
  if (!shipment) return null;

  const { data: lines, error: linesError } = await supabase
    .from('shipment_lines')
    .select('*')
    .eq('shipment_id', id)
    .order('created_at');

  if (linesError) throw linesError;

  return { ...shipment, lines: lines || [] };
}

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

  const { data: shipmentNumber, error: refError } = await supabase.rpc(
    'generate_shipment_number'
  );

  if (refError) throw refError;

  const { data, error } = await supabase
    .from('shipments')
    .insert([
      {
        ...shipment,
        shipment_number: shipmentNumber,
        priority: shipment.priority || 'medium',
        status: 'pending',
        created_by: shipment.operator_id,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addShipmentLine(line: {
  shipment_id: string;
  product_id: string;
  requested_quantity: number;
  from_location_id?: string;
  unit?: string;
  notes?: string;
}): Promise<DBShipmentLine> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  if (line.requested_quantity <= 0) {
    throw new Error('Quantidade solicitada deve ser maior que zero');
  }

  const { data, error } = await supabase
    .from('shipment_lines')
    .insert([
      {
        ...line,
        picked_quantity: 0,
        unit: line.unit || 'un',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function startPicking(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { error } = await supabase.rpc('reserve_stock_for_shipment', {
    p_shipment_id: shipmentId,
  });

  if (error) throw new Error(`Falha ao iniciar separação: ${error.message}`);
}

export async function confirmPickedQuantity(
  lineId: string,
  pickedQuantity: number
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  if (pickedQuantity < 0) throw new Error('Quantidade separada não pode ser negativa');

  const { error } = await supabase
    .from('shipment_lines')
    .update({
      picked_quantity: pickedQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

export async function confirmPacked(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { error } = await supabase.rpc('confirm_shipment_picked', {
    p_shipment_id: shipmentId,
  });

  if (error) throw new Error(`Falha ao confirmar embalagem: ${error.message}`);
}

export async function confirmShipped(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');
  if (shipment.status !== 'packed') throw new Error('Expedição não está embalada');

  const { error } = await supabase
    .from('shipments')
    .update({
      status: 'shipped',
      actual_date: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq('id', shipmentId)
    .eq('status', 'packed');

  if (error) throw error;
}

export async function cancelShipment(shipmentId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');

  if (shipment.status === 'picking') {
    const { error } = await supabase.rpc('release_shipment_reservations', {
      p_shipment_id: shipmentId,
    });

    if (error) throw new Error(`Falha ao liberar reservas: ${error.message}`);
    return;
  }

  if (shipment.status !== 'pending') {
    throw new Error(`Expedição não pode ser cancelada no status ${shipment.status}`);
  }

  const { error } = await supabase
    .from('shipments')
    .update({ status: 'cancelled' })
    .eq('id', shipmentId)
    .eq('status', 'pending');

  if (error) throw error;
}
