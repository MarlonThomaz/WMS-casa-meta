// PostgREST RPC reads also use POST, so classify explicit writes only.
const tables = new Set(['products', 'locations', 'product_barcodes']);
const rpcs = new Set([
  'create_and_process_movement', 'process_stock_movement',
  'process_receipt_atomically', 'reserve_stock_for_shipment',
  'confirm_shipment_picked', 'release_shipment_reservations',
  'process_stock_count_adjustments', 'register_product_with_barcode',
]);

export function affectsOfflineCatalog(url: string, method: string, backendUrl: string): boolean {
  try {
    const target = new URL(url);
    if (target.origin !== new URL(backendUrl).origin) return false;
    const path = target.pathname;
    if (method.toUpperCase() === 'POST' && path.startsWith('/rest/v1/rpc/')) {
      return rpcs.has(path.slice('/rest/v1/rpc/'.length));
    }
    return ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase()) &&
      path.startsWith('/rest/v1/') && tables.has(path.slice('/rest/v1/'.length));
  } catch { return false; }
}
