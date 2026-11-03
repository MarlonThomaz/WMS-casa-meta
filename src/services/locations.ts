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

  const locations = await getLocations();
  return Promise.all(
    locations.map(async (location) => {
      const { data, error } = await supabase.rpc('get_location_occupancy', {
        p_location_id: location.id,
      });

      if (error) {
        throw new Error(`Erro ao calcular ocupação de ${location.code}: ${error.message}`);
      }

      const occupancy = (data as Array<{
        total_items?: number;
        total_quantity?: number;
        occupancy_percentage?: number;
      }> | null)?.[0] || {};

      return {
        ...location,
        total_items: Number(occupancy.total_items || 0),
        total_quantity: Number(occupancy.total_quantity || 0),
        occupancy_percentage: Number(occupancy.occupancy_percentage || 0),
      };
    })
  );
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
