// Promemoria con data e ora, collegabili a cliente / riparazione / ordine.
// Compaiono in "Oggi" e nella campanella; quando scade l'ora arriva anche un messaggio Telegram al proprietario (una sola volta).
import { db, nowLocal } from './dbref.mjs';
import { HttpError, localDate } from './logic.mjs';
import { sendTelegram } from './notify.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const REMINDER_TABLES = ['reminders'];

const SELECT = `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, rp.code AS repair_code, rp.brand_model AS repair_model, o.code AS order_code
  FROM reminders r LEFT JOIN customers c ON c.id=r.customer_id LEFT JOIN repairs rp ON rp.id=r.repair_id LEFT JOIN orders o ON o.id=r.order_id`;

/** Accetta "2026-10-15T10:30" o "2026-10-15 10:30" e restituisce "2026-10-15 10:30". */
export function normDue(v) {
  const s = String(v ?? '').trim().replace('T', ' ').slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) || Number.isNaN(new Date(s.replace(' ', 'T')).getTime())) throw new HttpError(400, 'Il promemoria ha data e ora non valide.', { code: 'DATA_ORA_NON_VALIDA', hint: 'Usa il formato AAAA-MM-GG HH:MM con una data che esiste.' });
  return s;
}
const nowMin = () => nowLocal().slice(0, 16);

const shape = (r) => {
  const now = nowMin();
  return { ...r, done: !!r.done, overdue: !r.done && r.due_at <= now, today: !r.done && r.due_at.slice(0, 10) === localDate() };
};

async function checkLinks(b) {
  for (const [k, t, msg] of [['customer_id', 'customers', 'Cliente non trovato'], ['repair_id', 'repairs', 'Riparazione non trovata'], ['order_id', 'orders', 'Ordine non trovato']]) {
    if (b[k] && !(await db.prepare(`SELECT id FROM ${t} WHERE id = ?`).get(b[k]))) throw new HttpError(404, `${msg}: il record collegato al promemoria non esiste più`, { code: 'COLLEGAMENTO_NON_TROVATO', hint: 'Aggiorna la pagina e scegli di nuovo cliente o riparazione.' });
  }
}

export async function getReminder(id) {
  const r = await db.prepare(`${SELECT} WHERE r.id = ?`).get(id);
  if (!r) throw new HttpError(404, 'Promemoria non trovato', { code: 'PROMEMORIA_NON_TROVATO', hint: 'Aggiorna l’elenco: potrebbe essere stato eliminato.' });
  return shape(r);
}

export async function createReminder(b, user) {
  const title = str(b.title);
  if (!title) throw new HttpError(400, 'Promemoria non salvato: manca il testo.', { code: 'TESTO_MANCANTE', hint: 'Scrivi cosa ricordare.' });
  const due = normDue(b.due_at);
  await checkLinks(b);
  const r = await db.prepare(`INSERT INTO reminders (title, body, due_at, customer_id, repair_id, order_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,${NOW})`)
    .run(title, str(b.body), due, b.customer_id || null, b.repair_id || null, b.order_id || null, user?.email || null);
  return getReminder(Number(r.lastInsertRowid));
}

export async function updateReminder(id, b) {
  const cur = await getReminder(id);
  const due = 'due_at' in b ? normDue(b.due_at) : cur.due_at;
  const title = 'title' in b ? str(b.title) : cur.title;
  if (!title) throw new HttpError(400, 'Promemoria non salvato: manca il testo.', { code: 'TESTO_MANCANTE', hint: 'Scrivi cosa ricordare.' });
  const link = (k) => ('customer_id repair_id order_id'.includes(k) && k in b ? b[k] || null : cur[k]);
  await checkLinks({ customer_id: link('customer_id'), repair_id: link('repair_id'), order_id: link('order_id') });
  // se cambia l'orario il promemoria puo' suonare di nuovo
  await db.prepare('UPDATE reminders SET title=?, body=?, due_at=?, customer_id=?, repair_id=?, order_id=?, notified_at=? WHERE id=?')
    .run(title, 'body' in b ? str(b.body) : cur.body, due, link('customer_id'), link('repair_id'), link('order_id'), due === cur.due_at ? cur.notified_at : null, id);
  return getReminder(id);
}

export async function setDone(id, done) {
  await getReminder(id);
  await db.prepare(`UPDATE reminders SET done=?, done_at=${done ? NOW : 'NULL'} WHERE id=?`).run(done ? 1 : 0, id);
  return getReminder(id);
}

/** Rimanda: di N minuti da adesso (default 60) oppure a domani alla stessa ora. */
export async function snooze(id, { minutes, tomorrow } = {}) {
  const r = await getReminder(id);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  let d;
  if (tomorrow) {
    d = new Date(`${localDate()}T${r.due_at.slice(11)}:00`);
    d.setDate(d.getDate() + 1);
  } else {
    d = new Date(`${nowMin().replace(' ', 'T')}:00`);
    d.setMinutes(d.getMinutes() + Math.max(5, Math.min(1440, Number(minutes) || 60)));
  }
  await db.prepare('UPDATE reminders SET due_at=?, notified_at=NULL, done=0, done_at=NULL WHERE id=?').run(fmt(d), id);
  return getReminder(id);
}

/** Avvisi per campanella e "Oggi": scaduti (alta priorita') e in programma oggi. */
export async function reminderAlerts() {
  const now = nowMin();
  const today = localDate();
  const rows = await db.prepare(`${SELECT} WHERE r.done = 0 AND r.due_at <= ? ORDER BY r.due_at`).all(`${today} 23:59`);
  return rows.map((r) => ({
    type: r.due_at <= now ? 'reminder_due' : 'reminder_today', severity: r.due_at <= now ? 'high' : 'low',
    title: `${r.due_at <= now ? 'Promemoria' : 'Oggi alle ' + r.due_at.slice(11)}: ${r.title}`,
    detail: [r.customer_name, r.repair_code, r.order_code].filter(Boolean).join(' · ') || (r.due_at <= now ? `Era per le ${r.due_at.slice(11)}${r.due_at.slice(0, 10) !== today ? ` del ${r.due_at.slice(0, 10).split('-').reverse().join('/')}` : ''}.` : 'In programma.'),
    link: '#/promemoria', ref: r.id,
  }));
}

const envOf = (c) => ({ ...(typeof process !== 'undefined' ? process.env : {}), ...(c?.env || {}) });

/** Invia su Telegram i promemoria scaduti non ancora segnalati e li marca. Ritorna quanti ne ha inviati. */
export async function notifyDueReminders(env, fetcher) {
  if (!env?.TELEGRAM_BOT_TOKEN || !env?.TELEGRAM_OWNER_ID) return 0;
  const rows = await db.prepare(`${SELECT} WHERE r.done = 0 AND r.notified_at IS NULL AND r.due_at <= ? ORDER BY r.due_at LIMIT 10`).all(nowMin());
  let sent = 0;
  for (const r of rows) {
    const links = [r.customer_name && `Cliente: ${esc(r.customer_name)}`, r.repair_code && `Riparazione: ${esc(r.repair_code)} ${esc(r.repair_model)}`, r.order_code && `Ordine: ${esc(r.order_code)}`].filter(Boolean).join('\n');
    const ok = await sendTelegram(env, `🔔 <b>Promemoria</b> (${esc(r.due_at.slice(11))})\n${esc(r.title)}${r.body ? `\n${esc(r.body)}` : ''}${links ? `\n${links}` : ''}`, fetcher);
    if (ok) { await db.prepare(`UPDATE reminders SET notified_at=${NOW} WHERE id=?`).run(r.id); sent++; }
  }
  return sent;
}

/** Per /api/alerts: avvisa su Telegram i promemoria appena scaduti (senza mai bloccare) e li elenca. */
export async function reminderAlertsNotify(c) {
  try { await notifyDueReminders(envOf(c)); } catch { /* le notifiche non devono rompere gli avvisi */ }
  return reminderAlerts();
}

export function registerReminderRoutes(app, h) {
  app.get('/api/reminders', h(async (req) => {
    const where = [];
    const args = [];
    const st = req.query.stato || 'aperti';
    if (st === 'aperti') where.push('r.done = 0');
    else if (st === 'fatti') where.push('r.done = 1');
    else if (st === 'oggi') { where.push('r.done = 0 AND r.due_at <= ?'); args.push(`${localDate()} 23:59`); }
    for (const k of ['customer_id', 'repair_id', 'order_id']) if (req.query[k]) { where.push(`r.${k} = ?`); args.push(req.query[k]); }
    const q = str(req.query.q);
    if (q) { where.push('(r.title LIKE ? OR r.body LIKE ? OR c.name LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const order = st === 'fatti' ? 'r.done_at DESC' : 'r.due_at';
    return (await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order} LIMIT 300`).all(...args)).map(shape);
  }));
  // chiamata periodica dell'interfaccia: invia su Telegram quelli scaduti e dice quanti sono
  app.get('/api/reminders/tick', h(async (req) => {
    const sent = await notifyDueReminders(envOf(req.c));
    return { sent, due: (await reminderAlerts()).filter((a) => a.type === 'reminder_due').length };
  }));
  app.get('/api/reminders/:id', h((req) => getReminder(req.params.id)));
  app.post('/api/reminders', h((req) => createReminder(req.body, req.user)));
  app.put('/api/reminders/:id', h((req) => updateReminder(req.params.id, req.body)));
  app.post('/api/reminders/:id/done', h((req) => setDone(req.params.id, req.body.done !== false)));
  app.post('/api/reminders/:id/snooze', h((req) => snooze(req.params.id, req.body)));
  app.delete('/api/reminders/:id', h(async (req) => {
    await getReminder(req.params.id);
    await db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));
}
