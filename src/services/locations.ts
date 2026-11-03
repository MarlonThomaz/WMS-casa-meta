import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoLocations, toDbLocation } from '../demoStore';
import type { DBLocation, LocationWithOccupancy } from '../types';

export type LocationMapItem = LocationWithOccupancy & {
  stored_status: DBLocation['status'];
};

export type LocationMapPage = {
  items: LocationMapItem[];
  total: number;
};

export type LocationMapStats = {
  totalLocations: number;
  availableLocations: number;
  occupiedLocations: number;
  unavailableLocations: number;
};

function deriveDisplayStatus(
  status: DBLocation['status'],
  totalQuantity: number
): DBLocation['status'] {
  // blocked, maintenance e reserved são estados administrativos explícitos.
  // available/occupied são derivados da presença física de estoque.
  if (status === 'blocked' || status === 'maintenance' || status === 'reserved') {
    return status;
  }
  return totalQuantity > 0 ? 'occupied' : 'available';
}

function toDemoMapItem(location: (typeof demoLocations)[number]): LocationMapItem {
  const totalQuantity = Number(location.total_quantity || 0);
  const capacity = Number(location.capacity || 0);
  const storedStatus = location.status;

  return {
    ...location,
    status: deriveDisplayStatus(storedStatus, totalQuantity),
    stored_status: storedStatus,
    total_items: Number(location.total_items || 0),
    total_quantity: totalQuantity,
    occupancy_percentage: capacity > 0 ? Math.min(100, (totalQuantity / capacity) * 100) : 0,
  };
}

export async function getLocations(): Promise<DBLocation[]> {
  if (isDemoMode) return demoLocations.map(toDbLocation);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.from('locations').select('*').order('code');
  if (error) throw error;
  return data || [];
}

export async function getLocationsWithOccupancy(): Promise<LocationWithOccupancy[]> {
  if (isDemoMode) {
    return demoLocations.map((location) => {
      const totalQuantity = Number(location.total_quantity || 0);
      return {
        ...location,
        status: deriveDisplayStatus(location.status, totalQuantity),
      };
    });
  }
  if (!isSupabaseConfigured) return [];

  // Mantido para telas legadas que ainda precisam do conjunto completo.
  // O mapa principal usa searchLocationMapPage(), que pagina e agrega no banco.
  const { data, error } = await supabase
    .from('locations')
    .select(`
      *,
      stock_balances (quantity)
    `)
    .order('code');

  if (error) throw new Error(`Erro ao carregar ocupação das localizações: ${error.message}`);

  return (data || []).map((row) => {
    const balances = (row.stock_balances || []) as Array<{ quantity: number | string | null }>;
    const positiveBalances = balances.filter((balance) => Number(balance.quantity || 0) > 0);
    const totalQuantity = positiveBalances.reduce(
      (sum, balance) => sum + Number(balance.quantity || 0),
      0
    );
    const capacity = Number(row.capacity || 0);
    const rawStatus = row.status as DBLocation['status'];

    return {
      id: row.id,
      code: row.code,
      zone: row.zone,
      aisle: row.aisle || undefined,
      rack: row.rack || undefined,
      level: row.level || undefined,
      location_type: row.location_type,
      capacity: row.capacity ?? undefined,
      status: deriveDisplayStatus(rawStatus, totalQuantity),
      created_at: row.created_at,
      updated_at: row.updated_at,
      total_items: positiveBalances.length,
      total_quantity: totalQuantity,
      occupancy_percentage: capacity > 0 ? Math.min(100, (totalQuantity / capacity) * 100) : 0,
    } as LocationWithOccupancy;
  });
}

export async function searchLocationMapPage(
  query = '',
  status: DBLocation['status'] | null = null,
  limit = 50,
  offset = 0
): Promise<LocationMapPage> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
  const normalizedQuery = query.trim().toLowerCase();

  if (isDemoMode) {
    const filtered = demoLocations
      .map(toDemoMapItem)
      .filter((location) => {
        const matchesQuery = !normalizedQuery || [
          location.code,
          location.zone,
          location.aisle,
          location.rack,
          location.level,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedQuery));
        const matchesStatus = !status || location.status === status;
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => a.zone.localeCompare(b.zone) || a.code.localeCompare(b.code));

    return {
      items: filtered.slice(safeOffset, safeOffset + safeLimit),
      total: filtered.length,
    };
  }

  if (!isSupabaseConfigured) return { items: [], total: 0 };

  const { data, error } = await supabase.rpc('search_locations_with_occupancy', {
    p_query: query.trim() || null,
    p_status: status || null,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });
  if (error) throw error;

  const rows = (data || []) as Array<Record<string, unknown>>;
  const items: LocationMapItem[] = rows.map((row) => ({
    id: String(row.id),
    code: String(row.code),
    zone: String(row.zone),
    aisle: row.aisle == null ? undefined : String(row.aisle),
    rack: row.rack == null ? undefined : String(row.rack),
    level: row.level == null ? undefined : String(row.level),
    location_type: row.location_type as DBLocation['location_type'],
    capacity: row.capacity == null ? undefined : Number(row.capacity),
    stored_status: row.stored_status as DBLocation['status'],
    status: row.display_status as DBLocation['status'],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    total_items: Number(row.total_items || 0),
    total_quantity: Number(row.total_quantity || 0),
    occupancy_percentage: Number(row.occupancy_percentage || 0),
  }));

  return {
    items,
    total: rows.length > 0 ? Number(rows[0].total_count || 0) : 0,
  };
}

export async function getLocationMapStats(): Promise<LocationMapStats> {
  if (isDemoMode) {
    const locations = demoLocations.map(toDemoMapItem);
    return {
      totalLocations: locations.length,
      availableLocations: locations.filter((location) => location.status === 'available').length,
      occupiedLocations: locations.filter((location) => location.status === 'occupied').length,
      unavailableLocations: locations.filter(
        (location) => location.status === 'blocked' || location.status === 'maintenance'
      ).length,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      totalLocations: 0,
      availableLocations: 0,
      occupiedLocations: 0,
      unavailableLocations: 0,
    };
  }

  const { data, error } = await supabase.rpc('get_location_map_stats');
  if (error) throw error;

  const row = ((data || []) as Array<Record<string, unknown>>)[0];
  if (!row) throw new Error('Banco não retornou as estatísticas do mapa de endereços');

  return {
    totalLocations: Number(row.total_locations || 0),
    availableLocations: Number(row.available_locations || 0),
    occupiedLocations: Number(row.occupied_locations || 0),
    unavailableLocations: Number(row.unavailable_locations || 0),
  };
}

export async function createLocation(
  location: Omit<DBLocation, 'id' | 'created_at' | 'updated_at'>
): Promise<DBLocation> {
  if (isDemoMode) {
    if (demoLocations.some((item) => item.code.toLowerCase() === location.code.toLowerCase())) {
      throw new Error('Localização já cadastrada na demonstração');
    }

    const created: LocationWithOccupancy = {
      ...location,
      id: demoId('location'),
      total_items: 0,
      total_quantity: 0,
      occupancy_percentage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    demoLocations.push(created);
    return toDbLocation(created);
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.from('locations').insert([location]).select().single();
  if (error) throw error;
  return data;
}

export async function updateLocation(id: string, updates: Partial<DBLocation>): Promise<DBLocation> {
  if (isDemoMode) {
    const location = demoLocations.find((item) => item.id === id);
    if (!location) throw new Error('Localização não encontrada');
    Object.assign(location, updates, { updated_at: new Date().toISOString() });
    return toDbLocation(location);
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
