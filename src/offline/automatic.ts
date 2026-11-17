// One request at a time; cancellation also suppresses late results.
export function startAutomaticSync<T>(options: {
  sync: (signal: AbortSignal) => Promise<T>;
  onStart: () => void;
  onSuccess: (value: T) => void;
  onError: () => void;
  interval?: number;
}) {
  let stopped = false;
  let running = false;
  let controller: AbortController | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let lastAttempt = 0;
  async function refresh() {
    if (stopped || running) return;
    clearTimeout(retry);
    running = true;
    lastAttempt = Date.now();
    const current = new AbortController();
    controller = current;
    const timeout = setTimeout(() => current.abort(), 60000);
    options.onStart();
    try {
      const value = await options.sync(current.signal);
      if (!stopped && !current.signal.aborted) options.onSuccess(value);
      else if (!stopped) options.onError();
    } catch {
      if (!stopped) options.onError();
    } finally {
      clearTimeout(timeout);
      running = false;
      if (!stopped) retry = setTimeout(() => void refresh(), options.interval ?? 300000);
    }
  }
  void refresh();
  return {
    // Returning to the app refreshes stale data without repeated focus requests.
    wake() { if (Date.now() - lastAttempt >= 60000) void refresh(); },
    stop() { stopped = true; clearTimeout(retry); controller?.abort(); },
  };
}
