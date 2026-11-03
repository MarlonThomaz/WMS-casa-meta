import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoProducts, demoReceiptLines, demoReceipts } from '../demoStore';
import type { DBReceipt, DBReceiptLine, ReceiptWithLines } from '../types';

export type Receipt = DBReceipt;
export type { ReceiptWithLines };

export type CreateReceiptLineInput = {
  product_id: string;
  expected_quantity: number;
  location_id?: string;
  unit?: string;
  notes?: string;
};

export type CreateReceiptInput = {
  supplier_name: string;
  supplier_reference?: string;
  expected_date?: string;
  dock?: string;
  notes?: string;
  lines: CreateReceiptLineInput[];
};

export async function getReceipts(limit = 100): Promise<DBReceipt[]> {
  if (isDemoMode) return demoReceipts.slice(0, limit).map((receipt) => ({ ...receipt }));
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getReceiptById(id: string): Promise<ReceiptWithLines | null> {
  if (isDemoMode) {
    const receipt = demoReceipts.find((item) => item.id === id);
    if (!receipt) return null;
    return {
      ...receipt,
      lines: demoReceiptLines.filter((line) => line.receipt_id === id).map((line) => ({ ...line })),
    };
  }

  if (!isSupabaseConfigured) return null;

  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single();

  if (receiptError) {
    if (receiptError.code === 'PGRST116') return null;
    throw receiptError;
  }
  if (!receipt) return null;

  const { data: lines, error: linesError } = await supabase
    .from('receipt_lines')
    .select('*')
    .eq('receipt_id', id)
    .order('created_at');

  if (linesError) throw linesError;
  return { ...receipt, lines: lines || [] };
}

export async function createReceiptWithLines(input: CreateReceiptInput): Promise<DBReceipt> {
  if (!input.supplier_name.trim()) throw new Error('Fornecedor é obrigatório');
  if (input.lines.length === 0) throw new Error('Adicione ao menos um item');
  if (input.lines.some((line) => !Number.isFinite(line.expected_quantity) || line.expected_quantity <= 0)) {
    throw new Error('Todas as quantidades esperadas devem ser maiores que zero');
  }

  if (isDemoMode) {
    const id = demoId('receipt');
    const createdAt = new Date().toISOString();
    const receipt: DBReceipt = {
      id,
      receipt_number: `REC-DEMO-${String(demoReceipts.length + 20).padStart(4, '0')}`,
      supplier_name: input.supplier_name.trim(),
      supplier_reference: input.supplier_reference,
      expected_date: input.expected_date,
      dock: input.dock,
      status: 'pending',
      notes: input.notes,
      created_at: createdAt,
      created_by: 'demo-user-id',
    };

    const lines: DBReceiptLine[] = input.lines.map((line) => ({
      id: demoId('receipt-line'),
      receipt_id: id,
      product_id: line.product_id,
      expected_quantity: line.expected_quantity,
      received_quantity: 0,
      processed_quantity: 0,
      location_id: line.location_id,
      unit: line.unit || 'un',
      notes: line.notes,
      created_at: createdAt,
      updated_at: createdAt,
    }));

    demoReceipts.unshift(receipt);
    demoReceiptLines.push(...lines);
    return { ...receipt };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data: receiptId, error } = await supabase.rpc('create_receipt_with_lines', {
    p_supplier_name: input.supplier_name,
    p_supplier_reference: input.supplier_reference || null,
    p_expected_date: input.expected_date || null,
    p_dock: input.dock || null,
    p_notes: input.notes || null,
    p_lines: input.lines,
  });

  if (error) throw error;
  if (!receiptId) throw new Error('Banco não retornou o ID do recebimento');

  const receipt = await getReceiptById(receiptId as string);
  if (!receipt) throw new Error('Recebimento criado, mas não pôde ser recarregado');
  return receipt;
}

export async function updateReceivedQuantity(lineId: string, receivedQuantity: number): Promise<void> {
  if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0) {
    throw new Error('Quantidade recebida inválida');
  }

  if (isDemoMode) {
    const line = demoReceiptLines.find((item) => item.id === lineId);
    if (!line) throw new Error('Linha não encontrada');
    line.received_quantity = receivedQuantity;
    line.updated_at = new Date().toISOString();
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('receipt_lines')
    .update({ received_quantity: receivedQuantity, updated_at: new Date().toISOString() })
    .eq('id', lineId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Linha de recebimento não encontrada ou não disponível para alteração');
}

export async function confirmReceipt(receiptId: string): Promise<void> {
  if (isDemoMode) {
    const receipt = demoReceipts.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Recebimento não encontrado');
    if (receipt.status === 'cancelled') throw new Error('Recebimento cancelado');

    const lines = demoReceiptLines.filter((line) => line.receipt_id === receiptId);
    for (const line of lines) {
      const delta = Math.max(0, Number(line.received_quantity) - Number(line.processed_quantity || 0));
      if (delta > 0) {
        const product = demoProducts.find((item) => item.id === line.product_id);
        if (product) product.total_stock += delta;
        line.processed_quantity = Number(line.processed_quantity || 0) + delta;
        line.updated_at = new Date().toISOString();
      }
    }

    const allCompleted = lines.length > 0 && lines.every(
      (line) => Number(line.received_quantity) >= Number(line.expected_quantity)
    );
    receipt.status = allCompleted ? 'completed' : 'partial';
    receipt.operator_id = 'demo-user-id';
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { error } = await supabase.rpc('process_receipt_atomically', { p_receipt_id: receiptId });
  if (error) throw error;
}

export async function cancelReceipt(receiptId: string): Promise<void> {
  if (isDemoMode) {
    const receipt = demoReceipts.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Recebimento não encontrado');
    if (receipt.status !== 'pending' && receipt.status !== 'partial') {
      throw new Error(`Recebimento não pode ser cancelado no status ${receipt.status}`);
    }
    receipt.status = 'cancelled';
    return;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const { data, error } = await supabase
    .from('receipts')
    .update({ status: 'cancelled' })
    .eq('id', receiptId)
    .in('status', ['pending', 'partial'])
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Recebimento não está mais aberto; atualize a tela');
}
