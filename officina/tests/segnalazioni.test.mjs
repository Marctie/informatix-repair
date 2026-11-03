// Test: Segnalazioni e richieste (task di Christian per Marco): creazione con foto, visibilità per ruolo, stati, commenti, report, avvisi Telegram.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-segn-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.VAULT_KEY = 'chiave-di-prova-solo-per-i-test-0123456789';
process.env.TELEGRAM_BOT_TOKEN = '123456:TOKEN-FINTO-SOLO-PER-I-TEST-000000000';
process.env.TELEGRAM_OWNER_ID = '1';
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(opts.body)); return new Response('{"ok":true}'); }
  return realFetch(url, opts);
};
const { closeDb } = await import('../db-node.mjs');
const { createAdminApp } = await import('../app.mjs');
const { memoryMedia } = await import('../media.mjs');
const { draftPublisher } = await import('../publisher.mjs');
const media = memoryMedia();
const USERS = { admin: { email: 'christian@test.it', name: 'Christian', role: 'admin' }, staff: { email: 'staff@test.it', name: 'Staff', role: 'staff' }, cassa: { email: 'cassa@test.it', name: 'Cassa', role: 'cassa' } };
const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => media },
  auth: async (c, next) => { c.set('user', USERS[c.req.header('x-role') || 'admin']); await next(); },
});
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
const call = async (method, path, body, role = 'admin') => {
  const n = sent.length;
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  await new Promise((r) => setTimeout(r, 20));
  return { status: res.status, data, msgs: sent.slice(n).map((m) => m.text.replace(/<[^>]+>/g, '')).join('\n---\n') };
};
const base = { kind: 'errore', title: 'Il prezzo non si salva', description: 'Nel preventivo scrivo 100 e quando riapro è vuoto.', page: 'riparazioni', path_text: 'Riparazioni → R-2026-0016 → Preventivo → Salva', expected: 'Deve restare 100 €', priority: 'alta', context: { url: 'https://x/#/riparazioni', ua: 'Edge', viewport: '1280x720', errors: [{ at: '10:00', msg: 'Errore 400' }] } };

test('creazione: campi obbligatori con messaggi parlanti', async () => {
  const a = await call('POST', '/api/tickets', { ...base, title: '' });
  assert.equal(a.status, 400); assert.equal(a.data.code, 'TITOLO_MANCANTE');
  assert.equal((await call('POST', '/api/tickets', { ...base, description: ' ' })).data.code, 'DESCRIZIONE_MANCANTE');
  assert.equal((await call('POST', '/api/tickets', { ...base, kind: 'boh' })).data.code, 'TIPO_NON_VALIDO');
  assert.equal((await call('POST', '/api/tickets', { ...base, priority: 'x' })).data.code, 'PRIORITA_NON_VALIDA');
  assert.equal((await call('POST', '/api/tickets', { ...base, images: ['AAAA'] })).data.code, 'FOTO_NON_JPEG');
  assert.equal((await call('POST', '/api/tickets', { ...base, images: Array(7).fill(JPEG) })).data.code, 'TROPPE_FOTO');
  assert.equal((await call('GET', '/api/tickets')).data.rows.length, 0, 'nessuna segnalazione a metà');
});

test('creazione con immagini: codice, avviso Telegram, report con e senza foto', async () => {
  const r = await call('POST', '/api/tickets', { ...base, images: [JPEG, JPEG] });
  assert.equal(r.status, 200);
  assert.equal(r.data.code, 'S-0001');
  assert.equal(r.data.status, 'nuova');
  assert.equal(r.data.photo_count, 2);
  assert.equal(r.data.context.errors[0].msg, 'Errore 400');
  assert.match(r.msgs, /Nuova segnalazione S-0001/);
  assert.match(r.msgs, /Il prezzo non si salva/);
  assert.match(r.msgs, /Percorso: Riparazioni/);
  assert.match(r.msgs, /2 immagini allegate/);
  const img = await app.request('/api/tickets/1/photo/1', { headers: { 'x-role': 'admin' } });
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
  const rep = (await call('GET', '/api/tickets/1/report')).data;
  assert.equal(rep.filename, 'S-0001.md');
  assert.match(rep.markdown, /# S-0001 · Il prezzo non si salva/);
  assert.match(rep.markdown, /Percorso fatto/); assert.match(rep.markdown, /Errore 400/); assert.match(rep.markdown, /\/api\/tickets\/1\/photo\/0/);
  assert.ok(!rep.markdown.includes('data:image'));
  assert.match((await call('GET', '/api/tickets/1/report?foto=1')).data.markdown, /!\[Immagine 2\]\(data:image\/jpeg;base64,/);
});

test('funzione nuova e domanda sono tipi come gli altri', async () => {
  const n = await call('POST', '/api/tickets', { kind: 'nuova', title: 'Stampa riepilogo mensile', description: 'Vorrei un PDF del mese con gli incassi.', priority: 'normale' });
  assert.equal(n.data.kind_label, 'Funzione nuova da aggiungere');
  assert.match(n.msgs, /Funzione nuova/);
  assert.match((await call('GET', `/api/tickets/${n.data.id}/report`)).data.markdown, /Cosa serve \(funzione nuova\)/);
});

test('visibilità: ognuno vede le proprie, l’admin tutte; solo l’admin cambia stato ed elimina', async () => {
  const s = (await call('POST', '/api/tickets', { ...base, title: 'Dalla cassa' }, 'cassa')).data;
  assert.equal(s.created_by, 'cassa@test.it');
  assert.deepEqual((await call('GET', '/api/tickets', null, 'cassa')).data.rows.map((x) => x.id), [s.id]);
  assert.equal((await call('GET', '/api/tickets/1', null, 'cassa')).status, 404, 'non vede quelle degli altri');
  assert.equal((await call('GET', '/api/tickets/1/photo/0', null, 'cassa')).status, 404);
  assert.ok((await call('GET', '/api/tickets')).data.rows.length >= 3);
  assert.equal((await call('PUT', `/api/tickets/${s.id}`, { status: 'risolta' }, 'cassa')).data.status, 'nuova', 'la Cassa non cambia lo stato');
  assert.equal((await call('GET', '/api/tickets/report', null, 'cassa')).status, 403);
  assert.equal((await call('DELETE', `/api/tickets/${s.id}`, null, 'cassa')).status, 403);
});

test('stati: lavorazione, domanda in attesa, risposta, chiusura, riapertura', async () => {
  const up = await call('PUT', '/api/tickets/1', { status: 'in_corso', note: 'Ci lavoro ora.' });
  assert.equal(up.data.status, 'in_corso');
  assert.match(up.msgs, /S-0001 aggiornata/); assert.match(up.msgs, /In lavorazione/); assert.match(up.msgs, /Ci lavoro ora/);
  await call('PUT', '/api/tickets/1', { status: 'in_attesa', note: 'Che modello è il telefono?' });
  const alerts = (await call('GET', '/api/alerts')).data.items.filter((a) => a.type === 'ticket');
  assert.equal(alerts.length, 1); assert.match(alerts[0].title, /S-0001: serve la tua risposta/);
  const ans = await call('POST', '/api/tickets/1/comments', { body: 'iPhone 13' });
  assert.equal(ans.data.reopened, true); assert.equal(ans.data.status, 'nuova');
  assert.match(ans.msgs, /Commento su S-0001/); assert.match(ans.msgs, /iPhone 13/);
  assert.equal((await call('POST', '/api/tickets/1/comments', { body: ' ' })).data.code, 'COMMENTO_VUOTO');
  const done = (await call('PUT', '/api/tickets/1', { status: 'risolta' })).data;
  assert.ok(done.closed_at);
  assert.equal((await call('GET', '/api/tickets?stato=chiuse')).data.rows.length, 1);
  assert.ok(!(await call('GET', '/api/tickets')).data.rows.some((x) => x.id === 1), 'le chiuse escono dalle aperte');
  assert.equal((await call('PUT', '/api/tickets/1', { status: 'boh' })).data.code, 'STATO_NON_VALIDO');
  assert.equal((await call('PUT', '/api/tickets/1', { status: 'nuova' })).data.closed_at, null, 'riaperta');
  const log = (await call('GET', '/api/tickets/1')).data.comments;
  assert.ok(log.some((c) => c.kind === 'stato' && /In lavorazione → In attesa/.test(c.body)));
});

test('foto aggiunte dopo, tolte, report di tutte le aperte, eliminazione, backup', async () => {
  const add = await call('POST', '/api/tickets/1/photo', { image: JPEG });
  assert.equal(add.data.photo_count, 3); assert.equal(add.msgs, '', 'nessun avviso per le foto aggiunte dopo');
  assert.equal((await call('DELETE', '/api/tickets/1/photo/0')).data.photo_count, 2);
  assert.equal((await call('DELETE', '/api/tickets/1/photo/9')).status, 404);
  const all = (await call('GET', '/api/tickets/report')).data;
  assert.ok(all.count >= 2); assert.match(all.markdown, /S-0001/);
  const before = media.store.size;
  const del = await call('DELETE', '/api/tickets/1');
  assert.equal(del.data.ok, true); assert.match(del.msgs, /Segnalazione eliminata/);
  assert.equal(media.store.size, before - 2, 'le immagini vanno via con la segnalazione');
  assert.equal((await call('GET', '/api/tickets/1')).status, 404);
  const bk = (await call('GET', '/api/backup')).data;
  assert.ok('tickets' in bk.tables && 'ticket_comments' in bk.tables);
});
