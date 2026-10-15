// Documenti stampabili:
//  - Scheda cliente     (copia per il cliente: dati, dispositivo, preventivo, QR per seguire la riparazione, condizioni, firme)
//  - Scheda laboratorio (copia interna per il tecnico: tutto quanto sopra + PIN, checklist di ingresso e collaudo, diagnosi, ricambi, tempi)
//  - Etichetta dispositivo 62x30 mm, ricevuta di vendita
// Aggiungendo ?noprint=1 all'indirizzo la stampa automatica non parte (utile per anteprime e test).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
const dt = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const d = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('it-IT') : '—');
const qr = (text, size = 130) => `<img src="/api/qr?text=${encodeURIComponent(text)}" width="${size}" height="${size}" alt="QR" />`;
const barcode = (text, w = 150, h = 34) => `<img src="/api/barcode?text=${encodeURIComponent(text)}" style="width:${w}px;height:${h}px;display:block" alt="codice a barre ${esc(text)}" />`;
import { DEVICE_TYPES, typeInfo } from './checklists.mjs';
import { isVerified, LEGAL_NOTE } from './legal.mjs';
const TYPES = Object.fromEntries(Object.entries(DEVICE_TYPES).map(([k, v]) => [k, v.label]));

const BASE_CSS = `
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:18px;font-size:12px;line-height:1.35}
  h1{font-size:18px;margin:0}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#B91C1C;margin:12px 0 4px;border-bottom:1px solid #ddd;padding-bottom:2px}
  table{width:100%;border-collapse:collapse} td,th{padding:2px 4px;text-align:left;vertical-align:top} th{font-size:10.5px;color:#555;font-weight:600;white-space:nowrap}
  .row{display:flex;gap:14px;justify-content:space-between;align-items:flex-start}
  .muted{color:#555} .big{font-size:20px;font-weight:700} .center{text-align:center}
  .box{border:1px solid #bbb;border-radius:6px;padding:7px 9px}
  .sign{margin-top:22px;display:flex;gap:30px} .sign div{flex:1;border-top:1px solid #333;padding-top:3px;font-size:10.5px;color:#555}
  .terms{font-size:9px;color:#444;line-height:1.35;margin-top:8px}
  .pill{display:inline-block;border:1px solid #111;border-radius:99px;padding:1px 9px;font-size:10px;font-weight:700;letter-spacing:.04em}
  .pill.urg{background:#B91C1C;color:#fff;border-color:#B91C1C}
  .ck{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 10px;font-size:11px}
  .ck span{display:flex;align-items:flex-start;gap:5px}
  .ck span:before{content:"";flex:none;display:inline-flex;align-items:center;justify-content:center;width:10px;height:10px;border:1.2px solid #111;font-size:9px;line-height:1;font-weight:700;margin-top:1px}
  .ck .s-ok:before{content:"✔"} .ck .s-ko:before{content:"✖"} .ck .s-na:before{content:"–"}
  .ck .s-ko{font-weight:700}
  .ck-by{font-size:8.5px;margin-top:2px}
  .clamp{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
  .lab{font-size:10px;line-height:1.3} .lab h2{margin:7px 0 3px} .lab .ck{font-size:9.5px;gap:2px 8px} .lab .lines{height:13px}
  .lab .box{padding:4px 7px} .lab td,.lab th{padding:1px 4px} .lab h1{font-size:16px} .lab .big{font-size:17px}
  .lines{height:15px;border-bottom:1px solid #999}
  .pass{font-family:"Courier New",monospace;font-size:16px;font-weight:700;border:2px dashed #111;border-radius:6px;padding:5px 10px;min-height:32px}
  .page{page-break-after:always} .page:last-child{page-break-after:auto}
  .noprint{margin-bottom:12px} .noprint button{padding:8px 14px;font-weight:700;cursor:pointer}
  table.dev{table-layout:fixed} table.dev th{white-space:normal} table.dev td{overflow-wrap:anywhere}
  /* scheda cliente: un A4 diviso a meta', due copie identiche (negozio e cliente) */
  .sheet{max-width:186mm}
  .half{height:131mm;overflow:hidden;font-size:11px;line-height:1.3;display:flex;flex-direction:column}
  .half h2{margin:8px 0 3px;font-size:10px}
  .half .hh{align-items:flex-end} .half .shop{font-size:15px} .half .big{font-size:16px}
  .copy{display:inline-block;border:1px solid #111;border-radius:4px;padding:0 6px;font-size:9px;font-weight:700;letter-spacing:.06em}
  .cgrid{display:grid;grid-template-columns:1fr 1fr 112px;gap:0 12px}
  .cname{font-size:13px;font-weight:700}
  .kvp{display:grid;grid-template-columns:84px 1fr;gap:0 6px;padding:1.5px 0} .kvp>span{color:#555;font-size:9.5px} .kvp b{font-weight:600;overflow-wrap:anywhere}
  .qrbox{text-align:center;padding-top:10px} .qrt{font-size:8.5px;line-height:1.25;margin-top:2px}
  .half .terms{font-size:9.2px;line-height:1.35;margin-top:5px}
  .draftmark{font-style:italic;color:#B91C1C}
  .signrow{display:flex;gap:30px;margin-top:auto}
  .signrow>div{flex:1} .sigarea{height:56px;display:flex;align-items:flex-end;justify-content:flex-start;border-bottom:1px solid #333}
  .sigcap{font-size:8.5px;color:#555;padding-top:2px}
  .sigprint{max-height:54px;max-width:100%;object-fit:contain}
  .cut{position:relative;border-top:1.5px dashed #888;margin:2mm 0} .cut span{position:absolute;right:0;top:-7px;background:#fff;font-size:8px;color:#888;padding-left:4px}
  .lab{max-width:186mm}
  @media print{ .sheet{height:268mm;overflow:hidden} .lab{height:268mm;overflow:hidden} .noprint{display:none} body{padding:0;font-size:11px} h2{margin:9px 0 3px} .lines{height:14px} @page{size:A4;margin:12mm} }
`;

function page(title, body, extraCss = '', req = {}) {
  const auto = req.noprint ? '' : `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}${extraCss}</style></head><body>
  <div class="noprint"><button onclick="window.print()">Stampa</button></div>${body}${auto}</body></html>`;
}

const header = (s, kind, r) => `
  <div class="row">
    <div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
    <div style="text-align:right"><div class="muted">${kind}</div><div class="big">${esc(r.code)}</div>
      <div class="muted">Ricevuto il ${dt(r.created_at)}</div>${r.urgent ? '<div><span class="pill urg">URGENTE</span></div>' : ''}
      <div style="margin-top:4px;display:inline-block">${barcode(r.code, 150, 30)}</div></div>
  </div>`;

const customerBlock = (r, withEmail = true) => `
  <table><tr><td><b style="font-size:14px">${esc(r.customer_name)}</b></td></tr>
  <tr><td>Tel. ${esc(r.customer_phone) || '—'}${withEmail && r.customer_email ? ' · ' + esc(r.customer_email) : ''}</td></tr></table>`;

// colonne a larghezza fissa: etichette e valori restano allineati su tutte le righe
const deviceBlock = (r) => `
  <table class="dev"><colgroup><col style="width:19%"><col style="width:31%"><col style="width:17%"><col style="width:33%"></colgroup>
    <tr><th>Tipo</th><td>${esc(TYPES[r.device_type] || r.device_type)}</td><th>${esc(typeInfo(r.device_type).serial)}</th><td>${esc(r.serial) || '—'}</td></tr>
    <tr><th>Modello</th><td><b style="font-size:13px">${esc(r.brand_model)}</b></td><th>Colore</th><td>${esc(r.color) || '—'}</td></tr>
    <tr><th>Accessori lasciati</th><td colspan="3">${esc(r.accessories) || 'nessuno'}</td></tr>
    <tr><th>Stato estetico</th><td colspan="3">${esc(r.condition_notes) || '—'}</td></tr>
  </table>`;

const moneyBlock = (r) => `
  <table>
    <tr><th>Preventivo</th><td><b>${r.quote != null ? eur(r.quote) : 'da definire'}</b></td><th>Acconto versato</th><td>${eur(r.deposit)}</td>
        <th>Saldo previsto</th><td>${r.quote != null ? eur(Math.max(0, r.quote - (r.deposit || 0))) : '—'}</td></tr>
    <tr><th>Consegna stimata</th><td>${d(r.eta_date)}</td><th>Garanzia riparazione</th><td colspan="3">${r.warranty_days} giorni dalla consegna</td></tr>
  </table>`;

// ---------- Scheda CLIENTE (ricevuta di ingresso): UN foglio A4 diviso a meta', stessa scheda due volte ----------
// Meta' alta = copia del negozio, meta' bassa = copia del cliente: ognuno firma la sua. Se il cliente ha firmato sul tablet o dal
// link, la firma (immagine) compare su entrambe le copie con data e ora. Tutto resta in una pagina: i testi lunghi si troncano.
const kv = (k, v) => `<div class="kvp"><span>${k}</span><b>${v}</b></div>`;

function customerHalf(r, trackUrl, s, copy) {
  const info = typeInfo(r.device_type);
  const t = r.intake_texts || { consent: '', terms: s.terms };
  const sig = r.sign_intake;
  const draft = isVerified(s) ? '' : `<span class="draftmark">${LEGAL_NOTE}</span>`;
  const signBox = sig
    ? `<img src="${sig.image}" alt="Firma del cliente" class="sigprint" />`
    : '';
  const signCap = sig ? `Firma del cliente · firmato digitalmente da ${esc(sig.signer_name || r.customer_name)} il ${dt(sig.signed_at)}${sig.via === 'link' ? ' da link' : ' al banco'}` : 'Firma del cliente (accetta le condizioni)';
  return `<div class="half">
  <div class="row hh">
    <div><b class="shop">${esc(s.shop_name)}</b><div class="muted">${esc(s.shop_address)} · Tel. ${esc(s.shop_phone)}</div></div>
    <div style="text-align:right"><span class="copy">${copy}</span><div><b class="big">${esc(r.code)}</b> ${r.urgent ? '<span class="pill urg">URGENTE</span>' : ''}</div>
      <div class="muted">Scheda di ingresso · ${dt(r.created_at)}</div></div>
  </div>
  <div class="cgrid">
    <div>
      <h2>Cliente</h2>
      <div class="cname">${esc(r.customer_name)}</div>
      <div>Tel. ${esc(r.customer_phone) || '—'}${r.customer_email ? ` · ${esc(r.customer_email)}` : ''}</div>
      <h2>Dispositivo consegnato</h2>
      ${kv('Modello', `<span style="font-size:11px">${esc(cut(r.brand_model, 60))}</span>`)}
      ${r.color ? kv('Colore', esc(cut(r.color, 30))) : ''}
      ${kv('Tipo', esc(TYPES[r.device_type] || r.device_type))}
      ${kv(esc(info.serial), esc(cut(r.serial, 40)) || '—')}
      ${kv('Accessori', esc(cut(r.accessories, 70)) || 'nessuno')}
      ${kv('Stato', esc(cut(r.condition_notes, 80)) || '—')}
    </div>
    <div>
      <h2>Problema segnalato</h2>
      <div class="box"><div class="clamp" style="-webkit-line-clamp:4">${esc(cut(r.problem, 220))}</div></div>
      <h2>Preventivo e tempi</h2>
      ${kv('Preventivo', `<b>${r.quote != null ? eur(r.quote) : 'da definire'}</b>`)}
      ${kv('Acconto', eur(r.deposit))}
      ${kv('Saldo previsto', r.quote != null ? eur(Math.max(0, r.quote - (r.deposit || 0))) : '—')}
      ${kv('Consegna stimata', d(r.eta_date))}
      ${kv('Garanzia', `${r.warranty_days} giorni dalla consegna`)}
    </div>
    <div class="qrbox">
      ${qr(trackUrl, 104)}
      <div class="qrt"><b>Segui la riparazione</b><br>inquadra il QR: stato in tempo reale e conferma del preventivo</div>
    </div>
  </div>
  <div class="terms"><b>Consenso:</b> ${esc(cut(t.consent, 900))} ${draft}</div>
  <div class="terms clamp" style="-webkit-line-clamp:6"><b>Condizioni:</b> ${esc(cut(t.terms, 900))} Ti avvisiamo quando il preventivo è pronto e quando il dispositivo è pronto. Per il ritiro porta questo foglio (o dì il codice <b>${esc(r.code)}</b>) e un documento.</div>
  <div class="signrow">
    <div><div class="sigarea">${signBox}</div><div class="sigcap">${signCap}</div></div>
    <div><div class="sigarea"></div><div class="sigcap">Firma del negozio</div></div>
  </div>
  </div>`;
}

export function customerCard(r, trackUrl, s) {
  return `<div class="page sheet">${customerHalf(r, trackUrl, s, 'COPIA NEGOZIO')}<div class="cut"><span>✂ taglia qui</span></div>${customerHalf(r, trackUrl, s, 'COPIA CLIENTE')}</div>`;
}

// ---------- Scheda LABORATORIO (sempre UNA pagina A4) ----------
// Le voci dei controlli dipendono dal tipo di dispositivo (r.ck_lists, vedi checklists.mjs). Se il tecnico li ha gia'
// compilati sul gestionale (r.checklist_in/pre/out) si stampano con ✔ / ✖ / –, altrimenti restano caselle da barrare.
// I testi lunghi (problema, diagnosi) vengono troncati con "continua sul gestionale": il foglio non esce mai su due pagine.
const CHECK_ENTRY = ['Si accende', 'Display / touch', 'Audio e microfono', 'Pulsanti', 'Ricarica / porta', 'Wi-Fi / Bluetooth', 'Segni di liquido', 'Già aperto da terzi'];
const CHECK_DONE = ['Si accende e si avvia', 'Display / touch', 'Audio e microfono', 'Pulsanti', 'Ricarica / porta', 'Wi-Fi / Bluetooth', 'Pulizia / estetica', 'Viti e cover chiuse'];
const CHECK_PRE = ['Backup dati eseguito / proposto al cliente', 'Cliente autorizza reset o formattazione', 'Accessori contati e annotati', 'Foto del dispositivo scattate'];
const MARK = { ok: 'ok', ko: 'ko', na: 'na' };
/** Taglia un testo lungo alla lunghezza che sta nel riquadro e segnala che il resto e' sul gestionale. */
const cut = (t, n) => { const x = String(t ?? '').trim(); return x.length > n ? `${x.slice(0, n).trimEnd()}… (continua sul gestionale)` : x; };

function ckBlock(saved, labels, cols) {
  const items = saved?.items?.length ? saved.items : (labels || []).map((l) => ({ l, s: null }));
  const spans = items.map((i) => `<span class="${MARK[i.s] ? `s-${i.s}` : ''}">${esc(i.l)}</span>`).join('');
  const who = saved ? `<div class="muted ck-by">Compilato da ${esc(saved.by)} il ${dt(saved.at)} (✔ funziona · ✖ non funziona · – non presente)</div>` : '';
  return `<div class="ck" style="grid-template-columns:repeat(${cols},1fr)">${spans}</div>${who}`;
}

export function labCard(r, trackUrl, s) {
  const shown = r.parts.slice(0, 5);
  const parts = shown.map((p) => `<tr><td>${esc(cut(p.name, 60))}</td><td>${p.qty}</td><td>${eur(p.unit_cost)}</td><td>${eur(p.unit_price)}</td></tr>`).join('')
    + (r.parts.length > shown.length ? `<tr><td colspan="4" class="muted">… e altri ${r.parts.length - shown.length} ricambi (vedi gestionale)</td></tr>` : '');
  const blank = (n) => Array.from({ length: n }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('');
  const info = typeInfo(r.device_type);
  const ck = r.ck_lists || {};
  return `<div class="page lab">
  ${header(s, 'Scheda laboratorio · uso interno', r)}
  <div class="row" style="margin-top:4px;align-items:stretch">
    <div style="flex:1.2"><h2>Cliente</h2>${customerBlock(r)}</div>
    <div style="flex:1"><h2>${esc(info.passcode)}</h2><div class="pass">${esc(r.passcode) || ''}</div></div>
    <div style="width:74px;text-align:center;margin-top:6px">${qr(trackUrl, 66)}<div style="font-size:7.5px" class="muted">link cliente</div></div>
  </div>
  <h2>Dispositivo</h2>${deviceBlock(r)}
  <h2>Problema segnalato dal cliente</h2><div class="box"><div class="clamp" style="-webkit-line-clamp:3">${esc(cut(r.problem, 260))}</div></div>
  <h2>Economico e tempi</h2>${moneyBlock(r)}

  <h2>${esc(PHASE_TITLE.in)}</h2>${ckBlock(r.checklist_in, ck.in || CHECK_ENTRY, 4)}
  <h2>${esc(PHASE_TITLE.pre)}</h2>${ckBlock(r.checklist_pre, ck.pre || CHECK_PRE, 2)}

  <h2>Diagnosi</h2>
  ${r.tech_notes ? `<div class="box"><div class="clamp" style="-webkit-line-clamp:6;white-space:pre-wrap">${esc(cut(r.tech_notes, 520))}</div></div>` : '<div class="lines"></div><div class="lines"></div>'}
  <h2>Lavori eseguiti</h2>
  <div class="lines"></div><div class="lines"></div>
  <h2>Ricambi e materiali</h2>
  <table class="box"><tr><th>Ricambio</th><th>Q.tà</th><th>Costo</th><th>Prezzo</th></tr>${parts}${blank(r.parts.length ? 1 : 2)}</table>
  <div class="row" style="margin-top:4px"><div>Tempo impiegato: ______ h ______ min</div><div>Tecnico: ____________________</div><div>Data fine lavori: ___ / ___ / ______</div></div>

  <h2>${esc(PHASE_TITLE.out)} (tutto ok prima di avvisare il cliente)</h2>${ckBlock(r.checklist_out, ck.out || CHECK_DONE, 4)}
  <div class="row" style="margin-top:5px"><div>Cliente avvisato il ___ / ___ alle ____ con: ☐ WhatsApp ☐ telefonata</div><div>Consegnato il ___ / ___ / ______</div></div>
  </div>`;
}
const PHASE_TITLE = { in: 'Controllo all’ingresso (barra ciò che funziona, cerchia ciò che non funziona)', pre: 'Al ritiro in laboratorio', out: 'Collaudo finale' };

export const printCustomer = (r, url, s, req) => page(`Scheda cliente ${r.code}`, customerCard(r, url, s), '', req);
export const printLab = (r, url, s, req) => page(`Scheda laboratorio ${r.code}`, labCard(r, url, s), '', req);
export const printBoth = (r, url, s, req) => page(`Schede ${r.code}`, customerCard(r, url, s) + labCard(r, url, s), '', req);

export function printLabel(r, trackUrl, req) {
  const body = `<div class="row"><div><div class="big">${esc(r.code)}</div><div><b>${esc(r.brand_model)}</b></div><div>${esc(r.customer_name)}</div>
    <div class="muted">${dt(r.created_at)}</div></div>${qr(trackUrl, 78)}</div>
    <div style="margin-top:2px">${barcode(r.code, 200, 22)}</div>`;
  return page(`Etichetta ${r.code}`, body, '@page{size:62mm 30mm;margin:2mm} body{font-size:10px;padding:0} .big{font-size:14px}', req);
}

// Quote del pagamento (anche diviso) e saldo residuo dei buoni regalo usati
const payLines = (sale) => {
  const pays = sale.payments || [];
  const v = (sale.vouchers || []).map((x) => `<br>Buono ${esc(x.code)}: -${eur(x.amount)}${x.kind === 'regalo' ? ` · saldo residuo ${eur(x.balance)}` : ''}`).join('');
  if (pays.length <= 1 && !v) return `<p class="muted">Pagamento: ${esc(sale.method)}</p>`;
  return `<p class="muted">Pagamento:${pays.map((p) => `<br>${esc(p.method)}: ${eur(p.amount)}`).join('')}${v}</p>`;
};
export function printSale(sale, s, req) {
  const rows = sale.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td style="text-align:right">${eur(i.unit_price)}</td><td style="text-align:right">${eur(i.qty * i.unit_price)}</td></tr>`).join('');
  const body = `
  <div class="row"><div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
  <div style="text-align:right"><div class="muted">Ricevuta di vendita</div><div class="big">${esc(sale.code)}</div><div class="muted">${dt(sale.created_at)}</div></div></div>
  <table style="margin-top:14px"><tr><th>Articolo</th><th>Q.tà</th><th style="text-align:right">Prezzo</th><th style="text-align:right">Totale</th></tr>${rows}</table>
  ${sale.discount ? `<p style="text-align:right">Sconto: -${eur(sale.discount)}</p>` : ''}
  <p style="text-align:right" class="big">Totale ${eur(sale.total)}</p>${payLines(sale)}
  <p class="terms">Documento non fiscale. Per la garanzia legale conservare questa ricevuta.</p>`;
  return page(`Vendita ${sale.code}`, body, '', req);
}
