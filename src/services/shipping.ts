import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoProducts, demoShipmentLines, demoShipments } from '../demoStore';
import type { DBShipment, DBShipmentLine, ShipmentWithLines } from '../types';

export type Shipment = DBShipment;
export type { ShipmentWithLines };

export type CreateShipmentLineInput = {
  product_id: string;
  requested_quantity: number;
  from_location_id: string;
  unit?: string;
  notes?: string;
};

export type CreateShipmentInput = {
  customer_name: string;
  customer_reference?: string;
  carrier?: string;
  priority?: DBShipment['priority'];
  expected_date?: string;
  notes?: string;
  lines: CreateShipmentLineInput[];
};

export async function getShipments(limit = 100): Promise<DBShipment[]> {
  if (isDemoMode) return demoShipments.slice(0, limit).map((shipment) => ({ ...shipment }));
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getShipmentById(id: string): Promise<ShipmentWithLines | null> {
  if (isDemoMode) {
    const shipment = demoShipments.find((item) => item.id === id);
    if (!shipment) return null;
    return {
      ...shipment,
      lines: demoShipmentLines.filter((line) => line.shipment_id === id).map((line) => ({ ...line })),
    };
  }

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

export async function createShipmentWithLines(input: CreateShipmentInput): Promise<DBShipment> {
  if (!input.customer_name.trim()) throw new Error('Cliente é obrigatório');
  if (input.lines.length === 0) throw new Error('Adicione ao menos um item');
  if (input.lines.some((line) => !Number.isFinite(line.requested_quantity) || line.requested_quantity <= 0)) {
    throw new Error('Todas as quantidades solicitadas devem ser maiores que zero');
  }

  if (isDemoMode) {
    const id = demoId('shipment');
    const createdAt = new Date().toISOString();
    const shipment: DBShipment = {
      id,
      shipment_number: `EXP-DEMO-${String(demoShipments.length + 44).padStart(4, '0')}`,
      customer_name: input.customer_name.trim(),
      customer_reference: input.customer_reference,
      carrier: input.carrier,
      priority: input.priority || 'medium',
      expected_date: input.expected_date,
      status: 'pending',
      notes: input.notes,
      created_at: createdAt,
      created_by: 'demo-user-id',
    };

    const lines: DBShipmentLine[] = input.lines.map((line) => ({
      id: demoId('shipment-line'),
      shipment_id: id,
      product_id: line.product_id,
      requested_quantity: line.requested_quantity,
      picked_quantity: 0,
      from_location_id: line.from_location_id,
      unit: line.unit || 'un',
      notes: line.notes,
      reservations_released: false,
      created_at: createdAt,
      updated_at: createdAt,
    }));

    demoShipments.unshift(shipment);
    demoShipmentLines.push(...lines);
    return { ...shipment };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data: shipmentId, error } = await supabase.rpc('create_shipment_with_lines', {
    p_customer_name: input.customer_name,
    p_customer_reference: input.customer_reference || null,
    p_carrier: input.carrier || null,
    p_priority: input.priority || 'medium',
    p_expected_date: input.expected_date || null,
    p_notes: input.notes || null,
    p_lines: input.lines,
  });

  if (error) throw error;
  if (!shipmentId) throw new Error('Banco não retornou o ID da expedição');

  const shipment = await getShipmentById(shipmentId as string);
  if (!shipment) throw new Error('Expedição criada, mas não pôde ser recarregada');
  return shipment;
}

export async function startPicking(shipmentId: string): Promise<void> {
  if (isDemoMode) {
    const shipment = demoShipments.find((item) => item.id === shipmentId);
    if (!shipment) throw new Error('Expedição não encontrada');
    if (shipment.status !== 'pending') {
      throw new Error(`Expedição não pode iniciar picking no status ${shipment.status}`);
    }

    const lines = demoShipmentLines.filter((line) => line.shipment_id === shipmentId);
    for (const line of lines) {
      const product = demoProducts.find((item) => item.id === line.product_id);
      if (!product || product.total_stock < Number(line.requested_quantity)) {
        throw new Error(`Estoque insuficiente para ${product?.name || line.product_id}`);
      }
    }

    shipment.status = 'picking';
    shipment.operator_id = 'demo-user-id';
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.rpc('reserve_stock_for_shipment', { p_shipment_id: shipmentId });
  if (error) throw new Error(`Falha ao iniciar separação: ${error.message}`);
}

export async function confirmPickedQuantity(lineId: string, pickedQuantity: number): Promise<void> {
  if (pickedQuantity < 0) throw new Error('Quantidade separada não pode ser negativa');

  if (isDemoMode) {
    const line = demoShipmentLines.find((item) => item.id === lineId);
    if (!line) throw new Error('Linha não encontrada');
    if (pickedQuantity > Number(line.requested_quantity)) {
      throw new Error('Quantidade separada excede a solicitada');
    }
    line.picked_quantity = pickedQuantity;
    line.updated_at = new Date().toISOString();
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase
    .from('shipment_lines')
    .update({ picked_quantity: pickedQuantity, updated_at: new Date().toISOString() })
    .eq('id', lineId);

  if (error) throw error;
}

export async function confirmPacked(shipmentId: string): Promise<void> {
  if (isDemoMode) {
    const shipment = demoShipments.find((item) => item.id === shipmentId);
    if (!shipment) throw new Error('Expedição não encontrada');
    if (shipment.status !== 'picking') throw new Error('Expedição não está em separação');

    const lines = demoShipmentLines.filter((line) => line.shipment_id === shipmentId);
    if (lines.length === 0 || lines.some((line) => Number(line.picked_quantity) <= 0)) {
      throw new Error('Confirme ao menos uma quantidade separada em todas as linhas');
    }

    for (const line of lines) {
      const product = demoProducts.find((item) => item.id === line.product_id);
      if (product) product.total_stock = Math.max(0, product.total_stock - Number(line.picked_quantity));
      line.reservations_released = true;
    }

    shipment.status = 'packed';
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.rpc('confirm_shipment_picked', { p_shipment_id: shipmentId });
  if (error) throw new Error(`Falha ao confirmar embalagem: ${error.message}`);
}

export async function confirmShipped(shipmentId: string): Promise<void> {
  if (isDemoMode) {
    const shipment = demoShipments.find((item) => item.id === shipmentId);
    if (!shipment) throw new Error('Expedição não encontrada');
    if (shipment.status !== 'packed') throw new Error('Expedição não está embalada');

    shipment.status = 'shipped';
    shipment.actual_date = new Date().toISOString();
    shipment.completed_at = new Date().toISOString();
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');
  if (shipment.status !== 'packed') throw new Error('Expedição não está embalada');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'shipped', actual_date: now, completed_at: now })
    .eq('id', shipmentId)
    .eq('status', 'packed');

  if (error) throw error;
}

export async function cancelShipment(shipmentId: string): Promise<void> {
  if (isDemoMode) {
    const shipment = demoShipments.find((item) => item.id === shipmentId);
    if (!shipment) throw new Error('Expedição não encontrada');
    if (shipment.status !== 'pending' && shipment.status !== 'picking') {
      throw new Error(`Expedição não pode ser cancelada no status ${shipment.status}`);
    }

    demoShipmentLines
      .filter((line) => line.shipment_id === shipmentId)
      .forEach((line) => {
        line.reservations_released = true;
      });
    shipment.status = 'cancelled';
    return;
  }

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
