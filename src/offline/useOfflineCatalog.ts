import { useEffect, useState } from 'react';
import { accessCopy, usableCopy, isOfflineLocked, COPY_CLEAR_KEY, OFFLINE_LOCK_KEY, CATALOG_CHANGE_KEY, type OfflineCopy } from './storage';
import { syncCopy } from './sync';
import { startAutomaticSync } from './automatic';

export function useOfflineCatalog(online: boolean, userId?: string, enabled = true, canSync = true) {
  const [copy, setCopy] = useState<OfflineCopy | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, []);
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
    const invalidate = () => sync?.invalidate();
    const wake = () => { setNow(Date.now()); if (document.visibilityState === 'visible') sync?.wake(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === COPY_CLEAR_KEY || (event.key === OFFLINE_LOCK_KEY && event.newValue === '1') || event.key === null) clear();
      if (event.key === CATALOG_CHANGE_KEY) invalidate();
    };
    window.addEventListener('annona-catalog-changed', invalidate);
    window.addEventListener('storage', onStorage);
    window.addEventListener('annona-copy-cleared', clear);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    void (async () => {
      if (!enabled || !userId || isOfflineLocked()) { if (active) setLoaded(true); return; }
      try {
        const saved = await accessCopy();
        if (active && !cleared) setCopy(usableCopy(saved, userId, Date.now(), isOfflineLocked()));
      } catch { if (active) setError(true); }
      if (!active) return;
      setLoaded(true);
      if (!cleared && online && canSync && !isOfflineLocked()) {
        sync = startAutomaticSync({
          sync: signal => syncCopy(userId, signal),
          onStart: () => { setBusy(true); setError(false); },
          onSuccess: saved => { setNow(Date.now()); setCopy(saved); setBusy(false); },
          onError: () => { setError(true); setBusy(false); },
        });
      }
    })();
    return () => {
      active = false;
      sync?.stop();
      window.removeEventListener('annona-copy-cleared', clear);
      window.removeEventListener('annona-catalog-changed', invalidate);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [online, userId, enabled, canSync]);
  return { copy: enabled ? usableCopy(copy, userId, Math.max(now, Date.now()), isOfflineLocked()) : null, loaded, busy, error, shellReady, shellError };
}
