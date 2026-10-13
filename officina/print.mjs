// Documenti stampabili (ricevuta di ingresso con QR, etichetta, ricevuta di vendita).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
const dt = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const d = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('it-IT') : '—');
const qr = (text, size = 130) => `<img src="/api/qr?text=${encodeURIComponent(text)}" width="${size}" height="${size}" alt="QR" />`;

const BASE_CSS = `
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:18px;font-size:12px}
  h1{font-size:18px;margin:0} h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#B91C1C;margin:14px 0 4px;border-bottom:1px solid #ddd;padding-bottom:3px}
  table{width:100%;border-collapse:collapse} td,th{padding:3px 4px;text-align:left;vertical-align:top} th{font-size:11px;color:#555}
  .row{display:flex;gap:14px;justify-content:space-between;align-items:flex-start} .muted{color:#555} .big{font-size:20px;font-weight:700}
  .box{border:1px solid #bbb;border-radius:6px;padding:8px} .sign{margin-top:26px;display:flex;gap:30px} .sign div{flex:1;border-top:1px solid #333;padding-top:3px;font-size:11px;color:#555}
  .terms{font-size:9.5px;color:#444;line-height:1.35;margin-top:10px}
  @media print{ .noprint{display:none} body{padding:0} }
  .noprint{margin-bottom:12px} .noprint button{padding:8px 14px;font-weight:700;cursor:pointer}
`;
const page = (title, body, extraCss = '') =>
  `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}${extraCss}</style></head><body>
  <div class="noprint"><button onclick="window.print()">Stampa</button></div>${body}
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script></body></html>`;

export function printRepair(r, trackUrl, s) {
  const body = `
  <div class="row">
    <div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
    <div style="text-align:right"><div class="muted">Scheda di lavoro</div><div class="big">${esc(r.code)}</div><div class="muted">${dt(r.created_at)}</div></div>
  </div>
  <div class="row" style="margin-top:10px">
    <div style="flex:1">
      <h2>Cliente</h2>
      <table><tr><td><b>${esc(r.customer_name)}</b></td></tr><tr><td>${esc(r.customer_phone) || '—'}</td></tr><tr><td>${esc(r.customer_email) || ''}</td></tr></table>
      <h2>Dispositivo</h2>
      <table>
        <tr><th>Tipo</th><td>${esc(r.device_type)}</td></tr>
        <tr><th>Modello</th><td><b>${esc(r.brand_model)}</b></td></tr>
        <tr><th>Seriale/IMEI</th><td>${esc(r.serial) || '—'}</td></tr>
        <tr><th>Accessori</th><td>${esc(r.accessories) || 'nessuno'}</td></tr>
        <tr><th>Condizioni</th><td>${esc(r.condition_notes) || '—'}</td></tr>
      </table>
      <h2>Problema segnalato</h2><div class="box">${esc(r.problem)}</div>
    </div>
    <div style="text-align:center;width:170px" class="box">
      ${qr(trackUrl, 150)}
      <div style="font-size:10px;margin-top:4px"><b>Segui la riparazione</b><br>inquadra il QR con il telefono</div>
      <div style="font-size:9px;word-break:break-all;margin-top:4px" class="muted">${esc(trackUrl)}</div>
    </div>
  </div>
  <h2>Economico</h2>
  <table>
    <tr><th>Preventivo</th><td><b>${r.quote != null ? eur(r.quote) : 'da definire'}</b></td><th>Acconto versato</th><td>${eur(r.deposit)}</td></tr>
    <tr><th>Consegna stimata</th><td>${d(r.eta_date)}</td><th>Garanzia riparazione</th><td>${r.warranty_days} giorni</td></tr>
  </table>
  <div class="terms"><b>Condizioni:</b> ${esc(s.terms)}</div>
  <div class="sign"><div>Firma del cliente (accetta le condizioni)</div><div>Firma del negozio</div></div>`;
  return page(`Scheda ${r.code}`, body);
}

export function printLabel(r, trackUrl) {
  const body = `<div class="row"><div><div class="big">${esc(r.code)}</div><div><b>${esc(r.brand_model)}</b></div><div>${esc(r.customer_name)}</div>
    <div class="muted">${dt(r.created_at)}</div></div>${qr(trackUrl, 90)}</div>`;
  return page(`Etichetta ${r.code}`, body, '@page{size:62mm 30mm;margin:2mm} body{font-size:10px;padding:0} .big{font-size:15px}');
}

export function printSale(sale, s) {
  const rows = sale.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td style="text-align:right">${eur(i.unit_price)}</td><td style="text-align:right">${eur(i.qty * i.unit_price)}</td></tr>`).join('');
  const body = `
  <div class="row"><div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
  <div style="text-align:right"><div class="muted">Ricevuta di vendita</div><div class="big">${esc(sale.code)}</div><div class="muted">${dt(sale.created_at)}</div></div></div>
  <table style="margin-top:14px"><tr><th>Articolo</th><th>Q.tà</th><th style="text-align:right">Prezzo</th><th style="text-align:right">Totale</th></tr>${rows}</table>
  ${sale.discount ? `<p style="text-align:right">Sconto: -${eur(sale.discount)}</p>` : ''}
  <p style="text-align:right" class="big">Totale ${eur(sale.total)}</p><p class="muted">Pagamento: ${esc(sale.method)}</p>
  <p class="terms">Documento non fiscale. Per la garanzia legale conservare questa ricevuta.</p>`;
  return page(`Vendita ${sale.code}`, body);
}
