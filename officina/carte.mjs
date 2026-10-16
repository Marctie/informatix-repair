// Carta punti NFC protetta contro i trucchi.
//
// Principi (il chip e' solo una "chiave", il valore sta sul server):
//  1. I punti vivono SOLO nel database. Sul chip non c'e' mai un saldo da alterare.
//  2. Il chip e' identificato dall'UID (che si puo' copiare) + un CODICE FIRMATO scritto sul chip: IXC1.<n.carta>.<contatore>.<firma>.
//     La firma e' un HMAC-SHA256 calcolato con un segreto che esiste solo sul server (NFC_SECRET, in mancanza VAULT_KEY): mai nel browser.
//  3. Il codice cambia a ogni uso (contatore a rotazione): una copia del chip vecchia, o il rimando di un codice gia' usato (replay),
//     viene riconosciuta, la carta si BLOCCA e resta tutto scritto nel registro.
//  4. Chi usa un lettore che legge solo l'UID (senza poter scrivere sul chip) non puo' riscattare con il solo UID: serve il PIN della carta.
//  5. Ogni operazione e' solo lato server, con registro (loyalty_events), limiti e blocco dei tentativi ripetuti.
//  6. I punti si accreditano solo da una vendita/riparazione vera (una sola volta per documento, importo calcolato dal server).
//  7. Il riscatto genera un buono regalo (buoni.mjs): entra in cassa come tutti gli altri, niente incassi nascosti.
import { db, tx, getSettings, nowLocal } from './dbref.mjs';
import { HttpError } from './logic.mjs';
import { clientIp } from './signatures.mjs';
import { newVoucherCode } from './buoni.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const enc = new TextEncoder();

export const LOYALTY_TABLES = ['loyalty_cards', 'loyalty_events'];
export const CARD_STATUS = { attiva: 'Attiva', bloccata: 'Bloccata', persa: 'Persa/sostituita', annullata: 'Annullata' };

/** Regole punti (da Impostazioni). I valori predefiniti sono PROVVISORI: il regolamento definitivo lo decide Christian. */
export const LOYALTY_DEFAULTS = {
  loyalty_points_per_euro: '1', loyalty_redeem_step: '100', loyalty_euro_per_step: '5', loyalty_voucher_months: '12',
  loyalty_max_accrual: '2000', loyalty_max_redeem_day: '1000',
};
export const LOYALTY_SETTING_KEYS = Object.keys(LOYALTY_DEFAULTS);
export const LIMITS = { failBlock: 5, opsPerMinute: 40, failsPer10Min: 12, sessionSeconds: 300 };

export async function rules() {
  const s = await getSettings();
  const n = (k) => { const v = Number(String(s[k] ?? '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : Number(LOYALTY_DEFAULTS[k]); };
  return { points_per_euro: n('loyalty_points_per_euro'), redeem_step: Math.round(n('loyalty_redeem_step')), euro_per_step: n('loyalty_euro_per_step'), voucher_months: Math.round(n('loyalty_voucher_months')), max_accrual: Math.round(n('loyalty_max_accrual')), max_redeem_day: Math.round(n('loyalty_max_redeem_day')) };
}
/** Controlla i valori delle regole in arrivo da Impostazioni. */
export function validateLoyaltySettings(b) {
  for (const k of LOYALTY_SETTING_KEYS) {
    if (!(k in b)) continue;
    const v = Number(String(b[k]).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0 || v > 100000) throw new HttpError(400, 'Le regole dei punti non sono valide: ogni valore deve essere un numero maggiore di zero (e ragionevole).', { code: 'REGOLE_PUNTI_NON_VALIDE', hint: 'Correggi i valori nelle impostazioni delle carte punti.' });
  }
}

// ---------- Crittografia ----------
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replaceAll('-', '+').replaceAll('_', '/')), (ch) => ch.charCodeAt(0));
const keyCache = new Map();

/** Segreto delle firme: dal Worker (c.env) o dall'ambiente del PC. Mai dal codice o dal database. */
export function nfcSecret(c) {
  const e = (k) => c?.env?.[k] || (typeof process !== 'undefined' ? process.env?.[k] : '') || '';
  return String(e('NFC_SECRET') || e('VAULT_KEY'));
}
async function hmacKey(c) {
  const secret = nfcSecret(c);
  if (secret.length < 16) throw new HttpError(503, 'Le carte punti non sono utilizzabili: manca la chiave di sicurezza del server (NFC_SECRET o VAULT_KEY, almeno 16 caratteri).', { code: 'CARTE_NON_CONFIGURATE', hint: 'Avvisa l’amministratore: la chiave va impostata sul server (vedi il manuale, sezione Carte punti).' });
  if (!keyCache.has(secret)) keyCache.set(secret, crypto.subtle.importKey('raw', enc.encode(`informatix-nfc-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  return keyCache.get(secret);
}
const sign = async (c, text) => new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(c), enc.encode(text)));
/** Verifica a tempo costante (subtle.verify): niente fughe di informazioni sul confronto. */
async function verify(c, text, macB64) {
  let mac; try { mac = unb64u(macB64); } catch { return false; }
  return crypto.subtle.verify('HMAC', await hmacKey(c), mac, enc.encode(text));
}

const TOKEN_RE = /^IXC1\.([A-Z0-9-]{3,20})\.(\d{1,9})\.([A-Za-z0-9_-]{22})$/;
/** Codice da scrivere sul chip: lega numero carta, UID e contatore. */
export async function makeToken(c, cardNo, uid, counter) {
  const mac = b64u((await sign(c, `v1|${cardNo}|${uid}|${counter}`)).subarray(0, 16)); // 128 bit = 22 caratteri
  return `IXC1.${cardNo}.${counter}.${mac}`;
}
export function parseToken(t) {
  const m = TOKEN_RE.exec(String(t ?? '').trim());
  return m ? { cardNo: m[1], counter: Number(m[2]), mac: m[3] } : null;
}
/** Il codice porta solo i primi 128 bit della firma: si ricalcola e si confronta a tempo costante. */
async function checkToken(c, tok, uid) {
  let given; try { given = unb64u(tok.mac); } catch { return false; }
  const real = (await sign(c, `v1|${tok.cardNo}|${uid}|${tok.counter}`)).subarray(0, 16);
  if (given.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i += 1) diff |= real[i] ^ given[i];
  return diff === 0;
}
const pinMac = async (c, cardNo, pin) => b64u(await sign(c, `pin|${cardNo}|${pin}`));

/** Sessione breve (5 minuti) rilasciata dal server dopo una verifica: dice "questa carta e' stata verificata a questo livello". */
async function makeSession(c, card, level) {
  const body = b64u(enc.encode(JSON.stringify({ c: card.id, l: level, e: Math.floor(Date.now() / 1000) + LIMITS.sessionSeconds, n: card.counter })));
  return `${body}.${b64u(await sign(c, `sid|${body}`))}`;
}
async function readSession(c, sid, cardId) {
  const [body, mac] = String(sid || '').split('.');
  if (!body || !mac || !(await verify(c, `sid|${body}`, mac))) throw new HttpError(401, 'La verifica della carta manca o non è valida: l’operazione non è stata eseguita.', { code: 'CARTA_VERIFICA_NON_VALIDA', hint: 'Avvicina di nuovo la carta al lettore e ripeti l’operazione.' });
  let s; try { s = JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { throw new HttpError(401, 'La verifica della carta è illeggibile: l’operazione non è stata eseguita.', { code: 'CARTA_VERIFICA_NON_VALIDA', hint: 'Avvicina di nuovo la carta al lettore e ripeti l’operazione.' }); }
  if (s.c !== Number(cardId)) throw new HttpError(401, 'La verifica ricevuta appartiene a un’altra carta: l’operazione non è stata eseguita.', { code: 'CARTA_VERIFICA_ALTRA_CARTA', hint: 'Avvicina la carta giusta e ripeti l’operazione.' });
  if (s.e < Math.floor(Date.now() / 1000)) throw new HttpError(401, 'La verifica della carta è scaduta: l’operazione non è stata eseguita.', { code: 'CARTA_VERIFICA_SCADUTA', hint: 'Avvicina di nuovo la carta al lettore e ripeti l’operazione.' });
  return s;
}

// ---------- Utilita' ----------
/** UID in esadecimale maiuscolo senza separatori (4, 7 o 10 byte). Accetta "04:a1:b2:c3" e simili. */
export function normalizeUid(v) {
  const s = String(v ?? '').replace(/[\s:.-]/g, '').toUpperCase();
  if (!/^[0-9A-F]+$/.test(s) || s.length % 2 || s.length < 8 || s.length > 20) throw new HttpError(400, 'UID non valido: il codice del chip deve avere da 4 a 10 byte in esadecimale.', { code: 'UID_NON_VALIDO', hint: 'Rileggi il chip oppure scrivi l’UID così: 04A1B2C3.' });
  return s;
}
const ctxOf = (req) => ({ by: req.user?.email || 'locale', ip: clientIp(req.c) || null, c: req.c });
const ago = (minutes) => new Date(Date.parse(`${nowLocal().replace(' ', 'T')}Z`) - minutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
const pub = (c) => ({ id: c.id, card_no: c.card_no, customer_id: c.customer_id, customer_name: c.customer_name, customer_phone: c.customer_phone, uid: c.uid, status: c.status, status_label: CARD_STATUS[c.status], points: c.points, has_pin: !!c.pin_hash, locked_reason: c.locked_reason, issued_at: c.issued_at, last_used_at: c.last_used_at, notes: c.notes });

const SELECT = 'SELECT k.*, c.name AS customer_name, c.phone AS customer_phone FROM loyalty_cards k JOIN customers c ON c.id = k.customer_id';
async function cardById(id) {
  const k = await db.prepare(`${SELECT} WHERE k.id = ?`).get(id);
  if (!k) throw new HttpError(404, 'Carta non trovata', { code: 'CARTA_NON_TROVATA', hint: 'Riapri l’elenco delle carte: potrebbe essere stata sostituita o annullata.' });
  return k;
}
async function log(cardId, kind, { points = 0, ref_kind = null, ref_id = null, voucher_id = null, detail = null } = {}, x) {
  await db.prepare(`INSERT INTO loyalty_events (card_id, kind, points, ref_kind, ref_id, voucher_id, by_user, ip, detail, created_at) VALUES (?,?,?,?,?,?,?,?,?,${NOW})`)
    .run(cardId, kind, points, ref_kind, ref_id, voucher_id, x.by, x.ip, detail ? String(detail).slice(0, 300) : null);
}

/** Limiti di velocita': troppe operazioni al minuto o troppi errori in 10 minuti dallo stesso utente/IP. */
async function throttle(x) {
  const who = x.by;
  const ops = (await db.prepare('SELECT COUNT(*) AS n FROM loyalty_events WHERE by_user = ? AND created_at >= ?').get(who, ago(1))).n;
  if (ops >= LIMITS.opsPerMinute) throw new HttpError(429, 'Troppe operazioni sulle carte in un minuto: questa è stata fermata per sicurezza.', { code: 'CARTE_TROPPE_OPERAZIONI', hint: 'Attendi circa un minuto e riprova.' });
  const fails = (await db.prepare("SELECT COUNT(*) AS n FROM loyalty_events WHERE by_user = ? AND kind IN ('tentativo_fallito','sospetta_clonazione') AND created_at >= ?").get(who, ago(10))).n;
  if (fails >= LIMITS.failsPer10Min) throw new HttpError(429, 'Troppi tentativi falliti sulle carte da questo utente: l’operazione è stata fermata per sicurezza.', { code: 'CARTE_TROPPI_TENTATIVI', hint: 'Attendi qualche minuto oppure chiama l’amministratore.' });
}

/** Registra un fallimento e, dopo troppi di fila, blocca la carta. Lancia sempre l'errore da mostrare. */
async function fail(card, x, why, status = 403, msg = 'Verifica della carta non riuscita: il codice letto non è valido.', code = 'CARTA_VERIFICA_FALLITA', hint = 'Avvicina di nuovo la carta; dopo troppi errori la carta si blocca per sicurezza.') {
  await log(card?.id ?? null, 'tentativo_fallito', { detail: why }, x);
  if (card) {
    await db.prepare('UPDATE loyalty_cards SET fail_count = fail_count + 1 WHERE id = ?').run(card.id);
    const k = await db.prepare('SELECT fail_count FROM loyalty_cards WHERE id = ?').get(card.id);
    if (k.fail_count >= LIMITS.failBlock) {
      await db.prepare("UPDATE loyalty_cards SET status='bloccata', locked_reason=? WHERE id = ? AND status='attiva'").run('Troppi tentativi falliti', card.id);
      await log(card.id, 'blocco', { detail: 'automatico: troppi tentativi falliti' }, x);
      throw new HttpError(423, `Carta ${card.card_no} bloccata automaticamente dopo troppi tentativi falliti.`, { code: 'CARTA_BLOCCATA_TENTATIVI', hint: 'Solo l’amministratore può sbloccarla dalla scheda della carta.' });
    }
  }
  throw new HttpError(status, msg, { code, hint });
}
const liveGuard = (card) => {
  if (card.status !== 'attiva') throw new HttpError(423, `Carta ${card.card_no} ${CARD_STATUS[card.status].toLowerCase()}${card.locked_reason ? `: ${card.locked_reason}` : ''}. ${card.status === 'bloccata' ? 'Serve l’amministratore.' : ''}`.trim(), { code: 'CARTA_NON_ATTIVA', hint: 'Una carta bloccata la sblocca l’amministratore; una persa o annullata va sostituita con una nuova.' });
};

// ---------- Operazioni ----------
function randomPin() { const b = crypto.getRandomValues(new Uint32Array(1))[0]; return String(1000 + (b % 9000)); }
async function nextCardNo() {
  const rows = await db.prepare("SELECT card_no FROM loyalty_cards WHERE card_no LIKE 'C-%'").all();
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.card_no).slice(2)) || 0), 0);
  return `C-${String(max + 1).padStart(6, '0')}`;
}
const cleanPin = (p) => { const s = String(p ?? '').trim(); if (s && !/^\d{4,8}$/.test(s)) throw new HttpError(400, 'Il PIN indicato non è valido: devono essere solo cifre, da 4 a 8.', { code: 'PIN_NON_VALIDO', hint: 'Scegli un PIN di 4-8 cifre (es. 4821).' }); return s; };

/** Emette una carta: restituisce il codice da scrivere sul chip e il PIN (mostrato UNA volta). */
export async function issueCard(req, { customer_id, uid, pin }) {
  const x = ctxOf(req);
  await throttle(x);
  if (!customer_id || !(await db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id))) throw new HttpError(404, 'Il cliente scelto per la carta non esiste più in anagrafica.', { code: 'CLIENTE_NON_TROVATO', hint: 'Cerca di nuovo il cliente e riprova.' });
  const u = normalizeUid(uid);
  const taken = await db.prepare("SELECT card_no FROM loyalty_cards WHERE uid = ? AND status IN ('attiva','bloccata')").get(u);
  if (taken) throw new HttpError(409, `Questo chip è già registrato sulla carta ${taken.card_no}: non lo assegno a una seconda carta.`, { code: 'CHIP_GIA_REGISTRATO', hint: 'Usa un chip nuovo, oppure sostituisci o annulla prima la carta che lo usa.' });
  const thePin = cleanPin(pin) || randomPin();
  return tx(async () => {
    const cardNo = await nextCardNo();
    const r = await db.prepare(`INSERT INTO loyalty_cards (card_no, customer_id, uid, counter, pin_hash, created_by, issued_at) VALUES (?,?,?,?,?,?,${NOW})`)
      .run(cardNo, customer_id, u, 1, await pinMac(req.c, cardNo, thePin), x.by);
    const id = Number(r.lastInsertRowid);
    await log(id, 'emissione', { detail: `UID ${u}` }, x);
    const card = await cardById(id);
    return { card: pub(card), token: await makeToken(req.c, cardNo, u, card.counter), pin: thePin };
  });
}

/**
 * Passaggio della carta sul lettore: identifica la carta e, se c'e' il codice firmato, lo verifica.
 * Con il codice valido il contatore avanza e si restituisce quello nuovo da scrivere sul chip (`next_token`).
 */
export async function scanCard(req, { uid, token }) {
  const x = ctxOf(req);
  await throttle(x);
  const u = normalizeUid(uid);
  const tok = token ? parseToken(token) : null;
  if (token && !tok) { await log(null, 'tentativo_fallito', { detail: 'codice sul chip illeggibile' }, x); throw new HttpError(400, 'Il codice scritto sul chip non appartiene a questa carta: l’operazione è stata fermata.', { code: 'CHIP_CODICE_NON_VALIDO', hint: 'Avvicina la carta giusta; se il chip è stato riscritto, rigenerane il codice dall’amministrazione.' }); }
  let card = await db.prepare(`${SELECT} WHERE k.uid = ? AND k.status IN ('attiva','bloccata') ORDER BY k.id DESC`).get(u);
  if (!card) {
    if (tok) { // codice di una carta nostra copiato su un chip con UID diverso
      const owner = await db.prepare(`${SELECT} WHERE k.card_no = ?`).get(tok.cardNo);
      if (owner) await fail(owner, x, `UID diverso: letto ${u}`, 403, 'Il chip letto non corrisponde alla carta indicata: l’operazione è stata fermata.', 'CHIP_NON_CORRISPONDE', 'Avvicina la carta giusta; ripetuti errori bloccano la carta.');
    }
    await log(null, 'tentativo_fallito', { detail: `UID sconosciuto ${u}` }, x);
    throw new HttpError(404, 'Questo chip non è associato a nessuna carta punti.', { code: 'CARTA_NON_REGISTRATA', hint: 'Emetti la carta dalla scheda del cliente, poi riprova.' });
  }
  liveGuard(card);
  if (!tok) {
    await log(card.id, 'verifica', { detail: 'solo UID' }, x);
    return { card: pub(card), level: 'uid', session: await makeSession(req.c, card, 'uid'), next_token: null, note: 'Solo UID: per riscattare servono il PIN o una carta scrivibile col codice.' };
  }
  if (tok.cardNo !== card.card_no || !(await checkToken(req.c, tok, u))) await fail(card, x, 'codice firmato non valido');
  if (tok.counter < card.counter) { // codice gia' usato: copia del chip o replay
    await db.prepare("UPDATE loyalty_cards SET status='bloccata', locked_reason=? WHERE id = ?").run('Sospetta clonazione: codice già usato', card.id);
    await log(card.id, 'sospetta_clonazione', { detail: `contatore ${tok.counter} < ${card.counter}` }, x);
    throw new HttpError(423, `Carta ${card.card_no} BLOCCATA per sicurezza: il codice sul chip era già stato usato (possibile copia).`, { code: 'CARTA_SOSPETTA_COPIA', hint: 'Chiama l’amministratore: deve verificare e sostituire la carta.' });
  }
  // contatore uguale (normale) o avanti (dopo un ripristino del backup): si accetta e si avanza
  const next = tok.counter + 1;
  const r = await db.prepare(`UPDATE loyalty_cards SET counter = ?, fail_count = 0, last_used_at = ${NOW} WHERE id = ? AND counter <= ? AND status = 'attiva'`).run(next, card.id, tok.counter);
  if (!r.changes) { // due passaggi in contemporanea con lo stesso codice: il secondo e' un replay
    await db.prepare("UPDATE loyalty_cards SET status='bloccata', locked_reason=? WHERE id = ?").run('Sospetta clonazione: due usi contemporanei dello stesso codice', card.id);
    await log(card.id, 'sospetta_clonazione', { detail: 'uso simultaneo' }, x);
    throw new HttpError(423, `Carta ${card.card_no} BLOCCATA per sicurezza: lo stesso codice è stato presentato due volte contemporaneamente.`, { code: 'CARTA_SOSPETTA_COPIA', hint: 'Chiama l’amministratore: deve verificare e sostituire la carta.' });
  }
  await log(card.id, 'verifica', { detail: tok.counter > card.counter ? `codice avanti (${tok.counter}), contatore riallineato` : 'codice firmato' }, x);
  const fresh = await cardById(card.id);
  return { card: pub(fresh), level: 'token', session: await makeSession(req.c, fresh, 'token'), next_token: await makeToken(req.c, fresh.card_no, u, fresh.counter), note: 'Scrivi next_token sul chip: il vecchio codice non vale più.' };
}

/** Accredita i punti di una vendita o di una riparazione consegnata: importo letto dal server, una sola volta per documento. */
export async function accrue(req, id, { ref_kind, ref_id, session }) {
  const x = ctxOf(req);
  await throttle(x);
  const card = await cardById(id);
  liveGuard(card);
  await readSession(req.c, session, card.id);
  const R = await rules();
  let amount; let who;
  if (ref_kind === 'sale') {
    const s = await db.prepare('SELECT id, code, total, customer_id FROM sales WHERE id = ?').get(ref_id);
    if (!s) throw new HttpError(404, 'La vendita indicata per i punti non esiste più.', { code: 'VENDITA_NON_TROVATA', hint: 'Riapri l’elenco delle vendite e riprova.' });
    if (s.customer_id && s.customer_id !== card.customer_id) throw new HttpError(409, `La vendita ${s.code} è intestata a un altro cliente: i punti non vanno sulla carta ${card.card_no}.`, { code: 'VENDITA_ALTRO_CLIENTE', hint: 'Usa la carta del cliente che ha fatto l’acquisto.' });
    amount = s.total; who = s.code;
  } else if (ref_kind === 'repair') {
    const r = await db.prepare('SELECT id, code, status, final_price, quote, customer_id FROM repairs WHERE id = ?').get(ref_id);
    if (!r) throw new HttpError(404, 'La riparazione indicata per i punti non esiste più.', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Riapri l’elenco delle riparazioni e riprova.' });
    if (r.customer_id !== card.customer_id) throw new HttpError(409, `La riparazione ${r.code} è intestata a un altro cliente: i punti non vanno sulla carta ${card.card_no}.`, { code: 'RIPARAZIONE_ALTRO_CLIENTE', hint: 'Usa la carta del cliente della riparazione.' });
    if (r.status !== 'delivered') throw new HttpError(409, `Riparazione ${r.code}: i punti si danno solo alla consegna e non è ancora consegnata.`, { code: 'RIPARAZIONE_NON_CONSEGNATA', hint: 'Consegna prima la riparazione, poi accredita i punti.' });
    amount = r.final_price ?? r.quote ?? 0; who = r.code;
  } else throw new HttpError(400, 'Accredito punti non eseguito: non è indicato quale vendita o riparazione li origina.', { code: 'ORIGINE_PUNTI_MANCANTE', hint: 'Scegli la vendita o la riparazione consegnata.' });
  const pts = Math.floor(Number(amount) * R.points_per_euro + 1e-9);
  if (!(pts > 0)) throw new HttpError(400, `Carta ${card.card_no}: l’importo del documento è troppo basso per dare punti.`, { code: 'IMPORTO_SENZA_PUNTI', hint: 'Nessuna azione: i punti si calcolano sugli importi più alti.' });
  if (pts > R.max_accrual) throw new HttpError(409, `Carta ${card.card_no}: l’operazione darebbe ${pts} punti, oltre il limite di ${R.max_accrual} per volta.`, { code: 'PUNTI_LIMITE_OPERAZIONE', hint: 'Chiama l’amministratore per una rettifica manuale se l’importo è corretto.' });
  return tx(async () => {
    try { await log(card.id, 'accredito', { points: pts, ref_kind, ref_id: Number(ref_id), detail: `${who} · ${Number(amount).toFixed(2)} €` }, x); }
    catch (e) { if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, `Carta ${card.card_no}: i punti di questo documento sono già stati accreditati.`, { code: 'PUNTI_GIA_ACCREDITATI', hint: 'Non serve ripetere l’operazione: controlla lo storico della carta.' }); throw e; }
    await db.prepare('UPDATE loyalty_cards SET points = points + ?, fail_count = 0, last_used_at = ' + NOW + ' WHERE id = ?').run(pts, card.id);
    return { card: pub(await cardById(card.id)), added: pts };
  });
}

/** Riscatto: i punti diventano un buono regalo (buoni.mjs). Serve il codice firmato verificato OPPURE il PIN. */
export async function redeem(req, id, { points, session, pin }) {
  const x = ctxOf(req);
  await throttle(x);
  const card = await cardById(id);
  liveGuard(card);
  const s = await readSession(req.c, session, card.id);
  if (s.l !== 'token') {
    if (!card.pin_hash) throw new HttpError(403, `Carta ${card.card_no}: con il solo UID è obbligatorio il PIN, ma questa carta non ne ha uno.`, { code: 'CARTA_SENZA_PIN', hint: 'Usa una carta scrivibile (con codice firmato) oppure sostituiscila con una che abbia il PIN.' });
    if (!cleanPin(pin) || !(await verify(req.c, `pin|${card.card_no}|${String(pin).trim()}`, card.pin_hash))) await fail(card, x, 'PIN errato', 403, 'PIN errato: l’operazione non è stata eseguita.', 'PIN_ERRATO', 'Riprova con il PIN corretto; dopo troppi errori la carta si blocca per sicurezza.');
  }
  const R = await rules();
  const pts = Math.round(Number(points));
  if (!(pts > 0) || pts % R.redeem_step) throw new HttpError(400, `Carta ${card.card_no}: i punti da riscattare devono essere multipli di ${R.redeem_step}.`, { code: 'RISCATTO_NON_MULTIPLO', hint: 'Scegli un numero di punti che sia multiplo del passo indicato nel messaggio.' });
  if (pts > card.points) throw new HttpError(409, `Carta ${card.card_no}: punti insufficienti (${card.points} disponibili).`, { code: 'PUNTI_INSUFFICIENTI', hint: 'Riscatta al massimo i punti disponibili.' });
  const today = (await db.prepare("SELECT COALESCE(-SUM(points),0) AS n FROM loyalty_events WHERE card_id = ? AND kind = 'riscatto' AND date(created_at) = date('now','localtime')").get(card.id)).n;
  if (today + pts > R.max_redeem_day) throw new HttpError(409, `Carta ${card.card_no}: superato il limite giornaliero di ${R.max_redeem_day} punti riscattabili.`, { code: 'RISCATTO_LIMITE_GIORNALIERO', hint: 'Riprova domani oppure chiama l’amministratore.' });
  const euro = Math.round((pts / R.redeem_step) * R.euro_per_step * 100) / 100;
  return tx(async () => {
    const r = await db.prepare('UPDATE loyalty_cards SET points = points - ?, fail_count = 0, last_used_at = ' + NOW + ' WHERE id = ? AND points >= ? AND status = ?').run(pts, card.id, pts, 'attiva');
    if (!r.changes) throw new HttpError(409, `Carta ${card.card_no}: i punti sono cambiati un attimo fa (altra operazione in corso), il riscatto non è stato eseguito.`, { code: 'PUNTI_CAMBIATI', hint: 'Ricarica la carta e ripeti il riscatto.' });
    const d = new Date(`${nowLocal().slice(0, 10)}T12:00:00`); d.setMonth(d.getMonth() + R.voucher_months);
    const code = newVoucherCode();
    const v = await db.prepare(`INSERT INTO vouchers (code, kind, value, balance, expires_at, customer_id, notes, created_at) VALUES (?,?,?,?,?,?,?,${NOW})`)
      .run(code, 'regalo', euro, euro, d.toISOString().slice(0, 10), card.customer_id, `Punti carta ${card.card_no}: ${pts} punti`);
    await log(card.id, 'riscatto', { points: -pts, voucher_id: Number(v.lastInsertRowid), detail: `${pts} punti -> buono ${code} ${euro.toFixed(2)} €` }, x);
    return { card: pub(await cardById(card.id)), voucher: { id: Number(v.lastInsertRowid), code, value: euro, expires_at: d.toISOString().slice(0, 10) } };
  });
}

/** Rettifica manuale del saldo (solo amministratore, con motivo obbligatorio). */
export async function adjust(req, id, { points, reason }) {
  const x = ctxOf(req);
  const card = await cardById(id);
  const p = Math.round(Number(points));
  if (!Number.isFinite(p) || !p) throw new HttpError(400, 'Rettifica non eseguita: non è indicato di quanti punti.', { code: 'RETTIFICA_PUNTI_MANCANTI', hint: 'Scrivi un numero di punti (negativo per togliere).' });
  if (Math.abs(p) > 100000) throw new HttpError(400, 'Rettifica non eseguita: supera il massimo di 100000 punti per volta.', { code: 'RETTIFICA_TROPPO_GRANDE', hint: 'Dividi la rettifica in più operazioni o correggi il numero.' });
  if (!str(reason) || String(reason).trim().length < 5) throw new HttpError(400, 'Rettifica non eseguita: manca il motivo (almeno 5 caratteri), che resta nel registro.', { code: 'MOTIVO_MANCANTE', hint: 'Scrivi perché stai correggendo i punti.' });
  if (card.points + p < 0) throw new HttpError(409, `Carta ${card.card_no}: la rettifica porterebbe il saldo sotto zero (ora ${card.points} punti).`, { code: 'SALDO_NEGATIVO', hint: 'Togli al massimo i punti disponibili.' });
  return tx(async () => {
    await db.prepare('UPDATE loyalty_cards SET points = points + ? WHERE id = ?').run(p, card.id);
    await log(card.id, 'rettifica', { points: p, detail: String(reason).trim() }, x);
    return { card: pub(await cardById(card.id)) };
  });
}

export async function setBlocked(req, id, block, reason) {
  const x = ctxOf(req);
  const card = await cardById(id);
  if (['persa', 'annullata'].includes(card.status)) throw new HttpError(409, `Carta ${card.card_no} non è più utilizzabile (persa o annullata).`, { code: 'CARTA_CHIUSA', hint: 'Emetti una nuova carta al cliente.' });
  if (block) await db.prepare("UPDATE loyalty_cards SET status='bloccata', locked_reason=? WHERE id = ?").run(str(reason) || 'bloccata a mano', id);
  else await db.prepare("UPDATE loyalty_cards SET status='attiva', locked_reason=NULL, fail_count=0 WHERE id = ?").run(id);
  await log(id, block ? 'blocco' : 'sblocco', { detail: str(reason) }, x);
  return { card: pub(await cardById(id)) };
}

/** Riscrive il chip (es. scrittura fallita): nuovo codice valido, il vecchio decade. Richiede la carta attiva e il PIN del cliente o l'amministratore. */
export async function reissueToken(req, id, { pin }) {
  const x = ctxOf(req);
  await throttle(x);
  const card = await cardById(id);
  liveGuard(card);
  const isAdmin = !req.user || req.user.role === 'admin';
  if (!isAdmin) {
    if (!cleanPin(pin) || !card.pin_hash || !(await verify(req.c, `pin|${card.card_no}|${String(pin).trim()}`, card.pin_hash))) await fail(card, x, 'PIN errato in riscrittura', 403, 'PIN errato: la carta non è stata riscritta.', 'PIN_ERRATO', 'Riprova con il PIN corretto; dopo troppi errori la carta si blocca per sicurezza.');
  }
  await db.prepare('UPDATE loyalty_cards SET counter = counter + 1 WHERE id = ?').run(id);
  await log(id, 'riemissione', { detail: 'nuovo codice per il chip' }, x);
  const k = await cardById(id);
  return { card: pub(k), token: await makeToken(req.c, k.card_no, k.uid, k.counter) };
}

/** Carta persa o rotta: la vecchia si chiude e i punti passano a una nuova carta (altro chip) dello stesso cliente. Solo amministratore. */
export async function replaceCard(req, id, { uid }) {
  const x = ctxOf(req);
  const old = await cardById(id);
  if (['persa', 'annullata'].includes(old.status)) throw new HttpError(409, `Carta ${old.card_no} è già chiusa (persa o annullata): non si sostituisce.`, { code: 'CARTA_CHIUSA', hint: 'Emetti una nuova carta dalla scheda del cliente.' });
  const u = normalizeUid(uid);
  if (u === old.uid) throw new HttpError(409, `Carta ${old.card_no}: il nuovo chip è lo stesso di quello da sostituire.`, { code: 'CHIP_UGUALE', hint: 'Avvicina il chip nuovo.' });
  if (await db.prepare("SELECT 1 AS x FROM loyalty_cards WHERE uid = ? AND status IN ('attiva','bloccata')").get(u)) throw new HttpError(409, 'Il nuovo chip è già registrato su un’altra carta attiva o bloccata.', { code: 'CHIP_GIA_REGISTRATO', hint: 'Usa un chip mai registrato.' });
  const pin = randomPin();
  return tx(async () => {
    await db.prepare("UPDATE loyalty_cards SET status='persa', locked_reason=? WHERE id = ?").run('sostituita', old.id);
    const cardNo = await nextCardNo();
    const r = await db.prepare(`INSERT INTO loyalty_cards (card_no, customer_id, uid, points, counter, pin_hash, created_by, issued_at, notes) VALUES (?,?,?,?,?,?,?,${NOW},?)`)
      .run(cardNo, old.customer_id, u, old.points, 1, await pinMac(req.c, cardNo, pin), x.by, `Sostituisce ${old.card_no}`);
    const nid = Number(r.lastInsertRowid);
    await db.prepare('UPDATE loyalty_cards SET points = 0 WHERE id = ?').run(old.id);
    await log(old.id, 'sostituzione', { points: -old.points, detail: `sostituita da ${cardNo}` }, x);
    await log(nid, 'emissione', { points: old.points, detail: `sostituisce ${old.card_no}` }, x);
    const k = await cardById(nid);
    return { card: pub(k), token: await makeToken(req.c, cardNo, u, k.counter), pin };
  });
}

export async function cardHistory(id, limit = 100) {
  const card = await cardById(id);
  const events = await db.prepare('SELECT e.*, v.code AS voucher_code FROM loyalty_events e LEFT JOIN vouchers v ON v.id = e.voucher_id WHERE e.card_id = ? ORDER BY e.id DESC LIMIT ?').all(id, limit);
  return { card: pub(card), events };
}

/** Vendite e riparazioni consegnate del cliente non ancora premiate con punti (per il pulsante "Accredita"). */
export async function creditable(customerId) {
  if (!customerId) throw new HttpError(400, 'Non so di quale cliente cercare vendite e riparazioni da premiare: manca il cliente.', { code: 'CLIENTE_MANCANTE', hint: 'Apri la carta dalla scheda del cliente.' });
  const R = await rules();
  const sales = await db.prepare(`SELECT s.id, s.code, s.total AS amount, s.created_at AS at FROM sales s WHERE s.customer_id = ? AND NOT EXISTS (SELECT 1 FROM loyalty_events e WHERE e.kind='accredito' AND e.ref_kind='sale' AND e.ref_id=s.id) ORDER BY s.id DESC LIMIT 30`).all(customerId);
  const repairs = await db.prepare(`SELECT r.id, r.code, COALESCE(r.final_price, r.quote, 0) AS amount, r.delivered_at AS at FROM repairs r WHERE r.customer_id = ? AND r.status='delivered' AND NOT EXISTS (SELECT 1 FROM loyalty_events e WHERE e.kind='accredito' AND e.ref_kind='repair' AND e.ref_id=r.id) ORDER BY r.id DESC LIMIT 30`).all(customerId);
  const f = (kind) => (x) => ({ ref_kind: kind, ref_id: x.id, code: x.code, amount: x.amount, at: x.at, points: Math.floor(x.amount * R.points_per_euro + 1e-9) });
  return [...sales.map(f('sale')), ...repairs.map(f('repair'))].filter((x) => x.points > 0).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function registerLoyaltyRoutes(app, h) {
  const adminOnly = (req) => { if (req.user && req.user.role !== 'admin') throw new HttpError(403, 'Operazione sulle carte riservata all’amministratore: il tuo utente non ha il permesso.', { code: 'SOLO_ADMIN', hint: 'Accedi come amministratore, oppure chiedi a Christian/Marco di farlo.' }); };
  app.get('/api/carte/meta', h(async (req) => ({ rules: await rules(), limits: LIMITS, statuses: CARD_STATUS, configured: nfcSecret(req.c).length >= 16 })));
  app.get('/api/carte', h(async (req) => {
    const where = []; const args = [];
    if (req.query.customer_id) { where.push('k.customer_id = ?'); args.push(req.query.customer_id); }
    const q = str(req.query.q);
    if (q) { where.push('(k.card_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    return (await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY k.id DESC LIMIT 300`).all(...args)).map(pub);
  }));
  app.get('/api/carte/creditable', h((req) => creditable(req.query.customer_id)));
  app.post('/api/carte/issue', h((req) => issueCard(req, req.body)));
  app.post('/api/carte/scan', h((req) => scanCard(req, req.body)));
  app.get('/api/carte/:id', h((req) => cardHistory(req.params.id)));
  app.post('/api/carte/:id/accrue', h((req) => accrue(req, req.params.id, req.body)));
  app.post('/api/carte/:id/redeem', h((req) => redeem(req, req.params.id, req.body)));
  app.post('/api/carte/:id/reissue', h((req) => reissueToken(req, req.params.id, req.body)));
  app.post('/api/carte/:id/adjust', h((req) => { adminOnly(req); return adjust(req, req.params.id, req.body); }));
  app.post('/api/carte/:id/block', h((req) => setBlocked(req, req.params.id, true, req.body.reason)));
  app.post('/api/carte/:id/unblock', h((req) => { adminOnly(req); return setBlocked(req, req.params.id, false, req.body.reason); }));
  app.post('/api/carte/:id/replace', h((req) => { adminOnly(req); return replaceCard(req, req.params.id, req.body); }));
}
