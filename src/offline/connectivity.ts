import { useEffect, useState } from 'react';
import { isSupabaseConfigured, isDemoMode } from '../lib/supabase';

// A 401/403 proves the backend responded; authorization stays with Auth/RLS.
// Server errors, throttling, network failures and timeouts are not usable connectivity.
export function reachableStatus(status: number): boolean {
  return status >= 200 && status < 500 && status !== 429;
}

export function useBackendReachability(): boolean {
  const [reachable, setReachable] = useState(() => isDemoMode || navigator.onLine);
  useEffect(() => {
    if (isDemoMode || !isSupabaseConfigured) return;
    let stopped = false;
    let running = false;
    let controller: AbortController | undefined;
    let next: ReturnType<typeof setTimeout> | undefined;
    const url = new URL('/rest/v1/profiles?select=id&limit=1', import.meta.env.VITE_SUPABASE_URL);
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    async function check() {
      if (stopped || running) return;
      clearTimeout(next);
      if (!navigator.onLine) { setReachable(false); return; }
      running = true;
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), 4000);
      let ok = false;
      try {
        const response = await fetch(url, { method: 'HEAD', headers: { apikey }, cache: 'no-store', credentials: 'omit', signal: current.signal });
        ok = !current.signal.aborted && reachableStatus(response.status);
      } catch { /* Wi-Fi may be connected without reaching the backend. */ }
      finally {
        clearTimeout(timeout);
        running = false;
        if (!stopped) {
          setReachable(ok && navigator.onLine);
          next = setTimeout(() => void check(), ok ? 15000 : 5000);
        }
      }
    }
    const lost = () => { setReachable(false); controller?.abort(); clearTimeout(next); };
    const wake = () => { if (document.visibilityState === 'visible') void check(); };
    const reconnect = () => { void check(); };
    window.addEventListener('offline', lost);
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    void check();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(next);
      window.removeEventListener('offline', lost);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  return reachable;
}
