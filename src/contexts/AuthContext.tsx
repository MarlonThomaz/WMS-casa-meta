import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { accessCopy, setOfflineLocked, OFFLINE_LOCK_KEY } from '../offline/storage';
import { Session } from '@supabase/supabase-js';
import { supabase, User, isSupabaseConfigured, isDemoMode } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isDemo: boolean;
}

const DEMO_USER: User = { id: 'demo-user-id', email: 'demo@casameta.local', full_name: 'Usuário Demo', role: 'admin' };
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentSession = useRef<Session | null>(null);
  const revision = useRef(0);
  const locallySignedOut = useRef(false);

  const clearSession = useCallback(() => {
    revision.current++;
    currentSession.current = null;
    setSession(null);
    setUser(null);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const id = currentSession.current?.user.id;
    const generation = ++revision.current;
    if (!id || locallySignedOut.current) { setUser(null); setLoading(false); return; }
    try {
      setLoading(true);
      const { data: profile, error, status } = await supabase.from('profiles')
        .select('id, email, full_name, role, active').eq('id', id).eq('active', true).single();
      if (generation !== revision.current || currentSession.current?.user.id !== id || locallySignedOut.current) return;
      if (error || !profile) {
        // Definitive denial invalidates local data; a network failure does not.
        if (error?.code === 'PGRST116' || status === 401 || status === 403 || (!error && !profile)) {
          setOfflineLocked(true);
          locallySignedOut.current = true;
          clearSession();
          void accessCopy(null).catch(console.warn);
        } else setUser(null);
        return;
      }
      setUser({ id: profile.id, email: profile.email, full_name: profile.full_name || undefined, role: profile.role });
    } catch (error) {
      if (generation === revision.current) setUser(null);
      console.error('Falha ao carregar perfil ativo:', error);
    } finally {
      if (generation === revision.current) setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(isDemoMode ? DEMO_USER : null);
      setLoading(false);
      return;
    }
    let mounted = true;
    let profileLoadTimer: ReturnType<typeof setTimeout> | undefined;
    // Deliberate local sign-out remains effective after an offline reload.
    try { locallySignedOut.current = localStorage.getItem(OFFLINE_LOCK_KEY) === '1'; } catch { /* online auth is still usable */ }

    const applySession = (next: Session | null) => {
      if (!mounted) return;
      clearTimeout(profileLoadTimer);
      if (locallySignedOut.current || !next) { clearSession(); return; }
      if (currentSession.current?.user.id !== next.user.id) {
        revision.current++;
        setUser(null);
      }
      currentSession.current = next;
      setSession(next);
      setLoading(true);
      // Do not call Supabase APIs inside onAuthStateChange itself.
      profileLoadTimer = setTimeout(() => { if (mounted) void refreshProfile(); }, 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        locallySignedOut.current = true;
        setOfflineLocked(true);
        clearTimeout(profileLoadTimer);
        clearSession();
        void accessCopy(null).catch(console.warn);
      } else applySession(next);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === OFFLINE_LOCK_KEY && event.newValue === '1') {
        locallySignedOut.current = true;
        clearTimeout(profileLoadTimer);
        clearSession();
      }
    };
    window.addEventListener('storage', onStorage);
    // INITIAL_SESSION supplies the persisted session if available.
    return () => {
      mounted = false;
      revision.current++;
      clearTimeout(profileLoadTimer);
      subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, [clearSession, refreshProfile]);

  async function signIn(email: string, password: string) {
    if (isDemoMode) {
      if (!email || !password) throw new Error('Email e senha são obrigatórios');
      setUser({ ...DEMO_USER, email, full_name: email.split('@')[0] || 'Usuário Demo' });
      return;
    }
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.');
    locallySignedOut.current = true;
    setOfflineLocked(true);
    clearSession();
    try { await accessCopy(null); } catch (error) { console.warn('Não foi possível apagar a cópia offline:', error); }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Sessão não retornada pelo servidor.');
    locallySignedOut.current = false;
    setOfflineLocked(false);
    currentSession.current = data.session;
    setSession(data.session);
    await refreshProfile();
  }

  async function signOut() {
    locallySignedOut.current = true;
    setOfflineLocked(true);
    clearSession();
    try { await accessCopy(null); } catch (error) { console.warn('Não foi possível apagar a cópia offline:', error); }
    if (isDemoMode || !isSupabaseConfigured) return;
    // Local privacy is enforced immediately; remote revocation needs connectivity.
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.warn('Encerramento remoto pendente; novo login exigido neste aparelho:', error);
    } catch (error) { console.warn('Encerramento remoto indisponível:', error); }
  }

  return <AuthContext.Provider value={{ user, session, loading, signIn, signOut, refreshProfile, isDemo: isDemoMode }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
