// Import di DDT e fatture in PDF: lettura del TESTO del documento al momento dell'importazione.
//
// Il testo del PDF lo estrae il browser (officina/public/pdftext.js, con pdf.js): cosi' il Worker non carica librerie pesanti.
// Qui c'e' il lettore "a piu' passaggi", scritto per essere esteso e corretto da chi controlla l'anteprima:
//   1. righe e celle (colonne separate da tabulazioni o da 2+ spazi)
//   2. fornitore (ragione sociale, P.IVA col controllo della cifra di controllo, indirizzo, recapiti)
//   3. documento (tipo, numero, data)
//   4. tabella articoli: prima col FORMATO IMPARATO del fornitore, poi con l'intestazione di colonna, poi con le euristiche sui numeri
//   5. controlli (quadratura dei totali, righe dubbie) -> avvisi e livello di fiducia per riga
// Nessun modello di esempio e' ancora disponibile: i test usano documenti sintetici. Ogni passaggio e' una funzione separata e il
// dizionario delle colonne (ROLE_WORDS) si amplia senza toccare il resto. Dopo ogni conferma si "impara" il formato del fornitore
// (supplier_formats): la volta dopo le colonne sono quelle gia' corrette dall'utente.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const DOC_LABELS = { DDT: 'Documento di trasporto (DDT)', TD01: 'Fattura', TD04: 'Nota di credito' };
export const MAX_TEXT = 400000;

// ---------- Numeri e date ----------
/** "1.234,56" "12,50" "12.50" "€ 3,00" "22%" -> numero (o null). */
export function parseNum(v) {
  let s = String(v ?? '').trim().replace(/[€%\s]/g, '').replace(/^\+/, '');
  if (!/^-?\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const lc = s.lastIndexOf(','); const ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replaceAll('.', '').replace(',', '.') : s.replaceAll(',', '');
  else if (lc > -1) s = (s.match(/,/g) || []).length > 1 ? s.replaceAll(',', '') : s.replace(',', '.');
  else if (ld > -1 && ((s.match(/\./g) || []).length > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(s))) s = s.replaceAll('.', ''); // 1.234 = milleduecentotrentaquattro (uso italiano)
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
const isNumCell = (c) => /^[€]?\s*-?\d[\d.,]*\s*[€%]?$/.test(String(c).trim()) && parseNum(c) !== null;

/** "12/10/2026" "12-10-26" "12.10.2026" -> "2026-10-12" (o null se non e' una data vera). */
export function parseDate(v) {
  const m = /(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/.exec(String(v ?? ''));
  if (!m) return null;
  let [, d, mo, y] = m; d = Number(d); mo = Number(mo); y = Number(y);
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 2000 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Partita IVA italiana: 11 cifre con cifra di controllo (algoritmo di Luhn dell'Agenzia delle Entrate). */
export function vatValid(v) {
  const s = String(v ?? '').replace(/^IT/i, '').replace(/\s/g, '');
  if (!/^\d{11}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) { let d = Number(s[i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return (10 - (sum % 10)) % 10 === Number(s[10]);
}

// ---------- 1. Righe e celle ----------
/** Testo -> righe con celle. Le colonne sono separate da tabulazioni o da 2+ spazi (come le restituisce pdftext.js). */
export function toRows(text) {
  return String(text || '').replace(/\r/g, '').replace(/\f/g, '\n').split('\n').map((raw, i) => {
    const line = raw.replace(/ /g, ' ').trimEnd();
    return { i, raw: line.trim(), cells: line.split(/\t| {2,}/).map((c) => c.trim()).filter(Boolean) };
  }).filter((r) => r.raw);
}

// ---------- Dizionario delle colonne (si amplia qui) ----------
export const ROLE_WORDS = {
  code: [/^cod(ice)?\.?(\s*(art(icolo)?|prod(otto)?|forn(itore)?))?\.?$/, /^art(icolo)?\.?$/, /^c\.?\s?art\.?$/, /^sku$/, /^rif(erimento)?\.?$/, /^part\s*n(umber)?\.?$/, /^p\/n$/],
  description: [/^descrizione( (articolo|merce|prodotto))?$/, /^desc\.?$/, /^denominazione$/, /^prodotto$/, /^merce$/, /^articolo\s*\/\s*descrizione$/, /^dettaglio$/, /^natura e qualit[a]? dei beni$/],
  qty: [/^q\.?\s?t[a]?\.?$/, /^qta$/, /^quantita$/, /^q\.?ta$/, /^qt$/, /^pezzi$/, /^n\.?\s?pezzi$/, /^colli$/, /^pz\.?$/],
  unit: [/^u\.?\s?m\.?$/, /^unita( di misura)?$/, /^um$/],
  unit_price: [/^prezzo( unit(ario|\.)?)?$/, /^p\.?\s?unit\.?$/, /^prezzo netto$/, /^listino$/, /^unitario$/, /^pr\.?\s?unit\.?$/],
  discount: [/^sc(onto)?\.?\s?%?$/, /^sconti?$/, /^%\s?sc(onto)?\.?$/],
  vat: [/^iva$/, /^%\s?iva$/, /^aliq(uota)?\.?( iva)?$/, /^c\.?\s?iva$/],
  total: [/^importo$/, /^totale( riga)?$/, /^valore$/, /^netto$/, /^imp\.?$/, /^importo netto$/],
};
const roleOfWord = (w) => { const n = norm(w); if (!n) return null; for (const [role, res] of Object.entries(ROLE_WORDS)) if (res.some((re) => re.test(n))) return role; return null; };

const FOOTER = /^(totale\b|imponibile\b|importo totale|totale merce|trasporto a (cura|mezzo)|causale|aspetto (esteriore )?dei beni|porto\b|vettore|n\.?\s?colli|peso (lordo|netto)|firma|data (e ora )?(del )?ritiro|annotazioni|note\b|riepilogo iva|scadenz|modalit[a] di pagamento|segue|pag(ina)?\.?\s*\d)/i;
const HEAD_NOISE = /^(documento di trasporto|d\.?d\.?t\.?|fattura|nota di|bolla|spett|destinatari|cliente|luogo di (destinazione|consegna)|pagina|pag\.|tel|fax|e-?mail|www\.|p\.?\s?iva|c\.?f\.?|cod(ice)? fiscale|iscr|reg(istro)? imprese|rea\b|cap\. soc|sede)/i;
const LEGAL_FORM = /\b(s\.?\s?r\.?\s?l\.?\s?s?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?|ditta|societ[a]|group|italia|distribuzione|elettronica|computer|telefonia|ricambi|forniture|trading|srl|spa|snc|sas)\b/i;

// ---------- 2. Fornitore ----------
const RECIPIENT = /(destinatari|spett\.?le|spettabile|cliente\b|intestatari|consegna a|luogo di destinazione|committente)/i;
export function findSupplier(rows) {
  const recIdx = rows.findIndex((r) => RECIPIENT.test(r.raw));
  const limit = recIdx > 0 ? recIdx : Math.min(rows.length, 18);
  const head = rows.slice(0, limit);
  const text = head.map((r) => r.raw).join('\n');
  // P.IVA: prima quelle con etichetta, poi qualunque numero di 11 cifre valido nella testata
  let vat = null;
  for (const m of text.matchAll(/(?:p\.?\s?i\.?v\.?a\.?|partita\s+iva|\bp\.?\s?i\.?\b|vat(?:\s+n[o°.])?)[^0-9A-Za-z]{0,12}((?:IT)?\s?\d{11})\b/gi)) { if (vatValid(m[1])) { vat = m[1].replace(/\D/g, ''); break; } }
  if (!vat) for (const m of text.matchAll(/\b(\d{11})\b/g)) { if (vatValid(m[1])) { vat = m[1]; break; } }
  let name = null;
  const cand = head.map((r) => r.cells[0] || r.raw).filter((c) => c.length >= 3 && !HEAD_NOISE.test(c) && !/^\d+$/.test(c) && !/^(via|viale|piazza|corso|strada|loc)\b/i.test(c));
  name = cand.find((c) => LEGAL_FORM.test(c)) || cand[0] || null;
  if (name) name = name.replace(/\s+(p\.?\s?iva|tel|cod\.).*$/i, '').trim().slice(0, 120);
  const addrRow = head.find((r) => /\b(via|viale|piazza|corso|strada|loc\.?|localit[a])\b.*\d/i.test(r.raw));
  const capRow = head.find((r) => /\b\d{5}\b\s+[A-Za-z]/.test(r.raw));
  const address = [addrRow && addrRow.raw.replace(/\s+(p\.?\s?iva|tel).*$/i, ''), capRow && capRow !== addrRow ? capRow.raw.replace(/\s+(p\.?\s?iva|tel).*$/i, '') : null].filter(Boolean).join(', ') || null;
  const phone = /(?:tel(?:efono)?\.?|phone)[:\s]*([+\d][\d\s/.-]{6,18}\d)/i.exec(text)?.[1]?.trim() || null;
  const email = /([\w.+-]+@[\w-]+\.[\w.-]+)/.exec(text)?.[1] || null;
  return { name, vat, country: 'IT', fiscal_code: null, address, phone, email };
}
/** Chiave per ritrovare il formato imparato: partita IVA, altrimenti il nome normalizzato. */
export const supplierKey = (s) => (s?.vat && vatValid(s.vat) ? `vat:${String(s.vat).replace(/\D/g, '')}` : s?.name ? `name:${norm(s.name)}` : null);

// ---------- 3. Documento ----------
export function findDoc(rows, learned) {
  const head = rows.slice(0, 40);
  const all = head.map((r) => r.raw).join('\n');
  let type = 'DDT';
  if (/nota\s+(di\s+)?(credito|accredito)/i.test(all)) type = 'TD04';
  else if (/\bfattura\b/i.test(all) && !/(documento di trasporto|\bd\.?d\.?t\.?\b|bolla)/i.test(all)) type = 'TD01';
  else if (/\bfattura\b/i.test(all) && /(accompagnatoria|differita)/i.test(all)) type = 'TD01';
  let number = null; let date = null; let label = null;
  // a) etichetta e valore sulla stessa riga: "D.D.T. n. 123/A del 12/10/2026", "Fattura N. FT-2026-88  Data 12/10/2026"
  const inline = /(d\.?\s?d\.?\s?t\.?|documento di trasporto|bolla(?: di consegna)?|fattura(?: accompagnatoria| differita| commerciale)?|nota (?:di )?(?:credito|accredito)|numero documento|n\.?\s?doc(?:umento)?\.?)\s*(?:n[°º.]|n\.?ro|numero|nr\.?|num\.?)?\s*[:.]?\s*([A-Z]{0,6}[-/.]?\d[\w/.\-]{0,14})/i;
  for (const r of head) {
    const m = inline.exec(r.raw);
    if (m && !/^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/.test(m[2])) { number = m[2].replace(/[.,;]$/, ''); label = m[1]; date = parseDate(r.raw.slice(r.raw.indexOf(m[2]) + m[2].length)); break; }
  }
  // b) griglia "Numero | Data" con i valori nella riga sotto, nelle stesse colonne
  if (!number) {
    for (let i = 0; i < head.length - 1; i += 1) {
      const lab = head[i].cells; const val = head[i + 1].cells;
      const ni = lab.findIndex((c) => /^(n\.?|numero|nr\.?|n°|n\.? doc(umento)?\.?|num(ero)? (doc(umento)?|ddt|fattura))$/i.test(norm(c).replace(/ /g, ' ')) || /^(numero|n\.?°?|nr\.?)( ?(ddt|doc\w*|fattura|bolla))?$/i.test(c));
      const di = lab.findIndex((c) => /^data( (doc\w*|ddt|fattura|bolla|emissione))?$/i.test(c));
      if (ni > -1 && val.length >= lab.length && /\d/.test(val[ni])) { number = val[ni]; label = lab[ni]; if (di > -1) date = parseDate(val[di]); break; }
    }
  }
  if (!date) { // prima data valida dopo la parola "data"/"del", altrimenti la prima data della testata
    const m = /(?:\bdel\b|\bdata\b|in data)\s*[:.]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})/i.exec(all);
    date = (m && parseDate(m[1])) || parseDate(all);
  }
  return { type, number, date, label };
}

// ---------- 4. Tabella articoli ----------
function headerOf(row) {
  const roles = {};
  const cells = row.cells;
  cells.forEach((c, i) => { const r = roleOfWord(c); if (r && !(r in roles)) roles[r] = i; });
  let mode = 'cells';
  if (Object.keys(roles).length < 2) { // intestazione scritta con spazi singoli: si prova parola per parola
    const toks = row.raw.split(/\s+/);
    const r2s = {}; toks.forEach((t, i) => { const r = roleOfWord(t); if (r && !(r in r2s)) r2s[r] = i; });
    if (Object.keys(r2s).length >= 3) { Object.keys(roles).forEach((k) => delete roles[k]); Object.assign(roles, r2s); mode = 'tokens'; }
  }
  const n = Object.keys(roles).length;
  const ok = n >= 2 && ('description' in roles || ('code' in roles && 'qty' in roles));
  return ok ? { roles, mode, ncells: mode === 'cells' ? cells.length : row.raw.split(/\s+/).length } : null;
}

const UNIT = /^(pz|pcs|nr|n|cf|conf|kg|mt|m|lt|l|set|kit|ct|cad|pezzi|colli)\.?$/i;
const looksCode = (c) => /^[A-Za-z0-9][A-Za-z0-9._\-/]{2,24}$/.test(c) && /\d/.test(c) && !/^\d+[.,]\d{1,3}$/.test(c) && !isNumCell(c);

/** Euristiche sui numeri: qty, prezzo, importo (con controllo qty x prezzo = importo). */
function pickNumbers(nums) {
  // nums = [{i, v}] nell'ordine della riga
  const out = { qty: null, unit_price: null, total: null, vat: null, discount: null, sure: false };
  const rest = nums.slice();
  const take = (o) => { const k = rest.indexOf(o); if (k > -1) rest.splice(k, 1); return o; };
  const close = (x, y) => Math.abs(x - y) <= 0.02 + 0.005 * y;
  // 1) tre numeri in ordine con qtà x prezzo = importo
  search: for (let a = 0; a < nums.length; a += 1) for (let b = a + 1; b < nums.length; b += 1) for (let c = b + 1; c < nums.length; c += 1) {
    if (nums[a].v > 0 && nums[b].v > 0 && close(nums[a].v * nums[b].v, nums[c].v)) { out.qty = take(nums[a]); out.unit_price = take(nums[b]); out.total = take(nums[c]); out.sure = true; break search; }
  }
  // 2) con uno sconto in percentuale (1..100) fra il prezzo e l'importo
  if (!out.sure) {
    search2: for (let a = 0; a < nums.length; a += 1) for (let b = a + 1; b < nums.length; b += 1) for (let s = b + 1; s < nums.length; s += 1) for (let c = s + 1; c < nums.length; c += 1) {
      const sc = nums[s].v;
      if (nums[a].v > 0 && nums[b].v > 0 && sc > 0 && sc <= 100 && close(nums[a].v * nums[b].v * (1 - sc / 100), nums[c].v)) { out.qty = take(nums[a]); out.unit_price = take(nums[b]); out.discount = take(nums[s]); out.total = take(nums[c]); out.sure = true; break search2; }
    }
  }
  if (!out.sure) {
    const v = rest.map((x) => x);
    if (v.length >= 2) { out.qty = take(v[0]); out.unit_price = take(v[1]); if (v[2]) out.total = take(v[2]); }
    else if (v.length === 1) out.qty = take(v[0]);
  }
  const vatLike = rest.find((x) => [4, 5, 10, 22].includes(x.v));
  if (vatLike) out.vat = take(vatLike);
  return out;
}

function lineFromCells(cells, roles) {
  // `roles` = { role: indice cella } (da intestazione o formato imparato)
  const g = (r) => (r in roles && cells[roles[r]] !== undefined ? cells[roles[r]] : null);
  return { code: g('code'), description: g('description'), qty: parseNum(g('qty')), unit: g('unit'), unit_price: parseNum(g('unit_price')), total: parseNum(g('total')), vat: parseNum(g('vat')), discount: parseNum(g('discount')) };
}

function lineHeuristic(cells) {
  const nums = []; const texts = [];
  cells.forEach((c, i) => { if (UNIT.test(c)) texts.push({ i, c, unit: true }); else if (isNumCell(c)) nums.push({ i, v: parseNum(c), c }); else texts.push({ i, c }); });
  const unitCell = texts.find((t) => t.unit);
  const words = texts.filter((t) => !t.unit);
  let code = null; let description = null;
  const codeCell = words.find((t) => looksCode(t.c)) || null;
  const desc = words.filter((t) => t !== codeCell).sort((a, b) => b.c.length - a.c.length)[0] || null;
  if (codeCell && desc) { code = codeCell.c; description = desc.c; }
  else if (desc) { // una sola cella di testo: "CODICE descrizione ..." con il codice come prima parola
    const m = /^(\S+)\s+(.{3,})$/.exec(desc.c);
    if (m && looksCode(m[1]) && /[A-Z-]/.test(m[1])) { code = m[1]; description = m[2]; } else description = desc.c;
  } else if (codeCell) description = codeCell.c;
  const n = pickNumbers(nums);
  if (!code) { // codice fatto di sole cifre: la prima cella numerica lunga che non e' stata presa come quantita'/prezzo
    const used = new Set([n.qty, n.unit_price, n.total, n.discount, n.vat].filter(Boolean));
    const num = nums.find((x) => !used.has(x) && /^\d{5,}$/.test(x.c));
    if (num) code = num.c;
  }
  return { code, description, qty: n.qty?.v ?? null, unit: unitCell?.c ?? null, unit_price: n.unit_price?.v ?? null, total: n.total?.v ?? null, vat: n.vat?.v ?? null, discount: n.discount?.v ?? null, sure: n.sure, numCount: nums.length };
}

/** Riga a spazi singoli (nessuna colonna): numeri presi da destra, codice = prima parola con cifre. */
function lineFromTokens(raw) {
  const toks = raw.split(/\s+/);
  const tail = []; let k = toks.length;
  while (k > 0 && (isNumCell(toks[k - 1]) || UNIT.test(toks[k - 1])) && tail.length < 6) { tail.unshift(toks[k - 1]); k -= 1; }
  if (!tail.some((t) => isNumCell(t))) return null;
  // i numeri finali possono includere un pezzo della descrizione ("iPhone 13"): si prova a spostarli nella descrizione finche' le colonne tornano
  let best = null;
  for (let drop = 0; drop < tail.length; drop += 1) {
    if (drop > 0 && !isNumCell(tail[drop - 1])) break;
    const head = [...toks.slice(0, k), ...tail.slice(0, drop)];
    const rest = tail.slice(drop);
    if (!rest.some((t) => isNumCell(t))) break;
    const cells = [];
    if (head.length > 1 && looksCode(head[0])) cells.push(head[0], head.slice(1).join(' ')); else cells.push(head.join(' '));
    cells.push(...rest);
    const h = lineHeuristic(cells);
    if (!best || (h.sure && !best.sure)) best = { cells, ...h };
    if (h.sure && parseNum(rest.find(isNumCell)) === h.qty) { best = { cells, ...h }; break; } // la quantità è il primo numero: il resto era descrizione
  }
  return best;
}

/**
 * Legge la tabella. `fmt` = formato imparato del fornitore: { row_map: { "<n celle>": { code:i, description:i, ... } } }.
 * Ritorna { lines, header, footerAt, mode }.
 */
export function findLines(rows, fmt) {
  let hIdx = -1; let hdr = null;
  for (let i = 0; i < rows.length; i += 1) { const h = headerOf(rows[i]); if (h) { hIdx = i; hdr = h; break; } }
  const start = hIdx + 1;
  const lines = [];
  let footerAt = null;
  let last = null;
  let lastIdx = -5;
  // senza intestazione: si parte dalla prima riga che sembra un articolo (almeno un numero e un testo lungo)
  const begin = hIdx > -1 ? start : 0;
  for (let i = begin; i < rows.length; i += 1) {
    const r = rows[i];
    if (hIdx > -1 && FOOTER.test(r.raw)) { footerAt = i; break; }
    if (hIdx < 0 && FOOTER.test(r.raw) && lines.length) { footerAt = i; break; }
    if (headerOf(r)) continue; // intestazione ripetuta a ogni pagina
    if (HEAD_NOISE.test(r.raw) && !lines.length) continue; // testata (P.IVA, numero del DDT, destinatario...) prima delle righe
    const n = r.cells.length;
    let f = null; let source = null;
    const map = fmt?.row_map?.[String(n)];
    if (map && n > 1) { const x = lineFromCells(r.cells, map); if (x.description && x.qty != null) { f = x; source = 'learned'; } }
    if (!f && hdr && hdr.mode === 'cells' && n === hdr.ncells) { const x = lineFromCells(r.cells, hdr.roles); if (x.description && (x.qty != null || x.unit_price != null)) { f = x; source = 'header'; } }
    if (!f && n >= 2) { const x = lineHeuristic(r.cells); if (x.description && x.qty != null && x.numCount >= 1) { f = x; source = 'heuristic'; } }
    if (!f && n < 2) { const x = lineFromTokens(r.raw); if (x && x.description && x.qty != null) { f = x; source = 'heuristic'; } }
    if (f) {
      const issues = [];
      if (f.qty == null || f.qty <= 0) issues.push('quantità da controllare');
      if (f.unit_price == null && f.total != null && f.qty > 0) { f.unit_price = r4(f.total / f.qty); source = `${source}`; }
      if (f.unit_price == null) issues.push('prezzo mancante (DDT non valorizzato?)');
      if (f.unit_price != null && f.total != null && f.qty > 0 && Math.abs(f.qty * f.unit_price * (1 - (f.discount || 0) / 100) - f.total) > 0.02 + 0.01 * f.total) issues.push('qtà × prezzo non torna con l’importo');
      const conf = source === 'learned' ? 0.95 : source === 'header' ? 0.85 : (f.sure ? 0.7 : 0.45);
      last = { ...f, source, issues, confidence: issues.length ? Math.min(conf, 0.5) : conf, raw_cells: r.cells.slice(0, 14), raw_n: n, row: r.i };
      lines.push(last);
      lastIdx = i;
    } else if (last && i === lastIdx + 1 && !r.cells.some(isNumCell) && r.raw.length <= 90 && !HEAD_NOISE.test(r.raw)) {
      last.description = `${last.description} ${r.raw}`.replace(/\s+/g, ' ').slice(0, 300); // riga di continuazione della descrizione
      lastIdx = i;
    }
  }
  return { lines, header: hdr, headerRow: hIdx > -1 ? rows[hIdx] : null, footerAt };
}

// ---------- Il lettore completo ----------
/** Testo del documento -> struttura identica a quella delle fatture XML (supplier, doc, lines, warnings...) + indicazioni per l'anteprima. */
export function parseDdtText(text, { format = null } = {}) {
  const t = String(text || '');
  if (!t.trim()) throw new HttpError(400, 'Il PDF non contiene testo leggibile: probabilmente è una scansione (immagine).', { code: 'PDF_SENZA_TESTO', hint: 'Usa un PDF digitale, oppure inserisci le righe a mano.' });
  if (t.length > MAX_TEXT) throw new HttpError(400, 'Il documento è troppo lungo per essere letto in una volta.', { code: 'DOCUMENTO_TROPPO_LUNGO', hint: 'Importa solo le pagine che servono, oppure inserisci le righe a mano.' });
  const rows = toRows(t);
  const supplier = findSupplier(rows);
  const fmt = format || null;
  const doc0 = findDoc(rows, fmt);
  const tbl = findLines(rows, fmt);
  const warnings = [];
  if (!supplier.name) warnings.push('Non ho riconosciuto il fornitore: scrivilo nella casella qui sotto.');
  else if (!supplier.vat) warnings.push('Partita IVA del fornitore non trovata: controllala (aiuta a riconoscere il fornitore la volta dopo).');
  if (!doc0.number) warnings.push('Numero del documento non trovato: scrivilo a mano.');
  if (!doc0.date) warnings.push('Data del documento non trovata: scrivila a mano.');
  if (!tbl.lines.length) warnings.push('Non ho trovato righe di articoli: aggiungile a mano nella tabella qui sotto.');
  const lines = tbl.lines.map((l, k) => {
    const qty = l.qty != null && l.qty > 0 ? l.qty : 1;
    const unit_price = l.unit_price != null ? r4(l.unit_price) : 0;
    const line_total = l.total != null ? r2(l.total) : r2(qty * unit_price);
    return {
      n: k + 1, number: k + 1, description: String(l.description || '(senza descrizione)').replace(/\s+/g, ' ').trim().slice(0, 300), code: l.code || null, ean: null, qty, unit: l.unit || null,
      list_price: unit_price, unit_price, discount: l.discount || 0, discounts: [], vat_rate: l.vat ?? 22, nature: null, line_total,
      source: l.source, confidence: l.confidence, issues: l.issues, raw_cells: l.raw_cells, raw_n: l.raw_n,
    };
  });
  if (lines.some((l) => l.issues.length)) warnings.push(`${lines.filter((l) => l.issues.length).length} righe da controllare (evidenziate).`);
  if (lines.length && lines.every((l) => !(l.unit_price > 0))) warnings.push('Nel documento non ci sono prezzi (DDT non valorizzato): scrivi i prezzi di acquisto nella tabella o carica poi la fattura.');
  // totale: lo cerco nel testo ("Totale documento 152,50"), altrimenti lo calcolo dalle righe
  let total = null;
  for (const r of rows) { const m = /totale\s+(?:documento|fattura|generale|da pagare|merce)?[^\d-]{0,12}(-?\d[\d.,]*)\s*€?\s*$/i.exec(r.raw); if (m && parseNum(m[1]) != null) total = parseNum(m[1]); }
  const sumLines = r2(lines.reduce((a, l) => a + l.line_total, 0));
  if (total == null) total = r2(lines.reduce((a, l) => a + l.line_total * (1 + (l.vat_rate || 0) / 100), 0));
  else if (sumLines > 0 && Math.abs(sumLines - total) > 0.05 && Math.abs(r2(sumLines * 1.22) - total) > 0.05 + 0.01 * lines.length && Math.abs(r2(lines.reduce((a, l) => a + l.line_total * (1 + (l.vat_rate || 0) / 100), 0)) - total) > 0.05 + 0.01 * lines.length) warnings.push(`Le righe sommano ${sumLines.toFixed(2)} € ma il totale scritto è ${total.toFixed(2)} €: controlla le righe.`);
  const used = lines.filter((l) => l.source === 'learned').length;
  return {
    supplier,
    doc: { type: doc0.type, type_label: DOC_LABELS[doc0.type] || doc0.type, number: doc0.number, date: doc0.date, total: r2(total), currency: 'EUR', notes: null },
    lines, vat_summary: [], ddt: [], lines_total: sumLines, warnings,
    meta: { source: 'ddt_pdf', supplier_key: supplierKey(supplier), doc_label: doc0.label, header_roles: tbl.header?.roles || null, header_mode: tbl.header?.mode || null, learned: used > 0, learned_lines: used },
  };
}

// ---------- Anteprima corretta a mano -> struttura valida ----------
/** Prende il documento modificato dall'utente e lo rende valido e coerente (stessa forma dell'XML). */
export function normalizeParsed(p) {
  if (!p || typeof p !== 'object') throw new HttpError(400, 'Importazione non eseguita: i dati del documento non sono arrivati.', { code: 'DOCUMENTO_MANCANTE', hint: 'Rileggi il documento e riprova.' });
  const s = p.supplier || {};
  const name = String(s.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Documento non importato: manca il nome del fornitore.', { code: 'FORNITORE_MANCANTE', hint: 'Scrivi il fornitore come compare sul documento.' });
  const vat = String(s.vat ?? '').replace(/\D/g, '') || null;
  const d = p.doc || {};
  const number = String(d.number ?? '').trim().slice(0, 40);
  if (!number) throw new HttpError(400, 'Documento non importato: manca il numero del documento.', { code: 'NUMERO_DOCUMENTO_MANCANTE', hint: 'Scrivi il numero come compare sul documento.' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date ?? '')) ? d.date : parseDate(d.date);
  if (!date) throw new HttpError(400, 'Documento non importato: la data del documento non è valida.', { code: 'DATA_NON_VALIDA', hint: 'Usa il formato gg/mm/aaaa con una data che esiste.' });
  const type = ['DDT', 'TD01', 'TD04'].includes(d.type) ? d.type : 'DDT';
  const raw = Array.isArray(p.lines) ? p.lines : [];
  if (!raw.length) throw new HttpError(400, 'Documento non importato: serve almeno una riga e non ce ne sono.', { code: 'DOCUMENTO_SENZA_RIGHE', hint: 'Aggiungi almeno una riga con descrizione e quantità.' });
  if (raw.length > 500) throw new HttpError(400, 'Documento non importato: ha più di 500 righe.', { code: 'TROPPE_RIGHE', hint: 'Dividi il documento in più parti.' });
  const warnings = [];
  const lines = raw.map((l, k) => {
    const description = String(l.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!description) throw new HttpError(400, `Riga ${k + 1} del documento: manca la descrizione.`, { code: 'RIGA_DESCRIZIONE_MANCANTE', hint: 'Scrivi la descrizione dell’articolo.' });
    const qty = parseNum(l.qty) ?? NaN; const price = l.unit_price === '' || l.unit_price == null ? 0 : parseNum(l.unit_price) ?? NaN;
    if (!Number.isFinite(qty) || qty < 0) throw new HttpError(400, `Riga ${k + 1} del documento: la quantità non è valida (vuota, non numerica o negativa).`, { code: 'RIGA_QUANTITA_NON_VALIDA', hint: 'Correggi la quantità della riga.' });
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, `Riga ${k + 1} del documento: il prezzo non è valido (non numerico o negativo).`, { code: 'RIGA_PREZZO_NON_VALIDO', hint: 'Correggi il prezzo della riga.' });
    const vatRate = l.vat_rate === '' || l.vat_rate == null ? 22 : parseNum(l.vat_rate);
    if (vatRate == null || vatRate < 0 || vatRate > 100) throw new HttpError(400, `Riga ${k + 1} del documento: l’aliquota IVA non è valida (deve essere tra 0 e 100).`, { code: 'RIGA_IVA_NON_VALIDA', hint: 'Correggi l’aliquota IVA della riga (es. 22).' });
    return {
      n: k + 1, number: k + 1, description, code: String(l.code ?? '').trim().slice(0, 60) || null, ean: null, qty, unit: String(l.unit ?? '').trim().slice(0, 10) || null,
      list_price: r4(price), unit_price: r4(price), discount: 0, discounts: [], vat_rate: vatRate, nature: null, line_total: r2(qty * price),
      raw_cells: Array.isArray(l.raw_cells) ? l.raw_cells.slice(0, 14).map(String) : null, raw_n: Number(l.raw_n) || null,
    };
  });
  const sumLines = r2(lines.reduce((a, l) => a + l.line_total, 0));
  let total = d.total === '' || d.total == null ? null : parseNum(d.total);
  if (total == null) total = r2(lines.reduce((a, l) => a + l.line_total * (1 + l.vat_rate / 100), 0));
  if (lines.every((l) => !(l.unit_price > 0))) warnings.push('Nessuna riga ha un prezzo: nel magazzino non entra nulla finché non scrivi i prezzi di acquisto.');
  return {
    supplier: { name: name.slice(0, 120), vat, country: 'IT', fiscal_code: null, address: String(s.address ?? '').trim().slice(0, 200) || null, phone: String(s.phone ?? '').trim().slice(0, 40) || null, email: String(s.email ?? '').trim().slice(0, 120) || null },
    doc: { type, type_label: DOC_LABELS[type], number, date, total: r2(total), currency: 'EUR', notes: String(d.notes ?? '').trim().slice(0, 300) || null },
    lines, vat_summary: [], ddt: [], lines_total: sumLines, warnings, meta: p.meta && typeof p.meta === 'object' ? p.meta : { source: 'ddt_pdf' },
  };
}

// ---------- Apprendimento dei formati per fornitore ----------
export const FORMAT_TABLES = ['supplier_formats'];

export async function loadFormat(key) {
  if (!key) return null;
  const row = await db.prepare('SELECT * FROM supplier_formats WHERE supplier_key = ?').get(key);
  if (!row) return null;
  try { return { ...JSON.parse(row.pattern), id: row.id, uses: row.uses }; } catch { return null; }
}

/** Confronta ogni riga confermata con le celle originali e ricava quale colonna contiene cosa. */
export function deriveFormat(parsed) {
  const votes = {}; // n celle -> ruolo -> indice -> voti
  const eq = {
    code: (c, l) => l.code && norm(c) === norm(l.code),
    description: (c, l) => norm(c) && (norm(c) === norm(l.description) || (norm(l.description).startsWith(norm(c)) && norm(c).length >= 6)),
    qty: (c, l) => parseNum(c) != null && Math.abs(parseNum(c) - l.qty) < 1e-9,
    unit: (c, l) => l.unit && norm(c) === norm(l.unit),
    unit_price: (c, l) => l.unit_price > 0 && parseNum(c) != null && Math.abs(parseNum(c) - l.unit_price) < 0.0051,
    total: (c, l) => l.line_total > 0 && parseNum(c) != null && Math.abs(parseNum(c) - l.line_total) < 0.0051,
    vat: (c, l) => parseNum(c) != null && Math.abs(parseNum(c) - l.vat_rate) < 1e-9 && [4, 5, 10, 22].includes(parseNum(c)),
  };
  for (const l of parsed.lines || []) {
    if (!l.raw_cells || !l.raw_n || l.raw_n < 2) continue;
    const used = new Set();
    const v = (votes[l.raw_n] ||= {});
    for (const role of ['description', 'code', 'qty', 'unit_price', 'total', 'unit', 'vat']) {
      const idx = l.raw_cells.findIndex((c, i) => !used.has(i) && eq[role](c, l));
      if (idx > -1) { used.add(idx); ((v[role] ||= {})[idx] ||= 0); v[role][idx] += 1; }
    }
  }
  const row_map = {};
  for (const [n, roles] of Object.entries(votes)) {
    const map = {};
    for (const [role, idxs] of Object.entries(roles)) map[role] = Number(Object.entries(idxs).sort((a, b) => b[1] - a[1])[0][0]);
    if ('description' in map && 'qty' in map) row_map[n] = map;
  }
  return { v: 1, row_map, doc_label: parsed.meta?.doc_label || null, header_roles: parsed.meta?.header_roles || null };
}

/** Salva (o aggiorna) il formato del fornitore dopo una conferma. Ritorna true se ha imparato qualcosa. */
export async function learnFormat(parsed, supplierId) {
  const key = supplierKey(parsed.supplier);
  if (!key) return false;
  const pat = deriveFormat(parsed);
  if (!Object.keys(pat.row_map).length) return false;
  const old = await loadFormat(key);
  if (old?.row_map) pat.row_map = { ...old.row_map, ...pat.row_map };
  const json = JSON.stringify(pat);
  const r = await db.prepare("UPDATE supplier_formats SET pattern = ?, supplier_id = COALESCE(?, supplier_id), uses = uses + 1, updated_at = datetime('now','localtime') WHERE supplier_key = ?").run(json, supplierId || null, key);
  if (!r.changes) await db.prepare("INSERT INTO supplier_formats (supplier_key, supplier_id, label, pattern, uses, created_at, updated_at) VALUES (?,?,?,?,1,datetime('now','localtime'),datetime('now','localtime'))").run(key, supplierId || null, parsed.supplier.name, json);
  return true;
}

export async function listFormats() {
  return (await db.prepare('SELECT f.id, f.supplier_key, f.supplier_id, f.label, f.uses, f.updated_at, f.pattern FROM supplier_formats f ORDER BY f.updated_at DESC').all())
    .map((f) => { let sizes = []; try { sizes = Object.keys(JSON.parse(f.pattern).row_map || {}); } catch { /* formato rovinato */ } return { id: f.id, supplier_key: f.supplier_key, supplier_id: f.supplier_id, label: f.label, uses: f.uses, updated_at: f.updated_at, layouts: sizes.length }; });
}
export async function deleteFormat(id) {
  const r = await db.prepare('DELETE FROM supplier_formats WHERE id = ?').run(id);
  if (!r.changes) throw new HttpError(404, 'Il formato fornitore indicato non esiste più.', { code: 'FORMATO_NON_TROVATO', hint: 'Aggiorna l’elenco dei formati: potrebbe essere già stato eliminato.' });
  return { ok: true };
}

/**
 * Punto d'ingresso per purchases.mjs: `body.parsed` (anteprima corretta a mano) oppure `body.pdf_text` (testo estratto dal PDF).
 * Ritorna null se la richiesta non e' un documento PDF/DDT.
 */
export async function resolveDdtBody(body) {
  if (body?.parsed) return { source: 'ddt_pdf', parsed: normalizeParsed(body.parsed) };
  if (typeof body?.pdf_text === 'string') {
    // il fornitore si conosce solo dopo il primo passaggio: lo si legge, poi si rilegge col formato imparato (se c'e')
    const first = parseDdtText(body.pdf_text);
    const format = await loadFormat(first.meta.supplier_key);
    return { source: 'ddt_pdf', parsed: format ? parseDdtText(body.pdf_text, { format }) : first };
  }
  return null;
}
