// Nota spese in PDF (A4). Struttura: intestazione dell'azienda, periodo e numero, dati di chi ha sostenuto le spese,
// elenco voci (data, descrizione/causale, categoria, documento, IVA, importo), riepilogo per categoria, totale,
// avvertenza sui giustificativi e spazi per le firme (chi ha sostenuto la spesa, chi approva).
// Documento gestionale non fiscale: i giustificativi originali (scontrini, fatture) vanno conservati e allegati.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const W = 595.28, H = 841.89, M = 40;
const INK = rgb(0.07, 0.09, 0.14), MUTED = rgb(0.38, 0.42, 0.48), RED = rgb(0.72, 0.11, 0.11), LINE = rgb(0.8, 0.82, 0.85);
const eur = (n) => `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dIt = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');
const DOC = { scontrino: 'Scontrino', fattura: 'Fattura', ricevuta: 'Ricevuta', nessuno: 'Senza giustificativo' };

export async function buildNotaSpese({ shop, data, who = '' }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Nota spese ${dIt(data.from)} - ${dIt(data.to)}`);
  pdf.setAuthor(shop.shop_name || 'Informatix Repair');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ok = new Set(font.getCharacterSet());
  // I font standard del PDF coprono il latino: ogni carattere non supportato diventa "?"
  const safe = (s) => [...String(s ?? '').replace(/[\r\n\t]+/g, ' ')].map((c) => (ok.has(c.codePointAt(0)) ? c : '?')).join('');
  const width = (s, f, size) => f.widthOfTextAtSize(safe(s), size);
  const wrap = (s, f, size, maxW) => {
    const out = [];
    let line = '';
    for (const word of safe(s).split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) <= maxW) { line = test; continue; }
      if (line) out.push(line);
      line = word;
      while (f.widthOfTextAtSize(line, size) > maxW) { // parola lunghissima: la spezza
        let k = line.length;
        while (k > 1 && f.widthOfTextAtSize(line.slice(0, k), size) > maxW) k--;
        out.push(line.slice(0, k));
        line = line.slice(k);
      }
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  };

  let page, y;
  const pages = [];
  const text = (s, x, yy, { size = 9, f = font, color = INK, align = 'left', maxW } = {}) => {
    const t = safe(s);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y: yy, size, font: f, color, maxWidth: maxW });
  };
  const hline = (yy, x1 = M, x2 = W - M, color = LINE, t = 0.6) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: t, color });

  // Colonne della tabella: x di inizio e larghezza
  const COLS = [
    { k: 'n', x: M, w: 20, h: 'N.' },
    { k: 'date', x: M + 22, w: 52, h: 'Data' },
    { k: 'desc', x: M + 78, w: 188, h: 'Descrizione / causale' },
    { k: 'cat', x: M + 270, w: 92, h: 'Categoria' },
    { k: 'doc', x: M + 366, w: 62, h: 'Documento' },
    { k: 'vat', x: W - M - 72, w: 0, h: 'IVA', right: true },
    { k: 'amt', x: W - M, w: 0, h: 'Importo', right: true },
  ];

  function newPage(first) {
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = H - M;
    if (first) {
      text(shop.shop_name || 'Informatix Repair', M, y - 4, { size: 15, f: bold });
      text([shop.shop_address, shop.shop_phone && `Tel. ${shop.shop_phone}`].filter(Boolean).join('  ·  '), M, y - 18, { size: 8.5, color: MUTED });
      text('NOTA SPESE', W - M, y - 4, { size: 18, f: bold, color: RED, align: 'right' });
      text(`N. NS-${data.from.replaceAll('-', '')}-${data.to.replaceAll('-', '')}`, W - M, y - 18, { size: 8.5, color: MUTED, align: 'right' });
      y -= 36;
      hline(y, M, W - M, INK, 1.2);
      y -= 20;
      // Riquadro dati
      const box = (label, value, x, w) => { text(label.toUpperCase(), x, y, { size: 7, f: bold, color: MUTED }); text(value || '—', x, y - 12, { size: 10 }); void w; };
      box('Periodo di riferimento', `dal ${dIt(data.from)} al ${dIt(data.to)}`, M);
      box('Data di emissione', dIt(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })), M + 190);
      box('Spese sostenute da', who || '________________________', M + 330);
      y -= 34;
    } else {
      text(`${shop.shop_name || ''} · Nota spese ${dIt(data.from)} - ${dIt(data.to)}`, M, y - 4, { size: 8, color: MUTED });
      y -= 22;
    }
    tableHead();
  }
  function tableHead() {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 17, color: rgb(0.95, 0.96, 0.97) });
    for (const c of COLS) text(c.h.toUpperCase(), c.x, y, { size: 7, f: bold, color: MUTED, align: c.right ? 'right' : 'left' });
    y -= 18;
  }
  const ensure = (need) => { if (y - need < M + 60) newPage(false); };

  newPage(true);
  data.rows.forEach((r, i) => {
    const descLines = wrap([r.description, r.vendor && `(${r.vendor})`].filter(Boolean).join(' '), font, 8.5, COLS[2].w);
    const docLines = wrap([DOC[r.doc_type] || r.doc_type, r.doc_number && `n. ${r.doc_number}`].filter(Boolean).join(' '), font, 8, COLS[4].w);
    const rowH = Math.max(descLines.length, docLines.length, 1) * 11 + 6;
    ensure(rowH);
    text(String(i + 1), COLS[0].x, y, { size: 8.5, color: MUTED });
    text(dIt(r.spent_on), COLS[1].x, y, { size: 8.5 });
    descLines.forEach((l, k) => text(l, COLS[2].x, y - k * 11, { size: 8.5 }));
    wrap(r.category, font, 8.5, COLS[3].w).slice(0, 2).forEach((l, k) => text(l, COLS[3].x, y - k * 11, { size: 8.5 }));
    docLines.forEach((l, k) => text(l, COLS[4].x, y - k * 11, { size: 8, color: r.doc_type === 'nessuno' ? RED : INK }));
    text(r.vat ? eur(r.vat) : '—', COLS[5].x, y, { size: 8.5, color: MUTED, align: 'right' });
    text(eur(r.amount), COLS[6].x, y, { size: 9, f: bold, align: 'right' });
    y -= rowH;
    hline(y + 4);
  });
  if (!data.rows.length) { text('Nessuna spesa registrata nel periodo.', M, y, { size: 9, color: MUTED }); y -= 20; }

  // Totali e riepilogo per categoria
  ensure(40 + data.by_category.length * 13 + 150);
  y -= 8;
  text('Totale spese', W - M - 90, y, { size: 10, f: bold, align: 'right' });
  text(eur(data.total), W - M, y, { size: 11, f: bold, align: 'right' });
  y -= 14;
  text('di cui IVA', W - M - 90, y, { size: 8.5, color: MUTED, align: 'right' });
  text(eur(data.vat), W - M, y, { size: 8.5, color: MUTED, align: 'right' });
  if (data.to_reimburse > 0) {
    y -= 13;
    text('di cui da rimborsare', W - M - 90, y, { size: 8.5, color: MUTED, align: 'right' });
    text(eur(data.to_reimburse), W - M, y, { size: 8.5, color: MUTED, align: 'right' });
  }
  if (data.by_category.length) {
    y -= 24;
    text('RIEPILOGO PER CATEGORIA', M, y, { size: 7.5, f: bold, color: RED });
    y -= 6;
    hline(y);
    for (const g of data.by_category) {
      y -= 13;
      text(`${g.category} (${g.n})`, M, y, { size: 8.5 });
      text(eur(g.total), M + 250, y, { size: 8.5, align: 'right' });
    }
  }

  // Avvertenza e firme
  y -= 30;
  const note = 'Allegare alla nota spese i giustificativi originali (scontrini, ricevute, fatture) e conservarli insieme ad essa. Le voci “senza giustificativo” possono essere rimborsate solo secondo la policy interna. Documento gestionale non fiscale.';
  wrap(note, font, 7.5, W - 2 * M).forEach((l) => { text(l, M, y, { size: 7.5, color: MUTED }); y -= 10; });
  y -= 24;
  const sign = (label, x, w) => { hline(y, x, x + w, INK, 0.8); text(label, x, y - 11, { size: 8, color: MUTED }); };
  sign('Firma di chi ha sostenuto le spese', M, 190);
  sign('Approvazione (firma del responsabile)', M + 215, 200);
  sign('Luogo e data', M + 440, W - 2 * M - 440);

  const total = pages.length;
  pages.forEach((p, i) => {
    page = p;
    text(`Pagina ${i + 1} di ${total}`, W - M, 22, { size: 7.5, color: MUTED, align: 'right' });
  });
  return pdf.save();
}
