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
const { searchCopy } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
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

for (const base of ['/', '/wms/']) {
  const plugin = offlineBuild();
  plugin.configResolved({ base });
  let artifact;
  plugin.generateBundle.call({ emitFile(file) { artifact = file; } }, {}, {
    'assets/app-123.js': {}, 'secret.json': {},
  });
  const handlers = {};
  const cache = new Map();
  const network = new Map();
  let networkDown = false;
  const fetch = async request => {
    if (networkDown) throw new Error('offline');
    return network.get(typeof request === 'string' ? request : request.url) || 'network';
  };
  const root = 'https://annona.example' + base;
  vm.runInNewContext(artifact.source, {
    URL, Response, fetch,
    self: {
      location: { origin: 'https://annona.example' },
      clients: { claim: async () => {} },
      addEventListener(type, handler) { handlers[type] = handler; },
    },
    caches: {
      open: async () => ({
        addAll: async urls => { for (const url of urls) cache.set(url, 'cached:' + url); },
        match: async request => cache.get(typeof request === 'string' ? request : request.url),
      }),
      match: async url => cache.get(url),
    },
  });
  let install;
  handlers.install({ waitUntil(promise) { install = promise; } });
  await install;
  assert.equal(cache.has(root + 'index.html'), true);
  assert.equal(cache.has(root + 'secret.json'), false);
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
  network.set(root, 'fresh-app');
  assert.equal(await request(root, 'navigate'), 'fresh-app');
}
console.log('Offline search and service worker tests passed.');

const syncSource = readFileSync(new URL('../src/offline/sync.ts', import.meta.url), 'utf8')
  .replace("import { supabase } from '../lib/supabase';", 'const supabase = globalThis.testClient;')
  .replace("import { accessCopy, type OfflineCopy } from './storage';", 'const accessCopy = globalThis.saveCopy;');
let writes = 0;
let failure = false;
let currentUser = 'operator';
globalThis.saveCopy = async () => { writes++; };
globalThis.testClient = {
  auth: { getSession: async () => ({ data: { session: { user: { id: currentUser } } } }) },
  from(table) {
    let after = '';
    const builder = {
      select() { return this; }, order() { return this; }, limit() { return this; },
      abortSignal() { return this; }, eq() { return this; },
      gt(_column, value) { after = value; return this; },
      single: async () => ({ data: { id: 'operator' }, error: null }),
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
console.log('Pagination, failed sync, cancellation and account-switch tests passed.');
