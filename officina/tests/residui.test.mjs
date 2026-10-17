// Residui del 16/10: riferimenti inesistenti con messaggio parlante, spesa inesistente, doppio saldo ordine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-res-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const auth = async (c, next) => { c.set('user', { email: 'a@test.it', name: 'a', role: 'admin' }); await next(); };
let srv, A;
before(async () => {
  srv = await new Promise((r) => { const s = serve({ fetch: createApps({ auth }).admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });
const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('vendita con cliente inesistente: 404 parlante, nessuna vendita creata', async () => {
  const r = await a('POST', '/api/sales', { items: [{ name: 'X', qty: 1, unit_price: 5 }], customer_id: 9999, method: 'contanti' });
  assert.equal(r.status, 404);
  assert.equal(r.data.code, 'CLIENTE_NON_TROVATO');
  assert.equal((await a('GET', '/api/sales')).data.length, 0);
});

test('articolo con fornitore inesistente: 404 parlante (creazione e modifica)', async () => {
  const r = await a('POST', '/api/products', { name: 'Cavo', price: 5, supplier_id: 9999 });
  assert.equal(r.status, 404);
  assert.equal(r.data.code, 'FORNITORE_NON_TROVATO');
  const ok = await a('POST', '/api/products', { name: 'Cavo', price: 5 });
  assert.equal((await a('PUT', `/api/products/${ok.data.id}`, { name: 'Cavo', price: 5, supplier_id: 9999 })).data.code, 'FORNITORE_NON_TROVATO');
});

test('spesa inesistente: 404 invece di 200', async () => {
  const r = await a('DELETE', '/api/expenses/9999');
  assert.equal(r.status, 404);
  assert.equal(r.data.code, 'SPESA_NON_TROVATA');
});

test('due consegne simultanee con saldo: il saldo è incassato una volta sola', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Gara', phone: '3390000001' })).data;
  const o = (await a('POST', '/api/orders', { kind: 'cliente', customer_id: c.id, items: [{ description: 'Cover', qty: 1, unit_price: 40 }] })).data;
  await a('POST', `/api/orders/${o.id}/status`, { status: 'ordinato' });
  await a('POST', `/api/orders/${o.id}/status`, { status: 'arrivato' });
  await Promise.all([1, 2, 3].map(() => a('POST', `/api/orders/${o.id}/status`, { status: 'consegnato', collect: true, method: 'contanti' })));
  const fin = (await a('GET', `/api/orders/${o.id}`)).data;
  assert.equal(fin.paid, 40);
});
