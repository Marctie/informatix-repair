// Tecnico assegnato alla riparazione, statistiche per tecnico e stati personalizzabili (spunti da Fix-Book ed e-Share).
// Stati: i 9 stati di base restano (servono a cassa, avvisi e cliente); si possono RINOMINARE, cambiare il testo per il cliente
// e NASCONDERE dal menu. In piu' si definiscono "fasi" libere (es. «Inviato al centro Samsung») che si mettono sopra lo stato di base.
import { db, getSettings } from './dbref.mjs';
import { STATUSES, HttpError, logEvent, getRepair, localDate, money } from './logic.mjs';

const DEFAULTS = Object.fromEntries(Object.entries(STATUSES).map(([k, v]) => [k, { ...v }]));
const LOCKED = new Set(['delivered', 'received']); // non si nascondono: servono sempre
const str = (v) => (v == null ? null : String(v).trim() || null);
const parse = (s, d) => { try { const v = JSON.parse(s); return v ?? d; } catch { return d; } };
const setSetting = (k, v) => db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v);

/** Applica nomi e testi personalizzati all'oggetto STATUSES (un solo negozio: si rilegge a ogni richiesta). */
export async function applyStatusLabels(settings) {
  const s = settings || await getSettings();
  const custom = parse(s.status_labels, {});
  for (const [k, def] of Object.entries(DEFAULTS)) {
    const c = custom[k] || {};
    STATUSES[k].label = str(c.label) || def.label;
    STATUSES[k].hint = str(c.hint) || def.hint;
    STATUSES[k].hidden = !LOCKED.has(k) && !!c.hidden;
  }
  return STATUSES;
}
export const statusMiddleware = async (c, next) => { try { await applyStatusLabels(); } catch { /* tabella non pronta: nomi di serie */ } await next(); };

export async function getStatusConfig() {
  const s = await getSettings();
  await applyStatusLabels(s);
  return {
    statuses: Object.entries(DEFAULTS).map(([k, d]) => ({ key: k, default_label: d.label, default_hint: d.hint, label: STATUSES[k].label, hint: STATUSES[k].hint, hidden: !!STATUSES[k].hidden, can_hide: !LOCKED.has(k) })),
    substatuses: parse(s.substatuses, []),
  };
}

export async function saveStatusConfig(b) {
  const out = {};
  for (const x of Array.isArray(b.statuses) ? b.statuses : []) {
    if (!DEFAULTS[x.key]) throw new HttpError(400, `Lo stato «${x.key}» non esiste.`, { code: 'STATO_NON_VALIDO', hint: 'Ricarica la pagina delle impostazioni e riprova.' });
    const label = str(x.label)?.slice(0, 40);
    const hint = str(x.hint)?.slice(0, 200);
    out[x.key] = { ...(label && label !== DEFAULTS[x.key].label ? { label } : {}), ...(hint && hint !== DEFAULTS[x.key].hint ? { hint } : {}), ...(x.hidden && !LOCKED.has(x.key) ? { hidden: true } : {}) };
    if (!Object.keys(out[x.key]).length) delete out[x.key];
  }
  const subs = [...new Set((Array.isArray(b.substatuses) ? b.substatuses : []).map((t) => str(t)?.slice(0, 50)).filter(Boolean))].slice(0, 30);
  await setSetting('status_labels', JSON.stringify(out));
  await setSetting('substatuses', JSON.stringify(subs));
  return getStatusConfig();
}

/** Assegna (o toglie) il tecnico: deve essere un utente attivo. */
export async function assignTech(id, email) {
  const r = await db.prepare('SELECT id, code, tech_email FROM repairs WHERE id = ?').get(id);
  if (!r) throw new HttpError(404, 'Riparazione non trovata', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Aggiorna l’elenco delle riparazioni.' });
  const e = str(email)?.toLowerCase() || null;
  let name = null;
  if (e) {
    const u = await db.prepare('SELECT name, email, active FROM users WHERE email = ?').get(e);
    if (!u || !u.active) throw new HttpError(400, `Il tecnico ${e} non è tra gli utenti attivi: non lo assegno.`, { code: 'TECNICO_NON_VALIDO', hint: 'Scegli un tecnico dall’elenco (Gestione → Utenti).' });
    name = u.name || u.email;
  }
  if ((r.tech_email || null) === e) return getRepair(id);
  await db.prepare("UPDATE repairs SET tech_email = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(e, id);
  await logEvent(id, null, e ? `Tecnico assegnato: ${name}.` : 'Tecnico tolto.', 0);
  return { ...(await getRepair(id)), tech_name: name };
}

/** Fase libera sopra lo stato di base (vuota = nessuna). Visibile anche al cliente se `public`. */
export async function setSubstatus(id, text, isPublic) {
  const r = await db.prepare('SELECT id, substatus FROM repairs WHERE id = ?').get(id);
  if (!r) throw new HttpError(404, 'Riparazione non trovata', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Aggiorna l’elenco delle riparazioni.' });
  const t = str(text)?.slice(0, 50) || null;
  if (t) {
    const allowed = parse((await getSettings()).substatuses, []);
    if (!allowed.includes(t)) throw new HttpError(400, `La fase «${t}» non è tra quelle impostate.`, { code: 'FASE_NON_VALIDA', hint: 'Aggiungila in Impostazioni → Stati e fasi, poi riprova.' });
  }
  if ((r.substatus || null) === t) return getRepair(id);
  await db.prepare("UPDATE repairs SET substatus = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(t, id);
  await logEvent(id, null, t ? `Fase: ${t}.` : 'Fase tolta.', isPublic ? 1 : 0);
  return getRepair(id);
}

/** Statistiche per tecnico nel periodo: riparazioni aperte, consegnate, incassato, margine stimato, giorni medi. */
export async function techStats(from, to) {
  const f = /^\d{4}-\d\d-\d\d$/.test(from || '') ? from : `${localDate().slice(0, 7)}-01`;
  const t = /^\d{4}-\d\d-\d\d$/.test(to || '') ? to : localDate();
  const rows = await db.prepare(`SELECT COALESCE(r.tech_email, '') AS tech,
      SUM(CASE WHEN r.status NOT IN ('delivered','cancelled') THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN r.status = 'delivered' AND date(r.delivered_at) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS delivered,
      ROUND(SUM(CASE WHEN r.status = 'delivered' AND date(r.delivered_at) BETWEEN ? AND ? THEN COALESCE(r.final_price,0) ELSE 0 END), 2) AS revenue,
      ROUND(SUM(CASE WHEN r.status = 'delivered' AND date(r.delivered_at) BETWEEN ? AND ? THEN COALESCE(r.final_price,0) - COALESCE((SELECT SUM(p.qty*p.unit_cost) FROM repair_parts p WHERE p.repair_id = r.id),0) ELSE 0 END), 2) AS margin,
      AVG(CASE WHEN r.status = 'delivered' AND date(r.delivered_at) BETWEEN ? AND ? THEN julianday(r.delivered_at) - julianday(r.created_at) END) AS avg_days
    FROM repairs r GROUP BY COALESCE(r.tech_email, '') ORDER BY delivered DESC`).all(f, t, f, t, f, t, f, t);
  const users = Object.fromEntries((await db.prepare('SELECT email, name FROM users').all()).map((u) => [u.email, u.name || u.email]));
  return { from: f, to: t, rows: rows.filter((x) => x.open || x.delivered).map((x) => ({ tech: x.tech || null, name: x.tech ? users[x.tech] || x.tech : 'Non assegnato', open: x.open || 0, delivered: x.delivered || 0, revenue: money(x.revenue || 0), margin: money(x.margin || 0), avg_days: x.avg_days == null ? null : Math.round(x.avg_days * 10) / 10 })) };
}

export function registerTechRoutes(app, h, adminOnly) {
  app.get('/api/stati', h(() => getStatusConfig()));
  app.put('/api/stati', h((req) => { adminOnly(req); return saveStatusConfig(req.body); }));
  app.get('/api/tecnici', h(async () => (await db.prepare("SELECT email, name, role FROM users WHERE active = 1 ORDER BY name, email").all())));
  app.get('/api/tecnici/stats', h((req) => { adminOnly(req); return techStats(req.query.from, req.query.to); }));
  app.post('/api/repairs/:id{[0-9]+}/tech', h((req) => assignTech(req.params.id, req.body.email)));
  app.post('/api/repairs/:id{[0-9]+}/substatus', h((req) => setSubstatus(req.params.id, req.body.substatus, req.body.public !== false)));
}
