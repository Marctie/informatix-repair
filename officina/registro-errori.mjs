// Registro errori consultabile (tabella additiva `error_log`, migrazione 0031).
// Ogni errore del gestionale (4xx dell'utente, 401/403, 5xx ed eccezioni) lascia una riga: chi, cosa stava facendo, su cosa, perche'.
// Anti-spam: lo stesso errore (stesso utente, stesso tipo di operazione, stesso motivo) entro pochi minuti aggiorna il contatore
// della riga esistente invece di crearne una nuova e NON rinnova l'avviso Telegram. Retention: 90 giorni, cancellazione automatica.
// Questo modulo scrive SOLO in `error_log`; la lettura (GET /api/errors) e' riservata all'amministratore e non modifica nulla.
import { db, nowLocal } from './dbref.mjs';

export const ERROR_RETENTION_DAYS = 90;
export const WINDOW_MIN = { info: 10, security: 10, error: 5 };
export const SEVERITIES = ['info', 'security', 'error'];

/** Codice di riferimento breve da citare quando si segnala un problema (es. E-7K3QX). */
export const newRef = () => `E-${Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')}`;

/** Percorso "di tipo": numeri e token diventano segnaposto, cosi' due errori uguali su elementi diversi si raggruppano. */
export const normPath = (path) => String(path || '').replace(/^(\/api\/(?:track|quote)\/)[^/]+/, '$1:token').replace(/\/\d+(?=\/|$)/g, '/#');
export const fingerprint = (i) => [i.user?.email || 'visitatore', i.status, i.method, normPath(i.path), String(i.reason || '').replace(/[A-Z]{1,3}-\d{4}-\d+|\d+/g, '#').slice(0, 120)].join('|');

const ago = (min) => nowLocal(new Date(Date.now() - min * 60000));
let lastPurge = 0;
const memo = new Map(); // ripiego se la tabella non c'e' ancora (database non migrato): stessa regola, in memoria

/** Cancella le righe oltre la retention. Restituisce quante. Di norma parte da sola (al massimo una volta all'ora). */
export async function purgeErrors(days = ERROR_RETENTION_DAYS) {
  const cutoff = nowLocal(new Date(Date.now() - days * 86400000));
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM error_log WHERE last_at < ?').get(cutoff)).n;
  if (n) await db.prepare('DELETE FROM error_log WHERE last_at < ?').run(cutoff);
  return n;
}

/**
 * Registra un errore. `info` = { severity, status, method, path, section, action, entity, title, reason, hint, errorCode, version, user, ip, country }.
 * Restituisce { ref, notify, repeated }: `notify` = true se va mandato l'avviso (primo della finestra), `repeated` = quante volte
 * si e' ripetuto in silenzio dopo l'ultimo avviso. Non lancia mai errori.
 */
export async function recordError(info, { enabled = true } = {}) {
  const fp = fingerprint(info);
  const win = WINDOW_MIN[info.severity] || 10;
  try {
    if (Date.now() - lastPurge > 3600000) { lastPurge = Date.now(); await purgeErrors().catch(() => {}); }
    const now = nowLocal();
    const recent = await db.prepare('SELECT id, ref, count FROM error_log WHERE fingerprint = ? AND last_at >= ? ORDER BY id DESC LIMIT 1').get(fp, ago(win));
    if (recent) {
      await db.prepare('UPDATE error_log SET count = count + 1, last_at = ? WHERE id = ?').run(now, recent.id);
      return { ref: recent.ref, notify: false, repeated: 0 };
    }
    const prev = await db.prepare('SELECT count FROM error_log WHERE fingerprint = ? AND last_at >= ? ORDER BY id DESC LIMIT 1').get(fp, ago(1440));
    const ref = newRef();
    const clip = (s, n) => (s == null ? null : String(s).slice(0, n));
    await db.prepare(`INSERT INTO error_log (at, last_at, severity, status, method, path, section, action, entity, title, reason, hint, error_code, ref, version, user_email, user_name, ip, country, fingerprint, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      now, now, info.severity, info.status, info.method, clip(info.path, 200), clip(info.section, 80), clip(info.action, 120), clip(info.entity, 160), clip(info.title, 300), clip(info.reason, 500), clip(info.hint, 300),
      clip(info.errorCode, 60), ref, clip(info.version, 60), clip(info.user?.email, 120) || 'visitatore', clip(info.user?.name, 120), clip(info.ip, 60), clip(info.country, 8), fp, enabled ? 1 : 0);
    return { ref, notify: true, repeated: Math.max(0, (prev?.count || 1) - 1) };
  } catch {
    const last = memo.get(fp) || 0;
    if (Date.now() - last < win * 60000) return { ref: newRef(), notify: false, repeated: 0 };
    memo.set(fp, Date.now());
    if (memo.size > 500) memo.clear();
    return { ref: newRef(), notify: true, repeated: 0 };
  }
}

/** Elenco con filtri (periodo, gravita', utente, stato, testo) e paginazione. Sola lettura. */
export async function listErrors({ from, to, severity, user, status, q, page = 1, size = 50 } = {}) {
  const where = [];
  const args = [];
  if (severity) {
    if (!SEVERITIES.includes(String(severity))) { const e = new Error('Gravità non valida: usa info, security o error.'); e.status = 400; throw e; }
    where.push('severity = ?'); args.push(severity);
  }
  if (user) { where.push('user_email = ?'); args.push(user); }
  if (status) { where.push('status = ?'); args.push(Number(status) || 0); }
  if (from) { where.push('date(last_at) >= ?'); args.push(String(from).slice(0, 10)); }
  if (to) { where.push('date(at) <= ?'); args.push(String(to).slice(0, 10)); }
  if (q) { where.push('(title LIKE ? OR reason LIKE ? OR entity LIKE ? OR path LIKE ? OR ref = ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, q); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM error_log ${w}`).get(...args)).n;
  const sz = Math.min(200, Math.max(1, Number(size) || 50));
  const pg = Math.max(1, Number(page) || 1);
  const rows = await db.prepare(`SELECT * FROM error_log ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, sz, (pg - 1) * sz);
  const bySeverity = Object.fromEntries((await db.prepare(`SELECT severity, SUM(count) AS n FROM error_log ${w} GROUP BY severity`).all(...args)).map((r) => [r.severity, r.n]));
  const users = (await db.prepare('SELECT DISTINCT user_email FROM error_log ORDER BY user_email').all()).map((r) => r.user_email);
  return { rows, total, page: pg, size: sz, pages: Math.max(1, Math.ceil(total / sz)), by_severity: bySeverity, severities: SEVERITIES, users, retention_days: ERROR_RETENTION_DAYS };
}

export function registerErrorRoutes(app, h, adminOnly) {
  app.get('/api/errors', h((req) => { adminOnly(req); return listErrors(req.query); }));
}
