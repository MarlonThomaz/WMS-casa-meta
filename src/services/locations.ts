import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import { demoId, demoLocations, toDbLocation } from '../demoStore';
import type { DBLocation, LocationWithOccupancy } from '../types';

export async function getLocations(): Promise<DBLocation[]> {
  if (isDemoMode) return demoLocations.map(toDbLocation);
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.from('locations').select('*').order('code');
  if (error) throw error;
  return data || [];
}

export async function getLocationsWithOccupancy(): Promise<LocationWithOccupancy[]> {
  if (isDemoMode) return demoLocations.map((location) => ({ ...location }));
  if (!isSupabaseConfigured) return [];

  // Uma única consulta substitui o antigo padrão N+1 (uma RPC por localização).
  // O total é agregado no cliente a partir dos saldos já protegidos por RLS.
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

    return {
      id: row.id,
      code: row.code,
      zone: row.zone,
      aisle: row.aisle || undefined,
      rack: row.rack || undefined,
      level: row.level || undefined,
      location_type: row.location_type,
      capacity: row.capacity ?? undefined,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      total_items: positiveBalances.length,
      total_quantity: totalQuantity,
      occupancy_percentage: capacity > 0 ? Math.min(100, (totalQuantity / capacity) * 100) : 0,
    } as LocationWithOccupancy;
  });
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
