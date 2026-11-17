import { createHash } from 'node:crypto';

export function offlineBuild() {
  let base;
  return {
    name: 'annona-offline-shell',
    apply: 'build',
    configResolved(config) { base = config.base; },
    generateBundle(_options, bundle) {
      const paths = ['index.html', ...Object.keys(bundle).filter(p => p.startsWith('assets/'))];
      const scope = createHash('sha256').update(base).digest('hex').slice(0,12);
      const version = createHash('sha256').update(paths.join('|') + String(bundle['index.html']?.source || '')).digest('hex').slice(0,16);
      const source = `
const PREFIX = 'annona-shell-${scope}-';
const CACHE = PREFIX + '${version}';
const BASE = new URL(${JSON.stringify(base)}, self.location.origin).href;
const FILES = ${JSON.stringify(paths)}.map(p => new URL(p, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name === CACHE) continue;
      if (name.startsWith(PREFIX)) await caches.delete(name);
      else if (/^annona-shell-[a-f0-9]{16}$/.test(name)) {
        const old = await caches.open(name);
        if (await old.match(new URL('index.html', BASE).href)) await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.pathname === new URL(BASE).pathname) {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(request, {signal: controller.signal});
        if (response.status < 500) return response;
      } catch { /* Network unavailable. */ }
      finally { clearTimeout(timeout); }
      const cached = await (await caches.open(CACHE)).match(new URL('index.html', BASE).href);
      return cached || Response.error();
    })());
  } else if (FILES.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
