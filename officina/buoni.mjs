// Buoni sconto / buoni regalo e pagamento diviso (piu' metodi o persone). Tutto passa dalla tabella payments: nulla e' nascosto ai totali di cassa.
//  - sconto_importo / sconto_percentuale: riducono il totale (sconto) e restano registrati in voucher_uses
//  - regalo: credito con saldo residuo, uso anche parziale; entra in cassa come pagamento con metodo "buono"
import { db } from './dbref.mjs';
import { HttpError, money, localDate, assertMethod } from './logic.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const KINDS = { regalo: 'Buono regalo (credito)', sconto_importo: 'Sconto in euro', sconto_percentuale: 'Sconto in percentuale' };
export const MAX_SPLIT = 6;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // senza O/0, I/1: si legge bene e si scrive bene
export function newVoucherCode() {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(8));
  return `B-${[...b].map((x) => ALPHABET[x % ALPHABET.length]).join('')}`;
}
const normCode = (c) => String(c ?? '').trim().toUpperCase().replace(/\s+/g, '');

/** Stato leggibile: attivo | esaurito | scaduto | annullato */
export function voucherState(v, today = localDate()) {
  if (v.status === 'annullato') return 'annullato';
  if (v.expires_at && v.expires_at < today) return 'scaduto';
  if (!(v.balance > 0)) return 'esaurito';
  return 'attivo';
}
const decorate = (v) => ({ ...v, state: voucherState(v), kind_label: KINDS[v.kind] });

async function loadUsable(code) {
  const c = normCode(code);
  if (!c) throw new HttpError(400, 'Buono non verificato: non è stato scritto il codice.', { code: 'BUONO_CODICE_MANCANTE', hint: 'Scrivi il codice stampato sul buono.' });
  const v = await db.prepare('SELECT * FROM vouchers WHERE code = ?').get(c);
  if (!v) throw new HttpError(404, 'Nessun buono corrisponde al codice scritto.', { code: 'BUONO_NON_TROVATO', hint: 'Controlla il codice sul buono (lettere e cifre) e riprova.' });
  const st = voucherState(v);
  if (st === 'annullato') throw new HttpError(409, `Il buono ${v.code} è stato annullato e non è più utilizzabile.`, { code: 'BUONO_ANNULLATO', hint: 'Usa un altro buono, oppure chiedi all’amministratore di ripristinarlo.' });
  if (st === 'scaduto') throw new HttpError(409, `Il buono ${v.code} è scaduto il ${v.expires_at}.`, { code: 'BUONO_SCADUTO', hint: 'Usa un altro buono, oppure chiedi all’amministratore di prolungare la scadenza.' });
  if (st === 'esaurito') throw new HttpError(409, `Il buono ${v.code} è già stato usato per intero: non ha più credito.`, { code: 'BUONO_ESAURITO', hint: 'Usa un altro buono.' });
  return v;
}

/** Quanto toglie il buono dal totale `due` (non scrive nulla). */
export function voucherEffect(v, due) {
  let amount;
  if (v.kind === 'sconto_percentuale') amount = r2(due * v.value / 100);
  else amount = r2(Math.min(v.balance, due));
  return { amount: Math.min(amount, r2(due)), as: v.kind === 'regalo' ? 'payment' : 'discount' };
}

/**
 * Prepara l'incasso senza scrivere: controlla buono e quote del pagamento diviso.
 * Ritorna un "piano" che commitSettlement esegue. `b` = { voucher_code, payments:[{method,amount,payer}], method }.
 */
export async function planSettlement(b, due) {
  due = r2(due);
  let voucher = null;
  let discount = 0;
  let gift = 0;
  if (str(b.voucher_code)) {
    voucher = await loadUsable(b.voucher_code);
    const eff = voucherEffect(voucher, due);
    if (eff.amount <= 0) throw new HttpError(400, 'Il buono non darebbe nessuno sconto su questo totale: non lo applico.', { code: 'BUONO_SENZA_SCONTO', hint: 'Aggiungi articoli alla vendita oppure usa un altro buono.' });
    if (eff.as === 'discount') discount = eff.amount; else gift = eff.amount;
  }
  const rest = r2(due - discount - gift);
  let rows;
  if (Array.isArray(b.payments) && b.payments.length) {
    if (b.payments.length > MAX_SPLIT) throw new HttpError(400, `Troppe quote di pagamento: al massimo ${MAX_SPLIT} per vendita.`, { code: 'TROPPE_QUOTE', hint: 'Unisci le quote con lo stesso metodo.' });
    rows = b.payments.map((p, i) => {
      const method = str(p.method) || 'contanti';
      const amount = r2(String(p.amount).replace(',', '.'));
      if (!(amount > 0)) throw new HttpError(400, `Quota di pagamento n. ${i + 1}: l’importo non è valido (serve un numero maggiore di zero).`, { code: 'QUOTA_IMPORTO_NON_VALIDO', hint: 'Correggi l’importo della quota.' });
      if (/^buono$/i.test(method)) throw new HttpError(400, 'Il buono non si sceglie come metodo di pagamento: va inserito con il suo codice.', { code: 'BUONO_COME_METODO', hint: 'Scrivi il codice del buono nell’apposito campo.' });
      if (/non\s*tracciat/i.test(method)) throw new HttpError(400, 'Una quota di pagamento ha un metodo non tracciabile: ogni incasso deve avere un metodo registrato.', { code: 'METODO_PAGAMENTO_MANCANTE', hint: 'Scegli contanti, carta, bonifico… per ogni quota.' });
      if (method.length > 30) throw new HttpError(400, `Quota di pagamento n. ${i + 1}: il metodo non è valido (troppo lungo).`, { code: 'QUOTA_METODO_NON_VALIDO', hint: 'Scegli uno dei metodi proposti.' });
      return { method, amount, payer: str(p.payer)?.slice(0, 60) || null };
    });
    const sum = r2(rows.reduce((a, x) => a + x.amount, 0));
    if (Math.abs(sum - rest) > 0.005) throw new HttpError(400, `Le quote di pagamento (${sum.toFixed(2)} €) non coincidono con il totale da pagare (${rest.toFixed(2)} €).`, { code: 'QUOTE_NON_COINCIDONO', hint: 'Correggi gli importi finché la somma è uguale al totale.' });
  } else {
    if (rest > 0) assertMethod(b.method);
    rows = rest > 0 ? [{ method: str(b.method) || 'contanti', amount: rest, payer: null }] : [];
  }
  const split = rows.length > 1 || (rows.length === 1 && gift > 0);
  const methodLabel = rows.length === 1 && !gift ? rows[0].method : rows.length === 0 ? (gift ? 'buono' : str(b.method) || 'contanti') : 'diviso';
  return { voucher, discount, gift, rest, rows, split, methodLabel };
}

/**
 * Esegue il piano: consuma il buono in modo atomico (UPDATE condizionato, D1 non ha transazioni)
 * e scrive ogni quota in payments. `add` = funzione addPayment di logic.mjs.
 */
export async function commitSettlement(plan, { kind, refId, label }, add) {
  const { voucher } = plan;
  if (voucher) {
    const used = plan.discount || plan.gift;
    const r = voucher.kind === 'sconto_percentuale'
      ? await db.prepare("UPDATE vouchers SET balance = 0 WHERE id = ? AND status = 'attivo' AND balance > 0 AND (expires_at IS NULL OR expires_at >= ?)").run(voucher.id, localDate())
      : await db.prepare("UPDATE vouchers SET balance = ROUND(balance - ?, 2) WHERE id = ? AND status = 'attivo' AND balance >= ? AND (expires_at IS NULL OR expires_at >= ?)").run(used, voucher.id, used, localDate());
    if (!r.changes) throw new HttpError(409, 'Il buono è stato appena usato (o non è più valido) da un’altra operazione: la vendita non è stata registrata.', { code: 'BUONO_NON_PIU_VALIDO', hint: 'Ricontrolla il buono e ripeti la vendita.' });
    await db.prepare(`INSERT INTO voucher_uses (voucher_id, kind, ref_id, label, amount, created_at) VALUES (?,?,?,?,?,${NOW})`).run(voucher.id, kind, refId, label, used);
    if (plan.gift) await add(kind, refId, `${label} · buono ${voucher.code}`, plan.gift, 'buono');
  }
  const n = plan.rows.length;
  let i = 0;
  for (const p of plan.rows) {
    i += 1;
    await add(kind, refId, n > 1 || plan.gift ? `${label} · quota ${i}/${n}${p.payer ? ` (${p.payer})` : ''}` : label, p.amount, p.method);
  }
}

/** Buoni usati nel periodo (per i totali di Cassa): sconti e crediti. */
export async function voucherUsage(from, to) {
  const rows = await db.prepare(`SELECT v.kind, ROUND(SUM(u.amount),2) AS total, COUNT(*) AS n FROM voucher_uses u JOIN vouchers v ON v.id=u.voucher_id WHERE date(u.created_at) BETWEEN ? AND ? GROUP BY v.kind`).all(from, to);
  const sum = (pred) => r2(rows.filter(pred).reduce((a, x) => a + x.total, 0));
  return { discount: sum((x) => x.kind !== 'regalo'), credit: sum((x) => x.kind === 'regalo'), n: rows.reduce((a, x) => a + x.n, 0) };
}

export const VOUCHER_TABLES = ['vouchers', 'voucher_uses'];

export function registerVoucherRoutes(app, h, { page, getSettings } = {}) {
  const adminOnly = (req) => { if (req.user && req.user.role !== 'admin') throw new HttpError(403, 'La gestione dei buoni è riservata all’amministratore: il tuo utente non ha il permesso.', { code: 'SOLO_ADMIN', hint: 'Accedi come amministratore, oppure chiedi a Christian/Marco di farlo.' }); };

  app.get('/api/buoni', h(async (req) => {
    const rows = (await db.prepare('SELECT v.*, c.name AS customer_name FROM vouchers v LEFT JOIN customers c ON c.id=v.customer_id ORDER BY v.id DESC LIMIT 500').all()).map(decorate);
    const st = str(req.query.state);
    return st ? rows.filter((r) => r.state === st) : rows;
  }));

  // Controllo in cassa: quanto toglierebbe il buono da questo totale
  app.get('/api/buoni/check', h(async (req) => {
    const v = await loadUsable(req.query.code);
    const total = r2(String(req.query.total ?? '0').replace(',', '.')) || 0;
    const eff = voucherEffect(v, total);
    return { ...decorate(v), applies: eff.amount, applies_as: eff.as };
  }));

  app.post('/api/buoni', h(async (req) => {
    const b = req.body;
    const kind = b.kind in KINDS ? b.kind : 'regalo';
    const value = r2(String(b.value ?? '').replace(',', '.'));
    if (!(value > 0)) throw new HttpError(400, 'Buono non creato: il valore non è valido (serve un numero maggiore di zero).', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi il valore del buono in euro, o la percentuale.' });
    if (kind === 'sconto_percentuale' && value > 100) throw new HttpError(400, 'Buono non creato: la percentuale di sconto supera 100.', { code: 'PERCENTUALE_NON_VALIDA', hint: 'Scrivi una percentuale da 1 a 100.' });
    let code = normCode(b.code) || newVoucherCode();
    if (code.length < 4 || code.length > 30 || !/^[A-Z0-9-]+$/.test(code)) throw new HttpError(400, 'Buono non creato: il codice non è valido (solo lettere, cifre e trattino, da 4 a 30 caratteri).', { code: 'BUONO_CODICE_NON_VALIDO', hint: 'Scegli un codice tipo ESTATE-25 oppure lascia che lo generi il sistema.' });
    if (await db.prepare('SELECT id FROM vouchers WHERE code = ?').get(code)) throw new HttpError(409, 'Buono non creato: esiste già un buono con lo stesso codice.', { code: 'BUONO_CODICE_DUPLICATO', hint: 'Scegli un altro codice.' });
    const exp = str(b.expires_at);
    if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) throw new HttpError(400, 'Buono non creato: la data di scadenza non è valida.', { code: 'DATA_NON_VALIDA', hint: 'Scegli una data che esiste (AAAA-MM-GG).' });
    const r = await db.prepare(`INSERT INTO vouchers (code, kind, value, balance, expires_at, customer_id, notes, created_at) VALUES (?,?,?,?,?,?,?,${NOW})`)
      .run(code, kind, value, kind === 'sconto_percentuale' ? 1 : value, exp, b.customer_id || null, str(b.notes));
    return decorate(await db.prepare('SELECT * FROM vouchers WHERE id = ?').get(r.lastInsertRowid));
  }));

  app.get('/api/buoni/:id', h(async (req) => {
    const v = await db.prepare('SELECT v.*, c.name AS customer_name FROM vouchers v LEFT JOIN customers c ON c.id=v.customer_id WHERE v.id = ?').get(req.params.id);
    if (!v) throw new HttpError(404, 'Buono non trovato', { code: 'BUONO_NON_TROVATO', hint: 'Riapri l’elenco dei buoni: potrebbe essere stato eliminato.' });
    return { ...decorate(v), uses: await db.prepare('SELECT * FROM voucher_uses WHERE voucher_id = ? ORDER BY id DESC').all(v.id) };
  }));

  app.post('/api/buoni/:id/annulla', h(async (req) => {
    adminOnly(req);
    const r = await db.prepare("UPDATE vouchers SET status = 'annullato' WHERE id = ?").run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Buono non trovato', { code: 'BUONO_NON_TROVATO', hint: 'Riapri l’elenco dei buoni: potrebbe essere stato eliminato.' });
    return decorate(await db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id));
  }));

  app.delete('/api/buoni/:id', h(async (req) => {
    adminOnly(req);
    if ((await db.prepare('SELECT COUNT(*) AS n FROM voucher_uses WHERE voucher_id = ?').get(req.params.id)).n) throw new HttpError(409, 'Il buono è già stato usato almeno una volta: non si elimina per non perdere lo storico.', { code: 'BUONO_GIA_USATO', hint: 'Annullalo invece di eliminarlo.' });
    await db.prepare('DELETE FROM vouchers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Buono stampabile (A5 orizzontale, con codice a barre e QR)
  if (page) {
    app.get('/print/voucher/:id', page(async (c) => {
      const v = await db.prepare('SELECT * FROM vouchers WHERE id = ?').get(c.req.param('id'));
      if (!v) throw new HttpError(404, 'Buono non trovato', { code: 'BUONO_NON_TROVATO', hint: 'Riapri l’elenco dei buoni: potrebbe essere stato eliminato.' });
      const s = getSettings ? await getSettings() : {};
      const e = (x) => String(x ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const what = v.kind === 'sconto_percentuale' ? `${v.value}% di sconto` : `${v.value.toFixed(2).replace('.', ',')} €`;
      const title = v.kind === 'regalo' ? 'Buono regalo' : 'Buono sconto';
      return c.html(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${title} ${e(v.code)}</title><style>
        @page{size:A5 landscape;margin:10mm}body{font-family:Arial,sans-serif;margin:0;color:#0B0F19}
        .b{border:3px solid #DC2626;border-radius:14px;padding:12mm;text-align:center}
        h1{margin:0 0 2mm;font-size:22pt}.s{color:#6B7280;margin:0 0 6mm}.v{font-size:44pt;font-weight:800;margin:4mm 0}.c{font:700 22pt monospace;letter-spacing:3px;border:2px dashed #9CA3AF;display:inline-block;padding:3mm 6mm;border-radius:8px}
        p.f{font-size:9pt;color:#6B7280;margin-top:6mm}</style></head><body onload="window.print()"><div class="b">
        <h1>${e(s.shop_name || 'Informatix Repair')}</h1><p class="s">${title}</p><div class="v">${e(what)}</div><div class="c">${e(v.code)}</div>
        <p class="f">${v.expires_at ? `Valido fino al ${e(v.expires_at.split('-').reverse().join('/'))}. ` : ''}Non convertibile in denaro. Da presentare in cassa${v.kind === 'regalo' ? '; il credito residuo resta sul buono' : ''}.</p></div></body></html>`);
    }));
  }
}
