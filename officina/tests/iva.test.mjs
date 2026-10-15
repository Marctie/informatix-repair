// Test: IVA sui ricambi e sugli acquisti (esclusa/inclusa, "applica IVA realmente").  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-iva-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

let admin, A;
const listen = (app) => new Promise((r) => { const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
before(async () => {
  admin = await listen(createApps().admin);
  A = `http://127.0.0.1:${admin.address().port}`;
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};

test('IVA: calcolo esclusa/inclusa e flag "applica realmente"', async () => {
  const { computeVat } = await import('../iva.mjs');
  const n = computeVat({ amount: 100, mode: 'net', rate: 22 });
  assert.deepEqual([n.net, n.vat, n.gross, n.cost], [100, 22, 122, 100], 'IVA recuperabile: il costo e l imponibile');
  const g = computeVat({ amount: 122, mode: 'gross', rate: 22 });
  assert.deepEqual([g.net, g.vat, g.gross, g.cost], [100, 22, 122, 100]);
  const ap = computeVat({ amount: 100, mode: 'net', rate: 22, apply: true });
  assert.equal(ap.cost, 122, 'IVA reale: si aggiunge al costo');
  assert.throws(() => computeVat({ amount: 10, mode: 'boh' }));
});

test('carico merce: IVA aggiunta al costo e tutto registrato', async () => {
  const sup = (await a('POST', '/api/suppliers', { name: 'Shop Estero' })).data;
  const p = (await a('POST', '/api/products/load', { name: 'Display X', qty: 2, supplier_id: sup.id, unit_price: '100', vat_apply: true, vat_rate: '22', doc_number: 'EU-1' })).data;
  assert.equal(p.cost, 122, 'ultimo costo = IVA compresa');
  assert.equal(p.loaded.vat.vat, 22);
  const doc = (await a('GET', `/api/purchases/${p.loaded.purchase_id}`)).data;
  const line = doc.lines[0];
  assert.equal(line.vat_applied, 1);
  assert.equal(line.vat_amount, 44);
  assert.equal(line.list_price, 100, 'imponibile salvato');
  assert.equal(line.unit_price, 122);

  // prezzo scritto IVA inclusa, IVA non applicata: costo = imponibile
  const q = (await a('POST', '/api/products/load', { name: 'Batteria Y', qty: 1, supplier_id: sup.id, unit_price: '61', price_mode: 'gross' })).data;
  assert.equal(q.cost, 50);
  assert.equal((await a('POST', '/api/products/load', { name: 'Z', qty: 1, supplier_id: sup.id, unit_price: '5', vat_rate: '500' })).status, 400);
});

test('ricambio a mano: IVA salvata sulla riga e nel costo della riparazione', async () => {
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Gino IVA', phone: '3401112233' }, brand_model: 'Tab', problem: 'rotto' })).data;
  const out = (await a('POST', `/api/repairs/${r.id}/parts`, { name: 'Vetro', qty: 2, unit_cost: '10', unit_price: '40', vat_apply: true })).data;
  const part = out.parts[0];
  assert.equal(part.unit_cost, 12.2);
  assert.equal(part.cost_net, 10);
  assert.equal(part.vat_applied, 1);
  assert.equal(out.parts_cost, 24.4);
  const plain = (await a('POST', `/api/repairs/${r.id}/parts`, { name: 'Colla', qty: 1, unit_cost: '3', unit_price: '5' })).data.parts[1];
  assert.equal(plain.unit_cost, 3, 'senza flag il costo resta quello scritto');
});
