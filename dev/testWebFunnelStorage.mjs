import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import ts from 'typescript';

const modules = {
  config: 'exports.INDEXED_DB_NAME="keyval-store";exports.INDEXED_DB_STORE_NAME="keyval";',
  iteratees: 'exports.fromKeyValueArrays=(keys,values)=>Object.fromEntries(keys.map((key,i)=>[key,values[i]]));',
  'idb-keyval': fs.readFileSync('node_modules/idb-keyval/dist/index.cjs', 'utf8'),
};
for (const name of ['idb', 'webFunnel', 'webFunnelState']) {
  modules[name] = ts.transpileModule(fs.readFileSync(`src/api/storages/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
try {
  const context = await browser.newContext();
  await context.route('https://web.mywallet.io/**', (route) => route.fulfill({ body: '<!doctype html><title>Storage fixture</title>', contentType: 'text/html' }));
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of pages) {
    await page.goto('https://web.mywallet.io/');
    await page.evaluate((sources) => {
      const cache = {};
      function load(name) {
        const key = name.split('/').at(-1);
        if (!cache[key]) {
          const module = { exports: {} };
          cache[key] = module;
          new Function('module', 'exports', 'require', sources[key])(module, module.exports, load);
        }
        return cache[key].exports;
      }
      window.fixture = { ...load('webFunnel'), ...load('webFunnelState'), idb: load('idb').default };
    }, modules);
  }
  const ids = await Promise.all(pages.map((page, index) => page.evaluate(async (i) => {
    const f = window.fixture;
    const saved = await f.mutateWebFunnelStorage((state) => f.initializeWebClientState(state, `${i}`.repeat(20) + ':', { visitId: null, hasExistingState: false }));
    return saved.clientId;
  }, index)));
  assert.ok(ids[0], 'new client ID must be durably created');
  assert.equal(ids[0], ids[1], 'two tabs must share one client ID');
  const events = await Promise.all(pages.map((page, index) => page.evaluate(async (i) => {
    const f = window.fixture;
    return (await f.mutateWebFunnelStorage((state) => f.readyWebLaunchState(state, 1791705600000 + i, `00000000-0000-4000-8000-00000000000${i}`))).webFirstLaunch.event;
  }, index)));
  assert.deepEqual(events[0], events[1], 'ready race must retain original event ID and time');
  await pages[0].evaluate(async () => {
    const f = window.fixture;
    const before = await f.idb.getItem('clientId');
    let failed = false;
    try {
      await f.mutateWebFunnelStorage((state) => ({
        ...state, clientId: 'b'.repeat(20) + ':', webFirstLaunch: { invalid: () => {} },
      }));
    } catch { failed = true; }
    if (!failed || await f.idb.getItem('clientId') !== before) {
      throw new Error('Transaction failure did not roll back client ID with marker');
    }
  });
  await pages[0].evaluate(async () => {
    const f = window.fixture;
    await f.idb.clear();
    await f.idb.setItem('accounts', {});
    const result = await f.mutateWebFunnelStorage((state) => f.initializeWebClientState(state, 'a'.repeat(20) + ':', { visitId: null, hasExistingState: false }));
    if (result.webFirstLaunch) throw new Error('Existing accounts classified as new');
  });
  console.log('PASS real Chromium IndexedDB: concurrent client creation, concurrent SDK-ready event, failed transaction rollback, existing accounts exclusion');
} finally {
  await browser.close();
}
