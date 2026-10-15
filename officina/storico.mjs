// Storico riparazioni: elenco completo con tutti i dettagli, ricerca, filtri, esportazione CSV e scheda riassuntiva.
import { db } from './dbref.mjs';
import { HttpError, STATUSES } from './logic.mjs';
import { isCassa } from './roles.mjs';

const str = (v) => (v == null ? null : String(v).trim() || null);
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Esito leggibile: cosa e' successo alla riparazione. */
export function outcomeOf(r) {
  if (r.status === 'delivered') return 'Riparato e consegnato';
  if (r.status === 'cancelled') return 'Non riparata / annullata';
  if (r.status === 'ready') return 'Pronta, da ritirare';
  return 'In corso';
}

// Costi per riparazione (ricambi + esterni) calcolati in SQL: stessi numeri nell'elenco, nel CSV e nel dettaglio.
const SELECT = `SELECT r.id, r.code, r.created_at, r.delivered_at, r.status, r.device_type, r.brand_model, r.color, r.serial, r.problem, r.tech_notes,
    r.quote, r.deposit, r.final_price, r.warranty_days, r.customer_id,
    c.name AS customer_name, c.phone AS customer_phone,
    COALESCE((SELECT SUM(p.unit_price * p.qty) FROM repair_parts p WHERE p.repair_id = r.id), 0) AS parts_price,
    COALESCE((SELECT SUM(p.unit_cost * p.qty) FROM repair_parts p WHERE p.repair_id = r.id), 0) AS parts_cost,
    COALESCE((SELECT SUM(e.cost) FROM external_repairs e WHERE e.repair_id = r.id AND e.status <> 'annullata'), 0) AS external_cost,
    (SELECT COUNT(*) FROM external_repairs e WHERE e.repair_id = r.id) AS external_count
  FROM repairs r JOIN customers c ON c.id = r.customer_id`;

function filters(q) {
  const where = [];
  const args = [];
  const like = (col, v) => { where.push(`${col} LIKE ?`); args.push(`%${v}%`); };
  if (str(q.q)) {
    where.push('(r.code LIKE ? OR r.brand_model LIKE ? OR r.serial LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR r.problem LIKE ? OR r.tech_notes LIKE ? OR r.color LIKE ?)');
    for (let i = 0; i < 8; i++) args.push(`%${str(q.q)}%`);
  }
  if (str(q.customer)) { where.push('(c.name LIKE ? OR c.phone LIKE ?)'); args.push(`%${str(q.customer)}%`, `%${str(q.customer)}%`); }
  if (str(q.customer_id)) { where.push('r.customer_id = ?'); args.push(Number(q.customer_id)); }
  if (str(q.brand)) like('r.brand_model', str(q.brand));
  if (str(q.model)) like('r.brand_model', str(q.model));
  if (str(q.serial)) like('r.serial', str(q.serial));
  if (str(q.problem)) like('r.problem', str(q.problem));
  if (q.device_type) { where.push('r.device_type = ?'); args.push(q.device_type); }
  const st = q.status || q.stato;
  if (st === 'aperte') where.push("r.status NOT IN ('delivered','cancelled')");
  else if (st === 'chiuse') where.push("r.status IN ('delivered','cancelled')");
  else if (st && st in STATUSES) { where.push('r.status = ?'); args.push(st); }
  const col = q.campo === 'consegna' ? 'r.delivered_at' : 'r.created_at';
  if (q.from && DATE.test(q.from)) { where.push(`date(${col}) >= ?`); args.push(q.from); }
  if (q.to && DATE.test(q.to)) { where.push(`date(${col}) <= ?`); args.push(q.to); }
  return { where, args };
}

const decorate = (r, cassa) => {
  const amount = r.final_price ?? r.quote;
  const out = {
    ...r, status_label: STATUSES[r.status]?.label || r.status, outcome: outcomeOf(r), amount: amount == null ? null : money(amount),
    parts_price: money(r.parts_price),
  };
  if (cassa) { delete out.parts_cost; delete out.external_cost; } // il ruolo cassa non vede costi e margini
  else {
    out.parts_cost = money(r.parts_cost);
    out.external_cost = money(r.external_cost);
    out.total_cost = money(r.parts_cost + r.external_cost);
    out.margin = r.status === 'delivered' && amount != null ? money(amount - out.total_cost) : null;
  }
  return out;
};

export async function listStorico(query, user) {
  const { where, args } = filters(query);
  const limit = Math.min(Number(query.limit) || 500, 2000);
  const rows = await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at DESC, r.id DESC LIMIT ${limit}`).all(...args);
  const cassa = isCassa(user);
  const list = rows.map((r) => decorate(r, cassa));
  const closed = list.filter((r) => r.status === 'delivered');
  const totals = { count: list.length, closed: closed.length, amount: money(closed.reduce((a, r) => a + (r.amount || 0), 0)) };
  if (!cassa) { totals.cost = money(closed.reduce((a, r) => a + r.total_cost, 0)); totals.margin = money(totals.amount - totals.cost); }
  return { rows: list, totals };
}

export function registerStoricoRoutes(app, h) {
  app.get('/api/storico', h((req) => listStorico(req.query, req.user)));

  app.get('/api/storico/export.csv', async (c) => {
    try {
      const { rows } = await listStorico({ ...c.req.query(), limit: 2000 }, c.get('user'));
      const cassa = isCassa(c.get('user'));
      const head = ['Scheda', 'Data ingresso', 'Data consegna', 'Cliente', 'Telefono', 'Tipo', 'Marca e modello', 'Colore', 'Seriale / IMEI', 'Problema', 'Stato', 'Esito', 'Preventivo', 'Importo finale', 'Acconto', 'Ricambi (prezzo)', ...(cassa ? [] : ['Costo ricambi', 'Costo esterni', 'Margine']), 'Riparazioni esterne', 'Note tecniche'];
      const lines = [head.map(csvCell).join(';')];
      for (const r of rows) {
        lines.push([r.code, r.created_at?.slice(0, 10), r.delivered_at?.slice(0, 10), r.customer_name, r.customer_phone, r.device_type, r.brand_model, r.color, r.serial, r.problem, r.status_label, r.outcome,
          r.quote, r.final_price, r.deposit, r.parts_price, ...(cassa ? [] : [r.parts_cost, r.external_cost, r.margin]), r.external_count, r.tech_notes].map(csvCell).join(';'));
      }
      return c.body('﻿' + lines.join('\r\n'), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="storico-riparazioni.csv"', 'cache-control': 'no-store' });
    } catch { return c.json({ ok: false, error: 'Esportazione non riuscita' }, 500); }
  });

  // Scheda riassuntiva di una riparazione: tutti i dettagli in un colpo (la scheda completa resta in Riparazioni)
  app.get('/api/storico/:id', h(async (req) => {
    const r = await db.prepare(`${SELECT} WHERE r.id = ?`).get(req.params.id);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    const cassa = isCassa(req.user);
    const parts = await db.prepare('SELECT name, qty, unit_price, unit_cost FROM repair_parts WHERE repair_id = ? ORDER BY id').all(r.id);
    const events = await db.prepare('SELECT status, note, created_at FROM repair_events WHERE repair_id = ? AND is_public = 1 ORDER BY id').all(r.id);
    const externals = await db.prepare(`SELECT e.*, COALESCE(s.name, e.lab_name) AS lab FROM external_repairs e LEFT JOIN suppliers s ON s.id = e.supplier_id WHERE e.repair_id = ? ORDER BY e.id`).all(r.id);
    const loans = await db.prepare('SELECT id, label, lent_at, due_at, returned_at, status FROM loans WHERE repair_id = ? ORDER BY id').all(r.id);
    return { ...decorate(r, cassa), parts, events, externals, loans };
  }));
}
