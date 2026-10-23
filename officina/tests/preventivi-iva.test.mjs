// Test: preventivi con prezzi IVA inclusa o esclusa e con permuta (preventivo autonomo, preventivo della riparazione, soluzioni).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-piva-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const { quoteTotals, priceFrom } = await import('../iva.mjs');
const { localDate } = await import('../logic.mjs');
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

let admin, pub, A, P;
const listen = (app) => new Promise((r) => { const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
before(async () => {
  const apps = createApps();
  admin = await listen(apps.admin); pub = await listen(apps.pub);
  A = `http://127.0.0.1:${admin.address().port}`; P = `http://127.0.0.1:${pub.address().port}`;
});
after(() => { admin.close(); pub.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });
const call = async (base, method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const a = (m, path, b) => call(A, m, path, b);
const p = (m, path, b) => call(P, m, path, b);
const future = () => { const d = new Date(`${localDate()}T12:00:00`); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); };

test('calcoli: IVA esclusa somma IVA, IVA inclusa scorpora, sconto prima dell IVA', () => {
  assert.deepEqual(quoteTotals({ subtotal: 100, mode: 'net', rate: 22 }), { mode: 'net', rate: 22, net: 100, vat: 22, total: 122 });
  assert.deepEqual(quoteTotals({ subtotal: 122, mode: 'gross', rate: 22 }), { mode: 'gross', rate: 22, net: 100, vat: 22, total: 122 });
  assert.deepEqual(quoteTotals({ subtotal: 200, discount: 100, mode: 'net', rate: 22 }), { mode: 'net', rate: 22, net: 100, vat: 22, total: 122 });
  assert.equal(priceFrom({ amount: 33.33, mode: 'net', rate: 22 }).gross, 40.66);
  assert.equal(priceFrom({ amount: 33.33, mode: 'net', rate: 22 }).net, 33.33);
  assert.equal(priceFrom({ amount: 122, mode: 'gross', rate: 22 }).net, null);
  assert.throws(() => priceFrom({ amount: -1 }), /non valido/);
});

test('preventivo autonomo: senza indicazioni resta IVA inclusa (come sempre)', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Mario Rossi', phone: '3331110000' })).data;
  const q = (await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), items: [{ description: 'Montaggio', qty: 1, unit_price: 122 }] })).data;
  assert.equal(q.vat_mode, 'gross');
  assert.equal(q.total, 122);
  assert.equal(q.due, 122);
  assert.match(q.terms, /IVA inclusa/);
});

test('preventivo autonomo IVA esclusa: totale = imponibile + IVA, condizioni e vista cliente coerenti, firma con dettaglio', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Ditta Verdi', phone: '3332220000' })).data;
  const q = (await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), vat_mode: 'net', vat_rate: 22, discount: 20,
    items: [{ description: 'PC assemblato', qty: 2, unit_price: 60 }, { description: 'Installazione', qty: 1, unit_price: 0 }] })).data;
  assert.equal(q.subtotal, 120);
  assert.equal(q.net, 100);
  assert.equal(q.vat, 22);
  assert.equal(q.total, 122);
  assert.match(q.terms, /IVA esclusa/);
  assert.equal((await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), vat_mode: 'boh', items: [{ description: 'x', unit_price: 1 }] })).status, 400);
  // modifica: passando a IVA inclusa le condizioni di serie seguono
  const q2 = (await a('PUT', `/api/quotes/${q.id}`, { vat_mode: 'gross' })).data;
  assert.equal(q2.total, 100);
  assert.match(q2.terms, /IVA inclusa/);
  await a('PUT', `/api/quotes/${q.id}`, { vat_mode: 'net' });
  const link = (await a('POST', `/api/quotes/${q.id}/link`, {})).data;
  const view = (await p('GET', `/api/quote/${link.token}`)).data;
  assert.deepEqual([view.vat_mode, view.net, view.vat, view.total], ['net', 100, 22, 122]);
  const dec = (await p('POST', `/api/quote/${link.token}/decision`, { action: 'accept', image: SIG, signer_name: 'Ditta Verdi' })).data;
  assert.equal(dec.decision, 'accettato');
  const print = (await a('GET', `/print/quote/${q.id}?noprint=1`)).data;
  assert.match(print, /Imponibile/);
  assert.match(print, /IVA 22%/);
});

test('permuta: scalata dal totale (IVA compresa), descrizione obbligatoria, mai oltre il totale', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Luca Neri', phone: '3333330000' })).data;
  const base = { customer_id: c.id, valid_until: future(), vat_mode: 'net', items: [{ description: 'iPhone 15', qty: 1, unit_price: 800 }] };
  const q = (await a('POST', '/api/quotes', { ...base, tradein_desc: 'iPhone 12 128GB', tradein_value: 200 })).data;
  assert.equal(q.total, 976);
  assert.equal(q.tradein_value, 200);
  assert.equal(q.due, 776);
  assert.equal((await a('POST', '/api/quotes', { ...base, tradein_value: 100 })).status, 400); // manca la descrizione
  assert.equal((await a('POST', '/api/quotes', { ...base, tradein_desc: 'x', tradein_value: 5000 })).status, 400); // supera il totale
  const link = (await a('POST', `/api/quotes/${q.id}/link`, {})).data;
  const view = (await p('GET', `/api/quote/${link.token}`)).data;
  assert.deepEqual([view.tradein_desc, view.tradein_value, view.due], ['iPhone 12 128GB', 200, 776]);
  // conversione in vendita: si incassa solo il da pagare
  const out = (await a('POST', `/api/quotes/${q.id}/convert`, { to: 'sale', method: 'contanti' })).data;
  assert.equal(out.sale.total, 776);
  assert.match(out.sale.notes, /permuta/);
});

test('preventivo autonomo IVA esclusa convertito in riparazione conserva imponibile e aliquota', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Eva Blu', phone: '3334440000' })).data;
  const q = (await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), vat_mode: 'net', items: [{ description: 'Lavoro', qty: 1, unit_price: 100 }] })).data;
  const out = (await a('POST', `/api/quotes/${q.id}/convert`, { to: 'repair', brand_model: 'Asus X' })).data;
  const r = (await a('GET', `/api/repairs/${out.repair.id}`)).data;
  assert.deepEqual([r.quote, r.quote_net, r.quote_vat_mode, r.quote_vat_rate], [122, 100, 'net', 22]);
});

test('preventivo della riparazione IVA esclusa: totale IVA compresa, nessuna nuova approvazione se non cambia', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Gina Gialli', phone: '3335550000' })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: c.id }, brand_model: 'HP', problem: 'lento', quote: 100, quote_mode: 'net' })).data;
  assert.deepEqual([rep.quote, rep.quote_net, rep.quote_vat_mode], [122, 100, 'net']);
  assert.deepEqual([rep.quote_price.net, rep.quote_price.vat, rep.quote_price.total], [100, 22, 122]);
  await a('POST', `/api/repairs/${rep.id}/status`, { status: 'quote_pending' });
  const same = (await a('PATCH', `/api/repairs/${rep.id}`, { quote: '100', quote_mode: 'net' })).data;
  assert.equal(same.quote, 122);
  assert.equal(same.quote_decision, null);
  // passa a IVA inclusa: 100 diventa il totale
  const gross = (await a('PATCH', `/api/repairs/${rep.id}`, { quote: '100', quote_mode: 'gross' })).data;
  assert.deepEqual([gross.quote, gross.quote_net, gross.quote_vat_mode], [100, null, 'gross']);
  const pubv = (await p('GET', `/api/track/${rep.token}`)).data;
  assert.equal(pubv.quote, 100);
  assert.equal(pubv.quote_price.mode, 'gross');
});

test('soluzioni alternative IVA esclusa: la scelta del cliente porta con se imponibile e totale', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Ugo Viola', phone: '3336660000' })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: c.id }, brand_model: 'Lenovo', problem: 'ssd' })).data;
  await a('POST', `/api/repairs/${rep.id}/quote-options`, { label: 'SSD 480', amount: 180, price_mode: 'net' });
  const list = (await a('POST', `/api/repairs/${rep.id}/quote-options`, { label: 'SSD 1TB', amount: 250 })).data;
  assert.deepEqual([list[0].amount, list[0].net, list[0].vat, list[0].mode], [219.6, 180, 39.6, 'net']);
  assert.deepEqual([list[1].amount, list[1].mode], [250, 'gross']);
  await a('POST', `/api/repairs/${rep.id}/status`, { status: 'quote_pending' });
  const v = (await p('GET', `/api/track/${rep.token}`)).data;
  assert.match(v.quote_flow.options[0].amount_text, /imponibile/);
  assert.doesNotMatch(v.quote_flow.options[1].amount_text, /imponibile/);
  await p('POST', `/api/track/${rep.token}/decision`, { action: 'option', option_id: list[0].id, image: SIG, signer_name: 'Ugo' });
  const r = (await a('GET', `/api/repairs/${rep.id}`)).data;
  assert.deepEqual([r.quote, r.quote_net, r.quote_vat_mode, r.status], [219.6, 180, 'net', 'approved']);
});

test('preventivo online dalla riparazione IVA esclusa: stesse cifre della scheda', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Ada Rosa', phone: '3337770000' })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: c.id }, brand_model: 'Dell', problem: 'display', quote: 300, quote_mode: 'net' })).data;
  await a('POST', `/api/repairs/${rep.id}/parts`, { name: 'Display', qty: 1, unit_price: 183 });
  const out = (await a('POST', `/api/repairs/${rep.id}/online-quote`, {})).data;
  assert.equal(out.quote.vat_mode, 'net');
  assert.equal(out.quote.net, 300);
  assert.equal(out.quote.total, 366);
  assert.equal(out.quote.total, rep.quote);
});

test('sconto in percentuale o in euro sul preventivo autonomo: la percentuale segue le voci', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Sara Lilla', phone: '3338880000' })).data;
  const q = (await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), discount_pct: 10, items: [{ description: 'Notebook', qty: 1, unit_price: 500 }] })).data;
  assert.deepEqual([q.discount, q.discount_pct, q.total], [50, 10, 450]);
  // cambiano le voci: il 10% si ricalcola
  const q2 = (await a('PUT', `/api/quotes/${q.id}`, { items: [{ description: 'Notebook', qty: 1, unit_price: 600 }] })).data;
  assert.deepEqual([q2.discount, q2.discount_pct, q2.total], [60, 10, 540]);
  // uno sconto in euro scritto a mano sostituisce la percentuale
  const q3 = (await a('PUT', `/api/quotes/${q.id}`, { discount: 25 })).data;
  assert.deepEqual([q3.discount, q3.discount_pct, q3.total], [25, null, 575]);
  assert.equal((await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), discount_pct: 150, items: [{ description: 'x', unit_price: 10 }] })).status, 400);
  assert.equal((await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), discount: 99, items: [{ description: 'x', unit_price: 10 }] })).status, 400);
  // con IVA esclusa lo sconto si toglie prima dell'IVA
  const q4 = (await a('POST', '/api/quotes', { customer_id: c.id, valid_until: future(), vat_mode: 'net', discount_pct: 10, items: [{ description: 'PC', qty: 1, unit_price: 1000 }] })).data;
  assert.deepEqual([q4.net, q4.vat, q4.total], [900, 198, 1098]);
});

test('sconto sul preventivo della riparazione e sulle soluzioni: totale scontato, prezzo prima dello sconto conservato', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Omar Teal', phone: '3339990000' })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: c.id }, brand_model: 'Mac', problem: 'ssd', quote: 200, quote_discount_pct: 10 })).data;
  assert.deepEqual([rep.quote, rep.quote_list, rep.quote_discount, rep.quote_discount_pct], [180, 200, 20, 10]);
  assert.deepEqual([rep.quote_price.list, rep.quote_price.discount, rep.quote_price.total], [200, 20, 180]);
  // IVA esclusa + sconto in euro: sconto sull'imponibile, poi l'IVA
  const up = (await a('PATCH', `/api/repairs/${rep.id}`, { quote: '100', quote_mode: 'net', quote_discount: '10' })).data;
  assert.deepEqual([up.quote, up.quote_net, up.quote_list, up.quote_discount], [109.8, 90, 100, 10]);
  // senza indicazioni lo sconto si azzera: il prezzo scritto e' quello finale
  const plain = (await a('PATCH', `/api/repairs/${rep.id}`, { quote: '100', quote_mode: 'gross' })).data;
  assert.deepEqual([plain.quote, plain.quote_list, plain.quote_discount], [100, null, 0]);
  assert.equal((await a('PATCH', `/api/repairs/${rep.id}`, { quote: '100', quote_discount: '500' })).status, 400);
  // soluzioni
  const list = (await a('POST', `/api/repairs/${rep.id}/quote-options`, { label: 'Display originale', amount: 300, discount_pct: 20 })).data;
  assert.deepEqual([list[0].amount, list[0].list_amount, list[0].discount, list[0].discount_pct], [240, 300, 60, 20]);
  await a('POST', `/api/repairs/${rep.id}/status`, { status: 'quote_pending' });
  const v = (await p('GET', `/api/track/${rep.token}`)).data;
  assert.deepEqual([v.quote_flow.options[0].list_amount, v.quote_flow.options[0].discount], [300, 60]);
  await p('POST', `/api/track/${rep.token}/decision`, { action: 'option', option_id: list[0].id, image: SIG, signer_name: 'Omar' });
  const r = (await a('GET', `/api/repairs/${rep.id}`)).data;
  assert.deepEqual([r.quote, r.quote_list, r.quote_discount], [240, 300, 60]);
});
