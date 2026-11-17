import { supabase } from '../lib/supabase';
import { accessCopy, type OfflineCopy } from './storage';

async function readTable<T>(table: string, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  let lastId = '';
  while (true) {
    let query = supabase.from(table).select('*').order('id').limit(500).abortSignal(signal);
    if (lastId) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data as T[]);
    lastId = data[data.length - 1].id;
  }
}

export async function syncCopy(userId: string, signal: AbortSignal): Promise<OfflineCopy> {
  const { data: profile, error } = await supabase.from('profiles')
    .select('id').eq('id', userId).eq('active', true).abortSignal(signal).single();
  if (error || !profile) throw new Error('Entre novamente com um perfil ativo para atualizar a cópia.');
  const [products, locations, barcodes, balances] = await Promise.all([
    readTable<OfflineCopy['products'][number]>('products', signal),
    readTable<OfflineCopy['locations'][number]>('locations', signal),
    readTable<OfflineCopy['barcodes'][number]>('product_barcodes', signal),
    readTable<OfflineCopy['balances'][number]>('stock_balances', signal),
  ]);
  const { data: { session } } = await supabase.auth.getSession();
  if (signal.aborted || session?.user.id !== userId) throw new Error('Atualização interrompida.');
  const copy: OfflineCopy = { version: 1, userId, savedAt: new Date().toISOString(),
    products, locations, barcodes, balances };
  await accessCopy(copy);
  return copy;
}
