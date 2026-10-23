import { supabase } from '../lib/supabase';

export type Receipt = {
  id: string;
  receipt_number: string;
  supplier_name: string;
  supplier_reference?: string;
  expected_date?: string;
  actual_date?: string;
  dock?: string;
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  operator_id?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  created_by?: string;
};

export type ReceiptLine = {
  id: string;
  receipt_id: string;
  product_id: string;
  expected_quantity: number;
  received_quantity: number;
  location_id?: string;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type ReceiptWithLines = Receipt & {
  lines: ReceiptLine[];
};

// Buscar todos os recebimentos
export async function getReceipts(limit = 100): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Buscar recebimento por ID com linhas
export async function getReceiptById(id: string): Promise<ReceiptWithLines | null> {
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single();

  if (receiptError) throw receiptError;
  if (!receipt) return null;

  const { data: lines, error: linesError } = await supabase
    .from('receipt_lines')
    .select('*')
    .eq('receipt_id', id);

  if (linesError) throw linesError;

  return {
    ...receipt,
    lines: lines || [],
  };
}

// Buscar recebimentos por status
export async function getReceiptsByStatus(status: Receipt['status']): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Criar novo recebimento
export async function createReceipt(receipt: {
  supplier_name: string;
  supplier_reference?: string;
  expected_date?: string;
  dock?: string;
  operator_id?: string;
  notes?: string;
}): Promise<Receipt> {
  // Gerar número único
  const { data: receiptNumber, error: refError } = await supabase
    .rpc('generate_receipt_number');

  if (refError) throw refError;

  const { data, error } = await supabase
    .from('receipts')
    .insert([{
      ...receipt,
      receipt_number: receiptNumber,
      status: 'pending',
      created_by: receipt.operator_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Adicionar linha ao recebimento
export async function addReceiptLine(line: {
  receipt_id: string;
  product_id: string;
  expected_quantity: number;
  location_id?: string;
  unit?: string;
  notes?: string;
}): Promise<ReceiptLine> {
  const { data, error } = await supabase
    .from('receipt_lines')
    .insert([{
      ...line,
      received_quantity: 0,
      unit: line.unit || 'un',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar quantidade recebida de uma linha
export async function updateReceivedQuantity(
  lineId: string,
  receivedQuantity: number
): Promise<void> {
  const { error } = await supabase
    .from('receipt_lines')
    .update({ 
      received_quantity: receivedQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

// Atualizar localização de uma linha
export async function updateReceiptLineLocation(
  lineId: string,
  locationId: string
): Promise<void> {
  const { error } = await supabase
    .from('receipt_lines')
    .update({ 
      location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

// Confirmar recebimento (processa estoque)
export async function confirmReceipt(receiptId: string): Promise<void> {
  // Buscar recebimento com linhas
  const receipt = await getReceiptById(receiptId);
  if (!receipt) throw new Error('Recebimento não encontrado');

  if (receipt.status === 'completed') {
    throw new Error('Recebimento já foi concluído');
  }

  // Verificar se todas as linhas têm quantidade recebida > 0
  const hasReceivedItems = receipt.lines.some(line => line.received_quantity > 0);
  if (!hasReceivedItems) {
    throw new Error('Nenhum item foi recebido ainda');
  }

  // Processar cada linha com quantidade recebida
  for (const line of receipt.lines) {
    if (line.received_quantity > 0) {
      if (!line.location_id) {
        throw new Error(`Linha do produto ${line.product_id} não tem localização definida`);
      }

      // Criar movimentação de entrada
      const { data: movement, error: movementError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'inbound',
          status: 'pending',
          source_reference: receipt.receipt_number,
          operator_id: receipt.operator_id,
          notes: `Recebimento ${receipt.receipt_number}`,
        }])
        .select()
        .single();

      if (movementError) throw movementError;

      // Adicionar linha da movimentação
      await supabase.from('movement_lines').insert([{
        movement_id: movement.id,
        product_id: line.product_id,
        to_location_id: line.location_id,
        quantity: line.received_quantity,
        unit: line.unit,
      }]);

      // Processar movimentação (atualiza estoque)
      const { error: processError } = await supabase.rpc('process_stock_movement', {
        p_movement_id: movement.id,
        p_product_id: line.product_id,
        p_from_location_id: null,
        p_to_location_id: line.location_id,
        p_quantity: line.received_quantity,
        p_operator_id: receipt.operator_id,
      });

      if (processError) throw processError;
    }
  }

  // Determinar status final
  const allReceived = receipt.lines.every(
    line => line.received_quantity >= line.expected_quantity
  );
  const newStatus = allReceived ? 'completed' : 'partial';

  // Atualizar status do recebimento
  const { error } = await supabase
    .from('receipts')
    .update({
      status: newStatus,
      actual_date: new Date().toISOString(),
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', receiptId);

  if (error) throw error;
}

// Cancelar recebimento
export async function cancelReceipt(receiptId: string): Promise<void> {
  const { error } = await supabase
    .from('receipts')
    .update({
      status: 'cancelled',
    })
    .eq('id', receiptId);

  if (error) throw error;
}

// Contar recebimentos por status
export async function countReceiptsByStatus() {
  const { data, error } = await supabase
    .from('receipts')
    .select('status');

  if (error) throw error;

  const counts = {
    pending: 0,
    partial: 0,
    completed: 0,
    cancelled: 0,
  };

  data?.forEach(r => {
    counts[r.status as keyof typeof counts]++;
  });

  return counts;
}

// Buscar recebimentos recentes
export async function getRecentReceipts(limit = 10): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
