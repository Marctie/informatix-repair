// "Blacks": elenco dei clienti segnalati (insoluti, abbandoni, comportamenti scorretti...). Uso interno: mai mostrato ai clienti.
// Tutti possono segnalare, controllare e correggere i dati di una segnalazione (ogni modifica finisce nel Registro).
// RIMUOVERE (o ripristinare) una segnalazione e' solo dell'amministratore, con motivo obbligatorio: non si cancella, si archivia
// (resta lo storico di chi l'ha tolta e perche').
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const phoneKey = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : d; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const localToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

export const BLACK_REASONS = ['Insoluto (non ha pagato)', 'Dispositivo abbandonato', 'Comportamento aggressivo', 'Truffa / contestazioni pretestuose', 'Assegno / pagamento respinto', 'Altro'];

/** Segnalazioni attive che corrispondono a un cliente (per id, telefono, email o nome identico). */
export async function findBlacks({ customer_id, name, phone, email } = {}) {
  let c = null;
  if (customer_id) c = await db.prepare('SELECT id, name, phone, email FROM customers WHERE id = ?').get(customer_id);
  const nm = str(name || c?.name)?.toLowerCase();
  const pk = phoneKey(phone || c?.phone);
  const em = str(email || c?.email)?.toLowerCase();
  const rows = await db.prepare('SELECT * FROM blacklist WHERE active = 1').all();
  const out = [];
  for (const b of rows) {
    let match = null;
    if (c && b.customer_id === c.id) match = 'cliente';
    else if (pk && phoneKey(b.phone) === pk) match = 'telefono';
    else if (em && b.email && b.email.toLowerCase() === em) match = 'email';
    else if (nm && b.name.toLowerCase() === nm) match = 'nome';
    if (match) out.push({ id: b.id, name: b.name, reason: b.reason, note: b.note, reported_on: b.reported_on, match });
  }
  return out;
}

function clean(b, current = {}) {
  const m = { ...current, ...b };
  const reason = str(m.reason);
  if (!reason) throw new HttpError(400, 'Il motivo della segnalazione è obbligatorio');
  const reported_on = str(m.reported_on) || localToday();
  if (!DATE_RE.test(reported_on)) throw new HttpError(400, 'Data non valida (AAAA-MM-GG)');
  if (reported_on > localToday()) throw new HttpError(400, 'La data non può essere nel futuro');
  return { reason: reason.slice(0, 200), note: str(m.note)?.slice(0, 1000) || null, reported_on };
}

export async function createBlack(b, user) {
  let customer = null;
  if (b.customer_id) {
    customer = await db.prepare('SELECT id, name, phone, email FROM customers WHERE id = ?').get(b.customer_id);
    if (!customer) throw new HttpError(404, 'Cliente non trovato');
  }
  const name = str(b.name) || customer?.name;
  if (!name) throw new HttpError(400, 'Nome obbligatorio');
  const f = clean(b);
  const phone = str(b.phone) || customer?.phone || null;
  const email = str(b.email) || customer?.email || null;
  if (customer) {
    const dup = await db.prepare('SELECT id FROM blacklist WHERE active = 1 AND customer_id = ?').get(customer.id);
    if (dup) throw new HttpError(409, 'Questo cliente è già nell’elenco dei segnalati.');
  }
  const r = await db.prepare(`INSERT INTO blacklist (customer_id, name, phone, email, reason, note, reported_on, reported_by, created_at) VALUES (?,?,?,?,?,?,?,?,${NOW})`)
    .run(customer?.id ?? null, name, phone, email, f.reason, f.note, f.reported_on, user?.email || 'locale');
  return getBlack(Number(r.lastInsertRowid));
}

export const getBlack = async (id) => {
  const b = await db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
  if (!b) throw new HttpError(404, 'Segnalazione non trovata');
  return b;
};

export async function listBlacks({ q, all } = {}) {
  const where = [];
  const args = [];
  if (!all) where.push('active = 1');
  if (q) { where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR reason LIKE ? OR note LIKE ?)'); const l = `%${q}%`; args.push(l, l, l, l, l); }
  return db.prepare(`SELECT * FROM blacklist ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY active DESC, reported_on DESC, id DESC LIMIT 500`).all(...args);
}

export async function updateBlack(id, b) {
  const cur = await getBlack(id);
  const f = clean(b, cur);
  await db.prepare('UPDATE blacklist SET name = ?, phone = ?, email = ?, reason = ?, note = ?, reported_on = ? WHERE id = ?')
    .run(str(b.name) || cur.name, 'phone' in b ? str(b.phone) : cur.phone, 'email' in b ? str(b.email) : cur.email, f.reason, f.note, f.reported_on, id);
  return getBlack(id);
}

/** Rimozione (solo amministratore, con motivo): archivia, non cancella. */
export async function removeBlack(id, b, user) {
  const cur = await getBlack(id);
  if (!cur.active) throw new HttpError(409, 'Segnalazione già rimossa.');
  const why = str(b?.removed_note);
  if (!why) throw new HttpError(400, 'Scrivi perché la segnalazione viene rimossa.');
  await db.prepare(`UPDATE blacklist SET active = 0, removed_at = ${NOW}, removed_by = ?, removed_note = ? WHERE id = ?`).run(user?.email || 'locale', why.slice(0, 300), id);
  return getBlack(id);
}

export async function restoreBlack(id) {
  const cur = await getBlack(id);
  if (cur.active) throw new HttpError(409, 'Segnalazione già attiva.');
  await db.prepare('UPDATE blacklist SET active = 1, removed_at = NULL, removed_by = NULL, removed_note = NULL WHERE id = ?').run(id);
  return getBlack(id);
}

export function registerBlackRoutes(app, h, adminOnly) {
  app.get('/api/blacklist/meta', h(() => ({ reasons: BLACK_REASONS })));
  app.get('/api/blacklist/check', h(async (req) => ({ matches: await findBlacks({ customer_id: req.query.customer_id, name: req.query.name, phone: req.query.phone, email: req.query.email }) })));
  app.get('/api/blacklist', h((req) => listBlacks({ q: str(req.query.q), all: req.query.all === '1' })));
  app.post('/api/blacklist', h((req) => createBlack(req.body || {}, req.user)));
  app.put('/api/blacklist/:id', h((req) => updateBlack(req.params.id, req.body || {})));
  app.post('/api/blacklist/:id/remove', h((req) => { adminOnly(req); return removeBlack(req.params.id, req.body || {}, req.user); }));
  app.post('/api/blacklist/:id/restore', h((req) => { adminOnly(req); return restoreBlack(req.params.id); }));
}

export const BLACK_TABLES = ['blacklist'];
