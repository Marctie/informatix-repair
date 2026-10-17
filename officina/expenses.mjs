// Registro delle spese (uscite) e dati per la nota spese.
import { db, getSettings } from './dbref.mjs';
import { HttpError, money, localDate } from './logic.mjs';

export const CATEGORIES = ['ricambi e merce', 'attrezzatura', 'utenze', 'affitto', 'trasporti e carburante', 'pasti e trasferte', 'consulenze', 'marketing', 'imposte e tasse', 'altro'];
export const DOC_TYPES = ['scontrino', 'fattura', 'ricevuta', 'nessuno'];
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const NOW = "datetime('now','localtime')";

function clean(b) {
  const description = str(b.description);
  if (!description) throw new HttpError(400, 'Spesa non salvata: manca la descrizione.', { code: 'DESCRIZIONE_MANCANTE', hint: 'Scrivi di cosa si tratta (es. bolletta luce).' });
  const amount = num(b.amount, NaN);
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Spesa non salvata: l’importo non è valido (serve un numero maggiore di zero).', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi l’importo in euro (es. 45,00).' });
  const vat = num(b.vat, 0);
  if (!Number.isFinite(vat) || vat < 0 || vat > amount) throw new HttpError(400, 'Spesa non salvata: l’IVA indicata non è valida (negativa o superiore all’importo).', { code: 'IVA_NON_VALIDA', hint: 'Scrivi l’IVA contenuta nell’importo.' });
  const spent_on = str(b.spent_on) || localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spent_on)) throw new HttpError(400, 'Spesa non salvata: la data non è valida.', { code: 'DATA_NON_VALIDA', hint: 'Usa il formato GG/MM/AAAA con una data che esiste.' });
  return {
    spent_on, description, category: CATEGORIES.includes(b.category) ? b.category : 'altro', vendor: str(b.vendor),
    amount: money(amount), vat: money(vat), method: str(b.method) || 'contanti',
    doc_type: DOC_TYPES.includes(b.doc_type) ? b.doc_type : 'scontrino', doc_number: str(b.doc_number),
    paid_by: str(b.paid_by), reimbursable: b.reimbursable ? 1 : 0, notes: str(b.notes),
  };
}

export async function listExpenses({ from, to, reimbursable, paid_by } = {}) {
  const f = from || localDate();
  const t = to || f;
  const where = ['spent_on BETWEEN ? AND ?'];
  const args = [f, t];
  if (reimbursable) where.push('reimbursable = 1');
  if (paid_by) { where.push('paid_by = ?'); args.push(paid_by); }
  const rows = await db.prepare(`SELECT * FROM expenses WHERE ${where.join(' AND ')} ORDER BY spent_on, id`).all(...args);
  const total = money(rows.reduce((a, r) => a + r.amount, 0));
  const vat = money(rows.reduce((a, r) => a + r.vat, 0));
  const byCat = new Map();
  for (const r of rows) { const g = byCat.get(r.category) || { category: r.category, total: 0, n: 0 }; g.total += r.amount; g.n += 1; byCat.set(r.category, g); }
  return {
    from: f, to: t, rows, total, vat, to_reimburse: money(rows.filter((r) => r.reimbursable).reduce((a, r) => a + r.amount, 0)),
    by_category: [...byCat.values()].map((g) => ({ ...g, total: money(g.total) })).sort((a, b) => b.total - a.total),
  };
}

export async function createExpense(b) {
  const c = clean(b);
  const r = await db.prepare(`INSERT INTO expenses (spent_on,description,category,vendor,amount,vat,method,doc_type,doc_number,paid_by,reimbursable,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,${NOW})`)
    .run(c.spent_on, c.description, c.category, c.vendor, c.amount, c.vat, c.method, c.doc_type, c.doc_number, c.paid_by, c.reimbursable, c.notes);
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(r.lastInsertRowid);
}

export async function updateExpense(id, b) {
  const c = clean(b);
  const r = await db.prepare('UPDATE expenses SET spent_on=?,description=?,category=?,vendor=?,amount=?,vat=?,method=?,doc_type=?,doc_number=?,paid_by=?,reimbursable=?,notes=? WHERE id=?')
    .run(c.spent_on, c.description, c.category, c.vendor, c.amount, c.vat, c.method, c.doc_type, c.doc_number, c.paid_by, c.reimbursable, c.notes, id);
  if (!r.changes) throw new HttpError(404, 'Spesa non trovata', { code: 'SPESA_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
}

export async function deleteExpense(id) {
  const r = await db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  if (!r.changes) throw new HttpError(404, 'La spesa da eliminare non esiste (già eliminata?).', { code: 'SPESA_NON_TROVATA', hint: 'Aggiorna l’elenco delle spese: potrebbe essere stata già rimossa.' });
  return { ok: true };
}

export const shopInfo = getSettings;
