// Dare/avere per cliente (e per riparazione), anche con movimenti PASSATI, e alert "cattivo pagatore".
//  Saldo = dare - avere:  positivo = il cliente ci deve;  negativo = abbiamo un suo credito.
//  Tipi di movimento:
//   debito  (dare)  il cliente ci deve (lavoro/merce a credito)               -> nessun movimento di cassa
//   incasso (avere) il cliente paga                                           -> entra in CASSA (payments, kind 'dareavere'), metodo vero obbligatorio
//   credito (avere) noi dobbiamo al cliente (anticipo da restituire, buono)   -> nessun movimento di cassa
//   rimborso(dare)  noi restituiamo soldi al cliente                          -> esce tra le SPESE (metodo vero obbligatorio)
//  Niente e' nascosto: ogni riga e' nel Registro e i movimenti di denaro finiscono in cassa/spese.
//  Cattivo pagatore: soglie in Impostazioni (giorni di debito aperto, importo aperto, ricorrenza di debiti pagati in ritardo o ancora aperti).
import { db, nowLocal } from './dbref.mjs';
import { HttpError, money, localDate, assertMethod } from './logic.mjs';
import { createExpense } from './expenses.mjs';
import { writeAudit, AUDIT_TYPES } from './audit.mjs';

AUDIT_TYPES.push('dare/avere');
export const LEDGER_TABLES = ['ledger_entries'];
export const TYPES = {
  debito: { direction: 'dare', label: 'Debito del cliente', cash: false },
  incasso: { direction: 'avere', label: 'Pagamento ricevuto', cash: 'in' },
  credito: { direction: 'avere', label: 'Credito del cliente', cash: false },
  rimborso: { direction: 'dare', label: 'Rimborso al cliente', cash: 'out' },
};
export const CONFIG_DEFAULTS = { ledger_bad_days: 30, ledger_bad_amount: 100, ledger_bad_repeat: 2 };

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const dayOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const eur = (n) => `${Number(n).toFixed(2)} €`;
const who = (user) => user?.name || user?.email || 'locale';

export async function getConfig() {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ledger_bad_%'").all();
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {};
  for (const [k, d] of Object.entries(CONFIG_DEFAULTS)) { const v = Number(String(m[k] ?? '').replace(',', '.')); out[k] = m[k] != null && m[k] !== '' && Number.isFinite(v) && v >= 0 ? v : d; }
  return out;
}
export async function setConfig(b) {
  for (const k of Object.keys(CONFIG_DEFAULTS)) {
    if (!(k in b)) continue;
    const v = num(b[k], NaN);
    if (!Number.isFinite(v) || v < 0 || v > 1_000_000) throw new HttpError(400, 'Valore non valido: usa un numero, 0 = controllo spento.');
    await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
  }
  return getConfig();
}

/**
 * Rilegge i movimenti in ordine di data e abbina i pagamenti ai debiti piu' vecchi (FIFO). Funzione pura: si prova senza database.
 * Ritorna saldo, debiti ancora aperti (con giorni di apertura), quanti debiti sono stati saldati in ritardo e gli eventuali motivi di allerta.
 */
export function analyzeLedger(entries, cfg = CONFIG_DEFAULTS, today = localDate()) {
  const sorted = [...entries].sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : a.id - b.id));
  let dare = 0; let avere = 0;
  const open = []; // debiti non ancora saldati
  const settled = []; // debiti saldati: { id, entry_date, settled_on, days }
  let pool = 0; // credito del cliente non ancora usato
  for (const e of sorted) {
    if (e.direction === 'dare') dare += e.amount; else avere += e.amount;
    if (e.entry_type === 'debito') {
      let rest = e.amount;
      if (pool > 0) { const u = Math.min(pool, rest); pool = money(pool - u); rest = money(rest - u); }
      if (rest > 0.004) open.push({ id: e.id, entry_date: e.entry_date, amount: e.amount, remaining: rest, description: e.description, repair_id: e.repair_id });
      else settled.push({ id: e.id, entry_date: e.entry_date, settled_on: e.entry_date, days: 0 });
    } else if (e.direction === 'avere') {
      let rest = e.amount;
      while (rest > 0.004 && open.length) {
        const d = open[0];
        const u = Math.min(d.remaining, rest);
        d.remaining = money(d.remaining - u); rest = money(rest - u);
        if (d.remaining <= 0.004) { settled.push({ id: d.id, entry_date: d.entry_date, settled_on: e.entry_date, days: diffDays(e.entry_date, d.entry_date) }); open.shift(); }
      }
      if (rest > 0.004) pool = money(pool + rest);
    } else if (e.entry_type === 'rimborso') pool = Math.max(0, money(pool - e.amount));
  }
  const balance = money(dare - avere);
  const open_debts = open.map((d) => ({ ...d, age_days: Math.max(0, diffDays(today, d.entry_date)) }));
  const open_amount = money(open_debts.reduce((a, d) => a + d.remaining, 0));
  const oldest_days = open_debts.reduce((a, d) => Math.max(a, d.age_days), 0);
  const days = cfg.ledger_bad_days;
  const late_count = settled.filter((s) => days > 0 && s.days > days).length + open_debts.filter((d) => days > 0 && d.age_days > days).length;
  const reasons = [];
  if (days > 0 && open_debts.some((d) => d.age_days > days)) reasons.push(`debito non saldato da ${oldest_days} giorni (soglia ${days})`);
  if (cfg.ledger_bad_amount > 0 && open_amount >= cfg.ledger_bad_amount) reasons.push(`debito aperto di ${eur(open_amount)} (soglia ${eur(cfg.ledger_bad_amount)})`);
  if (cfg.ledger_bad_repeat > 0 && days > 0 && late_count >= cfg.ledger_bad_repeat) reasons.push(`${late_count} debiti pagati in ritardo o ancora aperti (soglia ${cfg.ledger_bad_repeat})`);
  const lastDate = sorted.length ? sorted[sorted.length - 1].entry_date : null;
  return { dare: money(dare), avere: money(avere), balance, credit: balance < -0.004 ? money(-balance) : 0, open_debts, open_amount, oldest_days, late_count, flagged: reasons.length > 0, reasons, last_date: lastDate, n: sorted.length };
}

const SELECT = `SELECT e.*, c.name AS customer_name, r.code AS repair_code, r.brand_model AS repair_model, s.code AS sale_code
  FROM ledger_entries e JOIN customers c ON c.id = e.customer_id LEFT JOIN repairs r ON r.id = e.repair_id LEFT JOIN sales s ON s.id = e.sale_id`;
const decorate = (e) => ({ ...e, retro: !!e.retro, type_label: TYPES[e.entry_type]?.label || e.entry_type });

export async function createEntry(b, user) {
  const cid = Number(b.customer_id);
  const customer = cid ? await db.prepare('SELECT * FROM customers WHERE id = ?').get(cid) : null;
  if (!customer) throw new HttpError(400, 'Scegli il cliente.');
  const T = TYPES[b.entry_type];
  if (!T) throw new HttpError(400, 'Scegli il tipo di movimento.');
  const amount = money(num(b.amount, NaN));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new HttpError(400, 'Importo non valido');
  const entry_date = str(b.entry_date) || localDate();
  if (!dayOk(entry_date)) throw new HttpError(400, 'Data non valida');
  if (entry_date > localDate()) throw new HttpError(400, 'La data non può essere nel futuro.');
  const description = str(b.description);
  if (!description) throw new HttpError(400, 'Scrivi una descrizione (di cosa si tratta).');
  let method = null;
  if (T.cash) {
    method = assertMethod(b.method);
    if (!method) throw new HttpError(400, 'Scegli il metodo di pagamento (contanti, carta, bonifico…).');
  }
  const repair_id = b.repair_id ? Number(b.repair_id) : null;
  const sale_id = b.sale_id ? Number(b.sale_id) : null;
  if (repair_id) {
    const r = await db.prepare('SELECT customer_id FROM repairs WHERE id = ?').get(repair_id);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    if (r.customer_id !== cid) throw new HttpError(400, 'La riparazione scelta è di un altro cliente.');
  }
  if (sale_id) {
    const s = await db.prepare('SELECT customer_id FROM sales WHERE id = ?').get(sale_id);
    if (!s) throw new HttpError(404, 'Vendita non trovata');
    if (s.customer_id !== cid) throw new HttpError(400, 'La vendita scelta è di un altro cliente.');
  }
  const retro = entry_date < localDate() ? 1 : 0;
  const r = await db.prepare(`INSERT INTO ledger_entries (customer_id, entry_date, entry_type, direction, amount, method, description, repair_id, sale_id, retro, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,${NOW},?)`)
    .run(cid, entry_date, b.entry_type, T.direction, amount, method, description, repair_id, sale_id, retro, who(user));
  const id = Number(r.lastInsertRowid);
  let payment_id = null;
  let expense_id = null;
  if (T.cash === 'in') {
    const at = entry_date === localDate() ? nowLocal() : `${entry_date} 12:00:00`;
    const p = await db.prepare('INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,?)').run('dareavere', id, `Pagamento di ${customer.name}: ${description}`.slice(0, 120), amount, method, at);
    payment_id = Number(p.lastInsertRowid);
  } else if (T.cash === 'out') {
    const e = await createExpense({ spent_on: entry_date, description: `Rimborso a ${customer.name}: ${description}`, category: 'altro', vendor: customer.name, amount, vat: 0, method, doc_type: 'nessuno', notes: 'Registrato dal Dare/avere' });
    expense_id = e.id;
  }
  if (payment_id || expense_id) await db.prepare('UPDATE ledger_entries SET payment_id=?, expense_id=? WHERE id=?').run(payment_id, expense_id, id);
  await writeAudit({ user, action: 'crea', type: 'dare/avere', id, label: `${customer.name} · ${T.label}`, detail: `${eur(amount)} del ${entry_date}${retro ? ' RETROATTIVO' : ''}: ${description}${method ? ` (${method})` : ''}${payment_id ? ' · registrato in cassa' : ''}${expense_id ? ' · registrato tra le spese' : ''}`.slice(0, 480) });
  return decorate(await db.prepare(`${SELECT} WHERE e.id = ?`).get(id));
}

export async function deleteEntry(id, user) {
  const e = await db.prepare(`${SELECT} WHERE e.id = ?`).get(id);
  if (!e) throw new HttpError(404, 'Movimento non trovato');
  if (e.payment_id) await db.prepare("DELETE FROM payments WHERE id = ? AND kind = 'dareavere'").run(e.payment_id);
  if (e.expense_id) await db.prepare('DELETE FROM expenses WHERE id = ?').run(e.expense_id);
  await db.prepare('DELETE FROM ledger_entries WHERE id = ?').run(id);
  await writeAudit({ user, action: 'elimina', type: 'dare/avere', id, label: `${e.customer_name} · ${TYPES[e.entry_type]?.label}`, detail: `eliminato ${eur(e.amount)} del ${e.entry_date}: ${e.description}${e.payment_id ? ' · tolto anche dalla cassa' : ''}${e.expense_id ? ' · tolto anche dalle spese' : ''}`.slice(0, 480) });
  return { ok: true };
}

export async function customerLedger(customerId) {
  const c = await db.prepare('SELECT id, name, phone FROM customers WHERE id = ?').get(customerId);
  if (!c) throw new HttpError(404, 'Cliente non trovato');
  const cfg = await getConfig();
  const entries = (await db.prepare(`${SELECT} WHERE e.customer_id = ? ORDER BY e.entry_date DESC, e.id DESC`).all(customerId)).map(decorate);
  const status = analyzeLedger(entries, cfg);
  // dare/avere per riparazione
  const byRepair = new Map();
  for (const e of entries.filter((x) => x.repair_id)) {
    const g = byRepair.get(e.repair_id) || { repair_id: e.repair_id, code: e.repair_code, model: e.repair_model, dare: 0, avere: 0 };
    if (e.direction === 'dare') g.dare += e.amount; else g.avere += e.amount;
    byRepair.set(e.repair_id, g);
  }
  return { customer: c, config: cfg, status, entries, by_repair: [...byRepair.values()].map((g) => ({ ...g, dare: money(g.dare), avere: money(g.avere), balance: money(g.dare - g.avere) })) };
}

export async function repairLedger(repairId) {
  const entries = (await db.prepare(`${SELECT} WHERE e.repair_id = ? ORDER BY e.entry_date DESC, e.id DESC`).all(repairId)).map(decorate);
  const dare = money(entries.filter((e) => e.direction === 'dare').reduce((a, e) => a + e.amount, 0));
  const avere = money(entries.filter((e) => e.direction === 'avere').reduce((a, e) => a + e.amount, 0));
  return { entries, dare, avere, balance: money(dare - avere) };
}

async function allByCustomer() {
  const cfg = await getConfig();
  const rows = await db.prepare(`${SELECT} ORDER BY e.entry_date, e.id`).all();
  const g = new Map();
  for (const e of rows) { const l = g.get(e.customer_id) || []; l.push(e); g.set(e.customer_id, l); }
  const customers = await db.prepare('SELECT id, name, phone FROM customers WHERE id IN (SELECT DISTINCT customer_id FROM ledger_entries)').all();
  return { cfg, groups: g, customers };
}

/** Vista raggruppata per cliente: saldo, debito aperto, giorni, allerta. */
export async function listCustomers({ q, only } = {}) {
  const { cfg, groups, customers } = await allByCustomer();
  let rows = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, ...analyzeLedger(groups.get(c.id) || [], cfg), open_debts: undefined }));
  const text = str(q)?.toLowerCase();
  if (text) rows = rows.filter((r) => r.name.toLowerCase().includes(text) || String(r.phone || '').includes(text));
  if (only === 'flagged') rows = rows.filter((r) => r.flagged);
  else if (only === 'owing') rows = rows.filter((r) => r.balance > 0.004);
  else if (only === 'credit') rows = rows.filter((r) => r.balance < -0.004);
  rows.sort((a, b) => (b.flagged - a.flagged) || (b.balance - a.balance) || a.name.localeCompare(b.name));
  const owing = money(rows.filter((r) => r.balance > 0).reduce((a, r) => a + r.balance, 0));
  const credit = money(rows.filter((r) => r.balance < 0).reduce((a, r) => a + -r.balance, 0));
  return { config: cfg, rows, totals: { customers: rows.length, flagged: rows.filter((r) => r.flagged).length, owing, credit } };
}

/** Clienti da segnalare (per gli elenchi, la scheda cliente, la nuova riparazione e la nuova vendita): { id: {reasons, balance, open_amount, oldest_days} } */
export async function flagsMap() {
  const { cfg, groups } = await allByCustomer();
  const out = {};
  for (const [id, list] of groups) {
    const a = analyzeLedger(list, cfg);
    if (a.flagged) out[id] = { reasons: a.reasons, balance: a.balance, open_amount: a.open_amount, oldest_days: a.oldest_days, late_count: a.late_count };
  }
  return out;
}

export async function customerStatus(customerId) {
  const cfg = await getConfig();
  const list = await db.prepare(`${SELECT} WHERE e.customer_id = ?`).all(customerId);
  const a = analyzeLedger(list, cfg);
  return { customer_id: Number(customerId), flagged: a.flagged, reasons: a.reasons, balance: a.balance, open_amount: a.open_amount, oldest_days: a.oldest_days, late_count: a.late_count, has_entries: a.n > 0 };
}

export async function listEntries(q = {}) {
  const where = [];
  const args = [];
  if (str(q.customer_id)) { where.push('e.customer_id = ?'); args.push(Number(q.customer_id)); }
  if (str(q.repair_id)) { where.push('e.repair_id = ?'); args.push(Number(q.repair_id)); }
  if (str(q.type)) { where.push('e.entry_type = ?'); args.push(q.type); }
  if (str(q.from)) { where.push('e.entry_date >= ?'); args.push(q.from); }
  if (str(q.to)) { where.push('e.entry_date <= ?'); args.push(q.to); }
  if (str(q.q)) { where.push('(e.description LIKE ? OR c.name LIKE ?)'); args.push(`%${q.q}%`, `%${q.q}%`); }
  const rows = (await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.entry_date DESC, e.id DESC LIMIT 1000`).all(...args)).map(decorate);
  const dare = money(rows.filter((e) => e.direction === 'dare').reduce((a, e) => a + e.amount, 0));
  const avere = money(rows.filter((e) => e.direction === 'avere').reduce((a, e) => a + e.amount, 0));
  return { rows, totals: { dare, avere, balance: money(dare - avere), n: rows.length } };
}

const csvCell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const it = (n) => Number(n).toFixed(2).replace('.', ',');
export function ledgerCsv(rows) {
  const lines = [['Data', 'Cliente', 'Tipo', 'Dare', 'Avere', 'Metodo', 'Descrizione', 'Riparazione', 'Vendita', 'Retroattivo'].join(';')];
  for (const e of [...rows].reverse()) lines.push([e.entry_date, e.customer_name, e.type_label, e.direction === 'dare' ? it(e.amount) : '', e.direction === 'avere' ? it(e.amount) : '', e.method || '', e.description, e.repair_code || '', e.sale_code || '', e.retro ? 'sì' : 'no'].map(csvCell).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Avvisi per la campanella: clienti segnalati con debito ancora aperto. */
export async function ledgerAlerts() {
  const { cfg, groups, customers } = await allByCustomer();
  const out = [];
  for (const c of customers) {
    const a = analyzeLedger(groups.get(c.id) || [], cfg);
    if (a.flagged && a.open_amount > 0.004) out.push({ type: 'bad_payer', severity: 'medium', title: `Cattivo pagatore: ${c.name}`, detail: `Debito aperto ${eur(a.open_amount)}${a.oldest_days ? `, il più vecchio da ${a.oldest_days} giorni` : ''}.`, link: '#/dareavere?filtro=flagged', ref: c.id });
  }
  return out.slice(0, 20);
}

/** Rotte /api/ledger. */
export function registerLedgerRoutes(app, h, { adminOnly }) {
  app.get('/api/ledger', h((req) => listEntries(req.query)));
  app.get('/api/ledger/customers', h((req) => listCustomers(req.query)));
  app.get('/api/ledger/flags', h(() => flagsMap()));
  app.get('/api/ledger/config', h(() => getConfig()));
  app.put('/api/ledger/config', h((req) => { adminOnly(req); return setConfig(req.body); }));
  app.get('/api/ledger/export.csv', async (c) => {
    try {
      const d = await listEntries(c.req.query());
      return c.body(ledgerCsv(d.rows), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="dare-avere-${localDate()}.csv"`, 'cache-control': 'no-store' });
    } catch (e) { return c.json({ ok: false, error: e.status ? e.message : 'Esportazione non riuscita' }, e.status || 500); }
  });
  app.get('/api/ledger/customer/:id{-?[0-9]+}', h((req) => customerLedger(Number(req.params.id))));
  app.get('/api/ledger/status/:id{-?[0-9]+}', h((req) => customerStatus(Number(req.params.id))));
  app.get('/api/ledger/repair/:id{-?[0-9]+}', h((req) => repairLedger(Number(req.params.id))));
  app.post('/api/ledger', h((req) => createEntry(req.body, req.user)));
  app.delete('/api/ledger/:id{-?[0-9]+}', h((req) => { adminOnly(req); return deleteEntry(req.params.id, req.user); }));
}

/** Un cliente con movimenti di dare/avere non si elimina: i suoi incassi/rimborsi sono in cassa e nelle spese. */
export async function assertNoLedger(customerId) {
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM ledger_entries WHERE customer_id = ?').get(customerId)).n;
  if (n) throw new HttpError(409, 'Il cliente ha movimenti di dare/avere: eliminali prima dalla sezione Dare/avere.');
}
