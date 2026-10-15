// Test: preventivo online inviabile dalla scheda riparazione.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-prq-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const { itemsFromRepair } = await import('../preventivo-riparazione.mjs');

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
const { localDate } = await import('../logic.mjs');
const inDays = (n) => { const d = new Date(`${localDate()}T12:00:00`); d.setDate(d.getDate() + n); return d; };
const ymd = (d) => d.toISOString().slice(0, 10); // d e' a mezzogiorno: nessuno scarto di fuso

test('voci del preventivo ricavate da riparazione: ricambi + manodopera, oppure voce unica', () => {
  assert.deepEqual(itemsFromRepair({ brand_model: 'X', problem: 'p', quote: 120, parts: [{ name: 'Display', qty: 1, unit_price: 80 }, { name: 'Vite', qty: 1, unit_price: 0 }] }),
    [{ description: 'Display', qty: 1, unit_price: 80 }, { description: 'Intervento di riparazione X', qty: 1, unit_price: 40 }]);
  assert.deepEqual(itemsFromRepair({ brand_model: 'X', problem: 'non si accende', quote: 50, parts: [] }), [{ description: 'Riparazione X: non si accende', qty: 1, unit_price: 50 }]);
  assert.deepEqual(itemsFromRepair({ brand_model: 'X', quote: null, parts: [] }), []);
});

test('preventivo dalla riparazione: crea e collega, validita\' predefinita o scelta, link pubblico, accettazione', async () => {
  const cust = (await a('POST', '/api/customers', { name: 'Anna Verdi', phone: '3335550001', email: 'anna@example.it' })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: cust.id }, brand_model: 'Galaxy S21', problem: 'display rotto' })).data;
  // senza importo: niente da far vedere al cliente
  assert.equal((await a('POST', `/api/repairs/${rep.id}/online-quote`, {})).status, 400);
  await a('PATCH', `/api/repairs/${rep.id}`, { quote: 100 });

  const info0 = (await a('GET', `/api/repairs/${rep.id}/online-quote`)).data;
  assert.equal(info0.quote, null);
  assert.equal(info0.phone, '3335550001');
  assert.equal(info0.default_days, 15);
  assert.equal(info0.items[0].unit_price, 100);

  assert.equal((await a('POST', `/api/repairs/${rep.id}/online-quote`, { valid_days: 0 })).status, 400);
  assert.equal((await a('POST', `/api/repairs/${rep.id}/online-quote`, { valid_days: 400 })).status, 400);
  assert.equal((await a('POST', `/api/repairs/${rep.id}/online-quote`, { valid_days: 5, via: 'piccione' })).status, 400);

  const out = (await a('POST', `/api/repairs/${rep.id}/online-quote`, { via: 'whatsapp' })).data;
  assert.equal(out.quote.status, 'inviato');
  assert.equal(out.quote.repair_id, rep.id);
  assert.equal(out.quote.valid_until, ymd(inDays(15)), 'predefinito: 15 giorni da Impostazioni');
  assert.equal(out.quote.sent_via, 'whatsapp');
  assert.ok(out.quote.sent_at);
  assert.match(out.url, /\/p\/[A-Za-z0-9_-]+$/);
  assert.match(out.text, /Galaxy S21/);
  assert.match(out.text, new RegExp(out.url.replace(/[/.]/g, '\\$&')));

  // il cliente apre il link pubblico
  const token = out.url.split('/p/')[1];
  const view = (await a('GET', `/api/quote/${token}`)).data;
  assert.equal(view.total, 100);
  assert.equal(view.can_answer, true);

  // richiamare riusa lo stesso preventivo e cambia la validita'
  const again = (await a('POST', `/api/repairs/${rep.id}/online-quote`, { valid_days: 30, via: 'link' })).data;
  assert.equal(again.quote.id, out.quote.id);
  assert.equal(again.url, out.url);
  assert.equal(again.quote.valid_until, ymd(inDays(30)));
  assert.equal(again.quote.sent_via, 'link');
  assert.equal((await a('GET', '/api/quotes?stato=inviato')).data.length, 1, 'un solo preventivo');

  // validita' predefinita modificata in Impostazioni
  await a('PUT', '/api/settings', { quote_valid_days: '7' });
  const rep2 = (await a('POST', '/api/repairs', { customer: { id: cust.id }, brand_model: 'Pixel 7', problem: 'batteria', quote: 60 })).data;
  const q2 = (await a('POST', `/api/repairs/${rep2.id}/online-quote`, {})).data;
  assert.equal(q2.quote.valid_until, ymd(inDays(7)));
  assert.notEqual(q2.quote.id, out.quote.id);

  // dopo l'accettazione del cliente non si rimodifica; la scheda lo mostra
  const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500, 7)]).toString('base64');
  const acc = await a('POST', `/api/quote/${token}/decision`, { action: 'accept', image: png, signer_name: 'Anna Verdi' });
  assert.equal(acc.status, 200);
  assert.equal((await a('GET', `/api/repairs/${rep.id}/online-quote`)).data.quote.status, 'accettato');
  assert.equal((await a('POST', `/api/repairs/${rep.id}/online-quote`, { valid_days: 10 })).status, 409);

  // riparazione conclusa: niente invio
  await a('POST', `/api/repairs/${rep2.id}/status`, { status: 'cancelled' });
  assert.equal((await a('POST', `/api/repairs/${rep2.id}/online-quote`, {})).status, 409);
});
