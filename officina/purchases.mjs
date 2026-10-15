// Acquisti dai fornitori: import delle fatture elettroniche, carico di magazzino, storico prezzi e avvisi di variazione.
// Flusso in 2 passi: preview (non scrive nulla) -> confirm (scrive in un unico blocco atomico, senza doppioni).
import { db, tx } from './dbref.mjs';
import { HttpError, money, localDate, moveStock } from './logic.mjs';
import { parseFattura, looksLikeP7m, P7M_MESSAGE } from './fatturapa.mjs';
import { resolveDdtBody, learnFormat, listFormats, deleteFormat } from './ddt.mjs'; // agente D: DDT e fatture in PDF

const NOW = "datetime('now','localtime')";
const MAX_XML = 6 * 1024 * 1024;
const str = (v) => (v == null ? null : String(v).trim() || null);
const r4 = (x) => Math.round(x * 10000) / 10000;

/** Tabelle da includere nel backup JSON (nell'ordine in cui vanno ripristinate). */
export const PURCHASE_TABLES = ['supplier_info', 'supplier_codes', 'purchases', 'purchase_lines', 'price_history', 'supplier_formats'];

// ---------- Interfaccia dei lettori di documenti ----------
// Ogni lettore: { id, label, supported, detect(testo, nomeFile) -> bool, parse(testo, nomeFile) -> { supplier, doc, lines, warnings, ... } }
// Per aggiungere un formato basta registrarne uno qui (stessa forma di output di parseFattura).
export const parsers = {
  fatturapa: {
    id: 'fatturapa', label: 'Fattura elettronica XML (FatturaPA)', supported: true,
    detect: (text) => /<([\w.-]+:)?FatturaElettronica[\s>]/.test(String(text).slice(0, 6000)),
    parse: (text, filename) => parseFattura(text, filename),
  },
  // DDT e fatture in PDF digitale: il testo lo estrae il browser (pdftext.js) e lo legge officina/ddt.mjs (lettore euristico a piu'
  // passaggi + formati imparati per fornitore + anteprima corretta a mano). Passa da resolveDocument(), che e' asincrono (usa il DB).
  ddt_pdf: {
    id: 'ddt_pdf', label: 'DDT / PDF digitale (testo estratto dal browser)', supported: true,
    detect: (text, filename) => /^\s*%PDF-/.test(String(text).slice(0, 20)) || /\.pdf$/i.test(String(filename || '')),
    parse: () => { throw new HttpError(400, 'Il PDF va letto dal browser: scegli il file dalla scheda Importa (il testo viene estratto lì e controllato da te prima di confermare). Con l’API serve il campo pdf_text.'); },
  },
};

export function parseDocument(body) {
  const text = String(body?.xml ?? body?.text ?? '');
  const filename = String(body?.filename || '');
  if (!text.trim()) throw new HttpError(400, 'Nessun file ricevuto.');
  if (text.length > MAX_XML) throw new HttpError(400, 'File troppo grande (massimo 6 MB).');
  if (looksLikeP7m(text, filename)) throw new HttpError(400, P7M_MESSAGE);
  const p = Object.values(parsers).find((x) => x.detect(text, filename)) || parsers.fatturapa;
  return { source: p.id, parsed: p.parse(text, filename) };
}

/** Come parseDocument ma accetta anche i documenti PDF/DDT (`pdf_text` = testo estratto, `parsed` = anteprima corretta a mano). */
export async function resolveDocument(body) {
  const ddt = await resolveDdtBody(body);
  return ddt || parseDocument(body);
}

// ---------- Somiglianza dei nomi ----------
const STOP = new Set(['di', 'da', 'per', 'con', 'il', 'la', 'lo', 'e', 'a', 'del', 'della', 'in', 'demo', 'pz', 'pcs', 'nr', 'cod', 'art']);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t)));
const LEGAL = new Set(['srl', 's', 'r', 'l', 'spa', 'p', 'a', 'snc', 'sas', 'sapa', 'sa', 'ltd', 'gmbh', 'srls', 'unipersonale', 'italia', 'distribuzione']);
const supplierTokens = (s) => new Set([...tokens(s)].filter((t) => !LEGAL.has(t)));
function similarity(A, B) {
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const jac = inter / (A.size + B.size - inter);
  const contain = Math.min(A.size, B.size) >= 2 ? 0.85 * (inter / Math.min(A.size, B.size)) : 0;
  let score = Math.max(jac, contain);
  const nums = (S) => [...S].filter((t) => /\d/.test(t));
  const nA = nums(A);
  const nB = nums(B);
  const within = (x, y) => x.every((t) => y.includes(t));
  if (nA.length && nB.length && !within(nA, nB) && !within(nB, nA) && score > 0.55) score = 0.55; // "iPhone 13" non è "iPhone 14"
  return score;
}
const vatKey = (v) => String(v || '').toUpperCase().replace(/^IT/, '').replace(/\D/g, '');

// ---------- Formattazione per i testi di avviso ----------
const eurT = (n) => `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');
const pctT = (n) => `${sign(n)}${Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export const changeText = (c) => `${c.product_name} · ${c.supplier_name}: ${eurT(c.prev_price)} → ${eurT(c.price)} (${sign(c.abs)}${eurT(Math.abs(c.abs))}, ${pctT(c.pct)})`;

// ---------- Storico prezzi ----------
const byDate = (a, b) => (a.doc_date < b.doc_date ? -1 : a.doc_date > b.doc_date ? 1 : a.id - b.id);
async function loadHistory() {
  return db.prepare(`SELECT ph.id, ph.product_id, ph.supplier_id, ph.unit_price, ph.qty, ph.doc_date, ph.purchase_id, p.name AS product_name, s.name AS supplier_name
    FROM price_history ph JOIN products p ON p.id = ph.product_id JOIN suppliers s ON s.id = ph.supplier_id WHERE p.active = 1`).all();
}
/** Variazione tra due prezzi. */
function delta(prev, now) {
  const abs = Math.round((now - prev) * 10000) / 10000;
  const pct = prev > 0 ? Math.round((abs / prev) * 1000) / 10 : 0;
  return { abs: Math.round(abs * 100) / 100, pct, direction: Math.abs(abs) < 0.005 ? 'same' : abs > 0 ? 'up' : 'down' };
}
/** Una voce per (prodotto, fornitore, documento): l'ultima riga del documento. Ordinate per data. */
function collapse(rows) {
  const m = new Map();
  for (const r of [...rows].sort(byDate)) m.set(`${r.product_id}|${r.supplier_id}|${r.purchase_id ?? `n${r.id}`}`, r);
  return [...m.values()].sort(byDate);
}
function pairs(rows) {
  const g = new Map();
  for (const r of collapse(rows)) { const k = `${r.product_id}|${r.supplier_id}`; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return g;
}
/** Ultimo prezzo di un prodotto presso un fornitore (dalla cronologia già caricata). */
function lastOf(hist, productId, supplierId) {
  let best = null;
  for (const r of hist) if (r.product_id === productId && r.supplier_id === supplierId && (!best || byDate(best, r) < 0)) best = r;
  return best;
}

/** Variazioni dell'ultimo ordine rispetto al precedente, per ogni prodotto e fornitore. */
export async function priceChanges({ days, includeSame } = {}) {
  const hist = await loadHistory();
  const out = [];
  for (const list of pairs(hist).values()) {
    if (list.length < 2) continue;
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const d = delta(prev.unit_price, last.unit_price);
    if (d.direction === 'same' && !includeSame) continue;
    out.push({ product_id: last.product_id, product_name: last.product_name, supplier_id: last.supplier_id, supplier_name: last.supplier_name,
      prev_price: prev.unit_price, prev_date: prev.doc_date, price: last.unit_price, date: last.doc_date, purchase_id: last.purchase_id, ...d });
  }
  const cutoff = days ? addDaysYmd(localDate(), -days) : null;
  return out.filter((c) => !cutoff || c.date >= cutoff).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : Math.abs(b.pct) - Math.abs(a.pct)));
}
function addDaysYmd(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Avvisi di variazione prezzo (ultimo ordine vs precedente, stesso prodotto e fornitore) per campanella e Oggi. */
export async function priceAlerts({ days = 60 } = {}) {
  const list = await priceChanges({ days });
  return list.map((c) => ({
    type: c.direction === 'up' ? 'price_up' : 'price_down',
    severity: c.direction === 'up' && c.pct >= 5 ? 'medium' : 'low',
    title: `${c.product_name}: ${c.direction === 'up' ? '▲ più caro' : '▼ più economico'} da ${c.supplier_name}`,
    detail: `${eurT(c.prev_price)} → ${eurT(c.price)} (${sign(c.abs)}${eurT(Math.abs(c.abs))}, ${pctT(c.pct)}) rispetto all’ordine precedente.`,
    link: `#/acquisti?product=${c.product_id}`, ref: c.product_id,
  }));
}

/** Serie storica dei prezzi di un prodotto, per fornitore, con minimo e ultima variazione. */
export async function productPrices(productId) {
  const p = await db.prepare('SELECT id, name, sku, cost FROM products WHERE id = ?').get(productId);
  if (!p) throw new HttpError(404, 'Prodotto non trovato');
  const rows = (await loadHistory()).filter((r) => r.product_id === p.id).sort(byDate);
  const series = rows.map((r) => ({ id: r.id, date: r.doc_date, price: r.unit_price, qty: r.qty, supplier_id: r.supplier_id, supplier_name: r.supplier_name, purchase_id: r.purchase_id }));
  const bySup = new Map();
  for (const r of collapse(rows)) { if (!bySup.has(r.supplier_id)) bySup.set(r.supplier_id, []); bySup.get(r.supplier_id).push(r); }
  const suppliers = [...bySup.values()].map((l) => {
    const last = l[l.length - 1];
    const prev = l.length > 1 ? l[l.length - 2] : null;
    const min = l.reduce((a, r) => (r.unit_price < a.unit_price ? r : a), l[0]);
    return { supplier_id: last.supplier_id, supplier_name: last.supplier_name, count: l.length, last_price: last.unit_price, last_date: last.doc_date,
      prev_price: prev?.unit_price ?? null, prev_date: prev?.doc_date ?? null, ...(prev ? delta(prev.unit_price, last.unit_price) : { abs: null, pct: null, direction: null }),
      min_price: min.unit_price, min_date: min.doc_date };
  }).sort((a, b) => a.last_price - b.last_price);
  const low = series.reduce((a, r) => (!a || r.price < a.price ? r : a), null);
  const units = series.reduce((a, r) => a + (r.qty > 0 ? r.qty : 0), 0);
  const avg_cost = units > 0 ? Math.round((series.reduce((a, r) => a + r.price * (r.qty > 0 ? r.qty : 0), 0) / units) * 100) / 100 : null; // costo medio ponderato sulle quantità acquistate
  return {
    product: p, series, suppliers, avg_cost,
    lowest: low && { price: low.price, date: low.date, supplier_id: low.supplier_id, supplier_name: low.supplier_name },
    cheapest_now: suppliers[0] ? { price: suppliers[0].last_price, supplier_id: suppliers[0].supplier_id, supplier_name: suppliers[0].supplier_name } : null,
  };
}

/** Prodotti con almeno un acquisto registrato (per la scelta nel grafico). */
export async function productsWithPrices(q) {
  const where = ['p.active = 1'];
  const args = [];
  if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  const rows = await db.prepare(`SELECT p.id, p.name, p.sku, COUNT(ph.id) AS points, COUNT(DISTINCT ph.supplier_id) AS suppliers, MAX(ph.doc_date) AS last_date
    FROM products p JOIN price_history ph ON ph.product_id = p.id WHERE ${where.join(' AND ')} GROUP BY p.id ORDER BY p.name LIMIT 300`).all(...args);
  return rows;
}

export async function lastPrice(productId, supplierId) {
  const r = await db.prepare('SELECT unit_price, doc_date, id FROM price_history WHERE product_id = ? AND supplier_id = ? ORDER BY doc_date DESC, id DESC LIMIT 1').get(productId, supplierId);
  return r ? { unit_price: r.unit_price, doc_date: r.doc_date } : null;
}

// ---------- Analisi di una fattura (usata da preview e confirm) ----------
const EXTRA_COST = /^\s*(spese|trasporto|spedizione|imballo|contrassegno|bollo|costo di|diritti|commission|sconto)/i;

async function matchSupplier(s) {
  const rows = await db.prepare('SELECT s.id, s.name, i.vat FROM suppliers s LEFT JOIN supplier_info i ON i.supplier_id = s.id').all();
  const v = vatKey(s.vat);
  if (v) { const hit = rows.find((r) => vatKey(r.vat) === v); if (hit) return { id: hit.id, name: hit.name, by: 'vat' }; }
  const T = supplierTokens(s.name);
  let best = null;
  for (const r of rows) {
    const sc = similarity(T, supplierTokens(r.name));
    const exact = norm(r.name).replace(/ demo$/, '') === norm(s.name);
    const score = exact ? 1 : T.size === 1 && supplierTokens(r.name).size === 1 ? (T.has([...supplierTokens(r.name)][0]) ? 1 : 0) : sc;
    if (score >= 0.7 && (!best || score > best.score)) best = { id: r.id, name: r.name, by: 'name', score };
  }
  return best ? { id: best.id, name: best.name, by: 'name' } : null;
}

async function analyze(parsed, supplierOverrideId) {
  const supplier = supplierOverrideId
    ? await db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierOverrideId).then((r) => { if (!r) throw new HttpError(400, 'Fornitore scelto non trovato'); return { ...r, by: 'scelta' }; })
    : await matchSupplier(parsed.supplier);
  const products = await db.prepare('SELECT id, sku, name, qty, cost FROM products WHERE active = 1').all();
  const codes = supplier ? await db.prepare('SELECT supplier_code, product_id FROM supplier_codes WHERE supplier_id = ?').all(supplier.id) : [];
  const codeMap = new Map(codes.map((c) => [String(c.supplier_code).toLowerCase(), c.product_id]));
  const skuMap = new Map(products.filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p.id]));
  const byId = new Map(products.map((p) => [p.id, p]));
  const ptoks = products.map((p) => [p, tokens(p.name)]);
  const hist = await loadHistory();
  const credit = parsed.doc.type === 'TD04';

  const lines = parsed.lines.map((l) => {
    let by = null;
    let pid = null;
    const key = l.code ? String(l.code).toLowerCase() : null;
    const keyEan = l.ean ? String(l.ean).toLowerCase() : null;
    if (key && codeMap.has(key) && byId.has(codeMap.get(key))) { pid = codeMap.get(key); by = 'codice fornitore'; }
    else if (key && skuMap.has(key)) { pid = skuMap.get(key); by = 'codice articolo'; }
    else if (keyEan && skuMap.has(keyEan)) { pid = skuMap.get(keyEan); by = 'codice articolo'; }
    const T = tokens(l.description);
    const scored = ptoks.map(([p, t]) => ({ p, score: similarity(T, t) })).filter((x) => x.score >= 0.3).sort((a, b) => b.score - a.score).slice(0, 5);
    if (!pid && scored[0] && scored[0].score >= 0.6) { pid = scored[0].p.id; by = 'nome simile'; }
    const cand = scored.map((x) => ({ id: x.p.id, name: x.p.name, sku: x.p.sku, qty: x.p.qty, score: Math.round(x.score * 100) / 100 }));
    if (pid && !cand.some((c) => c.id === pid)) { const p = byId.get(pid); cand.unshift({ id: p.id, name: p.name, sku: p.sku, qty: p.qty, score: 1 }); }
    let action = pid ? 'match' : 'new';
    let reason = null;
    if (credit) { action = 'skip'; reason = 'nota di credito: nessun carico di magazzino'; }
    else if (!(l.unit_price > 0) || !(l.qty > 0)) { action = 'skip'; reason = 'riga senza prezzo o quantità'; }
    else if (!pid && !l.code && EXTRA_COST.test(l.description)) { action = 'skip'; reason = 'spese accessorie, non è un prodotto'; }
    const prevRow = pid && supplier ? lastOf(hist, pid, supplier.id) : null;
    const prev = prevRow ? { unit_price: prevRow.unit_price, doc_date: prevRow.doc_date, ...delta(prevRow.unit_price, l.unit_price) } : null;
    let elsewhere = null;
    if (pid) {
      const latest = new Map();
      for (const r of hist) if (r.product_id === pid && r.supplier_id !== supplier?.id) { const o = latest.get(r.supplier_id); if (!o || byDate(o, r) < 0) latest.set(r.supplier_id, r); }
      const cheaper = [...latest.values()].filter((r) => r.unit_price < l.unit_price - 0.004).sort((a, b) => a.unit_price - b.unit_price)[0];
      if (cheaper) elsewhere = { supplier_name: cheaper.supplier_name, unit_price: cheaper.unit_price, doc_date: cheaper.doc_date };
    }
    return { ...l, suggested: { action, product_id: pid, by, reason }, candidates: cand, prev, elsewhere };
  });

  let duplicate = null;
  if (supplier) {
    const d = await db.prepare('SELECT id, imported_at FROM purchases WHERE supplier_id = ? AND doc_number = ? AND doc_date = ?').get(supplier.id, parsed.doc.number, parsed.doc.date);
    if (d) duplicate = d;
  }
  const warnings = [...parsed.warnings];
  if (duplicate) warnings.unshift(`Questo documento è già stato importato il ${String(duplicate.imported_at).slice(0, 10)}: non si può importare due volte.`);
  if (credit) warnings.push('È una nota di credito: la registro ma non tocco il magazzino né lo storico prezzi.');
  return { supplier, lines, duplicate, warnings, hist };
}

/** Passo 1: legge il file e propone abbinamenti. Non scrive nulla. */
export async function previewPurchase(body) {
  const { source, parsed } = await resolveDocument(body);
  const a = await analyze(parsed, body?.supplier_id ? Number(body.supplier_id) : null);
  return {
    ok: true, source,
    ...(source === 'ddt_pdf' ? { editable: { supplier: parsed.supplier, doc: parsed.doc, lines: parsed.lines, meta: parsed.meta } } : {}),
    supplier: { parsed: parsed.supplier, match: a.supplier, will_create: !a.supplier },
    doc: parsed.doc, ddt: parsed.ddt, vat_summary: parsed.vat_summary, lines_total: parsed.lines_total,
    duplicate: a.duplicate, warnings: a.warnings, lines: a.lines,
  };
}

// ---------- Passo 2: conferma ----------
const nextId = async (table) => ((await db.prepare(`SELECT COALESCE(MAX(id),0) AS m FROM ${table} WHERE id > 0`).get()).m || 0) + 1;

export async function confirmPurchase(body) {
  const { source, parsed } = await resolveDocument(body);
  const a = await analyze(parsed, body?.supplier_id ? Number(body.supplier_id) : null);
  if (a.duplicate) throw new HttpError(409, `Documento già importato il ${String(a.duplicate.imported_at).slice(0, 10)}: non lo importo di nuovo.`);

  // decisioni per riga (se mancano si usa la proposta)
  const given = new Map((Array.isArray(body.lines) ? body.lines : []).map((x) => [Number(x.n), x]));
  const productIds = new Set((await db.prepare('SELECT id FROM products WHERE active = 1').all()).map((p) => p.id));
  const warnings = [];
  const decisions = a.lines.map((l) => {
    const g = given.get(l.n) || {};
    const action = ['match', 'new', 'skip'].includes(g.action) ? g.action : l.suggested.action;
    let qty = g.qty === undefined || g.qty === '' ? l.qty : Number(String(g.qty).replace(',', '.'));
    if (!Number.isFinite(qty) || qty < 0) throw new HttpError(400, `Riga ${l.n}: quantità non valida`);
    if (action === 'match') {
      const pid = Number(g.product_id ?? l.suggested.product_id);
      if (!productIds.has(pid)) throw new HttpError(400, `Riga ${l.n}: scegli un prodotto esistente oppure “nuovo prodotto”`);
      return { l, action, pid, qty };
    }
    if (action === 'new') {
      const name = str(g.name) || l.description;
      return { l, action, name: name.slice(0, 200), sku: str(g.sku), category: str(g.category), price: Number(String(g.price ?? 0).replace(',', '.')) || 0, qty };
    }
    return { l, action, qty };
  });

  // fornitore: esistente oppure da creare
  const stmts = [];
  let supplierId = a.supplier?.id;
  const sp = parsed.supplier;
  const supplierName = a.supplier?.name || sp.name;
  if (!supplierId) {
    supplierId = await nextId('suppliers');
    stmts.push([`INSERT INTO suppliers (id, name, phone, email, notes, created_at) VALUES (?,?,?,?,?,${NOW})`, [supplierId, sp.name, sp.phone, sp.email, `Creato dall’import fattura ${parsed.doc.number}${sp.address ? ` · ${sp.address}` : ''}`]]);
  }
  if (sp.vat || sp.fiscal_code || sp.address) {
    stmts.push(['INSERT OR IGNORE INTO supplier_info (supplier_id, vat, fiscal_code, address) VALUES (?,?,?,?)', [supplierId, sp.vat, sp.fiscal_code, sp.address]]);
    stmts.push(['UPDATE supplier_info SET vat = COALESCE(vat, ?), fiscal_code = COALESCE(fiscal_code, ?), address = COALESCE(address, ?) WHERE supplier_id = ?', [sp.vat, sp.fiscal_code, sp.address, supplierId]]);
  }

  const pid0 = await nextId('purchases');
  const purchaseStmt = [`INSERT INTO purchases (id, supplier_id, doc_type, doc_number, doc_date, total, source, notes, imported_at) VALUES (?,?,?,?,?,?,?,?,${NOW})`,
    [pid0, supplierId, parsed.doc.type, parsed.doc.number, parsed.doc.date, parsed.doc.total, source, str(body.notes) || parsed.doc.notes]];
  let lineId = await nextId('purchase_lines');
  let histId = await nextId('price_history');
  let prodId = await nextId('products');
  const changes = [];
  let loaded = 0;
  const lineStmts = [];
  for (const d of decisions) {
    const l = d.l;
    let productId = null;
    const doLoad = d.action !== 'skip' && d.qty > 0 && !(parsed.doc.type === 'TD04');
    if (d.action === 'new' && doLoad) {
      productId = prodId++;
      lineStmts.push([`INSERT INTO products (id, sku, name, category, qty, min_qty, cost, price, supplier_id, created_at) VALUES (?,?,?,?,0,0,?,?,?,${NOW})`,
        [productId, d.sku, d.name, d.category, l.unit_price, money(d.price) || 0, supplierId]]);
    } else if (d.action === 'match') productId = d.pid;
    lineStmts.push([`INSERT INTO purchase_lines (id, purchase_id, product_id, supplier_code, description, qty, unit, list_price, unit_price, discount, vat_rate, line_total, loaded) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [lineId++, pid0, doLoad ? productId : null, l.code, l.description.slice(0, 300), d.qty, l.unit, l.list_price, l.unit_price, l.discount, l.vat_rate, l.line_total, doLoad ? 1 : 0]]);
    if (!doLoad || !productId) continue;
    loaded += 1;
    const whole = Math.round(d.qty);
    if (whole !== d.qty) warnings.push(`Riga ${l.n}: quantità ${d.qty} non intera, carico ${whole} pezzi in magazzino.`);
    if (l.code) lineStmts.push(['INSERT OR REPLACE INTO supplier_codes (supplier_id, supplier_code, product_id) VALUES (?,?,?)', [supplierId, l.code, productId]]);
    lineStmts.push(['INSERT INTO price_history (id, product_id, supplier_id, unit_price, qty, doc_date, purchase_id) VALUES (?,?,?,?,?,?,?)', [histId++, productId, supplierId, l.unit_price, d.qty, parsed.doc.date, pid0]]);
    if (whole) {
      lineStmts.push(['UPDATE products SET qty = qty + ?, cost = ?, supplier_id = COALESCE(supplier_id, ?) WHERE id = ?', [whole, l.unit_price, supplierId, productId]]);
      lineStmts.push([`INSERT INTO stock_moves (product_id, delta, reason, ref, created_at) VALUES (?,?,?,?,${NOW})`, [productId, whole, `carico fattura ${parsed.doc.number}`, `acquisto:${pid0}`]]);
    } else lineStmts.push(['UPDATE products SET cost = ? WHERE id = ?', [l.unit_price, productId]]);
    if (d.action === 'match') {
      // il prezzo precedente si cerca sul prodotto scelto dall'utente (la proposta poteva essere un altro)
      const pr = lastOf(a.hist, productId, supplierId);
      l.prev = pr ? { unit_price: pr.unit_price, doc_date: pr.doc_date, ...delta(pr.unit_price, l.unit_price) } : null;
    }
    if (d.action === 'match' && l.prev && l.prev.direction !== 'same') {
      const nm = (await db.prepare('SELECT name FROM products WHERE id = ?').get(productId))?.name;
      changes.push({ product_id: productId, product_name: nm, supplier_id: supplierId, supplier_name: supplierName, prev_price: l.prev.unit_price, prev_date: l.prev.doc_date, price: l.unit_price, date: parsed.doc.date, abs: l.prev.abs, pct: l.prev.pct, direction: l.prev.direction });
    }
  }
  const all = [...stmts, purchaseStmt, ...lineStmts];
  try {
    await tx(() => db.batch(all));
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e.message))) throw new HttpError(409, 'Documento già importato: non lo importo di nuovo.');
    throw e;
  }
  // PDF/DDT: dopo la conferma il formato di questo fornitore si impara (colonne corrette dall'utente), cosi' la volta dopo e' piu' preciso
  let learned = false;
  if (source === 'ddt_pdf') { try { learned = await learnFormat(parsed, supplierId); } catch (e) { console.error('apprendimento formato', e); } }
  return {
    ok: true, learned, purchase_id: pid0, supplier_id: supplierId, supplier_name: supplierName, supplier_created: !a.supplier,
    doc_number: parsed.doc.number, doc_date: parsed.doc.date, total: parsed.doc.total, lines_count: loaded, lines_skipped: decisions.length - loaded,
    new_products: decisions.filter((d) => d.action === 'new' && d.qty > 0 && parsed.doc.type !== 'TD04').length, changes, warnings,
  };
}

// ---------- Carico merce a mano (da Magazzino) ----------
/** Carico manuale di un articolo (o nuovo): giacenza, ultimo costo e storico prezzi. Riusa le stesse tabelle dell'import fatture
 *  (purchases / purchase_lines / price_history), cosi' grafico a punti e avvisi di Acquisti includono anche questi carichi.
 *  Piu' carichi con lo stesso n. documento (stesso fornitore e data) finiscono nello stesso documento. */
export async function manualLoad(body) {
  const b = body || {};
  const qty = Math.round(Number(String(b.qty ?? '').replace(',', '.')));
  if (!Number.isFinite(qty) || qty <= 0) throw new HttpError(400, 'Quantità non valida');
  const price = Number(String(b.unit_price ?? '').replace(',', '.'));
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Prezzo d’acquisto non valido');
  const date = str(b.date) || localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Data non valida');
  const unit = r4(price);
  return tx(async () => {
    let productId = Number(b.product_id) || null;
    let prod = productId ? await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId) : null;
    if (productId && !prod) throw new HttpError(404, 'Articolo non trovato');
    const supplierId = Number(b.supplier_id) || prod?.supplier_id || null;
    const supplier = supplierId ? await db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId) : null;
    if (!supplier) throw new HttpError(400, 'Scegli il fornitore.');
    if (!prod) { // articolo nuovo
      const name = str(b.name);
      if (!name) throw new HttpError(400, 'Scegli un articolo oppure scrivi il nome del nuovo.');
      const r = await db.prepare(`INSERT INTO products (sku, name, category, qty, min_qty, cost, price, supplier_id, created_at) VALUES (?,?,?,0,?,?,?,?,${NOW})`)
        .run(str(b.sku), name.slice(0, 200), str(b.category), Math.max(0, Math.round(Number(b.min_qty) || 0)), unit, money(Number(String(b.price ?? 0).replace(',', '.')) || 0), supplier.id);
      productId = Number(r.lastInsertRowid);
      prod = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    }
    const code = str(b.supplier_code);
    // documento: stesso numero + fornitore + data = stesso documento (se e' manuale); senza numero ne nasce uno automatico
    const docNo = str(b.doc_number) || `CARICO-${date.replaceAll('-', '')}-${Date.now().toString(36).toUpperCase()}`;
    let doc = await db.prepare('SELECT id, source, total FROM purchases WHERE supplier_id = ? AND doc_number = ? AND doc_date = ?').get(supplier.id, docNo, date);
    if (doc && doc.source !== 'manuale') throw new HttpError(409, 'Esiste già un documento importato con questo numero: usa un altro numero o lascia vuoto.');
    const lineTotal = money(qty * unit);
    if (!doc) {
      const r = await db.prepare(`INSERT INTO purchases (supplier_id, doc_type, doc_number, doc_date, total, source, notes, imported_at) VALUES (?,?,?,?,?,?,?,${NOW})`)
        .run(supplier.id, 'CARICO', docNo, date, lineTotal, 'manuale', str(b.notes));
      doc = { id: Number(r.lastInsertRowid) };
    } else await db.prepare('UPDATE purchases SET total = total + ? WHERE id = ?').run(lineTotal, doc.id);
    await db.prepare('INSERT INTO purchase_lines (purchase_id, product_id, supplier_code, description, qty, unit, list_price, unit_price, discount, vat_rate, line_total, loaded) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(doc.id, productId, code, prod.name.slice(0, 300), qty, 'pz', unit, unit, 0, 0, lineTotal, 1);
    await db.prepare('INSERT INTO price_history (product_id, supplier_id, unit_price, qty, doc_date, purchase_id) VALUES (?,?,?,?,?,?)').run(productId, supplier.id, unit, qty, date, doc.id);
    if (code) await db.prepare('INSERT OR REPLACE INTO supplier_codes (supplier_id, supplier_code, product_id) VALUES (?,?,?)').run(supplier.id, code, productId);
    await moveStock(productId, qty, `carico merce ${docNo}`, `acquisto:${doc.id}`);
    // ultimo costo (e fornitore abituale se mancava)
    await db.prepare('UPDATE products SET cost = ?, supplier_id = COALESCE(supplier_id, ?) WHERE id = ?').run(unit, supplier.id, productId);
    const out = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    const prices = await productPrices(productId);
    return { ...out, loaded: { qty, unit_price: unit, supplier_name: supplier.name, doc_number: docNo, purchase_id: doc.id, avg_cost: prices.avg_cost, new_product: !b.product_id } };
  });
}

/** Trasforma un ricambio "a mano" di una riparazione in articolo a catalogo (la giacenza resta 0: il pezzo e' gia' stato usato).
 *  Il ricambio della riparazione viene collegato all'articolo; se il fornitore e' noto il prezzo entra anche nello storico. */
export async function partToStock(repairId, partId) {
  return tx(async () => {
    const part = await db.prepare('SELECT * FROM repair_parts WHERE id = ? AND repair_id = ?').get(partId, repairId);
    if (!part) throw new HttpError(404, 'Ricambio non trovato');
    if (part.product_id) throw new HttpError(409, 'Questo ricambio è già un articolo a magazzino.');
    const rep = await db.prepare('SELECT code FROM repairs WHERE id = ?').get(repairId);
    const sup = part.supplier_name ? await db.prepare('SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)').get(part.supplier_name) : null;
    let prod = part.supplier_code ? await db.prepare('SELECT * FROM products WHERE active = 1 AND sku = ?').get(part.supplier_code) : null;
    prod = prod || (await db.prepare('SELECT * FROM products WHERE active = 1 AND LOWER(name) = LOWER(?)').get(part.name));
    let created = false;
    if (!prod) {
      const r = await db.prepare(`INSERT INTO products (sku, name, category, qty, min_qty, cost, price, supplier_id, created_at) VALUES (?,?,?,0,0,?,?,?,${NOW})`)
        .run(part.supplier_code, part.name.slice(0, 200), 'Ricambi', part.unit_cost, part.unit_price, sup?.id ?? null);
      prod = await db.prepare('SELECT * FROM products WHERE id = ?').get(Number(r.lastInsertRowid));
      created = true;
    }
    // la giacenza non cambia: +qty e -qty lasciano traccia del pezzo passato dal catalogo alla riparazione
    await moveStock(prod.id, part.qty, 'carico da ricambio a mano', rep.code);
    await moveStock(prod.id, -part.qty, 'riparazione', rep.code);
    await db.prepare('UPDATE repair_parts SET product_id = ?, supplier_code = NULL, supplier_name = NULL, bought_at = NULL WHERE id = ?').run(prod.id, part.id);
    if (sup && part.unit_cost > 0) {
      await db.prepare('INSERT INTO price_history (product_id, supplier_id, unit_price, qty, doc_date, purchase_id) VALUES (?,?,?,?,?,?)').run(prod.id, sup.id, part.unit_cost, part.qty, part.bought_at || localDate(), null);
      if (part.supplier_code) await db.prepare('INSERT OR REPLACE INTO supplier_codes (supplier_id, supplier_code, product_id) VALUES (?,?,?)').run(sup.id, part.supplier_code, prod.id);
    }
    return { ok: true, product_id: prod.id, name: prod.name, created };
  });
}

// ---------- Elenco ----------
export async function listPurchases() {
  return db.prepare(`SELECT p.*, s.name AS supplier_name, (SELECT COUNT(*) FROM purchase_lines l WHERE l.purchase_id = p.id) AS lines_count
    FROM purchases p JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.doc_date DESC, p.id DESC LIMIT 200`).all();
}
export async function getPurchase(id) {
  const p = await db.prepare('SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?').get(id);
  if (!p) throw new HttpError(404, 'Acquisto non trovato');
  const lines = await db.prepare('SELECT l.*, pr.name AS product_name FROM purchase_lines l LEFT JOIN products pr ON pr.id = l.product_id WHERE l.purchase_id = ? ORDER BY l.id').all(id);
  return { ...p, lines };
}

/** Registra le rotte /api/purchases/* sull'app Hono (h = adattatore "richiesta -> JSON" di app.mjs). */
export function registerPurchaseRoutes(app, h) {
  app.get('/api/purchases', h(() => listPurchases()));
  app.get('/api/purchases/parsers', h(() => Object.values(parsers).map(({ id, label, supported }) => ({ id, label, supported }))));
  // Carico merce a mano da Magazzino (non per il ruolo Cassa: tocca i costi)
  const loadRoute = h((req) => {
    if (req.user?.role === 'cassa') throw new HttpError(403, 'Il carico merce non è disponibile per il ruolo Cassa.');
    return manualLoad({ ...req.body, product_id: req.params.id ?? req.body.product_id });
  });
  app.post('/api/repairs/:id/parts/:partId/stock', h((req) => {
    if (req.user?.role === 'cassa') throw new HttpError(403, 'Non disponibile per il ruolo Cassa.');
    return partToStock(Number(req.params.id), Number(req.params.partId));
  }));
  app.post('/api/products/load', loadRoute);
  app.post('/api/products/:id/load', loadRoute);
  app.get('/api/purchases/formats', h(() => listFormats())); // formati imparati per fornitore (agente D)
  app.delete('/api/purchases/formats/:id', h((req) => deleteFormat(req.params.id)));
  app.post('/api/purchases/preview', h((req) => previewPurchase(req.body)));
  app.post('/api/purchases/confirm', h((req) => confirmPurchase(req.body)));
  app.get('/api/purchases/prices', h((req) => productPrices(Number(req.query.product_id))));
  app.get('/api/purchases/price-changes', h(async (req) => priceChanges({ days: Number(req.query.days) || 0, includeSame: req.query.all === '1' })));
  app.get('/api/purchases/alerts', h(async () => { const items = await priceAlerts(); return { count: items.length, items }; }));
  app.get('/api/purchases/products', h((req) => productsWithPrices(str(req.query.q))));
  app.get('/api/purchases/last-price', h(async (req) => ({ last: await lastPrice(Number(req.query.product_id), Number(req.query.supplier_id)) })));
  app.get('/api/purchases/:id{[0-9-]+}', h((req) => getPurchase(Number(req.params.id))));
}

// ---------- Dati demo (id NEGATIVI, come in demo.mjs: "elimina demo" cancella gli id < 0) ----------
export function demoPurchaseStatements(ts) {
  const S = [];
  const add = (sql, ...a) => S.push([sql, a]);
  const INFO = [[-1, 'IT00000000011', 'Via Toledo 100, 80134 Napoli (NA)'], [-2, 'IT00000000022', 'Via Roma 12, 20100 Milano (MI)'], [-3, 'IT00000000033', 'Via Appia 5, 00100 Roma (RM)']];
  for (const [id, vat, addr] of INFO) add('INSERT INTO supplier_info (supplier_id, vat, address) VALUES (?,?,?)', id, vat, addr);
  // [id, fornitore, giorni fa, numero, righe[prodotto, codice del fornitore, descrizione, quantità, prezzo netto]]
  const DOCS = [
    [-1, -1, 150, 'RN-2026/412', [[-1, 'DSP13-N', 'Display iPhone 13', 2, 64], [-2, 'BAT11-N', 'Batteria iPhone 11', 5, 13.5]]],
    [-2, -3, 90, 'CC-2026/233', [[-2, 'BAT-IP11-CC', 'Batteria iPhone 11', 4, 14.5], [-9, 'CAR20-CC', 'Caricabatterie 20W USB-C', 10, 5.5], [-6, 'CAVC1-CC', 'Cavo USB-C 1 m', 20, 1.8]]],
    [-3, -2, 110, 'TP-2026/071', [[-1, 'DSP-IP13-TP', 'Display iPhone 13 OLED', 3, 59], [-3, 'DSP-A54-TP', 'Display Samsung A54', 2, 52], [-4, 'BAT-SA-TP', 'Batteria Samsung serie A', 6, 10.5]]],
    [-4, -1, 75, 'RN-2026/655', [[-1, 'DSP13-N', 'Display iPhone 13', 2, 60], [-2, 'BAT11-N', 'Batteria iPhone 11', 5, 13.5], [-3, 'DSPA54-N', 'Display Samsung A54', 2, 55]]],
    [-5, -2, 40, 'TP-2026/139', [[-1, 'DSP-IP13-TP', 'Display iPhone 13 OLED', 2, 57], [-3, 'DSP-A54-TP', 'Display Samsung A54', 2, 51], [-4, 'BAT-SA-TP', 'Batteria Samsung serie A', 6, 10.5]]],
    [-6, -1, 12, 'RN-2026/801', [[-1, 'DSP13-N', 'Display iPhone 13', 2, 62], [-2, 'BAT11-N', 'Batteria iPhone 11', 4, 14], [-3, 'DSPA54-N', 'Display Samsung A54', 2, 56.5]]],
    [-7, -2, 8, 'TP-2026/188', [[-1, 'DSP-IP13-TP', 'Display iPhone 13 OLED', 3, 61], [-4, 'BAT-SA-TP', 'Batteria Samsung serie A', 6, 11.2], [-3, 'DSP-A54-TP', 'Display Samsung A54', 2, 53]]],
  ];
  let ln = 0, ph = 0;
  const seenCodes = new Set();
  for (const [id, sup, d, num, rows] of DOCS) {
    const date = ts(d, '09:00').slice(0, 10);
    const net = rows.reduce((a, r) => a + r[3] * r[4], 0);
    const total = Math.round(net * 1.22 * 100) / 100;
    add('INSERT INTO purchases (id, supplier_id, doc_type, doc_number, doc_date, total, source, notes, imported_at) VALUES (?,?,?,?,?,?,?,?,?)', id, sup, 'TD01', num, date, total, 'fatturapa', 'Fattura demo', ts(d, '09:30'));
    for (const [pid, code, desc, qty, price] of rows) {
      add('INSERT INTO purchase_lines (id, purchase_id, product_id, supplier_code, description, qty, unit, list_price, unit_price, discount, vat_rate, line_total, loaded) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', --ln, id, pid, code, `${desc} (DEMO)`, qty, 'PZ', price, price, 0, 22, Math.round(qty * price * 100) / 100, 1);
      add('INSERT INTO price_history (id, product_id, supplier_id, unit_price, qty, doc_date, purchase_id) VALUES (?,?,?,?,?,?,?)', --ph, pid, sup, price, qty, date, id);
      if (!seenCodes.has(`${sup}|${code}`)) { seenCodes.add(`${sup}|${code}`); add('INSERT INTO supplier_codes (supplier_id, supplier_code, product_id) VALUES (?,?,?)', sup, code, pid); }
    }
  }
  return S;
}

/** Istruzioni di cancellazione dei dati demo degli acquisti (da eseguire PRIMA di prodotti e fornitori). */
export const DEMO_PURCHASE_DELETES = [
  'DELETE FROM price_history WHERE id < 0 OR product_id < 0 OR supplier_id < 0 OR purchase_id < 0',
  'DELETE FROM purchase_lines WHERE id < 0 OR purchase_id < 0',
  'DELETE FROM purchases WHERE id < 0',
  'DELETE FROM supplier_codes WHERE supplier_id < 0 OR product_id < 0',
  'DELETE FROM supplier_info WHERE supplier_id < 0',
];
