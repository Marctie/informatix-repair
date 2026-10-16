// Preventivo a distanza (dal link del cliente) e destino del dispositivo non riparato.
//  - Il cliente conferma, sceglie fra le opzioni o rifiuta; in ogni caso FIRMA. Si registrano data, ora, IP e il testo firmato.
//  - Rifiuto: sceglie se ritirare il dispositivo (giacenza, N giorni poi deposito a pagamento) o cederlo al negozio.
//  - Per le riparazioni "annullate / non riparabili" si tiene il destino del dispositivo e il conto dei giorni di giacenza.
import { db, tx, getSettings, nowLocal } from './dbref.mjs';
import { HttpError, logEvent, publicView, localDate } from './logic.mjs';
import { addSignature, cleanImage, clientIp } from './signatures.mjs';
import { fillText, quoteVars, storageDays, storageFee } from './legal.mjs';

const str = (v) => (v == null ? null : String(v).trim() || null);
const money = (v) => Math.round(Number(v) * 100) / 100;

// ---------- Opzioni di preventivo (facoltative) ----------
export const listOptions = (repairId) => db.prepare('SELECT * FROM quote_options WHERE repair_id = ? ORDER BY sort, id').all(repairId);

export async function addOption(repairId, b) {
  const r = await db.prepare('SELECT status, quote_decision FROM repairs WHERE id = ?').get(repairId);
  if (!r) throw new HttpError(404, 'Riparazione non trovata', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Riapri l’elenco delle riparazioni.' });
  if (['delivered', 'cancelled'].includes(r.status)) throw new HttpError(409, `La riparazione è già conclusa (${r.status === 'delivered' ? 'consegnata' : 'annullata'}): non accetta più opzioni di preventivo.`, { code: 'RIPARAZIONE_CONCLUSA', hint: 'Le opzioni si gestiscono solo mentre la riparazione è in corso.' });
  const label = str(b.label);
  const amount = Number(String(b.amount ?? '').replace(',', '.'));
  if (!label) throw new HttpError(400, 'Opzione di preventivo non salvata: manca la descrizione di cosa comprende.', { code: 'OPZIONE_DESCRIZIONE_MANCANTE', hint: 'Scrivi cosa comprende la soluzione.' });
  if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, 'Opzione di preventivo non salvata: l’importo non è valido (non numerico o negativo).', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi l’importo in euro.' });
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM quote_options WHERE repair_id = ?').get(repairId)).n;
  if (n >= 6) throw new HttpError(400, 'Opzione non aggiunta: questa riparazione ha già 6 opzioni, il massimo.', { code: 'TROPPE_OPZIONI', hint: 'Elimina un’opzione prima di aggiungerne un’altra.' });
  await db.prepare('INSERT INTO quote_options (repair_id, label, amount, description, sort) VALUES (?,?,?,?,?)').run(repairId, label.slice(0, 120), money(amount), str(b.description)?.slice(0, 300) || null, n);
  return listOptions(repairId);
}

export async function removeOption(repairId, optionId) {
  const r = await db.prepare('DELETE FROM quote_options WHERE id = ? AND repair_id = ?').run(optionId, repairId);
  if (!r.changes) throw new HttpError(404, 'L’opzione di preventivo indicata non esiste più.', { code: 'OPZIONE_NON_TROVATA', hint: 'Ricarica la pagina per vedere le opzioni attuali.' });
  return listOptions(repairId);
}

// ---------- Risposta del cliente al preventivo (con firma) ----------
export async function customerDecision(token, b, c) {
  const r = await db.prepare('SELECT * FROM repairs WHERE token = ?').get(token);
  if (!r) throw new HttpError(404, 'Riparazione non trovata', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Riapri l’elenco delle riparazioni.' });
  if (r.status !== 'quote_pending') throw new HttpError(409, 'Per questa riparazione non c’è nessun preventivo in attesa della tua risposta.', { code: 'PREVENTIVO_NON_IN_ATTESA', hint: 'Contatta il negozio se pensi sia un errore.' });
  const options = await listOptions(r.id);
  const action = String(b.action || '');
  if (!['accept', 'option', 'decline'].includes(action)) throw new HttpError(400, 'La risposta ricevuta non è valida.', { code: 'SCELTA_NON_VALIDA', hint: 'Premi uno dei pulsanti proposti.' });
  cleanImage(b.image); // la firma e' obbligatoria in ogni caso
  const s = await getSettings();
  const ip = clientIp(c) || 'non rilevato';
  const name = str(b.signer_name) || null;

  if (action === 'decline') {
    const choice = b.device_choice;
    if (!['pickup', 'cede'].includes(choice)) throw new HttpError(400, 'Rifiuto non registrato: non è indicato cosa fare del dispositivo.', { code: 'DESTINO_DISPOSITIVO_MANCANTE', hint: 'Scegli se ritirare il dispositivo o cederlo al negozio.' });
    const v = quoteVars(s, r);
    const shown = `${fillText(s.quote_decline_text, v)}\n${fillText(choice === 'cede' ? s.quote_decline_cede : s.quote_decline_pickup, v)}\n${s.quote_sign_text}`;
    await tx(async () => {
      await db.prepare("UPDATE repairs SET status='cancelled', quote_decision='declined', quote_decided_at=datetime('now','localtime'), device_fate=?, fate_since=datetime('now','localtime') WHERE id=?").run(choice === 'cede' ? 'ceduto' : 'giacenza', r.id);
      await addSignature(r.id, { kind: 'quote_decline', image: b.image, signer_name: name, choice, text_shown: shown, via: 'link', c });
      await logEvent(r.id, 'cancelled', choice === 'cede'
        ? 'Il cliente ha rifiutato il preventivo e ceduto il dispositivo al negozio (firmato dal link).'
        : `Il cliente ha rifiutato il preventivo e ritirerà il dispositivo non riparato entro ${storageDays(s)} giorni (firmato dal link).`, 1);
      await logEvent(r.id, null, `Rifiuto del preventivo firmato da link: IP ${ip}.`, 0);
    });
    return publicView(token);
  }

  // conferma (con o senza opzioni)
  let opt = null;
  if (options.length) {
    if (action !== 'option') throw new HttpError(400, 'Risposta non registrata: non è stata scelta una delle soluzioni proposte.', { code: 'OPZIONE_NON_SCELTA', hint: 'Scegli una soluzione dall’elenco.' });
    opt = options.find((o) => String(o.id) === String(b.option_id));
    if (!opt) throw new HttpError(400, 'La soluzione scelta non fa parte di quelle proposte per questa riparazione.', { code: 'OPZIONE_NON_VALIDA', hint: 'Ricarica la pagina e scegli di nuovo.' });
  } else {
    if (action !== 'accept') throw new HttpError(400, 'La risposta ricevuta non è valida.', { code: 'SCELTA_NON_VALIDA', hint: 'Premi uno dei pulsanti proposti.' });
    if (r.quote == null) throw new HttpError(409, 'Per questa riparazione non c’è nessun preventivo in attesa della tua risposta.', { code: 'PREVENTIVO_NON_IN_ATTESA', hint: 'Contatta il negozio se pensi sia un errore.' });
  }
  const amount = opt ? opt.amount : r.quote;
  const shown = `${fillText(s.quote_accept_text, quoteVars(s, r, amount))}${opt ? `\nSoluzione scelta: ${opt.label} (${opt.amount.toFixed(2)} €).` : ''}\n${s.quote_sign_text}`;
  await tx(async () => {
    await db.prepare("UPDATE repairs SET status='approved', quote_decision='accepted', quote_decided_at=datetime('now','localtime'), quote = ?, quote_option_id = ? WHERE id=?").run(amount, opt ? opt.id : null, r.id);
    await addSignature(r.id, { kind: 'quote_accept', image: b.image, signer_name: name, choice: opt ? 'option' : 'accept', option_id: opt ? opt.id : null, text_shown: shown, via: 'link', c });
    await logEvent(r.id, 'approved', opt ? `Preventivo approvato dal cliente online: ${opt.label} (${opt.amount.toFixed(2)} €), firmato.` : 'Preventivo approvato dal cliente online (firmato).', 1);
    await logEvent(r.id, null, `Conferma del preventivo firmata da link: IP ${ip}.`, 0);
  });
  return publicView(token);
}

// ---------- Destino del dispositivo non riparato ----------
export const FATES = { giacenza: 'In giacenza (attende il ritiro)', ritirato: 'Ritirato dal cliente', ceduto: 'Lasciato da smaltire / per pezzi di ricambio', deposito: 'In deposito a pagamento', smaltito: 'Smaltito / recuperato' };

export async function setFate(repairId, { fate, note } = {}, { resetCount = false } = {}) {
  if (!FATES[fate]) throw new HttpError(400, 'Il destino indicato per il dispositivo non è tra quelli previsti.', { code: 'DESTINO_NON_VALIDO', hint: 'Scegli ritiro o cessione.' });
  const r = await db.prepare('SELECT status, device_fate, fate_since FROM repairs WHERE id = ?').get(repairId);
  if (!r) throw new HttpError(404, 'Riparazione non trovata', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Riapri l’elenco delle riparazioni.' });
  if (r.status !== 'cancelled') throw new HttpError(409, 'Il destino del dispositivo si registra solo per le riparazioni annullate o non riparabili: questa non lo è.', { code: 'RIPARAZIONE_NON_ANNULLATA', hint: 'Annulla prima la riparazione se il dispositivo non è riparabile.' });
  // i 15 giorni partono dal rifiuto/annullamento: restano quelli esistenti salvo nuovo conteggio richiesto
  const since = fate === 'giacenza' && (resetCount || !r.fate_since) ? nowLocal() : r.fate_since || nowLocal();
  await tx(async () => {
    await db.prepare('UPDATE repairs SET device_fate = ?, fate_since = ?, fate_note = ? WHERE id = ?').run(fate, since, str(note), repairId);
    await logEvent(repairId, null, `Destino del dispositivo: ${FATES[fate]}${str(note) ? ` (${str(note)})` : ''}.`, 0);
  });
  return db.prepare('SELECT device_fate, fate_since, fate_note FROM repairs WHERE id = ?').get(repairId);
}

/** Dopo il passaggio a "non riparabile": registra subito dove si trova il dispositivo (predefinito: in giacenza). */
export async function markUnrepairable(repairId, { fate, note } = {}) {
  const r = await db.prepare('SELECT device_fate, fate_since FROM repairs WHERE id = ?').get(repairId);
  if (!r) return null;
  await db.prepare('UPDATE repairs SET fate_since = ? WHERE id = ?').run(nowLocal(), repairId); // il conteggio parte da adesso
  return setFate(repairId, { fate: FATES[fate] ? fate : 'giacenza', note });
}

const daysSince = (ts) => {
  if (!ts) return null;
  const a = new Date(`${String(ts).slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${localDate()}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
};

/** Dispositivi non riparati ancora in negozio, con giorni passati e giorni rimasti. */
export async function storageList() {
  const s = await getSettings();
  const total = storageDays(s);
  const rows = await db.prepare(`SELECT r.id, r.code, r.brand_model, r.device_fate, r.fate_since, r.fate_note, r.updated_at, c.name AS customer_name, c.phone AS customer_phone
    FROM repairs r JOIN customers c ON c.id = r.customer_id
    WHERE r.status = 'cancelled' AND (r.device_fate IN ('giacenza','deposito') OR r.device_fate IS NULL) ORDER BY r.fate_since, r.id`).all();
  const out = [];
  for (const r of rows) {
    const el = daysSince(r.fate_since || r.updated_at);
    // riparazioni annullate prima di questa funzione, senza destino: si segnalano solo se recenti
    if (!r.device_fate && (el == null || el > 60)) continue;
    out.push({ ...r, days_in_store: el, days_total: total, days_left: r.device_fate === 'giacenza' && el != null ? total - el : null, due: r.device_fate === 'giacenza' && el != null && el >= total, unknown: !r.device_fate });
  }
  return out;
}

/** Avvisi per la campanella e per Oggi. */
export async function storageAlerts() {
  const out = [];
  for (const x of await storageList()) {
    const who = `${x.customer_name} · ${x.code}`;
    if (x.unknown) out.push({ type: 'fate_unknown', severity: 'low', title: `${x.brand_model}: non riparabile, dov’è il dispositivo?`, detail: `${who}. Registra se è stato ritirato, è in giacenza o va smaltito.`, link: `#/riparazioni?status=cancelled`, ref: x.id });
    else if (x.due) out.push({ type: 'storage_due', severity: 'high', title: `${x.brand_model}: giacenza scaduta da ${x.days_in_store - x.days_total} giorni`, detail: `${who}. Passati ${x.days_in_store} giorni: smaltirlo o spostarlo in deposito a pagamento. Avvisa il cliente.`, link: `#/riparazioni?status=cancelled`, ref: x.id });
    else if (x.days_left != null && x.days_left <= 3) out.push({ type: 'storage_soon', severity: 'medium', title: `${x.brand_model}: giacenza in scadenza`, detail: `${who}. Mancano ${x.days_left} ${x.days_left === 1 ? 'giorno' : 'giorni'} ai ${x.days_total} di giacenza.`, link: `#/riparazioni?status=cancelled`, ref: x.id });
  }
  return out;
}

/** Riepilogo giornaliero per Telegram (solo se c'e' qualcosa da fare). */
export async function storageDigest() {
  const due = (await storageList()).filter((x) => x.due);
  if (!due.length) return null;
  const fee = storageFee(await getSettings());
  return `📦 <b>Dispositivi non riparati: giacenza scaduta</b>\n${due.map((x) => `• ${x.brand_model} · ${x.customer_name} (${x.code}): ${x.days_in_store} giorni`).join('\n')}\nDa smaltire oppure spostare in deposito a pagamento (${fee}). Avvisa i clienti.`;
}
