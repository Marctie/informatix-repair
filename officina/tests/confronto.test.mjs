// Test: funzioni prese dal confronto con Fix-Book, e-Share e Fixh IT (2026-11-04).
// Tecnico e stati, usato a margine e permuta, proposta d'ordine e differenze d'arrivo, estensioni di garanzia,
// ricevuta e documenti pubblici, listino, esportazioni, permessi per utente, previsioni e agenda, avvisi Telegram, monitor.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-confronto-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.TELEGRAM_BOT_TOKEN = '123456:TOKEN-FINTO-SOLO-PER-I-TEST-000000000';
process.env.TELEGRAM_OWNER_ID = '1';
process.env.MONITOR_TOKEN = 'chiave-monitor-di-prova-lunga-0123456789';
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(opts.body)); return new Response('{"ok":true}'); }
  return realFetch(url, opts);
};
const { closeDb } = await import('../db-node.mjs');
const { createAdminApp, createPublicApp } = await import('../app.mjs');
const { db } = await import('../dbref.mjs');
const USERS = { admin: { email: 'christian@test.it', name: 'Christian', role: 'admin' }, staff: { email: 'tecnico@test.it', name: 'Luca', role: 'staff' }, cassa: { email: 'cassa@test.it', name: 'Cassa', role: 'cassa' } };
const app = createAdminApp({ auth: async (c, next) => { c.set('user', USERS[c.req.header('x-role') || 'admin']); await next(); } });
const pub = createPublicApp();
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (method, path, body, role = 'admin', a = app) => {
  const n = sent.length;
  const res = await a.request(path, { method, headers: { 'content-type': 'application/json', 'x-role': role, authorization: 'Bearer chiave-monitor-di-prova-lunga-0123456789' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  await new Promise((r) => setTimeout(r, 20));
  return { status: res.status, data, headers: res.headers, msgs: sent.slice(n).map((m) => m.text.replace(/<[^>]+>/g, '')).join('\n---\n') };
};
const ok = (r) => { assert.ok(r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data; };

const repair = async (extra = {}) => ok(await call('POST', '/api/repairs', { customer: { name: 'Mario Rossi', phone: '3331234567' }, brand_model: 'iPhone 12', problem: 'Schermo rotto', quote: 120, ...extra }));

test('utenti di prova', async () => {
  ok(await call('POST', '/api/users', { email: 'tecnico@test.it', name: 'Luca', role: 'staff' }));
  ok(await call('POST', '/api/users', { email: 'cassa@test.it', name: 'Cassa', role: 'cassa' }));
});

test('tecnico assegnato: solo utenti attivi, evento in scheda, avviso Telegram, statistiche', async () => {
  const r = await repair();
  assert.equal((await call('POST', `/api/repairs/${r.id}/tech`, { email: 'nessuno@test.it' })).data.code, 'TECNICO_NON_VALIDO');
  const a = await call('POST', `/api/repairs/${r.id}/tech`, { email: 'tecnico@test.it' });
  assert.equal(ok(a).tech_email, 'tecnico@test.it');
  assert.match(a.msgs, /Tecnico assegnato.*Luca/s);
  assert.ok(a.data.events.some((e) => /Tecnico assegnato: Luca/.test(e.note)));
  ok(await call('POST', `/api/repairs/${r.id}/deliver`, { method: 'contanti' }));
  const st = ok(await call('GET', '/api/tecnici/stats'));
  const luca = st.rows.find((x) => x.tech === 'tecnico@test.it');
  assert.equal(luca.delivered, 1); assert.equal(luca.revenue, 120);
  assert.equal((await call('GET', '/api/tecnici/stats', null, 'staff')).status, 403);
});

test('stati: rinominati e con testo nuovo anche per il cliente; fasi libere; consegnato non si nasconde', async () => {
  const cfg = ok(await call('PUT', '/api/stati', { statuses: [{ key: 'repairing', label: 'Sul banco', hint: 'Ci stiamo lavorando.' }, { key: 'delivered', hidden: true }, { key: 'diagnosing', hidden: true }], substatuses: ['Inviato al centro Samsung', 'Attesa risposta cliente'] }));
  assert.equal(cfg.statuses.find((x) => x.key === 'repairing').label, 'Sul banco');
  assert.equal(cfg.statuses.find((x) => x.key === 'delivered').hidden, false);
  assert.equal(cfg.statuses.find((x) => x.key === 'diagnosing').hidden, true);
  const meta = ok(await call('GET', '/api/meta'));
  assert.equal(meta.statuses.repairing.label, 'Sul banco');
  const r = await repair();
  ok(await call('POST', `/api/repairs/${r.id}/status`, { status: 'repairing' }));
  assert.equal((await call('POST', `/api/repairs/${r.id}/substatus`, { substatus: 'Inventata' })).data.code, 'FASE_NON_VALIDA');
  const s = await call('POST', `/api/repairs/${r.id}/substatus`, { substatus: 'Inviato al centro Samsung' });
  assert.equal(ok(s).substatus, 'Inviato al centro Samsung');
  assert.match(s.msgs, /Fase.*Inviato al centro Samsung/s);
  const view = ok(await call('GET', `/api/track/${r.token}`, null, 'admin', pub));
  assert.equal(view.status_label, 'Sul banco'); assert.equal(view.status_hint, 'Ci stiamo lavorando.'); assert.equal(view.substatus, 'Inviato al centro Samsung');
  assert.equal((await call('PUT', '/api/stati', { statuses: [] }, 'staff')).status, 403);
  ok(await call('PUT', '/api/stati', { statuses: [], substatuses: ['Inviato al centro Samsung'] })); // torna ai nomi di serie
  assert.equal(ok(await call('GET', '/api/meta')).statuses.repairing.label, 'In riparazione');
});

test('usato a margine: registro, cedente obbligatorio, vendita in cassa, IVA a margine, cartellino, cassa senza costi', async () => {
  assert.equal((await call('POST', '/api/margine', { description: 'iPhone 11', cost: 150 })).data.code, 'CEDENTE_MANCANTE');
  const u = await call('POST', '/api/margine', { description: 'iPhone 11 64GB', serial: '356938035643809', cost: 150, price: 272, seller_name: 'Anna Bianchi', seller_doc: 'CI AX1234567' });
  const item = ok(u);
  assert.match(item.code, /^U-\d{4}-0001$/);
  assert.match(u.msgs, /Usato a margine.*iPhone 11 64GB.*150,00/s);
  const sale = await call('POST', '/api/sales', { items: [{ margin_id: item.id }], method: 'contanti' });
  ok(sale);
  assert.equal(sale.data.total, 272);
  assert.equal(sale.data.items[0].unit_cost, 150);
  assert.equal((await call('POST', '/api/sales', { items: [{ margin_id: item.id }], method: 'contanti' })).data.code, 'USATO_GIA_VENDUTO');
  const reg = ok(await call('GET', '/api/margine/registro'));
  assert.equal(reg.sold.n, 1); assert.equal(reg.margin, 122); assert.equal(reg.vat_due, 22); // 122 x 22 / 122
  const cart = await call('GET', `/print/margine/${item.id}`);
  assert.match(cart.data, /regime del margine/); assert.match(cart.data, /272,00/);
  const asCassa = ok(await call('GET', '/api/margine', null, 'cassa'));
  assert.equal(asCassa.rows[0].cost, undefined);
  assert.equal((await call('GET', '/api/margine/registro', null, 'cassa')).status, 403);
  assert.equal((await call('PUT', `/api/margine/${item.id}`, { price: 1 })).data.code, 'USATO_GIA_VENDUTO');
});

test('permuta in cassa: scala dal totale, entra nel registro, ricevuta e avviso la riportano', async () => {
  const p = ok(await call('POST', '/api/products', { name: 'Samsung A55', qty: 3, price: 399, cost: 300 }));
  const c = ok(await call('POST', '/api/customers', { name: 'Giulia Verdi', phone: '3207654321' }));
  assert.equal((await call('POST', '/api/sales', { customer_id: c.id, items: [{ product_id: p.id }], method: 'contanti', tradein: { description: 'Galaxy S10', value: 500 } })).data.code, 'PERMUTA_SUPERA_TOTALE');
  assert.equal((await call('POST', '/api/sales', { items: [{ product_id: p.id }], method: 'contanti', tradein: { description: 'Galaxy S10', value: 90 } })).data.code, 'CEDENTE_MANCANTE');
  const s = await call('POST', '/api/sales', { customer_id: c.id, items: [{ product_id: p.id }], method: 'carta', tradein: { description: 'Galaxy S10 128GB', serial: '356938035643817', value: 90, price: 179 } });
  const sale = ok(s);
  assert.equal(sale.total, 309); assert.equal(sale.tradein_value, 90);
  assert.equal(sale.tradein_item.origin, 'permuta'); assert.equal(sale.tradein_item.cost, 90);
  assert.match(s.msgs, /permuta.*Galaxy S10.*90,00/si);
  const link = ok(await call('GET', `/api/sales/${sale.id}/link`));
  assert.match(link.url, /\/r\/[\w-]+$/); assert.match(link.wa, /^https:\/\/wa\.me\/393207654321\?text=/);
  const rec = await call('GET', new URL(link.url, 'http://x').pathname, null, 'admin', pub);
  assert.equal(rec.status, 200); assert.match(rec.data, /Permuta: Galaxy S10 128GB/); assert.match(rec.data, /309,00/);
  assert.equal((await call('GET', '/r/inesistente', null, 'admin', pub)).status, 404);
});

test('proposta d’ordine: sotto scorta, consumi, già in ordine; crea ordini per fornitore; arrivo con differenze carica il magazzino', async () => {
  const sup = ok(await call('POST', '/api/suppliers', { name: 'Ricambi Srl' }));
  const a = ok(await call('POST', '/api/products', { name: 'Display iPhone 12', qty: 1, min_qty: 3, cost: 40, price: 120, supplier_id: sup.id }));
  const b = ok(await call('POST', '/api/products', { name: 'Batteria iPhone 11', qty: 0, min_qty: 2, cost: 15, price: 59, supplier_id: sup.id }));
  ok(await call('POST', '/api/products', { name: 'Pellicola', qty: 50, min_qty: 5, cost: 1, price: 10 }));
  const pr = ok(await call('GET', '/api/riordino'));
  const g = pr.groups.find((x) => x.supplier_name === 'Ricambi Srl');
  assert.equal(g.lines.find((l) => l.product_id === a.id).suggested, 5); // 2 x 3 - 1
  assert.equal(g.lines.find((l) => l.product_id === b.id).suggested, 4);
  assert.ok(!pr.groups.some((x) => x.lines.some((l) => l.name === 'Pellicola')));
  assert.equal((await call('POST', '/api/riordino', { lines: [] })).data.code, 'PROPOSTA_VUOTA');
  const cr = await call('POST', '/api/riordino', { lines: [{ product_id: a.id, qty: 5 }, { product_id: b.id, qty: 4 }] });
  const made = ok(cr).orders;
  assert.equal(made.length, 1); assert.equal(made[0].lines, 2); assert.equal(made[0].total, 260);
  assert.match(cr.msgs, /Proposta d’ordine.*1 ordine/s);
  // gia' in ordine: la proposta non lo ripropone
  assert.equal(ok(await call('GET', '/api/riordino')).groups.find((x) => x.supplier_name === 'Ricambi Srl').lines.find((l) => l.product_id === a.id).suggested, 0);
  const ord = ok(await call('GET', `/api/orders/${made[0].id}`));
  ok(await call('POST', `/api/orders/${ord.id}/status`, { status: 'ordinato' }));
  const ia = ord.items.find((i) => i.product_id === a.id); const ib = ord.items.find((i) => i.product_id === b.id);
  const rc = await call('POST', `/api/orders/${ord.id}/receive`, { lines: [{ item_id: ia.id, qty_received: 3 }, { item_id: ib.id, qty_received: 4 }] });
  const got = ok(rc);
  assert.equal(got.status, 'arrivato'); assert.equal(got.loaded, 7);
  assert.deepEqual(got.differences, [{ description: 'Display iPhone 12', ordered: 5, received: 3, diff: -2 }]);
  assert.match(rc.msgs, /Merce arrivata.*Display iPhone 12: ordinati 5, arrivati 3/s);
  assert.equal((await db.prepare('SELECT qty FROM products WHERE id = ?').get(a.id)).qty, 4);
  assert.equal((await call('POST', `/api/orders/${ord.id}/receive`, {})).data.code, 'ARRIVO_GIA_REGISTRATO');
  assert.equal(ok(await call('GET', '/api/orders/differenze')).length, 1);
});

test('estensione di garanzia: dopo la consegna, si incassa come vendita, certificato pubblico, documenti nel link del cliente', async () => {
  const r = await repair();
  assert.equal((await call('POST', '/api/garanzie', { kind: 'repair', ref_id: r.id, months: 12, price: 29, method: 'contanti' })).data.code, 'NON_CONSEGNATA');
  ok(await call('POST', `/api/repairs/${r.id}/deliver`, { method: 'contanti' }));
  assert.equal((await call('POST', '/api/garanzie', { kind: 'repair', ref_id: r.id, months: 7, price: 29 })).data.code, 'DURATA_NON_VALIDA');
  const w = await call('POST', '/api/garanzie', { kind: 'repair', ref_id: r.id, months: 12, price: 29, method: 'contanti' });
  const ext = ok(w);
  assert.match(ext.code, /^G-\d{4}-0001$/); assert.ok(ext.sale_code); assert.equal(ext.active, true);
  assert.match(w.msgs, /Estensione di garanzia.*12 mesi.*29,00/s);
  const cert = await call('GET', ext.url_path, null, 'admin', pub);
  assert.equal(cert.status, 200); assert.match(cert.data, /ATTIVA/);
  const view = ok(await call('GET', `/api/track/${r.token}`, null, 'admin', pub));
  assert.ok(view.documents.some((d) => d.url === `/t/${r.token}/certificato`));
  assert.ok(view.documents.some((d) => d.url === ext.url_path));
  const rc = await call('GET', `/t/${r.token}/certificato`, null, 'admin', pub);
  assert.match(rc.data, /Estensione G-/); assert.match(rc.data, /120,00/);
  ok(await call('DELETE', `/api/garanzie/${ext.id}`));
  assert.equal((await call('GET', ext.url_path, null, 'admin', pub)).status, 404);
});

test('listino pubblico: solo i servizi segnati, prezzi "da", pagina e dati per il sito', async () => {
  const s1 = ok(await call('POST', '/api/services', { name: 'Sostituzione display iPhone', price: 89 }));
  ok(await call('POST', '/api/services', { name: 'Servizio interno', price: 5 }));
  const pu = await call('PUT', `/api/services/${s1.id}/public`, { public: true, device_type: 'smartphone', public_note: 'Ricambio di qualità' });
  ok(pu);
  assert.match(pu.msgs, /Listino pubblico.*Sostituzione display iPhone/s);
  const l = ok(await call('GET', '/api/listino', null, 'admin', pub));
  assert.equal(l.items.length, 1); assert.equal(l.items[0].from, true);
  const page = await call('GET', '/listino', null, 'admin', pub);
  assert.match(page.data, /da 89,00 €/); assert.doesNotMatch(page.data, /Servizio interno/);
});

test('esportazioni CSV per Excel: solo amministratore, accenti e separatore ;', async () => {
  const r = await call('GET', '/api/export/magazzino.csv');
  assert.equal(r.status, 200); assert.match(r.headers.get('content-disposition'), /magazzino_/);
  assert.match(r.data, /^﻿?Codice;Codice a barre;Nome;/); assert.match(r.data, /Display iPhone 12;/); // il BOM (per gli accenti in Excel) lo toglie il lettore di testo
  assert.equal((await (await app.request('/api/export/magazzino.csv')).arrayBuffer()).byteLength > 3, true);
  assert.match((await call('GET', '/api/export/usato.csv')).data, /iPhone 11 64GB/);
  assert.match((await call('GET', '/api/export/vendite.csv')).data, /Galaxy|Samsung A55/);
  assert.equal((await call('GET', '/api/export/magazzino.csv', null, 'staff')).status, 403);
  assert.equal((await call('GET', '/api/export/segreti.csv')).status, 404);
});

test('permessi per utente: sezioni negate bloccate sul server, menu nascosto, admin mai limitato', async () => {
  const users = ok(await call('GET', '/api/users'));
  const luca = users.find((u) => u.email === 'tecnico@test.it');
  const p = await call('PUT', `/api/users/${luca.id}/permessi`, { deny: ['vendite', 'report', 'inventata'] });
  assert.deepEqual(JSON.parse(ok(p).deny), ['vendite', 'report']);
  assert.match(p.msgs, /Permessi.*tecnico@test.it.*Vendite e cassa/s);
  const no = await call('POST', '/api/sales', { items: [{ name: 'x', unit_price: 1 }], method: 'contanti' }, 'staff');
  assert.equal(no.status, 403); assert.equal(no.data.code, 'SEZIONE_NON_PERMESSA');
  assert.equal((await call('GET', '/api/repairs', null, 'staff')).status, 200);
  assert.equal((await call('GET', '/api/customers', null, 'staff')).status, 200);
  const mine = ok(await call('GET', '/api/permessi/miei', null, 'staff'));
  assert.ok(mine.hidden_views.includes('vendite') && mine.hidden_views.includes('analisi'));
  const admin = users.find((u) => u.email === 'christian@test.it') || ok(await call('POST', '/api/users', { email: 'christian@test.it', role: 'admin' }));
  assert.equal((await call('PUT', `/api/users/${admin.id}/permessi`, { deny: ['vendite'] })).data.code, 'ADMIN_SENZA_LIMITI');
  ok(await call('PUT', `/api/users/${luca.id}/permessi`, { deny: [] }));
  assert.equal((await call('GET', '/api/sales', null, 'staff')).status, 200);
});

test('previsioni e agenda', async () => {
  const f = ok(await call('GET', '/api/previsioni'));
  assert.ok(f.cash.so_far > 0); assert.ok(f.cash.projected >= f.cash.so_far);
  assert.equal(typeof f.repairs.open_to_collect.n, 'number');
  assert.equal((await call('GET', '/api/previsioni', null, 'staff')).status, 403);
  const today = new Date().toISOString().slice(0, 10);
  await repair({ eta_date: today });
  const ag = ok(await call('GET', `/api/agenda?from=${today}&to=${today}`));
  assert.ok(ag.days[0].items.some((x) => x.kind === 'riparazione'));
});

test('monitor del bot: tecnici, usato a margine, proposta d’ordine, differenze, garanzie, previsione', async () => {
  const m = ok(await call('GET', '/api/monitor', null, 'admin', pub));
  assert.ok(m.extra, 'sezione extra presente');
  assert.equal(typeof m.extra.forecast.cash.projected, 'number');
  assert.ok(m.extra.margin.stock.n >= 1);
  assert.equal(typeof m.extra.reorder.lines, 'number');
  assert.ok(Array.isArray(m.extra.techs));
  assert.ok(Array.isArray(m.extra.receipt_differences));
  assert.equal(typeof m.extra.warranty.active, 'number');
});
