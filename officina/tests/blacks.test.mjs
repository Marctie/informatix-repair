// Test: Blacks (clienti segnalati) e notifica a Christian quando un cliente rifiuta un preventivo dal link online.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-blacks-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.VAULT_KEY = 'chiave-di-prova-solo-per-i-test-0123456789';
process.env.TELEGRAM_BOT_TOKEN = '123456:TOKEN-FINTO-SOLO-PER-I-TEST-000000000';
process.env.TELEGRAM_OWNER_ID = '1';

// Telegram finto: si raccolgono i messaggi invece di inviarli
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(opts.body)); return new Response('{"ok":true}'); }
  return realFetch(url, opts);
};

const { closeDb } = await import('../db-node.mjs');
const { createAdminApp, createPublicApp } = await import('../app.mjs');
const { memoryMedia } = await import('../media.mjs');
const { draftPublisher } = await import('../publisher.mjs');
// l'utente dipende dall'intestazione x-role (admin / staff)
const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => memoryMedia() },
  auth: async (c, next) => {
    const role = c.req.header('x-role') || 'admin';
    c.set('user', { email: `${role}@test.it`, name: role, role });
    await next();
  },
});
const pub = createPublicApp();
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const tick = () => new Promise((r) => setTimeout(r, 20));
async function call(method, path, body, base = app, headers = {}) {
  const n = sent.length;
  const res = await base.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  await tick();
  return { status: res.status, data, msgs: sent.slice(n) };
}
const staff = { 'x-role': 'staff' };
const text = (r) => r.msgs.map((m) => m.text.replace(/<[^>]+>/g, '')).join('\n---\n');

test('Blacks: segnalazione, controllo per telefono/nome, avviso alla scheda e alla vendita', async () => {
  const c = (await call('POST', '/api/customers', { name: 'Carlo Moroso', phone: '+39 333 123 4567' })).data;
  assert.equal((await call('POST', '/api/blacklist', { customer_id: c.id }, app, staff)).status, 400, 'il motivo e obbligatorio');
  const b = await call('POST', '/api/blacklist', { customer_id: c.id, reason: 'Insoluto (non ha pagato)', note: 'Debito di 80 euro', reported_on: '2026-09-01' }, app, staff);
  assert.equal(b.status, 200);
  assert.equal(b.data.name, 'Carlo Moroso');
  assert.equal(b.data.reported_by, 'staff@test.it');
  assert.equal((await call('POST', '/api/blacklist', { customer_id: c.id, reason: 'x' })).status, 409, 'una sola segnalazione attiva per cliente');
  assert.equal((await call('POST', '/api/blacklist', { name: 'Y', reason: 'x', reported_on: '2999-01-01' })).status, 400);

  // controllo: stesso telefono scritto in modo diverso, anche senza essere cliente registrato
  const chk = (await call('GET', '/api/blacklist/check?phone=3331234567')).data;
  assert.equal(chk.matches.length, 1);
  assert.equal(chk.matches[0].match, 'telefono');
  assert.equal((await call('GET', '/api/blacklist/check?name=carlo%20moroso')).data.matches[0].match, 'nome');
  assert.equal((await call('GET', '/api/blacklist/check?phone=3400000000&name=Altro')).data.matches.length, 0);

  // nuova scheda dello stesso cliente: avviso nella risposta e su Telegram
  const rep = await call('POST', '/api/repairs', { customer: { name: 'Carlo Moroso', phone: '3331234567' }, brand_model: 'Samsung A54', problem: 'Schermo' });
  assert.equal(rep.status, 200);
  assert.equal(rep.data.blacklist_alert.length, 1);
  assert.match(text(rep), /CLIENTE SEGNALATO \(Blacks\).*Carlo Moroso.*Insoluto/s);
  // vendita a lui
  const sale = await call('POST', '/api/sales', { items: [{ name: 'Cavo', qty: 1, unit_price: 5 }], method: 'contanti', customer_id: c.id });
  assert.equal(sale.data.blacklist_alert.length, 1);
  // il dettaglio cliente lo mostra
  assert.equal((await call('GET', `/api/customers/${c.id}`)).data.blacklist.length, 1);
  // un cliente qualunque no
  const ok = await call('POST', '/api/repairs', { customer: { name: 'Anna Bianchi', phone: '3470000000' }, brand_model: 'Pixel', problem: 'Batteria' });
  assert.deepEqual(ok.data.blacklist_alert, []);
  assert.doesNotMatch(text(ok), /SEGNALATO/);
});

test('Blacks: modifica per tutti, rimozione e ripristino solo amministratore, con motivo e registro', async () => {
  const id = (await call('GET', '/api/blacklist')).data[0].id;
  const up = await call('PUT', `/api/blacklist/${id}`, { reason: 'Insoluto (non ha pagato)', note: 'Debito di 95 euro' }, app, staff);
  assert.equal(up.data.note, 'Debito di 95 euro');
  assert.equal(up.data.phone, '+39 333 123 4567', 'i dati non inviati restano');

  const denied = await call('POST', `/api/blacklist/${id}/remove`, { removed_note: 'prova' }, app, staff);
  assert.equal(denied.status, 403, 'lo staff non puo rimuovere');
  assert.equal((await call('POST', `/api/blacklist/${id}/restore`, {}, app, staff)).status, 403);
  assert.equal((await call('POST', `/api/blacklist/${id}/remove`, {})).status, 400, 'serve il motivo della rimozione');
  const rm = await call('POST', `/api/blacklist/${id}/remove`, { removed_note: 'Ha saldato il debito' });
  assert.equal(rm.status, 200);
  assert.equal(rm.data.active, 0);
  assert.equal(rm.data.removed_by, 'admin@test.it');
  assert.equal((await call('GET', '/api/blacklist')).data.length, 0, 'l elenco attivo e vuoto');
  assert.equal((await call('GET', '/api/blacklist?all=1')).data.length, 1, 'ma lo storico resta');
  assert.equal((await call('GET', '/api/blacklist/check?phone=3331234567')).data.matches.length, 0);
  assert.equal((await call('POST', `/api/blacklist/${id}/restore`, {})).data.active, 1);

  const log = (await call('GET', '/api/audit?type=segnalazione')).data;
  assert.ok(log.rows.length >= 3, 'creazione, rimozione e ripristino nel Registro');
});

test('rifiuto del preventivo dal link: avviso a Christian con motivo e firmatario', async () => {
  const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const q = (await call('POST', '/api/quotes', { customer_name: 'Giulia Rifiuta', items: [{ description: 'Schermo OLED', qty: 1, unit_price: 180 }] })).data;
  const t = (await call('POST', `/api/quotes/${q.id}/link`, {})).data.token;
  const r = await call('POST', `/api/quote/${t}/decision`, { action: 'decline', image: SIG, signer_name: 'Giulia R.', reason: 'Troppo caro, ho trovato a 120' }, pub);
  assert.equal(r.status, 200);
  assert.equal(r.msgs.length, 1, 'un solo messaggio a Christian');
  const msg = text(r);
  assert.match(msg, /PREVENTIVO RIFIUTATO dal cliente/);
  assert.match(msg, /P-\d{4}-\d{4} · Giulia Rifiuta · totale/);
  assert.match(msg, /Firmato da: Giulia R\./);
  assert.match(msg, /Motivo: Troppo caro, ho trovato a 120/);
  assert.notEqual(r.msgs[0].disable_notification, true, 'con suono: e un evento importante');
  // il motivo e salvato e visibile nel gestionale
  assert.equal((await call('GET', `/api/quotes/${q.id}`)).data.signature.reason, 'Troppo caro, ho trovato a 120');

  // senza motivo: lo dice
  const q2 = (await call('POST', '/api/quotes', { customer_name: 'Paolo', items: [{ description: 'Cavo', unit_price: 10 }] })).data;
  const t2 = (await call('POST', `/api/quotes/${q2.id}/link`, {})).data.token;
  assert.match(text(await call('POST', `/api/quote/${t2}/decision`, { action: 'decline', image: SIG }, pub)), /Motivo: non indicato/);
  // l'accettazione resta un avviso diverso
  const q3 = (await call('POST', '/api/quotes', { customer_name: 'Sara', items: [{ description: 'Mouse', unit_price: 10 }] })).data;
  const t3 = (await call('POST', `/api/quotes/${q3.id}/link`, {})).data.token;
  const acc = text(await call('POST', `/api/quote/${t3}/decision`, { action: 'accept', image: SIG, reason: 'ignorato' }, pub));
  assert.match(acc, /ACCETTATO/);
  assert.doesNotMatch(acc, /Motivo/);
});
