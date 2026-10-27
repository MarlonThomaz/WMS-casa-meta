import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  supabase,
  User,
  isSupabaseConfigured,
  isDemoMode,
} from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isDemo: boolean;
}

const DEMO_USER: User = {
  id: 'demo-user-id',
  email: 'demo@casameta.local',
  full_name: 'Usuário Demo',
  role: 'admin',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setUser(isDemoMode ? DEMO_USER : null);
      setLoading(false);
      return;
    }

    let mounted = true;
    let profileLoadTimer: ReturnType<typeof setTimeout> | null = null;

    const bootstrap = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        setSession(currentSession);
        if (currentSession?.user) {
          await loadUserProfile(currentSession.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);

      if (profileLoadTimer) {
        clearTimeout(profileLoadTimer);
        profileLoadTimer = null;
      }

      if (nextSession?.user) {
        setLoading(true);
        // Supabase recomenda não iniciar outra chamada da API de dentro do
        // callback de onAuthStateChange. Adiamos a leitura do perfil para o
        // próximo task da event loop para evitar deadlock do cliente Auth.
        profileLoadTimer = setTimeout(() => {
          if (mounted) void loadUserProfile(nextSession.user.id);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (profileLoadTimer) clearTimeout(profileLoadTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function loadUserProfile(userId: string) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, active')
        .eq('id', userId)
        .eq('active', true)
        .single();

      if (error) throw error;
      if (!profile) throw new Error('Perfil ativo não encontrado');

      setUser({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name || undefined,
        role: profile.role,
      });
    } catch (error) {
      // Falha fechada: não inventar role de operator quando o perfil não existe,
      // está desativado ou a RLS rejeita a leitura.
      console.error('Falha ao carregar perfil ativo:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    if (isDemoMode) {
      if (!email || !password) throw new Error('Email e senha são obrigatórios');
      setUser({
        ...DEMO_USER,
        email,
        full_name: email.split('@')[0] || 'Usuário Demo',
      });
      return;
    }

    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (isDemoMode) {
      setUser(null);
      setSession(null);
      return;
    }

    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        isDemo: isDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
