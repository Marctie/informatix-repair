// Archivio chiusure di cassa: una per giorno, con atteso (calcolato dagli incassi del giorno) e contato, differenza, note, foto facoltativa.
//  - L'atteso e' una FOTOGRAFIA presa al salvataggio: se poi si corregge un incasso, la chiusura gia' archiviata non cambia da sola (si ricalcola solo a richiesta).
//  - Una chiusura bloccata si puo' solo sbloccare (amministratore, con motivo). Ogni passaggio e' nel Registro.
//  - Si possono caricare anche chiusure di giorni passati (marcate "retroattiva": nel Registro resta la data vera di inserimento).
import { db } from './dbref.mjs';
import { toResponse } from './errori.mjs';
import { HttpError, money, localDate } from './logic.mjs';
import { writeAudit, AUDIT_TYPES } from './audit.mjs';

AUDIT_TYPES.push('chiusura cassa');
export const CLOSING_TABLES = ['cash_closings'];

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const MAX_PHOTO = 1_500_000;

/** In quale "cassetto" va un metodo di pagamento: contanti (nel cassetto), POS (carta/bancomat) o altro (bonifico, buono...). */
export function bucketOf(method) {
  const m = String(method || '').toLowerCase();
  if (/contant/.test(m)) return 'cash';
  if (/carta|pos|bancomat|visa|mastercard|maestro|credito|debito/.test(m)) return 'pos';
  return 'other';
}

/** Incassi e uscite in contanti del giorno (dalla tabella payments e dalle spese pagate dalla cassa). */
export async function expectedFor(day) {
  const rows = await db.prepare('SELECT method, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) = ? GROUP BY method').all(day);
  const e = { cash: 0, pos: 0, other: 0, n: 0, by_method: rows };
  for (const r of rows) { e[bucketOf(r.method)] += r.total; e.n += r.n; }
  // spese in contanti pagate dal negozio (non da una persona che poi si fa rimborsare): escono dal cassetto
  const out = await db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE spent_on = ? AND lower(method) LIKE 'contant%' AND (paid_by IS NULL OR paid_by = '')").get(day);
  return { exp_cash: money(e.cash), exp_pos: money(e.pos), exp_other: money(e.other), cash_out: money(out.t), n_payments: e.n, by_method: rows };
}

const sums = (c) => {
  const expected_total = money(c.float_amount + c.exp_cash - c.cash_out + c.exp_pos + c.exp_other);
  const counted_total = money(c.cnt_cash + c.cnt_pos + c.cnt_other);
  return { expected_total, counted_total, difference: money(counted_total - expected_total) };
};
/** Differenze per cassetto (una differenza in contanti puo' nascondersi dietro una opposta sul POS). */
export const channelDiffs = (c) => ({
  cash: money(c.cnt_cash - (c.float_amount + c.exp_cash - c.cash_out)),
  pos: money(c.cnt_pos - c.exp_pos),
  other: money(c.cnt_other - c.exp_other),
});
const decorate = (c) => (c ? { ...c, locked: !!c.locked, retro: !!c.retro, has_photo: !!c.photo_key, channel_diffs: channelDiffs(c), exp_cash_drawer: money(c.float_amount + c.exp_cash - c.cash_out) } : c);
const who = (user) => user?.name || user?.email || 'locale';
const dayOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

function readAmounts(b, base = {}) {
  const out = {};
  for (const [k, label] of [['float_amount', 'Fondo cassa'], ['cnt_cash', 'Contanti contati'], ['cnt_pos', 'POS contato'], ['cnt_other', 'Altro contato']]) {
    const v = k in b ? num(b[k], NaN) : (base[k] ?? 0);
    if (!Number.isFinite(v) || v < 0 || v > 10_000_000) throw new HttpError(400, `${label}: importo non valido`);
    out[k] = money(v);
  }
  return out;
}

const FIELD_LABELS = { operator: 'operatore', float_amount: 'fondo', cnt_cash: 'contanti', cnt_pos: 'POS', cnt_other: 'altro', notes: 'note', exp_cash: 'atteso contanti', exp_pos: 'atteso POS', exp_other: 'atteso altro', cash_out: 'uscite contanti', difference: 'differenza' };
const eur = (n) => `${Number(n).toFixed(2)} €`;
const changes = (a, b) => Object.keys(FIELD_LABELS).filter((k) => (a[k] ?? null) !== (b[k] ?? null)).map((k) => `${FIELD_LABELS[k]}: ${typeof a[k] === 'number' ? eur(a[k]) : a[k] ?? '—'} → ${typeof b[k] === 'number' ? eur(b[k]) : b[k] ?? '—'}`).join('; ');

export async function getClosing(id) {
  const c = await db.prepare('SELECT * FROM cash_closings WHERE id = ?').get(id);
  if (!c) throw new HttpError(404, 'Chiusura non trovata');
  return c;
}

export async function previewClosing(day) {
  const d = str(day) || localDate();
  if (!dayOk(d)) throw new HttpError(400, 'Data non valida');
  const existing = await db.prepare('SELECT * FROM cash_closings WHERE day = ?').get(d);
  return { day: d, today: localDate(), expected: await expectedFor(d), existing: decorate(existing) || null };
}

export async function createClosing(b, user) {
  const day = str(b.day) || localDate();
  if (!dayOk(day)) throw new HttpError(400, 'Data non valida');
  if (day > localDate()) throw new HttpError(400, 'La data non può essere nel futuro.');
  const operator = str(b.operator) || who(user);
  if (await db.prepare('SELECT id FROM cash_closings WHERE day = ?').get(day)) throw new HttpError(409, `Esiste già una chiusura per il ${day}: aprila e modificala.`);
  const a = readAmounts(b);
  const exp = await expectedFor(day);
  const row = { ...a, exp_cash: exp.exp_cash, exp_pos: exp.exp_pos, exp_other: exp.exp_other, cash_out: exp.cash_out };
  const s = sums(row);
  const retro = day < localDate() ? 1 : 0;
  const locked = b.lock ? 1 : 0;
  const r = await db.prepare(`INSERT INTO cash_closings (day, operator, float_amount, exp_cash, exp_pos, exp_other, cash_out, cnt_cash, cnt_pos, cnt_other, expected_total, counted_total, difference, notes, retro, locked, locked_at, locked_by, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${locked ? NOW : 'NULL'},?,${NOW},?)`)
    .run(day, operator, a.float_amount, row.exp_cash, row.exp_pos, row.exp_other, row.cash_out, a.cnt_cash, a.cnt_pos, a.cnt_other, s.expected_total, s.counted_total, s.difference, str(b.notes), retro, locked, locked ? who(user) : null, who(user));
  const c = await getClosing(r.lastInsertRowid);
  await writeAudit({ user, action: 'crea', type: 'chiusura cassa', id: c.id, label: `Chiusura del ${day}`, detail: `${retro ? 'RETROATTIVA · ' : ''}atteso ${eur(c.expected_total)}, contato ${eur(c.counted_total)}, differenza ${eur(c.difference)}${locked ? ' · bloccata' : ''}` });
  return decorate(c);
}

export async function updateClosing(id, b, user) {
  const old = await getClosing(id);
  if (old.locked) throw new HttpError(409, 'Chiusura bloccata: per modificarla un amministratore deve prima sbloccarla (con il motivo).');
  const a = readAmounts(b, old);
  let exp = { exp_cash: old.exp_cash, exp_pos: old.exp_pos, exp_other: old.exp_other, cash_out: old.cash_out };
  if (b.recalc) exp = await expectedFor(old.day);
  const row = { ...a, exp_cash: exp.exp_cash, exp_pos: exp.exp_pos, exp_other: exp.exp_other, cash_out: exp.cash_out };
  const s = sums(row);
  const operator = str(b.operator) || old.operator;
  const next = { ...row, ...s, operator, notes: 'notes' in b ? str(b.notes) : old.notes };
  const diff = changes(old, next);
  if (!diff) return decorate(old);
  await db.prepare(`UPDATE cash_closings SET operator=?, float_amount=?, exp_cash=?, exp_pos=?, exp_other=?, cash_out=?, cnt_cash=?, cnt_pos=?, cnt_other=?, expected_total=?, counted_total=?, difference=?, notes=?, updated_at=${NOW}, updated_by=? WHERE id=?`)
    .run(operator, a.float_amount, row.exp_cash, row.exp_pos, row.exp_other, row.cash_out, a.cnt_cash, a.cnt_pos, a.cnt_other, s.expected_total, s.counted_total, s.difference, next.notes, who(user), id);
  await writeAudit({ user, action: 'modifica', type: 'chiusura cassa', id, label: `Chiusura del ${old.day}`, detail: `${b.recalc ? 'atteso ricalcolato · ' : ''}${diff}`.slice(0, 480) });
  return decorate(await getClosing(id));
}

export async function lockClosing(id, user) {
  const c = await getClosing(id);
  if (c.locked) return decorate(c);
  await db.prepare(`UPDATE cash_closings SET locked=1, locked_at=${NOW}, locked_by=? WHERE id=?`).run(who(user), id);
  await writeAudit({ user, action: 'modifica', type: 'chiusura cassa', id, label: `Chiusura del ${c.day}`, detail: 'bloccata' });
  return decorate(await getClosing(id));
}

export async function unlockClosing(id, reason, user) {
  const c = await getClosing(id);
  const why = str(reason);
  if (!why || why.length < 3) throw new HttpError(400, 'Scrivi il motivo dello sblocco.');
  if (!c.locked) return decorate(c);
  await db.prepare('UPDATE cash_closings SET locked=0, locked_at=NULL, locked_by=NULL WHERE id=?').run(id);
  await writeAudit({ user, action: 'modifica', type: 'chiusura cassa', id, label: `Chiusura del ${c.day}`, detail: `sbloccata. Motivo: ${why}`.slice(0, 480) });
  return decorate(await getClosing(id));
}

export async function deleteClosing(id, user, media) {
  const c = await getClosing(id);
  if (c.locked) throw new HttpError(409, 'Chiusura bloccata: sbloccala prima di eliminarla.');
  if (c.photo_key) await media?.remove(c.photo_key).catch(() => {});
  await db.prepare('DELETE FROM cash_closings WHERE id = ?').run(id);
  await writeAudit({ user, action: 'elimina', type: 'chiusura cassa', id, label: `Chiusura del ${c.day}`, detail: `eliminata: atteso ${eur(c.expected_total)}, contato ${eur(c.counted_total)}, differenza ${eur(c.difference)}, operatore ${c.operator}` });
  return { ok: true };
}

const b64ToBytes = (s) => Uint8Array.from(atob(String(s).replace(/^data:[^,]*,/, '')), (ch) => ch.charCodeAt(0));
const isJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8;

export async function setPhoto(id, image, user, media) {
  const c = await getClosing(id);
  if (c.locked) throw new HttpError(409, 'Chiusura bloccata: sbloccala per cambiare la foto.');
  let bytes;
  try { bytes = b64ToBytes(image || ''); } catch { throw new HttpError(400, 'Foto non valida'); }
  if (!isJpeg(bytes)) throw new HttpError(400, 'La foto deve essere un JPEG');
  if (bytes.length > MAX_PHOTO) throw new HttpError(413, 'Foto troppo grande: va ridimensionata prima dell’invio');
  const key = `chiusure/${c.day}-${id}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await media.put(key, bytes);
  if (c.photo_key) await media.remove(c.photo_key).catch(() => {});
  await db.prepare(`UPDATE cash_closings SET photo_key=?, updated_at=${NOW}, updated_by=? WHERE id=?`).run(key, who(user), id);
  await writeAudit({ user, action: 'modifica', type: 'chiusura cassa', id, label: `Chiusura del ${c.day}`, detail: c.photo_key ? 'foto sostituita' : 'foto allegata' });
  return decorate(await getClosing(id));
}

export async function removePhoto(id, user, media) {
  const c = await getClosing(id);
  if (c.locked) throw new HttpError(409, 'Chiusura bloccata: sbloccala per togliere la foto.');
  if (!c.photo_key) return decorate(c);
  await media.remove(c.photo_key).catch(() => {});
  await db.prepare(`UPDATE cash_closings SET photo_key=NULL, updated_at=${NOW}, updated_by=? WHERE id=?`).run(who(user), id);
  await writeAudit({ user, action: 'modifica', type: 'chiusura cassa', id, label: `Chiusura del ${c.day}`, detail: 'foto tolta' });
  return decorate(await getClosing(id));
}

export async function listClosings({ from, to, q, only_diff } = {}) {
  const f = str(from) || '0000-01-01';
  const t = str(to) || '9999-12-31';
  if (!dayOk(f === '0000-01-01' ? '2000-01-01' : f) || !dayOk(t === '9999-12-31' ? '2000-01-01' : t)) throw new HttpError(400, 'Periodo non valido');
  const where = ['day BETWEEN ? AND ?'];
  const args = [f, t];
  if (str(q)) { where.push('(operator LIKE ? OR notes LIKE ? OR day LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (only_diff === '1' || only_diff === true) where.push('ABS(difference) >= 0.01');
  const rows = (await db.prepare(`SELECT * FROM cash_closings WHERE ${where.join(' AND ')} ORDER BY day DESC LIMIT 1000`).all(...args)).map(decorate);
  const months = new Map();
  const tot = { n: 0, expected: 0, counted: 0, difference: 0, abs_difference: 0, with_diff: 0, cash: 0, pos: 0, other: 0 };
  for (const r of rows) {
    const k = r.day.slice(0, 7);
    const m = months.get(k) || { month: k, n: 0, expected: 0, counted: 0, difference: 0, abs_difference: 0, with_diff: 0, cash: 0, pos: 0, other: 0 };
    for (const g of [m, tot]) {
      g.n += 1; g.expected += r.expected_total; g.counted += r.counted_total; g.difference += r.difference; g.abs_difference += Math.abs(r.difference);
      if (Math.abs(r.difference) >= 0.01) g.with_diff += 1;
      g.cash += r.cnt_cash; g.pos += r.cnt_pos; g.other += r.cnt_other;
    }
    months.set(k, m);
  }
  const fix = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, typeof v === 'number' && !['n', 'with_diff'].includes(k) ? money(v) : v]));
  return { from: f === '0000-01-01' ? null : f, to: t === '9999-12-31' ? null : t, rows, totals: fix(tot), by_month: [...months.values()].map(fix) };
}

const csvCell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const it = (n) => Number(n).toFixed(2).replace('.', ',');
export function closingsCsv(rows) {
  const head = ['Data', 'Operatore', 'Fondo cassa', 'Incassi contanti', 'Incassi POS', 'Incassi altro', 'Uscite contanti', 'Atteso totale', 'Contato contanti', 'Contato POS', 'Contato altro', 'Contato totale', 'Differenza', 'Bloccata', 'Retroattiva', 'Foto', 'Note'];
  const lines = [head.join(';')];
  for (const r of [...rows].reverse()) {
    lines.push([r.day, r.operator, it(r.float_amount), it(r.exp_cash), it(r.exp_pos), it(r.exp_other), it(r.cash_out), it(r.expected_total), it(r.cnt_cash), it(r.cnt_pos), it(r.cnt_other), it(r.counted_total), it(r.difference), r.locked ? 'sì' : 'no', r.retro ? 'sì' : 'no', r.has_photo ? 'sì' : 'no', r.notes || ''].map(csvCell).join(';'));
  }
  return `﻿${lines.join('\r\n')}\r\n`; // BOM: Excel riconosce gli accenti
}

/** Rotte /api/closings. deps: { adminOnly, media:(c)=>archivio } */
export function registerClosingRoutes(app, h, { adminOnly, media }) {
  const ensureMedia = (c) => { const m = media(c); if (!m || m.mode === 'missing') throw new HttpError(503, 'Archivio foto non collegato: la chiusura si salva lo stesso, senza foto.'); return m; };
  app.get('/api/closings', h((req) => listClosings(req.query)));
  app.get('/api/closings/preview', h((req) => previewClosing(req.query.day)));
  app.get('/api/closings/export.csv', async (c) => {
    try {
      const d = await listClosings(c.req.query());
      return c.body(closingsCsv(d.rows), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="chiusure-cassa-${d.from || 'inizio'}_${d.to || localDate()}.csv"`, 'cache-control': 'no-store' });
    } catch (e) { return c.json({ ok: false, error: e.status ? e.message : 'Esportazione non riuscita' }, e.status || 500); }
  });
  app.get('/api/closings/:id{-?[0-9]+}', h(async (req) => decorate(await getClosing(req.params.id))));
  app.post('/api/closings', h((req) => createClosing(req.body, req.user)));
  app.put('/api/closings/:id{-?[0-9]+}', h((req) => updateClosing(req.params.id, req.body, req.user)));
  app.post('/api/closings/:id{-?[0-9]+}/lock', h((req) => lockClosing(req.params.id, req.user)));
  app.post('/api/closings/:id{-?[0-9]+}/unlock', h((req) => { adminOnly(req); return unlockClosing(req.params.id, req.body.reason, req.user); }));
  app.delete('/api/closings/:id{-?[0-9]+}', h((req) => { adminOnly(req); return deleteClosing(req.params.id, req.user, media(req.c)); }));
  app.post('/api/closings/:id{-?[0-9]+}/photo', h((req) => setPhoto(req.params.id, req.body.image, req.user, ensureMedia(req.c))));
  app.delete('/api/closings/:id{-?[0-9]+}/photo', h((req) => removePhoto(req.params.id, req.user, media(req.c))));
  app.get('/api/closings/:id{-?[0-9]+}/photo', async (c) => {
    try {
      const row = await getClosing(c.req.param('id'));
      if (!row.photo_key) return c.text('Nessuna foto', 404);
      const o = await media(c).get(row.photo_key);
      if (!o) return c.text('Foto non trovata', 404);
      return c.body(o.bytes, 200, { 'content-type': o.contentType, 'cache-control': 'private, max-age=600' });
    } catch (e) { const r = toResponse(e, { method: 'GET', path: `/api/closings/${c.req.param('id')}/photo`, id: c.req.param('id') }); return c.text([r.body.error, r.body.hint].filter(Boolean).join('\n'), r.status); }
  });
}
