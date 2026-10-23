import { supabase } from '../lib/supabase';

export type Location = {
  id: string;
  code: string;
  zone: string;
  aisle?: string;
  rack?: string;
  level?: string;
  location_type: 'storage' | 'picking' | 'staging' | 'receiving' | 'shipping' | 'quarantine';
  capacity?: number;
  status: 'available' | 'occupied' | 'reserved' | 'blocked' | 'maintenance';
  created_at: string;
  updated_at: string;
};

export type LocationWithOccupancy = Location & {
  total_items: number;
  total_quantity: number;
  occupancy_percentage: number;
};

// Buscar todas as localizações
export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('code');

  if (error) throw error;
  return data || [];
}

// Buscar localização por ID
export async function getLocationById(id: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Buscar localização por código
export async function getLocationByCode(code: string): Promise<Location | null> {
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

// Buscar localizações por zona
export async function getLocationsByZone(zone: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('zone', zone)
    .order('code');

  if (error) throw error;
  return data || [];
}

// Buscar localizações por tipo
export async function getLocationsByType(locationType: Location['location_type']): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('location_type', locationType)
    .order('code');

  if (error) throw error;
  return data || [];
}

// Buscar localizações disponíveis
export async function getAvailableLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('status', 'available')
    .order('code');

  if (error) throw error;
  return data || [];
}

// Buscar localização com ocupação
export async function getLocationWithOccupancy(id: string): Promise<LocationWithOccupancy | null> {
  const location = await getLocationById(id);
  if (!location) return null;

  const { data, error } = await supabase
    .rpc('get_location_occupancy', { p_location_id: id });

  if (error) throw error;
  
  const occupancy = data?.[0] || {
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
}

// Buscar todas as localizações com ocupação
export async function getLocationsWithOccupancy(): Promise<LocationWithOccupancy[]> {
  const locations = await getLocations();
  
  const locationsWithOccupancy = await Promise.all(
    locations.map(async (location) => {
      const { data, error } = await supabase
        .rpc('get_location_occupancy', { p_location_id: location.id });

      if (error) {
        console.error(`Error fetching occupancy for location ${location.code}:`, error);
        return {
          ...location,
          total_items: 0,
          total_quantity: 0,
          occupancy_percentage: 0,
        };
      }
      
      const occupancy = data?.[0] || {
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

// Criar nova localização
export async function createLocation(location: Omit<Location, 'id' | 'created_at' | 'updated_at'>): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert([location])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar localização
export async function updateLocation(id: string, updates: Partial<Location>): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar status da localização
export async function updateLocationStatus(id: string, status: Location['status']): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Buscar zonas únicas
export async function getZones(): Promise<string[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('zone')
    .order('zone');

  if (error) throw error;
  
  const zones = [...new Set(data?.map(l => l.zone) || [])];
  return zones;
}

// Contar localizações por status
export async function countLocationsByStatus() {
  const { data, error } = await supabase
    .from('locations')
    .select('status');

  if (error) throw error;

  const counts = {
    available: 0,
    occupied: 0,
    reserved: 0,
    blocked: 0,
    maintenance: 0,
  };

  data?.forEach(l => {
    counts[l.status as keyof typeof counts]++;
  });

  return counts;
}

// Contar localizações por tipo
export async function countLocationsByType() {
  const { data, error } = await supabase
    .from('locations')
    .select('location_type');

  if (error) throw error;

  const counts: Record<string, number> = {};

  data?.forEach(l => {
    counts[l.location_type] = (counts[l.location_type] || 0) + 1;
  });

  return counts;
}
