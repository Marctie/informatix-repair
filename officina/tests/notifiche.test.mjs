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

test('pagamenti sempre tracciati: "non tracciato" rifiutato su vendite, acconti, consegne e ordini (non solo nel conto diviso)', async () => {
  const sales0 = (await call('GET', '/api/sales')).data.length;
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'Prova', unit_price: 100 }], method: 'non tracciato' })).status, 400);
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'Prova', unit_price: 100 }], method: 'Non Tracciato' })).status, 400);
  assert.equal((await call('GET', '/api/sales')).data.length, sales0, 'nessuna vendita a metà');
  assert.equal((await call('POST', '/api/repairs', { customer: { name: 'X', phone: '3330000001' }, brand_model: 'Tel', problem: 'x', deposit: 10, deposit_method: 'non tracciato' })).status, 400);
  const r = await newRepair({ quote: 50 });
  await toReady(r.id);
  assert.equal((await call('POST', `/api/repairs/${r.id}/deliver`, { method: 'non tracciato' })).status, 400);
  assert.equal((await call('GET', `/api/repairs/${r.id}`)).data.status, 'ready', 'la consegna non è avvenuta');
  assert.equal((await call('POST', `/api/repairs/${r.id}/deliver`, { method: 'contanti' })).status, 200);
});

test('notifiche: etichette prodotto (template, logo, codici assegnati, etichette preparate) e anteprima muta', async () => {
  const list = (await call('GET', '/api/labels/templates')).data.templates;
  assert.equal(list.length, 1);
  // template creato, modificato, predefinito, eliminato
  const made = await call('POST', '/api/labels/templates', { ...list[0], name: 'Cavi 50 × 30', width: 50, height: 30 });
  assert.match(text(made), /Template etichetta creato.*Cavi 50 × 30.*50 × 30 mm/s);
  const mod = await call('PUT', `/api/labels/templates/${made.data.id}`, { ...made.data, name: 'Cavi rinominato' });
  assert.match(text(mod), /Template etichetta modificato.*Cavi rinominato/s);
  assert.match(text(await call('POST', `/api/labels/templates/${made.data.id}/default`)), /Template etichetta predefinito.*Cavi rinominato/s);
  assert.match(text(await call('DELETE', `/api/labels/templates/${made.data.id}`)), /Template etichetta eliminato.*Cavi rinominato/s);
  // l'anteprima dell'editor e' una lettura: nessun messaggio
  const prev = await call('POST', '/api/labels/preview', { template: list[0] });
  assert.equal(prev.status, 200);
  assert.equal(prev.msgs.length, 0, 'l’anteprima non deve mandare avvisi');
  // etichette preparate: conta, articoli, codici nuovi; senza suono
  const p = (await call('POST', '/api/products', { name: 'Cavo etichettato', qty: 5, price: 9.9 })).data;
  const prep = await call('POST', '/api/labels/prepare', { items: [{ product_id: p.id, qty: 4 }] });
  assert.match(text(prep), /Etichette prodotti: 4 etichette · 1 articolo.*Cavo etichettato.*Codici a barre nuovi assegnati: 1/s);
  assert.equal(prep.msgs[0].disable_notification, true, 'avviso silenzioso');
  // codici assegnati in blocco: avviso solo se ne ha assegnati
  await call('POST', '/api/products', { name: 'Altro senza codice', qty: 1, price: 1 });
  assert.match(text(await call('POST', '/api/labels/assign-missing')), /Codici a barre assegnati a \d+ articol[oi]/);
  assert.equal((await call('POST', '/api/labels/assign-missing')).msgs.length, 0, 'niente da assegnare: nessun avviso');
  // logo
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  assert.match(text(await call('PUT', '/api/labels/logo', { data_url: `data:image/png;base64,${png}` })), /Logo delle etichette aggiornato/);
  assert.match(text(await call('DELETE', '/api/labels/logo')), /Logo delle etichette ripristinato/);
  // errori: parlanti e con la sezione giusta
  const bad = await call('POST', '/api/labels/templates', { ...list[0], name: '' });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.code, 'ETICHETTA_NOME_MANCANTE');
  assert.equal((await call('GET', '/print/labels?items=999999:1')).status, 404);
  // lettura dal codice: nessun avviso
  assert.equal((await call('GET', `/api/products/by-code/${p.id ? '2000000000000' : ''}`)).msgs.length, 0);
});

// ---------------- Avvisi di errore chiari, gravita', anti-spam, registro errori (agente G) ----------------
const { describeEvent, describeFailure, safeTruncate, isQuiet } = await import('../notify.mjs');
const { db } = await import('../dbref.mjs');
const { purgeErrors } = await import('../registro-errori.mjs');
const flat = (t) => t.replace(/<[^>]+>/g, '');

test('errore di validazione: dice quale riparazione, cliente, dispositivo, cosa si faceva e cosa fare; senza suono', async () => {
  const r = await newRepair({ quote: null, brand_model: 'Galaxy S22' });
  await call('POST', `/api/repairs/${r.id}/advance`); // ricevuto -> in diagnosi
  const bad = await call('POST', `/api/repairs/${r.id}/advance`); // senza preventivo: rifiutato
  assert.equal(bad.status, 400);
  assert.equal(bad.msgs.length, 1);
  const t = flat(bad.msgs[0].text);
  assert.match(t, new RegExp(`Riparazione ${r.code} \\(Anna Verdi, Galaxy S22\\): non si può avanzare a «Preventivo da approvare»`));
  assert.match(t, /Motivo: .*manca il preventivo/);
  assert.match(t, /Stato attuale: In diagnosi/);
  assert.match(t, /Cosa fare: |👉/);
  assert.match(t, /Christian/);
  assert.match(t, /🕒 \d\d\/\d\d \d\d:\d\d/);
  assert.equal(bad.msgs[0].disable_notification, true, 'errore dell\'utente: niente suono');
  assert.doesNotMatch(t, /operazione non riuscita/);
});

test('anti-spam: lo stesso errore ripetuto entro pochi minuti = un solo avviso, ma il registro conta le ripetizioni', async () => {
  const r = await newRepair({ quote: null, brand_model: 'Pixel 7' });
  await call('POST', `/api/repairs/${r.id}/advance`);
  // stesso utente, stesso errore: gia' avvisato nel test precedente (altra riparazione) quindi nessun nuovo avviso
  for (let i = 0; i < 3; i++) assert.equal((await call('POST', `/api/repairs/${r.id}/advance`)).msgs.length, 0);
  const log = (await call('GET', '/api/errors?status=400&user=christian@test.it')).data;
  const row = log.rows.find((e) => /manca il preventivo/.test(e.reason));
  assert.ok(row.count >= 4, 'contate le ripetizioni: ' + row.count);
  assert.equal(row.severity, 'info');
  assert.equal(row.notified, 1);
  assert.match(row.entity, /Riparazione R-/);
});

test('404 e 409 sono avvisi informativi senza suono', async () => {
  const x = await call('POST', '/api/repairs/999999/advance');
  assert.equal(x.status, 404);
  assert.equal(x.msgs.length, 1);
  assert.equal(x.msgs[0].disable_notification, true);
  assert.match(flat(x.msgs[0].text), /non trovata|non esiste/);
});

test('registro errori: filtri per gravita\', utente, stato, periodo; solo amministratore; sola lettura', async () => {
  const all = (await call('GET', '/api/errors')).data;
  assert.ok(all.total >= 2 && all.retention_days === 90);
  assert.ok(all.rows.every((e) => e.user_email && e.ref && e.fingerprint));
  assert.equal((await call('GET', '/api/errors?severity=error')).data.rows.filter((e) => e.severity !== 'error').length, 0);
  assert.equal((await call('GET', '/api/errors?severity=info&user=christian@test.it')).data.rows.length > 0, true);
  assert.equal((await call('GET', '/api/errors?user=nessuno@test.it')).data.rows.length, 0);
  assert.equal((await call('GET', '/api/errors?status=404')).data.rows.every((e) => e.status === 404), true);
  assert.equal((await call('GET', '/api/errors?from=2999-01-01')).data.rows.length, 0);
  assert.equal((await call('GET', '/api/errors?severity=boh')).status, 400);
  const before = (await db.prepare('SELECT COUNT(*) AS n FROM repairs').get()).n;
  await call('GET', '/api/errors');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM repairs').get()).n, before);
  // un utente non amministratore: 403 + avviso di sicurezza con suono, poi anti-spam
  const staff = createAdminApp({ auth: async (c, next) => { c.set('user', { email: 'staff@test.it', name: 'Staff', role: 'staff' }); await next(); } });
  const forb = await call('GET', '/api/errors', null, staff);
  assert.equal(forb.status, 403);
  assert.equal((await call('GET', '/api/errors', null, staff)).msgs.length, 0, 'anti-spam anche per i permessi');
  const sec = (await call('GET', '/api/errors?severity=security')).data.rows;
  assert.ok(sec.some((e) => e.user_email === 'staff@test.it' && e.status === 403));
});

test('retention: il registro cancella da solo le righe oltre 90 giorni e tiene le altre', async () => {
  await db.prepare("INSERT INTO error_log (at, last_at, severity, status, method, path, user_email, fingerprint) VALUES ('2020-01-01 10:00:00','2020-01-01 10:00:00','info',400,'POST','/api/x','vecchio@test.it','vecchio')").run();
  const n = await purgeErrors();
  assert.ok(n >= 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM error_log WHERE user_email = 'vecchio@test.it'").get()).n, 0);
  assert.ok((await db.prepare('SELECT COUNT(*) AS n FROM error_log').get()).n >= 2);
});

test('errore vero (5xx): suono, codice di riferimento, percorso e versione; token e dati sensibili mai inclusi', () => {
  const u = { name: 'Marco', email: 'm@example.com' };
  const ctx = { method: 'POST', path: '/api/repairs/5/deposit', status: 500, user: u, body: { amount: 20, method: 'carta', passcode: '9876' }, error: 'D1_ERROR <x> 123456789:AAAbbbCCCdddEEEfffGGGhhhIIIjjjKKK12', pre: { code: 'R-2026-0007', customer_name: 'Mario Rossi', brand_model: 'iPhone 13', status: 'ready' }, version: 'abc12345', ip: '1.2.3.4', country: 'IT' };
  const t = describeEvent({ ...ctx, meta: { ref: 'E-7K3QX', repeated: 2, at: '2026-10-16 09:30:00' } });
  const p = flat(t);
  assert.match(p, /ERRORE DEL SISTEMA · rif\. E-7K3QX/);
  assert.match(p, /Riparazione R-2026-0007 \(Mario Rossi, iPhone 13\): non si può registrare l’acconto di 20,00 €/);
  assert.match(p, /POST \/api\/repairs\/5\/deposit · versione abc12345/);
  assert.match(p, /16\/10 09:30/);
  assert.match(p, /ripetuto altre 2 volte/);
  assert.ok(t.includes('&lt;x&gt;') && t.includes('[token]') && !t.includes('AAAbbb') && !t.includes('9876'));
  assert.equal(isQuiet('POST', '/api/repairs/5/deposit', 500), false);
  assert.equal(isQuiet('POST', '/api/repairs/5/deposit', 400), true);
  assert.equal(isQuiet('POST', '/api/repairs/5/deposit', 403), false);
});

test('campi code e hint dei JSON d\'errore usati se presenti; altrimenti error', () => {
  const f = describeFailure({ method: 'POST', path: '/api/sales', status: 409, user: { email: 'a@b.it' }, result: { error: 'Giacenza insufficiente', code: 'STOCK_LOW', hint: 'Carica prima la merce.' } });
  assert.equal(f.errorCode, 'STOCK_LOW');
  assert.equal(f.hint, 'Carica prima la merce.');
  assert.equal(f.severity, 'info');
  const g = describeFailure({ method: 'POST', path: '/api/sales', status: 400, result: { error: 'Aggiungi un articolo' } });
  assert.equal(g.reason, 'Aggiungi un articolo');
  assert.equal(g.errorCode, undefined);
  assert.match(g.hint, /Controlla i dati/);
});

test('link del cliente: il token non compare mai nel testo dell\'errore', () => {
  const t = describeEvent({ method: 'POST', path: '/api/track/SEGRETOTOKEN123/decision', status: 400, result: { error: 'Firma obbligatoria' } });
  assert.ok(!t.includes('SEGRETOTOKEN123'));
  assert.match(flat(t), /cliente \(dal link\)/);
});

test('messaggi lunghi: il taglio non spezza tag ed entita\' (Telegram rifiuterebbe il messaggio)', () => {
  const html = `<b>Titolo</b>\n<code>${'a&amp;'.repeat(900)}</code>`;
  const cut = safeTruncate(html, 400);
  assert.ok(cut.length <= 400);
  assert.ok(cut.endsWith('</code>') && cut.includes('…'));
  assert.equal(safeTruncate('<b>ok</b>', 400), '<b>ok</b>');
  assert.equal((cut.match(/<code>/g) || []).length, (cut.match(/<\/code>/g) || []).length);
});

test('importi non numerici non diventano "NaN €"; conversione senza metodo non lascia parentesi vuote', () => {
  const t = describeEvent({ method: 'POST', path: '/api/quotes/3/convert', status: 200, user: { email: 'a@b.it' }, body: { to: 'sale' }, result: { quote: { code: 'P-1', total: 'abc', sale_code: 'V-1' } } });
  assert.doesNotMatch(t, /NaN/);
  assert.doesNotMatch(t, /\(incassata \)/);
});

test('notifiche: categorie, fornitore con agenti, carico senza fornitore', async () => {
  assert.match(text(await call('POST', '/api/categories', { name: 'Cover' })), /Categoria creata.*Cover/s);
  assert.match(text(await call('PUT', '/api/categories', { name: 'Cover', new_name: 'Custodie' })), /Cover → Custodie/);
  assert.match(text(await call('DELETE', '/api/categories?name=Custodie', { name: 'Custodie' })), /Categoria eliminata.*Custodie/s);
  assert.match(text(await call('POST', '/api/suppliers', { name: 'Moon', agents: [{ name: 'Luca', phone: '1' }] })), /Fornitore creato.*Moon.*1 agente di riferimento/s);
  const l = text(await call('POST', '/api/products/load', { name: 'Kit auto', category: 'Accessori', qty: 1, unit_price: 6 }));
  assert.match(l, /Carico merce.*Kit auto.*senza fornitore/s);
});

test('isQuiet: etichette e codici assegnati senza suono, template normali con suono', () => {
  assert.equal(isQuiet('POST', '/api/labels/prepare', 200), true);
  assert.equal(isQuiet('POST', '/api/labels/assign-missing', 200), true);
  assert.equal(isQuiet('PUT', '/api/labels/logo', 200), true);
  assert.equal(isQuiet('POST', '/api/labels/templates', 200), false);
});
