// Test: registro eliminazioni/modifiche, ruolo Cassa, carico merce.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-reg-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

// accesso finto: l'intestazione x-role decide chi e' collegato (admin, staff, cassa)
const auth = async (c, next) => {
  const role = c.req.header('x-role') || 'admin';
  c.set('user', { email: `${role}@test.it`, name: role, role });
  await next();
};

let srv, A;
before(async () => {
  const apps = createApps({ auth, usati: { publisher: () => ({ mode: 'fake', enabled: false, async publish() { return {}; } }), media: () => ({}), siteUrl: () => 'https://sito.test' } });
  srv = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body, role = 'admin') => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const audit = async (qs = '') => (await a('GET', `/api/audit${qs}`)).data;

test('registro: elimina e modifica finiscono nel registro con chi/cosa', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Mario Rossi', phone: '333111222' }, 'staff')).data;
  await a('PUT', `/api/customers/${c.id}`, { name: 'Mario Rossi Jr', phone: '333111222' }, 'staff');
  assert.equal((await a('DELETE', `/api/customers/${c.id}`, null, 'staff')).status, 200);
  const d = await audit('?type=cliente');
  assert.equal(d.rows.length, 3);
  const del = d.rows[0];
  assert.equal(del.action, 'elimina');
  assert.equal(del.label, 'Mario Rossi Jr');
  assert.equal(del.user_email, 'staff@test.it');
  assert.equal(d.rows[2].action, 'crea');
  // un errore non lascia traccia
  const before = (await audit()).total;
  assert.equal((await a('DELETE', '/api/users/99999')).status, 404);
  assert.equal((await audit()).total, before);
});

test('registro: articoli, fornitori, spese, servizi, impostazioni, ricambi, vendite', async () => {
  const p = (await a('POST', '/api/products', { name: 'Batteria X', qty: 5, cost: 10, price: 25 })).data;
  await a('POST', `/api/products/${p.id}/move`, { delta: -1, reason: 'prova' });
  await a('DELETE', `/api/products/${p.id}`);
  const s = (await a('POST', '/api/suppliers', { name: 'Forn Uno' })).data;
  await a('DELETE', `/api/suppliers/${s.id}`);
  const e = (await a('POST', '/api/expenses', { description: 'Carta', amount: 5 })).data;
  await a('DELETE', `/api/expenses/${e.id}`);
  const sv = (await a('POST', '/api/services', { name: 'Formattazione', price: 30 })).data;
  await a('DELETE', `/api/services/${sv.id}`);
  await a('PUT', '/api/settings', { shop_name: 'Informatix' });
  await a('POST', '/api/sales', { items: [{ name: 'Cavo', qty: 1, unit_price: 5 }], method: 'contanti' });
  const types = new Set((await audit('?size=200')).rows.map((r) => r.object_type));
  for (const t of ['articolo', 'fornitore', 'spesa', 'servizio', 'impostazioni', 'vendita']) assert.ok(types.has(t), `manca ${t}`);
  const art = (await audit('?type=articolo')).rows.find((r) => r.action === 'elimina');
  assert.equal(art.label, 'Batteria X');
  assert.equal((await audit('?q=Forn Uno')).rows.length, 2);
  const pg = await audit('?size=2&page=2');
  assert.equal(pg.rows.length, 2);
  assert.ok(pg.pages > 1);
  assert.equal((await audit('?user=nessuno@x.it')).total, 0);
  assert.equal((await audit('?from=2999-01-01')).total, 0);
});

test('registro: solo gli admin lo leggono', async () => {
  assert.equal((await a('GET', '/api/audit', null, 'staff')).status, 403);
  assert.equal((await a('GET', '/api/audit', null, 'cassa')).status, 403);
  assert.equal((await a('GET', '/api/audit', null, 'admin')).status, 200);
});
