import { supabase } from '../lib/supabase';
import { accessCopy, type OfflineCopy } from './storage';

async function readTable<T>(table: string, columns: string, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  let lastId = '';
  while (true) {
    if (signal.aborted) throw new Error('Atualização interrompida.');
    let query = supabase.from(table).select(columns).order('id').limit(500).abortSignal(signal);
    if (lastId) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data as unknown as T[]);
    const nextId = (data[data.length - 1] as unknown as { id: string }).id;
    if (!nextId || nextId <= lastId) throw new Error('Paginação offline inconsistente.');
    lastId = nextId;
  }
}

async function verifyProfile(userId: string, signal: AbortSignal): Promise<void> {
  const { data: profile, error, status } = await supabase.from('profiles')
    .select('id').eq('id', userId).eq('active', true).abortSignal(signal).single();
  if (!signal.aborted && (error?.code === 'PGRST116' || status === 401 || status === 403 || (!error && !profile))) {
    await accessCopy(null);
  }
  if (error || !profile || signal.aborted) throw new Error('Entre novamente com um perfil ativo para atualizar a cópia.');
}

export async function syncCopy(userId: string, signal: AbortSignal): Promise<OfflineCopy> {
  await verifyProfile(userId, signal);
  const [products, locations, barcodes, balances] = await Promise.all([
    readTable<OfflineCopy['products'][number]>('products', 'id,sku,name,category,active,unit_base', signal),
    readTable<OfflineCopy['locations'][number]>('locations', 'id,code,zone', signal),
    readTable<OfflineCopy['barcodes'][number]>('product_barcodes', 'id,product_id,barcode', signal),
    readTable<OfflineCopy['balances'][number]>('stock_balances', 'id,product_id,location_id,quantity,reserved_quantity,available_quantity', signal),
  ]);
  await verifyProfile(userId, signal);
  const { data: { session } } = await supabase.auth.getSession();
  if (signal.aborted || session?.user.id !== userId) throw new Error('Atualização interrompida.');
  const copy: OfflineCopy = { version: 2, userId, savedAt: new Date().toISOString(), products, locations, barcodes, balances };
  await accessCopy(copy, signal);
  return copy;
}
