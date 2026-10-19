// Etichette dei prodotti con logo, nome, prezzo e codice a barre + ricerca dell'articolo dal codice letto (pistola o fotocamera).
//  - Template: misura, elementi (logo, nome, prezzo, codice a barre...) e posizione di ciascuno, gestiti da Impostazioni.
//  - Codice a barre: quello del produttore (EAN) se l'articolo ne ha uno, altrimenti un codice interno EAN-13 (barcode.mjs) assegnato
//    in automatico alla prima stampa. Le etichette gia' stampate restano valide: il codice interno dipende solo dall'id dell'articolo.
//  - Cassa/Magazzino: GET /api/products/by-code/:code trova l'articolo da barcode, SKU, codice del fornitore o codice interno.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';
import { internalEan, idFromInternalEan, barcodeBoxSvg } from './barcode.mjs';
import { LOGO_FULL, LOGO_WORD } from './etichette-logo.mjs';

export const LABEL_TABLES = ['label_templates', 'label_assets'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(Number(n) * 10) / 10;
const NOW = "datetime('now','localtime')";

// ---------- Misure e tipi ----------
/** Misure proposte nell'editor (rotoli per stampanti termiche e un formato per fogli adesivi A4). */
export const PRESETS = [
  { id: '62x30', label: 'Rotolo 62 × 30 mm (come l’etichetta delle riparazioni)', w: 62, h: 30 },
  { id: '62x29', label: 'Brother QL 62 × 29 mm', w: 62, h: 29 },
  { id: '100x62', label: 'Brother QL 100 × 62 mm', w: 100, h: 62 },
  { id: '90x38', label: 'Brother QL 90 × 38 mm', w: 90, h: 38 },
  { id: '90x29', label: 'Brother QL 90 × 29 mm', w: 90, h: 29 },
  { id: '54x17', label: 'Brother QL 54 × 17 mm (piccola)', w: 54, h: 17 },
  { id: '57x32', label: 'DYMO 57 × 32 mm', w: 57, h: 32 },
  { id: '89x28', label: 'DYMO 89 × 28 mm', w: 89, h: 28 },
  { id: '54x25', label: 'DYMO 54 × 25 mm', w: 54, h: 25 },
  { id: '50x30', label: 'Generica 50 × 30 mm', w: 50, h: 30 },
  { id: '40x30', label: 'Generica 40 × 30 mm', w: 40, h: 30 },
  { id: '70x37', label: 'Foglio A4 adesivo 70 × 37 mm (3 × 8)', w: 70, h: 37, sheet: { cols: 3, rows: 8, top: 0, left: 0, gap_x: 0, gap_y: 0 } },
];

export const TYPES = {
  logo: 'Logo',
  name: 'Nome del prodotto',
  price: 'Prezzo',
  barcode: 'Codice a barre',
  code: 'Numero del codice (sotto le barre)',
  category: 'Categoria',
  sku: 'Codice articolo (SKU)',
  shop: 'Nome del negozio',
  text: 'Testo libero',
};
const ALIGN = ['left', 'center', 'right'];
const LOGOS = ['word', 'full', 'custom'];

/** Template di partenza: rotolo 62 × 30 mm con logo (scritta), prezzo, nome, codice a barre e numero. */
export const DEFAULT_TEMPLATE = {
  name: 'Etichetta prodotto', width: 62, height: 30, layout: 'roll', border: false,
  sheet: { cols: 3, rows: 8, top: 0, left: 0, gap_x: 0, gap_y: 0 },
  elements: [
    { type: 'logo', on: true, x: 1.5, y: 1.8, w: 22, h: 5, align: 'left', logo: 'word' },
    { type: 'price', on: true, x: 25, y: 0.8, w: 35.5, h: 7.6, size: 18, bold: true, align: 'right' },
    { type: 'name', on: true, x: 1.5, y: 8.8, w: 59, h: 7.6, size: 9, bold: true, align: 'left', lines: 2 },
    { type: 'barcode', on: true, x: 5, y: 17, w: 52, h: 8.4 },
    { type: 'code', on: true, x: 1.5, y: 25.7, w: 59, h: 3.4, size: 6.5, align: 'center' },
    { type: 'category', on: false, x: 1.5, y: 8.8, w: 30, h: 3.5, size: 6, align: 'left' },
    { type: 'sku', on: false, x: 32, y: 8.8, w: 29, h: 3.5, size: 6, align: 'right' },
    { type: 'shop', on: false, x: 1.5, y: 25.7, w: 30, h: 3.4, size: 6, align: 'left' },
    { type: 'text', on: false, x: 1.5, y: 25.7, w: 59, h: 3.4, size: 6.5, align: 'center', text: 'Garanzia 24 mesi' },
  ],
};

const bad = (message, code, hint) => new HttpError(400, message, { code, hint });
const numIn = (v, min, max, what, code) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${what}: serve un numero tra ${min} e ${max}.`, code || 'ETICHETTA_VALORE_NON_VALIDO', 'Correggi il valore e salva di nuovo.');
  return n;
};

/** Controlla e normalizza un template ricevuto dall'editor. Lancia errori parlanti. */
export function cleanTemplate(b = {}) {
  const name = String(b.name ?? '').trim();
  if (!name) throw bad('Il template non ha un nome: non posso salvarlo.', 'ETICHETTA_NOME_MANCANTE', 'Scrivi un nome per riconoscerlo, per esempio “Cavi 62 × 30”.');
  if (name.length > 60) throw bad('Il nome del template è troppo lungo (massimo 60 caratteri).', 'ETICHETTA_NOME_LUNGO', 'Accorcia il nome.');
  const width = r1(numIn(b.width, 15, 250, 'La larghezza dell’etichetta (mm)', 'ETICHETTA_MISURE_NON_VALIDE'));
  const height = r1(numIn(b.height, 10, 250, 'L’altezza dell’etichetta (mm)', 'ETICHETTA_MISURE_NON_VALIDE'));
  const layout = b.layout === 'sheet' ? 'sheet' : 'roll';
  const s = b.sheet || {};
  const sheet = {
    cols: Math.round(numIn(s.cols ?? 3, 1, 12, 'Le colonne del foglio', 'ETICHETTA_FOGLIO_NON_VALIDO')),
    rows: Math.round(numIn(s.rows ?? 8, 1, 40, 'Le righe del foglio', 'ETICHETTA_FOGLIO_NON_VALIDO')),
    top: r1(numIn(s.top ?? 0, 0, 100, 'Il margine alto del foglio (mm)', 'ETICHETTA_FOGLIO_NON_VALIDO')),
    left: r1(numIn(s.left ?? 0, 0, 100, 'Il margine sinistro del foglio (mm)', 'ETICHETTA_FOGLIO_NON_VALIDO')),
    gap_x: r1(numIn(s.gap_x ?? 0, 0, 30, 'Lo spazio tra le colonne (mm)', 'ETICHETTA_FOGLIO_NON_VALIDO')),
    gap_y: r1(numIn(s.gap_y ?? 0, 0, 30, 'Lo spazio tra le righe (mm)', 'ETICHETTA_FOGLIO_NON_VALIDO')),
  };
  if (layout === 'sheet') {
    const usedW = sheet.left + sheet.cols * width + (sheet.cols - 1) * sheet.gap_x;
    const usedH = sheet.top + sheet.rows * height + (sheet.rows - 1) * sheet.gap_y;
    if (usedW > 210.5 || usedH > 297.5) throw bad(`Le etichette non stanno nel foglio A4: servono ${r1(usedW)} × ${r1(usedH)} mm, il foglio è 210 × 297.`, 'ETICHETTA_FOGLIO_NON_VALIDO', 'Riduci colonne, righe, misure o margini.');
  }
  const raw = Array.isArray(b.elements) ? b.elements : [];
  if (raw.length > 24) throw bad('Troppi elementi nell’etichetta (massimo 24).', 'ETICHETTA_TROPPI_ELEMENTI', 'Togli gli elementi che non servono.');
  const elements = raw.map((e) => {
    const type = String(e?.type || '');
    if (!TYPES[type]) throw bad(`Elemento sconosciuto nell’etichetta (“${type || 'senza tipo'}”).`, 'ETICHETTA_ELEMENTO_NON_VALIDO', 'Ricarica la pagina e riprova.');
    const out = {
      type, on: e.on === true || e.on === 1 || e.on === '1',
      x: r1(Math.min(Math.max(Number(e.x) || 0, 0), width - 1)), y: r1(Math.min(Math.max(Number(e.y) || 0, 0), height - 1)),
      w: r1(Math.min(Math.max(Number(e.w) || 5, 2), width * 1.5)), h: r1(Math.min(Math.max(Number(e.h) || 3, 2), height * 1.5)),
    };
    if (type !== 'logo' && type !== 'barcode') {
      out.size = Math.min(Math.max(Number(e.size) || 8, 4), 72);
      out.bold = e.bold === true || e.bold === 1 || e.bold === '1';
    }
    out.align = ALIGN.includes(e.align) ? e.align : (type === 'price' ? 'right' : type === 'code' ? 'center' : 'left');
    if (type === 'name') out.lines = Math.min(Math.max(Math.round(Number(e.lines) || 2), 1), 4);
    if (type === 'text') out.text = String(e.text ?? '').slice(0, 80);
    if (type === 'logo') out.logo = LOGOS.includes(e.logo) ? e.logo : 'word';
    return out;
  });
  if (!elements.some((e) => e.on)) throw bad('Il template non ha nessun elemento attivo: l’etichetta uscirebbe vuota.', 'ETICHETTA_VUOTA', 'Accendi almeno il nome, il prezzo o il codice a barre.');
  return { name, width, height, layout, sheet, border: b.border === true || b.border === 1 || b.border === '1', elements };
}

// ---------- Disegno dell'etichetta ----------
const PT = 0.3528; // millimetri per punto tipografico

/** Righe necessarie per scrivere `text` in righe da `perLine` caratteri (a capo per parole). */
function wrapCount(text, perLine) {
  let lines = 1, cur = 0;
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    let wl = word.length;
    while (wl > perLine) { if (cur) { lines++; cur = 0; } lines++; wl -= perLine; }
    if (cur === 0) cur = wl; else if (cur + 1 + wl <= perLine) cur += 1 + wl; else { lines++; cur = wl; }
  }
  return lines;
}

/** Corpo piu' grande (fino a e.size) con cui il testo sta nel riquadro. ok=false: neppure al minimo (il testo verra' accorciato). */
function fitText(text, e, maxLines, { cw = 0.52, min = 4.5 } = {}) {
  const t = String(text ?? '');
  const bold = e.bold ? 0.06 : 0;
  for (let size = e.size; size >= min; size = r1(size - 0.5)) {
    const charMm = size * PT * (cw + bold);
    const perLine = Math.max(1, Math.floor(e.w / charMm));
    const fitH = Math.max(1, Math.floor((e.h + 0.05) / (size * PT * 1.12)));
    const need = wrapCount(t, perLine);
    if (need <= Math.min(maxLines, fitH)) return { size, lines: Math.min(maxLines, fitH), ok: true };
  }
  const fitH = Math.max(1, Math.floor((e.h + 0.05) / (min * PT * 1.12)));
  return { size: min, lines: Math.min(maxLines, fitH), ok: false };
}

export const fmtPrice = (n) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Codice che finisce sull'etichetta: quello assegnato all'articolo, altrimenti il codice interno (dipende solo dall'id). */
export const codeFor = (p) => String(p?.barcode || '').trim() || internalEan(p.id);

const logoUrl = (e, ver) => (e.logo === 'custom' ? `/api/labels/logo/custom?v=${ver || 0}` : `/api/labels/logo/${e.logo === 'full' ? 'full' : 'word'}`);

/** Disegna UNA etichetta. `data` = { name, price, category, sku, shop, code }. Ritorna { html, warnings }. */
export function renderLabel(t, data, { logoVer = 0 } = {}) {
  const warnings = [];
  const parts = [];
  for (const e of t.elements) {
    if (!e.on) continue;
    const style = `left:${e.x}mm;top:${e.y}mm;width:${e.w}mm;height:${e.h}mm`;
    if (e.x + e.w > t.width + 0.3 || e.y + e.h > t.height + 0.3) warnings.push(`“${TYPES[e.type]}” esce dai bordi dell’etichetta: sposta o rimpicciolisci l’elemento.`);
    const just = e.align === 'center' ? 'center' : e.align === 'right' ? 'flex-end' : 'flex-start';
    if (e.type === 'logo') {
      parts.push(`<div class="e lg" data-el="logo" style="${style}"><img src="${logoUrl(e, logoVer)}" alt="" style="object-position:${e.align === 'center' ? 'center' : e.align} center" /></div>`);
    } else if (e.type === 'barcode') {
      const bc = barcodeBoxSvg(data.code);
      const minBar = bc.kind === 'ean13' ? 0.26 : 0.19;
      const bar = e.w / bc.modules;
      if (bar < minBar) warnings.push(`Il codice a barre è troppo stretto (${bar.toFixed(2).replace('.', ',')} mm per barra, ne servono almeno ${String(minBar).replace('.', ',')}): allarga il riquadro o usa un’etichetta più larga.`);
      parts.push(`<div class="e bc" data-el="barcode" style="${style}">${bc.svg}</div>`);
    } else {
      let text = '';
      let maxLines = 1;
      let cw = 0.52;
      if (e.type === 'name') { text = data.name; maxLines = e.lines || 2; }
      else if (e.type === 'price') { text = `€ ${fmtPrice(data.price)}`; cw = 0.62; }
      else if (e.type === 'code') { text = data.code; cw = 0.62; }
      else if (e.type === 'category') text = data.category;
      else if (e.type === 'sku') text = data.sku;
      else if (e.type === 'shop') text = data.shop;
      else if (e.type === 'text') text = e.text;
      text = String(text ?? '').trim();
      if (!text) continue;
      const f = fitText(text, e, maxLines, { cw });
      if (!f.ok) warnings.push(`“${TYPES[e.type]}” è troppo lungo per lo spazio e verrà accorciato: allarga il riquadro o riduci il corpo del testo.`);
      parts.push(`<div class="e tx" data-el="${e.type}" style="${style};justify-content:${just}"><span style="font-size:${f.size}pt;font-weight:${e.bold ? 700 : 400};text-align:${e.align};-webkit-line-clamp:${f.lines}">${esc(text)}</span></div>`);
    }
  }
  return { html: `<div class="lab${t.border ? ' bd' : ''}" style="width:${t.width}mm;height:${t.height}mm">${parts.join('')}</div>`, warnings: [...new Set(warnings)] };
}

/** Stile comune di anteprima e stampa (le misure sono in mm: la stampa esce esatta). */
export const LABEL_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
.lab{position:relative;background:#fff;color:#000;overflow:hidden;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lab.bd{border:.3mm solid #000}
.lab .e{position:absolute;overflow:hidden;line-height:1.12;color:#000}
.lab .e.tx{display:flex;align-items:center}
.lab .e.tx>span{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;width:100%;overflow-wrap:anywhere}
.lab .e.lg img{display:block;width:100%;height:100%;object-fit:contain}
.lab .e.bc svg{display:block;width:100%;height:100%}`;

/** Dati dell'etichetta di un articolo. */
export function labelData(p, shop) {
  return { name: p.name, price: p.price, category: p.category || '', sku: p.sku || '', shop: shop || '', code: codeFor(p) };
}
export const SAMPLE = { id: 1234, name: 'Cavo USB-C intrecciato 1 m', price: 9.9, category: 'Cavi e caricatori', sku: 'CAV-USBC-1', barcode: null };

/** Pagina di stampa: un'etichetta per pagina (rotolo) oppure fogli A4 a griglia. */
export function printPage(t, labels, { logoVer = 0, noprint = false, skip = 0 } = {}) {
  const htmls = labels.map((d) => renderLabel(t, d, { logoVer }));
  const warnings = [...new Set(htmls.flatMap((x) => x.warnings))];
  let body;
  let pageCss;
  if (t.layout === 'sheet') {
    const per = t.sheet.cols * t.sheet.rows;
    const cells = [...Array(Math.max(0, Math.min(skip, per - 1))).fill(`<div class="lab" style="width:${t.width}mm;height:${t.height}mm"></div>`), ...htmls.map((x) => x.html)];
    const sheets = [];
    for (let i = 0; i < cells.length; i += per) sheets.push(cells.slice(i, i + per).join(''));
    body = sheets.map((s) => `<div class="sheet">${s}</div>`).join('');
    pageCss = `@page{size:A4;margin:0}.sheet{width:210mm;height:297mm;padding:${t.sheet.top}mm 0 0 ${t.sheet.left}mm;display:grid;grid-template-columns:repeat(${t.sheet.cols},${t.width}mm);grid-auto-rows:${t.height}mm;gap:${t.sheet.gap_y}mm ${t.sheet.gap_x}mm;align-content:start;justify-content:start;break-after:page;page-break-after:always;overflow:hidden}.sheet:last-child{break-after:auto;page-break-after:auto}`;
  } else {
    body = htmls.map((x) => x.html).join('');
    pageCss = `@page{size:${t.width}mm ${t.height}mm;margin:0}.lab{break-after:page;page-break-after:always}.lab:last-child{break-after:auto;page-break-after:auto}`;
  }
  const info = `${labels.length} etichett${labels.length === 1 ? 'a' : 'e'} · ${esc(t.name)} · ${t.width} × ${t.height} mm${t.layout === 'sheet' ? ' su fogli A4' : ''}`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etichette prodotti</title><style>${LABEL_CSS}${pageCss}
html,body{background:#fff}body{font-family:Arial,Helvetica,sans-serif}
.bar{padding:10px 14px;background:#f3f4f6;border-bottom:1px solid #d1d5db;font-size:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.bar button{padding:8px 14px;font-weight:700;cursor:pointer}.bar .w{color:#92400e;flex-basis:100%}
@media screen{.lab{outline:1px dashed #9ca3af;margin:8px 14px}.sheet{margin:8px auto;outline:1px solid #d1d5db}}
@media print{.bar{display:none}}
</style></head><body><div class="bar"><button onclick="window.print()">🖨️ Stampa</button><span>${info}</span><span>Nella finestra di stampa scegli la stampante delle etichette, margini “nessuno” e scala 100%.</span>${warnings.map((w) => `<span class="w">⚠️ ${esc(w)}</span>`).join('')}</div>${body}${noprint ? '' : '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})</script>'}</body></html>`;
}

// ---------- Template: archivio ----------
const rowToTemplate = (r) => {
  let cfg = {};
  try { cfg = JSON.parse(r.config || '{}'); } catch { /* config rovinata: si usa il template di partenza */ }
  const base = { ...DEFAULT_TEMPLATE, ...cfg };
  return { id: r.id, name: r.name, width: r.width_mm, height: r.height_mm, layout: base.layout, sheet: { ...DEFAULT_TEMPLATE.sheet, ...(base.sheet || {}) }, border: !!base.border, elements: base.elements, is_default: !!r.is_default, updated_at: r.updated_at };
};
const cfgOf = (t) => JSON.stringify({ layout: t.layout, sheet: t.sheet, border: t.border, elements: t.elements });

/** Elenco dei template; la prima volta crea quello di partenza. */
export async function listTemplates() {
  let rows = await db.prepare('SELECT * FROM label_templates ORDER BY is_default DESC, id').all();
  if (!rows.length) {
    const t = cleanTemplate(DEFAULT_TEMPLATE);
    await db.prepare(`INSERT INTO label_templates (name, width_mm, height_mm, config, is_default, created_at, updated_at) VALUES (?,?,?,?,1,${NOW},${NOW})`).run(t.name, t.width, t.height, cfgOf(t));
    rows = await db.prepare('SELECT * FROM label_templates ORDER BY is_default DESC, id').all();
  }
  return rows.map(rowToTemplate);
}
export async function getTemplate(id) {
  const list = await listTemplates();
  if (id == null || id === '') return list.find((t) => t.is_default) || list[0];
  const t = list.find((x) => x.id === Number(id));
  if (!t) throw new HttpError(404, 'Questo template di etichetta non esiste più.', { code: 'ETICHETTA_NON_TROVATA', hint: 'Aggiorna la pagina e scegli un altro template.' });
  return t;
}

/** Versione del logo personalizzato (cambia quando lo si carica: serve a non vedere l'immagine vecchia dalla cache). */
export async function logoVersion() {
  const r = await db.prepare("SELECT updated_at FROM label_assets WHERE key = 'logo'").get();
  return r ? String(r.updated_at).replace(/\D/g, '') : '0';
}

// ---------- Ricerca dell'articolo dal codice ----------
/** Varianti dello stesso codice: un UPC-A (12 cifre) letto come EAN-13 ha uno 0 davanti, e viceversa. */
export function codeVariants(code) {
  const c = String(code).trim();
  const v = new Set([c]);
  if (/^\d{13}$/.test(c) && c[0] === '0') v.add(c.slice(1));
  if (/^\d{12}$/.test(c)) v.add(`0${c}`);
  return [...v];
}

/**
 * Trova l'articolo attivo con questo codice. Ordine: codice a barre assegnato, SKU, codice del fornitore, codice interno.
 * Ritorna { product, via, duplicates } oppure null. `duplicates` = altri articoli con lo stesso codice allo stesso livello.
 */
export async function findProductByCode(raw) {
  const code = String(raw ?? '').trim();
  if (!code || code.length > 64) return null;
  const vars = codeVariants(code);
  const ph = vars.map(() => '?').join(',');
  const levels = [
    ['barcode', `SELECT * FROM products WHERE active = 1 AND barcode IN (${ph}) ORDER BY id LIMIT 5`],
    ['sku', `SELECT * FROM products WHERE active = 1 AND sku IS NOT NULL AND sku COLLATE NOCASE IN (${ph}) ORDER BY id LIMIT 5`],
    ['fornitore', `SELECT p.* FROM supplier_codes sc JOIN products p ON p.id = sc.product_id WHERE p.active = 1 AND sc.supplier_code COLLATE NOCASE IN (${ph}) ORDER BY p.id LIMIT 5`],
  ];
  for (const [via, sql] of levels) {
    const rows = await db.prepare(sql).all(...vars);
    if (rows.length) return { product: rows[0], via, duplicates: rows.length - 1 };
  }
  for (const v of vars) {
    const id = idFromInternalEan(v);
    if (id) {
      const p = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id);
      if (p) return { product: p, via: 'interno', duplicates: 0 };
    }
  }
  return null;
}

/** Codice scritto a mano per un articolo: pulito, stampabile e non gia' usato da un altro articolo attivo. */
export async function cleanBarcode(raw, { exceptId = null } = {}) {
  const code = String(raw ?? '').trim();
  if (!code) return null;
  if (code.length > 40 || !/^[\x20-\x7e]+$/.test(code)) throw bad('Il codice a barre non è valido: al massimo 40 caratteri, solo lettere, numeri e simboli normali.', 'CODICE_NON_VALIDO', 'Scrivi di nuovo il codice oppure leggilo con la pistola.');
  for (const v of codeVariants(code)) {
    const other = await db.prepare('SELECT id, name FROM products WHERE active = 1 AND barcode = ? AND id <> ? LIMIT 1').get(v, exceptId ?? 0);
    if (other) throw new HttpError(409, `Il codice ${code} è già assegnato a «${other.name}»: due articoli non possono avere lo stesso codice a barre.`, { code: 'CODICE_GIA_USATO', hint: 'Controlla il codice, oppure togli il codice all’altro articolo.' });
  }
  return code;
}

/** Assegna il codice interno agli articoli che non hanno codice a barre. Ritorna quanti ne ha sistemati. */
async function assignMissing(ids) {
  const where = ids ? `id IN (${ids.map(() => '?').join(',')}) AND` : '';
  const rows = await db.prepare(`SELECT id FROM products WHERE ${where} active = 1 AND (barcode IS NULL OR barcode = '')`).all(...(ids || []));
  const stmts = rows.map((r) => ['UPDATE products SET barcode = ? WHERE id = ? AND (barcode IS NULL OR barcode = \'\')', [internalEan(r.id), r.id]]);
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  return rows.length;
}

const MAX_ITEMS = 300;
const MAX_LABELS = 2000;
/** "12:3,15:1" -> [{ id, qty }] */
export function parseItems(s) {
  const out = [];
  for (const part of String(s || '').split(',').filter(Boolean)) {
    const m = part.match(/^(\d{1,9}):(\d{1,4})$/);
    if (!m || Number(m[2]) < 1) throw bad('L’elenco delle etichette da stampare non è valido.', 'ETICHETTE_ELENCO_NON_VALIDO', 'Riapri “Etichette” da Magazzino e scegli di nuovo gli articoli.');
    out.push({ id: Number(m[1]), qty: Number(m[2]) });
  }
  if (!out.length) throw bad('Non hai scelto nessun articolo da stampare.', 'ETICHETTE_NESSUN_ARTICOLO', 'Spunta almeno un articolo e indica quante etichette servono.');
  if (out.length > MAX_ITEMS) throw bad(`Troppi articoli in una volta (massimo ${MAX_ITEMS}).`, 'ETICHETTE_TROPPE', 'Stampa a gruppi più piccoli.');
  if (out.reduce((a, x) => a + x.qty, 0) > MAX_LABELS) throw bad(`Troppe etichette in una volta (massimo ${MAX_LABELS}).`, 'ETICHETTE_TROPPE', 'Stampa a gruppi più piccoli.');
  return out;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47];
const b64bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// ---------- Rotte ----------
export function registerLabelRoutes(app, h, page, adminOnly, { getSettings }) {
  app.get('/api/labels/templates', h(async () => ({
    templates: await listTemplates(), presets: PRESETS, types: TYPES,
    logo: { custom: !!(await db.prepare("SELECT key FROM label_assets WHERE key = 'logo'").get()), version: await logoVersion() },
  })));

  app.post('/api/labels/templates', h(async (req) => {
    adminOnly(req);
    const t = cleanTemplate(req.body);
    const n = await db.prepare('SELECT COUNT(*) AS n FROM label_templates').get();
    if (n.n >= 30) throw new HttpError(409, 'Ci sono già 30 template: elimina quelli che non usi prima di crearne altri.', { code: 'ETICHETTE_TROPPI_TEMPLATE', hint: 'Elimina un template e riprova.' });
    const r = await db.prepare(`INSERT INTO label_templates (name, width_mm, height_mm, config, is_default, created_at, updated_at) VALUES (?,?,?,?,0,${NOW},${NOW})`).run(t.name, t.width, t.height, cfgOf(t));
    return getTemplate(Number(r.lastInsertRowid));
  }));
  app.put('/api/labels/templates/:id', h(async (req) => {
    adminOnly(req);
    await getTemplate(req.params.id);
    const t = cleanTemplate(req.body);
    await db.prepare(`UPDATE label_templates SET name = ?, width_mm = ?, height_mm = ?, config = ?, updated_at = ${NOW} WHERE id = ?`).run(t.name, t.width, t.height, cfgOf(t), req.params.id);
    return getTemplate(req.params.id);
  }));
  app.post('/api/labels/templates/:id/default', h(async (req) => {
    adminOnly(req);
    await getTemplate(req.params.id);
    await db.prepare('UPDATE label_templates SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END').run(req.params.id);
    return getTemplate(req.params.id);
  }));
  app.delete('/api/labels/templates/:id', h(async (req) => {
    adminOnly(req);
    const t = await getTemplate(req.params.id);
    const list = await listTemplates();
    if (list.length <= 1) throw new HttpError(409, 'Questo è l’unico template: non lo elimino, altrimenti non potresti più stampare etichette.', { code: 'ETICHETTA_ULTIMA', hint: 'Crea prima un altro template, poi elimina questo.' });
    await db.prepare('DELETE FROM label_templates WHERE id = ?').run(t.id);
    if (t.is_default) { const first = await db.prepare('SELECT id FROM label_templates ORDER BY id LIMIT 1').get(); await db.prepare('UPDATE label_templates SET is_default = 1 WHERE id = ?').run(first.id); }
    return { ok: true, id: t.id, name: t.name };
  }));

  /** Anteprima di UNA etichetta con il template in modifica (anche non salvato) e un articolo vero o di esempio. */
  app.post('/api/labels/preview', h(async (req) => {
    const t = cleanTemplate(req.body.template || {});
    const s = await getSettings();
    let p = SAMPLE;
    if (req.body.product_id) p = (await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.body.product_id)) || SAMPLE;
    const out = renderLabel(t, labelData(p, s.shop_name), { logoVer: await logoVersion() });
    return { css: LABEL_CSS, html: out.html, warnings: out.warnings, width: t.width, height: t.height };
  }));

  // Logo personalizzato: PNG in solo nero con sfondo trasparente (lo prepara il browser, che lo riduce e lo rende bianco/nero)
  app.get('/api/labels/logo/:which', async (c) => {
    const which = c.req.param('which');
    let b64 = null;
    if (which === 'full') b64 = LOGO_FULL.b64;
    else if (which === 'word') b64 = LOGO_WORD.b64;
    else if (which === 'custom') b64 = (await db.prepare("SELECT data FROM label_assets WHERE key = 'logo'").get())?.data || LOGO_WORD.b64; // logo personale tolto: torna la scritta
    if (!b64) return c.body(null, 404);
    return c.body(b64bytes(b64), 200, { 'content-type': 'image/png', 'cache-control': 'private, max-age=86400' });
  });
  app.put('/api/labels/logo', h(async (req) => {
    adminOnly(req);
    const m = String(req.body.data_url || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw bad('Il logo non è un’immagine PNG valida: non l’ho salvato.', 'LOGO_NON_VALIDO', 'Scegli un’immagine (PNG, JPG o SVG): la preparo io in bianco e nero.');
    let bytes;
    try { bytes = b64bytes(m[1]); } catch { bytes = null; }
    if (!bytes || bytes.length < 60 || PNG_SIG.some((v, i) => bytes[i] !== v)) throw bad('Il logo non è un’immagine PNG valida: non l’ho salvato.', 'LOGO_NON_VALIDO', 'Scegli un’altra immagine.');
    if (bytes.length > 300 * 1024) throw bad('Il logo è troppo pesante (massimo 300 KB).', 'LOGO_TROPPO_PESANTE', 'Usa un’immagine più piccola.');
    await db.prepare(`INSERT INTO label_assets (key, mime, data, updated_at) VALUES ('logo','image/png',?,${NOW}) ON CONFLICT(key) DO UPDATE SET data = excluded.data, mime = excluded.mime, updated_at = excluded.updated_at`).run(m[1]);
    return { ok: true, version: await logoVersion() };
  }));
  app.delete('/api/labels/logo', h(async (req) => {
    adminOnly(req);
    await db.prepare("DELETE FROM label_assets WHERE key = 'logo'").run();
    return { ok: true };
  }));

  // Codici a barre degli articoli
  app.get('/api/products/by-code/:code', h(async (req) => {
    const found = await findProductByCode(req.params.code);
    if (found) {
      const sup = await db.prepare('SELECT name FROM suppliers WHERE id = ?').get(found.product.supplier_id || 0);
      return { ...found.product, supplier_name: sup?.name || null, via: found.via, duplicates: found.duplicates };
    }
    const old = await db.prepare('SELECT name FROM products WHERE active = 0 AND (barcode = ? OR sku = ?) LIMIT 1').get(String(req.params.code).trim(), String(req.params.code).trim());
    if (old) throw new HttpError(409, `Il codice ${req.params.code} è di «${old.name}», un articolo archiviato: non si può vendere.`, { code: 'ARTICOLO_ARCHIVIATO', hint: 'Ripristinalo dal Magazzino oppure usa un altro articolo.' });
    throw new HttpError(404, `Nessun articolo ha il codice ${String(req.params.code).slice(0, 40)}.`, { code: 'CODICE_NON_TROVATO', hint: 'Controlla di aver letto bene il codice, oppure crea l’articolo da Magazzino e scrivi il codice nel campo “Codice a barre”.' });
  }));
  app.post('/api/labels/assign-missing', h(async (req) => {
    adminOnly(req);
    return { assigned: await assignMissing(null) };
  }));
  /** Prima di stampare: dà un codice a barre agli articoli che non ce l'hanno e ritorna l'indirizzo della pagina di stampa. */
  app.post('/api/labels/prepare', h(async (req) => {
    const items = (Array.isArray(req.body.items) ? req.body.items : []).map((x) => `${Math.round(Number(x.product_id))}:${Math.round(Number(x.qty))}`).join(',');
    const list = parseItems(items);
    const ids = list.map((x) => x.id);
    const rows = await db.prepare(`SELECT id, name FROM products WHERE active = 1 AND id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    if (!rows.length) throw new HttpError(404, 'Gli articoli scelti non esistono più (o sono archiviati).', { code: 'ARTICOLO_NON_TROVATO', hint: 'Aggiorna il Magazzino e scegli di nuovo.' });
    const known = new Set(rows.map((r) => r.id));
    const ok = list.filter((x) => known.has(x.id));
    const assigned = await assignMissing([...known]);
    const codes = Object.fromEntries((await db.prepare(`SELECT id, barcode FROM products WHERE id IN (${[...known].map(() => '?').join(',')})`).all(...known)).map((x) => [x.id, x.barcode]));
    const t = await getTemplate(req.body.template_id);
    const q = new URLSearchParams({ items: ok.map((x) => `${x.id}:${x.qty}`).join(','), template: String(t.id) });
    if (Number(req.body.skip) > 0) q.set('skip', String(Math.round(Number(req.body.skip))));
    return { count: ok.reduce((a, x) => a + x.qty, 0), articles: ok.length, assigned, codes, template: t.name, names: rows.slice(0, 6).map((r) => r.name), url: `/print/labels?${q}` };
  }));

  app.get('/print/labels', page(async (c) => {
    const q = c.req.query();
    const s = await getSettings();
    const t = await getTemplate(q.template);
    let labels;
    if (q.sample === '1') labels = Array.from({ length: Math.min(Math.max(Number(q.qty) || 1, 1), 50) }, () => labelData(SAMPLE, s.shop_name));
    else {
      const items = parseItems(q.items);
      const rows = await db.prepare(`SELECT * FROM products WHERE active = 1 AND id IN (${items.map(() => '?').join(',')})`).all(...items.map((x) => x.id));
      const byId = new Map(rows.map((r) => [r.id, r]));
      labels = items.filter((x) => byId.has(x.id)).flatMap((x) => Array.from({ length: x.qty }, () => labelData(byId.get(x.id), s.shop_name)));
      if (!labels.length) throw new HttpError(404, 'Gli articoli da stampare non esistono più (o sono archiviati).', { code: 'ARTICOLO_NON_TROVATO', hint: 'Aggiorna il Magazzino e scegli di nuovo.' });
    }
    return c.html(printPage(t, labels, { logoVer: await logoVersion(), noprint: q.noprint === '1', skip: Number(q.skip) || 0 }));
  }));
}
