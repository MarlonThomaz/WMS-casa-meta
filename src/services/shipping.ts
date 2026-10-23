import { supabase } from '../lib/supabase';

export type Shipment = {
  id: string;
  shipment_number: string;
  customer_name: string;
  customer_reference?: string;
  carrier?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expected_date?: string;
  actual_date?: string;
  status: 'pending' | 'picking' | 'packed' | 'shipped' | 'cancelled';
  operator_id?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
};

export type ShipmentLine = {
  id: string;
  shipment_id: string;
  product_id: string;
  requested_quantity: number;
  picked_quantity: number;
  from_location_id?: string;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type ShipmentWithLines = Shipment & {
  lines: ShipmentLine[];
};

// Buscar todas as expedições
export async function getShipments(limit = 100): Promise<Shipment[]> {
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

// Buscar expedições por status
export async function getShipmentsByStatus(status: Shipment['status']): Promise<Shipment[]> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Buscar expedições por prioridade
export async function getShipmentsByPriority(priority: Shipment['priority']): Promise<Shipment[]> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('priority', priority)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Criar nova expedição
export async function createShipment(shipment: {
  customer_name: string;
  customer_reference?: string;
  carrier?: string;
  priority?: Shipment['priority'];
  expected_date?: string;
  operator_id?: string;
  notes?: string;
}): Promise<Shipment> {
  // Gerar número único
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
}): Promise<ShipmentLine> {
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

// Iniciar separação (picking)
export async function startPicking(shipmentId: string): Promise<void> {
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrida');

  if (shipment.status !== 'pending') {
    throw new Error('Expedição não está pendente');
  }

  // Reservar estoque para cada linha
  for (const line of shipment.lines) {
    if (line.from_location_id) {
      try {
        await supabase.rpc('reserve_stock', {
          p_product_id: line.product_id,
          p_location_id: line.from_location_id,
          p_quantity: line.requested_quantity,
        });
      } catch (error) {
        // Se falhar, cancelar reservas anteriores
        throw new Error(`Estoque insuficiente para produto ${line.product_id}`);
      }
    }
  }

  // Atualizar status
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'picking' })
    .eq('id', shipmentId);

  if (error) throw error;
}

// Confirmar quantidade separada
export async function confirmPickedQuantity(
  lineId: string,
  pickedQuantity: number
): Promise<void> {
  const { error } = await supabase
    .from('shipment_lines')
    .update({
      picked_quantity: pickedQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

// Confirmar embalagem (packed)
export async function confirmPacked(shipmentId: string): Promise<void> {
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');

  if (shipment.status !== 'picking') {
    throw new Error('Expedição não está em separação');
  }

  // Confirmar estoque separado para cada linha
  for (const line of shipment.lines) {
    if (line.from_location_id && line.picked_quantity > 0) {
      await supabase.rpc('confirm_picked_stock', {
        p_product_id: line.product_id,
        p_location_id: line.from_location_id,
        p_quantity: line.picked_quantity,
      });

      // Criar movimentação de saída
      const { data: movement, error: movementError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'outbound',
          status: 'completed',
          source_reference: shipment.shipment_number,
          operator_id: shipment.operator_id,
          notes: `Expedição ${shipment.shipment_number}`,
          completed_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (movementError) throw movementError;

      // Adicionar linha da movimentação
      await supabase.from('movement_lines').insert([{
        movement_id: movement.id,
        product_id: line.product_id,
        from_location_id: line.from_location_id,
        quantity: line.picked_quantity,
        unit: line.unit,
      }]);
    }
  }

  // Atualizar status
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'packed' })
    .eq('id', shipmentId);

  if (error) throw error;
}

// Confirmar despacho (shipped)
export async function confirmShipped(shipmentId: string): Promise<void> {
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');

  if (shipment.status !== 'packed') {
    throw new Error('Expedição não está embalada');
  }

  // Atualizar status
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

// Cancelar expedição
export async function cancelShipment(shipmentId: string): Promise<void> {
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) throw new Error('Expedição não encontrada');

  // Se estava em picking, liberar reservas
  if (shipment.status === 'picking') {
    for (const line of shipment.lines) {
      if (line.from_location_id) {
        await supabase.rpc('release_reservation', {
          p_product_id: line.product_id,
          p_location_id: line.from_location_id,
          p_quantity: line.requested_quantity,
        });
      }
    }
  }

  // Atualizar status
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'cancelled' })
    .eq('id', shipmentId);

  if (error) throw error;
}

// Contar expedições por status
export async function countShipmentsByStatus() {
  const { data, error } = await supabase
    .from('shipments')
    .select('status');

  if (error) throw error;

  const counts = {
    pending: 0,
    picking: 0,
    packed: 0,
    shipped: 0,
    cancelled: 0,
  };

  data?.forEach(s => {
    counts[s.status as keyof typeof counts]++;
  });

  return counts;
}

// Contar expedições por prioridade
export async function countShipmentsByPriority() {
  const { data, error } = await supabase
    .from('shipments')
    .select('priority');

  if (error) throw error;

  const counts = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  data?.forEach(s => {
    counts[s.priority as keyof typeof counts]++;
  });

  return counts;
}

// Buscar expedições recentes
export async function getRecentShipments(limit = 10): Promise<Shipment[]> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
