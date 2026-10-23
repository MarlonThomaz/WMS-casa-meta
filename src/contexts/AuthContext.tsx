import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, User, isSupabaseConfigured } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isDemo: boolean;
}

// Usuário demo para quando o Supabase não está configurado
const DEMO_USER: User = {
  id: 'demo-user-id',
  email: 'demo@casameta.com',
  full_name: 'Usuário Demo',
  role: 'admin',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se Supabase não está configurado, usar usuário demo
    // IMPORTANTE: Isso só acontece quando NÃO há configuração, não quando há falha
    if (!isSupabaseConfigured) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      // CORREÇÃO: Falha de autenticação NÃO deve resultar em usuário demo
      // quando Supabase está configurado
      console.error('Erro ao verificar sessão:', error);
      setUser(null);
      setLoading(false);
    });

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        // Se não encontrar perfil, usar dados básicos do usuário auth
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser({
            id: user.id,
            email: user.email || '',
            full_name: (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Usuário',
            role: 'operator',
          });
        }
      } else {
        setUser(profile);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    // Modo demo - aceitar qualquer credencial
    if (!isSupabaseConfigured) {
      if (email && password) {
        setUser({
          ...DEMO_USER,
          email: email,
          full_name: email.split('@')[0],
        });
        return;
      }
      throw new Error('Email e senha são obrigatórios');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  async function signUp(email: string, password: string, fullName: string) {
    if (!isSupabaseConfigured) {
      setUser({
        ...DEMO_USER,
        email: email,
        full_name: fullName,
      });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;
    
    // Nota: O perfil será criado automaticamente pela trigger no banco
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      setUser(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      isDemo: !isSupabaseConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
