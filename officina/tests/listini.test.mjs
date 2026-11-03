// Test dei listini multipli: prezzo amico e prezzo rivenditore per articolo.
// Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-listini-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

let admin, A;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};

test('articolo con prezzo amico e rivenditore: salvati e restituiti', async () => {
  const r = await a('POST', '/api/products', { name: 'Cavo HDMI', qty: 5, cost: 2, price: 12.9, price_friend: '9,5', price_reseller: 7 });
  assert.equal(r.status, 200);
  assert.equal(r.data.price_friend, 9.5);
  assert.equal(r.data.price_reseller, 7);
  const list = (await a('GET', '/api/products?q=HDMI')).data;
  assert.equal(list[0].price_friend, 9.5);
});

test('listino vuoto = non impostato; un vecchio client che non li manda non li cancella', async () => {
  const p = (await a('POST', '/api/products', { name: 'Mouse', qty: 1, cost: 1, price: 8, price_friend: 6 })).data;
  assert.equal(p.price_reseller, null);
  const up = await a('PUT', `/api/products/${p.id}`, { name: 'Mouse', cost: 1, price: 8.5 });
  assert.equal(up.data.price_friend, 6, 'il prezzo amico resta');
  const clear = await a('PUT', `/api/products/${p.id}`, { name: 'Mouse', cost: 1, price: 8.5, price_friend: '' });
  assert.equal(clear.data.price_friend, null, 'svuotato dal modulo');
});

test('importo non valido: errore parlante', async () => {
  const r = await a('POST', '/api/products', { name: 'Errore', qty: 1, cost: 1, price: 5, price_friend: 'abc' });
  assert.equal(r.status, 400);
  assert.equal(r.data.code, 'LISTINO_NON_VALIDO');
});
