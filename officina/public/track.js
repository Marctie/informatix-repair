// Pagina di tracciamento per il cliente: si aggiorna da sola ogni 8 secondi.
const token = location.pathname.split('/').pop();
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
const fdate = (s) => (s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '').replace(' ', 'T')).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : null);
const fdt = (s) => new Date(s.replace(' ', 'T')).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let last = '';
async function load() {
  try {
    const res = await fetch(`/api/track/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (res.status === 404) {
      app.innerHTML = '<div class="err"><h2>Codice non valido</h2><p>Controlla di aver inquadrato il QR della tua ricevuta, oppure chiama il negozio.</p></div>';
      return;
    }
    const d = await res.json();
    const sig = JSON.stringify(d);
    if (sig !== last) { last = sig; render(d); }
  } catch {
    /* offline: riprova al prossimo giro, la schermata resta com'è */
  }
}

function render(d) {
  document.title = `${d.code} · ${d.status_label}`;
  document.getElementById('shop').textContent = d.shop.name;
  const done = d.status === 'delivered' || d.status === 'ready';
  const steps = d.steps.map((l, i) => `<div class="${i <= d.step ? 'on' : ''} ${i === d.step ? 'now' : ''}">${esc(l)}</div>`).join('');
  const eta = d.eta_date && !['delivered', 'cancelled'].includes(d.status)
    ? `<div class="eta"><span style="font-size:24px">🗓️</span><div><small style="color:#6B7280">Consegna stimata</small><br><b>${esc(fdate(d.eta_date))}</b></div></div>` : '';
  const ask = d.awaiting_decision && d.quote_decision !== 'declined'
    ? `<div class="card ask"><h2>Serve la tua conferma</h2>
        <p style="margin:0">Il preventivo per la riparazione è di <b>${eur(d.quote)}</b>. Vuoi procedere?</p>
        <div class="btns"><button class="yes" data-d="1">Sì, procedi</button><button class="no" data-d="0">No, grazie</button></div></div>`
    : d.quote_decision === 'declined' && d.status === 'quote_pending'
      ? `<div class="card ask"><p style="margin:0">Hai rifiutato il preventivo. Ti contatteremo a breve, oppure chiamaci al <b>${esc(d.shop.phone)}</b>.</p></div>` : '';
  const warranty = d.status === 'delivered' && d.warranty_days
    ? `<div class="note">Questa riparazione è coperta da garanzia di <b>${d.warranty_days} giorni</b> dalla consegna.</div>` : '';

  app.innerHTML = `
    <div class="card">
      <h1>Riparazione ${esc(d.code)}</h1>
      <div class="status">${esc(d.status_label)}</div>
      <p class="hint">${esc(d.status_hint)}</p>
      ${d.cancelled ? '' : `<div class="bar ${done ? 'done' : ''}"><i style="width:${d.progress}%"></i></div>
      <div class="steps">${steps}</div>
      <div style="margin-top:8px;font-size:12px;color:#6B7280"><span class="live"></span>Aggiornamento automatico<span class="pct">${d.progress}%</span></div>`}
      ${eta}
      ${d.customer_note ? `<div class="note">💬 ${esc(d.customer_note)}</div>` : ''}
      ${warranty}
    </div>
    ${ask}
    <div class="card"><h2>Il tuo dispositivo</h2>
      <dl>
        <dt>Dispositivo</dt><dd>${esc(d.device.model)}</dd>
        ${d.device.serial_tail ? `<dt>Seriale</dt><dd>${esc(d.device.serial_tail)}</dd>` : ''}
        <dt>Problema</dt><dd>${esc(d.device.problem)}</dd>
        ${d.device.accessories ? `<dt>Accessori lasciati</dt><dd>${esc(d.device.accessories)}</dd>` : ''}
        ${d.device.condition ? `<dt>Condizioni</dt><dd>${esc(d.device.condition)}</dd>` : ''}
        <dt>Ricevuto il</dt><dd>${esc(fdt(d.received_at))}</dd>
      </dl>
    </div>
    <div class="card"><h2>I tuoi dati</h2>
      <dl><dt>Nome</dt><dd>${esc(d.customer.name)}</dd>
        ${d.customer.phone ? `<dt>Telefono</dt><dd>${esc(d.customer.phone)}</dd>` : ''}
        ${d.customer.email ? `<dt>Email</dt><dd>${esc(d.customer.email)}</dd>` : ''}</dl>
    </div>
    <div class="card"><h2>Preventivo</h2>
      ${d.quote == null ? '<p style="margin:0;color:#6B7280">Il preventivo sarà disponibile dopo la diagnosi.</p>' : `
      <div class="money">
        <div><b>${eur(d.final_price ?? d.quote)}</b><small>${d.final_price != null ? 'Totale' : 'Preventivo'}</small></div>
        <div><b>${eur(d.paid)}</b><small>Già versato</small></div>
        <div><b>${eur(d.balance)}</b><small>Da saldare</small></div>
      </div>`}
    </div>
    <div class="card"><h2>Cronologia</h2>
      <ul class="tl">${d.events.map((e) => `<li>${esc(e.note || '')}<small>${esc(fdt(e.created_at))}</small></li>`).join('')}</ul>
    </div>`;
  document.getElementById('foot').innerHTML = `${esc(d.shop.name)} · ${esc(d.shop.address)}<br>Tel. <a href="tel:${esc(d.shop.phone)}">${esc(d.shop.phone)}</a>`;
}

app.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-d]');
  if (!b) return;
  b.disabled = true;
  try {
    await fetch(`/api/track/${encodeURIComponent(token)}/decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accept: b.dataset.d === '1' }) });
  } finally { last = ''; load(); }
});

load();
setInterval(load, 8000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
