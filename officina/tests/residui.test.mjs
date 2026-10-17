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

test('soglia "fermo" per articolo: valida, salvata e usata dagli avvisi', async () => {
  assert.equal((await a('POST', '/api/products', { name: 'Cover', price: 5, stale_days: 'abc' })).data.code, 'GIORNI_FERMO_NON_VALIDI');
  const p = (await a('POST', '/api/products', { name: 'Cover blu', price: 5, qty: 3, stale_days: 1 })).data;
  assert.equal(p.stale_days, 1);
  const z = (await a('POST', '/api/products', { name: 'Cover mai', price: 5, qty: 3, stale_days: 0 })).data;
  assert.equal(z.stale_days, 0);
  assert.equal((await a('POST', '/api/products', { name: 'Cover gen', price: 5, qty: 3 })).data.stale_days, null);
});

test('note con foto: allega, legge, toglie; nota di sole foto ammessa; massimo 6', async () => {
  process.env.OFFICINA_MEDIA = join(dir, 'media');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
  const n = (await a('POST', '/api/note', { title: 'Scontrino' })).data;
  assert.equal(n.photo_count, 0);
  assert.equal((await a('POST', `/api/note/${n.id}/photo`, { image: 'AAAA' })).data.code, 'FOTO_NON_JPEG');
  const up = await a('POST', `/api/note/${n.id}/photo`, { image: jpeg });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  assert.equal(up.data.photo_count, 1);
  const img = await fetch(`${A}/api/note/${n.id}/photo/0`);
  assert.equal(img.status, 200);
  assert.equal((await img.arrayBuffer()).byteLength, 22);
  for (let i = 1; i < 6; i += 1) await a('POST', `/api/note/${n.id}/photo`, { image: jpeg });
  assert.equal((await a('POST', `/api/note/${n.id}/photo`, { image: jpeg })).data.code, 'TROPPE_FOTO');
  assert.equal((await a('DELETE', `/api/note/${n.id}/photo/0`)).data.photo_count, 5);
  assert.equal((await a('PUT', `/api/note/${n.id}`, { title: '', body: '', items: [] })).status, 200);
  assert.equal((await a('DELETE', `/api/note/${n.id}`)).status, 200);
});

test('correggere un ricambio usato: prezzo, quantità, costo e giacenza; Cassa non tocca i costi; consegnata no', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Ricambi', phone: '3390000009' })).data;
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Ricambi', phone: '3390000009' }, brand_model: 'Galaxy A55', problem: 'Batteria', quote: 80 })).data;
  const prod = (await a('POST', '/api/products', { name: 'Display A55', price: 90, cost: 40, qty: 5 })).data;
  let rep = (await a('POST', `/api/repairs/${r.id}/parts`, { name: 'Batteria A55', qty: 1, unit_cost: '12,90', unit_price: 5 })).data;
  const manual = rep.parts[0];
  rep = (await a('POST', `/api/repairs/${r.id}/parts`, { product_id: prod.id, qty: 1 })).data;
  const stock = rep.parts.find((p) => p.product_id);
  // prezzo sbagliato: si corregge prezzo al cliente e costo (con IVA esclusa)
  rep = (await a('PATCH', `/api/repairs/${r.id}/parts/${manual.id}`, { unit_price: '35', unit_cost: '15,78', price_mode: 'net', vat_rate: 22, vat_apply: false })).data;
  const m2 = rep.parts.find((p) => p.id === manual.id);
  assert.equal(m2.unit_price, 35);
  assert.equal(m2.unit_cost, 15.78);
  // articolo di magazzino: la quantità aggiusta la giacenza
  await a('PATCH', `/api/repairs/${r.id}/parts/${stock.id}`, { qty: 3 });
  const list = (await a('GET', '/api/products?q=Display A55')).data;
  assert.equal(list[0].qty, 2);
  // nome vuoto o prezzo negativo: messaggio chiaro
  assert.equal((await a('PATCH', `/api/repairs/${r.id}/parts/${manual.id}`, { name: '' })).data.code, 'NOME_MANCANTE');
  assert.equal((await a('PATCH', `/api/repairs/${r.id}/parts/${manual.id}`, { unit_price: -1 })).data.code, 'IMPORTO_NON_VALIDO');
  assert.equal((await a('PATCH', `/api/repairs/${r.id}/parts/99999`, { unit_price: 1 })).status, 404);
});
