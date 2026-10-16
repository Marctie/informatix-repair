// Test degli errori "parlanti": messaggio, code stabile, hint, mapper del database, 500 con riferimento.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-errori-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb, raw } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const { mapDbError, toResponse, HttpError } = await import('../errori.mjs');

let admin, A;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body, rawBody) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: rawBody ?? (body ? JSON.stringify(body) : undefined) });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const newRepair = async () => (await a('POST', '/api/repairs', { customer: { name: 'Anna Verdi', phone: '3470001122' }, brand_model: 'HP 250 G8', device_type: 'portatile', problem: 'Non si accende' })).data;

test('avanzamento senza preventivo: messaggio con codice scheda, code QUOTE_MISSING e hint', async () => {
  const r = await newRepair();
  const res = await a('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' });
  assert.equal(res.status, 400, 'stesso status di prima');
  assert.equal(res.data.ok, false);
  assert.equal(res.data.code, 'QUOTE_MISSING');
  assert.ok(res.data.error.includes(r.code), 'cita la riparazione');
  assert.match(res.data.error, /manca il preventivo/);
  assert.match(res.data.hint, /inserisci l’importo/i);
});

test('404 generici: code stabile, hint e numero del record richiesto', async () => {
  const res = await a('GET', '/api/repairs/99999');
  assert.equal(res.status, 404);
  assert.equal(res.data.code, 'RIPARAZIONE_NON_TROVATA');
  assert.match(res.data.error, /n\. 99999/);
  assert.ok(res.data.hint);
});

test('JSON non valido: 400 chiaro invece di salvare a vuoto', async () => {
  const res = await a('POST', '/api/customers', null, '{nome: rotto');
  assert.equal(res.status, 400);
  assert.equal(res.data.code, 'JSON_NON_VALIDO');
  assert.ok(res.data.hint);
  assert.equal((await a('POST', '/api/customers', null, '')).status, 400, 'corpo vuoto: nome mancante, ma non un crash');
});

test('consegna doppia: 409 con codice scheda; acconto su riparazione consegnata rifiutato (bug corretto)', async () => {
  const r = await newRepair();
  await a('PUT', `/api/repairs/${r.id}`, { quote: 50 });
  assert.equal((await a('POST', `/api/repairs/${r.id}/deliver`, { final_price: 50, method: 'contanti' })).status, 200);
  const again = await a('POST', `/api/repairs/${r.id}/deliver`, { final_price: 50, method: 'contanti' });
  assert.equal(again.status, 400, 'stesso status di prima');
  assert.equal(again.data.code, 'GIA_CONSEGNATA');
  assert.ok(again.data.error.includes(r.code));
  const dep = await a('POST', `/api/repairs/${r.id}/deposit`, { amount: 20, method: 'contanti' });
  assert.equal(dep.status, 409);
  assert.equal(dep.data.code, 'ACCONTO_SU_RIPARAZIONE_CONCLUSA');
  const cur = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(Number(cur.deposit || 0), 0, 'nessun acconto fantasma');
});

test('errori del database tradotti in italiano (UNIQUE, FOREIGN KEY, NOT NULL, CHECK)', () => {
  const u = mapDbError(new Error('UNIQUE constraint failed: customers.phone'));
  assert.equal(u.status, 409); assert.equal(u.code, 'DUPLICATO'); assert.match(u.message, /cliente.*telefono/);
  const f = mapDbError(new Error('FOREIGN KEY constraint failed'));
  assert.equal(f.status, 409); assert.equal(f.code, 'DATI_COLLEGATI');
  const n = mapDbError(new Error('NOT NULL constraint failed: repairs.problem'));
  assert.equal(n.status, 400); assert.equal(n.code, 'CAMPO_OBBLIGATORIO');
  assert.equal(mapDbError(new Error('CHECK constraint failed: qty')).code, 'VALORE_NON_AMMESSO');
  assert.equal(mapDbError(new Error('database is locked')).status, 503);
  assert.equal(mapDbError(new Error('boom')), null);
});

test('errore imprevisto: 500 con messaggio umano e codice di riferimento, mai lo stack; viene loggato con contesto', () => {
  const logged = [];
  const orig = console.error; console.error = (...x) => logged.push(x.join(' '));
  let r;
  try { r = toResponse(new Error('segreto interno: stack xyz'), { method: 'POST', path: '/api/sales', user: 'a@b.it', id: '7' }); } finally { console.error = orig; }
  assert.equal(r.status, 500);
  assert.match(r.body.ref, /^E-/);
  assert.ok(r.body.error.includes(r.body.ref));
  assert.ok(!JSON.stringify(r.body).includes('xyz'), 'niente dettagli interni al client');
  assert.ok(logged[0].includes(r.body.ref) && logged[0].includes('/api/sales') && logged[0].includes('a@b.it'));
  assert.equal(toResponse(new HttpError(409, 'x', 'MIO_CODICE'), {}).body.code, 'MIO_CODICE');
});

test('vincolo del database in una route: 409 parlante invece di 500', async () => {
  // il telefono non e' unico, ma il codice riparazione si': forzo il vincolo UNIQUE con un inserimento diretto sul DB temporaneo
  const r = await newRepair();
  assert.throws(() => raw.prepare("INSERT INTO repairs (code, token, customer_id, brand_model, problem) VALUES (?,?,?,?,?)").run(r.code, 'tok-x', r.customer_id, 'x', 'y'));
  const m = mapDbError((() => { try { raw.prepare("INSERT INTO repairs (code, token, customer_id, brand_model, problem) VALUES (?,?,?,?,?)").run(r.code, 'tok-y', r.customer_id, 'x', 'y'); } catch (e) { return e; } })());
  assert.equal(m.code, 'DUPLICATO');
  assert.match(m.message, /riparazione/);
});
