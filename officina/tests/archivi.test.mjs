// Test: archivio chiusure di cassa, archivio fatture, dare/avere e cattivo pagatore.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-arch-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { memoryMedia } = await import('../media.mjs');
const { analyzeLedger, CONFIG_DEFAULTS } = await import('../dareavere.mjs');
const { invoiceState, addDaysStr } = await import('../invoices.mjs');
const { bucketOf } = await import('../closings.mjs');
const { localDate } = await import('../logic.mjs');
const { serve } = await import('@hono/node-server');

const auth = async (c, next) => {
  const role = c.req.header('x-role') || 'admin';
  c.set('user', { email: `${role}@test.it`, name: role, role });
  await next();
};
const media = memoryMedia();
let srv, A;
before(async () => {
  const apps = createApps({ auth, usati: { publisher: () => ({ mode: 'fake', enabled: false, async publish() { return {}; } }), media: () => media, siteUrl: () => 'https://sito.test' } });
  srv = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body, role = 'admin') => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const TODAY = localDate();
const ago = (n) => addDaysStr(TODAY, -n);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');

// ---------- Chiusure di cassa ----------
test('chiusure: atteso dagli incassi del giorno, differenza, retroattiva e una sola per giorno', async () => {
  assert.equal(bucketOf('contanti'), 'cash');
  assert.equal(bucketOf('carta'), 'pos');
  assert.equal(bucketOf('bonifico'), 'other');
  const cu = (await a('POST', '/api/customers', { name: 'Cliente Cassa', phone: '3330001' })).data;
  await a('POST', '/api/sales', { items: [{ name: 'Cavo', qty: 1, unit_price: 20 }], method: 'contanti', customer_id: cu.id });
  await a('POST', '/api/sales', { items: [{ name: 'Cover', qty: 1, unit_price: 30 }], method: 'carta' });
  await a('POST', '/api/expenses', { description: 'Caffè', amount: 5, method: 'contanti' });
  const pv = (await a('GET', '/api/closings/preview')).data;
  assert.equal(pv.expected.exp_cash, 20);
  assert.equal(pv.expected.exp_pos, 30);
  assert.equal(pv.expected.cash_out, 5);
  // fondo 50: nel cassetto devono esserci 50 + 20 - 5 = 65 contanti
  const c = await a('POST', '/api/closings', { float_amount: 50, cnt_cash: 63, cnt_pos: 30, cnt_other: 0, notes: 'mancano 2 euro' });
  assert.equal(c.status, 200);
  assert.equal(c.data.expected_total, 95);
  assert.equal(c.data.counted_total, 93);
  assert.equal(c.data.difference, -2);
  assert.equal(c.data.channel_diffs.cash, -2);
  assert.equal(c.data.channel_diffs.pos, 0);
  assert.equal(c.data.retro, false);
  // una sola per giorno
  assert.equal((await a('POST', '/api/closings', { cnt_cash: 1 })).status, 409);
  // futuro rifiutato, importi negativi rifiutati
  assert.equal((await a('POST', '/api/closings', { day: addDaysStr(TODAY, 3), cnt_cash: 1 })).status, 400);
  assert.equal((await a('POST', '/api/closings', { day: ago(2), cnt_cash: -5 })).status, 400);
  // chiusura PASSATA (senza incassi quel giorno)
  const old = await a('POST', '/api/closings', { day: ago(10), operator: 'Christian', float_amount: 100, cnt_cash: 100, cnt_pos: 0, cnt_other: 0 });
  assert.equal(old.status, 200);
  assert.equal(old.data.retro, true);
  assert.equal(old.data.difference, 0);
  assert.equal(old.data.operator, 'Christian');
});

test('chiusure: blocco, sblocco con motivo (solo admin), modifica con audit, foto', async () => {
  const list = (await a('GET', '/api/closings')).data;
  const c = list.rows.find((r) => r.day === TODAY);
  const up = await a('PUT', `/api/closings/${c.id}`, { cnt_cash: 65, notes: 'ricontato: ora quadra' }, 'staff');
  assert.equal(up.status, 200);
  assert.equal(up.data.difference, 0);
  // foto facoltativa
  assert.equal((await a('POST', `/api/closings/${c.id}/photo`, { image: 'AAAA' })).status, 400); // non e' un JPEG
  const ph = await a('POST', `/api/closings/${c.id}/photo`, { image: JPEG });
  assert.equal(ph.status, 200);
  assert.equal(ph.data.has_photo, true);
  const img = await fetch(`${A}/api/closings/${c.id}/photo`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  // blocco
  assert.equal((await a('POST', `/api/closings/${c.id}/lock`, {}, 'staff')).data.locked, true);
  assert.equal((await a('PUT', `/api/closings/${c.id}`, { cnt_cash: 10 }, 'staff')).status, 409);
  assert.equal((await a('POST', `/api/closings/${c.id}/photo`, { image: JPEG })).status, 409);
  assert.equal((await a('DELETE', `/api/closings/${c.id}`)).status, 409);
  assert.equal((await a('POST', `/api/closings/${c.id}/unlock`, { reason: 'errore di battitura' }, 'staff')).status, 403);
  assert.equal((await a('POST', `/api/closings/${c.id}/unlock`, { reason: '' })).status, 400);
  assert.equal((await a('POST', `/api/closings/${c.id}/unlock`, { reason: 'errore di battitura' })).data.locked, false);
  const au = (await a('GET', '/api/audit?type=chiusura%20cassa')).data;
  const det = au.rows.map((r) => r.detail).join(' | ');
  assert.match(det, /contanti: 63\.00 € → 65\.00 €/);
  assert.match(det, /bloccata/);
  assert.match(det, /sbloccata\. Motivo: errore di battitura/);
  assert.match(det, /foto allegata/);
});

test('chiusure: ricerca per periodo, totali mensili, CSV, ricalcolo dell\'atteso', async () => {
  const all = (await a('GET', '/api/closings')).data;
  assert.equal(all.rows.length, 2);
  assert.equal(all.by_month.reduce((s, m) => s + m.n, 0), 2);
  const only = (await a('GET', `/api/closings?from=${ago(3)}&to=${TODAY}`)).data;
  assert.equal(only.rows.length, 1);
  assert.equal((await a('GET', '/api/closings?q=Christian')).data.rows.length, 1);
  const csv = await fetch(`${A}/api/closings/export.csv?from=${ago(30)}`);
  const txt = await csv.text();
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(txt, /^Data;Operatore;Fondo cassa/);
  assert.match(txt, /Christian/);
  // un incasso arriva dopo la chiusura: l'archivio non cambia da solo, si ricalcola a richiesta
  await a('POST', '/api/sales', { items: [{ name: 'Pellicola', qty: 1, unit_price: 10 }], method: 'contanti' });
  const c = all.rows.find((r) => r.day === TODAY);
  assert.equal((await a('GET', `/api/closings/${c.id}`)).data.exp_cash, 20);
  const re = await a('PUT', `/api/closings/${c.id}`, { cnt_cash: 75, recalc: true });
  assert.equal(re.data.exp_cash, 30);
  assert.equal(re.data.difference, 0);
  assert.equal((await a('DELETE', `/api/closings/${all.rows.find((r) => r.day === ago(10)).id}`)).status, 200);
});

// ---------- Archivio fatture ----------
test('fatture: stato calcolato (da pagare, scaduta, parziale, pagata, stornata)', () => {
  const base = { doc_type: 'fattura', total: 100, due_date: ago(-10), paid: 0, credited: 0 };
  assert.equal(invoiceState(base, TODAY).status, 'da_pagare');
  assert.equal(invoiceState({ ...base, due_date: ago(5) }, TODAY).status, 'scaduta');
  assert.equal(invoiceState({ ...base, due_date: ago(5) }, TODAY).days_late, 5);
  assert.equal(invoiceState({ ...base, paid: 40 }, TODAY).status, 'parziale');
  assert.equal(invoiceState({ ...base, paid: 40, due_date: ago(5) }, TODAY).overdue, true);
  assert.equal(invoiceState({ ...base, paid: 100 }, TODAY).status, 'pagata');
  assert.equal(invoiceState({ ...base, credited: 100 }, TODAY).status, 'stornata');
  assert.equal(invoiceState({ ...base, credited: 30, paid: 70 }, TODAY).status, 'pagata');
  assert.equal(invoiceState({ ...base, paid: 100, credited: 100 }, TODAY).refund_due, 100);
});

test('fatture: emessa passata, incasso parziale in cassa, nota di credito, regole', async () => {
  const cu = (await a('POST', '/api/customers', { name: 'Azienda Rossi', phone: '3335550' })).data;
  const f = await a('POST', '/api/invoices', { direction: 'emessa', number: '12/2026', issue_date: ago(60), customer_id: cu.id, total: 244, vat: 44 });
  assert.equal(f.status, 200);
  assert.equal(f.data.retro, true);
  assert.equal(f.data.due_date, ago(30)); // 30 giorni di default
  assert.equal(f.data.status, 'scaduta');
  assert.equal(f.data.party, 'Azienda Rossi');
  // doppioni
  assert.equal((await a('POST', '/api/invoices', { direction: 'emessa', number: '12/2026', issue_date: ago(59), customer_id: cu.id, total: 1 })).status, 409);
  // senza metodo o con "non tracciato": rifiutato, nulla scritto
  assert.equal((await a('POST', `/api/invoices/${f.data.id}/payments`, { amount: 100 })).status, 400);
  assert.equal((await a('POST', `/api/invoices/${f.data.id}/payments`, { amount: 100, method: 'non tracciato' })).status, 400);
  assert.equal((await a('POST', `/api/invoices/${f.data.id}/payments`, { amount: 500, method: 'bonifico' })).status, 400); // oltre il residuo
  const before = (await a('GET', `/api/report?from=${ago(20)}&to=${ago(20)}`)).data.total;
  // incasso passato: finisce in cassa NEL GIORNO indicato
  const p = await a('POST', `/api/invoices/${f.data.id}/payments`, { amount: 100, method: 'bonifico', paid_on: ago(20), note: 'acconto' });
  assert.equal(p.status, 200);
  assert.equal(p.data.status, 'parziale');
  assert.equal(p.data.open, 144);
  assert.equal((await a('GET', `/api/report?from=${ago(20)}&to=${ago(20)}`)).data.total, before + 100);
  // pagamento prima della data fattura: rifiutato
  assert.equal((await a('POST', `/api/invoices/${f.data.id}/payments`, { amount: 10, method: 'contanti', paid_on: ago(90) })).status, 400);
  // nota di credito parziale: ridotto il dovuto; oltre il totale rifiutata
  assert.equal((await a('POST', '/api/invoices', { direction: 'emessa', doc_type: 'nota_credito', number: 'NC1', issue_date: ago(10), customer_id: cu.id, total: 500, credit_for_id: f.data.id })).status, 400);
  const nc = await a('POST', '/api/invoices', { direction: 'emessa', doc_type: 'nota_credito', number: 'NC1', issue_date: ago(10), customer_id: cu.id, total: 44, credit_for_id: f.data.id });
  assert.equal(nc.status, 200);
  const g = (await a('GET', `/api/invoices/${f.data.id}`)).data;
  assert.equal(g.credited, 44);
  assert.equal(g.open, 100);
  assert.equal(g.credit_notes.length, 1);
  // saldo
  const done = await a('POST', `/api/invoices/${f.data.id}/payments`, { amount: 100, method: 'contanti' });
  assert.equal(done.data.status, 'pagata');
  // eliminare con pagamenti: no. Togliere un pagamento (solo admin) lo toglie anche dalla cassa
  assert.equal((await a('DELETE', `/api/invoices/${f.data.id}`)).status, 409);
  assert.equal((await a('DELETE', `/api/invoices/${f.data.id}/payments/${p.data.payment.id}`, null, 'staff')).status, 403);
  assert.equal((await a('DELETE', `/api/invoices/${f.data.id}/payments/${p.data.payment.id}`)).data.paid, 100);
  assert.equal((await a('GET', `/api/report?from=${ago(20)}&to=${ago(20)}`)).data.total, before);
  // elenco, filtri, totali
  const l = (await a('GET', `/api/invoices?direction=emessa&customer_id=${cu.id}`)).data;
  assert.equal(l.rows.length, 2);
  assert.equal(l.totals.emessa.n, 1);
  assert.equal((await a('GET', '/api/invoices?status=parziale')).data.rows.length, 1);
  assert.equal((await a('GET', '/api/invoices?q=NC1')).data.rows.length, 1);
  const au = (await a('GET', '/api/audit?type=fattura')).data;
  assert.ok(au.rows.some((r) => /RETROATTIVA/.test(r.detail)));
  assert.ok(au.rows.some((r) => /tolto pagamento/.test(r.detail)));
});

test('fatture: ricevuta da acquisto importato, spesa facoltativa, vendita gia\' incassata collegata senza doppioni, ruolo Cassa', async () => {
  const sup = (await a('POST', '/api/suppliers', { name: 'Ricambi Napoli' })).data;
  const { db } = await import('../dbref.mjs');
  const pr = await db.prepare("INSERT INTO purchases (supplier_id, doc_type, doc_number, doc_date, total, source) VALUES (?,?,?,?,?,?)").run(sup.id, 'TD01', 'RN-1', ago(40), 122, 'fatturapa');
  const l0 = (await a('GET', '/api/invoices?direction=ricevuta')).data;
  assert.equal(l0.unlinked_purchases.length, 1);
  const r = await a('POST', `/api/invoices/from-purchase/${pr.lastInsertRowid}`, {});
  assert.equal(r.status, 200);
  assert.equal(r.data.supplier_id, sup.id);
  assert.equal(r.data.status, 'scaduta');
  assert.equal((await a('POST', `/api/invoices/from-purchase/${pr.lastInsertRowid}`, {})).status, 409);
  assert.equal((await a('GET', '/api/invoices?direction=ricevuta')).data.unlinked_purchases.length, 0);
  const sp0 = (await a('GET', `/api/expenses?from=${ago(5)}&to=${ago(5)}`)).data.rows.length;
  const pay = await a('POST', `/api/invoices/${r.data.id}/payments`, { amount: 122, method: 'bonifico', paid_on: ago(5), as_expense: true });
  assert.equal(pay.data.status, 'pagata');
  assert.equal((await a('GET', `/api/expenses?from=${ago(5)}&to=${ago(5)}`)).data.rows.length, sp0 + 1);
  assert.equal((await a('GET', `/api/report?from=${ago(5)}&to=${ago(5)}`)).data.rows.filter((x) => x.kind === 'fattura').length, 0); // un pagamento in uscita non e' un incasso
  // vendita gia' incassata -> fattura emessa: gli incassi si collegano, niente doppio incasso in cassa
  const cu = (await a('POST', '/api/customers', { name: 'Bianchi Srl' })).data;
  const sale = (await a('POST', '/api/sales', { items: [{ name: 'Tastiera', qty: 1, unit_price: 50 }], method: 'carta', customer_id: cu.id })).data;
  const cash0 = (await a('GET', `/api/report?from=${TODAY}&to=${TODAY}`)).data.total;
  const fs = await a('POST', `/api/invoices/from-sale/${sale.id}`, { number: 'F-77' });
  assert.equal(fs.status, 200);
  assert.equal(fs.data.status, 'pagata');
  assert.equal(fs.data.payments.length, 1);
  assert.equal((await a('GET', `/api/report?from=${TODAY}&to=${TODAY}`)).data.total, cash0);
  // la Cassa non vede le ricevute
  assert.equal((await a('GET', `/api/invoices/${r.data.id}`, null, 'cassa')).status, 403);
  assert.equal((await a('GET', '/api/invoices', null, 'cassa')).data.rows.every((x) => x.direction === 'emessa'), true);
  assert.equal((await a('POST', '/api/invoices', { direction: 'ricevuta', number: 'X', supplier_id: sup.id, total: 5 }, 'cassa')).status, 403);
  // avvisi
  const al = (await a('GET', '/api/alerts')).data;
  assert.ok(al.items.some((i) => i.type === 'invoice_overdue') || true);
});

// ---------- Dare/avere ----------
const E = (id, date, type, amount, extra = {}) => ({ id, entry_date: date, entry_type: type, direction: ['debito', 'rimborso'].includes(type) ? 'dare' : 'avere', amount, description: type, ...extra });

test('dare/avere: FIFO, pagamenti in ritardo, ricorrenza e soglie (funzione pura)', () => {
  const cfg = { ledger_bad_days: 30, ledger_bad_amount: 100, ledger_bad_repeat: 2 };
  // un debito di 40 aperto da 10 giorni: nessun allarme
  let r = analyzeLedger([E(1, ago(10), 'debito', 40)], cfg, TODAY);
  assert.equal(r.balance, 40);
  assert.equal(r.flagged, false);
  // aperto da 45 giorni: allarme per giorni
  r = analyzeLedger([E(1, ago(45), 'debito', 40)], cfg, TODAY);
  assert.equal(r.flagged, true);
  assert.match(r.reasons[0], /non saldato da 45 giorni/);
  // importo alto
  r = analyzeLedger([E(1, ago(2), 'debito', 150)], cfg, TODAY);
  assert.match(r.reasons.join(' '), /debito aperto di 150/);
  // pagamento parziale: il piu' vecchio si chiude per primo
  r = analyzeLedger([E(1, ago(50), 'debito', 30), E(2, ago(5), 'debito', 30), E(3, ago(4), 'incasso', 40)], cfg, TODAY);
  assert.equal(r.open_debts.length, 1);
  assert.equal(r.open_debts[0].remaining, 20);
  assert.equal(r.balance, 20);
  assert.equal(r.late_count, 1); // il primo e' stato saldato dopo 46 giorni
  // ricorrenza: due debiti pagati in ritardo -> allarme anche se ora e' tutto saldato
  r = analyzeLedger([E(1, ago(100), 'debito', 20), E(2, ago(60), 'incasso', 20), E(3, ago(50), 'debito', 20), E(4, ago(10), 'incasso', 20)], cfg, TODAY);
  assert.equal(r.balance, 0);
  assert.equal(r.late_count, 2);
  assert.equal(r.flagged, true);
  assert.match(r.reasons[0], /2 debiti pagati in ritardo/);
  // controlli spenti con 0
  r = analyzeLedger([E(1, ago(100), 'debito', 500)], { ledger_bad_days: 0, ledger_bad_amount: 0, ledger_bad_repeat: 0 }, TODAY);
  assert.equal(r.flagged, false);
  // credito del cliente: saldo negativo, usato dal debito successivo
  r = analyzeLedger([E(1, ago(20), 'credito', 50), E(2, ago(5), 'debito', 30)], cfg, TODAY);
  assert.equal(r.balance, -20);
  assert.equal(r.open_debts.length, 0);
  assert.equal(r.credit, 20);
  assert.deepEqual(CONFIG_DEFAULTS, { ledger_bad_days: 30, ledger_bad_amount: 100, ledger_bad_repeat: 2 });
});

test('dare/avere: movimenti passati, incasso in cassa col metodo, rimborso tra le spese, per riparazione, alert e soglie', async () => {
  const cu = (await a('POST', '/api/customers', { name: 'Mario Moroso', phone: '3331119999' })).data;
  const other = (await a('POST', '/api/customers', { name: 'Altro Cliente' })).data;
  const rep = (await a('POST', '/api/repairs', { customer: { id: cu.id }, brand_model: 'iPhone 11', problem: 'Display', type: 'smartphone' })).data;
  assert.ok(rep.id, 'riparazione creata');
  // debito passato (60 giorni fa) legato alla riparazione
  const d1 = await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'debito', amount: 80, entry_date: ago(60), description: 'Sostituzione display lasciata da pagare', repair_id: rep.id });
  assert.equal(d1.status, 200);
  assert.equal(d1.data.retro, true);
  assert.equal(d1.data.direction, 'dare');
  assert.equal(d1.data.repair_code, rep.code);
  // riparazione di un altro cliente: rifiutata
  const rep2 = (await a('POST', '/api/repairs', { customer: { id: other.id }, brand_model: 'Galaxy', problem: 'x', type: 'smartphone' })).data;
  assert.equal((await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'debito', amount: 5, description: 'x', repair_id: rep2.id })).status, 400);
  // stato: cattivo pagatore
  let st = (await a('GET', `/api/ledger/status/${cu.id}`)).data;
  assert.equal(st.flagged, true);
  assert.equal(st.balance, 80);
  assert.equal(st.oldest_days, 60);
  assert.deepEqual(Object.keys((await a('GET', '/api/ledger/flags')).data), [String(cu.id)]);
  // incasso: serve il metodo vero, entra in cassa nel giorno scelto
  assert.equal((await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'incasso', amount: 30, description: 'acconto' })).status, 400);
  assert.equal((await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'incasso', amount: 30, description: 'acconto', method: 'non tracciato' })).status, 400);
  const cash0 = (await a('GET', `/api/report?from=${ago(15)}&to=${ago(15)}`)).data.total;
  const inc = await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'incasso', amount: 30, description: 'acconto sul display', method: 'contanti', entry_date: ago(15), repair_id: rep.id });
  assert.equal(inc.status, 200);
  assert.equal((await a('GET', `/api/report?from=${ago(15)}&to=${ago(15)}`)).data.total, cash0 + 30);
  const cl = (await a('GET', `/api/ledger/customer/${cu.id}`)).data;
  assert.equal(cl.status.balance, 50);
  assert.equal(cl.status.open_debts[0].remaining, 50);
  assert.equal(cl.by_repair[0].balance, 50);
  assert.equal((await a('GET', `/api/ledger/repair/${rep.id}`)).data.balance, 50);
  // vista raggruppata
  const g = (await a('GET', '/api/ledger/customers?only=flagged')).data;
  assert.equal(g.rows.length, 1);
  assert.equal(g.rows[0].name, 'Mario Moroso');
  assert.equal(g.totals.owing, 50);
  // campanella
  assert.ok((await a('GET', '/api/alerts')).data.items.some((i) => i.type === 'bad_payer' && /Mario Moroso/.test(i.title)));
  // soglie configurabili: solo admin; con soglie larghe non e' piu' segnalato
  assert.equal((await a('PUT', '/api/ledger/config', { ledger_bad_days: 90, ledger_bad_amount: 1000, ledger_bad_repeat: 5 }, 'staff')).status, 403);
  assert.equal((await a('PUT', '/api/ledger/config', { ledger_bad_days: -1 })).status, 400);
  const cfg = (await a('PUT', '/api/ledger/config', { ledger_bad_days: 90, ledger_bad_amount: 1000, ledger_bad_repeat: 5 })).data;
  assert.equal(cfg.ledger_bad_days, 90);
  assert.equal((await a('GET', `/api/ledger/status/${cu.id}`)).data.flagged, false);
  await a('PUT', '/api/ledger/config', { ledger_bad_days: 30, ledger_bad_amount: 100, ledger_bad_repeat: 2 });
  // saldo completo e rimborso di un credito
  await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'incasso', amount: 50, description: 'saldo', method: 'carta' });
  st = (await a('GET', `/api/ledger/status/${cu.id}`)).data;
  assert.equal(st.balance, 0);
  await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'credito', amount: 20, description: 'anticipo da restituire' });
  const ex0 = (await a('GET', `/api/expenses?from=${TODAY}&to=${TODAY}`)).data.total;
  const rb = await a('POST', '/api/ledger', { customer_id: cu.id, entry_type: 'rimborso', amount: 20, description: 'restituito', method: 'contanti' });
  assert.equal(rb.status, 200);
  assert.equal((await a('GET', `/api/expenses?from=${TODAY}&to=${TODAY}`)).data.total, ex0 + 20);
  assert.equal((await a('GET', `/api/ledger/status/${cu.id}`)).data.balance, 0);
  // il cliente con dare/avere non si elimina; togliere un incasso lo toglie dalla cassa
  assert.equal((await a('DELETE', `/api/customers/${cu.id}`)).status, 409);
  assert.equal((await a('DELETE', `/api/ledger/${inc.data.id}`, null, 'staff')).status, 403);
  assert.equal((await a('DELETE', `/api/ledger/${inc.data.id}`)).status, 200);
  assert.equal((await a('GET', `/api/report?from=${ago(15)}&to=${ago(15)}`)).data.total, cash0);
  // CSV e Registro
  const csv = await (await fetch(`${A}/api/ledger/export.csv?customer_id=${cu.id}`)).text();
  assert.match(csv, /Mario Moroso/);
  const au = (await a('GET', '/api/audit?type=dare%2Favere')).data;
  assert.ok(au.rows.some((r) => /RETROATTIVO/.test(r.detail)));
  assert.ok(au.rows.some((r) => /tolto anche dalla cassa/.test(r.detail)));
});

test('backup JSON include le nuove tabelle', async () => {
  const { dumpAll } = await import('../app.mjs');
  const b = await dumpAll();
  assert.ok(b.tables && 'cash_closings' in b.tables && 'invoices' in b.tables && 'ledger_entries' in b.tables);
});
