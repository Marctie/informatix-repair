// Lettura della FATTURA ELETTRONICA italiana (FatturaPA, formato FPR12) in XML in chiaro.
// Nessuna dipendenza: piccolo parser XML tollerante a namespace e prefissi (ds:, p:, ns3: ...), valido anche nei Cloudflare Workers
// (niente DOMParser). Non espande entità definite nel file (solo le 5 predefinite e quelle numeriche): nessun rischio "billion laughs".
// Il file firmato .p7m NON è supportato: va usato il file .xml (o il PDF/XML "di cortesia" dello SdI).

export class FatturaError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => (s.includes('&') ? s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    try { return String.fromCodePoint(cp); } catch { return ''; }
  }
  return ENT[e.toLowerCase()] ?? m;
}) : s);
const local = (n) => n.slice(n.indexOf(':') + 1);

/** Trasforma il testo XML in un albero { name, attrs, children, text }. I prefissi dei nomi vengono tolti. */
export function parseXml(src) {
  let s = String(src);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const bad = (m) => new FatturaError(`XML non valido: ${m}`);
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const n = s.length;
  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    const cur = stack[stack.length - 1];
    if (lt < 0) { cur.text += decode(s.slice(i)); break; }
    if (lt > i) cur.text += decode(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) {
      const e = s.indexOf('-->', lt + 4);
      if (e < 0) throw bad('commento non chiuso');
      i = e + 3;
    } else if (s.startsWith('<![CDATA[', lt)) {
      const e = s.indexOf(']]>', lt + 9);
      if (e < 0) throw bad('CDATA non chiuso');
      cur.text += s.slice(lt + 9, e);
      i = e + 3;
    } else if (s.startsWith('<?', lt)) {
      const e = s.indexOf('?>', lt + 2);
      if (e < 0) throw bad('istruzione non chiusa');
      i = e + 2;
    } else if (s.startsWith('<!', lt)) { // DOCTYPE: si salta, anche con sottoinsieme interno [ ... ]
      let j = lt + 2;
      let depth = 0;
      for (; j < n; j++) { const ch = s[j]; if (ch === '[') depth++; else if (ch === ']') depth--; else if (ch === '>' && depth <= 0) break; }
      i = j + 1;
    } else if (s[lt + 1] === '/') {
      const e = s.indexOf('>', lt);
      if (e < 0) throw bad('tag di chiusura incompleto');
      const name = local(s.slice(lt + 2, e).trim());
      if (stack.length < 2 || stack[stack.length - 1].name !== name) throw bad(`tag </${name}> non corrisponde`);
      stack.pop();
      i = e + 1;
    } else {
      // tag di apertura: cerca ">" fuori dalle virgolette
      let j = lt + 1;
      let q = '';
      for (; j < n; j++) { const ch = s[j]; if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '>') break; }
      if (j >= n) throw bad('tag non terminato');
      let inner = s.slice(lt + 1, j);
      const selfClose = inner.endsWith('/');
      if (selfClose) inner = inner.slice(0, -1);
      const m = inner.match(/^\s*([^\s/>]+)/);
      if (!m) throw bad('tag senza nome');
      const attrs = {};
      for (const a of inner.slice(m[0].length).matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[local(a[1])] = decode(a[3] ?? a[4] ?? '');
      const node = { name: local(m[1]), attrs, children: [], text: '' };
      cur.children.push(node);
      if (!selfClose) {
        if (stack.length > 200) throw bad('annidamento eccessivo');
        stack.push(node);
      }
      i = j + 1;
    }
  }
  if (stack.length !== 1) throw bad('tag non chiuso');
  if (!root.children.length) throw bad('nessun elemento');
  return root.children[0];
}

// ---------- piccoli helper per navigare l'albero ----------
const kids = (node, name) => (node ? node.children.filter((c) => c.name === name) : []);
/** Primo nodo lungo un percorso "A/B/C" (nome locale, senza prefissi). */
const find = (node, path) => {
  let cur = node;
  for (const p of path.split('/')) { cur = cur?.children.find((c) => c.name === p); if (!cur) return null; }
  return cur;
};
const txt = (node, path) => { const f = path ? find(node, path) : node; const t = f ? f.text.trim() : ''; return t || null; };
const num = (v) => { if (v == null) return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

/** Riconosce un file firmato (.p7m, binario CAdES) o che non è XML. */
export function looksLikeP7m(text, filename = '') {
  if (/\.p7m$/i.test(String(filename).trim())) return true;
  const head = String(text || '').slice(0, 400);
  if (/-----BEGIN (PKCS7|CMS)/.test(head)) return true;
  // il file firmato in binario contiene byte di controllo e non inizia con "<"
  return /[\u0000-\u0008\u000e-\u001f]/.test(head.replace(/^﻿/, '').slice(0, 64)) && !/^\s*</.test(head);
}
export const P7M_MESSAGE = 'Questo è un file firmato (.p7m): non posso leggerlo. Chiedi al fornitore o al commercialista il file XML “normale” (senza firma), oppure scaricalo dal cassetto fiscale dell’Agenzia delle Entrate.';

export const DOC_TYPES = {
  TD01: 'Fattura', TD02: 'Acconto/anticipo su fattura', TD03: 'Acconto/anticipo su parcella', TD04: 'Nota di credito', TD05: 'Nota di debito',
  TD06: 'Parcella', TD16: 'Integrazione fattura (reverse charge)', TD17: 'Integrazione servizi dall’estero', TD18: 'Integrazione beni intra-UE',
  TD19: 'Integrazione beni (art. 17)', TD20: 'Autofattura', TD24: 'Fattura differita', TD25: 'Fattura differita (triangolare)', TD26: 'Cessione beni ammortizzabili', TD27: 'Autofattura per consumo proprio',
};

/**
 * Legge una fattura elettronica XML. Restituisce:
 *  { supplier:{name,vat,country,fiscal_code,address,phone,email}, doc:{type,type_label,number,date,total,currency,notes},
 *    lines:[{n,description,code,ean,qty,unit,list_price,unit_price,discount,vat_rate,nature,line_total}],
 *    vat_summary:[{rate,taxable,tax}], ddt:[{number,date}], warnings:[] }
 * unit_price = prezzo unitario NETTO (dopo sconti, = PrezzoTotale / quantità): è quello da confrontare tra un ordine e l'altro.
 */
export function parseFattura(xml, filename = '') {
  if (looksLikeP7m(xml, filename)) throw new FatturaError(P7M_MESSAGE);
  const text = String(xml || '');
  if (!/^\s*(﻿)?\s*</.test(text)) throw new FatturaError('Il file non è un XML: servono le fatture elettroniche in formato .xml.');
  const root = parseXml(text);
  if (root.name !== 'FatturaElettronica') throw new FatturaError('Questo XML non è una fattura elettronica (manca l’elemento FatturaElettronica).');
  const header = find(root, 'FatturaElettronicaHeader');
  const bodies = kids(root, 'FatturaElettronicaBody');
  if (!header || !bodies.length) throw new FatturaError('Fattura elettronica incompleta: mancano intestazione o corpo.');
  const warnings = [];
  if (bodies.length > 1) warnings.push(`Il file contiene ${bodies.length} fatture (lotto): importo solo la prima. Importa le altre separatamente.`);
  const body = bodies[0];

  // ---- Fornitore (CedentePrestatore)
  const ced = find(header, 'CedentePrestatore');
  if (!ced) throw new FatturaError('Fattura senza fornitore (CedentePrestatore).');
  const an = find(ced, 'DatiAnagrafici');
  const name = txt(an, 'Anagrafica/Denominazione') || [txt(an, 'Anagrafica/Nome'), txt(an, 'Anagrafica/Cognome')].filter(Boolean).join(' ') || null;
  if (!name) throw new FatturaError('Fattura senza nome del fornitore.');
  const sede = find(ced, 'Sede');
  const street = [txt(sede, 'Indirizzo'), txt(sede, 'NumeroCivico')].filter(Boolean).join(' ');
  const town = [txt(sede, 'CAP'), txt(sede, 'Comune'), txt(sede, 'Provincia') ? `(${txt(sede, 'Provincia')})` : null].filter(Boolean).join(' ');
  const supplier = {
    name,
    vat: txt(an, 'IdFiscaleIVA/IdCodice'),
    country: txt(an, 'IdFiscaleIVA/IdPaese') || 'IT',
    fiscal_code: txt(an, 'CodiceFiscale'),
    address: [street, town].filter(Boolean).join(', ') || null,
    phone: txt(ced, 'Contatti/Telefono'),
    email: txt(ced, 'Contatti/Email'),
  };

  // ---- Documento
  const dg = find(body, 'DatiGenerali/DatiGeneraliDocumento');
  if (!dg) throw new FatturaError('Fattura senza dati generali del documento.');
  const type = txt(dg, 'TipoDocumento') || 'TD01';
  const date = txt(dg, 'Data');
  const number = txt(dg, 'Numero');
  if (!number || !date || !/^\d{4}-\d{2}-\d{2}/.test(date)) throw new FatturaError('Fattura senza numero o data valida.');
  const summary = kids(find(body, 'DatiBeniServizi'), 'DatiRiepilogo').map((r) => ({
    rate: num(txt(r, 'AliquotaIVA')) ?? 0, taxable: num(txt(r, 'ImponibileImporto')) ?? 0, tax: num(txt(r, 'Imposta')) ?? 0, nature: txt(r, 'Natura'),
  }));
  let total = num(txt(dg, 'ImportoTotaleDocumento'));
  if (total == null) { total = r2(summary.reduce((a, r) => a + r.taxable + r.tax, 0)); warnings.push('Il totale del documento non è indicato: l’ho calcolato da imponibile e IVA.'); }
  const doc = {
    type, type_label: DOC_TYPES[type] || type, number, date: date.slice(0, 10), total: r2(total),
    currency: txt(dg, 'Divisa') || 'EUR', notes: kids(dg, 'Causale').map((c) => c.text.trim()).filter(Boolean).join(' ') || null,
  };
  if (doc.currency !== 'EUR') warnings.push(`Valuta ${doc.currency}: i prezzi non sono in euro.`);

  // ---- Righe
  const lines = [];
  let idx = 0;
  for (const d of kids(find(body, 'DatiBeniServizi'), 'DettaglioLinee')) {
    idx += 1;
    const codes = kids(d, 'CodiceArticolo').map((c) => ({ type: (txt(c, 'CodiceTipo') || '').toUpperCase(), value: txt(c, 'CodiceValore') })).filter((c) => c.value);
    const ean = codes.find((c) => /^(EAN|GTIN|BARCODE)/.test(c.type))?.value || null;
    const code = codes.find((c) => c.value !== ean)?.value || ean || null;
    const qty = num(txt(d, 'Quantita'));
    const list = num(txt(d, 'PrezzoUnitario')) ?? 0;
    const lineTotal = num(txt(d, 'PrezzoTotale')) ?? (qty != null ? r2(list * qty) : list);
    const q = qty == null ? 1 : qty;
    // prezzo netto: per quantità positive è il totale riga diviso la quantità (comprende sconti e maggiorazioni di riga)
    const net = q > 0 ? r4(lineTotal / q) : r4(list);
    const scm = kids(d, 'ScontoMaggiorazione').map((s) => ({ type: txt(s, 'Tipo'), pct: num(txt(s, 'Percentuale')), amount: num(txt(s, 'Importo')) }));
    const discount = list > 0 && Math.abs(net - list) > 0.00005 ? Math.round((1 - net / list) * 10000) / 100 : 0; // % effettiva (negativa = maggiorazione)
    const vatRate = num(txt(d, 'AliquotaIVA')) ?? 0;
    const desc = txt(d, 'Descrizione') || '(senza descrizione)';
    if (scm.length && !discount && list > 0) warnings.push(`Riga ${idx}: sconto indicato ma il totale riga non lo riflette.`);
    lines.push({
      n: idx, number: num(txt(d, 'NumeroLinea')) ?? idx, description: desc.replace(/\s+/g, ' ').trim(), code, ean, qty: q, unit: txt(d, 'UnitaMisura'),
      list_price: r4(list), unit_price: net, discount, discounts: scm, vat_rate: vatRate, nature: txt(d, 'Natura'), line_total: r2(lineTotal),
    });
  }
  if (!lines.length) throw new FatturaError('La fattura non contiene righe (DettaglioLinee).');

  // ---- Controlli di coerenza
  const sumLines = r2(lines.reduce((a, l) => a + l.line_total, 0));
  const sumTaxable = r2(summary.reduce((a, r) => a + r.taxable, 0));
  const sumTax = r2(summary.reduce((a, r) => a + r.tax, 0));
  const scDoc = kids(dg, 'ScontoMaggiorazione').length;
  if (summary.length && Math.abs(sumLines - sumTaxable) > 0.05 + 0.01 * lines.length && !scDoc) warnings.push(`Importi incoerenti: le righe sommano ${sumLines.toFixed(2)} € ma l’imponibile dichiarato è ${sumTaxable.toFixed(2)} €.`);
  if (summary.length && Math.abs(sumTaxable + sumTax - doc.total) > 0.05 + 0.01 * lines.length && !scDoc) warnings.push(`Importi incoerenti: imponibile + IVA fanno ${(sumTaxable + sumTax).toFixed(2)} € ma il totale del documento è ${doc.total.toFixed(2)} €.`);

  const ddt = kids(find(body, 'DatiGenerali'), 'DatiDDT').map((x) => ({ number: txt(x, 'NumeroDDT'), date: txt(x, 'DataDDT') })).filter((x) => x.number);
  return { supplier, doc, lines, vat_summary: summary.map((r) => ({ rate: r.rate, taxable: r2(r.taxable), tax: r2(r.tax) })), ddt, lines_total: sumLines, warnings };
}
