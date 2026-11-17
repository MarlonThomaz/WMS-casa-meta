import type { DBProduct, DBLocation, DBProductBarcode, DBStockBalance } from '../types';

export type OfflineCopy = {
  version: 2;
  userId: string;
  savedAt: string;
  products: Pick<DBProduct, 'id' | 'sku' | 'name' | 'category' | 'active' | 'unit_base'>[];
  locations: Pick<DBLocation, 'id' | 'code' | 'zone'>[];
  barcodes: Pick<DBProductBarcode, 'id' | 'product_id' | 'barcode'>[];
  balances: Pick<DBStockBalance, 'id' | 'product_id' | 'location_id' | 'quantity' | 'reserved_quantity' | 'available_quantity'>[];
};

const key = import.meta.env.VITE_SUPABASE_URL || 'unconfigured';
export const OFFLINE_LOCK_KEY = 'annona-offline-lock:' + key;
export const COPY_CLEAR_KEY = 'annona-copy-cleared:' + key;
export const CATALOG_CHANGE_KEY = 'annona-catalog-changed:' + key;
export const MAX_COPY_AGE = 24 * 60 * 60 * 1000;

// Local snapshots are a convenience, not a substitute for server-side RLS.
export function usableCopy(copy: OfflineCopy | null, userId?: string, now = Date.now(), locked = false): OfflineCopy | null {
  if (locked || !userId || !copy || copy.version !== 2 || copy.userId !== userId) return null;
  const saved = Date.parse(copy.savedAt);
  return Number.isFinite(saved) && now >= saved && now - saved < MAX_COPY_AGE ? copy : null;
}

export function isOfflineLocked(): boolean {
  try { return localStorage.getItem(OFFLINE_LOCK_KEY) === '1'; }
  catch { return true; }
}

export function setOfflineLocked(locked: boolean): void {
  try { localStorage.setItem(OFFLINE_LOCK_KEY, locked ? '1' : '0'); }
  catch { /* A browser that refuses storage cannot use the offline copy. */ }
}

function emitLocalAndCrossTab(eventName: string, storageKey: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(eventName));
  try { localStorage.setItem(storageKey, Date.now() + ':' + Math.random()); }
  catch { /* Same-tab invalidation still works. */ }
}

export function notifyCatalogChanged(): void {
  emitLocalAndCrossTab('annona-catalog-changed', CATALOG_CHANGE_KEY);
}

export async function accessCopy(value?: OfflineCopy | null, signal?: AbortSignal): Promise<OfflineCopy | null> {
  if (value === null) emitLocalAndCrossTab('annona-copy-cleared', COPY_CLEAR_KEY);
  if (signal?.aborted || (value && isOfflineLocked())) throw new Error('Atualização interrompida.');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('annona-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('copies');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    if (signal?.aborted || (value && isOfflineLocked())) throw new Error('Atualização interrompida.');
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('copies', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('copies');
      const request = value === undefined ? store.get(key)
        : value === null ? store.delete(key) : store.put(value, key);
      const abort = () => { try { transaction.abort(); } catch { /* Already finished. */ } };
      const cleanup = () => signal?.removeEventListener('abort', abort);
      transaction.oncomplete = () => { cleanup(); resolve(value === undefined ? request.result || null : value); };
      transaction.onabort = () => { cleanup(); reject(transaction.error || new Error('Falha ao salvar a cópia local.')); };
      transaction.onerror = () => { cleanup(); reject(transaction.error); };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted || (value && isOfflineLocked())) abort();
    });
  } finally {
    db.close();
  }
}

export function searchCopy(copy: OfflineCopy, query: string) {
  const text = query.trim().toLocaleLowerCase('pt-BR');
  if (!text) return [];
  const barcodeProducts = new Set(copy.barcodes.filter(b => b.barcode.toLowerCase() === text).map(b => b.product_id));
  const locationIds = new Set(copy.locations.filter(l =>
    [l.code, l.zone].some(s => s.toLowerCase().includes(text))).map(l => l.id));
  const locatedProducts = new Set(copy.balances.filter(b =>
    Number(b.quantity) > 0 && locationIds.has(b.location_id)).map(b => b.product_id));
  return copy.products.filter(p => p.active && (
    barcodeProducts.has(p.id) || locatedProducts.has(p.id) ||
    [p.sku, p.name, p.category || ''].some(s => s.toLowerCase().includes(text))
  ));
}
