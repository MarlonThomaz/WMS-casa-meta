import { useEffect, useState } from 'react';
import { accessCopy, type OfflineCopy } from './storage';
import { syncCopy } from './sync';
import { startAutomaticSync } from './automatic';

export function useOfflineCatalog(online: boolean, userId?: string, enabled = true) {
  const [copy, setCopy] = useState<OfflineCopy | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const [shellError, setShellError] = useState(false);
  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => { if (active) setShellError(true); }, 60000);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (active) { setShellReady(true); setShellError(false); clearTimeout(timeout); }
      });
    } else setShellError(true);
    return () => { active = false; clearTimeout(timeout); };
  }, []);
  useEffect(() => {
    let active = true;
    let cleared = false;
    let sync: ReturnType<typeof startAutomaticSync> | undefined;
    setCopy(null);
    setLoaded(false);
    setBusy(false);
    setError(false);
    const clear = () => { cleared = true; sync?.stop(); setCopy(null); setBusy(false); };
    const wake = () => { if (document.visibilityState === 'visible') sync?.wake(); };
    window.addEventListener('annona-copy-cleared', clear);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    void (async () => {
      try {
        const saved = await accessCopy();
        if (active && !cleared) setCopy(saved && (!userId || saved.userId === userId) ? saved : null);
      } catch { if (active) setError(true); }
      if (!active) return;
      setLoaded(true);
      if (!cleared && online && userId && enabled) {
        sync = startAutomaticSync({
          sync: signal => syncCopy(userId, signal),
          onStart: () => { setBusy(true); setError(false); },
          onSuccess: saved => { setCopy(saved); setBusy(false); },
          onError: () => { setError(true); setBusy(false); },
        });
      }
    })();
    return () => {
      active = false;
      sync?.stop();
      window.removeEventListener('annona-copy-cleared', clear);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [online, userId, enabled]);
  return { copy: enabled && (!userId || copy?.userId === userId) ? copy : null, loaded, busy, error, shellReady, shellError };
}
