import type { DBProduct, DBLocation, DBProductBarcode, DBStockBalance } from '../types';

export type OfflineCopy = {
  version: 1;
  userId: string;
  savedAt: string;
  products: DBProduct[];
  locations: DBLocation[];
  barcodes: DBProductBarcode[];
  balances: DBStockBalance[];
};

const key = import.meta.env.VITE_SUPABASE_URL || 'unconfigured';

export async function accessCopy(value?: OfflineCopy | null): Promise<OfflineCopy | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('annona-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('copies');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('copies', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('copies');
      const request = value === undefined ? store.get(key)
        : value === null ? store.delete(key) : store.put(value, key);
      transaction.oncomplete = () => resolve(value === undefined ? request.result || null : value);
      transaction.onabort = () => reject(transaction.error || new Error('Falha ao salvar a cópia local.'));
      transaction.onerror = () => reject(transaction.error);
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
