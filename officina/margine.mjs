// Usato in regime del margine (art. 36 DL 41/1995) e ritiro in permuta (spunti da Fix-Book, e-Share, Fixh IT).
// Ogni bene usato acquistato (da privato o in permuta) entra nel registro con il costo; quando si vende in cassa
// la riga collegata (margin_id) lo chiude. IVA a margine col metodo analitico: per ogni bene (prezzo - costo) x aliquota / (100 + aliquota),
// zero se il margine e' negativo. Sulla ricevuta l'IVA non si espone: si scrive la dicitura del regime del margine.
import { db, getSettings, nowLocal } from './dbref.mjs';
import { HttpError, money, localDate } from './logic.mjs';

export const MARGIN_NOTE = 'Operazione in regime del margine – art. 36 D.L. 41/1995. IVA non esposta.';
export const ORIGINS = { acquisto: 'Acquisto da privato', permuta: 'Ritiro in permuta', altro: 'Altro' };
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n)) throw new HttpError(400, `Importo non valido: ${v}`, { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi un numero, es. 120,00.' }); return n; };
const dayOk = (d) => /^\d{4}-\d\d-\d\d$/.test(d || '');

async function nextCode() {
  const y = nowLocal().slice(0, 4);
  const row = await db.prepare("SELECT MAX(CAST(substr(code, 8) AS INTEGER)) AS n FROM margin_items WHERE code LIKE ?").get(`U-${y}-%`);
  return `U-${y}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}
export const vatOnMargin = (price, cost, rate = 22) => money(Math.max(0, Number(price || 0) - Number(cost || 0)) * rate / (100 + rate));

const shape = (r, rate) => ({
  ...r, origin_label: ORIGINS[r.origin] || r.origin, sold: !!r.sold_at,
  margin: r.sold_at ? money((r.sale_price || 0) - r.cost) : r.price != null ? money(r.price - r.cost) : null,
  vat_margin: r.sold_at ? vatOnMargin(r.sale_price, r.cost, rate) : null,
});
const rateOf = async () => Number((await getSettings()).vat_rate) || 22;

export async function getMarginItem(id) {
  const r = await db.prepare('SELECT m.*, c.name AS seller_customer FROM margin_items m LEFT JOIN customers c ON c.id = m.seller_customer_id WHERE m.id = ?').get(id);
  if (!r) throw new HttpError(404, 'Bene usato non trovato nel registro', { code: 'USATO_NON_TROVATO', hint: 'Aggiorna il registro: potrebbe essere stato eliminato.' });
  return shape(r, await rateOf());
}

function clean(b, old = {}) {
  const description = 'description' in b ? str(b.description) : old.description;
  if (!description) throw new HttpError(400, 'Manca la descrizione del bene usato (es. iPhone 12 128GB nero).', { code: 'DESCRIZIONE_MANCANTE', hint: 'Scrivi marca, modello e memoria.' });
  const cost = 'cost' in b ? num(b.cost) : old.cost;
  if (cost == null || cost < 0) throw new HttpError(400, 'Manca il prezzo pagato per il bene usato (il costo).', { code: 'COSTO_MANCANTE', hint: 'Scrivi quanto è stato pagato al privato o il valore della permuta.' });
  const price = 'price' in b ? num(b.price) : old.price ?? null;
  if (price != null && price < 0) throw new HttpError(400, 'Il prezzo di vendita non può essere negativo.', { code: 'IMPORTO_NON_VALIDO', hint: 'Correggi il prezzo.' });
  const acquired = 'acquired_at' in b ? str(b.acquired_at) || localDate() : old.acquired_at || localDate();
  if (!dayOk(acquired)) throw new HttpError(400, 'La data di acquisto non è valida.', { code: 'DATA_NON_VALIDA', hint: 'Scegli la data dal calendario.' });
  const origin = 'origin' in b ? (ORIGINS[b.origin] ? b.origin : 'acquisto') : old.origin || 'acquisto';
  const seller = 'seller_name' in b ? str(b.seller_name) : old.seller_name ?? null;
  const sellerId = 'seller_customer_id' in b ? Number(b.seller_customer_id) || null : old.seller_customer_id ?? null;
  if (!seller && !sellerId) throw new HttpError(400, 'Manca chi ha venduto il bene: per il registro dell’usato serve il cedente.', { code: 'CEDENTE_MANCANTE', hint: 'Scegli il cliente oppure scrivi nome e cognome del privato.' });
  return { description: description.slice(0, 200), serial: 'serial' in b ? str(b.serial) : old.serial ?? null, origin, seller_customer_id: sellerId, seller_name: seller, seller_doc: 'seller_doc' in b ? str(b.seller_doc) : old.seller_doc ?? null, cost: money(cost), price: price == null ? null : money(price), acquired_at: acquired, usati_slug: 'usati_slug' in b ? str(b.usati_slug) : old.usati_slug ?? null, notes: 'notes' in b ? str(b.notes) : old.notes ?? null };
}

export async function createMarginItem(b) {
  const v = clean(b);
  if (v.seller_customer_id && !(await db.prepare('SELECT id FROM customers WHERE id = ?').get(v.seller_customer_id))) throw new HttpError(404, 'Il cliente cedente non esiste più.', { code: 'CLIENTE_NON_TROVATO', hint: 'Scegli di nuovo il cliente.' });
  const code = await nextCode();
  const r = await db.prepare(`INSERT INTO margin_items (code, description, serial, origin, seller_customer_id, seller_name, seller_doc, cost, price, acquired_at, usati_slug, notes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`).run(code, v.description, v.serial, v.origin, v.seller_customer_id, v.seller_name, v.seller_doc, v.cost, v.price, v.acquired_at, v.usati_slug, v.notes);
  return getMarginItem(Number(r.lastInsertRowid));
}

/** Controlla una riga di vendita collegata al registro (prima di scrivere). */
export async function checkMarginLine(marginId) {
  const m = await db.prepare('SELECT * FROM margin_items WHERE id = ?').get(marginId);
  if (!m) throw new HttpError(404, 'Il bene usato scelto non è nel registro.', { code: 'USATO_NON_TROVATO', hint: 'Aggiorna la cassa e scegli di nuovo il bene.' });
  if (m.sold_at) throw new HttpError(409, `Il bene ${m.code} (${m.description}) risulta già venduto.`, { code: 'USATO_GIA_VENDUTO', hint: 'Controlla il registro dell’usato.' });
  return m;
}
export async function markSold(marginId, saleId, price) {
  await db.prepare("UPDATE margin_items SET sold_at = datetime('now','localtime'), sale_id = ?, sale_price = ? WHERE id = ? AND sold_at IS NULL").run(saleId, money(price), marginId);
}

/** Permuta in cassa: valida i dati (nessuna scrittura). */
export function planTradein(t, total, customerId) {
  if (!t || (t.value == null && !t.description)) return null;
  const value = money(num(t.value));
  const description = str(t.description);
  if (!description) throw new HttpError(400, 'Permuta: manca la descrizione del bene ritirato.', { code: 'PERMUTA_SENZA_DESCRIZIONE', hint: 'Scrivi marca e modello del bene ritirato.' });
  if (!(value > 0)) throw new HttpError(400, 'Permuta: il valore riconosciuto deve essere maggiore di zero.', { code: 'PERMUTA_VALORE_NON_VALIDO', hint: 'Scrivi il valore in euro.' });
  if (value > total + 0.001) throw new HttpError(400, `Permuta: il valore (${value.toFixed(2)} €) supera il totale della vendita (${money(total).toFixed(2)} €).`, { code: 'PERMUTA_SUPERA_TOTALE', hint: 'Abbassa il valore della permuta o registra il bene come acquisto nel registro dell’usato.' });
  if (!customerId && !str(t.seller_name)) throw new HttpError(400, 'Permuta: serve sapere chi cede il bene (cliente o nome del privato).', { code: 'CEDENTE_MANCANTE', hint: 'Scegli il cliente della vendita.' });
  return { value, description, serial: str(t.serial), seller_doc: str(t.seller_doc), seller_name: str(t.seller_name), price: t.price == null || t.price === '' ? null : money(num(t.price)) };
}
export async function commitTradein(plan, saleCode, customerId) {
  return createMarginItem({ description: plan.description, serial: plan.serial, origin: 'permuta', seller_customer_id: customerId || null, seller_name: plan.seller_name, seller_doc: plan.seller_doc, cost: plan.value, price: plan.price, notes: `Ritirato in permuta con la vendita ${saleCode}` });
}

export async function listMargin({ stato, q } = {}) {
  const where = []; const args = [];
  if (stato === 'disponibili') where.push('m.sold_at IS NULL');
  if (stato === 'venduti') where.push('m.sold_at IS NOT NULL');
  if (str(q)) { where.push('(m.description LIKE ? OR m.serial LIKE ? OR m.code LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rate = await rateOf();
  const rows = await db.prepare(`SELECT m.*, c.name AS seller_customer FROM margin_items m LEFT JOIN customers c ON c.id = m.seller_customer_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY m.sold_at IS NOT NULL, m.id DESC LIMIT 500`).all(...args);
  return { rows: rows.map((r) => shape(r, rate)), note: MARGIN_NOTE };
}

/** Riepilogo del periodo: acquisti, vendite, margine e IVA a margine da versare (analitico). */
export async function marginReport(from, to) {
  const f = dayOk(from) ? from : `${localDate().slice(0, 7)}-01`;
  const t = dayOk(to) ? to : localDate();
  const rate = await rateOf();
  const bought = await db.prepare('SELECT * FROM margin_items WHERE acquired_at BETWEEN ? AND ? ORDER BY acquired_at, id').all(f, t);
  const sold = await db.prepare('SELECT * FROM margin_items WHERE sold_at IS NOT NULL AND date(sold_at) BETWEEN ? AND ? ORDER BY sold_at, id').all(f, t);
  const margins = sold.map((m) => money((m.sale_price || 0) - m.cost));
  return {
    from: f, to: t, vat_rate: rate, note: MARGIN_NOTE,
    bought: { n: bought.length, total: money(bought.reduce((a, m) => a + m.cost, 0)), permute: bought.filter((m) => m.origin === 'permuta').length },
    sold: { n: sold.length, revenue: money(sold.reduce((a, m) => a + (m.sale_price || 0), 0)), cost: money(sold.reduce((a, m) => a + m.cost, 0)) },
    margin: money(margins.reduce((a, x) => a + x, 0)),
    negative: margins.filter((x) => x < 0).length,
    vat_due: money(sold.reduce((a, m) => a + vatOnMargin(m.sale_price, m.cost, rate), 0)),
    rows: sold.map((m) => shape(m, rate)),
    stock: await db.prepare('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(cost),0),2) AS value FROM margin_items WHERE sold_at IS NULL').get(),
  };
}

const escH = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Cartellino da esporre (A6, si stampa dal browser). */
export async function cartellino(id) {
  const m = await getMarginItem(id);
  const s = await getSettings();
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Cartellino ${escH(m.code)}</title>
<style>@page{size:A6;margin:8mm}body{font-family:Arial,sans-serif;margin:0;padding:6mm;color:#111}h1{font-size:18pt;margin:0 0 3mm}.p{font-size:30pt;font-weight:700;margin:5mm 0}.s{font-size:9pt;color:#444}.b{border-top:1px solid #999;margin-top:5mm;padding-top:2mm}</style></head>
<body onload="print()"><h1>${escH(m.description)}</h1>${m.serial ? `<div class="s">Seriale/IMEI: ••••${escH(String(m.serial).slice(-4))}</div>` : ''}
<div class="p">${m.price != null ? `${m.price.toFixed(2).replace('.', ',')} €` : 'Prezzo in negozio'}</div>
<div class="s">Prodotto usato · cod. ${escH(m.code)}</div><div class="s b">${escH(MARGIN_NOTE)}<br>${escH(s.shop_name || '')}</div></body></html>`;
}

export function registerMarginRoutes(app, h, page, adminOnly) {
  app.get('/api/margine', h((req) => listMargin(req.query)));
  app.get('/api/margine/registro', h((req) => { adminOnly(req); return marginReport(req.query.from, req.query.to); }));
  app.get('/api/margine/:id{[0-9]+}', h((req) => getMarginItem(req.params.id)));
  app.post('/api/margine', h((req) => createMarginItem(req.body)));
  app.put('/api/margine/:id{[0-9]+}', h(async (req) => {
    const old = await getMarginItem(req.params.id);
    if (old.sold) throw new HttpError(409, `Il bene ${old.code} è già venduto: non si modifica più.`, { code: 'USATO_GIA_VENDUTO', hint: 'Le correzioni su un bene venduto vanno fatte dal commercialista.' });
    const v = clean(req.body, old);
    await db.prepare('UPDATE margin_items SET description=?, serial=?, origin=?, seller_customer_id=?, seller_name=?, seller_doc=?, cost=?, price=?, acquired_at=?, usati_slug=?, notes=? WHERE id=?')
      .run(v.description, v.serial, v.origin, v.seller_customer_id, v.seller_name, v.seller_doc, v.cost, v.price, v.acquired_at, v.usati_slug, v.notes, old.id);
    return getMarginItem(old.id);
  }));
  app.delete('/api/margine/:id{[0-9]+}', h(async (req) => {
    adminOnly(req);
    const old = await getMarginItem(req.params.id);
    if (old.sold) throw new HttpError(409, `Il bene ${old.code} è già venduto: resta nel registro.`, { code: 'USATO_GIA_VENDUTO', hint: 'Un bene venduto non si elimina.' });
    await db.prepare('DELETE FROM margin_items WHERE id = ?').run(old.id);
    return { ok: true, code: old.code, description: old.description };
  }));
  app.get('/print/margine/:id{[0-9]+}', page(async (c) => c.html(await cartellino(c.req.param('id')))));
}
