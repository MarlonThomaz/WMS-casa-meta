import {
  demoLocations,
  demoMovementLines,
  demoReceiptLines,
  demoShipmentLines,
} from '../demoStore';
import { isDemoMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DBLocation } from '../types';

export type LocationSearchOption = Pick<
  DBLocation,
  'id' | 'code' | 'zone' | 'aisle' | 'rack' | 'level' | 'location_type' | 'capacity' | 'status'
> & {
  total_quantity?: number;
  quantity?: number;
  reserved_quantity?: number;
  available_quantity?: number;
};

function matchesLocation(location: LocationSearchOption, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [location.code, location.zone, location.aisle, location.rack, location.level]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalized));
}

function toDemoOption(location: (typeof demoLocations)[number]): LocationSearchOption {
  return {
    id: location.id,
    code: location.code,
    zone: location.zone,
    aisle: location.aisle,
    rack: location.rack,
    level: location.level,
    location_type: location.location_type,
    capacity: location.capacity,
    status: location.status,
    total_quantity: Number(location.total_quantity || 0),
  };
}

export async function searchLocations(
  query = '',
  limit = 20,
  destinationOnly = false
): Promise<LocationSearchOption[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);

  if (isDemoMode) {
    return demoLocations
      .map(toDemoOption)
      .filter((location) => !destinationOnly || !['blocked', 'maintenance'].includes(location.status))
      .filter((location) => matchesLocation(location, query))
      .sort((a, b) => {
        const normalized = query.trim().toLowerCase();
        const aExact = normalized && a.code.toLowerCase() === normalized ? 0 : 1;
        const bExact = normalized && b.code.toLowerCase() === normalized ? 0 : 1;
        return aExact - bExact || a.code.localeCompare(b.code);
      })
      .slice(0, safeLimit);
  }

  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('search_locations', {
    p_query: query.trim() || null,
    p_limit: safeLimit,
    p_destination_only: destinationOnly,
  });
  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.location_id),
    code: String(row.code),
    zone: String(row.zone),
    aisle: row.aisle == null ? undefined : String(row.aisle),
    rack: row.rack == null ? undefined : String(row.rack),
    level: row.level == null ? undefined : String(row.level),
    location_type: row.location_type as DBLocation['location_type'],
    capacity: row.capacity == null ? undefined : Number(row.capacity),
    status: row.status as DBLocation['status'],
    total_quantity: Number(row.total_quantity || 0),
  }));
}

export async function searchProductSourceLocations(
  productId: string,
  query = '',
  limit = 20
): Promise<LocationSearchOption[]> {
  if (!productId) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);

  if (isDemoMode) {
    // O demo não possui uma tabela de saldo por endereço. Para não inventar
    // disponibilidade, mostramos apenas posições já referenciadas para o SKU
    // e omitimos available_quantity.
    const referencedIds = new Set<string>();
    demoShipmentLines.forEach((line) => {
      if (line.product_id === productId && line.from_location_id) referencedIds.add(line.from_location_id);
    });
    demoMovementLines.forEach((line) => {
      if (line.product_id === productId && line.from_location_id) referencedIds.add(line.from_location_id);
    });
    demoReceiptLines.forEach((line) => {
      if (line.product_id === productId && line.location_id) referencedIds.add(line.location_id);
    });

    return demoLocations
      .filter((location) => referencedIds.has(location.id))
      .map(toDemoOption)
      .filter((location) => matchesLocation(location, query))
      .sort((a, b) => a.code.localeCompare(b.code))
      .slice(0, safeLimit);
  }

  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc('search_product_source_locations', {
    p_product_id: productId,
    p_query: query.trim() || null,
    p_limit: safeLimit,
  });
  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.location_id),
    code: String(row.code),
    zone: String(row.zone),
    aisle: row.aisle == null ? undefined : String(row.aisle),
    rack: row.rack == null ? undefined : String(row.rack),
    level: row.level == null ? undefined : String(row.level),
    location_type: row.location_type as DBLocation['location_type'],
    capacity: row.capacity == null ? undefined : Number(row.capacity),
    status: row.status as DBLocation['status'],
    quantity: Number(row.quantity || 0),
    reserved_quantity: Number(row.reserved_quantity || 0),
    available_quantity: Number(row.available_quantity || 0),
  }));
}
