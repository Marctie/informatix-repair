// Inserimento retroattivo: vendite, riparazioni, acconti, consegne e spese con data passata.
// Si manda `entry_date` (AAAA-MM-GG, oppure AAAA-MM-GG HH:MM) insieme alla richiesta normale: l'operazione si esegue come sempre
// e poi le righe appena create (incassi, vendita, riparazione, cronologia, movimenti di magazzino) prendono quella data, cosi' i report
// per periodo la rispettano. Ogni uso finisce nel Registro (tipo "retroattivo") con chi l'ha fatto, quando e la data scelta.
// La data si puo' anche correggere dopo (solo amministratore): POST /api/retro/date. Mai date future.
import { db, nowLocal } from './dbref.mjs';
import { writeAudit } from './audit.mjs';
import { HttpError } from './logic.mjs';
import { isCassa } from './roles.mjs';

/** Giorni indietro consentiti al ruolo Cassa per la data di inserimento di una riparazione. */
export const CASSA_MAX_DAYS = 7;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

/** Normalizza in 'AAAA-MM-GG HH:MM:SS' (senza ora: 12:00). Errore se non valida, troppo vecchia o nel futuro. */
export function parseEntryDate(v, now = nowLocal()) {
  const s = String(v ?? '').trim();
  const m = DATE_RE.exec(s);
  if (!m) throw new HttpError(400, 'Data di inserimento non valida: non riesco a leggerla.', { code: 'DATA_NON_VALIDA', hint: 'Usa il formato AAAA-MM-GG, con l’ora se vuoi (AAAA-MM-GG HH:MM).' });
  const [, y, mo, d, hh = '12', mm = '00'] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(d) || Number(hh) > 23 || Number(mm) > 59) throw new HttpError(400, 'Data di inserimento non valida: quel giorno o quell’ora non esistono.', { code: 'DATA_NON_VALIDA', hint: 'Controlla giorno, mese e ora.' });
  if (Number(y) < 2000) throw new HttpError(400, 'Data di inserimento troppo vecchia (prima del 2000).', { code: 'DATA_TROPPO_VECCHIA', hint: 'Controlla l’anno.' });
  const out = `${y}-${mo}-${d} ${hh}:${mm}:00`;
  if (out > now) throw new HttpError(400, 'La data di inserimento non può essere nel futuro.', { code: 'DATA_FUTURA', hint: 'Scegli adesso o un momento già passato.' });
  return out;
}

// percorsi che accettano entry_date: [metodo, espressione, cosa e']
const TARGETS = [
  ['POST', /^\/api\/sales$/, 'vendita'],
  ['POST', /^\/api\/repairs$/, 'riparazione'],
  ['POST', /^\/api\/repairs\/(\d+)\/deposit$/, 'acconto'],
  ['POST', /^\/api\/repairs\/(\d+)\/deliver$/, 'consegna'],
  ['POST', /^\/api\/repairs\/(\d+)\/advance$/, 'consegna'],
  ['POST', /^\/api\/expenses$/, 'spesa'],
];

const maxId = async (table) => (await db.prepare(`SELECT COALESCE(MAX(id),0) AS m FROM ${table}`).get()).m;

// una richiesta retroattiva alla volta: cosi' le righe "nuove" sono sicuramente le sue
let chain = Promise.resolve();
const exclusive = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

export const retroMiddleware = async (c, next) => {
  const method = c.req.method;
  if (method !== 'POST') return next();
  const target = TARGETS.find(([mt, re]) => mt === method && re.test(c.req.path));
  if (!target) return next();
  const body = await c.req.raw.clone().json().catch(() => null);
  if (!body || body.entry_date == null || String(body.entry_date).trim() === '') return next();
  const [, re, what] = target;
  const cassa = isCassa(c.get('user'));
  // Cassa: solo la data di inserimento di una NUOVA riparazione, fino a CASSA_MAX_DAYS giorni indietro (il resto: amministratore)
  if (cassa && what !== 'riparazione') return c.json({ ok: false, error: 'Il ruolo Cassa non può inserire operazioni con data passata.', code: 'RUOLO_NON_AUTORIZZATO', hint: 'Chiedi a un amministratore di inserire l’operazione con la data corretta.' }, 403);

  let when;
  try { when = parseEntryDate(body.entry_date); } catch (e) { return c.json({ ok: false, error: e.message, code: e.code || 'DATA_NON_VALIDA', hint: e.hint || 'Indica una data che esiste e non è nel futuro.' }, e.status || 400); }
  const now = nowLocal();
  const withTime = /[ T]\d{2}:\d{2}$/.test(String(body.entry_date).trim());
  if (cassa) {
    const lim = new Date(Date.now() - CASSA_MAX_DAYS * 86400000);
    const limStr = new Date(lim.getTime() - lim.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (when.slice(0, 10) < limStr) return c.json({ ok: false, error: `Il ruolo Cassa può mettere una data di inserimento fino a ${CASSA_MAX_DAYS} giorni indietro.`, code: 'DATA_TROPPO_VECCHIA', hint: 'Per una data più vecchia chiedi a un amministratore.' }, 403);
  }
  if (when.slice(0, 10) === now.slice(0, 10) && !withTime) return next(); // oggi senza ora: niente da fare

  // le spese hanno gia' la loro data: si controlla solo che coincida e si registra l'uso
  if (what === 'spesa') {
    await next();
    if (c.res.status < 400) await note(c, 'spesa', null, `spesa con data ${when.slice(0, 10)}`);
    return;
  }

  return exclusive(async () => {
    const marks = {};
    for (const t of ['payments', 'sales', 'repairs', 'repair_events', 'stock_moves']) marks[t] = await maxId(t);
    await next();
    if (c.res.status >= 400) return;
    const repairId = (re.exec(c.req.path) || [])[1];
    await db.prepare('UPDATE payments SET created_at = ? WHERE id > ?').run(when, marks.payments);
    await db.prepare('UPDATE sales SET created_at = ? WHERE id > ?').run(when, marks.sales);
    await db.prepare('UPDATE repairs SET created_at = ?, updated_at = ? WHERE id > ?').run(when, when, marks.repairs);
    await db.prepare('UPDATE repair_events SET created_at = ? WHERE id > ?').run(when, marks.repair_events);
    await db.prepare('UPDATE stock_moves SET created_at = ? WHERE id > ?').run(when, marks.stock_moves);
    let ref = repairId || null;
    if (repairId) {
      await db.prepare('UPDATE repairs SET updated_at = ? WHERE id = ?').run(when, repairId);
      if (what === 'consegna') await db.prepare('UPDATE repairs SET delivered_at = ? WHERE id = ? AND delivered_at IS NOT NULL AND delivered_at >= ?').run(when, repairId, `${now.slice(0, 10)} 00:00:00`);
    }
    if (!ref) ref = (await maxId(what === 'vendita' ? 'sales' : 'repairs')) || null;
    await note(c, what, ref, `${what} inserita con data ${when.slice(0, 16)}`);
  });
};

const note = (c, what, id, detail) => writeAudit({ user: c.get('user'), action: 'crea', type: 'retroattivo', id, label: `Inserimento retroattivo: ${what}`, detail });

const KINDS = {
  sale: { table: 'sales', col: 'created_at', label: 'vendita' },
  repair: { table: 'repairs', col: 'created_at', label: 'riparazione' },
  delivery: { table: 'repairs', col: 'delivered_at', label: 'consegna riparazione' },
  payment: { table: 'payments', col: 'created_at', label: 'incasso' },
};

/** POST /api/retro/date { type: sale|repair|delivery|payment, id, date } (solo amministratore). */
export async function changeDate({ type, id, date }, user) {
  const k = KINDS[type];
  if (!k) throw new HttpError(400, 'Tipo non valido (sale, repair, delivery, payment).');
  const when = parseEntryDate(date);
  const row = await db.prepare(`SELECT ${k.col} AS d FROM ${k.table} WHERE id = ?`).get(id);
  if (!row) throw new HttpError(404, 'Registrazione non trovata');
  if (type === 'delivery' && !row.d) throw new HttpError(409, 'La riparazione non è stata consegnata.');
  await db.prepare(`UPDATE ${k.table} SET ${k.col} = ? WHERE id = ?`).run(when, id);
  if (type === 'sale') await db.prepare("UPDATE payments SET created_at = ? WHERE kind = 'sale' AND ref_id = ?").run(when, id);
  await writeAudit({ user, action: 'modifica', type: 'retroattivo', id, label: `Data cambiata: ${k.label} n. ${id}`, detail: `da ${row.d} a ${when.slice(0, 16)}` });
  return { ok: true, id: Number(id), date: when };
}

export function registerRetroRoutes(app, h, adminOnly) {
  app.post('/api/retro/date', h((req) => { adminOnly(req); return changeDate(req.body || {}, req.user); }));
}
