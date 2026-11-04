// Estensioni di garanzia a pagamento, documenti scaricabili dal cliente e listino pubblico (spunti da Fixh IT ed e-Share).
//  - Estensione: si vende come una vendita normale (cassa, Registro, avvisi) e genera un certificato con link pubblico /g/<token>.
//  - Ricevuta di vendita con link pubblico /r/<token>, da mandare su WhatsApp.
//  - Dal link della riparazione (/t/<token>) il cliente scarica ricevuta e certificato di garanzia (/t/<token>/certificato).
//  - Listino pubblico delle riparazioni: /listino (pagina) e /api/listino (dati per il sito), solo le voci segnate "pubblica".
import { cors } from 'hono/cors';
import { db, getSettings, nowLocal } from './dbref.mjs';
import { HttpError, money, localDate, newToken, createSale, getSale } from './logic.mjs';
import { MARGIN_NOTE } from './margine.mjs';

const str = (v) => (v == null ? null : String(v).trim() || null);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;
const dmy = (d) => { const m = String(d || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const addMonths = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const SALE_WARRANTY_MONTHS = 24; // garanzia legale sui beni nuovi venduti al consumatore

async function nextCode() {
  const y = nowLocal().slice(0, 4);
  const row = await db.prepare('SELECT MAX(CAST(substr(code, 8) AS INTEGER)) AS n FROM warranty_ext WHERE code LIKE ?').get(`G-${y}-%`);
  return `G-${y}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

/** Da quando parte l'estensione: alla fine della garanzia che c'e' gia' (o dell'ultima estensione). */
async function baseOf(kind, refId) {
  if (kind === 'repair') {
    const r = await db.prepare('SELECT r.id, r.code, r.brand_model, r.customer_id, r.delivered_at, r.warranty_days FROM repairs r WHERE r.id = ?').get(refId);
    if (!r) throw new HttpError(404, 'Riparazione non trovata', { code: 'RIPARAZIONE_NON_TROVATA', hint: 'Aggiorna la pagina.' });
    if (!r.delivered_at) throw new HttpError(409, `La riparazione ${r.code} non è ancora consegnata: la garanzia parte dalla consegna.`, { code: 'NON_CONSEGNATA', hint: 'Vendi l’estensione al momento della consegna o dopo.' });
    return { code: r.code, what: r.brand_model, customer_id: r.customer_id, ends: addDays(String(r.delivered_at).slice(0, 10), r.warranty_days) };
  }
  if (kind === 'sale') {
    const s = await db.prepare('SELECT id, code, customer_id, created_at FROM sales WHERE id = ?').get(refId);
    if (!s) throw new HttpError(404, 'Vendita non trovata', { code: 'VENDITA_NON_TROVATA', hint: 'Aggiorna la pagina.' });
    const items = await db.prepare('SELECT name FROM sale_items WHERE sale_id = ? AND name NOT LIKE ?').all(s.id, 'Estensione garanzia%');
    return { code: s.code, what: items.map((i) => i.name).join(', ') || 'Articoli venduti', customer_id: s.customer_id, ends: addMonths(String(s.created_at).slice(0, 10), SALE_WARRANTY_MONTHS) };
  }
  throw new HttpError(400, 'Tipo non valido: l’estensione si collega a una riparazione o a una vendita.', { code: 'TIPO_NON_VALIDO', hint: 'Apri la riparazione o la vendita e usa il pulsante da lì.' });
}

export async function getExtension(id) {
  const w = await db.prepare('SELECT * FROM warranty_ext WHERE id = ?').get(id);
  if (!w) throw new HttpError(404, 'Estensione di garanzia non trovata', { code: 'ESTENSIONE_NON_TROVATA', hint: 'Aggiorna la pagina.' });
  return { ...w, active: !w.cancelled && w.ends_on >= localDate(), url_path: `/g/${w.token}` };
}

export async function sellExtension(b) {
  const kind = b.kind === 'sale' ? 'sale' : 'repair';
  const refId = Number(b.ref_id);
  const months = Math.round(Number(b.months));
  if (![3, 6, 12, 24, 36].includes(months)) throw new HttpError(400, 'Durata non valida: scegli 3, 6, 12, 24 o 36 mesi.', { code: 'DURATA_NON_VALIDA', hint: 'Scegli la durata dal menu.' });
  const price = money(Number(String(b.price ?? '').replace(',', '.')));
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Prezzo dell’estensione non valido.', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi il prezzo, 0 se è in omaggio.' });
  const base = await baseOf(kind, refId);
  const last = await db.prepare('SELECT MAX(ends_on) AS e FROM warranty_ext WHERE kind = ? AND ref_id = ? AND cancelled = 0').get(kind, refId);
  const from = [base.ends, last?.e, localDate()].filter(Boolean).sort().at(-1);
  const starts = addDays(from, 1);
  const ends = addMonths(from, months);
  const description = str(b.description)?.slice(0, 200) || `Estensione garanzia ${months} mesi – ${base.what} (${base.code})`;
  let saleId = null;
  if (price > 0) {
    const sale = await createSale({ customer_id: base.customer_id, items: [{ name: description, qty: 1, unit_price: price, unit_cost: 0 }], method: b.method, payments: b.payments, appeso: b.appeso, notes: `Estensione di garanzia su ${base.code}` });
    saleId = sale.id;
  }
  const code = await nextCode();
  const r = await db.prepare("INSERT INTO warranty_ext (code, token, kind, ref_id, customer_id, description, months, price, starts_on, ends_on, sale_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))")
    .run(code, newToken(), kind, refId, base.customer_id || null, description, months, price, starts, ends, saleId);
  return { ...(await getExtension(Number(r.lastInsertRowid))), ref_code: base.code, sale_code: saleId ? (await getSale(saleId)).code : null };
}

export const listExtensions = (kind, refId) => db.prepare('SELECT * FROM warranty_ext WHERE (? IS NULL OR kind = ?) AND (? IS NULL OR ref_id = ?) ORDER BY id DESC LIMIT 300').all(kind || null, kind || null, refId || null, refId || null);

// ---------- Pagine pubbliche (HTML semplice, stampabile; nessun dato personale oltre al nome) ----------
const shell = (title, body, shop) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:0 auto;padding:16px;color:#111;background:#f8fafc}main{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px #0001}h1{font-size:1.35rem;margin:0 0 .5rem}h2{font-size:1rem;margin:1.2rem 0 .4rem}table{width:100%;border-collapse:collapse}td,th{padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:.95rem}td.n,th.n{text-align:right;white-space:nowrap}.mut{color:#555;font-size:.85rem}.tot{font-weight:700;font-size:1.1rem}.btn{display:inline-block;margin-top:14px;padding:10px 16px;border-radius:10px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;border:0;font-size:1rem;cursor:pointer}@media print{.btn{display:none}body{background:#fff}main{box-shadow:none}}</style></head>
<body><main>${body}<p class="mut">${esc(shop.shop_name || '')}${shop.shop_address ? ` · ${esc(shop.shop_address)}` : ''}${shop.shop_phone ? ` · tel. ${esc(shop.shop_phone)}` : ''}</p><button class="btn" onclick="print()">Stampa / salva PDF</button></main></body></html>`;
const notFound = (c) => c.html(shell('Documento non trovato', '<h1>Documento non trovato</h1><p>Il link non è valido o il documento è stato annullato. Contatta il negozio.</p>', {}), 404);

export async function saleReceiptHtml(token) {
  const s0 = await db.prepare('SELECT id FROM sales WHERE token = ?').get(String(token || ''));
  if (!s0) return null;
  const s = await getSale(s0.id);
  const shop = await getSettings();
  const margin = s.items.some((i) => i.margin_id);
  const rows = s.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="n">${i.qty}</td><td class="n">${eur(i.unit_price)}</td><td class="n">${eur(i.qty * i.unit_price)}</td></tr>`).join('');
  const body = `<h1>Ricevuta ${esc(s.code)}</h1><p class="mut">del ${dmy(s.created_at)}${s.customer_name ? ` · ${esc(s.customer_name)}` : ''}</p>
<table><tr><th>Articolo</th><th class="n">Q.tà</th><th class="n">Prezzo</th><th class="n">Totale</th></tr>${rows}
${s.discount > 0 ? `<tr><td colspan="3">Sconto</td><td class="n">-${eur(s.discount)}</td></tr>` : ''}
${s.tradein_value > 0 ? `<tr><td colspan="3">Permuta: ${esc(s.tradein_desc)}</td><td class="n">-${eur(s.tradein_value)}</td></tr>` : ''}
<tr><td colspan="3" class="tot">Totale pagato</td><td class="n tot">${eur(s.total)}</td></tr></table>
<p class="mut">Pagamento: ${esc(s.payments.map((p) => `${p.method} ${eur(p.amount)}`).join(' + ') || s.method)}</p>
${margin ? `<p class="mut">${esc(MARGIN_NOTE)}</p>` : ''}<p class="mut">Documento non fiscale: lo scontrino o la fattura sono consegnati in negozio.</p>`;
  return shell(`Ricevuta ${s.code}`, body, shop);
}

export async function certificateHtml(token) {
  const w = await db.prepare('SELECT w.*, c.name AS customer_name FROM warranty_ext w LEFT JOIN customers c ON c.id = w.customer_id WHERE w.token = ? AND w.cancelled = 0').get(String(token || ''));
  if (!w) return null;
  const shop = await getSettings();
  const body = `<h1>Certificato di estensione di garanzia</h1><p class="mut">n. ${esc(w.code)}${w.customer_name ? ` · intestato a ${esc(w.customer_name)}` : ''}</p>
<table><tr><td>Oggetto</td><td>${esc(w.description)}</td></tr><tr><td>Durata</td><td>${w.months} mesi</td></tr><tr><td>Valida</td><td>dal ${dmy(w.starts_on)} al ${dmy(w.ends_on)}</td></tr>
<tr><td>Stato</td><td><b>${w.ends_on >= localDate() ? 'ATTIVA' : 'SCADUTA'}</b></td></tr></table>
<p class="mut">Copre i difetti di funzionamento del lavoro o del prodotto indicato, alle stesse condizioni della garanzia del negozio. Non copre urti, liquidi, manomissioni e usura. Presenta questo certificato (anche dal telefono) in negozio.</p>`;
  return shell(`Garanzia ${w.code}`, body, shop);
}

export async function repairCertificateHtml(token) {
  const r = await db.prepare('SELECT r.*, c.name AS customer_name FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE r.token = ?').get(String(token || ''));
  if (!r || !r.delivered_at) return null;
  const shop = await getSettings();
  const until = addDays(String(r.delivered_at).slice(0, 10), r.warranty_days);
  const ext = await db.prepare("SELECT * FROM warranty_ext WHERE kind = 'repair' AND ref_id = ? AND cancelled = 0 ORDER BY ends_on").all(r.id);
  const paid = (await db.prepare("SELECT label, amount, method, created_at FROM payments WHERE kind = 'repair' AND ref_id = ? ORDER BY id").all(r.id));
  const body = `<h1>Ricevuta e garanzia della riparazione ${esc(r.code)}</h1><p class="mut">${esc(r.customer_name)} · consegnata il ${dmy(r.delivered_at)}</p>
<table><tr><td>Dispositivo</td><td>${esc(r.brand_model)}${r.serial ? ` (••••${esc(String(r.serial).slice(-4))})` : ''}</td></tr><tr><td>Problema</td><td>${esc(r.problem)}</td></tr>
<tr><td>Prezzo finale</td><td>${eur(r.final_price ?? r.quote)}</td></tr>${paid.map((p) => `<tr><td>${esc(p.label)}</td><td>${eur(p.amount)} · ${esc(p.method)} · ${dmy(p.created_at)}</td></tr>`).join('')}
<tr><td>Garanzia</td><td>${r.warranty_days} giorni, fino al <b>${dmy(until)}</b></td></tr>
${ext.map((w) => `<tr><td>Estensione ${esc(w.code)}</td><td>${w.months} mesi, fino al <b>${dmy(w.ends_on)}</b></td></tr>`).join('')}</table>
<p class="mut">La garanzia copre il lavoro eseguito e i ricambi montati. Non copre urti, liquidi, manomissioni. Documento non fiscale.</p>`;
  return shell(`Riparazione ${r.code}`, body, shop);
}

/** Documenti che il cliente puo' aprire dal suo link della riparazione. */
export async function repairDocuments(r) {
  const out = [];
  if (r.delivered_at) out.push({ label: 'Ricevuta e certificato di garanzia', url: `/t/${r.token}/certificato` });
  const ext = await db.prepare("SELECT code, token FROM warranty_ext WHERE kind = 'repair' AND ref_id = ? AND cancelled = 0").all(r.id);
  for (const w of ext) out.push({ label: `Estensione di garanzia ${w.code}`, url: `/g/${w.token}` });
  const q = await db.prepare("SELECT code, token FROM quotes WHERE repair_id = ? AND token IS NOT NULL ORDER BY id DESC LIMIT 1").get(r.id).catch(() => null);
  if (q) out.push({ label: `Preventivo ${q.code}`, url: `/p/${q.token}` });
  return out;
}

// ---------- Listino pubblico ----------
export async function publicPriceList() {
  const rows = await db.prepare('SELECT name, price, price_from, device_type, public_note FROM services WHERE active = 1 AND public = 1 ORDER BY device_type, name').all();
  return { updated: localDate(), items: rows.map((r) => ({ name: r.name, price: money(r.price), from: !!r.price_from, device_type: r.device_type || 'altro', note: r.public_note || null })) };
}
const DEVICE = { smartphone: 'Smartphone', tablet: 'Tablet', computer: 'Computer', console: 'Console', altro: 'Altri servizi' };
export async function priceListHtml() {
  const l = await publicPriceList();
  const shop = await getSettings();
  const groups = {};
  for (const i of l.items) (groups[i.device_type] ||= []).push(i);
  const body = `<h1>Listino riparazioni</h1><p class="mut">Prezzi IVA inclusa. «da» = prezzo minimo, il preventivo esatto si fa in negozio e prima di riparare.</p>
${Object.entries(groups).map(([k, list]) => `<h2>${esc(DEVICE[k] || k)}</h2><table>${list.map((i) => `<tr><td>${esc(i.name)}${i.note ? `<br><span class="mut">${esc(i.note)}</span>` : ''}</td><td class="n">${i.from ? 'da ' : ''}${eur(i.price)}</td></tr>`).join('')}</table>`).join('') || '<p>Listino in preparazione.</p>'}`;
  return shell('Listino riparazioni', body, shop);
}

/** Rotte pubbliche (host del tracciamento e gestionale). */
export function registerPublicDocRoutes(app) {
  app.use('/api/listino', cors({ origin: ['https://informatixrepair.com', 'https://www.informatixrepair.com'], allowMethods: ['GET'] }));
  app.get('/api/listino', async (c) => c.json(await publicPriceList()));
  app.get('/listino', async (c) => c.html(await priceListHtml()));
  app.get('/r/:token', async (c) => { const h = await saleReceiptHtml(c.req.param('token')); return h ? c.html(h) : notFound(c); });
  app.get('/g/:token', async (c) => { const h = await certificateHtml(c.req.param('token')); return h ? c.html(h) : notFound(c); });
  app.get('/t/:token/certificato', async (c) => { const h = await repairCertificateHtml(c.req.param('token')); return h ? c.html(h) : notFound(c); });
}

export function registerWarrantyRoutes(app, h, adminOnly, { trackBase }) {
  app.get('/api/garanzie', h((req) => listExtensions(req.query.kind, Number(req.query.ref_id) || null)));
  app.post('/api/garanzie', h((req) => sellExtension(req.body)));
  app.delete('/api/garanzie/:id{[0-9]+}', h(async (req) => {
    adminOnly(req);
    const w = await getExtension(req.params.id);
    await db.prepare('UPDATE warranty_ext SET cancelled = 1 WHERE id = ?').run(w.id);
    return { ...w, cancelled: 1, note: w.sale_id ? 'L’incasso resta in cassa: se va restituito, registra un rimborso.' : null };
  }));
  // Link pubblico della ricevuta di vendita + messaggio WhatsApp pronto
  app.get('/api/sales/:id{[0-9]+}/link', h(async (req) => {
    let s = await db.prepare('SELECT s.id, s.code, s.token, s.total, c.name, c.phone FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?').get(req.params.id);
    if (!s) throw new HttpError(404, 'Vendita non trovata', { code: 'VENDITA_NON_TROVATA', hint: 'Aggiorna la pagina.' });
    if (!s.token) { await db.prepare('UPDATE sales SET token = ? WHERE id = ?').run(newToken(), s.id); s = { ...s, token: (await db.prepare('SELECT token FROM sales WHERE id = ?').get(s.id)).token }; }
    const url = `${await trackBase()}/r/${s.token}`;
    const shop = (await getSettings()).shop_name || 'il negozio';
    const text = `Ciao${s.name ? ` ${s.name.split(' ')[0]}` : ''}, ecco la ricevuta del tuo acquisto ${s.code} (${eur(s.total)}): ${url}\nGrazie da ${shop}!`;
    const phone = String(s.phone || '').replace(/\D/g, '');
    return { url, text, wa: `https://wa.me/${phone ? (phone.length <= 10 ? `39${phone}` : phone) : ''}?text=${encodeURIComponent(text)}` };
  }));
  // Listino: quali servizi sono pubblici
  app.put('/api/services/:id{[0-9]+}/public', h(async (req) => {
    const s = await db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!s) throw new HttpError(404, 'Servizio non trovato', { code: 'SERVIZIO_NON_TROVATO', hint: 'Aggiorna il listino.' });
    const dt = DEVICE[req.body.device_type] ? req.body.device_type : 'altro';
    await db.prepare('UPDATE services SET public = ?, price_from = ?, device_type = ?, public_note = ? WHERE id = ?').run(req.body.public ? 1 : 0, req.body.price_from === false ? 0 : 1, dt, str(req.body.public_note)?.slice(0, 200) || null, s.id);
    return db.prepare('SELECT * FROM services WHERE id = ?').get(s.id);
  }));
  app.get('/api/listino', h(() => publicPriceList()));
}
