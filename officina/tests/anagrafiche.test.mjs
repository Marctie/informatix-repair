// Test: clienti azienda, IVA sui ricambi, inserimento retroattivo, blacklist, notifica rifiuto preventivo.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-anag-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const { validVat, validFiscalCode } = await import('../clienti.mjs');

let admin, pub, A, P;
const listen = (app) => new Promise((r) => { const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
before(async () => {
  const apps = createApps();
  admin = await listen(apps.admin);
  pub = await listen(apps.pub);
  A = `http://127.0.0.1:${admin.address().port}`;
  P = `http://127.0.0.1:${pub.address().port}`;
});
after(() => { admin.close(); pub.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (base, method, path, body, headers = {}) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const a = (m, p, b) => call(A, m, p, b);

// ---------- 1. Clienti azienda ----------
test('P.IVA e codice fiscale: validazione formale', () => {
  assert.ok(validVat('12345678903'));
  assert.ok(!validVat('12345678901'), 'cifra di controllo errata');
  assert.ok(!validVat('1234'));
  assert.ok(validFiscalCode('RSSMRA85T10A562S'));
  assert.ok(!validFiscalCode('RSSMRA85T10A562X'));
  assert.ok(validFiscalCode('12345678903'), 'CF numerico di societa');
});

test('cliente azienda: salva i dati fiscali, li cerca e li stampa', async () => {
  const bad = await a('POST', '/api/customers', { kind: 'azienda', name: 'Rossi SRL', company_name: 'Rossi SRL', vat_number: '12345678901' });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /Partita IVA/);
  assert.equal((await a('POST', '/api/customers', { name: 'X', zip: '123' })).status, 400);
  assert.equal((await a('POST', '/api/customers', { name: 'X', province: 'Milano' })).status, 400);
  assert.equal((await a('POST', '/api/customers', { name: 'X', pec: 'nonvalida' })).status, 400);

  const c = (await a('POST', '/api/customers', {
    kind: 'azienda', name: 'Rossi SRL', company_name: 'Rossi SRL', vat_number: 'IT 12345678903', fiscal_code: '12345678903',
    address: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'mi', sdi_code: 'abcdefg', pec: 'Rossi@Pec.it', phone: '0212345678',
  })).data;
  assert.equal(c.kind, 'azienda');
  assert.equal(c.vat_number, '12345678903', 'prefisso IT e spazi tolti');
  assert.equal(c.province, 'MI');
  assert.equal(c.sdi_code, 'ABCDEFG');
  assert.equal(c.pec, 'rossi@pec.it');

  assert.equal((await a('GET', '/api/customers?q=12345678903')).data.length, 1);
  assert.equal((await a('GET', '/api/customers?q=Milano')).data.length, 1);

  const upd = await a('PUT', `/api/customers/${c.id}`, { city: 'Torino' });
  assert.equal(upd.data.city, 'Torino');
  assert.equal(upd.data.vat_number, '12345678903', 'i campi non inviati restano');

  const r = (await a('POST', '/api/repairs', { customer: { id: c.id }, brand_model: 'Server HP', device_type: 'pc', problem: 'Non parte' })).data;
  const html = (await a('GET', `/print/customer/${r.id}?noprint=1`)).data;
  assert.match(html, /P\.IVA 12345678903/);
  assert.match(html, /SDI ABCDEFG/);
  assert.equal((await a('GET', '/api/repairs?q=12345678903')).data.length, 1);
});

test('i clienti privati restano com erano', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Mario Bianchi', phone: '3331112222' })).data;
  assert.equal(c.kind, 'privato');
  assert.equal(c.vat_number, null);
});
