// Preventivi autonomi con data di validita': non dipendono da una riparazione (es. assemblaggio PC).
// Stati: bozza -> inviato -> accettato | rifiutato -> convertito (in riparazione o vendita). "Scaduto" non e' uno stato salvato: si calcola dalla data.
import { db, tx, getSettings, nowLocal } from './dbref.mjs';
import { cleanImage, clientIp } from './signatures.mjs';
import { HttpError, money, localDate, upsertCustomer, createRepair, createSale, newToken } from './logic.mjs';
import { nextDocCode } from './ordini.mjs';
import { parseRate, parseMode, quoteTotals } from './iva.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dIt = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('it-IT') : '—');

export const QUOTE_STATUS = { bozza: 'Bozza', inviato: 'Inviato', accettato: 'Accettato', rifiutato: 'Rifiutato', convertito: 'Convertito', scaduto: 'Scaduto' };
export const QUOTE_TABLES = ['quotes', 'quote_items', 'quote_signatures'];
export const DEFAULT_VALID_DAYS = 15;
export const DEFAULT_TERMS = 'Preventivo valido fino alla data indicata; oltre tale data prezzi e disponibilità possono variare. Importi IVA inclusa. I tempi di consegna dei ricambi e dei componenti dipendono dalla disponibilità dei fornitori. Per accettare, firmare in basso o confermare al banco.';
export const DEFAULT_TERMS_NET = 'Preventivo valido fino alla data indicata; oltre tale data prezzi e disponibilità possono variare. Prezzi indicati IVA esclusa: l’IVA è calcolata e riportata nel totale. I tempi di consegna dei ricambi e dei componenti dipendono dalla disponibilità dei fornitori. Per accettare, firmare in basso o confermare al banco.';
/** Condizioni predefinite secondo come sono scritti i prezzi: 'gross' = IVA inclusa, 'net' = IVA esclusa. */
export const TERMS = { gross: DEFAULT_TERMS, net: DEFAULT_TERMS_NET };

const addDays = (ymd, n) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const SELECT = `SELECT q.*, COALESCE(c.name, q.customer_name) AS who, COALESCE(c.phone, q.customer_phone) AS who_phone, c.email AS who_email,
  rp.code AS repair_code, sa.code AS sale_code,
  (SELECT COALESCE(SUM(qty*unit_price),0) FROM quote_items i WHERE i.quote_id=q.id) AS subtotal
  FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id LEFT JOIN repairs rp ON rp.id=q.repair_id LEFT JOIN sales sa ON sa.id=q.sale_id`;

function shape(q) {
  const today = localDate();
  const open = ['bozza', 'inviato'].includes(q.status);
  const expired = open && q.valid_until < today;
  const status_view = expired ? 'scaduto' : q.status;
  const days_left = open ? Math.round((new Date(`${q.valid_until}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000) : null;
  const t = quoteTotals({ subtotal: q.subtotal, discount: q.discount, mode: q.vat_mode || 'gross', rate: Number(q.vat_rate ?? 22) });
  const tradein_value = money(Math.max(0, Number(q.tradein_value) || 0));
  return { ...q, vat_mode: t.mode, vat_rate: t.rate, subtotal: money(q.subtotal), net: t.net, vat: t.vat, total: t.total, tradein_value, due: money(Math.max(0, t.total - tradein_value)), expired, days_left, status_view, status_label: QUOTE_STATUS[status_view] };
}

export async function getQuote(id) {
  const q = await db.prepare(`${SELECT} WHERE q.id = ?`).get(id);
  if (!q) throw new HttpError(404, 'Preventivo non trovato', { code: 'PREVENTIVO_NON_TROVATO', hint: 'Riapri l’elenco dei preventivi: potrebbe essere stato eliminato o il link non è più valido.' });
  return { ...shape(q), items: await db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY id').all(id), signature: await db.prepare('SELECT kind, signer_name, ip, signed_at, reason FROM quote_signatures WHERE quote_id = ? ORDER BY id DESC LIMIT 1').get(id) || null };
}

function cleanItems(list) {
  const items = (Array.isArray(list) ? list : []).map((i) => ({ description: str(i.description), qty: Math.max(1, Math.round(num(i.qty, 1))), unit_price: num(i.unit_price, 0) })).filter((i) => i.description);
  if (!items.length) throw new HttpError(400, 'Preventivo senza voci: serve almeno una voce con la descrizione compilata.', { code: 'PREVENTIVO_SENZA_VOCI', hint: 'Aggiungi una voce (lavoro o ricambio) con descrizione e prezzo e salva di nuovo.' });
  if (items.some((i) => !Number.isFinite(i.unit_price) || i.unit_price < 0)) throw new HttpError(400, 'Una voce del preventivo ha un prezzo non valido (non numerico o negativo).', { code: 'PREVENTIVO_PREZZO_NON_VALIDO', hint: 'Correggi il prezzo con un numero uguale o maggiore di zero.' });
  return items;
}

async function prepare(b, cur) {
  const customer_id = 'customer_id' in b ? b.customer_id || null : cur?.customer_id ?? null;
  if (customer_id && !(await db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id))) throw new HttpError(404, 'Il cliente scelto per il preventivo non esiste più in anagrafica.', { code: 'CLIENTE_NON_TROVATO', hint: 'Cerca di nuovo il cliente, oppure scrivi il nome a mano.' });
  const name = 'customer_name' in b ? str(b.customer_name) : cur?.customer_name ?? null;
  if (!customer_id && !name) throw new HttpError(400, 'Preventivo senza intestatario: non è stato scelto né scritto nessun cliente.', { code: 'PREVENTIVO_CLIENTE_MANCANTE', hint: 'Scegli il cliente dall’anagrafica oppure scrivine il nome.' });
  const settings = await getSettings();
  const days = Math.max(1, Math.round(num(settings.quote_valid_days, DEFAULT_VALID_DAYS)) || DEFAULT_VALID_DAYS);
  const valid_until = str(b.valid_until) || cur?.valid_until || addDays(localDate(), days);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valid_until)) throw new HttpError(400, 'La data di validità del preventivo non è valida (formato atteso AAAA-MM-GG).', { code: 'PREVENTIVO_VALIDITA_NON_VALIDA', hint: 'Scegli una data dal calendario.' });
  const discount = Math.max(0, num(b.discount, cur?.discount ?? 0));
  const items = b.items ? cleanItems(b.items) : null;
  const total = (items || cur?.items || []).reduce((s, i) => s + i.qty * i.unit_price, 0);
  if (discount > total + 0.001) throw new HttpError(400, 'Lo sconto indicato è più alto del totale delle voci del preventivo.', { code: 'SCONTO_SUPERA_TOTALE', hint: 'Abbassa lo sconto oppure controlla i prezzi delle voci.' });
  const vat_mode = parseMode(b.vat_mode, cur?.vat_mode ?? 'gross');
  const vat_rate = parseRate(b.vat_rate, cur?.vat_rate ?? (Number(settings.vat_rate) || 22));
  const tradein_value = Math.max(0, money(num('tradein_value' in b ? b.tradein_value : cur?.tradein_value, 0)));
  const tradein_desc = 'tradein_desc' in b ? str(b.tradein_desc) : cur?.tradein_desc ?? null;
  if (tradein_value > 0) {
    if (!tradein_desc) throw new HttpError(400, 'Permuta senza descrizione: scrivi cosa ritiri in permuta (es. iPhone 12 128 GB).', { code: 'PERMUTA_SENZA_DESCRIZIONE', hint: 'Compila la descrizione della permuta oppure azzera il valore.' });
    const tt = quoteTotals({ subtotal: total, discount, mode: vat_mode, rate: vat_rate });
    if (tradein_value > tt.total + 0.001) throw new HttpError(400, 'Il valore della permuta supera il totale del preventivo: non c’è nulla da pagare.', { code: 'PERMUTA_SUPERA_TOTALE', hint: 'Abbassa il valore della permuta oppure controlla i prezzi delle voci.' });
  }
  let terms = 'terms' in b ? str(b.terms) : cur?.terms ?? null;
  if (!terms || terms === TERMS.gross || terms === TERMS.net) terms = TERMS[vat_mode]; // condizioni di serie: seguono IVA inclusa/esclusa; quelle scritte a mano restano
  return { customer_id, name: customer_id ? null : name, phone: customer_id ? null : ('customer_phone' in b ? str(b.customer_phone) : cur?.customer_phone ?? null), valid_until, discount, items, vat_mode, vat_rate, tradein_value, tradein_desc: tradein_value > 0 ? tradein_desc : null,
    notes: 'notes' in b ? str(b.notes) : cur?.notes ?? null, terms };
}

export async function createQuote(b) {
  const p = await prepare(b, null);
  if (p.valid_until < localDate()) throw new HttpError(400, 'La data di validità scelta è già passata: il preventivo nascerebbe scaduto.', { code: 'PREVENTIVO_VALIDITA_PASSATA', hint: 'Scegli una data di oggi o futura.' });
  const items = p.items || cleanItems(b.items);
  return tx(async () => {
    const code = await nextDocCode('quotes', 'P');
    const r = await db.prepare(`INSERT INTO quotes (code, customer_id, customer_name, customer_phone, status, valid_until, discount, notes, terms, vat_mode, vat_rate, tradein_desc, tradein_value, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,${NOW},${NOW})`)
      .run(code, p.customer_id, p.name, p.phone, 'bozza', p.valid_until, money(p.discount), p.notes, p.terms, p.vat_mode, p.vat_rate, p.tradein_desc, p.tradein_value);
    const id = Number(r.lastInsertRowid);
    for (const i of items) await db.prepare('INSERT INTO quote_items (quote_id, description, qty, unit_price) VALUES (?,?,?,?)').run(id, i.description, i.qty, i.unit_price);
    return getQuote(id);
  });
}

export async function updateQuote(id, b) {
  const cur = await getQuote(id);
  if (cur.status === 'convertito') throw new HttpError(409, `Preventivo ${cur.code} già convertito in riparazione o vendita: non si modifica più.`, { code: 'PREVENTIVO_GIA_CONVERTITO', hint: 'Modifica la riparazione o la vendita nata dal preventivo, oppure fai un nuovo preventivo.' });
  const p = await prepare(b, cur);
  return tx(async () => {
    await db.prepare(`UPDATE quotes SET customer_id=?, customer_name=?, customer_phone=?, valid_until=?, discount=?, notes=?, terms=?, vat_mode=?, vat_rate=?, tradein_desc=?, tradein_value=?, updated_at=${NOW} WHERE id=?`)
      .run(p.customer_id, p.name, p.phone, p.valid_until, money(p.discount), p.notes, p.terms, p.vat_mode, p.vat_rate, p.tradein_desc, p.tradein_value, id);
    if (p.items) {
      await db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(id);
      for (const i of p.items) await db.prepare('INSERT INTO quote_items (quote_id, description, qty, unit_price) VALUES (?,?,?,?)').run(id, i.description, i.qty, i.unit_price);
    }
    return getQuote(id);
  });
}

const MOVES = { bozza: ['inviato', 'accettato', 'rifiutato'], inviato: ['accettato', 'rifiutato', 'bozza'], accettato: ['rifiutato', 'inviato'], rifiutato: ['bozza', 'inviato'], convertito: [] };

export async function setQuoteStatus(id, status) {
  const q = await getQuote(id);
  if (!MOVES[q.status]) throw new HttpError(400, `Preventivo ${q.code}: lo stato attuale “${q.status}” non è riconosciuto.`, { code: 'STATO_PREVENTIVO_NON_VALIDO', hint: 'Aggiorna la pagina e riprova; se resta, avvisa Marco.' });
  if (status === q.status) return q;
  if (!MOVES[q.status].includes(status)) throw new HttpError(409, `Preventivo ${q.code}: da “${QUOTE_STATUS[q.status]}” non si passa a “${QUOTE_STATUS[status] || status}”.`, { code: 'PREVENTIVO_PASSAGGIO_NON_AMMESSO', hint: 'Scegli uno degli stati proposti per questo preventivo.' });
  if (status === 'accettato' && q.expired) throw new HttpError(409, `Il preventivo ${q.code} è scaduto il ${q.valid_until}: non si può procedere.`, { code: 'PREVENTIVO_SCADUTO', hint: 'Apri il preventivo, prolunga la data di validità e riprova.' });
  await db.prepare(`UPDATE quotes SET status=?, updated_at=${NOW} WHERE id=?`).run(status, id);
  return getQuote(id);
}

/** Converte in riparazione (to='repair') o vendita (to='sale'). La vendita incassa subito: serve il metodo di pagamento. */
export async function convertQuote(id, b) {
  const q = await getQuote(id);
  if (q.status === 'convertito') throw new HttpError(409, `Preventivo ${q.code} già convertito: non si converte due volte.`, { code: 'PREVENTIVO_GIA_CONVERTITO', hint: 'Apri la riparazione o la vendita già creata dal preventivo.' });
  if (q.status === 'rifiutato') throw new HttpError(409, `Preventivo ${q.code} rifiutato dal cliente: non si può procedere.`, { code: 'PREVENTIVO_RIFIUTATO', hint: 'Riportalo in bozza o inviato se il cliente ha cambiato idea.' });
  if (q.expired) throw new HttpError(409, `Il preventivo ${q.code} è scaduto il ${q.valid_until}: non si può procedere.`, { code: 'PREVENTIVO_SCADUTO', hint: 'Apri il preventivo, prolunga la data di validità e riprova.' });
  if (b.to === 'repair') {
    const brand = str(b.brand_model);
    if (!brand) throw new HttpError(400, `Preventivo ${q.code}: per aprire la riparazione serve il dispositivo (marca e modello) e non è stato scritto.`, { code: 'DISPOSITIVO_MANCANTE', hint: 'Scrivi marca e modello del dispositivo e converti di nuovo.' });
    return tx(async () => {
      const customerId = q.customer_id || (await upsertCustomer({ name: q.who, phone: q.who_phone }));
      const r = await createRepair({ customer: { id: customerId }, brand_model: brand, problem: str(b.problem) || q.items.map((i) => i.description).join(', '), quote: q.tradein_value > 0 ? q.due : q.vat_mode === 'net' ? q.net : q.total, quote_mode: q.tradein_value > 0 ? 'gross' : q.vat_mode, quote_vat_rate: q.vat_rate, quote_agreed: q.status === 'accettato', device_type: b.device_type });
      await db.prepare(`UPDATE quotes SET status='convertito', customer_id=?, repair_id=?, updated_at=${NOW} WHERE id=?`).run(customerId, r.id, id);
      return { quote: await getQuote(id), repair: r };
    });
  }
  if (b.to === 'sale') {
    return tx(async () => {
      // la cassa lavora con prezzi IVA compresa: se il preventivo e' IVA esclusa si portano le voci a prezzo IVA compresa e lo sconto si ricalcola perche' il totale resti identico
      const k = q.vat_mode === 'net' ? 1 + q.vat_rate / 100 : 1;
      const lines = q.items.map((i) => ({ name: i.description, qty: i.qty, unit_price: Math.round(i.unit_price * k * 10000) / 10000 }));
      // con permuta la vendita incassa solo il da pagare: il valore della permuta entra nello sconto e resta scritto nelle note
      const discount = q.vat_mode === 'net' || q.tradein_value > 0 ? Math.max(0, money(lines.reduce((s2, l) => s2 + l.qty * l.unit_price, 0) - q.due)) : q.discount;
      const sale = await createSale({ customer_id: q.customer_id || null, discount, method: str(b.method) || 'contanti', notes: `Da preventivo ${q.code}${q.vat_mode === 'net' ? ` (prezzi IVA esclusa, IVA ${q.vat_rate}% inclusa nel totale)` : ''}${q.tradein_value > 0 ? ` - permuta: ${q.tradein_desc} valutata ${eur(q.tradein_value)}` : ''}`, items: lines });
      await db.prepare(`UPDATE quotes SET status='convertito', sale_id=?, updated_at=${NOW} WHERE id=?`).run(sale.id, id);
      return { quote: await getQuote(id), sale };
    });
  }
  throw new HttpError(400, `Preventivo ${q.code}: non è stato scelto in cosa convertirlo.`, { code: 'CONVERSIONE_NON_SCELTA', hint: 'Scegli “in riparazione” oppure “in vendita”.' });
}

/** Crea (se manca) il codice del link online. Un preventivo in bozza passa a "inviato". */
export async function shareQuote(id) {
  const q = await getQuote(id);
  if (q.status === 'convertito') throw new HttpError(409, `Preventivo ${q.code} già convertito: non si invia più al cliente.`, { code: 'PREVENTIVO_GIA_CONVERTITO', hint: 'Non serve rinviarlo: la pratica è già aperta.' });
  if (q.status === 'rifiutato') throw new HttpError(409, `Preventivo ${q.code} rifiutato dal cliente: non si può procedere.`, { code: 'PREVENTIVO_RIFIUTATO', hint: 'Riportalo in bozza o inviato se il cliente ha cambiato idea.' });
  if (q.expired) throw new HttpError(409, `Il preventivo ${q.code} è scaduto il ${q.valid_until}: non si può procedere.`, { code: 'PREVENTIVO_SCADUTO', hint: 'Apri il preventivo, prolunga la data di validità e riprova.' });
  let token = q.token;
  if (!token) { token = newToken(); await db.prepare('UPDATE quotes SET token = ? WHERE id = ?').run(token, id); }
  if (q.status === 'bozza') await db.prepare(`UPDATE quotes SET status='inviato', updated_at=${NOW} WHERE id=?`).run(id);
  return { token };
}

/** Firma registrata dal cliente dal link (senza l'immagine). */
const lastQuoteSig = (id) => db.prepare('SELECT kind, signer_name, ip, signed_at FROM quote_signatures WHERE quote_id = ? ORDER BY id DESC LIMIT 1').get(id);

/** Vista pubblica per il cliente: niente telefono ne' email, solo cio' che serve per decidere. */
export async function quoteView(token) {
  const row = token ? await db.prepare(`${SELECT} WHERE q.token = ?`).get(token) : null;
  if (!row) throw new HttpError(404, 'Preventivo non trovato', { code: 'PREVENTIVO_NON_TROVATO', hint: 'Riapri l’elenco dei preventivi: potrebbe essere stato eliminato o il link non è più valido.' });
  const q = shape(row);
  const items = await db.prepare('SELECT description, qty, unit_price FROM quote_items WHERE quote_id = ? ORDER BY id').all(q.id);
  const s = await getSettings();
  const sig = await lastQuoteSig(q.id);
  return {
    code: q.code, who: q.who, status: q.status, status_view: q.status_view, status_label: q.status_label, decision: q.status === 'accettato' ? 'accettato' : q.status === 'rifiutato' ? 'rifiutato' : null,
    valid_until: q.valid_until, expired: q.expired, days_left: q.days_left, items: items.map((i) => ({ ...i, total: money(i.qty * i.unit_price) })),
    subtotal: q.subtotal, discount: q.discount, total: q.total, vat_mode: q.vat_mode, vat_rate: q.vat_rate, net: q.net, vat: q.vat, tradein_desc: q.tradein_value > 0 ? q.tradein_desc : null, tradein_value: q.tradein_value, due: q.due, notes: q.notes, terms: q.terms || TERMS[q.vat_mode],
    can_answer: q.status === 'inviato' && !q.expired,
    signed: sig ? { kind: sig.kind, signed_at: sig.signed_at } : null,
    shop: { name: s.shop_name, address: s.shop_address, phone: s.shop_phone },
  };
}

/** Risposta del cliente dal link: accetta o rifiuta, sempre con firma disegnata (data, ora e IP registrati). */
export async function quoteDecision(token, b, c) {
  const row = token ? await db.prepare(`${SELECT} WHERE q.token = ?`).get(token) : null;
  if (!row) throw new HttpError(404, 'Preventivo non trovato', { code: 'PREVENTIVO_NON_TROVATO', hint: 'Riapri l’elenco dei preventivi: potrebbe essere stato eliminato o il link non è più valido.' });
  const q = shape(row);
  if (q.status !== 'inviato') throw new HttpError(409, 'Questo preventivo non è in attesa di risposta (è già stato deciso o non è stato inviato).', { code: 'PREVENTIVO_NON_IN_ATTESA', hint: 'Contatta il negozio se vuoi cambiare la tua risposta.' });
  if (q.expired) throw new HttpError(409, 'Il preventivo è scaduto e non si può più accettare da questo link.', { code: 'PREVENTIVO_SCADUTO', hint: 'Contatta il negozio per averne uno aggiornato.' });
  const action = String(b?.action || '');
  if (!['accept', 'decline'].includes(action)) throw new HttpError(400, 'La risposta al preventivo non è valida: va scelto accetto oppure rifiuto.', { code: 'SCELTA_NON_VALIDA', hint: 'Premi “Accetto” oppure “Non accetto”.' });
  const image = cleanImage(b.image);
  const name = String(b.signer_name ?? '').trim().slice(0, 120) || null;
  const reason = action === 'decline' ? String(b.reason ?? '').trim().slice(0, 300) || null : null;
  const tot0 = q.vat_mode === 'net' ? `${eur(q.total)} (imponibile ${eur(q.net)} + IVA ${q.vat_rate}% ${eur(q.vat)})` : eur(q.total);
  const tot = q.tradein_value > 0 ? `${tot0}, con permuta di ${q.tradein_desc} valutata ${eur(q.tradein_value)}: da pagare ${eur(q.due)}` : tot0;
  const shown = action === 'accept'
    ? `Accetto il preventivo ${q.code} di ${tot}, valido fino al ${dIt(q.valid_until)}, alle condizioni indicate.`
    : `Non accetto il preventivo ${q.code} di ${tot}.`;
  await tx(async () => {
    const r = await db.prepare(`UPDATE quotes SET status=?, updated_at=${NOW} WHERE id=? AND status='inviato'`).run(action === 'accept' ? 'accettato' : 'rifiutato', q.id);
    if (!r.changes) throw new HttpError(409, 'Il preventivo ha già ricevuto una risposta un attimo fa: la tua non è stata registrata.', { code: 'PREVENTIVO_NON_IN_ATTESA', hint: 'Ricarica la pagina per vedere la risposta già registrata.' });
    await db.prepare('INSERT INTO quote_signatures (quote_id, kind, image, signer_name, text_shown, ip, user_agent, signed_at, reason) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(q.id, action, image, name, shown, clientIp(c) || null, String(c?.req.header('user-agent') || '').slice(0, 200) || null, nowLocal(), reason);
  });
  return quoteView(token);
}

export function registerPublicQuoteRoutes(app, h) {
  app.get('/api/quote/:token', h((req) => quoteView(req.params.token)));
  app.post('/api/quote/:token/decision', h((req) => quoteDecision(req.params.token, req.body, req.c)));
}

/** Avvisi: preventivi inviati che stanno per scadere (entro 3 giorni) o sono scaduti senza risposta. */
export async function quoteAlerts() {
  const rows = await db.prepare(`${SELECT} WHERE q.status = 'inviato'`).all();
  const out = [];
  for (const r of rows) {
    const q = shape(r);
    const tot = eur(q.due);
    if (q.expired) out.push({ type: 'quote_expired', severity: 'low', title: `Preventivo ${q.code} scaduto`, detail: `${q.who} (${tot}): scaduto il ${dIt(q.valid_until)} senza risposta. Richiamalo o archivialo.`, link: '#/preventivi?stato=inviato', ref: q.id });
    else if (q.days_left <= 3) out.push({ type: 'quote_expiring', severity: 'medium', title: `Preventivo ${q.code} in scadenza`, detail: `${q.who} (${tot}): ${q.days_left === 0 ? 'scade oggi' : `scade tra ${q.days_left} giorni`}. Sollecita la risposta.`, link: '#/preventivi?stato=inviato', ref: q.id });
  }
  return out;
}

function printQuote(q, s, { noprint } = {}) {
  const rows = q.items.map((i) => `<tr><td>${esc(i.description)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${eur(i.unit_price)}</td><td style="text-align:right">${eur(i.qty * i.unit_price)}</td></tr>`).join('');
  const auto = noprint ? '' : `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Preventivo ${esc(q.code)}</title><style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:22px;font-size:12.5px;line-height:1.4}
  h1{font-size:20px;margin:0} .muted{color:#555} .big{font-size:22px;font-weight:700} .row{display:flex;gap:16px;justify-content:space-between;align-items:flex-start}
  table{width:100%;border-collapse:collapse;margin-top:16px} th{font-size:11px;color:#555;text-align:left;border-bottom:2px solid #111;padding:5px 6px} td{padding:6px;border-bottom:1px solid #ddd;vertical-align:top}
  .valid{margin-top:16px;border:2px solid #B91C1C;border-radius:8px;padding:9px 12px;font-size:14px} .valid b{color:#B91C1C}
  .tot{text-align:right;margin-top:12px} .terms{font-size:10px;color:#444;margin-top:18px} .sign{margin-top:46px;display:flex;gap:40px} .sign div{flex:1;border-top:1px solid #333;padding-top:3px;font-size:11px;color:#555}
  .noprint{margin-bottom:12px} .noprint button{padding:8px 14px;font-weight:700;cursor:pointer} @media print{.noprint{display:none} body{padding:0} @page{size:A4;margin:14mm}}
  </style></head><body><div class="noprint"><button onclick="window.print()">Stampa / salva PDF</button></div>
  <div class="row"><div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
    <div style="text-align:right"><div class="muted">Preventivo</div><div class="big">${esc(q.code)}</div><div class="muted">del ${dIt(q.created_at)}</div></div></div>
  <p style="margin-top:16px"><span class="muted">Per</span><br><b style="font-size:15px">${esc(q.who)}</b>${q.who_phone ? `<br>Tel. ${esc(q.who_phone)}` : ''}${q.who_email ? ` · ${esc(q.who_email)}` : ''}</p>
  <div class="valid">Preventivo valido fino al <b>${dIt(q.valid_until)}</b></div>
  <table><tr><th>Descrizione</th><th style="text-align:center">Q.tà</th><th style="text-align:right">Prezzo${q.vat_mode === 'net' ? ' (IVA escl.)' : ''}</th><th style="text-align:right">Totale${q.vat_mode === 'net' ? ' (IVA escl.)' : ''}</th></tr>${rows}</table>
  <div class="tot">${q.discount ? `<div class="muted">Sconto: -${eur(q.discount)}</div>` : ''}${q.vat_mode === 'net' ? `<div class="muted">Imponibile (prezzi IVA esclusa): ${eur(q.net)}</div><div class="muted">IVA ${q.vat_rate}%: ${eur(q.vat)}</div>` : ''}${q.tradein_value > 0 ? `<div class="muted">Totale preventivo${q.vat_mode === 'net' ? ' IVA inclusa' : ''}: ${eur(q.total)}</div><div class="muted">Permuta (${esc(q.tradein_desc)}): -${eur(q.tradein_value)}</div><div class="big">Da pagare ${eur(q.due)}</div>` : `<div class="big">Totale ${q.vat_mode === 'net' ? 'IVA inclusa ' : ''}${eur(q.total)}</div>`}</div>
  ${q.notes ? `<p style="margin-top:14px"><b>Note:</b> ${esc(q.notes)}</p>` : ''}
  <p class="terms">${esc(q.terms || TERMS[q.vat_mode])}</p>
  <div class="sign"><div>Firma del cliente per accettazione</div><div>Data</div></div>${auto}</body></html>`;
}

export function registerQuoteRoutes(app, h) {
  app.get('/api/quotes', h(async (req) => {
    const where = [];
    const args = [];
    const st = req.query.stato;
    if (st === 'scaduto') where.push("q.status IN ('bozza','inviato') AND q.valid_until < ?"), args.push(localDate());
    else if (st === 'aperti') where.push("q.status IN ('bozza','inviato','accettato')");
    else if (st) { where.push('q.status = ?'); args.push(st); }
    const q = str(req.query.q);
    if (q) { where.push('(q.code LIKE ? OR c.name LIKE ? OR q.customer_name LIKE ? OR EXISTS (SELECT 1 FROM quote_items i WHERE i.quote_id=q.id AND i.description LIKE ?))'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    const list = await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY q.id DESC LIMIT 300`).all(...args);
    return list.map(shape);
  }));
  app.get('/api/quotes/meta', h(async () => ({ statuses: QUOTE_STATUS, valid_days: Math.round(num((await getSettings()).quote_valid_days, DEFAULT_VALID_DAYS)) || DEFAULT_VALID_DAYS, terms: DEFAULT_TERMS, terms_gross: TERMS.gross, terms_net: TERMS.net, vat_rate: Number((await getSettings()).vat_rate) || 22 })));
  app.get('/api/quotes/:id', h((req) => getQuote(req.params.id)));
  app.post('/api/quotes', h((req) => createQuote(req.body)));
  app.put('/api/quotes/:id', h((req) => updateQuote(req.params.id, req.body)));
  app.post('/api/quotes/:id/status', h((req) => setQuoteStatus(req.params.id, req.body.status)));
  app.post('/api/quotes/:id/link', h((req) => shareQuote(req.params.id)));
  app.post('/api/quotes/:id/convert', h((req) => convertQuote(req.params.id, req.body)));
  app.delete('/api/quotes/:id', h(async (req) => {
    const q = await getQuote(req.params.id);
    await db.prepare('DELETE FROM quotes WHERE id = ?').run(q.id);
    return { ok: true };
  }));
  app.get('/print/quote/:id', async (c) => {
    try { return c.html(printQuote(await getQuote(c.req.param('id')), await getSettings(), { noprint: c.req.query('noprint') === '1' })); } catch (e) { return c.text(e.message || 'Errore', e.status || 500); }
  });
}
