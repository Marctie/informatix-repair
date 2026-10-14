// Test di Ordini, Preventivi e Promemoria.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-ord-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

let admin, A;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const cust = async (name, phone) => (await a('POST', '/api/customers', { name, phone })).data;

// ---------- Ordini ----------
test('ordini: ordine per cliente con acconto tracciato in cassa, flusso di stati e saldo alla consegna', async () => {
  const tizio = await cust('Tizio Rossi', '3331110001');
  const sup = (await a('POST', '/api/suppliers', { name: 'AccessoriPlus' })).data;
  assert.equal((await a('POST', '/api/orders', { kind: 'cliente', items: [{ description: 'Pellicola', qty: 1, unit_price: 10 }] })).status, 400, 'serve il cliente');
  assert.equal((await a('POST', '/api/orders', { kind: 'cliente', customer_id: tizio.id, items: [] })).status, 400, 'serve almeno un articolo');
  assert.equal((await a('POST', '/api/orders', { kind: 'cliente', customer_id: tizio.id, items: [{ description: 'X', unit_price: 5 }], deposit: 9 })).status, 400, 'acconto oltre il totale');
  const o = (await a('POST', '/api/orders', { kind: 'cliente', customer_id: tizio.id, supplier_id: sup.id, items: [{ description: 'Pellicola vetro iPhone 13', qty: 2, unit_price: 12.5 }, { description: 'Cover', qty: 1, unit_price: 15 }], deposit: 10, deposit_method: 'carta' })).data;
  assert.match(o.code, /^O-\d{4}-0001$/);
  assert.equal(o.status, 'da_ordinare');
  assert.equal(o.total, 40);
  assert.equal(o.paid, 10);
  assert.equal(o.balance, 30);
  const rep = (await a('GET', '/api/report')).data;
  assert.ok(rep.by_kind?.some((k) => k.kind === 'order' && k.total === 10) || rep.rows?.some((p) => p.kind === 'order' && p.amount === 10), 'l’acconto compare in cassa');

  // lista da ordinare per fornitore
  const toOrder = (await a('GET', '/api/orders/to-order')).data;
  const g = toOrder.find((x) => x.supplier_id === sup.id);
  assert.equal(g.lines.length, 2);
  assert.equal(g.lines[0].for, 'Tizio Rossi');
  assert.equal((await a('POST', '/api/orders/mark-ordered', { ids: g.order_ids })).data.count, 1);
  assert.equal((await a('GET', `/api/orders/${o.id}`)).data.status, 'ordinato');
  assert.equal((await a('POST', `/api/orders/${o.id}/status`, { status: 'consegnato' })).status, 409, 'non si salta l’arrivo');

  // arrivato -> avviso nella campanella
  assert.equal((await a('POST', `/api/orders/${o.id}/status`, { status: 'arrivato' })).data.status, 'arrivato');
  const al = (await a('GET', '/api/alerts')).data;
  assert.ok(al.items.some((x) => x.type === 'order_arrived' && x.ref === o.id));

  // acconto aggiuntivo e consegna con saldo
  assert.equal((await a('POST', `/api/orders/${o.id}/deposit`, { amount: 100 })).status, 400);
  assert.equal((await a('POST', `/api/orders/${o.id}/deposit`, { amount: 5 })).data.paid, 15);
  const done = (await a('POST', `/api/orders/${o.id}/status`, { status: 'consegnato', collect: true, method: 'contanti' })).data;
  assert.equal(done.status, 'consegnato');
  assert.equal(done.balance, 0);
  assert.equal(done.paid, 40);
  assert.equal((await a('PUT', `/api/orders/${o.id}`, { notes: 'x' })).status, 409, 'ordine chiuso');
  assert.equal((await a('DELETE', `/api/orders/${o.id}`)).status, 409, 'con incassi non si elimina');
  assert.ok(!(await a('GET', '/api/alerts')).data.items.some((x) => x.type === 'order_arrived'));
});

test('ordini: ordine al fornitore per il negozio, filtri, modifica ed eliminazione', async () => {
  const o = (await a('POST', '/api/orders', { kind: 'fornitore', items: [{ description: 'HDD 1TB', qty: 3 }], expected_date: '2000-01-01' })).data;
  assert.equal(o.kind, 'fornitore');
  assert.equal((await a('POST', `/api/orders/${o.id}/deposit`, { amount: 5 })).status, 400);
  assert.equal((await a('GET', '/api/orders?stato=da_ordinare&q=HDD')).data.length, 1);
  assert.equal((await a('GET', '/api/orders?kind=cliente&q=HDD')).data.length, 0);
  const up = (await a('PUT', `/api/orders/${o.id}`, { notes: 'urgente', items: [{ description: 'HDD 2TB', qty: 1, unit_price: 80 }] })).data;
  assert.equal(up.total, 80);
  await a('POST', `/api/orders/${o.id}/status`, { status: 'ordinato' });
  assert.ok((await a('GET', '/api/alerts')).data.items.some((x) => x.type === 'order_late' && x.ref === o.id), 'ordine in ritardo');
  await a('POST', `/api/orders/${o.id}/status`, { status: 'annullato' });
  assert.equal((await a('DELETE', `/api/orders/${o.id}`)).data.ok, true);
  assert.equal((await a('GET', `/api/orders/${o.id}`)).status, 404);
});

// ---------- Preventivi ----------
const ymd = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

test('preventivi: creazione autonoma, validità di default, stati e scadenza', async () => {
  assert.equal((await a('POST', '/api/quotes', { items: [{ description: 'PC', unit_price: 500 }] })).status, 400, 'serve il cliente');
  assert.equal((await a('POST', '/api/quotes', { customer_name: 'Luigi', items: [] })).status, 400, 'serve una voce');
  assert.equal((await a('POST', '/api/quotes', { customer_name: 'Luigi', valid_until: ymd(-1), items: [{ description: 'PC', unit_price: 500 }] })).status, 400, 'scadenza nel passato');
  assert.equal((await a('POST', '/api/quotes', { customer_name: 'Luigi', discount: 900, items: [{ description: 'PC', unit_price: 500 }] })).status, 400, 'sconto oltre il totale');
  const q = (await a('POST', '/api/quotes', { customer_name: 'Luigi Bianchi', customer_phone: '3339998877', discount: 20, items: [{ description: 'Assemblaggio PC gaming', qty: 1, unit_price: 700 }, { description: 'Installazione Windows', qty: 1, unit_price: 40 }] })).data;
  assert.match(q.code, /^P-\d{4}-0001$/);
  assert.equal(q.status, 'bozza');
  assert.equal(q.total, 720);
  assert.equal(q.valid_until, ymd(15), 'validità di default 15 giorni');
  assert.equal(q.expired, false);
  assert.equal(q.who, 'Luigi Bianchi');
  assert.equal((await a('POST', `/api/quotes/${q.id}/status`, { status: 'inviato' })).data.status, 'inviato');
  const up = (await a('PUT', `/api/quotes/${q.id}`, { valid_until: ymd(2), notes: 'Garanzia 24 mesi' })).data;
  assert.equal(up.days_left, 2);
  assert.equal(up.items.length, 2);
  const al = (await a('GET', '/api/alerts')).data;
  assert.ok(al.items.some((x) => x.type === 'quote_expiring' && x.ref === q.id));
  const html = (await a('GET', `/print/quote/${q.id}?noprint=1`)).data;
  assert.match(html, /valido fino al/);
  assert.match(html, /Assemblaggio PC gaming/);
  assert.equal((await a('GET', '/api/quotes?stato=inviato')).data.length, 1);
  assert.equal((await a('GET', '/api/quotes?stato=scaduto')).data.length, 0);
  assert.equal((await a('POST', `/api/quotes/${q.id}/status`, { status: 'convertito' })).status, 409);
});

test('preventivi: scaduto non si accetta né si converte; conversione in riparazione e in vendita', async () => {
  const { raw } = await import('../db-node.mjs');
  const c = await cust('Anna Gialli', '3335554433');
  const q1 = (await a('POST', '/api/quotes', { customer_id: c.id, items: [{ description: 'Sostituzione batteria', unit_price: 60 }] })).data;
  raw.prepare('UPDATE quotes SET valid_until = ? WHERE id = ?').run(ymd(-3), q1.id);
  const old = (await a('GET', `/api/quotes/${q1.id}`)).data;
  assert.equal(old.expired, true);
  assert.equal(old.status_label, 'Scaduto');
  assert.equal((await a('GET', '/api/quotes?stato=scaduto')).data.length, 1);
  assert.equal((await a('POST', `/api/quotes/${q1.id}/status`, { status: 'accettato' })).status, 409);
  assert.equal((await a('POST', `/api/quotes/${q1.id}/convert`, { to: 'repair', brand_model: 'iPhone' })).status, 409);
  await a('PUT', `/api/quotes/${q1.id}`, { valid_until: ymd(10) }); // prolungando la validità torna utilizzabile
  await a('POST', `/api/quotes/${q1.id}/status`, { status: 'accettato' });
  assert.equal((await a('POST', `/api/quotes/${q1.id}/convert`, { to: 'repair' })).status, 400, 'serve il dispositivo');
  const conv = (await a('POST', `/api/quotes/${q1.id}/convert`, { to: 'repair', brand_model: 'iPhone 12', problem: 'Batteria' })).data;
  assert.equal(conv.quote.status, 'convertito');
  assert.equal(conv.repair.quote, 60);
  assert.equal(conv.repair.status, 'approved', 'preventivo accettato = riparazione approvata');
  assert.equal(conv.repair.customer_name, 'Anna Gialli');
  assert.equal((await a('POST', `/api/quotes/${q1.id}/convert`, { to: 'sale', method: 'contanti' })).status, 409, 'già convertito');
  assert.equal((await a('PUT', `/api/quotes/${q1.id}`, { notes: 'x' })).status, 409);

  const q2 = (await a('POST', '/api/quotes', { customer_name: 'Paolo Neri', discount: 5, items: [{ description: 'Cavo HDMI', qty: 2, unit_price: 10 }] })).data;
  const sale = (await a('POST', `/api/quotes/${q2.id}/convert`, { to: 'sale', method: 'carta' })).data;
  assert.equal(sale.sale.total, 15);
  assert.equal(sale.sale.method, 'carta');
  assert.equal(sale.quote.sale_code, sale.sale.code);
  assert.equal((await a('DELETE', `/api/quotes/${q2.id}`)).data.ok, true);
});

// ---------- Promemoria ----------
const at = (days, hm) => `${ymd(days)} ${hm}`;

test('promemoria: creazione con collegamenti, avvisi in Oggi/campanella, fatto, rimanda, eliminazione', async () => {
  const c = await cust('Marta Verdi', '3331212121');
  assert.equal((await a('POST', '/api/reminders', { due_at: at(0, '10:00') })).status, 400, 'serve il testo');
  assert.equal((await a('POST', '/api/reminders', { title: 'x', due_at: 'domani' })).status, 400, 'data non valida');
  assert.equal((await a('POST', '/api/reminders', { title: 'x', due_at: at(0, '10:00'), customer_id: 99999 })).status, 404);
  const past = (await a('POST', '/api/reminders', { title: 'Richiama Marta per il preventivo', due_at: `${ymd(-1)}T09:30`, customer_id: c.id })).data;
  assert.equal(past.due_at, at(-1, '09:30'));
  assert.equal(past.overdue, true);
  assert.equal(past.customer_name, 'Marta Verdi');
  const later = (await a('POST', '/api/reminders', { title: 'Ordina pellicole', due_at: at(0, '23:58') })).data;
  const future = (await a('POST', '/api/reminders', { title: 'Tra una settimana', due_at: at(7, '09:00') })).data;
  assert.equal(future.overdue, false);

  const al = (await a('GET', '/api/alerts')).data.items;
  assert.ok(al.some((x) => x.type === 'reminder_due' && x.ref === past.id && x.severity === 'high'));
  assert.ok(al.some((x) => x.type === 'reminder_today' && x.ref === later.id));
  assert.ok(!al.some((x) => x.ref === future.id && String(x.type).startsWith('reminder')));
  assert.equal((await a('GET', '/api/reminders?stato=oggi')).data.length, 2);
  assert.equal((await a('GET', '/api/reminders?stato=aperti&q=pellicole')).data.length, 1);
  assert.equal((await a('GET', `/api/reminders?customer_id=${c.id}`)).data.length, 1);

  const snz = (await a('POST', `/api/reminders/${past.id}/snooze`, { tomorrow: true })).data;
  assert.equal(snz.due_at.slice(0, 10), ymd(1));
  assert.equal(snz.due_at.slice(11), '09:30');
  const edit = (await a('PUT', `/api/reminders/${later.id}`, { title: 'Ordina pellicole e cover', body: 'chiedere sconto' })).data;
  assert.equal(edit.title, 'Ordina pellicole e cover');
  assert.equal((await a('POST', `/api/reminders/${later.id}/done`, {})).data.done, true);
  assert.equal((await a('GET', '/api/reminders?stato=fatti')).data.length, 1);
  assert.equal((await a('POST', `/api/reminders/${later.id}/done`, { done: false })).data.done, false);
  assert.equal((await a('DELETE', `/api/reminders/${future.id}`)).data.ok, true);
  assert.equal((await a('GET', `/api/reminders/${future.id}`)).status, 404);
});

test('promemoria: Telegram una sola volta quando scade; senza configurazione non invia nulla', async () => {
  const { notifyDueReminders } = await import('../promemoria.mjs');
  const r = (await a('POST', '/api/reminders', { title: 'Chiamare il corriere', body: 'ritiro pacco', due_at: `${ymd(0)} 00:01` })).data;
  const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
  assert.equal(await notifyDueReminders({}, fetcher), 0, 'senza token non invia');
  assert.equal(calls.length, 0);
  const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_OWNER_ID: '42' };
  assert.ok(await notifyDueReminders(env, fetcher) >= 1);
  const mine = calls.find((x) => x.body.text.includes('Chiamare il corriere'));
  assert.ok(mine && mine.body.chat_id === '42' && mine.body.text.includes('ritiro pacco'));
  const before = calls.length;
  assert.equal(await notifyDueReminders(env, fetcher), 0, 'una sola volta');
  assert.equal(calls.length, before);
  await a('POST', `/api/reminders/${r.id}/done`, {});
});
