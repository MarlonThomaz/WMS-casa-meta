import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DBLocation, LocationWithOccupancy } from '../types';

export async function getLocations(): Promise<DBLocation[]> {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('code');

  if (error) throw error;
  return data || [];
}

export async function getLocationByCode(code: string): Promise<DBLocation | null> {
  if (!isSupabaseConfigured) return null;
  
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getLocationsWithOccupancy(): Promise<LocationWithOccupancy[]> {
  if (!isSupabaseConfigured) return [];
  
  const locations = await getLocations();
  
  const locationsWithOccupancy = await Promise.all(
    locations.map(async (location) => {
      const { data, error } = await supabase
        .rpc('get_location_occupancy', { p_location_id: location.id });

      if (error) {
        return {
          ...location,
          total_items: 0,
          total_quantity: 0,
          occupancy_percentage: 0,
        };
      }
      
      const occupancy = (data as any)?.[0] || {
        total_items: 0,
        total_quantity: 0,
        capacity: location.capacity || 0,
        occupancy_percentage: 0,
      };

      return {
        ...location,
        total_items: occupancy.total_items,
        total_quantity: occupancy.total_quantity,
        occupancy_percentage: occupancy.occupancy_percentage,
      };
    })
  );

  return locationsWithOccupancy;
}

export async function createLocation(location: Omit<DBLocation, 'id' | 'created_at' | 'updated_at'>): Promise<DBLocation> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');
  
  const { data, error } = await supabase
    .from('locations')
    .insert([location])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLocation(id: string, updates: Partial<DBLocation>): Promise<DBLocation> {
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
