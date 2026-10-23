import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Flag para verificar se o Supabase está configurado
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Criar cliente apenas se configurado
let supabaseClient: SupabaseClient;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  console.log('✅ Supabase configurado com sucesso');
} else {
  // Cliente dummy para modo demonstração
  // IMPORTANTE: Este cliente NÃO deve ser usado para operações críticas
  // O AuthContext deve verificar isSupabaseConfigured antes de usar
  supabaseClient = createClient(
    'https://demo.supabase.co',
    'demo-key',
    { auth: { persistSession: false } }
  );
  console.warn('⚠️ Supabase não configurado. Rodando em modo demonstração.');
  console.warn('⚠️ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

export const supabase = supabaseClient;

// Tipos auxiliares para autenticação
export type User = {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
};

// Função auxiliar para verificar se o usuário está autenticado
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single();

    return profile;
  } catch (error) {
    console.error('Erro ao buscar usuário atual:', error);
    return null;
  }
}

// Função auxiliar para logout
export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}
