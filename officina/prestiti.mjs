// Dispositivi in prestito / muletto: un telefono o portatile del negozio dato al cliente mentre il suo e' in riparazione.
// Collegato alla riparazione, con data di consegna, scadenza (di norma la consegna stimata) e avviso se non rientra.
import { db } from './dbref.mjs';
import { HttpError, logEvent, localDate } from './logic.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const LOAN_STATUS = { prestato: 'In prestito', rientrato: 'Rientrato' };

const dateOr = (v, fallback, label) => {
  const s = str(v)?.slice(0, 10);
  if (!s) return fallback;
  if (!DATE.test(s)) throw new HttpError(400, `${label}: data non valida`);
  return s;
};

const SELECT = `SELECT l.*, COALESCE(c.name, rc.name) AS customer_name, COALESCE(c.phone, rc.phone) AS customer_phone,
    r.code AS repair_code, r.brand_model AS repair_model, r.status AS repair_status, r.eta_date AS repair_eta, d.serial AS device_serial
  FROM loans l LEFT JOIN customers c ON c.id = l.customer_id LEFT JOIN repairs r ON r.id = l.repair_id LEFT JOIN customers rc ON rc.id = r.customer_id LEFT JOIN devices d ON d.id = l.device_id`;

const shape = (l, today = localDate()) => {
  const open = l.status === 'prestato';
  const repairDone = open && ['delivered', 'cancelled'].includes(l.repair_status);
  const late = open && !!l.due_at && l.due_at < today;
  const dayMs = 86400000;
  const days = open ? Math.round((new Date(`${today}T00:00:00`) - new Date(`${l.lent_at}T00:00:00`)) / dayMs) : null;
  const lateDays = late ? Math.round((new Date(`${today}T00:00:00`) - new Date(`${l.due_at}T00:00:00`)) / dayMs) : 0;
  return { ...l, status_label: LOAN_STATUS[l.status] || l.status, late, late_days: lateDays, repair_done: repairDone, days_out: days };
};

/** Avvisi: muletto oltre la scadenza, oppure riparazione chiusa ma muletto non rientrato. */
export async function loanAlerts() {
  const today = localDate();
  const rows = (await db.prepare(`${SELECT} WHERE l.status = 'prestato'`).all()).map((l) => shape(l, today));
  const out = [];
  for (const l of rows) {
    const who = l.customer_name || 'cliente';
    if (l.repair_done) out.push({ type: 'loan_repair_done', severity: 'high', title: `${l.label}: muletto da farsi restituire`, detail: `${who} ha già ${l.repair_status === 'delivered' ? 'ritirato il suo dispositivo' : 'chiuso la riparazione'} (${l.repair_code}): il muletto è ancora fuori.`, link: '#/dispositivi?tab=prestiti', ref: l.id });
    else if (l.late) out.push({ type: 'loan_late', severity: 'high', title: `${l.label}: prestito scaduto da ${l.late_days} giorni`, detail: `${who} doveva restituirlo il ${l.due_at}${l.customer_phone ? ` · tel. ${l.customer_phone}` : ''}.`, link: '#/dispositivi?tab=prestiti', ref: l.id });
  }
  return out;
}

export function registerLoanRoutes(app, h) {
  const one = async (id) => {
    const l = await db.prepare(`${SELECT} WHERE l.id = ?`).get(id);
    if (!l) throw new HttpError(404, 'Prestito non trovato');
    return shape(l);
  };
  const clean = async (b, old = null) => {
    let repair = null;
    const repairId = b.repair_id ? Number(b.repair_id) : null;
    if (repairId) {
      repair = await db.prepare('SELECT id, customer_id, eta_date FROM repairs WHERE id = ?').get(repairId);
      if (!repair) throw new HttpError(400, 'Riparazione non trovata');
    }
    let label = str(b.label);
    const deviceId = b.device_id ? Number(b.device_id) : null;
    if (deviceId) {
      const d = await db.prepare('SELECT id, brand_model FROM devices WHERE id = ?').get(deviceId);
      if (!d) throw new HttpError(400, 'Dispositivo non trovato nel registro');
      label = label || d.brand_model;
      const busy = await db.prepare("SELECT id FROM loans WHERE device_id = ? AND status = 'prestato' AND id <> ?").get(deviceId, old?.id || 0);
      if (busy) throw new HttpError(409, 'Questo dispositivo è già in prestito a qualcuno: segna prima il rientro.');
    }
    if (!label) throw new HttpError(400, 'Scrivi quale dispositivo presti (o sceglilo dal registro)');
    const customerId = b.customer_id ? Number(b.customer_id) : repair?.customer_id ?? null;
    if (!repairId && !customerId) throw new HttpError(400, 'Collega il prestito a una riparazione o a un cliente');
    const lent = dateOr(b.lent_at, localDate(), 'Data di consegna');
    // senza scadenza esplicita, vale la consegna stimata della riparazione (se c'e')
    const due = dateOr(b.due_at, repair?.eta_date || null, 'Scadenza');
    if (due && due < lent) throw new HttpError(400, 'La scadenza non può essere prima della consegna');
    return { deviceId, label, repairId, customerId, lent, due, out: str(b.condition_out), notes: str(b.notes) };
  };

  app.get('/api/prestiti/meta', h(() => ({ statuses: LOAN_STATUS })));
  // Dispositivi del registro che si possono prestare adesso (non gia' fuori)
  app.get('/api/prestiti/disponibili', h(async (req) => {
    const q = str(req.query.q);
    const where = ["d.id NOT IN (SELECT device_id FROM loans WHERE status = 'prestato' AND device_id IS NOT NULL)"];
    const args = [];
    if (q) { where.push('(d.brand_model LIKE ? OR d.serial LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    return db.prepare(`SELECT d.id, d.brand_model, d.serial, d.category FROM devices d WHERE ${where.join(' AND ')} ORDER BY d.brand_model LIMIT 30`).all(...args);
  }));
  app.get('/api/prestiti', h(async (req) => {
    const where = [];
    const args = [];
    const st = req.query.stato || 'fuori';
    const today = localDate();
    if (st === 'fuori') where.push("l.status = 'prestato'");
    else if (st === 'scaduti') { where.push("l.status = 'prestato' AND l.due_at IS NOT NULL AND l.due_at < ?"); args.push(today); }
    else if (st === 'rientrati') where.push("l.status = 'rientrato'");
    if (req.query.repair_id) { where.push('l.repair_id = ?'); args.push(Number(req.query.repair_id)); }
    if (req.query.customer_id) { where.push('(l.customer_id = ? OR r.customer_id = ?)'); args.push(Number(req.query.customer_id), Number(req.query.customer_id)); }
    const q = str(req.query.q);
    if (q) { where.push('(l.label LIKE ? OR COALESCE(c.name, rc.name) LIKE ? OR r.code LIKE ? OR r.brand_model LIKE ? OR d.serial LIKE ?)'); for (let i = 0; i < 5; i++) args.push(`%${q}%`); }
    const rows = (await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE l.status WHEN 'prestato' THEN 0 ELSE 1 END, COALESCE(l.due_at, '9999'), l.id DESC LIMIT 300`).all(...args)).map((l) => shape(l, today));
    const counts = await db.prepare('SELECT status, COUNT(*) AS n FROM loans GROUP BY status').all();
    const late = (await db.prepare("SELECT COUNT(*) AS n FROM loans WHERE status = 'prestato' AND due_at IS NOT NULL AND due_at < ?").get(today)).n;
    return { rows, out: counts.find((c) => c.status === 'prestato')?.n || 0, back: counts.find((c) => c.status === 'rientrato')?.n || 0, late };
  }));
  app.get('/api/prestiti/:id', h((req) => one(req.params.id)));
  app.post('/api/prestiti', h(async (req) => {
    const v = await clean(req.body);
    const r = await db.prepare(`INSERT INTO loans (device_id, label, repair_id, customer_id, lent_at, due_at, status, condition_out, notes, created_at, updated_at) VALUES (?,?,?,?,?,?, 'prestato', ?,?,${NOW},${NOW})`)
      .run(v.deviceId, v.label, v.repairId, v.customerId, v.lent, v.due, v.out, v.notes);
    if (v.repairId) await logEvent(v.repairId, null, `Muletto consegnato al cliente: ${v.label}${v.due ? ` (da restituire entro il ${v.due})` : ''}.`, 0);
    return one(r.lastInsertRowid);
  }));
  app.put('/api/prestiti/:id', h(async (req) => {
    const old = await db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Prestito non trovato');
    const v = await clean({ ...old, ...req.body }, old);
    await db.prepare(`UPDATE loans SET device_id=?, label=?, repair_id=?, customer_id=?, lent_at=?, due_at=?, condition_out=?, notes=?, updated_at=${NOW} WHERE id=?`)
      .run(v.deviceId, v.label, v.repairId, v.customerId, v.lent, v.due, v.out, v.notes, old.id);
    return one(old.id);
  }));
  app.post('/api/prestiti/:id/rientro', h(async (req) => {
    const old = await db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Prestito non trovato');
    if (old.status === 'rientrato') throw new HttpError(409, 'Già rientrato.');
    const when = dateOr(req.body.returned_at, localDate(), 'Data di rientro');
    if (when < old.lent_at) throw new HttpError(400, 'Il rientro non può essere prima della consegna');
    await db.prepare(`UPDATE loans SET status='rientrato', returned_at=?, condition_back=?, updated_at=${NOW} WHERE id=?`).run(when, str(req.body.condition_back), old.id);
    if (old.repair_id) await logEvent(old.repair_id, null, `Muletto rientrato: ${old.label}.`, 0);
    return one(old.id);
  }));
  // Rientro annullato per errore
  app.post('/api/prestiti/:id/riapri', h(async (req) => {
    const old = await db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Prestito non trovato');
    if (old.device_id && (await db.prepare("SELECT id FROM loans WHERE device_id = ? AND status = 'prestato' AND id <> ?").get(old.device_id, old.id))) throw new HttpError(409, 'Il dispositivo è già in prestito a qualcun altro.');
    await db.prepare(`UPDATE loans SET status='prestato', returned_at=NULL, updated_at=${NOW} WHERE id=?`).run(old.id);
    return one(old.id);
  }));
  app.delete('/api/prestiti/:id', h(async (req) => {
    const r = await db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Prestito non trovato');
    return { ok: true };
  }));
}

export const LOAN_TABLES = ['loans'];
