import { demoLocations, demoProducts } from '../demoStore';
import { isDemoMode, isSupabaseConfigured, supabase } from '../lib/supabase';

export type ReferenceLabels = {
  products: Record<string, string>;
  locations: Record<string, string>;
};

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function chunks<T>(items: T[], size = 50): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function getReferenceLabels(
  productIds: string[],
  locationIds: string[]
): Promise<ReferenceLabels> {
  const uniqueProductIds = uniqueIds(productIds);
  const uniqueLocationIds = uniqueIds(locationIds);

  if (isDemoMode) {
    return {
      products: Object.fromEntries(
        demoProducts
          .filter((product) => uniqueProductIds.includes(product.id))
          .map((product) => [product.id, `${product.sku} — ${product.name}`])
      ),
      locations: Object.fromEntries(
        demoLocations
          .filter((location) => uniqueLocationIds.includes(location.id))
          .map((location) => [location.id, location.code])
      ),
    };
  }

  if (!isSupabaseConfigured) {
    return { products: {}, locations: {} };
  }

  const productRows: Array<{ id: string; sku: string; name: string }> = [];
  for (const batch of chunks(uniqueProductIds)) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name')
      .in('id', batch);
    if (error) throw error;
    productRows.push(...((data || []) as Array<{ id: string; sku: string; name: string }>));
  }

  const locationRows: Array<{ id: string; code: string }> = [];
  for (const batch of chunks(uniqueLocationIds)) {
    const { data, error } = await supabase
      .from('locations')
      .select('id, code')
      .in('id', batch);
    if (error) throw error;
    locationRows.push(...((data || []) as Array<{ id: string; code: string }>));
  }

  return {
    products: Object.fromEntries(productRows.map((product) => [product.id, `${product.sku} — ${product.name}`])),
    locations: Object.fromEntries(locationRows.map((location) => [location.id, location.code])),
  };
}
