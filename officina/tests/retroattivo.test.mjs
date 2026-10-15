// Test: inserimento retroattivo (vendite, riparazioni, acconti, consegne, spese con data passata) e correzione della data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-retro-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const { parseEntryDate } = await import('../retro.mjs');

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
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));

test('parseEntryDate: formato, futuro e date impossibili', () => {
  assert.equal(parseEntryDate('2026-03-05', '2026-10-15 10:00:00'), '2026-03-05 12:00:00');
  assert.equal(parseEntryDate('2026-03-05T09:30', '2026-10-15 10:00:00'), '2026-03-05 09:30:00');
  assert.throws(() => parseEntryDate('2026-13-01'), /non valida/);
  assert.throws(() => parseEntryDate('2026-02-31'), /non valida/);
  assert.throws(() => parseEntryDate('ieri'), /non valida/);
  assert.throws(() => parseEntryDate('2999-01-01'), /futuro/);
});

test('vendita con data passata: i report del periodo la rispettano', async () => {
  const d = daysAgo(40);
  const s = (await a('POST', '/api/sales', { items: [{ name: 'Cavo USB', qty: 1, unit_price: 9.9 }], method: 'contanti', entry_date: d })).data;
  assert.ok(s.id);
  assert.equal((await a('GET', `/api/sales/${s.id}`)).data.created_at.slice(0, 10), d);
  const inPeriod = (await a('GET', `/api/report?from=${d}&to=${d}`)).data;
  assert.equal(inPeriod.total, 9.9);
  const today = (await a('GET', `/api/report?from=${daysAgo(0)}&to=${daysAgo(0)}`)).data;
  assert.equal(today.total, 0, 'oggi non risulta nulla');
  // niente data: resta oggi
  await a('POST', '/api/sales', { items: [{ name: 'Penna', qty: 1, unit_price: 5 }], method: 'carta' });
  assert.equal((await a('GET', `/api/report?from=${daysAgo(0)}&to=${daysAgo(0)}`)).data.total, 5);
});

test('data futura o non valida: rifiutata e nulla viene scritto', async () => {
  const before = (await a('GET', '/api/sales')).data.length;
  const r1 = await a('POST', '/api/sales', { items: [{ name: 'X', qty: 1, unit_price: 1 }], method: 'contanti', entry_date: '2999-01-01' });
  assert.equal(r1.status, 400);
  const r2 = await a('POST', '/api/sales', { items: [{ name: 'X', qty: 1, unit_price: 1 }], method: 'contanti', entry_date: 'ieri' });
  assert.equal(r2.status, 400);
  assert.equal((await a('GET', '/api/sales')).data.length, before);
});

test('riparazione, acconto e consegna con date passate; tutto nel Registro', async () => {
  const d1 = daysAgo(30), d2 = daysAgo(20), d3 = daysAgo(10);
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Lucia Retro', phone: '3391230000' }, brand_model: 'Laptop', problem: 'Lento', entry_date: d1 })).data;
  assert.equal((await a('GET', `/api/repairs/${r.id}`)).data.created_at.slice(0, 10), d1);
  assert.equal((await a('POST', `/api/repairs/${r.id}/deposit`, { amount: 20, method: 'contanti', entry_date: d2 })).status, 200);
  const del = await a('POST', `/api/repairs/${r.id}/deliver`, { final_price: 80, method: 'carta', entry_date: d3 });
  assert.equal(del.status, 200);
  const rep = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(rep.delivered_at.slice(0, 10), d3);
  assert.equal((await a('GET', `/api/report?from=${d2}&to=${d2}`)).data.total, 20);
  assert.equal((await a('GET', `/api/report?from=${d3}&to=${d3}`)).data.total, 60);
  assert.equal((await a('GET', `/api/report?from=${daysAgo(0)}&to=${daysAgo(0)}`)).data.by_method.find((x) => x.method === 'carta').total, 5, 'oggi solo la vendita di prima, non la consegna passata');

  const log = (await a('GET', '/api/audit?type=retroattivo')).data;
  assert.ok(log.rows.length >= 4, 'ogni inserimento retroattivo e\' nel registro');
  assert.ok(log.rows.some((x) => x.detail.includes(d3.slice(0, 10))));
});

test('spesa con data passata: registrata e segnalata', async () => {
  const d = daysAgo(15);
  const e = await a('POST', '/api/expenses', { spent_on: d, description: 'Toner', amount: 30, category: 'altro', method: 'contanti', entry_date: d });
  assert.equal(e.status, 200);
  assert.equal(e.data.spent_on, d);
  assert.ok((await a('GET', '/api/audit?type=retroattivo')).data.rows.some((x) => /spesa/.test(x.detail)));
});

test('correzione della data di una vendita (amministratore) con registro', async () => {
  const s = (await a('POST', '/api/sales', { items: [{ name: 'Custodia', qty: 1, unit_price: 12 }], method: 'contanti' })).data;
  const d = daysAgo(3);
  const ok = await a('POST', '/api/retro/date', { type: 'sale', id: s.id, date: d });
  assert.equal(ok.status, 200);
  assert.equal((await a('GET', `/api/report?from=${d}&to=${d}`)).data.total, 12);
  assert.equal((await a('POST', '/api/retro/date', { type: 'sale', id: s.id, date: '2999-01-01' })).status, 400);
  assert.equal((await a('POST', '/api/retro/date', { type: 'boh', id: 1, date: d })).status, 400);
  assert.equal((await a('POST', '/api/retro/date', { type: 'sale', id: 99999, date: d })).status, 404);
  assert.ok((await a('GET', '/api/audit?type=retroattivo')).data.rows.some((x) => x.action === 'modifica' && /da .* a /.test(x.detail)));
});
