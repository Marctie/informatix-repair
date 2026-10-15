// Archivio fatture: emesse (ai clienti) e ricevute (dai fornitori), anche passate.
//  - Stato calcolato, mai scritto a mano: da pagare / parziale / scaduta (non pagata oltre la scadenza) / pagata / stornata (nota di credito).
//  - Ogni pagamento ha metodo vero (assertMethod) e data. L'incasso di una fattura EMESSA entra anche in cassa (payments, kind 'fattura'),
//    cosi' i totali di cassa tornano; se la fattura e' collegata a una vendita/riparazione gia' incassata, quegli incassi vengono solo COLLEGATI (nessun doppione).
//  - Il pagamento di una fattura RICEVUTA puo' essere registrato anche tra le spese (casella facoltativa).
//  - Tutto nel Registro (audit_log).
import { db } from './dbref.mjs';
import { HttpError, money, localDate, assertMethod } from './logic.mjs';
import { nowLocal } from './dbref.mjs';
import { createExpense } from './expenses.mjs';
import { writeAudit, AUDIT_TYPES } from './audit.mjs';
import { isCassa } from './roles.mjs';

AUDIT_TYPES.push('fattura');
export const INVOICE_TABLES = ['invoices', 'invoice_payments'];
export const DIRECTIONS = { emessa: 'Emessa (ai clienti)', ricevuta: 'Ricevuta (dai fornitori)' };
export const STATUS_LABELS = { da_pagare: 'Da pagare', parziale: 'Pagata in parte', scaduta: 'Non pagata (scaduta)', pagata: 'Pagata', stornata: 'Stornata (nota di credito)', nota_credito: 'Nota di credito' };
export const DEFAULT_TERMS_DAYS = 30;

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const dayOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const eur = (n) => `${Number(n).toFixed(2)} €`;
const who = (user) => user?.name || user?.email || 'locale';
export const addDaysStr = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

/** Stato di una fattura a partire dagli importi (puro: si prova senza database). */
export function invoiceState(i, today = localDate()) {
  if (i.doc_type === 'nota_credito') return { status: 'nota_credito', net: 0, open: 0, overdue: false, days_late: 0, refund_due: 0 };
  const credited = money(i.credited || 0);
  const paid = money(i.paid || 0);
  const net = money(i.total - credited);
  const open = Math.max(0, money(net - paid));
  const refund_due = Math.max(0, money(paid - net)); // pagata e poi stornata: c'e' qualcosa da restituire
  let status;
  if (credited >= i.total - 0.005) status = 'stornata';
  else if (open <= 0.005) status = 'pagata';
  else if (paid > 0.005) status = 'parziale';
  else if (i.due_date && i.due_date < today) status = 'scaduta';
  else status = 'da_pagare';
  const overdue = open > 0.005 && status !== 'stornata' && !!i.due_date && i.due_date < today;
  return { status, net, open, overdue, days_late: overdue ? diffDays(today, i.due_date) : 0, refund_due };
}

const BASE = `SELECT i.*, c.name AS customer_name, s.name AS supplier_name,
  COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id = i.id),0) AS paid,
  COALESCE((SELECT SUM(n.total) FROM invoices n WHERE n.credit_for_id = i.id AND n.doc_type = 'nota_credito'),0) AS credited,
  o.number AS credit_for_number
  FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN suppliers s ON s.id = i.supplier_id LEFT JOIN invoices o ON o.id = i.credit_for_id`;

const decorate = (r, today) => ({ ...r, paid: money(r.paid), credited: money(r.credited), retro: !!r.retro, party: r.customer_name || r.supplier_name || r.party_name || '—', ...invoiceState(r, today) });
const guard = (user, direction) => { if (isCassa(user) && direction !== 'emessa') throw new HttpError(403, 'Le fatture ricevute non sono disponibili per il ruolo Cassa.'); };

export async function getInvoice(id, user) {
  const r = await db.prepare(`${BASE} WHERE i.id = ?`).get(id);
  if (!r) throw new HttpError(404, 'Fattura non trovata');
  guard(user, r.direction);
  const today = localDate();
  const payments = await db.prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on, id').all(id);
  const credit_notes = await db.prepare("SELECT id, number, issue_date, total FROM invoices WHERE credit_for_id = ? AND doc_type = 'nota_credito' ORDER BY issue_date, id").all(id);
  const sale = r.sale_id ? await db.prepare('SELECT id, code, total FROM sales WHERE id = ?').get(r.sale_id) : null;
  const repair = r.repair_id ? await db.prepare('SELECT id, code, brand_model FROM repairs WHERE id = ?').get(r.repair_id) : null;
  const purchase = r.purchase_id ? await db.prepare('SELECT id, doc_number, doc_date, total FROM purchases WHERE id = ?').get(r.purchase_id) : null;
  return { ...decorate(r, today), payments, credit_notes, sale, repair, purchase };
}

async function clean(b, user, old = null) {
  const direction = old?.direction || str(b.direction);
  if (!DIRECTIONS[direction]) throw new HttpError(400, 'Indica se la fattura è emessa o ricevuta.');
  guard(user, direction);
  const doc_type = old?.doc_type || (b.doc_type === 'nota_credito' ? 'nota_credito' : 'fattura');
  const number = str(b.number ?? old?.number);
  if (!number) throw new HttpError(400, 'Numero documento obbligatorio');
  const issue_date = str(b.issue_date ?? old?.issue_date) || localDate();
  if (!dayOk(issue_date)) throw new HttpError(400, 'Data fattura non valida');
  if (issue_date > localDate()) throw new HttpError(400, 'La data della fattura non può essere nel futuro.');
  let due_date = 'due_date' in b ? str(b.due_date) : (old ? old.due_date : null);
  if (!due_date && doc_type === 'fattura') due_date = addDaysStr(issue_date, Math.max(0, Math.round(num(b.terms_days, DEFAULT_TERMS_DAYS))));
  if (doc_type === 'nota_credito') due_date = null;
  if (due_date && !dayOk(due_date)) throw new HttpError(400, 'Scadenza non valida');
  if (due_date && due_date < issue_date) throw new HttpError(400, 'La scadenza non può essere prima della data della fattura.');
  const total = money(num(b.total ?? old?.total, NaN));
  if (!Number.isFinite(total) || total <= 0 || total > 100_000_000) throw new HttpError(400, 'Importo non valido');
  const vat = money(num(b.vat ?? old?.vat, 0));
  if (!Number.isFinite(vat) || vat < 0 || vat > total) throw new HttpError(400, 'IVA non valida');
  let customer_id = 'customer_id' in b ? (b.customer_id ? Number(b.customer_id) : null) : (old?.customer_id ?? null);
  let supplier_id = 'supplier_id' in b ? (b.supplier_id ? Number(b.supplier_id) : null) : (old?.supplier_id ?? null);
  if (direction === 'emessa') supplier_id = null; else customer_id = null;
  let party_name = 'party_name' in b ? str(b.party_name) : (old?.party_name ?? null);
  if (customer_id) { const c = await db.prepare('SELECT name FROM customers WHERE id = ?').get(customer_id); if (!c) throw new HttpError(404, 'Cliente non trovato'); party_name = c.name; }
  if (supplier_id) { const s = await db.prepare('SELECT name FROM suppliers WHERE id = ?').get(supplier_id); if (!s) throw new HttpError(404, 'Fornitore non trovato'); party_name = s.name; }
  if (!party_name) throw new HttpError(400, direction === 'emessa' ? 'Indica il cliente (scegli dall’elenco o scrivi il nome).' : 'Indica il fornitore (scegli dall’elenco o scrivi il nome).');
  const link = (k) => (k in b ? (b[k] ? Number(b[k]) : null) : (old?.[k] ?? null));
  const sale_id = direction === 'emessa' ? link('sale_id') : null;
  const repair_id = direction === 'emessa' ? link('repair_id') : null;
  const purchase_id = direction === 'ricevuta' ? link('purchase_id') : null;
  if (sale_id && !(await db.prepare('SELECT id FROM sales WHERE id = ?').get(sale_id))) throw new HttpError(404, 'Vendita collegata non trovata');
  if (repair_id && !(await db.prepare('SELECT id FROM repairs WHERE id = ?').get(repair_id))) throw new HttpError(404, 'Riparazione collegata non trovata');
  if (purchase_id && !(await db.prepare('SELECT id FROM purchases WHERE id = ?').get(purchase_id))) throw new HttpError(404, 'Acquisto collegato non trovato');
  let credit_for_id = 'credit_for_id' in b ? (b.credit_for_id ? Number(b.credit_for_id) : null) : (old?.credit_for_id ?? null);
  if (doc_type === 'nota_credito' && credit_for_id) {
    const o = await db.prepare(`${BASE} WHERE i.id = ?`).get(credit_for_id);
    if (!o || o.doc_type !== 'fattura') throw new HttpError(404, 'Fattura da stornare non trovata');
    if (o.direction !== direction) throw new HttpError(400, 'La nota di credito deve essere dello stesso tipo della fattura (emessa/ricevuta).');
    const already = money(o.credited) - (old ? money(old.total) : 0);
    if (already + total > o.total + 0.005) throw new HttpError(400, `La nota di credito supera la fattura: si può stornare al massimo ${eur(o.total - already)}.`);
  } else credit_for_id = null;
  return { direction, doc_type, number, issue_date, due_date, customer_id, supplier_id, party_name, total, vat, credit_for_id, sale_id, repair_id, purchase_id, notes: 'notes' in b ? str(b.notes) : (old?.notes ?? null) };
}

async function assertNoDuplicate(c, exceptId = 0) {
  const d = await db.prepare(`SELECT id FROM invoices WHERE direction = ? AND doc_type = ? AND lower(number) = lower(?) AND substr(issue_date,1,4) = ? AND COALESCE(customer_id,0) = ? AND COALESCE(supplier_id,0) = ? AND lower(COALESCE(party_name,'')) = lower(?) AND id <> ?`)
    .get(c.direction, c.doc_type, c.number, c.issue_date.slice(0, 4), c.customer_id || 0, c.supplier_id || 0, c.party_name || '', exceptId);
  if (d) throw new HttpError(409, `Esiste già ${c.doc_type === 'nota_credito' ? 'la nota di credito' : 'la fattura'} ${c.number} di ${c.party_name} nello stesso anno: aprila dall’archivio.`);
}

/** Collega a una fattura emessa gli incassi gia' registrati in cassa per la vendita/riparazione collegata (nessun doppione, importo mai oltre il totale). */
async function reconcileCash(invoiceId, c, user) {
  const refs = [];
  if (c.sale_id) refs.push(['sale', c.sale_id]);
  if (c.repair_id) refs.push(['repair', c.repair_id]);
  let room = c.total;
  let n = 0;
  for (const [kind, ref] of refs) {
    const rows = await db.prepare('SELECT * FROM payments WHERE kind = ? AND ref_id = ? ORDER BY id').all(kind, ref);
    for (const p of rows) {
      if (room <= 0.004) break;
      if (await db.prepare('SELECT id FROM invoice_payments WHERE payment_id = ?').get(p.id)) continue; // gia' collegato a un'altra fattura
      const amount = Math.min(money(p.amount), room);
      await db.prepare(`INSERT INTO invoice_payments (invoice_id, paid_on, amount, method, note, payment_id, created_at, created_by) VALUES (?,?,?,?,?,?,${NOW},?)`)
        .run(invoiceId, p.created_at.slice(0, 10), amount, p.method, `Incasso già in cassa (${p.label || kind})`, p.id, who(user));
      room = money(room - amount); n += 1;
    }
  }
  return n;
}

export async function createInvoice(b, user) {
  const c = await clean(b, user);
  await assertNoDuplicate(c);
  const retro = c.issue_date < localDate() ? 1 : 0;
  const r = await db.prepare(`INSERT INTO invoices (direction, doc_type, number, issue_date, due_date, customer_id, supplier_id, party_name, total, vat, credit_for_id, sale_id, repair_id, purchase_id, notes, retro, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${NOW},?)`)
    .run(c.direction, c.doc_type, c.number, c.issue_date, c.due_date, c.customer_id, c.supplier_id, c.party_name, c.total, c.vat, c.credit_for_id, c.sale_id, c.repair_id, c.purchase_id, c.notes, retro, who(user));
  const id = Number(r.lastInsertRowid);
  let linked = 0;
  if (c.direction === 'emessa' && c.doc_type === 'fattura' && (c.sale_id || c.repair_id) && b.reconcile !== false) linked = await reconcileCash(id, c, user);
  await writeAudit({ user, action: 'crea', type: 'fattura', id, label: `${c.doc_type === 'nota_credito' ? 'Nota di credito' : 'Fattura'} ${c.number} · ${c.party_name}`, detail: `${c.direction}${retro ? ' RETROATTIVA' : ''} del ${c.issue_date}, ${eur(c.total)}${c.due_date ? `, scadenza ${c.due_date}` : ''}${linked ? `, ${linked} incassi già in cassa collegati` : ''}`.slice(0, 480) });
  return getInvoice(id, user);
}

export async function updateInvoice(id, b, user) {
  const old = await db.prepare(`${BASE} WHERE i.id = ?`).get(id);
  if (!old) throw new HttpError(404, 'Fattura non trovata');
  guard(user, old.direction);
  const c = await clean(b, user, old);
  await assertNoDuplicate(c, id);
  if (c.doc_type === 'fattura' && c.total < money(old.paid + old.credited) - 0.005) throw new HttpError(400, `Importo inferiore a quanto già pagato/stornato (${eur(old.paid + old.credited)}).`);
  await db.prepare(`UPDATE invoices SET number=?, issue_date=?, due_date=?, customer_id=?, supplier_id=?, party_name=?, total=?, vat=?, credit_for_id=?, sale_id=?, repair_id=?, purchase_id=?, notes=?, updated_at=${NOW}, updated_by=? WHERE id=?`)
    .run(c.number, c.issue_date, c.due_date, c.customer_id, c.supplier_id, c.party_name, c.total, c.vat, c.credit_for_id, c.sale_id, c.repair_id, c.purchase_id, c.notes, who(user), id);
  const ch = [];
  for (const [k, l] of [['number', 'numero'], ['issue_date', 'data'], ['due_date', 'scadenza'], ['party_name', 'intestatario'], ['total', 'totale'], ['vat', 'IVA'], ['notes', 'note']]) if ((old[k] ?? null) !== (c[k] ?? null)) ch.push(`${l}: ${old[k] ?? '—'} → ${c[k] ?? '—'}`);
  await writeAudit({ user, action: 'modifica', type: 'fattura', id, label: `${c.doc_type === 'nota_credito' ? 'Nota di credito' : 'Fattura'} ${c.number} · ${c.party_name}`, detail: ch.join('; ').slice(0, 480) || 'nessun campo cambiato' });
  return getInvoice(id, user);
}

export async function deleteInvoice(id, user) {
  const inv = await getInvoice(id, user);
  if (inv.payments.length) throw new HttpError(409, 'La fattura ha pagamenti registrati: eliminali prima (uno per uno, restano nel Registro).');
  if (inv.credit_notes.length) throw new HttpError(409, 'La fattura ha note di credito collegate: eliminale prima.');
  await db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
  await writeAudit({ user, action: 'elimina', type: 'fattura', id, label: `${inv.doc_type === 'nota_credito' ? 'Nota di credito' : 'Fattura'} ${inv.number} · ${inv.party}`, detail: `eliminata: ${inv.direction} del ${inv.issue_date}, ${eur(inv.total)}` });
  return { ok: true };
}

export async function addInvoicePayment(id, b, user) {
  const inv = await getInvoice(id, user);
  if (inv.doc_type === 'nota_credito') throw new HttpError(400, 'Una nota di credito non si paga.');
  if (inv.status === 'stornata') throw new HttpError(409, 'La fattura è stata stornata per intero.');
  const amount = money(num(b.amount, NaN));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Importo non valido');
  if (amount > inv.open + 0.005) throw new HttpError(400, `L’importo supera quanto resta da pagare (${eur(inv.open)}).`);
  const method = assertMethod(b.method);
  if (!method) throw new HttpError(400, 'Scegli il metodo di pagamento (contanti, carta, bonifico…).');
  const paid_on = str(b.paid_on) || localDate();
  if (!dayOk(paid_on)) throw new HttpError(400, 'Data del pagamento non valida');
  if (paid_on > localDate()) throw new HttpError(400, 'La data del pagamento non può essere nel futuro.');
  if (paid_on < inv.issue_date) throw new HttpError(400, 'Il pagamento non può essere prima della data della fattura.');
  let payment_id = null;
  let expense_id = null;
  if (inv.direction === 'emessa') {
    // incasso vero: entra in cassa nel giorno indicato (se e' oggi, con l'ora di adesso)
    const at = paid_on === localDate() ? nowLocal() : `${paid_on} 12:00:00`;
    const r = await db.prepare('INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,?)').run('fattura', id, `Fattura ${inv.number} · ${inv.party}`.slice(0, 120), amount, method, at);
    payment_id = Number(r.lastInsertRowid);
  } else if (b.as_expense) {
    const e = await createExpense({ spent_on: paid_on, description: `Fattura ${inv.number} ${inv.party}`, category: 'ricambi e merce', vendor: inv.party, amount, vat: 0, method, doc_type: 'fattura', doc_number: inv.number, notes: 'Pagamento registrato dall’archivio fatture' });
    expense_id = e.id;
  }
  const r = await db.prepare(`INSERT INTO invoice_payments (invoice_id, paid_on, amount, method, note, payment_id, expense_id, created_at, created_by) VALUES (?,?,?,?,?,?,?,${NOW},?)`).run(id, paid_on, amount, method, str(b.note), payment_id, expense_id, who(user));
  await writeAudit({ user, action: 'crea', type: 'fattura', id, label: `Fattura ${inv.number} · ${inv.party}`, detail: `${inv.direction === 'emessa' ? 'incasso' : 'pagamento'} ${eur(amount)} (${method}) del ${paid_on}${paid_on < localDate() ? ' RETROATTIVO' : ''}${payment_id ? ' · registrato in cassa' : ''}${expense_id ? ' · registrato tra le spese' : ''}` });
  return { ...(await getInvoice(id, user)), payment: { id: Number(r.lastInsertRowid) } };
}

export async function deleteInvoicePayment(id, pid, user) {
  const inv = await getInvoice(id, user);
  const p = await db.prepare('SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ?').get(pid, id);
  if (!p) throw new HttpError(404, 'Pagamento non trovato');
  const own = p.payment_id ? await db.prepare("SELECT id FROM payments WHERE id = ? AND kind = 'fattura'").get(p.payment_id) : null;
  if (own) await db.prepare('DELETE FROM payments WHERE id = ?').run(own.id); // solo gli incassi creati da questa fattura; quelli di vendite/riparazioni restano
  if (p.expense_id) await db.prepare('DELETE FROM expenses WHERE id = ?').run(p.expense_id);
  await db.prepare('DELETE FROM invoice_payments WHERE id = ?').run(pid);
  await writeAudit({ user, action: 'elimina', type: 'fattura', id, label: `Fattura ${inv.number} · ${inv.party}`, detail: `tolto pagamento di ${eur(p.amount)} (${p.method}) del ${p.paid_on}${own ? ' · tolto anche dalla cassa' : ''}${p.expense_id ? ' · tolto anche dalle spese' : ''}` });
  return getInvoice(id, user);
}

export async function fromPurchase(purchaseId, b, user) {
  guard(user, 'ricevuta');
  const p = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
  if (!p) throw new HttpError(404, 'Acquisto non trovato');
  if (await db.prepare('SELECT id FROM invoices WHERE purchase_id = ?').get(p.id)) throw new HttpError(409, 'Questo acquisto è già nell’archivio fatture.');
  return createInvoice({ direction: 'ricevuta', doc_type: p.doc_type === 'TD04' ? 'nota_credito' : 'fattura', number: p.doc_number, issue_date: p.doc_date, due_date: b?.due_date, terms_days: b?.terms_days, supplier_id: p.supplier_id, total: p.total, purchase_id: p.id, notes: 'Dall’import degli acquisti' }, user);
}

export async function fromSale(saleId, b, user) {
  const s = await db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!s) throw new HttpError(404, 'Vendita non trovata');
  if (await db.prepare("SELECT id FROM invoices WHERE sale_id = ? AND direction = 'emessa' AND doc_type = 'fattura'").get(s.id)) throw new HttpError(409, 'Per questa vendita c’è già una fattura nell’archivio.');
  const number = str(b?.number);
  if (!number) throw new HttpError(400, 'Scrivi il numero della fattura che hai emesso.');
  if (!s.customer_id && !str(b?.party_name)) throw new HttpError(400, 'La vendita non ha un cliente: scrivi il nome dell’intestatario.');
  return createInvoice({ direction: 'emessa', number, issue_date: str(b?.issue_date) || s.created_at.slice(0, 10), due_date: b?.due_date, terms_days: b?.terms_days, customer_id: s.customer_id, party_name: b?.party_name, total: s.total, sale_id: s.id }, user);
}

export async function listInvoices(q = {}, user) {
  const today = localDate();
  const where = [];
  const args = [];
  let direction = str(q.direction);
  if (isCassa(user)) direction = 'emessa';
  if (direction) { where.push('i.direction = ?'); args.push(direction); }
  if (str(q.from)) { where.push('i.issue_date >= ?'); args.push(q.from); }
  if (str(q.to)) { where.push('i.issue_date <= ?'); args.push(q.to); }
  if (str(q.customer_id)) { where.push('i.customer_id = ?'); args.push(Number(q.customer_id)); }
  if (str(q.supplier_id)) { where.push('i.supplier_id = ?'); args.push(Number(q.supplier_id)); }
  if (str(q.sale_id)) { where.push('i.sale_id = ?'); args.push(Number(q.sale_id)); }
  if (str(q.repair_id)) { where.push('i.repair_id = ?'); args.push(Number(q.repair_id)); }
  if (str(q.q)) { where.push('(i.number LIKE ? OR i.party_name LIKE ? OR i.notes LIKE ?)'); args.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`); }
  const raw = await db.prepare(`${BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY i.issue_date DESC, i.id DESC LIMIT 2000`).all(...args);
  let rows = raw.map((r) => decorate(r, today));
  const st = str(q.status);
  if (st === 'aperte') rows = rows.filter((r) => ['da_pagare', 'parziale', 'scaduta'].includes(r.status));
  else if (st === 'scadute') rows = rows.filter((r) => r.overdue);
  else if (st) rows = rows.filter((r) => r.status === st);
  const sum = (arr, f) => money(arr.reduce((a, r) => a + f(r), 0));
  const mk = (arr) => {
    const inv = arr.filter((r) => r.doc_type === 'fattura');
    const notes = arr.filter((r) => r.doc_type === 'nota_credito');
    return {
      n: inv.length, notes_n: notes.length,
      total: sum(inv, (r) => r.total), vat: sum(inv, (r) => r.vat), credited: sum(inv, (r) => r.credited),
      net: sum(inv, (r) => r.net), paid: sum(inv, (r) => Math.min(r.paid, r.net)), open: sum(inv, (r) => r.open),
      overdue: sum(inv.filter((r) => r.overdue), (r) => r.open), overdue_n: inv.filter((r) => r.overdue).length,
      refund_due: sum(inv, (r) => r.refund_due),
    };
  };
  const byDir = {};
  for (const d of Object.keys(DIRECTIONS)) byDir[d] = mk(rows.filter((r) => r.direction === d));
  const months = new Map();
  for (const r of rows.filter((x) => x.doc_type === 'fattura')) {
    const k = `${r.issue_date.slice(0, 7)}|${r.direction}`;
    const m = months.get(k) || { month: r.issue_date.slice(0, 7), direction: r.direction, n: 0, total: 0, vat: 0, open: 0 };
    m.n += 1; m.total += r.net; m.vat += r.vat; m.open += r.open; months.set(k, m);
  }
  const out = { rows, totals: byDir, by_month: [...months.values()].map((m) => ({ ...m, total: money(m.total), vat: money(m.vat), open: money(m.open) })).sort((a, b) => (a.month < b.month ? 1 : -1)) };
  if (!isCassa(user) && (!direction || direction === 'ricevuta')) {
    out.unlinked_purchases = await db.prepare(`SELECT p.id, p.doc_number, p.doc_date, p.total, p.doc_type, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.purchase_id = p.id) ORDER BY p.doc_date DESC LIMIT 100`).all();
  }
  return out;
}

const csvCell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const it = (n) => Number(n).toFixed(2).replace('.', ',');
export function invoicesCsv(rows) {
  const lines = [['Tipo', 'Documento', 'Numero', 'Data', 'Scadenza', 'Intestatario', 'Totale', 'IVA', 'Stornato', 'Pagato', 'Residuo', 'Stato', 'Giorni di ritardo', 'Retroattiva', 'Note'].join(';')];
  for (const r of [...rows].reverse()) {
    lines.push([r.direction, r.doc_type === 'nota_credito' ? 'nota di credito' : 'fattura', r.number, r.issue_date, r.due_date || '', r.party, it(r.total), it(r.vat), it(r.credited), it(r.paid), it(r.open), STATUS_LABELS[r.status], r.days_late || '', r.retro ? 'sì' : 'no', r.notes || ''].map(csvCell).join(';'));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Avvisi per la campanella: fatture scadute e in scadenza entro 7 giorni (le ricevute solo se non e' Cassa: lo filtra il chiamante). */
export async function invoiceAlerts(c) {
  const cassa = isCassa(c?.get?.('user'));
  const today = localDate();
  const rows = (await db.prepare(`${BASE} WHERE i.doc_type = 'fattura' AND i.due_date IS NOT NULL AND i.due_date <= ? ORDER BY i.due_date LIMIT 60`).all(addDaysStr(today, 7))).map((r) => decorate(r, today));
  const out = [];
  for (const r of rows) {
    if (r.open <= 0.005 || r.status === 'stornata' || (cassa && r.direction !== 'emessa')) continue;
    const emessa = r.direction === 'emessa';
    if (r.overdue) out.push({ type: 'invoice_overdue', severity: emessa ? 'high' : 'medium', title: `${emessa ? 'Fattura da incassare' : 'Fattura da pagare'} scaduta: ${r.number}`, detail: `${r.party}: ${eur(r.open)} da ${r.days_late} ${r.days_late === 1 ? 'giorno' : 'giorni'}.`, link: `#/fatture?stato=scadute`, ref: r.id });
    else out.push({ type: 'invoice_due', severity: 'low', title: `Fattura ${r.number} in scadenza`, detail: `${r.party}: ${eur(r.open)} entro il ${r.due_date}.`, link: `#/fatture?stato=aperte`, ref: r.id });
  }
  return out;
}

/** Rotte /api/invoices. */
export function registerInvoiceRoutes(app, h, { adminOnly }) {
  app.get('/api/invoices', h((req) => listInvoices(req.query, req.user)));
  app.get('/api/invoices/export.csv', async (c) => {
    try {
      const d = await listInvoices(c.req.query(), c.get('user'));
      return c.body(invoicesCsv(d.rows), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="archivio-fatture-${localDate()}.csv"`, 'cache-control': 'no-store' });
    } catch (e) { return c.json({ ok: false, error: e.status ? e.message : 'Esportazione non riuscita' }, e.status || 500); }
  });
  app.get('/api/invoices/meta', h(() => ({ directions: DIRECTIONS, statuses: STATUS_LABELS, terms_days: DEFAULT_TERMS_DAYS })));
  app.post('/api/invoices/from-purchase/:id{-?[0-9]+}', h((req) => fromPurchase(Number(req.params.id), req.body, req.user)));
  app.post('/api/invoices/from-sale/:id{-?[0-9]+}', h((req) => fromSale(Number(req.params.id), req.body, req.user)));
  app.get('/api/invoices/:id{-?[0-9]+}', h((req) => getInvoice(req.params.id, req.user)));
  app.post('/api/invoices', h((req) => createInvoice(req.body, req.user)));
  app.put('/api/invoices/:id{-?[0-9]+}', h((req) => updateInvoice(req.params.id, req.body, req.user)));
  app.delete('/api/invoices/:id{-?[0-9]+}', h((req) => { adminOnly(req); return deleteInvoice(req.params.id, req.user); }));
  app.post('/api/invoices/:id{-?[0-9]+}/payments', h((req) => addInvoicePayment(req.params.id, req.body, req.user)));
  app.delete('/api/invoices/:id{-?[0-9]+}/payments/:pid{-?[0-9]+}', h((req) => { adminOnly(req); return deleteInvoicePayment(req.params.id, req.params.pid, req.user); }));
}
