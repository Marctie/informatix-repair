// Riparazioni esterne: il dispositivo (o un pezzo) va a un laboratorio terzo e rientra. Collegate alla riparazione del cliente.
import { db } from './dbref.mjs';
import { HttpError, logEvent, localDate } from './logic.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EXT_STATUS = { da_inviare: 'Da inviare', inviata: 'Inviata al laboratorio', rientrata: 'Rientrata', annullata: 'Annullata' };

const dateOrNull = (v, label) => {
  const s = str(v);
  if (!s) return null;
  if (!DATE.test(s.slice(0, 10))) throw new HttpError(400, `${label}: data non valida`);
  return s.slice(0, 10);
};
const costOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Costo non valido');
  return Math.round(n * 100) / 100;
};

const SELECT = `SELECT e.*, COALESCE(s.name, e.lab_name) AS lab, s.phone AS lab_phone, r.code AS repair_code, r.brand_model, r.status AS repair_status, c.name AS customer_name
  FROM external_repairs e JOIN repairs r ON r.id = e.repair_id JOIN customers c ON c.id = r.customer_id LEFT JOIN suppliers s ON s.id = e.supplier_id`;
const shape = (e, today = localDate()) => ({
  ...e, status_label: EXT_STATUS[e.status] || e.status,
  late: e.status === 'inviata' && !!e.expected_back && e.expected_back < today,
  days_out: e.status === 'inviata' && e.sent_at ? Math.max(0, Math.round((new Date(`${today}T00:00:00`) - new Date(`${e.sent_at}T00:00:00`)) / 86400000)) : null,
});

/** Avvisi per campanella e "Oggi": rientri in ritardo. */
export async function externalAlerts() {
  const today = localDate();
  const late = await db.prepare(`${SELECT} WHERE e.status = 'inviata' AND e.expected_back IS NOT NULL AND e.expected_back < ?`).all(today);
  return late.map((e) => ({ type: 'external_late', severity: 'medium', title: `${e.brand_model}: dal laboratorio esterno in ritardo`, detail: `${e.lab || 'Laboratorio'} doveva rientrare il ${e.expected_back} (${e.repair_code}, ${e.customer_name}). Sollecita.`, link: '#/esterne?stato=inviata', ref: e.id }));
}

export function registerExternalRoutes(app, h) {
  const clean = async (b, old = null) => {
    const repairId = Number(b.repair_id ?? old?.repair_id);
    if (!repairId || !(await db.prepare('SELECT id FROM repairs WHERE id = ?').get(repairId))) throw new HttpError(400, 'Scegli la riparazione collegata');
    const supplierId = b.supplier_id ? Number(b.supplier_id) : null;
    if (supplierId && !(await db.prepare('SELECT id FROM suppliers WHERE id = ?').get(supplierId))) throw new HttpError(400, 'Laboratorio non trovato in anagrafica');
    const labName = str(b.lab_name);
    if (!supplierId && !labName) throw new HttpError(400, 'Indica il laboratorio (dall’anagrafica fornitori o scrivendone il nome)');
    const status = b.status in EXT_STATUS ? b.status : (old?.status || 'da_inviare');
    let sent = dateOrNull(b.sent_at, 'Data di invio');
    let back = dateOrNull(b.returned_at, 'Data di rientro');
    if (status === 'inviata' && !sent) sent = localDate();
    if (status === 'rientrata' && !back) back = localDate();
    if (sent && back && back < sent) throw new HttpError(400, 'Il rientro non può essere prima dell’invio');
    return { repairId, supplierId, labName: supplierId ? null : labName, work: str(b.work), status, sent, expected: dateOrNull(b.expected_back, 'Rientro previsto'), back: status === 'rientrata' ? back : (b.returned_at ? back : null), cost: costOrNull(b.cost), tracking: str(b.tracking), notes: str(b.notes) };
  };
  const one = async (id) => {
    const e = await db.prepare(`${SELECT} WHERE e.id = ?`).get(id);
    if (!e) throw new HttpError(404, 'Riparazione esterna non trovata');
    return shape(e);
  };

  app.get('/api/esterne/meta', h(() => ({ statuses: EXT_STATUS })));
  app.get('/api/esterne', h(async (req) => {
    const where = [];
    const args = [];
    const st = req.query.stato || 'aperte';
    if (st === 'aperte') where.push("e.status IN ('da_inviare','inviata')");
    else if (st === 'in_ritardo') { where.push("e.status = 'inviata' AND e.expected_back IS NOT NULL AND e.expected_back < ?"); args.push(localDate()); }
    else if (st in EXT_STATUS) { where.push('e.status = ?'); args.push(st); }
    if (req.query.repair_id) { where.push('e.repair_id = ?'); args.push(Number(req.query.repair_id)); }
    if (req.query.supplier_id) { where.push('e.supplier_id = ?'); args.push(Number(req.query.supplier_id)); }
    const q = str(req.query.q);
    if (q) { where.push('(COALESCE(s.name, e.lab_name) LIKE ? OR r.code LIKE ? OR r.brand_model LIKE ? OR c.name LIKE ? OR e.work LIKE ? OR e.tracking LIKE ?)'); for (let i = 0; i < 6; i++) args.push(`%${q}%`); }
    const rows = (await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE e.status WHEN 'inviata' THEN 0 WHEN 'da_inviare' THEN 1 ELSE 2 END, COALESCE(e.expected_back, '9999'), e.id DESC LIMIT 500`).all(...args)).map((e) => shape(e));
    const counts = Object.fromEntries((await db.prepare('SELECT status, COUNT(*) AS n FROM external_repairs GROUP BY status').all()).map((x) => [x.status, x.n]));
    return { rows, counts, late: rows.filter((r) => r.late).length };
  }));
  app.get('/api/esterne/:id', h((req) => one(req.params.id)));
  app.post('/api/esterne', h(async (req) => {
    const v = await clean(req.body);
    const r = await db.prepare(`INSERT INTO external_repairs (repair_id, supplier_id, lab_name, work, status, sent_at, expected_back, returned_at, cost, tracking, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,${NOW},${NOW})`)
      .run(v.repairId, v.supplierId, v.labName, v.work, v.status, v.sent, v.expected, v.back, v.cost, v.tracking, v.notes);
    const e = await one(r.lastInsertRowid);
    await logEvent(v.repairId, null, `Riparazione esterna presso ${e.lab}: ${EXT_STATUS[v.status]}.`, 0);
    return e;
  }));
  app.put('/api/esterne/:id', h(async (req) => {
    const old = await db.prepare('SELECT * FROM external_repairs WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Riparazione esterna non trovata');
    const v = await clean({ ...old, ...req.body }, old);
    await db.prepare(`UPDATE external_repairs SET supplier_id=?, lab_name=?, work=?, status=?, sent_at=?, expected_back=?, returned_at=?, cost=?, tracking=?, notes=?, updated_at=${NOW} WHERE id=?`)
      .run(v.supplierId, v.labName, v.work, v.status, v.sent, v.expected, v.back, v.cost, v.tracking, v.notes, old.id);
    const e = await one(old.id);
    if (old.status !== v.status) await logEvent(old.repair_id, null, `Riparazione esterna presso ${e.lab}: ${EXT_STATUS[v.status]}.`, 0);
    return e;
  }));
  // Scorciatoie: "Inviata oggi" e "Rientrata" (con il costo finale, se noto)
  app.post('/api/esterne/:id/invia', h((req) => step(req, 'inviata')));
  app.post('/api/esterne/:id/rientro', h((req) => step(req, 'rientrata')));
  const step = async (req, status) => {
    const old = await db.prepare('SELECT * FROM external_repairs WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Riparazione esterna non trovata');
    if (old.status === 'annullata') throw new HttpError(409, 'È annullata: riaprila prima.');
    const body = { ...old, status };
    if (status === 'inviata') body.sent_at = req.body.date || localDate();
    else {
      if (!old.sent_at) body.sent_at = req.body.date || localDate();
      body.returned_at = req.body.date || localDate();
      if (req.body.cost !== undefined && req.body.cost !== '') body.cost = req.body.cost;
    }
    const v = await clean(body, old);
    await db.prepare(`UPDATE external_repairs SET status=?, sent_at=?, returned_at=?, cost=?, updated_at=${NOW} WHERE id=?`).run(v.status, v.sent, v.back, v.cost, old.id);
    const e = await one(old.id);
    await logEvent(old.repair_id, null, `Riparazione esterna presso ${e.lab}: ${EXT_STATUS[status]}${status === 'rientrata' && e.cost != null ? ` (costo ${e.cost.toFixed(2)} €)` : ''}.`, 0);
    return e;
  };
  app.delete('/api/esterne/:id', h(async (req) => {
    const r = await db.prepare('DELETE FROM external_repairs WHERE id = ?').run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Riparazione esterna non trovata');
    return { ok: true };
  }));
}

export const EXTERNAL_TABLES = ['external_repairs'];
