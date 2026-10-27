import { isDemoMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DBProfile, Role } from '../types';

const demoProfiles: DBProfile[] = [
  {
    id: 'demo-user-id',
    email: 'demo@casameta.local',
    full_name: 'Administrador Demo',
    role: 'admin',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-manager-id',
    email: 'gerente@casameta.local',
    full_name: 'Gerente Demo',
    role: 'manager',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-operator-id',
    email: 'operador@casameta.local',
    full_name: 'Operador Demo',
    role: 'operator',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-viewer-id',
    email: 'visualizador@casameta.local',
    full_name: 'Visualizador Demo',
    role: 'viewer',
    active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function getProfiles(): Promise<DBProfile[]> {
  if (isDemoMode) return demoProfiles.map((profile) => ({ ...profile }));
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active, created_at, updated_at')
    .order('email');

  if (error) throw error;
  return (data || []) as DBProfile[];
}

export async function updateProfileAccess(
  profileId: string,
  updates: { role?: Role; active?: boolean }
): Promise<DBProfile> {
  if (isDemoMode) {
    const profile = demoProfiles.find((item) => item.id === profileId);
    if (!profile) throw new Error('Perfil não encontrado');
    Object.assign(profile, updates, { updated_at: new Date().toISOString() });
    return { ...profile };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase não configurado');

  const payload: { role?: Role; active?: boolean; updated_at: string } = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
    .select('id, email, full_name, role, active, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as DBProfile;
}
