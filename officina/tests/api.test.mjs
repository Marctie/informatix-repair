// Test delle API del gestionale officina su un database temporaneo.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

let admin, pub, A, P;
const listen = (app) => new Promise((r) => { const srv = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => r(srv)); });
before(async () => {
  const apps = createApps();
  admin = await listen(apps.admin);
  pub = await listen(apps.pub);
  A = `http://127.0.0.1:${admin.address().port}`;
  P = `http://127.0.0.1:${pub.address().port}`;
});
after(() => {
  admin.close();
  pub.close();
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const call = async (base, method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
};
const a = (m, p, b) => call(A, m, p, b);

test('magazzino: prodotto con carico iniziale, movimenti e sotto scorta', async () => {
  const sup = (await a('POST', '/api/suppliers', { name: 'Ricambi Napoli', phone: '0811234567' })).data;
  const p = (await a('POST', '/api/products', { name: 'Display iPhone 13', category: 'ricambi', qty: 3, min_qty: 2, cost: 60, price: 129, supplier_id: sup.id })).data;
  assert.equal(p.qty, 3);
  assert.equal((await a('POST', `/api/products/${p.id}/move`, { delta: -1, reason: 'prova' })).data.qty, 2);
  const low = (await a('GET', '/api/reorder')).data;
  assert.ok(low.some((x) => x.id === p.id && x.supplier_name === 'Ricambi Napoli'));
  assert.equal((await a('POST', `/api/products/${p.id}/move`, { delta: 0 })).status, 400);
});

test('riparazione: ingresso veloce, ricambio scala il magazzino, tracciamento pubblico', async () => {
  const prod = (await a('GET', '/api/products?q=Display')).data[0];
  const created = await a('POST', '/api/repairs', {
    customer: { name: 'Mario Rossi', phone: '3331234567', email: 'mario.rossi@example.com' },
    brand_model: 'iPhone 13', problem: 'Schermo rotto', accessories: 'cover', passcode: '1234',
    quote: 129, deposit: 30, eta_date: '2030-01-10',
  });
  assert.equal(created.status, 200);
  const r = created.data;
  assert.match(r.code, /^R-\d{4}-0001$/);
  assert.equal(r.status, 'received');
  assert.ok(r.track_url.includes(`/t/${r.token}`));

  // stesso telefono => stesso cliente (niente doppioni)
  const second = (await a('POST', '/api/repairs', { customer: { name: 'Mario R.', phone: '3331234567' }, brand_model: 'iPad', problem: 'Batteria' })).data;
  assert.equal(second.customer_id, r.customer_id);
  assert.match(second.code, /-0002$/);

  // validazioni
  assert.equal((await a('POST', '/api/repairs', { customer: { name: 'X' }, brand_model: '', problem: 'p' })).status, 400);
  assert.equal((await a('POST', '/api/repairs', { customer: {}, brand_model: 'a', problem: 'p' })).status, 400);

  // ricambio dal magazzino: scala la scorta (2 -> 1) e si ripristina se rimosso
  const withPart = (await a('POST', `/api/repairs/${r.id}/parts`, { product_id: prod.id, qty: 1 })).data;
  assert.equal(withPart.parts.length, 1);
  assert.equal((await a('GET', '/api/products?q=Display')).data[0].qty, 1);
  await a('DELETE', `/api/repairs/${r.id}/parts/${withPart.parts[0].id}`);
  assert.equal((await a('GET', '/api/products?q=Display')).data[0].qty, 2);

  // tracciamento pubblico: nessun dato interno, contatti mascherati
  const pubView = (await call(P, 'GET', `/api/track/${r.token}`)).data;
  const raw = JSON.stringify(pubView);
  assert.ok(!raw.includes('1234'), 'il codice di sblocco non deve mai comparire');
  assert.ok(!raw.includes('mario.rossi@example.com'));
  assert.ok(!raw.includes('3331234567'));
  assert.equal(pubView.customer.name, 'Mario Rossi');
  assert.equal(pubView.progress, 0);
  assert.equal(pubView.quote, 129);
  assert.equal(pubView.balance, 99);
  assert.equal(pubView.eta_date, '2030-01-10');
  assert.equal((await call(P, 'GET', '/api/track/token-finto')).status, 404);
  // il server pubblico non espone il gestionale
  assert.equal((await call(P, 'GET', '/api/customers')).status, 404);
  assert.equal((await call(P, 'GET', '/api/repairs')).status, 404);
});

test('flusso stati, approvazione online del preventivo, consegna e incasso', async () => {
  const r = (await a('GET', '/api/repairs?q=iPhone')).data[0];
  assert.equal((await a('POST', `/api/repairs/${r.id}/advance`)).data.status, 'diagnosing');
  const pending = (await a('POST', `/api/repairs/${r.id}/advance`)).data;
  assert.equal(pending.status, 'quote_pending');

  // il cliente vede la richiesta e approva dal link
  const before = (await call(P, 'GET', `/api/track/${r.token}`)).data;
  assert.equal(before.awaiting_decision, true);
  const acc = (await call(P, 'POST', `/api/track/${r.token}/decision`, { accept: true })).data;
  assert.equal(acc.status, 'approved');
  assert.equal(acc.quote_decision, 'accepted');
  // seconda risposta non più possibile
  assert.equal((await call(P, 'POST', `/api/track/${r.token}/decision`, { accept: false })).status, 409);

  await a('POST', `/api/repairs/${r.id}/status`, { status: 'repairing' });
  await a('POST', `/api/repairs/${r.id}/note`, { note: 'Controllo interno', public: false });
  await a('POST', `/api/repairs/${r.id}/note`, { note: 'Display montato, stiamo testando.', public: true });
  const pubView = (await call(P, 'GET', `/api/track/${r.token}`)).data;
  assert.ok(pubView.events.some((e) => e.note === 'Display montato, stiamo testando.'));
  assert.ok(!pubView.events.some((e) => e.note === 'Controllo interno'), 'le note interne restano private');

  assert.equal((await a('POST', `/api/repairs/${r.id}/advance`)).data.status, 'ready');
  const done = (await a('POST', `/api/repairs/${r.id}/deliver`, { method: 'carta' })).data;
  assert.equal(done.status, 'delivered');
  assert.equal(done.collected, 99); // 129 preventivo - 30 acconto
  assert.equal(done.paid, 129);
  assert.ok(done.warranty_until);
  assert.equal((await a('POST', `/api/repairs/${r.id}/deliver`, {})).status, 400);
});

test('cambio preventivo durante i lavori richiede una nuova approvazione', async () => {
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Anna Verdi', phone: '3470000000' }, brand_model: 'Galaxy S21', problem: 'Non si accende', quote: 80, quote_agreed: true })).data;
  assert.equal(r.status, 'approved');
  await a('POST', `/api/repairs/${r.id}/status`, { status: 'repairing' });
  const upd = (await a('PATCH', `/api/repairs/${r.id}`, { quote: 140 })).data;
  assert.equal(upd.status, 'quote_pending');
  assert.equal(upd.quote_decision, null);
  // il rifiuto del cliente viene registrato e segnalato in dashboard
  await call(P, 'POST', `/api/track/${r.token}/decision`, { accept: false });
  const dash = (await a('GET', '/api/dashboard')).data;
  assert.ok(dash.declined.some((x) => x.id === r.id));
  // già in questo stato: nessuna doppia registrazione
  assert.equal((await a('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' })).status, 400);
});

test('vendite: scalano il magazzino, rispettano sconto e finiscono in cassa', async () => {
  const p = (await a('POST', '/api/products', { name: 'Cavo USB-C', qty: 5, cost: 1, price: 9.9 })).data;
  const sale = await a('POST', '/api/sales', { items: [{ product_id: p.id, qty: 2 }, { name: 'Pulizia software', unit_price: 15 }], discount: 4.8, method: 'carta' });
  assert.equal(sale.status, 200);
  assert.equal(sale.data.total, 30); // 2*9.9 + 15 - 4.8
  assert.equal((await a('GET', `/api/products?q=Cavo`)).data[0].qty, 3);
  assert.equal((await a('POST', '/api/sales', { items: [] })).status, 400);
  assert.equal((await a('POST', '/api/sales', { items: [{ name: 'x', unit_price: 5 }], discount: 50 })).status, 400);
  const rep = (await a('GET', '/api/report')).data;
  assert.ok(rep.total >= 30 + 129 + 30 - 30); // incassi di oggi: acconti, saldo, vendita
  assert.ok(rep.by_method.some((m) => m.method === 'carta'));
});

test('stampe e QR', async () => {
  const r = (await a('GET', '/api/repairs?q=iPhone')).data[0];
  const html = (await a('GET', `/print/repair/${r.id}`)).data;
  assert.ok(html.includes(r.code) && html.includes('/api/qr?text='));
  assert.ok((await a('GET', `/print/label/${r.id}`)).data.includes(r.code));
  const qr = await fetch(`${A}/api/qr?text=ciao`);
  assert.match(qr.headers.get('content-type'), /svg/);
});

test('clienti: storico e protezione dall’eliminazione', async () => {
  const list = (await a('GET', '/api/customers?q=Rossi')).data;
  assert.equal(list.length, 1);
  assert.ok(list[0].repairs_count >= 2);
  const c = (await a('GET', `/api/customers/${list[0].id}`)).data;
  assert.ok(c.repairs.length >= 2);
  assert.equal((await a('DELETE', `/api/customers/${list[0].id}`)).status, 409);
});

test('controlli: importi negativi, telefono scritto in modi diversi, stato dopo la consegna', async () => {
  assert.equal((await a('POST', '/api/repairs', { customer: { name: 'Neg' }, brand_model: 'x', problem: 'y', quote: -5 })).status, 400);
  assert.equal((await a('POST', '/api/products', { name: 'Prova', price: -1 })).status, 400);
  const c1 = (await a('POST', '/api/repairs', { customer: { name: 'Luca Bianchi', phone: '+39 340 111 2222' }, brand_model: 'Pixel 7', problem: 'Batteria' })).data;
  const c2 = (await a('POST', '/api/repairs', { customer: { name: 'Luca B.', phone: '3401112222' }, brand_model: 'Pixel 8', problem: 'Display' })).data;
  assert.equal(c1.customer_id, c2.customer_id, 'stesso numero => stesso cliente');
  await a('POST', `/api/repairs/${c1.id}/deliver`, { final_price: 50 });
  assert.equal((await a('POST', `/api/repairs/${c1.id}/status`, { status: 'repairing' })).status, 409);
});

test('backup, riepilogo magazzino e incassi per giorno', async () => {
  const bk = await fetch(`${A}/api/backup`);
  assert.equal(bk.status, 200);
  const buf = Buffer.from(await bk.arrayBuffer());
  assert.equal(buf.subarray(0, 15).toString(), 'SQLite format 3');
  const sum = (await a('GET', '/api/stock/summary')).data;
  assert.ok(sum.items >= 2 && sum.value_price > 0);
  const rep = (await a('GET', '/api/report')).data;
  assert.equal(rep.by_day.length, 1);
  assert.equal(rep.by_day[0].total, rep.total);
});

test('schede di stampa: cliente (senza PIN) e laboratorio (con PIN, diagnosi e checklist)', async () => {
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Rita Conti', phone: '3290001111' }, brand_model: 'iPhone 12', problem: 'Non carica', passcode: '987654', urgent: true, quote: 70, deposit: 10 })).data;
  assert.equal(r.urgent, 1);
  await a('PATCH', `/api/repairs/${r.id}`, { tech_notes: 'Connettore di carica ossidato, pulizia e sostituzione.' });

  const cust = (await a('GET', `/print/customer/${r.id}?noprint=1`)).data;
  assert.ok(cust.includes('Scheda cliente') && cust.includes(r.code) && cust.includes('/api/qr?text=') && cust.includes('Rita Conti'));
  assert.ok(cust.includes('URGENTE'));
  assert.ok(!cust.includes('987654'), 'il PIN non deve comparire sulla copia del cliente');
  assert.ok(!cust.includes('Connettore di carica ossidato'), 'le note tecniche non vanno al cliente');
  assert.ok(!cust.includes('window.print()') || !cust.includes("addEventListener('load'"), 'con noprint=1 non parte la stampa automatica');

  const lab = (await a('GET', `/print/lab/${r.id}?noprint=1`)).data;
  assert.ok(lab.includes('Scheda laboratorio') && lab.includes('987654') && lab.includes('Connettore di carica ossidato'));
  assert.ok(lab.includes('Collaudo finale') && lab.includes('Controllo all'));

  const both = (await a('GET', `/print/both/${r.id}`)).data;
  assert.ok(both.includes('Scheda cliente') && both.includes('Scheda laboratorio'));
  assert.ok(both.includes("addEventListener('load'"), 'senza noprint la stampa parte da sola');
  assert.equal((await a('GET', '/print/lab/99999')).status, 404);

  // le urgenti vengono per prime nell'elenco
  const list = (await a('GET', '/api/repairs?open=1')).data;
  assert.equal(list[0].id, r.id);
  assert.equal((await a('PATCH', `/api/repairs/${r.id}`, { urgent: false })).data.urgent, 0);
});

test('codice a barre Code 128 per le etichette', async () => {
  const { code128bModules } = await import('../barcode.mjs');
  const bits = code128bModules('R-2026-0001');
  assert.ok(bits.startsWith('11010010000'), 'inizia con lo Start B');
  assert.ok(bits.endsWith('1100011101011'), 'finisce con lo Stop');
  assert.equal((bits.length - 13) % 11, 0, 'ogni simbolo è di 11 moduli');
  const res = await fetch(`${A}/api/barcode?text=R-2026-0001`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /svg/);
  assert.equal((await fetch(`${A}/api/barcode`)).status, 400);
  const r = (await a('GET', '/api/repairs?q=Rita')).data[0];
  assert.ok((await a('GET', `/print/label/${r.id}?noprint=1`)).data.includes('/api/barcode?text='));
  assert.ok((await a('GET', `/print/lab/${r.id}?noprint=1`)).data.includes('/api/barcode?text='));
  // la ricerca per seriale o per codice (quello che fa la pistola) trova la riparazione
  await a('PATCH', `/api/repairs/${r.id}`, { serial: '356938035643809' });
  assert.equal((await a('GET', '/api/repairs?q=356938035643809')).data.length, 1);
  assert.equal((await a('GET', `/api/repairs?q=${r.code}`)).data[0].id, r.id);
});

test('ricerca cliente: numero ricevuta + ultime 4 cifre del telefono', async () => {
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Anna Verdi', phone: '3395550142' }, brand_model: 'Samsung A54', problem: 'Schermo rotto' })).data;
  const ok = await call(P, 'POST', '/api/lookup', { code: r.code, phone4: '0142' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.token, r.token);
  // anche scrivendo solo il numero progressivo
  const short = await call(P, 'POST', '/api/lookup', { code: r.code.slice(-4), phone4: '0142' });
  assert.equal(short.data.token, r.token);
  assert.equal((await call(P, 'POST', '/api/lookup', { code: r.code, phone4: '9999' })).status, 404);
  assert.equal((await call(P, 'POST', '/api/lookup', { code: '', phone4: '' })).status, 404);
});

test('utenti: solo email valide, il proprietario è protetto', async () => {
  const { ensureOwner } = await import('../dbref.mjs');
  await ensureOwner('owner@example.com');
  const list = (await a('GET', '/api/users')).data;
  const owner = list.find((u) => u.email === 'owner@example.com');
  assert.ok(owner.protected);
  assert.equal((await a('DELETE', `/api/users/${owner.id}`)).status, 409);
  assert.equal((await a('POST', '/api/users', { email: 'non-valida' })).status, 400);
  const u = (await a('POST', '/api/users', { email: 'Cassa@Example.com', name: 'Cassa', role: 'staff' })).data;
  assert.equal(u.email, 'cassa@example.com');
  assert.equal((await a('POST', '/api/users', { email: 'cassa@example.com' })).status, 409);
  assert.equal((await a('PUT', `/api/users/${u.id}`, { name: 'Cassa', role: 'cassa' })).data.role, 'cassa');
  assert.equal((await a('DELETE', `/api/users/${u.id}`)).data.ok, true);
});

test('ricerca cliente: il sito pubblico può chiamarla da un altro dominio (CORS)', async () => {
  const res = await fetch(`${P}/api/lookup`, { method: 'OPTIONS', headers: { origin: 'https://informatixrepair.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://informatixrepair.com');
  const bad = await fetch(`${P}/api/lookup`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
  assert.notEqual(bad.headers.get('access-control-allow-origin'), 'https://evil.example');
});

test('analisi: riparazioni, incassi e vendite del periodo', async () => {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const r = (await a('GET', `/api/analytics?from=${day}&to=${day}`)).data;
  assert.equal(r.days, 1);
  assert.ok(r.repairs.intake >= 1);
  assert.ok(Array.isArray(r.repairs.models) && r.repairs.models[0].n >= 1);
  assert.ok(r.income.total >= 0 && 'prev_total' in r.income && 'margin' in r.income);
  assert.ok(r.sales.count >= 1 && r.sales.top.length >= 1);
  assert.equal((await a('GET', '/api/analytics?from=2030-02-01&to=2030-01-01')).status, 400);
});

test('dati demo: si caricano, si vedono ovunque e si cancellano senza toccare i dati veri', async () => {
  const realCustomers = (await a('GET', '/api/customers')).data.length;
  const realRepairs = (await a('GET', '/api/repairs')).data.length;
  assert.equal((await a('GET', '/api/demo')).data.loaded, false);
  const loaded = await a('POST', '/api/demo');
  assert.equal(loaded.status, 200);
  assert.equal((await a('POST', '/api/demo')).status, 409); // non si caricano due volte
  assert.ok((await a('GET', '/api/customers')).data.length >= realCustomers + 8);
  assert.ok((await a('GET', '/api/repairs')).data.length >= realRepairs + 14);
  const dash = (await a('GET', '/api/dashboard')).data;
  assert.ok(dash.ready.length >= 2 && dash.to_approve.length >= 1 && dash.low_stock.length >= 1);
  const an = (await a('GET', '/api/analytics?from=2000-01-01&to=2099-12-31')).data;
  assert.ok(an.sales.count >= 13 && an.income.total > 0);
  // la cassa di oggi non e' vuota (cosi' si vede subito qualcosa)
  const oggi = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const cassa = (await a('GET', `/api/report?from=${oggi}&to=${oggi}`)).data;
  assert.ok(cassa.rows.length >= 4 && cassa.total > 0);
  // tracciamento pubblico di una riparazione demo
  assert.equal((await call(P, 'GET', '/api/track/demo-token-4')).data.status, 'quote_pending');
  // un cliente demo si ritrova con la ricerca per ricevuta + telefono
  assert.equal((await call(P, 'POST', '/api/lookup', { code: 'DEMO-004', phone4: '0104' })).status, 200);
  const del = await a('DELETE', '/api/demo');
  assert.equal(del.status, 200);
  assert.equal((await a('GET', '/api/customers')).data.length, realCustomers);
  assert.equal((await a('GET', '/api/repairs')).data.length, realRepairs);
  assert.equal((await a('GET', '/api/demo')).data.loaded, false);
  assert.equal((await a('GET', '/api/products')).data.filter((p) => p.id < 0).length, 0);
});

test('avvisi: scorta bassa/esaurita, prodotto fermo, soglie da Impostazioni', async () => {
  await a('POST', '/api/demo');
  let al = (await a('GET', '/api/alerts')).data;
  assert.ok(al.items.some((x) => x.type === 'out_of_stock' && /USB-C/.test(x.title)));
  assert.ok(al.items.some((x) => x.type === 'low_stock'));
  assert.ok(al.items.some((x) => x.type === 'stale' && /ASUS/.test(x.title)));
  assert.ok(al.items.some((x) => x.type === 'declined'));
  // spegnendo la soglia dei fermi, quegli avvisi spariscono
  await a('PUT', '/api/settings', { stale_days: '0' });
  al = (await a('GET', '/api/alerts')).data;
  assert.ok(!al.items.some((x) => x.type === 'stale'));
  // una soglia generale alta fa scattare altri prodotti
  const before = al.items.filter((x) => x.type === 'low_stock').length;
  await a('PUT', '/api/settings', { low_stock_default: '50' });
  assert.ok((await a('GET', '/api/alerts')).data.items.filter((x) => x.type === 'low_stock').length > before);
  await a('PUT', '/api/settings', { low_stock_default: '0', stale_days: '90' });
  await a('DELETE', '/api/demo');
});

test('spese e nota spese in PDF', async () => {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  assert.equal((await a('POST', '/api/expenses', { description: '', amount: 10 })).status, 400);
  assert.equal((await a('POST', '/api/expenses', { description: 'Prova', amount: -5 })).status, 400);
  assert.equal((await a('POST', '/api/expenses', { description: 'Prova', amount: 50, vat: 80 })).status, 400);
  const e = (await a('POST', '/api/expenses', { spent_on: day, description: 'Cartucce stampante “àèìòù” € ★', category: 'attrezzatura', vendor: 'Cartoleria', amount: '45,50', vat: 8.2, doc_type: 'fattura', doc_number: '12/A', paid_by: 'Christian', reimbursable: true })).data;
  assert.equal(e.amount, 45.5);
  assert.equal((await a('PUT', `/api/expenses/${e.id}`, { ...e, amount: 50 })).data.amount, 50);
  const list = (await a('GET', `/api/expenses?from=${day}&to=${day}`)).data;
  assert.equal(list.total, 50);
  assert.equal(list.to_reimburse, 50);
  const res = await fetch(`${A}/api/expenses-pdf?from=${day}&to=${day}&who=Christian`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.length > 1500);
  // molte righe: il PDF si estende su piu' pagine senza errori
  for (let i = 0; i < 45; i++) await a('POST', '/api/expenses', { spent_on: day, description: `Voce lunga numero ${i} con una descrizione piuttosto estesa per verificare l’andata a capo`, amount: 10 + i, category: 'altro' });
  const big = await fetch(`${A}/api/expenses-pdf?from=${day}&to=${day}`);
  assert.equal(big.status, 200);
  assert.ok((await big.arrayBuffer()).byteLength > buf.length);
  assert.equal((await a('DELETE', `/api/expenses/${e.id}`)).data.ok, true);
});

test('notifiche Telegram: testo chiaro, escape HTML, niente segreti', async () => {
  const { describeEvent } = await import('../notify.mjs');
  const u = { name: 'Marco', email: 'm@example.com' };
  const e500 = describeEvent({ method: 'POST', path: '/api/sales', status: 500, user: u, error: 'boom <x> & 123456789:AAAbbbCCCdddEEEfffGGGhhhIIIjjjKKK12' });
  assert.match(e500, /ERRORE 500/);
  assert.ok(e500.includes('&lt;x&gt; &amp;') && e500.includes('[token]') && !e500.includes('AAAbbb'));
  assert.match(describeEvent({ method: 'POST', path: '/api/sales', status: 400, user: u, result: { error: 'Aggiungi almeno un articolo' } }), /Vendita: operazione non riuscita/);
  const p = describeEvent({ method: 'POST', path: '/api/repairs/1/parts', status: 200, user: u, body: { product_id: 3, qty: 2 }, result: { code: 'R-1', parts: [{ name: 'Display <A&B>' }] } });
  assert.ok(p.includes('Display &lt;A&amp;B&gt; ×2'));
  const s = describeEvent({ method: 'PUT', path: '/api/settings', status: 200, user: u, body: { shop_name: 'x', admin_password: 'segreto' } });
  assert.ok(s.includes('nome negozio') && !s.includes('password') && !s.includes('segreto'));
  const n = describeEvent({ method: 'POST', path: '/api/repairs', status: 200, user: u, body: { problem: 'x', passcode: '9876' }, result: { code: 'R-1', customer_phone: '3331234567', passcode: '9876' } });
  assert.ok(!n.includes('9876') && !n.includes('3331234567'));
  assert.equal(describeEvent({ method: 'GET', path: '/print/customer/9', status: 404, user: u }), null);
});

test('dati demo: l’eliminazione riesce anche se dati veri usano clienti o prodotti demo (i dati veri restano)', async () => {
  await a('POST', '/api/demo');
  // riparazione VERA su un cliente demo (si ritrova col telefono), vendita VERA con un prodotto demo e un cliente demo
  const rep = (await a('POST', '/api/repairs', { customer: { name: 'Giulia Esposito', phone: '3330000101' }, brand_model: 'Pixel 8', problem: 'Schermo' })).data;
  assert.ok(rep.customer_id < 0, 'la riparazione e\' stata agganciata al cliente demo');
  const sale = (await a('POST', '/api/sales', { customer_id: -2, items: [{ product_id: -6, qty: 1 }], method: 'contanti' })).data;
  assert.ok(sale.id > 0);
  // prodotto vero con fornitore demo
  const prod = (await a('POST', '/api/products', { name: 'Prodotto vero', qty: 2, price: 10, cost: 5, supplier_id: -1 })).data;
  const del = await a('DELETE', '/api/demo');
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal((await a('GET', '/api/demo')).data.loaded, false);
  // la riparazione vera esiste ancora e ha un cliente vero con lo stesso nome
  const after = (await a('GET', `/api/repairs/${rep.id}`)).data;
  assert.ok(after.customer_id > 0); assert.equal(after.customer_name, 'Giulia Esposito');
  const s2 = (await a('GET', `/api/sales/${sale.id}`)).data;
  assert.equal(s2.customer_name, 'Antonio Ferrara'); assert.equal(s2.items.length, 1);
  const p2 = (await a('GET', '/api/products?q=Prodotto vero')).data[0];
  assert.ok(p2.supplier_id > 0 && /Ricambi Napoli/.test(p2.supplier_name));
  // ripetibile: ricaricando e rieliminando non si blocca
  await a('POST', '/api/demo');
  assert.equal((await a('DELETE', '/api/demo')).status, 200);
});

test('notifiche: le semplici letture (aprire Impostazioni, controlli di stato) non avvisano mai', async () => {
  const { describeEvent } = await import('../notify.mjs');
  const u = { name: 'Christian', email: 'djchri.cp@gmail.com' };
  for (const path of ['/api/demo', '/api/settings', '/api/me', '/api/meta', '/api/alerts', '/api/users', '/api/backup/r2', '/api/expenses', '/api/analytics', '/api/dashboard', '/api/report']) {
    assert.equal(describeEvent({ method: 'GET', path, status: 200, user: u, result: { loaded: false } }), null, `GET ${path} non deve notificare`);
  }
  // le azioni vere continuano ad avvisare
  assert.match(describeEvent({ method: 'DELETE', path: '/api/demo', status: 200, user: u, result: {} }), /Dati demo eliminati/);
  assert.match(describeEvent({ method: 'POST', path: '/api/demo', status: 200, user: u, result: {} }), /Dati demo caricati/);
});

test('ricambio a mano: il costo entra nel guadagno e non tocca il magazzino', async () => {
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Prova ricambio' }, brand_model: 'Telefono X', problem: 'display', quote: 100 })).data;
  const out = (await a('POST', `/api/repairs/${r.id}/parts`, { name: 'Display', qty: 2, unit_cost: 30, unit_price: 0, supplier_name: 'Forn', supplier_code: 'D-1', bought_at: '2026-10-14' })).data;
  assert.equal(out.parts_cost, 60);
  assert.equal(out.profit_estimate, 40);
  assert.equal(out.parts[0].supplier_code, 'D-1');
});
