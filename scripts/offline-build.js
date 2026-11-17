import { createHash } from 'node:crypto';

export function offlineBuild() {
  let base;
  return {
    name: 'annona-offline-shell',
    apply: 'build',
    configResolved(config) { base = config.base; },
    generateBundle(_options, bundle) {
      const paths = ['index.html', ...Object.keys(bundle).filter(p => p.startsWith('assets/'))];
      const version = createHash('sha256').update(paths.join('|')).digest('hex').slice(0,16);
      const source = `
const CACHE = 'annona-shell-${version}';
const BASE = new URL(${JSON.stringify(base)}, self.location.origin).href;
const FILES = ${JSON.stringify(paths)}.map(p => new URL(p, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.pathname === new URL(BASE).pathname) {
    event.respondWith(fetch(request).catch(async () => {
      const response = await caches.match(new URL('index.html', BASE).href, {cacheName: CACHE});
      return response || Response.error();
    }));
  } else if (FILES.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
