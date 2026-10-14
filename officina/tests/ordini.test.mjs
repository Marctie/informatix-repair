// Test di Ordini, Preventivi e Promemoria.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-ord-'));
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
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const cust = async (name, phone) => (await a('POST', '/api/customers', { name, phone })).data;

// ---------- Ordini ----------
test('ordini: ordine per cliente con acconto tracciato in cassa, flusso di stati e saldo alla consegna', async () => {
  const tizio = await cust('Tizio Rossi', '3331110001');
  const sup = (await a('POST', '/api/suppliers', { name: 'AccessoriPlus' })).data;
  assert.equal((await a('POST', '/api/orders', { kind: 'cliente', items: [{ description: 'Pellicola', qty: 1, unit_price: 10 }] })).status, 400, 'serve il cliente');
  assert.equal((await a('POST', '/api/orders', { kind: 'cliente', customer_id: tizio.id, items: [] })).status, 400, 'serve almeno un articolo');
  assert.equal((await a('POST', '/api/orders', { kind: 'cliente', customer_id: tizio.id, items: [{ description: 'X', unit_price: 5 }], deposit: 9 })).status, 400, 'acconto oltre il totale');
  const o = (await a('POST', '/api/orders', { kind: 'cliente', customer_id: tizio.id, supplier_id: sup.id, items: [{ description: 'Pellicola vetro iPhone 13', qty: 2, unit_price: 12.5 }, { description: 'Cover', qty: 1, unit_price: 15 }], deposit: 10, deposit_method: 'carta' })).data;
  assert.match(o.code, /^O-\d{4}-0001$/);
  assert.equal(o.status, 'da_ordinare');
  assert.equal(o.total, 40);
  assert.equal(o.paid, 10);
  assert.equal(o.balance, 30);
  const rep = (await a('GET', '/api/report')).data;
  assert.ok(rep.by_kind?.some((k) => k.kind === 'order' && k.total === 10) || rep.rows?.some((p) => p.kind === 'order' && p.amount === 10), 'l’acconto compare in cassa');

  // lista da ordinare per fornitore
  const toOrder = (await a('GET', '/api/orders/to-order')).data;
  const g = toOrder.find((x) => x.supplier_id === sup.id);
  assert.equal(g.lines.length, 2);
  assert.equal(g.lines[0].for, 'Tizio Rossi');
  assert.equal((await a('POST', '/api/orders/mark-ordered', { ids: g.order_ids })).data.count, 1);
  assert.equal((await a('GET', `/api/orders/${o.id}`)).data.status, 'ordinato');
  assert.equal((await a('POST', `/api/orders/${o.id}/status`, { status: 'consegnato' })).status, 409, 'non si salta l’arrivo');

  // arrivato -> avviso nella campanella
  assert.equal((await a('POST', `/api/orders/${o.id}/status`, { status: 'arrivato' })).data.status, 'arrivato');
  const al = (await a('GET', '/api/alerts')).data;
  assert.ok(al.items.some((x) => x.type === 'order_arrived' && x.ref === o.id));

  // acconto aggiuntivo e consegna con saldo
  assert.equal((await a('POST', `/api/orders/${o.id}/deposit`, { amount: 100 })).status, 400);
  assert.equal((await a('POST', `/api/orders/${o.id}/deposit`, { amount: 5 })).data.paid, 15);
  const done = (await a('POST', `/api/orders/${o.id}/status`, { status: 'consegnato', collect: true, method: 'contanti' })).data;
  assert.equal(done.status, 'consegnato');
  assert.equal(done.balance, 0);
  assert.equal(done.paid, 40);
  assert.equal((await a('PUT', `/api/orders/${o.id}`, { notes: 'x' })).status, 409, 'ordine chiuso');
  assert.equal((await a('DELETE', `/api/orders/${o.id}`)).status, 409, 'con incassi non si elimina');
  assert.ok(!(await a('GET', '/api/alerts')).data.items.some((x) => x.type === 'order_arrived'));
});

test('ordini: ordine al fornitore per il negozio, filtri, modifica ed eliminazione', async () => {
  const o = (await a('POST', '/api/orders', { kind: 'fornitore', items: [{ description: 'HDD 1TB', qty: 3 }], expected_date: '2000-01-01' })).data;
  assert.equal(o.kind, 'fornitore');
  assert.equal((await a('POST', `/api/orders/${o.id}/deposit`, { amount: 5 })).status, 400);
  assert.equal((await a('GET', '/api/orders?stato=da_ordinare&q=HDD')).data.length, 1);
  assert.equal((await a('GET', '/api/orders?kind=cliente&q=HDD')).data.length, 0);
  const up = (await a('PUT', `/api/orders/${o.id}`, { notes: 'urgente', items: [{ description: 'HDD 2TB', qty: 1, unit_price: 80 }] })).data;
  assert.equal(up.total, 80);
  await a('POST', `/api/orders/${o.id}/status`, { status: 'ordinato' });
  assert.ok((await a('GET', '/api/alerts')).data.items.some((x) => x.type === 'order_late' && x.ref === o.id), 'ordine in ritardo');
  await a('POST', `/api/orders/${o.id}/status`, { status: 'annullato' });
  assert.equal((await a('DELETE', `/api/orders/${o.id}`)).data.ok, true);
  assert.equal((await a('GET', `/api/orders/${o.id}`)).status, 404);
});
