// Test: Assistente. L'LLM propone, il server controlla, SEMPRE riepilogo + conferma; l'esecuzione passa dalle rotte vere (ruoli, Registro, Telegram);
// coda con PC spento; cronologia 30 giorni; allegati; chiave del programma sul PC. L'LLM e' finto: qui si prova tutto il resto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-assist-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.VAULT_KEY = 'chiave-di-prova-solo-per-i-test-0123456789';
process.env.TELEGRAM_BOT_TOKEN = '123456:TOKEN-FINTO-SOLO-PER-I-TEST-000000000';
process.env.TELEGRAM_OWNER_ID = '1';
const TOKEN = 'token-assistente-di-prova-0123456789abcdef';
process.env.ASSISTANT_TOKEN = TOKEN;
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(opts.body)); return new Response('{"ok":true}'); }
  return realFetch(url, opts);
};
const { closeDb } = await import('../db-node.mjs');
const { db } = await import('../dbref.mjs');
const { createAdminApp, createPublicApp } = await import('../app.mjs');
const { memoryMedia } = await import('../media.mjs');
const { draftPublisher } = await import('../publisher.mjs');
const { purgeAssistant } = await import('../assistente.mjs');
const { notifyAssistantBacklog, describeEvent } = await import('../notify.mjs');
const media = memoryMedia();
const USERS = {
  admin: { email: 'christian@test.it', name: 'Christian', role: 'admin' },
  staff: { email: 'staff@test.it', name: 'Staff', role: 'staff' },
  cassa: { email: 'cassa@test.it', name: 'Cassa', role: 'cassa' },
};
const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => media },
  auth: async (c, next) => { c.set('user', USERS[c.req.header('x-role') || 'admin']); await next(); },
});
const pub = createPublicApp({ media: () => media });
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (method, path, body, role = 'admin') => {
  const n = sent.length;
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  await new Promise((r) => setTimeout(r, 25));
  return { status: res.status, data, msgs: sent.slice(n).map((m) => m.text.replace(/<[^>]+>/g, '')).join('\n---\n') };
};
const agent = async (method, path, body, token = TOKEN) => {
  const res = await pub.request(path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: res.status === 204 ? null : ct.includes('json') ? await res.json() : await res.text(), res };
};
/** Simula il PC: prende la richiesta in coda e risponde con quello che direbbe l'LLM. */
const llm = async (reply, actions = [], extra = {}) => {
  const claim = await agent('POST', '/api/assistant-agent/claim', { ollama: true, models: ['gemma3:12b'] });
  assert.equal(claim.status, 200, 'una richiesta in coda doveva essere assegnata');
  const out = await agent('POST', `/api/assistant-agent/${claim.data.id}/result`, { content: JSON.stringify({ reply, suggestions: ['Controlla le foto.'], actions, ...extra }), model: 'gemma3:12b', duration_ms: 1234 });
  assert.equal(out.status, 200);
  return claim.data;
};
const ask = async (text, role = 'admin', file) => {
  const r = await call('POST', '/api/assistant/message', { text, ...(file ? { file } : {}) }, role);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.id;
};
const get = async (id, role = 'admin') => (await call('GET', '/api/assistant/requests', null, role)).data.requests.find((x) => x.id === id);

let phone; let iphone; let repair; let ipad;
test('preparazione: articolo, riparazione e usato di prova', async () => {
  iphone = (await call('POST', '/api/products', { name: 'Display iPhone 12', category: 'Ricambi', qty: 2, min_qty: 1, cost: 40, price: 99 })).data;
  assert.ok(iphone.id);
  repair = (await call('POST', '/api/repairs', { customer: { name: 'Mario Rossi', phone: '333 1234567' }, brand_model: 'iPhone 11', problem: 'Schermo rotto' })).data;
  assert.match(repair.code, /^R-/);
  ipad = (await call('POST', '/api/usati?publish=0', { name: 'iPad 9', condition: 'usato', category: 'computer', price: 250, memory: '64 GB' })).data;
  assert.ok(ipad.slug);
});

test('il programma sul PC senza chiave (o con chiave sbagliata) non trova nulla: 404', async () => {
  for (const t of [null, 'sbagliata-sbagliata-sbagliata-sbagliata']) {
    assert.equal((await agent('POST', '/api/assistant-agent/claim', {}, t)).status, 404);
    assert.equal((await agent('POST', '/api/assistant-agent/1/result', { content: '{}' }, t)).status, 404);
    assert.equal((await agent('GET', '/api/assistant-agent/1/file', null, t)).status, 404);
  }
});

test('messaggio -> in coda; PC spento: lo stato lo dice; il PC si fa sentire: lo stato cambia', async () => {
  assert.equal((await call('GET', '/api/assistant/status')).data.agent_online, false);
  const id = await ask('carica 3 display iPhone 12');
  const r = await get(id);
  assert.equal(r.status, 'queued');
  assert.equal((await call('GET', '/api/assistant/status')).data.queued >= 1, true);
  const claim = await llm('Ho preparato il carico.', [{ type: 'stock_move', product: String(iphone.id), fields: { delta: 3, reason: 'carico' } }]);
  assert.match(claim.system, /Display iPhone 12/, 'il PC riceve i dati veri del gestionale');
  assert.match(claim.system, /R-\d{4}-\d+/);
  assert.match(claim.system, /SOTTO SCORTA \(quantità ≤ scorta minima\): nessuno|SOTTO SCORTA \(quantità ≤ scorta minima\): .*Display iPhone 12/, "l'elenco sotto scorta lo calcola il server");
  assert.equal(claim.kind, 'text');
  assert.equal((await call('GET', '/api/assistant/status')).data.agent_online, true);
  assert.equal((await call('GET', '/api/assistant/status')).data.llm_ready, true);
  // niente da assegnare: 204
  assert.equal((await agent('POST', '/api/assistant-agent/claim', {})).status, 204);
});

test('RIEPILOGO PRIMA: l\'LLM ha proposto ma nulla e\' cambiato finche\' non si conferma', async () => {
  const r = (await call('GET', '/api/assistant/requests')).data.requests.at(-1);
  assert.equal(r.status, 'awaiting_confirm');
  assert.equal(r.actions[0].valid, true);
  assert.match(r.actions[0].lines.join(' '), /Giacenza: 2 → 5 pz/);
  assert.equal(r.actions[0].req, undefined, 'la richiesta interna non esce dal server');
  assert.equal((await call('GET', `/api/products?q=Display`)).data[0].qty, 2, 'magazzino invariato prima della conferma');
});

test('conferma -> esegue dalle rotte vere: magazzino, Registro, Telegram; la seconda conferma e\' rifiutata', async () => {
  const id = (await call('GET', '/api/assistant/requests')).data.requests.at(-1).id;
  const c = await call('POST', `/api/assistant/requests/${id}/confirm`, {});
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.equal(c.data.done, 1);
  assert.equal((await call('GET', `/api/products?q=Display`)).data[0].qty, 5);
  assert.match(c.msgs, /Assistente: richiesta #\d+ confermata/);
  assert.match(c.msgs, /Display iPhone 12/);
  const audit = await db.prepare("SELECT * FROM audit_log WHERE object_type = 'assistente'").all();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].user_email, 'christian@test.it');
  assert.equal((await call('POST', `/api/assistant/requests/${id}/confirm`, {})).status, 409);
  assert.equal((await get(id)).status, 'done');
});

test('stato di una riparazione e nota: stesso percorso dell\'interfaccia; "consegnata" e stati non ammessi sono rifiutati', async () => {
  const id = await ask(`${repair.code} è pronta`);
  await llm('Propongo di metterla pronta.', [
    { type: 'repair_status', repair: repair.code, fields: { status: 'ready', note: 'Puoi ritirarla' } },
    { type: 'repair_status', repair: repair.code, fields: { status: 'delivered' } },
    { type: 'repair_note', repair: repair.code, fields: { note: 'Cliente avvisato a voce' } },
  ]);
  const r = await get(id);
  assert.equal(r.actions[0].valid, true);
  assert.equal(r.actions[1].valid, false);
  assert.match(r.actions[1].errors.join(' '), /non si imposta dall’assistente/);
  assert.match(r.actions[2].lines.join(' '), /Nota interna: il cliente non la vede/);
  const c = await call('POST', `/api/assistant/requests/${id}/confirm`, {});
  assert.equal(c.data.done, 2);
  assert.equal(c.data.failed, 1);
  const rep = (await call('GET', `/api/repairs/${repair.id}`)).data;
  assert.equal(rep.status, 'ready');
  assert.ok(!rep.events.some((e) => /Cliente avvisato/.test(e.note || '') && e.is_public), 'la nota interna non e\' pubblica');
});

test('dati inventati dall\'LLM: id inesistenti, tipi sconosciuti (eliminazione), numeri assurdi -> mai eseguiti', async () => {
  const id = await ask('fai cose strane');
  await llm('ok', [
    { type: 'stock_move', product: '99999', fields: { delta: 1 } },
    { type: 'delete_item', product: String(iphone.id) },
    { type: 'update_product', product: String(iphone.id), fields: { price: -5 } },
    { type: 'stock_move', product: String(iphone.id), fields: { delta: -50 } },
    { type: 'repair_status', repair: 'R-1999-0001', fields: { status: 'ready' } },
    { type: 'usato_sold', usato: 'non-esiste' },
  ]);
  const r = await get(id);
  assert.equal(r.actions.length, 5, 'il tipo sconosciuto (delete_item) viene scartato');
  assert.ok(r.actions.every((a) => !a.valid));
  assert.equal(r.status, 'done', 'nessuna operazione eseguibile: niente da confermare');
  assert.equal((await call('GET', `/api/products?q=Display`)).data[0].qty, 5);
});

test('i dati cambiano fra riepilogo e conferma -> 409 e riepilogo rifatto', async () => {
  const id = await ask('scarica 4 display');
  await llm('Preparo lo scarico.', [{ type: 'stock_move', product: String(iphone.id), fields: { delta: -4, reason: 'vendita' } }]);
  assert.equal((await get(id)).actions[0].valid, true);
  await call('POST', `/api/products/${iphone.id}/move`, { delta: -3, reason: 'venduti al banco' }); // qualcun altro scarica: restano 2
  const c = await call('POST', `/api/assistant/requests/${id}/confirm`, {});
  assert.equal(c.status, 409);
  assert.equal(c.data.code, 'DATI_CAMBIATI');
  const r = await get(id);
  assert.equal(r.status, 'done', 'dopo il riepilogo rifatto non c\'e\' piu\' nulla di eseguibile (2 pz < 4)');
  assert.match(r.actions[0].errors.join(' '), /ci sono 2 pz/);
  assert.equal((await call('GET', `/api/products?q=Display`)).data[0].qty, 2);
});

test('nuovo articolo senza prezzo: il prezzo si scrive nel riepilogo; doppione = rifiutato', async () => {
  const id = await ask('nuovo articolo cavo usb-c');
  await llm('Preparo l\'articolo.', [
    { type: 'new_product', fields: { name: 'Cavo USB-C 1m', category: 'Accessori', qty: 10, cost: 1.2 } },
    { type: 'new_product', fields: { name: 'display iphone 12', qty: 1 } },
  ]);
  const r = await get(id);
  assert.equal(r.actions[0].valid, true);
  assert.equal(r.actions[0].editablePrice, true);
  assert.equal(r.actions[1].valid, false);
  assert.match(r.actions[1].errors.join(' '), /esiste già a magazzino/);
  const bad = await call('POST', `/api/assistant/requests/${id}/confirm`, { overrides: { 0: { price: 'abc' } } });
  assert.equal(bad.status, 400);
  assert.equal((await get(id)).status, 'awaiting_confirm', 'un prezzo sbagliato non brucia la richiesta');
  const c = await call('POST', `/api/assistant/requests/${id}/confirm`, { overrides: { 0: { price: '4,90' } } });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const p = (await call('GET', '/api/products?q=Cavo')).data[0];
  assert.equal(p.price, 4.9);
  assert.equal(p.qty, 10);
  assert.equal(p.cost, 1.2);
});

test('cliente e riparazione nuovi: telefono gia\' in anagrafica = cliente esistente, mai un doppione', async () => {
  const id = await ask('nuova riparazione');
  await llm('Preparo la scheda.', [
    { type: 'new_repair', fields: { customer_name: 'M. Rossi', customer_phone: '+39 333 1234567', device_type: 'telefono', brand_model: 'Samsung S21', problem: 'Non si accende', urgent: true } },
    { type: 'new_customer', fields: { name: 'Mario Rossi', phone: '3331234567' } },
  ]);
  const r = await get(id);
  assert.equal(r.actions[0].valid, true);
  assert.match(r.actions[0].lines[0], /Cliente esistente: Mario Rossi/);
  assert.equal(r.actions[1].valid, false);
  assert.match(r.actions[1].errors.join(' '), /C'è già un cliente con questo telefono/);
  const before = (await call('GET', '/api/customers')).data.length;
  const c = await call('POST', `/api/assistant/requests/${id}/confirm`, {});
  assert.equal(c.data.done, 1);
  assert.equal((await call('GET', '/api/customers')).data.length, before);
  assert.ok((await call('GET', '/api/repairs?q=Samsung')).data.some((x) => x.brand_model === 'Samsung S21' && x.urgent));
});

test('vetrina usati: nuovo articolo resta in bozza, venduto passa dalla rotta vera', async () => {
  const id = await ask('metti in vetrina un iPhone 13 e segna venduto l\'iPad');
  await llm('Preparo.', [
    { type: 'usato_add', fields: { name: 'iPhone 13', memory: '128 GB', color: 'Nero', condition: 'usato', conditionLabel: 'Usato ottimo', category: 'smartphone', price: 380, battery: 91, tagline: 'Un classico affidabile.' } },
    { type: 'usato_sold', usato: ipad.slug },
  ]);
  const r = await get(id);
  assert.ok(r.actions.every((a) => a.valid));
  assert.match(r.actions[0].lines.join(' '), /BOZZA/);
  const c = await call('POST', `/api/assistant/requests/${id}/confirm`, {});
  assert.equal(c.data.done, 2, JSON.stringify(c.data.results));
  const items = (await call('GET', '/api/usati')).data.items;
  assert.ok(items.find((i) => i.name === 'iPhone 13' && i.price === 380));
  assert.equal(items.find((i) => i.slug === ipad.slug).sold, true);
});

test('ruolo cassa: l\'LLM non vede i costi e l\'assistente non puo\' scrivere un costo', async () => {
  const id = await ask('quanti display ho?', 'cassa');
  const claim = await llm('Hai 2 display.');
  assert.doesNotMatch(claim.system, /\| costo \|/, 'nessuna colonna costo per la cassa');
  assert.doesNotMatch(claim.system, /Cavo USB-C 1m \| Accessori \| 10 \| 0 \| 4\.9 \| 1\.2/);
  const id2 = await ask('cambia costo e prezzo del display', 'cassa');
  await llm('ok', [{ type: 'update_product', product: String(iphone.id), fields: { price: 109, cost: 1 } }], {});
  const r = await get(id2, 'cassa');
  assert.ok(!r.actions[0].lines.some((l) => /Costo/.test(l)), 'il costo non compare nel riepilogo della cassa');
  const c = await call('POST', `/api/assistant/requests/${id2}/confirm`, {}, 'cassa');
  assert.equal(c.status, 200);
  const p = (await call('GET', `/api/products?q=Display`)).data[0];
  assert.equal(p.price, 109);
  assert.equal(p.cost, 40, 'il costo e\' rimasto quello vero');
  assert.ok(id);
});

test('visibilita\': ognuno vede e conferma solo le proprie richieste, l\'amministratore vede tutto', async () => {
  const id = await ask('richiesta di staff', 'staff');
  await llm('ok', [{ type: 'search', fields: { scope: 'products', query: 'display' } }, { type: 'usato_update', usato: ipad.slug, fields: { price: 240 } }]);
  assert.ok(!(await call('GET', '/api/assistant/requests', null, 'cassa')).data.requests.some((x) => x.id === id));
  assert.equal((await call('POST', `/api/assistant/requests/${id}/cancel`, {}, 'cassa')).status, 404);
  assert.equal((await call('POST', `/api/assistant/requests/${id}/confirm`, {}, 'cassa')).status, 404);
  assert.ok((await call('GET', '/api/assistant/requests', null, 'admin')).data.requests.some((x) => x.id === id));
  const r = await get(id, 'staff');
  assert.equal(r.actions[0].readOnly, true);
  assert.match(r.actions[0].lines.join(' '), /Display iPhone 12/);
  assert.equal((await call('POST', `/api/assistant/requests/${id}/cancel`, {}, 'staff')).status, 200);
  assert.equal((await get(id, 'staff')).status, 'cancelled');
});

test('errori del PC: ritentabile -> torna in coda; definitivo -> errore con "Riprova"', async () => {
  const id = await ask('prova errore');
  let claim = await agent('POST', '/api/assistant-agent/claim', {});
  await agent('POST', `/api/assistant-agent/${claim.data.id}/result`, { error: 'Ollama non risponde', retry: true });
  const q = await get(id);
  assert.equal(q.status, 'queued');
  assert.equal(q.attempts, 1);
  assert.equal((await agent('POST', '/api/assistant-agent/claim', {})).status, 204, 'il nuovo tentativo parte dopo una pausa');
  await db.prepare('UPDATE assistant_requests SET retry_at = NULL WHERE id = ?').run(id);
  claim = await agent('POST', '/api/assistant-agent/claim', {});
  await agent('POST', `/api/assistant-agent/${claim.data.id}/result`, { error: 'Modello non trovato', retry: false });
  assert.equal((await get(id)).status, 'error');
  assert.equal((await call('POST', `/api/assistant/requests/${id}/retry`, {})).status, 200);
  assert.equal((await get(id)).status, 'queued');
  claim = await agent('POST', '/api/assistant-agent/claim', {});
  const bad = await agent('POST', `/api/assistant-agent/${claim.data.id}/result`, { content: 'non è json {' });
  assert.equal(bad.status, 200);
  assert.equal((await get(id)).status, 'queued', 'risposta illeggibile: si riprova');
  await call('POST', `/api/assistant/requests/${id}/cancel`, {});
});

test('allegati: CSV letto come testo, foto salvata e scaricabile solo dal PC con la chiave', async () => {
  const csv = Buffer.from('Articolo;Qta;Costo\nDisplay iPhone 12;4;38,50\nSpedizione;1;9\n').toString('base64');
  const id1 = await ask('ordine fornitore', 'admin', { name: 'ordine.csv', type: 'text/csv', data: csv });
  const c1 = await llm('Ho letto l\'ordine.', [
    { type: 'stock_move', product: String(iphone.id), fields: { delta: 4, reason: 'carico ordine TechWholesale' } },
    { type: 'new_product', fields: { name: 'Spedizione', qty: 1 } },
  ]);
  assert.match(c1.user, /CONTENUTO DEL DOCUMENTO "ordine.csv"/);
  assert.match(c1.user, /Display iPhone 12;4;38,50/);
  const r1 = await get(id1);
  assert.equal(r1.actions.length, 1, 'la riga "Spedizione" non e\' un prodotto: scartata');
  assert.match(r1.reply, /Lettura automatica del documento/);
  await call('POST', `/api/assistant/requests/${id1}/cancel`, {});

  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
  const id2 = await ask('foto del DDT', 'admin', { name: 'ddt.jpg', type: 'image/jpeg', data: jpg });
  const claim = await agent('POST', '/api/assistant-agent/claim', {});
  assert.equal(claim.data.kind, 'vision');
  assert.equal(claim.data.attachment.kind, 'image');
  const f = await agent('GET', `/api/assistant-agent/${id2}/file`);
  assert.equal(f.status, 200);
  assert.equal(f.res.headers.get('content-type'), 'image/jpeg');
  assert.equal((await agent('GET', `/api/assistant-agent/${id2}/file`, null, 'sbagliata-sbagliata-sbagliata-sbagliata')).status, 404);
  await agent('POST', `/api/assistant-agent/${id2}/result`, { error: 'prova', retry: false });
  // formato non ammesso / vuoto
  assert.equal((await call('POST', '/api/assistant/message', { text: 'x', file: { name: 'virus.exe', type: 'application/x-msdownload', data: csv } })).status, 400);
  assert.equal((await call('POST', '/api/assistant/message', { text: '' })).status, 400);
});

test('cronologia: si conservano 30 giorni (almeno 7), oltre vengono cancellate con gli allegati', async () => {
  const mk = async (days) => { const id = await ask(`vecchia di ${days} giorni`); await db.prepare("UPDATE assistant_requests SET status='done', created_at = datetime('now', ?, 'localtime') WHERE id = ?").run(`-${days} days`, id); return id; };
  const d8 = await mk(8); const d29 = await mk(29); const d31 = await mk(31);
  const removed = await purgeAssistant(media);
  assert.equal(removed >= 1, true);
  const ids = (await call('GET', '/api/assistant/requests')).data.requests.map((x) => x.id);
  assert.ok(ids.includes(d8), '8 giorni: ancora in cronologia');
  assert.ok(ids.includes(d29), '29 giorni: ancora in cronologia');
  assert.ok(!ids.includes(d31), '31 giorni: cancellata');
});

test('PC spento: dopo 10 minuti in coda arriva UN avviso Telegram, poi silenzio', async () => {
  await db.prepare("UPDATE assistant_state SET value = ? WHERE key = 'agent_seen'").run(String(Date.now() - 3600_000));
  const id = await ask('richiesta rimasta in coda');
  await db.prepare("UPDATE assistant_requests SET created_at = datetime('now', '-15 minutes', 'localtime') WHERE id = ?").run(id);
  const n = sent.length;
  assert.equal(await notifyAssistantBacklog(process.env), true);
  await new Promise((r) => setTimeout(r, 20));
  assert.match(sent.slice(n).map((m) => m.text).join('\n'), /Assistente: \d+ richiest[ae] in attesa/);
  assert.equal(await notifyAssistantBacklog(process.env), false, 'non ripete lo stesso avviso');
  await call('POST', `/api/assistant/requests/${id}/cancel`, {});
});

test('avviso Telegram: la conferma elenca cosa e\' stato fatto e cosa no', () => {
  const text = describeEvent({ method: 'POST', path: '/api/assistant/requests/7/confirm', status: 200, user: USERS.admin, result: { done: 1, failed: 1, text: 'carica 3 display', results: [{ ok: true, title: 'Movimento di magazzino: Display' }, { ok: false, title: 'Cambio stato: R-1', message: 'Già pronta' }] } });
  assert.match(text, /richiesta #7 confermata/);
  assert.match(text, /✅ Movimento di magazzino/);
  assert.match(text, /❌ Cambio stato: R-1 — Già pronta/);
  const msg = describeEvent({ method: 'POST', path: '/api/assistant/message', status: 200, user: USERS.admin, body: { text: 'carica 3 display', file: { name: 'ordine.pdf' } }, result: { ok: true, id: 9, status: { agent_online: false } } });
  assert.match(msg, /Assistente: nuova richiesta #9/);
  assert.match(msg, /carica 3 display/);
  assert.match(msg, /ordine\.pdf/);
  assert.match(msg, /PC con l’LLM spento/);
  assert.match(describeEvent({ method: 'POST', path: '/api/assistant/requests/9/cancel', status: 200, user: USERS.admin, result: { ok: true } }), /richiesta #9 annullata/);
});
