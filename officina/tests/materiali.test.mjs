// Test: materiali da ordinare (aggregazione, segna ordinato, promemoria Telegram) e preventivo dalla riparazione.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-mat-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const M = await import('../materiali.mjs');

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

const ENV = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_OWNER_ID: '1' };
const fakeFetch = () => { const sent = []; const f = async (url, init) => { sent.push(JSON.parse(init.body).text); return { ok: true }; }; f.sent = sent; return f; };

test('materiali: aggrega ordini e ricambi di riparazione per fornitore e segna ordinato in blocco', async () => {
  const sup = (await a('POST', '/api/suppliers', { name: 'RicambiSud', phone: '3331234567', email: 'r@sud.it' })).data;
  const cust = (await a('POST', '/api/customers', { name: 'Mario Bianchi', phone: '3330000001' })).data;
  assert.deepEqual((await a('GET', '/api/materiali')).data, { count: 0, groups: [] });

  const o = (await a('POST', '/api/orders', { kind: 'cliente', customer_id: cust.id, supplier_id: sup.id, items: [{ description: 'Cover', qty: 2, unit_price: 9 }] })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: cust.id }, brand_model: 'iPhone 12', problem: 'display' })).data;
  // ricambio non a magazzino "da ordinare" con il nome del fornitore scritto diverso (maiuscole): deve finire nello stesso gruppo
  const r2 = (await a('POST', `/api/repairs/${rep.id}/parts`, { name: 'Display iPhone 12', qty: 1, unit_price: 90, unit_cost: 50, supplier_name: 'ricambisud', supplier_code: 'D12', to_order: true })).data;
  await a('POST', `/api/repairs/${rep.id}/parts`, { name: 'Vite', qty: 1, unit_price: 1 }); // non da ordinare
  const other = (await a('POST', `/api/repairs/${rep.id}/parts`, { name: 'Batteria', qty: 1, unit_price: 40, supplier_name: 'Altro Fornitore', to_order: true })).data;
  assert.ok(other.parts.find((p) => p.name === 'Batteria').order_state === 'da_ordinare');

  const m = (await a('GET', '/api/materiali')).data;
  assert.equal(m.count, 3);
  const g = m.groups.find((x) => x.supplier_id === sup.id);
  assert.equal(g.lines.length, 2);
  assert.deepEqual(g.order_ids, [o.id]);
  assert.equal(g.part_ids.length, 1);
  assert.match(g.text, /2× Cover/);
  assert.match(g.text, /1× Display iPhone 12 \(cod\. D12\)/);
  assert.ok(m.groups.some((x) => x.supplier_name === 'Altro Fornitore' && !x.supplier_id));

  assert.equal((await a('POST', '/api/materiali/mark-ordered', {})).status, 400);
  const done = (await a('POST', '/api/materiali/mark-ordered', { order_ids: g.order_ids, part_ids: g.part_ids })).data;
  assert.deepEqual([done.orders, done.parts], [1, 1]);
  assert.equal((await a('GET', `/api/orders/${o.id}`)).data.status, 'ordinato');
  assert.equal((await a('GET', '/api/materiali')).data.count, 1, 'resta solo la batteria');
  // idempotente: non risegna cio' che e' gia' ordinato
  assert.deepEqual((await a('POST', '/api/materiali/mark-ordered', { part_ids: g.part_ids })).data.parts, 0);
  const st = (await a('POST', `/api/materiali/parts/${r2.parts.find((p) => p.name === 'Display iPhone 12').id}/state`, { state: 'arrivato' })).data;
  assert.equal(st.order_state, 'arrivato');
  assert.equal((await a('POST', `/api/materiali/parts/${st.id}/state`, { state: 'boh' })).status, 400);
});

test('materiali: promemoria giornaliero solo se c\'e\' materiale, all\'orario e nei giorni scelti, una volta al giorno', async () => {
  // c'e' ancora la batteria da ordinare. Giovedi' 2026-10-15
  let f = fakeFetch();
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-15 11:59:00')).reason, 'orario', 'prima delle 12:00 non parte');
  assert.equal((await M.notifyMaterialsDue({}, f, '2026-10-15 12:00:00')).reason, 'telegram');
  const r = await M.notifyMaterialsDue(ENV, f, '2026-10-15 12:00:30');
  assert.equal(r.sent, true);
  assert.match(f.sent[0], /Materiali da ordinare/);
  assert.match(f.sent[0], /Batteria/);
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-15 12:01:00')).reason, 'gia_inviato');
  assert.equal(f.sent.length, 1);
  // sabato: giorno non lavorativo
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-17 12:00:00')).reason, 'giorno');
  // venerdi' oltre la finestra: si aspetta
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-16 14:30:00')).reason, 'orario');
  // orario personalizzato dalle Impostazioni (valori non validi respinti)
  assert.equal((await a('PUT', '/api/settings', { materials_reminder_time: '25:00' })).status, 400);
  assert.equal((await a('PUT', '/api/settings', { materials_reminder_days: '1,9' })).status, 400);
  assert.equal((await a('PUT', '/api/settings', { materials_reminder_time: '09:30', materials_reminder_days: '1,2,3,4,5,6' })).status, 200);
  assert.deepEqual((await a('GET', '/api/materiali/config')).data, { enabled: true, time: '09:30', days: [1, 2, 3, 4, 5, 6] });
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-17 09:31:00')).sent, true, 'sabato ora e\' incluso');
  // spento
  await a('PUT', '/api/settings', { materials_reminder_enabled: '0' });
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-19 09:31:00')).reason, 'spento');
  await a('PUT', '/api/settings', { materials_reminder_enabled: '1' });
  // niente da ordinare: nessun messaggio
  const all = (await a('GET', '/api/materiali')).data.groups;
  for (const g of all) await a('POST', '/api/materiali/mark-ordered', { order_ids: g.order_ids, part_ids: g.part_ids });
  f = fakeFetch();
  assert.equal((await M.notifyMaterialsDue(ENV, f, '2026-10-19 09:40:00')).reason, 'niente');
  assert.equal(f.sent.length, 0);
});
