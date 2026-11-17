import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { offlineBuild } from './offline-build.js';

const source = readFileSync(new URL('../src/offline/storage.ts', import.meta.url), 'utf8')
  .replace('import.meta.env.VITE_SUPABASE_URL', '"test-backend"');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { searchCopy, usableCopy, MAX_COPY_AGE } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const copy = {
  products: [
    { id: 'p1', sku: 'SKU-011', name: 'Monitor', active: true },
    { id: 'p2', sku: 'SKU-012', name: 'Monitor antigo', active: false },
  ],
  barcodes: [{ product_id: 'p1', barcode: '001234567890' }],
  locations: [{ id: 'l1', code: 'PICK-03', zone: 'C' }, { id: 'l2', code: 'A-01', zone: 'A' }],
  balances: [{ product_id: 'p1', location_id: 'l1', quantity: 0 },
    { product_id: 'p1', location_id: 'l2', quantity: 1 }],
};
assert.equal(searchCopy(copy, '').length, 0);
assert.equal(searchCopy(copy, 'sku-011')[0].id, 'p1');
assert.equal(searchCopy(copy, '001234567890')[0].id, 'p1');
assert.equal(searchCopy(copy, 'Monitor').length, 1);
assert.equal(searchCopy(copy, 'PICK-03').length, 0);
assert.equal(searchCopy(copy, 'a-01')[0].id, 'p1');
const currentTime = Date.parse('2026-11-17T12:00:00Z');
const owned = { ...copy, version: 2, userId: 'operator', savedAt: new Date(currentTime).toISOString() };
assert.equal(usableCopy(owned, undefined, currentTime), null, 'anonymous access denied');
assert.equal(usableCopy(owned, 'another', currentTime), null, 'other account denied');
assert.equal(usableCopy(owned, 'operator', currentTime, true), null, 'local logout blocks access');
assert.equal(usableCopy({ ...owned, version: 1 }, 'operator', currentTime), null, 'legacy cache denied');
assert.equal(usableCopy(owned, 'operator', currentTime + MAX_COPY_AGE), null, 'expired cache denied');
assert.equal(usableCopy(owned, 'operator', currentTime - 1000), null, 'future timestamp denied');
assert.equal(usableCopy(owned, 'operator', currentTime + 1000), owned, 'matching fresh copy allowed');

for (const base of ['/', '/wms/']) {
  const plugin = offlineBuild();
  plugin.configResolved({ base });
  let artifact;
  plugin.generateBundle.call({ emitFile(file) { artifact = file; } }, {}, {
    'assets/app-123.js': {}, 'secret.json': {},
  });
  const handlers = {};
  const cache = new Map();
  const namedCaches = new Map();
  const network = new Map();
  let networkDown = false;
  const fetch = async request => {
    if (networkDown) throw new Error('offline');
    return network.get(typeof request === 'string' ? request : request.url) || 'network';
  };
  const root = 'https://annona.example' + base;
  vm.runInNewContext(artifact.source, {
    URL, Response, fetch, AbortController, setTimeout, clearTimeout,
    self: {
      location: { origin: 'https://annona.example' },
      clients: { claim: async () => {} },
      addEventListener(type, handler) { handlers[type] = handler; },
    },
    caches: {
      open: async name => {
        if (!namedCaches.has(name)) namedCaches.set(name, new Map());
        const items = namedCaches.get(name);
        return {
          addAll: async urls => { for (const url of urls) { const value = 'cached:' + url; items.set(url, value); cache.set(url, value); } },
          match: async request => items.get(typeof request === 'string' ? request : request.url),
        };
      },
      keys: async () => [...namedCaches.keys()],
      delete: async name => namedCaches.delete(name),
    },
  });
  let install;
  handlers.install({ waitUntil(promise) { install = promise; } });
  await install;
  assert.equal(cache.has(root + 'index.html'), true);
  assert.equal(cache.has(root + 'secret.json'), false);
  const currentCacheName = [...namedCaches.keys()][0];
  const obsolete = currentCacheName.slice(0, -16) + '0000000000000000';
  const legacy = 'annona-shell-1111111111111111';
  const other = 'annona-shell-2222222222222222';
  namedCaches.set(obsolete, new Map());
  namedCaches.set(legacy, new Map([[root + 'index.html', 'old']]));
  namedCaches.set(other, new Map([['https://annona.example/other/index.html', 'other app']]));
  namedCaches.set('unrelated-cache', new Map());
  let activated;
  handlers.activate({ waitUntil(promise) { activated = promise; } });
  await activated;
  assert.equal(namedCaches.has(obsolete), false);
  assert.equal(namedCaches.has(legacy), false);
  assert.equal(namedCaches.has(other), true);
  assert.equal(namedCaches.has('unrelated-cache'), true);
  assert.equal(namedCaches.has(currentCacheName), true);
  networkDown = true;
  async function request(url, mode = 'cors', method = 'GET') {
    let promise;
    handlers.fetch({ request: { url, mode, method }, respondWith(p) { promise = p; } });
    return promise ? await promise : undefined;
  }
  assert.equal(await request(root, 'navigate'), 'cached:' + root + 'index.html');
  assert.equal(await request(root + 'assets/app-123.js'), 'cached:' + root + 'assets/app-123.js');
  assert.equal(await request('https://api.example/rest/v1/products'), undefined);
  assert.equal(await request(root + 'signin-with-chatgpt', 'navigate'), undefined);
  assert.equal(await request(root, 'navigate', 'POST'), undefined);
  networkDown = false;
  const freshResponse = new Response('fresh-app', { status: 200 });
  network.set(root, freshResponse);
  assert.equal(await request(root, 'navigate'), freshResponse);
  network.set(root, new Response('backend unavailable', { status: 503 }));
  assert.equal(await request(root, 'navigate'), 'cached:' + root + 'index.html');
  const forbidden = new Response('forbidden', {status: 403});
  network.set(root, forbidden);
  assert.equal(await request(root, 'navigate'), forbidden);
}
console.log('Offline search and service worker tests passed.');

const syncSource = readFileSync(new URL('../src/offline/sync.ts', import.meta.url), 'utf8')
  .replace("import { supabase } from '../lib/supabase';", 'const supabase = globalThis.testClient;')
  .replace("import { accessCopy, type OfflineCopy } from './storage';", 'const accessCopy = globalThis.saveCopy;');
let writes = 0;
let failure = false;
let currentUser = 'operator';
let deniesProfile = false;
let clears = 0;
globalThis.saveCopy = async value => { if (value === null) clears++; else writes++; };
globalThis.testClient = {
  auth: { getSession: async () => ({ data: { session: { user: { id: currentUser } } } }) },
  from(table) {
    let after = '';
    const builder = {
      select() { return this; }, order() { return this; }, limit() { return this; },
      abortSignal() { return this; }, eq() { return this; },
      gt(_column, value) { after = value; return this; },
      single: async () => deniesProfile ? {data: null, error: {code:'PGRST116'}, status:406} : { data: { id: 'operator' }, error: null, status:200 },
      then(resolve) {
        if (failure && table === 'locations') return Promise.resolve({ data: null, error: { message: 'timeout' } }).then(resolve);
        // Simulate a server cap below the requested 500, to verify full pagination.
        const start = after ? Number(after) + 1 : 1;
        const data = Array.from({ length: Math.max(0, Math.min(200, 1201 - start)) },
          (_, i) => ({ id: String(start + i).padStart(5, '0') }));
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return builder;
  },
};
const syncCode = ts.transpileModule(syncSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { syncCopy } = await import('data:text/javascript;base64,' + Buffer.from(syncCode).toString('base64'));
const result = await syncCopy('operator', new AbortController().signal);
assert.equal(result.products.length, 1200);
assert.equal(result.balances.length, 1200);
assert.equal(writes, 1);
failure = true;
await assert.rejects(() => syncCopy('operator', new AbortController().signal));
assert.equal(writes, 1);
failure = false;
currentUser = 'other-user';
await assert.rejects(() => syncCopy('operator', new AbortController().signal));
assert.equal(writes, 1);
currentUser = 'operator';
const cancelled = new AbortController();
cancelled.abort();
await assert.rejects(() => syncCopy('operator', cancelled.signal));
assert.equal(writes, 1);
deniesProfile = true;
await assert.rejects(() => syncCopy('operator', new AbortController().signal));
assert.equal(clears, 1, 'revoked profile clears cached data');
assert.equal(writes, 1, 'revoked profile cannot overwrite cache');
deniesProfile = false;
console.log('Pagination, failed sync, cancellation, revoked profile and account-switch tests passed.');

// Deterministic clock exercises automatic startup, retry, throttling and logout.
const automaticSource = readFileSync(new URL('../src/offline/automatic.ts', import.meta.url), 'utf8');
const automaticCode = ts.transpileModule(automaticSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText.replace('export function', 'function');
let now = 100000;
let timerId = 0;
const timers = new Map();
const scope = {
  AbortController,
  Date: { now: () => now },
  setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
};
vm.runInNewContext(automaticCode + '\nglobalThis.start = startAutomaticSync;', scope);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
async function advance(ms) {
  now += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  await flush();
}
let requests = [];
let successes = [];
let errors = 0;
const automatic = scope.start({
  sync(signal) { return new Promise((resolve, reject) => requests.push({ signal, resolve, reject })); },
  onStart() {}, onSuccess(value) { successes.push(value); }, onError() { errors++; },
});
assert.equal(requests.length, 1, 'prepares without a click');
automatic.wake();
assert.equal(requests.length, 1, 'no overlapping request');
requests[0].resolve('first snapshot');
await flush();
automatic.wake();
assert.equal(requests.length, 1, 'focus is throttled');
await advance(300000);
assert.equal(requests.length, 2, 'refreshes periodically');
requests[1].reject(new Error('network lost'));
await flush();
assert.deepEqual(successes, ['first snapshot'], 'failure preserves previous snapshot');
assert.equal(errors, 1);
await advance(300000);
assert.equal(requests.length, 3, 'retries automatically after failure');
automatic.stop();
assert.equal(requests[2].signal.aborted, true, 'logout/offline cancels work');
requests[2].resolve('late data');
await flush();
await advance(300000);
assert.deepEqual(successes, ['first snapshot'], 'late response cannot repopulate UI after logout');
assert.equal(requests.length, 3);
assert.equal(timers.size, 0, 'cleanup removes retry timers');
const reconnected = scope.start({ sync: async () => 'fresh', onStart() {}, onSuccess(value) { successes.push(value); }, onError() {} });
await flush();
assert.equal(successes.at(-1), 'fresh', 'new online session refreshes immediately');
reconnected.stop();
console.log('Automatic preparation, periodic refresh, retry, reconnect and cleanup tests passed.');

const mutations = readFileSync(new URL('../src/offline/mutation.ts', import.meta.url), 'utf8');
const mutationsCode = ts.transpileModule(mutations, { compilerOptions: {module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2020} }).outputText;
const { affectsOfflineCatalog } = await import('data:text/javascript;base64,' + Buffer.from(mutationsCode).toString('base64'));
const backend = 'https://project.supabase.co';
assert.equal(affectsOfflineCatalog(backend + '/rest/v1/products?id=eq.123', 'PATCH', backend), true);
assert.equal(affectsOfflineCatalog(backend + '/rest/v1/rpc/create_and_process_movement', 'POST', backend), true);
assert.equal(affectsOfflineCatalog(backend + '/rest/v1/rpc/search_stock_locations', 'POST', backend), false);
assert.equal(affectsOfflineCatalog(backend + '/rest/v1/products', 'GET', backend), false);
assert.equal(affectsOfflineCatalog('https://another.example/rest/v1/products', 'PATCH', backend), false);
const connectivitySource = readFileSync(new URL('../src/offline/connectivity.ts', import.meta.url), 'utf8');
const statusFunction = connectivitySource.match(/export function reachableStatus[^]*?\n}/)[0];
const statusCode = ts.transpileModule(statusFunction, {compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2020}}).outputText;
const { reachableStatus } = await import('data:text/javascript;base64,' + Buffer.from(statusCode).toString('base64'));
for (const s of [200,204,401,403]) assert.equal(reachableStatus(s),true);
for (const s of [0,429,500,503]) assert.equal(reachableStatus(s),false);
let refreshRequests = [];
const refresh = scope.start({
  sync(signal) { return new Promise(resolve => refreshRequests.push({signal,resolve})); },
  onStart() {}, onSuccess() {}, onError() {}
});
refresh.invalidate();
refresh.invalidate();
assert.equal(refreshRequests.length,1,'writes during refresh do not overlap');
refreshRequests[0].resolve('initial');
await flush();
await advance(999);
assert.equal(refreshRequests.length,1);
await advance(1);
assert.equal(refreshRequests.length,2,'pending write refreshes soon after active refresh');
refreshRequests[1].resolve('updated');
await flush();
refresh.invalidate();
refresh.invalidate();
await advance(1000);
assert.equal(refreshRequests.length,3,'successful writes coalesce');
refresh.stop();
refreshRequests[2].resolve('ignored');
await flush();
assert.equal(timers.size,0);
console.log('Round 9 ownership, cache expiry, reachability, mutation refresh and scoped cache cleanup tests passed.');
