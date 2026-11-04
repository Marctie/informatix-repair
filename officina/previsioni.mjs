// Previsioni di fine mese (spunto da Fixh IT: "statistiche e previsioni") e Agenda unica delle scadenze (spunto da Fix-Book: calendario).
// Previsione: incassi del mese finora / giorni passati x giorni del mese, confrontata con lo stesso mese dell'anno prima
// e con la media degli ultimi 90 giorni; in piu' il valore delle riparazioni aperte ancora da incassare.
// Agenda: promemoria, consegne previste, ordini attesi e preventivi in scadenza, giorno per giorno.
import { db } from './dbref.mjs';
import { money, localDate, STATUSES } from './logic.mjs';

const daysIn = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const sum = async (from, to) => money((await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE entity = 'main' AND date(created_at) BETWEEN ? AND ?").get(from, to)).s);

export async function forecast(today = localDate()) {
  const ym = today.slice(0, 7);
  const start = `${ym}-01`;
  const day = Number(today.slice(8, 10));
  const total = daysIn(ym);
  const soFar = await sum(start, today);
  const last90 = await sum(addDays(today, -90), addDays(today, -1));
  const prevYm = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
  const lastYear = await sum(`${prevYm}-01`, `${prevYm}-${String(daysIn(prevYm)).padStart(2, '0')}`);
  const projected = money(soFar / day * total);
  const pipe = await db.prepare(`SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(COALESCE(r.final_price, r.quote, 0) - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.kind='repair' AND p.ref_id=r.id),0)),0),2) AS due
    FROM repairs r WHERE r.status NOT IN ('delivered','cancelled') AND COALESCE(r.final_price, r.quote) IS NOT NULL`).get();
  const intake = (await db.prepare('SELECT COUNT(*) AS n FROM repairs WHERE date(created_at) BETWEEN ? AND ?').get(start, today)).n;
  return {
    month: ym, day, days_in_month: total,
    cash: { so_far: soFar, projected, daily_avg: money(soFar / day), avg90_daily: money(last90 / 90), projected_by_90: money(soFar + last90 / 90 * (total - day)), last_year_month: lastYear, vs_last_year_pct: lastYear > 0 ? Math.round((projected / lastYear - 1) * 1000) / 10 : null },
    repairs: { intake_so_far: intake, intake_projected: Math.round(intake / day * total), open_to_collect: { n: pipe.n || 0, amount: money(pipe.due || 0) } },
  };
}

export async function agenda(from, to) {
  const f = /^\d{4}-\d\d-\d\d$/.test(from || '') ? from : localDate();
  const t = /^\d{4}-\d\d-\d\d$/.test(to || '') ? to : addDays(f, 13);
  const items = [];
  for (const r of await db.prepare('SELECT id, title, due_at, done FROM reminders WHERE date(due_at) BETWEEN ? AND ? ORDER BY due_at').all(f, t)) items.push({ date: r.due_at.slice(0, 10), time: r.due_at.slice(11, 16) || null, kind: 'promemoria', icon: '🔔', title: r.title, done: !!r.done, link: '#/promemoria' });
  for (const r of await db.prepare(`SELECT r.id, r.code, r.brand_model, r.eta_date, r.status, c.name AS cn FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE r.status NOT IN ('delivered','cancelled','ready') AND r.eta_date BETWEEN ? AND ?`).all(f, t)) items.push({ date: r.eta_date, kind: 'riparazione', icon: '🛠️', title: `${r.code} ${r.brand_model} – ${r.cn}`, detail: `consegna prevista · ${STATUSES[r.status]?.label || r.status}`, link: `#/riparazioni/${r.id}` });
  for (const o of await db.prepare(`SELECT o.id, o.code, o.expected_date, s.name AS sn, c.name AS cn FROM orders o LEFT JOIN suppliers s ON s.id = o.supplier_id LEFT JOIN customers c ON c.id = o.customer_id WHERE o.status IN ('da_ordinare','ordinato') AND o.expected_date BETWEEN ? AND ?`).all(f, t)) items.push({ date: o.expected_date, kind: 'ordine', icon: '📮', title: `Ordine ${o.code}`, detail: `arrivo atteso · ${o.cn || o.sn || 'negozio'}`, link: '#/ordini' });
  for (const q of await db.prepare("SELECT id, code, valid_until, customer_name FROM quotes WHERE status IN ('bozza','inviato') AND valid_until BETWEEN ? AND ?").all(f, t)) items.push({ date: q.valid_until, kind: 'preventivo', icon: '📝', title: `Preventivo ${q.code}`, detail: `scade · ${q.customer_name || ''}`, link: '#/preventivi' });
  items.sort((a, b) => `${a.date} ${a.time || '99'}`.localeCompare(`${b.date} ${b.time || '99'}`));
  const days = [];
  for (let d = f; d <= t; d = addDays(d, 1)) days.push({ date: d, items: items.filter((x) => x.date === d) });
  return { from: f, to: t, count: items.length, days };
}

export function registerForecastRoutes(app, h, adminOnly) {
  app.get('/api/previsioni', h((req) => { adminOnly(req); return forecast(); }));
  app.get('/api/agenda', h((req) => agenda(req.query.from, req.query.to)));
}
