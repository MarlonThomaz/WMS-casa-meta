import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Flag para verificar se o Supabase está configurado
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Criar cliente apenas se configurado, senão criar um cliente dummy
let supabaseClient: SupabaseClient;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} else {
  // Cliente dummy para modo demonstração
  // Todos os métodos retornam dados vazios ou erros tratados
  supabaseClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: {}, error: new Error('Supabase não configurado') }),
      signUp: async () => ({ data: {}, error: new Error('Supabase não configurado') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ data: [], error: null, count: 0 }),
        in: () => ({ data: [], error: null, count: 0 }),
        gte: () => ({ data: [], error: null }),
        order: () => ({ data: [], error: null }),
        limit: () => ({ data: [], error: null }),
        single: () => ({ data: null, error: null }),
        maybeSingle: () => ({ data: null, error: null }),
        data: [],
        error: null,
      }),
      insert: () => ({
        select: () => ({ single: async () => ({ data: null, error: new Error('Modo demonstração') }) }),
      }),
      update: () => ({
        eq: () => ({ data: null, error: null }),
        select: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    }),
    rpc: async () => ({ data: null, error: new Error('Modo demonstração') }),
  } as unknown as SupabaseClient;
  
  console.warn('⚠️ Supabase não configurado. Rodando em modo demonstração.');
  console.warn('⚠️ Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
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
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  return profile;
}

// Função auxiliar para logout
export async function signOut() {
  await supabase.auth.signOut();
}
