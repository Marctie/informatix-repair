// Firme digitali dei clienti (disegnate su tablet/telefono/mouse) e scheda di ingresso firmata anche a distanza.
// Ogni firma salva: immagine PNG, data e ora, IP e browser (per le firme da link), il TESTO che il cliente aveva davanti
// e chi l'ha raccolta. Non e' una firma elettronica avanzata/qualificata: e' una firma semplice con prova di cosa e quando.
import { db, tx, getSettings, nowLocal } from './dbref.mjs';
import { HttpError, logEvent } from './logic.mjs';
import { fillText } from './legal.mjs';

export const KINDS = { intake: 'Scheda di ingresso', quote_accept: 'Conferma del preventivo', quote_decline: 'Rifiuto del preventivo', disposal: 'Cessione del dispositivo' };
const MAX_IMAGE = 220000; // caratteri del data URL (una firma PNG normale e' 5-30 KB)

/** Controlla che sia un PNG vero (data URL) e di dimensioni ragionevoli. */
export function cleanImage(img) {
  const s = String(img || '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(s)) throw new HttpError(400, 'La firma è obbligatoria: disegnala nel riquadro.');
  if (s.length > MAX_IMAGE) throw new HttpError(400, 'La firma è troppo grande: cancella e rifai.');
  let head = '';
  try { head = atob(s.slice(22, 22 + 12)); } catch { /* base64 non valido */ }
  if (head.charCodeAt(0) !== 0x89 || head.slice(1, 4) !== 'PNG') throw new HttpError(400, 'La firma non è un’immagine valida.');
  return s;
}

/** Indirizzo IP di chi ha fatto la richiesta (Cloudflare, proxy o connessione diretta su Node). */
export const clientIp = (c) =>
  c?.req.header('cf-connecting-ip') || (c?.req.header('x-forwarded-for') || '').split(',')[0].trim() || c?.env?.incoming?.socket?.remoteAddress || '';
const shortUa = (c) => String(c?.req.header('user-agent') || '').slice(0, 200);

export async function addSignature(repairId, { kind, image, signer_name, choice = null, option_id = null, text_shown = '', via = 'banco', c = null, by_user = null }) {
  if (!KINDS[kind]) throw new HttpError(400, 'Tipo di firma non valido');
  const img = cleanImage(image);
  const at = nowLocal();
  const r = await db.prepare('INSERT INTO repair_signatures (repair_id, kind, image, signer_name, choice, option_id, text_shown, via, ip, user_agent, by_user, signed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(repairId, kind, img, String(signer_name ?? '').trim().slice(0, 120) || null, choice, option_id, String(text_shown).slice(0, 4000), via, via === 'link' ? clientIp(c) || null : null, via === 'link' ? shortUa(c) || null : null, by_user, at);
  return { id: Number(r.lastInsertRowid), kind, signed_at: at, via, ip: via === 'link' ? clientIp(c) || null : null };
}

/** Ultima firma (con immagine) di un tipo: serve alla stampa. */
export const lastSignature = (repairId, kind) =>
  db.prepare('SELECT * FROM repair_signatures WHERE repair_id = ? AND kind = ? ORDER BY id DESC LIMIT 1').get(repairId, kind);

export const listSignatures = (repairId) =>
  db.prepare('SELECT id, kind, signer_name, choice, option_id, via, ip, by_user, signed_at FROM repair_signatures WHERE repair_id = ? ORDER BY id').all(repairId);

/** Testo di consenso per la scheda di ingresso, con i dati della riparazione. */
export async function intakeTexts(r, s = null) {
  s = s || (await getSettings());
  const vars = { negozio: s.shop_name, garanzia: r.warranty_days, codice: r.code, dispositivo: r.brand_model };
  return { consent: fillText(s.consent_intake, vars), terms: s.terms };
}
const intakeFull = (t) => `${t.consent}\n\nCondizioni: ${t.terms}`;

async function loadRepair(where, arg) {
  const r = await db.prepare(`SELECT r.*, c.name AS customer_name FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE ${where}`).get(arg);
  if (!r) throw new HttpError(404, 'Riparazione non trovata');
  return r;
}

/** Firma al banco (tablet o mouse del negozio): il cliente firma davanti al personale. */
export async function signIntake(repairId, body, c, user) {
  const r = await loadRepair('r.id = ?', repairId);
  // kind "disposal" = cessione del dispositivo (liberatoria allo smaltimento / pezzi di ricambio) firmata al banco
  const disposal = body.kind === 'disposal';
  if (disposal && r.status !== 'cancelled') throw new HttpError(409, 'La cessione si firma solo per le riparazioni annullate / non riparabili.');
  const s = await getSettings();
  const text = disposal ? fillText(s.quote_decline_cede, { negozio: s.shop_name, codice: r.code, dispositivo: r.brand_model }) : intakeFull(await intakeTexts(r, s));
  const sig = await tx(async () => {
    const x = await addSignature(r.id, { kind: disposal ? 'disposal' : 'intake', image: body.image, signer_name: body.signer_name || r.customer_name, choice: disposal ? 'cede' : null, text_shown: text, via: 'banco', c, by_user: user?.email || user?.name || 'locale' });
    if (!disposal) await db.prepare('UPDATE repairs SET sign_requested = 0 WHERE id = ?').run(r.id);
    await logEvent(r.id, null, disposal ? 'Cessione del dispositivo firmata dal cliente al banco.' : 'Scheda di ingresso firmata dal cliente al banco.', 0);
    return x;
  });
  return sig;
}

/** Il negozio chiede la firma a distanza: il cliente la trova nella pagina del suo link. */
export async function requestSignature(repairId) {
  const r = await loadRepair('r.id = ?', repairId);
  if (await lastSignature(r.id, 'intake')) throw new HttpError(409, 'La scheda di ingresso è già firmata.');
  await tx(async () => {
    await db.prepare('UPDATE repairs SET sign_requested = 1 WHERE id = ?').run(r.id);
    await logEvent(r.id, null, 'Firma a distanza richiesta al cliente (dal suo link).', 0);
  });
  return { ok: true };
}

/** Firma da casa, dal link di tracciamento (token segreto). Registra data, ora e IP. */
export async function signIntakeRemote(token, body, c) {
  const r = await loadRepair('r.token = ?', token);
  if (!r.sign_requested) throw new HttpError(409, 'Nessuna firma richiesta per questa riparazione.');
  if (!body.accept) throw new HttpError(400, 'Per firmare devi accettare le condizioni.');
  if (await lastSignature(r.id, 'intake')) throw new HttpError(409, 'La scheda è già stata firmata.');
  const text = intakeFull(await intakeTexts(r));
  const sig = await tx(async () => {
    const x = await addSignature(r.id, { kind: 'intake', image: body.image, signer_name: body.signer_name || r.customer_name, text_shown: text, via: 'link', c });
    await db.prepare('UPDATE repairs SET sign_requested = 0 WHERE id = ?').run(r.id);
    await logEvent(r.id, null, `Scheda di ingresso firmata dal cliente da link (IP ${x.ip || 'non rilevato'}).`, 1);
    return x;
  });
  return { ok: true, signed_at: sig.signed_at };
}
