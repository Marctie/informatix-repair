// Test: "Data di inserimento" della riparazione (automatica o manuale con ora), limite di 7 giorni per la Cassa, errori parlanti.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-ins-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { parseEntryDate } = await import('../retro.mjs');
const { serve } = await import('@hono/node-server');

const auth = async (c, next) => { const role = c.req.header('x-role') || 'admin'; c.set('user', { email: `${role}@test.it`, name: role, role }); await next(); };
let srv, A;
before(async () => {
  srv = await new Promise((r) => { const s = serve({ fetch: createApps({ auth }).admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });
const a = async (method, path, body, role = 'admin') => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const loc = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
const ago = (h) => loc(new Date(Date.now() - h * 3600000));
const mk = (extra, role) => a('POST', '/api/repairs', { customer: { name: 'Mario Ins', phone: '3390001111' }, brand_model: 'Phone', problem: 'Schermo', ...extra }, role);

test('automatica: senza data vale adesso; manuale con ora di oggi viene rispettata', async () => {
  const r = await mk({});
  assert.equal(r.status, 200);
  const now = loc(new Date());
  assert.equal((await a('GET', `/api/repairs/${r.data.id}`)).data.created_at.slice(0, 10), now.slice(0, 10));
  const when = ago(1);
  if (when.slice(0, 10) === now.slice(0, 10)) { // evita il caso a cavallo di mezzanotte
    const m = await mk({ entry_date: when });
    assert.equal((await a('GET', `/api/repairs/${m.data.id}`)).data.created_at.slice(0, 16), when);
  }
});

test('manuale nei giorni passati con ora; futuro e date non valide rifiutati con codice e suggerimento', async () => {
  const when = ago(24 * 3 + 2);
  const m = await mk({ entry_date: when });
  assert.equal((await a('GET', `/api/repairs/${m.data.id}`)).data.created_at.slice(0, 16), when);
  assert.equal((await a('GET', '/api/audit?type=retroattivo')).data.rows.some((x) => x.detail.includes(when.slice(0, 10))), true);
  const fut = await mk({ entry_date: '2999-01-01 10:00' });
  assert.equal(fut.status, 400);
  assert.equal(fut.data.code, 'DATA_FUTURA');
  assert.ok(fut.data.hint);
  const bad = await mk({ entry_date: 'boh' });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.code, 'DATA_NON_VALIDA');
  assert.throws(() => parseEntryDate('2026-02-31 10:00'), /non esistono/);
});

test('Cassa: puo\' impostarla fino a 7 giorni indietro, oltre no; il resto resta all\'admin', async () => {
  const ok = await mk({ entry_date: ago(24 * 5) }, 'cassa');
  assert.equal(ok.status, 200);
  const old = await mk({ entry_date: ago(24 * 20) }, 'cassa');
  assert.equal(old.status, 403);
  assert.equal(old.data.code, 'DATA_TROPPO_VECCHIA');
  assert.equal((await a('POST', '/api/sales', { items: [{ name: 'X', qty: 1, unit_price: 1 }], method: 'contanti', entry_date: ago(24 * 2) }, 'cassa')).status, 403);
  assert.equal((await mk({ entry_date: ago(24 * 20) }, 'admin')).status, 200, 'admin senza limiti');
});

test('i report per periodo seguono la data di inserimento', async () => {
  const day = ago(24 * 40).slice(0, 10);
  const r = await mk({ entry_date: `${day} 09:15`, deposit: 30, deposit_method: 'contanti' });
  assert.equal(r.status, 200);
  assert.equal((await a('GET', `/api/report?from=${day}&to=${day}`)).data.total, 30);
  assert.equal((await a('GET', `/api/repairs/${r.data.id}`)).data.created_at.slice(0, 16), `${day} 09:15`);
});
