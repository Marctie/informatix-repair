// Dati per il bot di controllo sul telefono (Termux): numeri veri del gestionale per i riepiloghi e i controlli.
//  GET /api/monitor  con intestazione  Authorization: Bearer <MONITOR_TOKEN>
// MONITOR_TOKEN e' un segreto del Worker (e del file .env del bot), mai nel codice. Senza segreto configurato,
// o con la chiave sbagliata, l'indirizzo risponde 404 come se non esistesse.
// Niente telefoni, email dei clienti, PIN o password: solo codici, modelli, nomi, conteggi e importi.
// A ogni lettura invia anche i promemoria scaduti (cosi' arrivano su Telegram anche a gestionale chiuso).
import { db, getSettings, nowLocal } from './dbref.mjs';
import * as L from './logic.mjs';
import { storageList } from './remote.mjs';
import { notifyDueReminders } from './promemoria.mjs';
import { publishStatus } from './usati.mjs';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const days = (ts, today) => (ts ? Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(ts).slice(0, 10)}T00:00:00Z`)) / 86400000)) : null);
const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

/** Confronto a tempo costante (non rivela quanti caratteri della chiave sono giusti). */
export function sameKey(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (!x || !y) return false;
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i % x.length) || 0) ^ (y.charCodeAt(i % y.length) || 0);
  return diff === 0;
}

export async function monitorSummary({ backups } = {}) {
  const today = L.localDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const one = async (sql, ...a) => (await db.prepare(sql).get(...a)) || {};
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const settings = await getSettings();
  const dash = await L.dashboard();
  const open = await L.listRepairs({ open: true });
  const rep = (r) => ({ code: r.code, model: r.brand_model, customer: r.customer_name });

  const repairs = {
    open: open.length,
    by_status: Object.fromEntries(Object.entries(dash.counts).filter(([k]) => !['delivered', 'cancelled'].includes(k))),
    urgent: open.filter((r) => r.urgent).length,
    intake_today: (await one('SELECT COUNT(*) AS n FROM repairs WHERE date(created_at) = ?', today)).n || 0,
    delivered_today: await one('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(final_price), 0), 2) AS total FROM repairs WHERE date(delivered_at) = ?', today),
    ready: dash.ready.map((r) => ({ ...rep(r), days: days(r.updated_at, today) })),
    ready_days: Number(settings.ready_days) || 0,
    late: dash.late.map((r) => ({ ...rep(r), eta: r.eta_date })),
    to_approve: dash.to_approve.map(rep),
    declined: dash.declined.map(rep),
    waiting_parts: dash.waiting_parts.length,
    storage_due: (await safe(storageList, [])).filter((x) => x.due).map((x) => ({ code: x.code, model: x.brand_model, customer: x.customer_name, days: x.days_in_store })),
  };

  const day = await L.report(today, today);
  const month = await L.report(monthStart, today);
  const exp = async (from) => one('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM expenses WHERE spent_on BETWEEN ? AND ?', from, today);
  const cash = {
    today: { total: day.total, by_method: day.by_method, by_kind: day.by_kind, vouchers: day.vouchers, n: day.rows.length },
    month: { total: month.total, from: monthStart },
    expenses_today: await safe(() => exp(today), { n: 0, total: 0 }),
    expenses_month: await safe(() => exp(monthStart), { n: 0, total: 0 }),
  };

  const salesDay = await one('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(total), 0), 2) AS total FROM sales WHERE date(created_at) = ?', today);
  const sales = {
    today: { ...salesDay, items: await all(`SELECT si.name, SUM(si.qty) AS qty, ROUND(SUM(si.qty * si.unit_price), 2) AS revenue FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE date(s.created_at) = ? GROUP BY LOWER(si.name) ORDER BY qty DESC, revenue DESC LIMIT 8`, today) },
    month: await one('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(total), 0), 2) AS total FROM sales WHERE date(created_at) BETWEEN ? AND ?', monthStart, today),
  };

  const orders = await safe(async () => {
    const by = Object.fromEntries((await all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')).map((x) => [x.status, x.n]));
    const late = await all(`SELECT code, expected_date FROM orders WHERE status IN ('da_ordinare','ordinato') AND expected_date IS NOT NULL AND expected_date < ? ORDER BY expected_date`, today);
    const arrived = await all(`SELECT o.code, c.name AS customer FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.status = 'arrivato' AND o.kind = 'cliente' ORDER BY o.arrived_at`);
    return { to_order: by.da_ordinare || 0, ordered: by.ordinato || 0, arrived: arrived.length, arrived_list: arrived, late };
  }, null);

  const quotes = await safe(async () => {
    const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10);
    const openQ = await all("SELECT code, valid_until, COALESCE(customer_name, '') AS customer FROM quotes WHERE status IN ('bozza','inviato') ORDER BY valid_until");
    return { open: openQ.length, expiring: openQ.filter((q) => q.valid_until >= today && q.valid_until <= soon), expired: openQ.filter((q) => q.valid_until < today).length };
  }, null);

  const reminders = await safe(async () => {
    const list = await all(`SELECT title, due_at FROM reminders WHERE done = 0 AND due_at <= ? ORDER BY due_at`, `${today} 23:59`);
    const now = nowLocal().slice(0, 16);
    return { today: list.filter((x) => x.due_at.slice(0, 10) === today).map((x) => ({ time: x.due_at.slice(11, 16), title: x.title, overdue: x.due_at <= now })), overdue_before_today: list.filter((x) => x.due_at.slice(0, 10) < today).length };
  }, null);

  const low = await L.lowStock();
  const stock = {
    ...(await one('SELECT COUNT(*) AS items, COALESCE(SUM(qty), 0) AS units FROM products WHERE active = 1')),
    out: (await one('SELECT COUNT(*) AS n FROM products WHERE active = 1 AND qty <= 0')).n || 0,
    low: low.length,
    low_items: low.slice(0, 8).map((p) => ({ name: p.name, qty: p.qty, min: p.min_qty })),
  };

  const usati = await safe(async () => {
    const c = await one('SELECT COUNT(*) AS total, COALESCE(SUM(sold), 0) AS sold FROM usati_items');
    const st = await publishStatus({ mode: 'monitor' });
    return { total: c.total || 0, in_vetrina: (c.total || 0) - (c.sold || 0), sold: c.sold || 0, dirty: st.dirty, published_at: st.published_at, error: st.error };
  }, null);

  const users = await all('SELECT email, name, role, active, last_seen_at FROM users ORDER BY role, email');
  const activity = await safe(() => one('SELECT COUNT(*) AS n, MAX(at) AS last_at FROM audit_log WHERE date(at) = ?', today), { n: 0, last_at: null });

  let backup = null;
  if (backups) {
    backup = await safe(async () => {
      const list = await backups.list({ prefix: 'officina-' });
      const last = list.objects.map((o) => o.key).sort().at(-1) || null;
      // officina-2026-10-15_02-30-00.json -> 2026-10-15 02:30:00 (ora del negozio)
      const m = last && last.match(/officina-(\d{4}-\d\d-\d\d)_(\d\d)-(\d\d)-(\d\d)/);
      return { last, at: m ? `${m[1]} ${m[2]}:${m[3]}:${m[4]}` : null, copies: list.objects.length };
    }, null);
  }

  return { ok: true, generated_at: nowLocal(), today, repairs, cash, sales, orders, quotes, reminders, stock, usati, users, activity, backup };
}

/** Rotta per il bot. `env(c)` restituisce le variabili (segreti del Worker o ambiente del PC). */
export function registerMonitorRoutes(app, { env }) {
  app.get('/api/monitor', async (c) => {
    const e = env(c);
    const auth = c.req.header('authorization') || '';
    const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!e.MONITOR_TOKEN || String(e.MONITOR_TOKEN).length < 24 || !sameKey(key, e.MONITOR_TOKEN)) return c.text('Non trovato', 404);
    try { await notifyDueReminders(e); } catch { /* i promemoria non devono bloccare il riepilogo */ }
    const out = await monitorSummary({ backups: e.BACKUPS });
    return c.json(out, 200, { 'Cache-Control': 'no-store' });
  });
}
