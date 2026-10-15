// Test delle notifiche Telegram con i dati veri (attraverso il middleware), della numerazione dopo un'eliminazione
// e dell'indirizzo per il bot di controllo (/api/monitor).  Esecuzione: npm run test:officina
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-notif-'));
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
const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => memoryMedia() },
  auth: async (c, next) => { c.set('user', { email: 'christian@test.it', name: 'Christian', role: 'admin' }); await next(); },
});
const pub = createPublicApp();
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const tick = () => new Promise((r) => setTimeout(r, 20));
/** Esegue la richiesta e restituisce { status, data, msgs } con i messaggi Telegram partiti. */
async function call(method, path, body, base = app, headers = {}) {
  const n = sent.length;
  const res = await base.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  await tick();
  return { status: res.status, data, msgs: sent.slice(n) };
}
const text = (r) => r.msgs.map((m) => m.text.replace(/<[^>]+>/g, '')).join('\n---\n'); // senza i tag HTML di Telegram
const newRepair = async (extra = {}) => (await call('POST', '/api/repairs', { customer: { name: 'Anna Verdi', phone: '3331112222' }, brand_model: 'iPhone 13', problem: 'Schermo', quote: 100, ...extra })).data;
const toReady = async (id) => { for (let i = 0; i < 8; i++) { const r = (await call('GET', `/api/repairs/${id}`)).data; if (r.status === 'ready') return; await call('POST', `/api/repairs/${id}/advance`); } };

test('numerazione: dopo aver eliminato una riparazione la successiva non riusa un codice esistente', async () => {
  const a = await newRepair();
  const b = await newRepair();
  const c = await newRepair();
  await toReady(b.id);
  await call('POST', `/api/repairs/${b.id}/deliver`, { method: 'carta' });
  assert.equal((await call('DELETE', `/api/repairs/${b.id}`)).status, 200);
  const d = await call('POST', '/api/repairs', { customer: { name: 'Luca', phone: '3330000000' }, brand_model: 'Pixel', problem: 'Batteria' });
  assert.equal(d.status, 200, JSON.stringify(d.data));
  const n = (code) => Number(code.slice(-4));
  assert.equal(n(d.data.code), n(c.code) + 1);
  assert.ok(n(a.code) < n(c.code));
});

test('notifica di consegna: quote del pagamento diviso e buono, non "contanti"', async () => {
  const r = await newRepair({ quote: 185, deposit: 50, deposit_method: 'carta' });
  await call('POST', '/api/buoni', { kind: 'regalo', value: 30, code: 'REGALO-30' });
  await toReady(r.id);
  const out = await call('POST', `/api/repairs/${r.id}/deliver`, { final_price: 185, voucher_code: 'REGALO-30', payments: [{ method: 'carta', amount: 50 }, { method: 'contanti', amount: 55 }] });
  const t = text(out);
  assert.match(t, /Consegnata R-\d{4}-\d{4}/);
  assert.match(t, /già versati 50,00 €/);
  assert.match(t, /Incassato ora 105,00 €: carta 50,00 € \+ contanti 55,00 €/);
  assert.match(t, /REGALO-30: 30,00 €/);
  assert.doesNotMatch(t, /\(contanti\) · totale/);
});

test('notifica di vendita divisa e con buono sconto: metodi veri e sconto non doppio', async () => {
  const s = text(await call('POST', '/api/sales', { items: [{ name: 'Tablet', unit_price: 30 }], payments: [{ method: 'carta', amount: 10, payer: 'Anna' }, { method: 'contanti', amount: 20, payer: 'Luca' }] }));
  assert.match(s, /diviso: carta 10,00 € \(Anna\) \+ contanti 20,00 € \(Luca\)/);
  await call('POST', '/api/buoni', { kind: 'sconto_percentuale', value: 10, code: 'DIECI' });
  const v = text(await call('POST', '/api/sales', { items: [{ name: 'Cover', unit_price: 20 }], voucher_code: 'DIECI', method: 'contanti' }));
  assert.match(v, /DIECI: 2,00 € di sconto/);
  assert.doesNotMatch(v, /\nSconto /, 'lo sconto del buono non si ripete');
});

test('notifiche: carico merce, eliminazioni con importi, impostazioni cambiate davvero', async () => {
  const sup = (await call('POST', '/api/suppliers', { name: 'Ricambi Napoli' })).data;
  const p = (await call('POST', '/api/products', { name: 'Display X', qty: 2, price: 120, cost: 50 })).data;
  const load = text(await call('POST', `/api/products/${p.id}/load`, { qty: 10, supplier_id: sup.id, unit_price: '55,00', doc_number: 'DDT-7' }));
  assert.match(load, /Carico merce.*Display X/s);
  assert.match(load, /\+10 pz a 55,00 €.*Ricambi Napoli.*DDT-7/s);
  assert.doesNotMatch(load, /Prodotto creato/);

  const r = await newRepair({ quote: 60 });
  await toReady(r.id);
  await call('POST', `/api/repairs/${r.id}/deliver`, { method: 'satispay' });
  const del = text(await call('DELETE', `/api/repairs/${r.id}`));
  assert.match(del, new RegExp(`Riparazione eliminata ${r.code}`));
  assert.match(del, /Tolti dalla cassa 1 incasso per 60,00 €/);

  const set = await call('PUT', '/api/settings', { shop_name: 'Informatix Repair', ready_days: '5', stale_days: '90', terms: 'Nuove condizioni\nseconda riga' });
  const t = text(set);
  assert.match(t, /giorni pronta non ritirata: 7 → 5/);
  assert.match(t, /condizioni sulla scheda \(testo modificato\)/);
  assert.doesNotMatch(t, /nome negozio|giorni prodotto fermo/, 'i campi non cambiati non si elencano');
  assert.equal((await call('PUT', '/api/settings', { ready_days: '5' })).msgs.length, 0, 'salvare senza cambiare nulla non avvisa');
});

test('notifiche: dati sensibili (documento aperto, password copiata) e stampe silenziose', async () => {
  const cust = (await call('POST', '/api/customers', { name: 'Giulia Neri', phone: '3335550000' })).data;
  const doc = (await call('POST', '/api/documenti', { customer_id: cust.id, doc_type: 'carta_identita', data: { holder: 'Giulia Neri', number: 'CA1' }, consent: true, files: [{ side: 'fronte', mime: 'image/jpeg', data_b64: Buffer.from('X').toString('base64') }] })).data;
  const open = await call('GET', `/api/documenti/${doc.id}`);
  assert.match(text(open), /Documento d’identità aperto.*Giulia Neri/s);
  assert.doesNotMatch(text(open), /CA1/, 'mai i contenuti del documento');
  const sup = (await call('POST', '/api/suppliers', { name: 'Portale Ricambi' })).data;
  const cr = (await call('POST', '/api/credenziali', { supplier_id: sup.id, label: 'Ordini', username: 'chri', password: 'Segreta-123456' })).data;
  const rv = await call('POST', `/api/credenziali/${cr.id}/rivela`, { action: 'copia' });
  assert.match(text(rv), /Password copiata.*Ordini di Portale Ricambi/s);
  assert.doesNotMatch(text(rv), /Segreta/);
  const r = await newRepair();
  const pr = await call('GET', `/print/both/${r.id}`);
  assert.match(text(pr), new RegExp(`Stampa scheda cliente \\+ laboratorio ${r.code}`));
  assert.equal(pr.msgs[0].disable_notification, true, 'le stampe arrivano senza suono');
  assert.equal((await call('GET', `/print/both/${r.id}?noprint=1`)).msgs.length, 0, 'l’anteprima non avvisa');
  assert.equal((await call('GET', '/api/report')).msgs.length, 0);
});

test('/api/monitor: senza la chiave giusta non esiste; con la chiave dà i numeri veri', async () => {
  delete process.env.MONITOR_TOKEN;
  assert.equal((await call('GET', '/api/monitor', null, pub)).status, 404, 'senza segreto configurato');
  process.env.MONITOR_TOKEN = 'k'.repeat(40);
  assert.equal((await call('GET', '/api/monitor', null, pub)).status, 404, 'senza chiave');
  assert.equal((await call('GET', '/api/monitor', null, pub, { authorization: `Bearer ${'k'.repeat(39)}x` })).status, 404, 'chiave sbagliata');
  process.env.MONITOR_TOKEN = 'corta';
  assert.equal((await call('GET', '/api/monitor', null, pub, { authorization: 'Bearer corta' })).status, 404, 'chiave troppo corta = disattivato');
  process.env.MONITOR_TOKEN = 'k'.repeat(40);

  const before = (await call('GET', '/api/monitor', null, pub, { authorization: `Bearer ${'k'.repeat(40)}` })).data;
  await call('POST', '/api/sales', { items: [{ name: 'Cavo USB-C', unit_price: 9, qty: 2 }], method: 'contanti' });
  const ready = await newRepair({ brand_model: 'Galaxy S22' });
  await toReady(ready.id);
  await call('POST', '/api/usati', { name: 'iPhone 14', condition: 'usato', price: 450 });
  const u2 = (await call('POST', '/api/usati', { name: 'iPhone 15', condition: 'usato', price: 600 })).data;
  await call('POST', `/api/usati/${u2.slug}/sold`, {});
  const res = await call('GET', '/api/monitor', null, pub, { authorization: `Bearer ${'k'.repeat(40)}` });
  assert.equal(res.status, 200);
  const m = res.data;
  assert.equal(m.sales.today.n, before.sales.today.n + 1);
  assert.equal(Math.round((m.sales.today.total - before.sales.today.total) * 100), 1800);
  assert.ok(m.sales.today.items.some((i) => i.name === 'Cavo USB-C' && i.qty === 2));
  assert.equal(Math.round((m.cash.today.total - before.cash.today.total) * 100), 1800, 'l’incasso della vendita è in cassa');
  assert.ok(m.repairs.ready.some((r) => r.code === ready.code && r.model === 'Galaxy S22'));
  assert.equal(m.usati.total, 2);
  assert.equal(m.usati.in_vetrina, 1);
  assert.equal(m.usati.sold, 1);
  assert.ok(Array.isArray(m.users));
  const json = JSON.stringify(m);
  assert.doesNotMatch(json, /3331112222|passcode|password/i, 'niente telefoni né segreti');
});

test('colore del dispositivo: salvato, modificabile, visibile al cliente e sulle schede', async () => {
  const r = await newRepair({ color: ' Nero siderale ' });
  assert.equal(r.color, 'Nero siderale');
  const up = (await call('PATCH', `/api/repairs/${r.id}`, { color: 'Argento' })).data;
  assert.equal(up.color, 'Argento');
  assert.equal((await call('GET', `/api/track/${r.token}`, null, pub)).data.device.color, 'Argento');
  assert.match((await call('GET', `/print/customer/${r.id}?noprint=1`)).data, /Colore<\/span><b>Argento/);
  assert.ok((await call('GET', '/api/repairs?q=argento')).data.some((x) => x.id === r.id), 'si trova anche cercando il colore');
  assert.equal((await newRepair()).color, null, 'senza colore resta vuoto');
});

test('validità dei preventivi: si imposta dalle Impostazioni e vale per i nuovi preventivi', async () => {
  assert.equal((await call('GET', '/api/quotes/meta')).data.valid_days, 15);
  assert.equal((await call('PUT', '/api/settings', { quote_valid_days: '30' })).status, 200);
  assert.equal((await call('GET', '/api/quotes/meta')).data.valid_days, 30);
  await call('PUT', '/api/settings', { quote_valid_days: '15' });
});

const SIG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
test('preventivo online: link, vista senza dati personali, firma del cliente, una sola risposta', async () => {
  const q = (await call('POST', '/api/quotes', { customer_name: 'Luigi Bianchi', customer_phone: '3339998877', discount: 20, items: [{ description: 'PC gaming', qty: 1, unit_price: 700 }, { description: 'Windows', qty: 1, unit_price: 40 }] })).data;
  assert.equal((await call('GET', '/api/quote/inesistente', null, pub)).status, 404);
  assert.equal((await call('GET', '/api/quote/', null, pub)).status, 404);
  const link = await call('POST', `/api/quotes/${q.id}/link`, {});
  assert.equal(link.status, 200);
  assert.match(text(link), /Link online creato.*P-\d{4}-\d{4}/s);
  assert.equal((await call('POST', `/api/quotes/${q.id}/link`, {})).data.token, link.data.token, 'il codice resta lo stesso');
  assert.equal((await call('GET', `/api/quotes/${q.id}`)).data.status, 'inviato', 'la bozza diventa inviata');
  const v = (await call('GET', `/api/quote/${link.data.token}`, null, pub)).data;
  assert.equal(v.total, 720);
  assert.equal(v.can_answer, true);
  assert.doesNotMatch(JSON.stringify(v), /3339998877/, 'niente telefono nella pagina pubblica');
  const d = (a) => call('POST', `/api/quote/${link.data.token}/decision`, a, pub);
  assert.equal((await d({ action: 'accept' })).status, 400, 'la firma è obbligatoria');
  assert.equal((await d({ action: 'boh', image: SIG_PNG })).status, 400);
  assert.equal((await d({ action: 'accept', image: 'data:image/png;base64,AAAA' })).status, 400);
  const ok = await d({ action: 'accept', image: SIG_PNG, signer_name: 'Luigi Bianchi' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.decision, 'accettato');
  assert.match(text(ok), /Il cliente ha ACCETTATO il preventivo P-\d{4}-\d{4} \(firmato dal link\)/);
  assert.match(text(ok), /cliente \(dal link\)/);
  assert.equal((await d({ action: 'decline', image: SIG_PNG })).status, 409, 'una sola risposta');
  const adm = (await call('GET', `/api/quotes/${q.id}`)).data;
  assert.equal(adm.status, 'accettato');
  assert.equal(adm.signature.kind, 'accept');
  assert.equal(adm.signature.signer_name, 'Luigi Bianchi');
  assert.doesNotMatch(JSON.stringify(adm), /iVBORw0KGgo/, 'l’immagine della firma non esce nei dati');
});

test('preventivo online: scaduto, rifiutato e convertito non si possono più inviare né firmare', async () => {
  const q = (await call('POST', '/api/quotes', { customer_name: 'Paola', items: [{ description: 'Cavo', unit_price: 10 }] })).data;
  const t = (await call('POST', `/api/quotes/${q.id}/link`, {})).data.token;
  await call('POST', `/api/quote/${t}/decision`, { action: 'decline', image: SIG_PNG }, pub);
  assert.equal((await call('GET', `/api/quotes/${q.id}`)).data.status, 'rifiutato');
  assert.equal((await call('POST', `/api/quotes/${q.id}/link`, {})).status, 409, 'rifiutato: niente nuovo invio');
  const { raw } = await import('../db-node.mjs');
  const q2 = (await call('POST', '/api/quotes', { customer_name: 'Marta', items: [{ description: 'Mouse', unit_price: 5 }] })).data;
  const t2 = (await call('POST', `/api/quotes/${q2.id}/link`, {})).data.token;
  raw.prepare("UPDATE quotes SET valid_until = '2020-01-01' WHERE id = ?").run(q2.id);
  assert.equal((await call('GET', `/api/quote/${t2}`, null, pub)).data.can_answer, false);
  assert.equal((await call('POST', `/api/quote/${t2}/decision`, { action: 'accept', image: SIG_PNG }, pub)).status, 409);
  assert.equal((await call('POST', `/api/quotes/${q2.id}/link`, {})).status, 409, 'scaduto: niente invio');
});

test('acconto: metodo scelto, diviso su più metodi, ogni quota in cassa e nell’avviso', async () => {
  const r = await newRepair({ quote: 300 });
  const before = (await call('GET', '/api/report')).data;
  const one = await call('POST', `/api/repairs/${r.id}/deposit`, { amount: '20,00', method: 'carta' });
  assert.equal(one.status, 200);
  assert.match(text(one), /Acconto 20,00 € \(carta\)/);
  const split = await call('POST', `/api/repairs/${r.id}/deposit`, { payments: [{ method: 'contanti', amount: 50 }, { method: 'carta', amount: '30,50' }] });
  assert.equal(split.status, 200);
  assert.equal(split.data.deposit, 100.5);
  assert.match(text(split), /Acconto 80,50 € \(contanti 50,00 € \+ carta 30,50 €\)/);
  const rep = (await call('GET', '/api/report')).data;
  const by = (rows, m) => rows.find((x) => x.method === m)?.total || 0;
  assert.equal(Math.round((by(rep.by_method, 'carta') - by(before.by_method, 'carta')) * 100), 5050);
  assert.equal(Math.round((by(rep.by_method, 'contanti') - by(before.by_method, 'contanti')) * 100), 5000);
  for (const bad of [{ payments: [{ method: 'carta', amount: 10 }, { method: 'non tracciato', amount: 5 }] }, { payments: [{ method: 'buono', amount: 5 }] }, { payments: [{ method: 'carta', amount: 0 }] }, { amount: -5 }]) {
    assert.equal((await call('POST', `/api/repairs/${r.id}/deposit`, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call('GET', `/api/repairs/${r.id}`)).data.deposit, 100.5, 'le richieste rifiutate non registrano nulla');
});
