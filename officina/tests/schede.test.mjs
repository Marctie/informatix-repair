// Test di checklist, schede stampabili, firme, preventivo a distanza e "non riparabile".  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-schede-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

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
const newRepair = async (extra = {}) => (await a('POST', '/api/repairs', { customer: { name: 'Anna Verdi', phone: '3470001122' }, brand_model: 'HP 250 G8', device_type: 'portatile', problem: 'Non si accende', ...extra })).data;

// ---------- Punto 15: checklist per tipo ----------
test('checklist: elenchi diversi per tipo, modificabili e ripristinabili', async () => {
  const all = (await a('GET', '/api/checklists')).data;
  assert.ok(all.smartphone.in.includes('Face ID / impronta'));
  assert.ok(!all.pc.in.includes('Face ID / impronta'), 'il PC non ha i controlli da smartphone');
  assert.ok(all.pc.in.includes('Ventole e temperature'));
  assert.ok(all.console.in.includes('Lettore dischi'));
  assert.equal(all.pc.custom, false);

  const saved = (await a('PUT', '/api/checklists/pc', { in: ['Si accende', ' Si accende ', 'Scheda video', ''], out: ['Collaudo 1h'] })).data;
  assert.deepEqual(saved.in, ['Si accende', 'Scheda video'], 'spazi tolti e doppioni eliminati');
  assert.deepEqual(saved.out, ['Collaudo 1h']);
  assert.ok(saved.pre.length, 'gli elenchi non toccati restano quelli predefiniti');
  assert.equal(saved.custom, true);
  assert.equal((await a('GET', '/api/checklists')).data.smartphone.custom, false, 'gli altri tipi non cambiano');

  assert.equal((await a('PUT', '/api/checklists/inesistente', { in: ['x'] })).status, 400);
  assert.equal((await a('PUT', '/api/checklists/pc', { in: 'non un elenco' })).status, 400);
  assert.equal((await a('PUT', '/api/checklists/pc', {})).status, 400);

  const reset = (await a('DELETE', '/api/checklists/pc')).data;
  assert.equal(reset.custom, false);
  assert.ok(reset.in.includes('POST / video'));
});

test('meta: etichette dipendenti dal tipo (IMEI solo per telefoni e tablet)', async () => {
  const m = (await a('GET', '/api/meta')).data;
  assert.match(m.device_types.smartphone.serial, /IMEI/);
  assert.doesNotMatch(m.device_types.pc.serial, /IMEI/);
  assert.match(m.device_types.pc.passcode, /Password/);
});

test('controlli compilati: si salvano nella riparazione con utente e data', async () => {
  const r = await newRepair();
  assert.equal(r.checklist_in, null);
  const items = [{ l: 'Si accende', s: 'ko' }, { l: 'Tastiera', s: 'ok' }, { l: 'Webcam e microfono', s: 'na' }, { l: 'Audio', s: null }, { l: 'Voce strana', s: 'boh' }];
  const out = (await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'in', items })).data;
  assert.equal(out.ok, true);
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.checklist_in.items.length, 5);
  assert.deepEqual(got.checklist_in.items.map((i) => i.s), ['ko', 'ok', 'na', null, null], 'stati non validi diventano vuoti');
  assert.ok(got.checklist_in.by && got.checklist_in.at);
  assert.equal(got.checklist_out, null);
  assert.ok(got.events.some((e) => /Controllo all’ingresso compilato/.test(e.note) && !e.is_public), 'resta in cronologia, solo interna');
  assert.equal((await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'zzz', items })).status, 400);
  assert.equal((await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'out', items: 'x' })).status, 400);
  assert.equal((await a('PUT', '/api/repairs/99999/checklist', { phase: 'in', items })).status, 404);
  // nell'elenco delle riparazioni non viaggia il JSON dei controlli
  const list = (await a('GET', '/api/repairs?q=HP')).data;
  assert.equal(list[0].checklist_in, undefined);
  // il tracciamento pubblico non li espone
  assert.ok(!JSON.stringify((await call(P, 'GET', `/api/track/${r.token}`)).data).includes('Tastiera'));
});

test('stampa scheda laboratorio: voci del tipo, etichette corrette', async () => {
  const r = await newRepair({ device_type: 'pc', brand_model: 'PC fisso Asus', serial: 'SN-123' });
  const html = (await a('GET', `/print/lab/${r.id}?noprint=1`)).data;
  assert.match(html, /Ventole e temperature/);
  assert.doesNotMatch(html, /Face ID/);
  assert.doesNotMatch(html, /IMEI/);
  assert.match(html, /Numero di serie/);
});
