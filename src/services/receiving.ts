import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DBReceipt, DBReceiptLine, ReceiptWithLines } from '../types';

// Buscar todos os recebimentos
export async function getReceipts(limit = 100): Promise<DBReceipt[]> {
  if (!isSupabaseConfigured) return [];
  
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
  if (!isSupabaseConfigured) return null;
  
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

// Criar novo recebimento
export async function createReceipt(receipt: {
  supplier_name: string;
  supplier_reference?: string;
  expected_date?: string;
  dock?: string;
  operator_id?: string;
  notes?: string;
}): Promise<DBReceipt> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Gerar número único usando sequência
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
}): Promise<DBReceiptLine> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
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
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('receipt_lines')
    .update({ 
      received_quantity: receivedQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (error) throw error;
}

// CORREÇÃO CRÍTICA: Confirmar recebimento usando função atômica
// Isso garante que todas as linhas sejam processadas de uma vez
// Se alguma falhar, nenhuma é processada (evita duplicação)
export async function confirmReceipt(receiptId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  // Usar função SQL atômica que processa todas as linhas de uma vez
  const { error } = await supabase.rpc('process_receipt_atomically', {
    p_receipt_id: receiptId,
  });

  if (error) throw error;
}

// Cancelar recebimento
export async function cancelReceipt(receiptId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { error } = await supabase
    .from('receipts')
    .update({ status: 'cancelled' })
    .eq('id', receiptId);

  if (error) throw error;
}
