import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const isDemoMode = !isSupabaseConfigured && import.meta.env.VITE_ENABLE_DEMO === 'true';

let supabaseClient: SupabaseClient;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} else {
  // Cliente inerte somente para manter a aplicação inicializável.
  // Nenhum service deve executar operações quando isSupabaseConfigured=false.
  supabaseClient = createClient('https://demo.invalid', 'demo-key', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (isDemoMode) {
    console.warn('WMS iniciado em modo demonstração explícito (VITE_ENABLE_DEMO=true).');
  } else {
    console.error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY legado).'
    );
  }
}

export const supabase = supabaseClient;

export type User = {
  id: string;
  email: string;
  full_name?: string;
  role?: Role;
};
