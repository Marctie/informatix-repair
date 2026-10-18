// Carico senza fornitore, categoria, anagrafica fornitore estesa.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-forn-'));
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

test('carico merce senza fornitore: articolo nuovo con categoria, giacenza e costo, niente storico', async () => {
  const r = await a('POST', '/api/products/load', { name: 'Kit auto', category: 'Accessori', qty: 2, unit_price: '6,03', price: 12 });
  assert.equal(r.status, 200);
  assert.equal(r.data.qty, 2);
  assert.equal(r.data.category, 'Accessori');
  assert.equal(r.data.loaded.supplier_name, null);
  assert.equal((await a('GET', '/api/purchases')).data.length, 0);
  const r2 = await a('POST', `/api/products/${r.data.id}/load`, { qty: 1, unit_price: 7 });
  assert.equal(r2.data.qty, 3);
});
test('carico con fornitore inesistente: 404 parlante', async () => {
  const r = await a('POST', '/api/products/load', { name: 'Y', qty: 1, unit_price: 1, supplier_id: 9999 });
  assert.equal(r.data.code, 'FORNITORE_NON_TROVATO');
});
test('fornitore: sede, agenti e pagamento si salvano', async () => {
  const c = await a('POST', '/api/suppliers', { name: 'Moon', legal_address: 'Via A 1', pickup_address: 'Via B 2', payment_terms: 'bonifico 30gg', agents: [{ name: 'Luca', phone: '333' }, { name: '' }] });
  const g = (await a('GET', '/api/suppliers')).data.find((x) => x.id === c.data.id);
  assert.equal(g.pickup_address, 'Via B 2');
  assert.equal(JSON.parse(g.agents).length, 1);
  const u = await a('PUT', `/api/suppliers/${c.data.id}`, { name: 'Moon', agents: [] });
  assert.equal(u.data.agents, null);
});
