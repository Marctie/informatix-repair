// Preventivo inviabile al cliente DALLA SCHEDA RIPARAZIONE: crea (o ritrova) il preventivo online collegato alla riparazione,
// con validita' in giorni (predefinita da Impostazioni, modificabile) e il link /p/<codice> da mandare per WhatsApp, email o a mano.
// Riusa il preventivo autonomo (preventivi.mjs): firma, accettazione/rifiuto e scadenza sono quelli di sempre.
import { db, getSettings } from './dbref.mjs';
import { HttpError, money, localDate, getRepair } from './logic.mjs';
import { createQuote, updateQuote, shareQuote, getQuote, DEFAULT_VALID_DAYS } from './preventivi.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const eur = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dIt = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('it-IT') : '—');
const addDays = (ymd, n) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export const SEND_VIA = ['whatsapp', 'email', 'link'];

/** Quante giorni di validita': quelli indicati (1-365) oppure il predefinito di Impostazioni. */
export async function validityDays(requested) {
  if (requested !== undefined && requested !== null && requested !== '') {
    const n = Math.round(num(requested, NaN));
    if (!Number.isFinite(n) || n < 1 || n > 365) throw new HttpError(400, 'La validità del preventivo indicata non è ammessa: deve essere tra 1 e 365 giorni.', { code: 'VALIDITA_NON_VALIDA', hint: 'Scrivi un numero di giorni da 1 a 365.' });
    return n;
  }
  return Math.max(1, Math.round(num((await getSettings()).quote_valid_days, DEFAULT_VALID_DAYS)) || DEFAULT_VALID_DAYS);
}

/** Voci del preventivo ricavate dalla riparazione: ricambi con prezzo + manodopera (importo del preventivo meno i ricambi), oppure una voce unica. */
export function itemsFromRepair(r) {
  const lines = [];
  // preventivo scritto IVA esclusa: le voci si mostrano in imponibile (ricambi scorporati, manodopera = il resto) e il totale torna identico
  const net = r.quote_vat_mode === 'net' && r.quote_net != null;
  const k = 1 + (Number(r.quote_vat_rate ?? 22) / 100);
  const conv = (x) => (net ? Math.round((x / k) * 100) / 100 : x);
  const parts = (r.parts || []).filter((p) => p.unit_price > 0);
  for (const p of parts) lines.push({ description: p.name, qty: p.qty, unit_price: conv(p.unit_price) });
  const partsTotal = parts.reduce((s, p) => s + p.qty * conv(p.unit_price), 0);
  const quote = net ? Number(r.quote_net) : r.quote == null ? null : Number(r.quote);
  if (quote != null && quote > 0) {
    const rest = money(quote - partsTotal);
    if (!lines.length) lines.push({ description: `Riparazione ${r.brand_model}${r.problem ? `: ${r.problem}` : ''}`.slice(0, 200), qty: 1, unit_price: money(quote) });
    else if (rest > 0.004) lines.push({ description: `Intervento di riparazione ${r.brand_model}`, qty: 1, unit_price: rest });
  }
  return lines;
}

/** Preventivo collegato alla riparazione ancora "vivo" (bozza, inviato o accettato): il piu' recente. */
async function activeQuoteId(repairId) {
  const row = await db.prepare("SELECT id FROM quotes WHERE repair_id = ? AND status IN ('bozza','inviato','accettato') ORDER BY id DESC LIMIT 1").get(repairId);
  return row?.id || null;
}

async function describe(q, repair, base) {
  const settings = await getSettings();
  const url = q.token && base ? `${base}/p/${q.token}` : null;
  const first = String(q.who || '').split(' ')[0];
  const text = url ? `Buongiorno${first ? ` ${first}` : ''}, da ${settings.shop_name || 'Informatix Repair'}: ecco il preventivo ${q.code} per la riparazione ${repair.brand_model} (${repair.code}), totale ${eur(q.total)}, valido fino al ${dIt(q.valid_until)}. Puoi leggerlo e accettarlo dal telefono qui: ${url}` : null;
  return { quote: q, url, text, phone: q.who_phone || null, email: q.who_email || null, subject: `Preventivo ${q.code} - ${settings.shop_name || 'Informatix Repair'}` };
}

/** Il preventivo online della riparazione (se c'e') con link e testi pronti. */
export async function repairQuoteInfo(repairId, base) {
  const repair = await getRepair(repairId);
  const id = await activeQuoteId(repair.id);
  if (!id) return { quote: null, url: null, text: null, phone: repair.customer_phone || null, email: repair.customer_email || null, default_days: await validityDays(), items: itemsFromRepair(repair) };
  return { ...(await describe(await getQuote(id), repair, base)), default_days: await validityDays() };
}

/** Crea/collega il preventivo, ne fissa la validita' e lo rende apribile dal cliente (bozza -> inviato). Idempotente: richiamarlo riusa lo stesso preventivo. */
export async function sendRepairQuote(repairId, b, base) {
  const repair = await getRepair(repairId);
  if (['delivered', 'cancelled'].includes(repair.status)) throw new HttpError(409, `Riparazione ${repair.code}: è già ${repair.status === 'delivered' ? 'consegnata' : 'annullata'}, quindi non si invia più un preventivo.`, { code: 'RIPARAZIONE_CONCLUSA', hint: 'Il preventivo si invia solo mentre la riparazione è in corso.' });
  if (!repair.customer_id) throw new HttpError(400, `Riparazione ${repair.code}: manca il cliente, quindi non so a chi mandare il preventivo.`, { code: 'CLIENTE_MANCANTE', hint: 'Collega la scheda a un cliente e riprova.' });
  const via = str(b.via);
  if (via && !SEND_VIA.includes(via)) throw new HttpError(400, 'Il canale scelto per l’invio non è tra quelli previsti.', { code: 'CANALE_NON_VALIDO', hint: 'Scegli uno dei canali proposti (WhatsApp, SMS, email…).' });
  const days = await validityDays(b.valid_days);
  const explicit = str(b.valid_until);
  const hasValidity = b.valid_days !== undefined && b.valid_days !== '' || !!explicit;
  const valid_until = explicit || addDays(localDate(), days);
  let id = await activeQuoteId(repair.id);
  const wanted = Array.isArray(b.items) && b.items.length ? b.items : null;
  if (!id) {
    const items = wanted || itemsFromRepair(repair);
    if (!items.length) throw new HttpError(400, `Riparazione ${repair.code}: non c’è nessuna voce da far vedere al cliente (manca l’importo o i ricambi con prezzo).`, { code: 'PREVENTIVO_VUOTO', hint: 'Scrivi l’importo del preventivo nella scheda (o aggiungi ricambi con prezzo) e riprova.' });
    const net = repair.quote_vat_mode === 'net' && repair.quote_net != null;
    const q = await createQuote({ customer_id: repair.customer_id, valid_until, items, vat_mode: net && !wanted ? 'net' : 'gross', vat_rate: repair.quote_vat_rate, notes: str(b.notes) || `Riparazione ${repair.code} · ${repair.brand_model}` });
    id = q.id;
    await db.prepare('UPDATE quotes SET repair_id = ? WHERE id = ?').run(repair.id, id);
  } else {
    const cur = await getQuote(id);
    if (cur.status === 'accettato') throw new HttpError(409, `Riparazione ${repair.code}: il cliente ha già accettato questo preventivo.`, { code: 'PREVENTIVO_GIA_ACCETTATO', hint: 'Non serve rinviarlo; per cambiarlo ritira prima l’accettazione.' });
    const patch = {};
    if (hasValidity || cur.expired) patch.valid_until = valid_until;
    if (wanted) patch.items = wanted;
    if ('notes' in b) patch.notes = str(b.notes);
    if (Object.keys(patch).length) await updateQuote(id, patch);
  }
  await shareQuote(id); // crea il link e porta la bozza a "inviato"
  if (via) {
    await db.prepare(`UPDATE quotes SET sent_at=${NOW}, sent_via=? WHERE id=?`).run(via, id);
  }
  return describe(await getQuote(id), repair, base);
}

export function registerRepairQuoteRoutes(app, h, { trackBase }) {
  app.get('/api/repairs/:id/online-quote', h(async (req) => repairQuoteInfo(req.params.id, await trackBase())));
  app.post('/api/repairs/:id/online-quote', h(async (req) => sendRepairQuote(req.params.id, req.body, await trackBase())));
}
