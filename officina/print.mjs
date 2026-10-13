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
const TYPES = { smartphone: 'Smartphone', tablet: 'Tablet', portatile: 'Portatile', pc: 'PC fisso', console: 'Console', altro: 'Altro' };

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
  .ck span:before{content:"";display:inline-block;width:9px;height:9px;border:1.2px solid #111;margin-right:5px;vertical-align:-1px}
  .lines{height:15px;border-bottom:1px solid #999}
  .pass{font-family:"Courier New",monospace;font-size:16px;font-weight:700;border:2px dashed #111;border-radius:6px;padding:5px 10px;min-height:32px}
  .page{page-break-after:always} .page:last-child{page-break-after:auto}
  .noprint{margin-bottom:12px} .noprint button{padding:8px 14px;font-weight:700;cursor:pointer}
  @media print{ .noprint{display:none} body{padding:0;font-size:11px} h2{margin:9px 0 3px} .lines{height:14px} @page{size:A4;margin:12mm} }
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
      <div class="muted">Ricevuto il ${dt(r.created_at)}</div>${r.urgent ? '<div><span class="pill urg">URGENTE</span></div>' : ''}</div>
  </div>`;

const customerBlock = (r, withEmail = true) => `
  <table><tr><td><b style="font-size:14px">${esc(r.customer_name)}</b></td></tr>
  <tr><td>Tel. ${esc(r.customer_phone) || '—'}${withEmail && r.customer_email ? ' · ' + esc(r.customer_email) : ''}</td></tr></table>`;

const deviceBlock = (r, withPass = false) => `
  <table>
    <tr><th>Tipo</th><td>${esc(TYPES[r.device_type] || r.device_type)}</td><th>Seriale / IMEI</th><td>${esc(r.serial) || '—'}</td></tr>
    <tr><th>Modello</th><td colspan="3"><b style="font-size:13px">${esc(r.brand_model)}</b></td></tr>
    <tr><th>Accessori lasciati</th><td colspan="3">${esc(r.accessories) || 'nessuno'}</td></tr>
    <tr><th>Stato estetico</th><td colspan="3">${esc(r.condition_notes) || '—'}</td></tr>
  </table>${withPass ? '' : ''}`;

const moneyBlock = (r) => `
  <table>
    <tr><th>Preventivo</th><td><b>${r.quote != null ? eur(r.quote) : 'da definire'}</b></td><th>Acconto versato</th><td>${eur(r.deposit)}</td>
        <th>Saldo previsto</th><td>${r.quote != null ? eur(Math.max(0, r.quote - (r.deposit || 0))) : '—'}</td></tr>
    <tr><th>Consegna stimata</th><td>${d(r.eta_date)}</td><th>Garanzia riparazione</th><td colspan="3">${r.warranty_days} giorni dalla consegna</td></tr>
  </table>`;

// ---------- Scheda CLIENTE ----------
export function customerCard(r, trackUrl, s) {
  return `<div class="page">
  ${header(s, 'Scheda cliente · ricevuta di ingresso', r)}
  <div class="row" style="margin-top:8px">
    <div style="flex:1">
      <h2>Cliente</h2>${customerBlock(r)}
      <h2>Dispositivo consegnato</h2>${deviceBlock(r)}
      <h2>Problema segnalato</h2><div class="box">${esc(r.problem)}</div>
    </div>
    <div class="box center" style="width:178px;margin-top:8px">
      ${qr(trackUrl, 150)}
      <div style="font-size:11px;margin-top:4px"><b>Segui la tua riparazione</b><br>inquadra il QR con il telefono</div>
      <div style="font-size:9px;word-break:break-all;margin-top:4px" class="muted">${esc(trackUrl)}</div>
      <div style="font-size:9.5px;margin-top:5px" class="muted">Vedrai lo stato in tempo reale, il preventivo e potrai approvarlo con un tap.</div>
    </div>
  </div>
  <h2>Preventivo e tempi</h2>${moneyBlock(r)}
  <h2>Come funziona</h2>
  <div style="font-size:10.5px">1) Ti avvisiamo quando il preventivo è pronto, quando serve la tua conferma e quando il dispositivo è pronto. 2) Per il ritiro porta questo foglio (o dì il codice <b>${esc(r.code)}</b>) e un documento. 3) Per informazioni: ${esc(s.shop_phone)}.</div>
  <div class="terms"><b>Condizioni:</b> ${esc(s.terms)}</div>
  <div class="sign"><div>Firma del cliente (accetta le condizioni)</div><div>Firma del negozio</div></div>
  </div>`;
}

// ---------- Scheda LABORATORIO ----------
const CHECK_ENTRY = ['Si accende', 'Display / touch', 'Fotocamere', 'Audio e microfono', 'Altoparlante', 'Pulsanti', 'Ricarica / porta', 'Wi-Fi / Bluetooth', 'SIM / rete', 'Face ID / impronta', 'Segni di liquido', 'Già aperto da terzi', 'Sensori', 'Batteria (stato)', 'Vetro posteriore'];
const CHECK_DONE = ['Si accende e si avvia', 'Display / touch', 'Fotocamere', 'Audio e microfono', 'Altoparlante', 'Pulsanti', 'Ricarica / porta', 'Wi-Fi / Bluetooth', 'SIM / rete', 'Face ID / impronta', 'Sensori', 'Batteria / autonomia', 'Pulizia / estetica', 'Viti e cover chiuse', 'Aggiornamenti / reset'];

export function labCard(r, trackUrl, s) {
  const parts = r.parts.length
    ? r.parts.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${eur(p.unit_cost)}</td><td>${eur(p.unit_price)}</td></tr>`).join('')
    : '';
  const blank = (n) => Array.from({ length: n }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('');
  return `<div class="page">
  ${header(s, 'Scheda laboratorio · uso interno', r)}
  <div class="row" style="margin-top:6px;align-items:stretch">
    <div style="flex:1.2"><h2>Cliente</h2>${customerBlock(r)}</div>
    <div style="flex:1"><h2>PIN / schema di sblocco</h2><div class="pass">${esc(r.passcode) || ''}</div></div>
    <div style="width:92px;text-align:center;margin-top:8px">${qr(trackUrl, 82)}<div style="font-size:8px" class="muted">link cliente</div></div>
  </div>
  <h2>Dispositivo</h2>${deviceBlock(r)}
  <h2>Problema segnalato dal cliente</h2><div class="box">${esc(r.problem)}</div>
  <h2>Economico e tempi</h2>${moneyBlock(r)}

  <h2>Controllo all'ingresso (barra ciò che funziona, cerchia ciò che non funziona)</h2>
  <div class="ck">${CHECK_ENTRY.map((c) => `<span>${c}</span>`).join('')}</div>
  <h2>Al ritiro in laboratorio</h2>
  <div class="ck" style="grid-template-columns:repeat(2,1fr)">
    <span>Backup dati eseguito / proposto al cliente</span><span>Cliente autorizza reset o formattazione</span>
    <span>Blocco account disattivato (iCloud / Google)</span><span>SIM e scheda SD rimosse e restituite</span>
    <span>Accessori contati e annotati</span><span>Foto del dispositivo scattate</span>
  </div>

  <h2>Diagnosi</h2>
  ${r.tech_notes ? `<div class="box" style="white-space:pre-wrap">${esc(r.tech_notes)}</div>` : '<div class="lines"></div><div class="lines"></div><div class="lines"></div>'}
  <h2>Lavori eseguiti</h2>
  <div class="lines"></div><div class="lines"></div><div class="lines"></div>
  <h2>Ricambi e materiali</h2>
  <table class="box"><tr><th>Ricambio</th><th>Q.tà</th><th>Costo</th><th>Prezzo</th></tr>${parts}${blank(r.parts.length ? 1 : 3)}</table>
  <div class="row" style="margin-top:6px"><div>Tempo impiegato: ______ h ______ min</div><div>Tecnico: ____________________</div><div>Data fine lavori: ___ / ___ / ______</div></div>

  <h2>Collaudo finale (tutto ok prima di avvisare il cliente)</h2>
  <div class="ck">${CHECK_DONE.map((c) => `<span>${c}</span>`).join('')}</div>
  <div class="row" style="margin-top:8px;font-size:11px"><div>Cliente avvisato il ___ / ___ alle ____ con: ☐ WhatsApp ☐ telefonata</div><div>Consegnato il ___ / ___ / ______</div></div>
  </div>`;
}

export const printCustomer = (r, url, s, req) => page(`Scheda cliente ${r.code}`, customerCard(r, url, s), '', req);
export const printLab = (r, url, s, req) => page(`Scheda laboratorio ${r.code}`, labCard(r, url, s), '', req);
export const printBoth = (r, url, s, req) => page(`Schede ${r.code}`, customerCard(r, url, s) + labCard(r, url, s), '', req);

export function printLabel(r, trackUrl, req) {
  const body = `<div class="row"><div><div class="big">${esc(r.code)}</div><div><b>${esc(r.brand_model)}</b></div><div>${esc(r.customer_name)}</div>
    <div class="muted">${dt(r.created_at)}</div></div>${qr(trackUrl, 90)}</div>`;
  return page(`Etichetta ${r.code}`, body, '@page{size:62mm 30mm;margin:2mm} body{font-size:10px;padding:0} .big{font-size:15px}', req);
}

export function printSale(sale, s, req) {
  const rows = sale.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td style="text-align:right">${eur(i.unit_price)}</td><td style="text-align:right">${eur(i.qty * i.unit_price)}</td></tr>`).join('');
  const body = `
  <div class="row"><div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
  <div style="text-align:right"><div class="muted">Ricevuta di vendita</div><div class="big">${esc(sale.code)}</div><div class="muted">${dt(sale.created_at)}</div></div></div>
  <table style="margin-top:14px"><tr><th>Articolo</th><th>Q.tà</th><th style="text-align:right">Prezzo</th><th style="text-align:right">Totale</th></tr>${rows}</table>
  ${sale.discount ? `<p style="text-align:right">Sconto: -${eur(sale.discount)}</p>` : ''}
  <p style="text-align:right" class="big">Totale ${eur(sale.total)}</p><p class="muted">Pagamento: ${esc(sale.method)}</p>
  <p class="terms">Documento non fiscale. Per la garanzia legale conservare questa ricevuta.</p>`;
  return page(`Vendita ${sale.code}`, body, '', req);
}
