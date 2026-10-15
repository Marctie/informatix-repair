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
  if (!c) throw new HttpError(400, 'Scrivi il codice del buono');
  const v = await db.prepare('SELECT * FROM vouchers WHERE code = ?').get(c);
  if (!v) throw new HttpError(404, 'Buono non trovato: controlla il codice.');
  const st = voucherState(v);
  if (st === 'annullato') throw new HttpError(409, 'Questo buono è stato annullato.');
  if (st === 'scaduto') throw new HttpError(409, `Questo buono è scaduto il ${v.expires_at}.`);
  if (st === 'esaurito') throw new HttpError(409, 'Questo buono è già stato usato per intero.');
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
    if (eff.amount <= 0) throw new HttpError(400, 'Il buono non porta nessuno sconto su questo totale.');
    if (eff.as === 'discount') discount = eff.amount; else gift = eff.amount;
  }
  const rest = r2(due - discount - gift);
  let rows;
  if (Array.isArray(b.payments) && b.payments.length) {
    if (b.payments.length > MAX_SPLIT) throw new HttpError(400, `Al massimo ${MAX_SPLIT} quote di pagamento.`);
    rows = b.payments.map((p, i) => {
      const method = str(p.method) || 'contanti';
      const amount = r2(String(p.amount).replace(',', '.'));
      if (!(amount > 0)) throw new HttpError(400, `Quota ${i + 1}: importo non valido.`);
      if (/^buono$/i.test(method)) throw new HttpError(400, 'Il buono si inserisce con il suo codice, non come metodo.');
      if (/non\s*tracciat/i.test(method)) throw new HttpError(400, 'Ogni quota deve avere un metodo di pagamento registrato (contanti, carta, bonifico…).');
      if (method.length > 30) throw new HttpError(400, `Quota ${i + 1}: metodo non valido.`);
      return { method, amount, payer: str(p.payer)?.slice(0, 60) || null };
    });
    const sum = r2(rows.reduce((a, x) => a + x.amount, 0));
    if (Math.abs(sum - rest) > 0.005) throw new HttpError(400, `Le quote (${sum.toFixed(2)} €) devono coincidere con il totale da pagare (${rest.toFixed(2)} €).`);
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
    if (!r.changes) throw new HttpError(409, 'Il buono è stato appena usato o non è più valido: ripeti l’operazione.');
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
  const adminOnly = (req) => { if (req.user && req.user.role !== 'admin') throw new HttpError(403, 'Solo l’amministratore può farlo.'); };

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
    if (!(value > 0)) throw new HttpError(400, 'Importo non valido');
    if (kind === 'sconto_percentuale' && value > 100) throw new HttpError(400, 'La percentuale non può superare 100');
    let code = normCode(b.code) || newVoucherCode();
    if (code.length < 4 || code.length > 30 || !/^[A-Z0-9-]+$/.test(code)) throw new HttpError(400, 'Codice non valido: solo lettere, cifre e trattino (4-30 caratteri).');
    if (await db.prepare('SELECT id FROM vouchers WHERE code = ?').get(code)) throw new HttpError(409, 'Esiste già un buono con questo codice.');
    const exp = str(b.expires_at);
    if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) throw new HttpError(400, 'Data di scadenza non valida');
    const r = await db.prepare(`INSERT INTO vouchers (code, kind, value, balance, expires_at, customer_id, notes, created_at) VALUES (?,?,?,?,?,?,?,${NOW})`)
      .run(code, kind, value, kind === 'sconto_percentuale' ? 1 : value, exp, b.customer_id || null, str(b.notes));
    return decorate(await db.prepare('SELECT * FROM vouchers WHERE id = ?').get(r.lastInsertRowid));
  }));

  app.get('/api/buoni/:id', h(async (req) => {
    const v = await db.prepare('SELECT v.*, c.name AS customer_name FROM vouchers v LEFT JOIN customers c ON c.id=v.customer_id WHERE v.id = ?').get(req.params.id);
    if (!v) throw new HttpError(404, 'Buono non trovato');
    return { ...decorate(v), uses: await db.prepare('SELECT * FROM voucher_uses WHERE voucher_id = ? ORDER BY id DESC').all(v.id) };
  }));

  app.post('/api/buoni/:id/annulla', h(async (req) => {
    adminOnly(req);
    const r = await db.prepare("UPDATE vouchers SET status = 'annullato' WHERE id = ?").run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Buono non trovato');
    return decorate(await db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id));
  }));

  app.delete('/api/buoni/:id', h(async (req) => {
    adminOnly(req);
    if ((await db.prepare('SELECT COUNT(*) AS n FROM voucher_uses WHERE voucher_id = ?').get(req.params.id)).n) throw new HttpError(409, 'Il buono è già stato usato: non si elimina (si può annullare).');
    await db.prepare('DELETE FROM vouchers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Buono stampabile (A5 orizzontale, con codice a barre e QR)
  if (page) {
    app.get('/print/voucher/:id', page(async (c) => {
      const v = await db.prepare('SELECT * FROM vouchers WHERE id = ?').get(c.req.param('id'));
      if (!v) throw new HttpError(404, 'Buono non trovato');
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
