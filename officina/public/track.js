// Pagina di tracciamento per il cliente: si aggiorna da sola ogni 8 secondi.
// Dal link il cliente puo' anche: firmare la scheda di ingresso (se il negozio l'ha chiesto) e rispondere al preventivo
// (conferma, scelta fra opzioni, rifiuto con scelta del destino del dispositivo), sempre con firma disegnata.
const token = location.pathname.split('/').pop();
const app = document.getElementById('app');
const ov = document.getElementById('ov');
const sheet = document.getElementById('sheet');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
const fdate = (s) => (s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '').replace(' ', 'T')).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : null);
const fdt = (s) => new Date(s.replace(' ', 'T')).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let last = '';
let DATA = null;
let modalOpen = false; // mentre il cliente sta firmando non si ridisegna la pagina
let pad = null;

async function load() {
  const r = await window.ClientErr.call(`/api/track/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!r.ok) {
    // un errore di rete non cancella cio' che il cliente sta gia' vedendo: lo mostriamo solo se la pagina e' ancora vuota
    if (!DATA) { app.innerHTML = '<div class="err"><div id="ld-err"></div></div>'; window.ClientErr.show(document.getElementById('ld-err'), r.error, load); }
    return;
  }
  const d = r.data;
  DATA = d;
  const sig = JSON.stringify(d);
  if (sig !== last && !modalOpen) { last = sig; render(d); }
}

function render(d) {
  document.title = `${d.code} · ${d.status_label}`;
  document.getElementById('shop').textContent = d.shop.name;
  const done = d.status === 'delivered' || d.status === 'ready';
  const steps = d.steps.map((l, i) => `<div class="${i <= d.step ? 'on' : ''} ${i === d.step ? 'now' : ''} ${i < d.step || d.status === 'delivered' ? 'done' : ''}"><i></i>${esc(l)}</div>`).join('');
  const eta = d.eta_date && !['delivered', 'cancelled'].includes(d.status)
    ? `<div class="eta"><span class="ico-cal"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span><div><small style="color:#6B7280">Consegna stimata</small><br><b>${esc(fdate(d.eta_date))}</b></div></div>` : '';
  app.innerHTML = `
    <div class="card">
      <h1>Riparazione ${esc(d.code)}</h1>
      <div class="status">${esc(d.status_label)}</div>
      <p class="hint">${esc(d.status_hint)}</p>
      ${d.cancelled ? '' : `<div class="bar ${done ? 'done' : ''}"><i style="width:${d.progress}%"></i></div>
      <div class="steps">${steps}</div>
      <div style="margin-top:8px;font-size:12px;color:#6B7280"><span class="live"></span>Aggiornamento automatico<span class="pct ${done ? 'ok' : ''}">${d.progress}%</span></div>`}
      ${eta}
      ${d.customer_note ? `<div class="note"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg><span>${esc(d.customer_note)}</span></div>` : ''}
      ${d.status === 'delivered' && d.warranty_days ? `<div class="note"><span>Questa riparazione è coperta da garanzia di <b>${d.warranty_days} giorni</b> dalla consegna.</span></div>` : ''}
    </div>
    ${decisionCard(d)}
    ${d.intake_sign ? `<div class="card ask"><h2>Firma la scheda di ingresso</h2>
        <p style="margin:0">Il negozio ti chiede di leggere le condizioni e firmare la scheda del tuo dispositivo, direttamente da qui: non serve scaricare né rimandare nessun PDF.</p>
        <div class="btns"><button class="yes" data-act="intake">Leggi e firma</button></div></div>`
      : d.intake_signed_at ? `<div class="note done-note"><span>✔ Scheda di ingresso firmata il <b>${esc(fdt(d.intake_signed_at))}</b>.</span></div>` : ''}
    <div class="card"><h2>Il tuo dispositivo</h2>
      <dl>
        <dt>Dispositivo</dt><dd>${esc(d.device.model)}${d.device.color ? ` · ${esc(d.device.color)}` : ''}</dd>
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

// Riquadro "serve la tua risposta" / esito della risposta già data
function decisionCard(d) {
  const f = d.quote_flow;
  if (d.awaiting_decision && f) {
    if (f.options.length) {
      return `<div class="card ask"><h2>Scegli come procedere</h2>
        <p style="margin:0 0 10px">Per la riparazione ci sono più soluzioni: scegli quella che preferisci, poi confermi e firmi.</p>
        <div class="stack">${f.options.map((o, i) => `<label class="opt"><input type="radio" name="qopt" value="${o.id}" ${i === 0 ? 'checked' : ''}><span><b>${esc(o.label)} · ${eur(o.amount)}</b>${o.discount > 0 ? `<small>Prezzo ${eur(o.list_amount)}, sconto ${o.discount_pct != null ? `${o.discount_pct}% ` : ''}-${eur(o.discount)}</small>` : ''}${o.mode === 'net' ? `<small>Imponibile ${eur(o.net)} + IVA ${o.vat_rate}% ${eur(o.vat)} = ${eur(o.amount)} IVA inclusa</small>` : ''}${o.description ? esc(o.description) : ''}</span></label>`).join('')}</div>
        <div class="btns"><button class="yes" data-act="option">Scelgo questa soluzione</button><button class="no" data-act="decline">No, grazie</button></div></div>`;
    }
    return `<div class="card ask"><h2>Serve la tua conferma</h2>
        <p style="margin:0">Il preventivo per la riparazione è di <b>${eur(d.quote)}</b>${d.quote_price?.discount > 0 ? ` (prezzo ${eur(d.quote_price.list)}, sconto ${d.quote_price.discount_pct != null ? `${d.quote_price.discount_pct}% ` : ''}-${eur(d.quote_price.discount)})` : ''}${d.quote_price?.mode === 'net' ? ` IVA inclusa (imponibile ${eur(d.quote_price.net)} + IVA ${d.quote_price.rate}% ${eur(d.quote_price.vat)})` : ''}. Vuoi procedere?</p>
        <div class="btns"><button class="yes" data-act="accept">Sì, procedi</button><button class="no" data-act="decline">No, grazie</button></div></div>`;
  }
  const m = d.my_decision;
  if (m) {
    const txt = m.action === 'decline'
      ? `Hai rifiutato il preventivo${m.choice === 'cede' ? ' e ceduto il dispositivo al negozio' : ' e ritirerai il dispositivo non riparato'}.`
      : m.action === 'option' ? `Hai scelto: <b>${esc(m.option_label || '')}</b> e confermato il preventivo.` : 'Hai confermato il preventivo.';
    return `<div class="note done-note"><span>✔ ${txt} Firmato il <b>${esc(fdt(m.signed_at))}</b>.</span></div>`;
  }
  if (d.quote_decision === 'declined' && d.status === 'quote_pending') {
    return `<div class="card ask"><p style="margin:0">Hai rifiutato il preventivo. Ti contatteremo a breve, oppure chiamaci al <b>${esc(d.shop.phone)}</b>.</p></div>`;
  }
  return '';
}

// ---------- Finestre (conferma e firma) ----------
function openSheet(html) {
  sheet.innerHTML = html;
  ov.hidden = false;
  modalOpen = true;
  document.body.style.overflow = 'hidden';
  sheet.scrollTop = 0;
}
function closeSheet() {
  if (pad) { pad.destroy(); pad = null; }
  ov.hidden = true;
  sheet.innerHTML = '';
  modalOpen = false;
  document.body.style.overflow = '';
  last = '';
  load();
}
ov.addEventListener('mousedown', (e) => { if (e.target === ov && !sheet.querySelector('[data-busy]')) closeSheet(); });

const legalBox = (text, extra = '') => `<div class="legal"><div>${esc(text)}</div>${extra}${DATA?.quote_flow?.draft || DATA?.intake_sign?.draft ? '<small class="draft">Testo in bozza, in corso di verifica da parte del negozio.</small>' : ''}</div>`;
const padHtml = (name) => `<div><label class="lbl" for="sg-name">Nome di chi firma</label><input class="inp" id="sg-name" value="${esc(name || '')}" autocomplete="name"></div>
  <div class="padbox"><label class="lbl">Firma qui sotto con il dito</label><canvas id="sg-canvas" aria-label="Riquadro della firma"></canvas>
    <div class="padtools"><span id="sg-hint">Firma non ancora disegnata.</span><button type="button" class="linkbtn" id="sg-clear">Cancella e rifai</button></div></div>`;

/** Disegna il riquadro firma; ready() viene richiamato a ogni cambio per abilitare il pulsante. */
function startPad(ready) {
  const canvas = document.getElementById('sg-canvas');
  pad = window.SigPad.create(canvas, { onChange: (empty) => { document.getElementById('sg-hint').textContent = empty ? 'Firma non ancora disegnata.' : 'Firma acquisita.'; ready(); } });
  setTimeout(() => pad.refit(), 60);
  document.getElementById('sg-clear').onclick = () => pad.clear();
}

async function send(path, body, btn) {
  btn.disabled = true;
  btn.setAttribute('data-busy', '1');
  const hostErr = document.getElementById('sh-err');
  if (hostErr) hostErr.innerHTML = '';
  const r = await window.ClientErr.call(`/api/track/${encodeURIComponent(token)}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) return r.data;
  // la firma resta sul riquadro: il cliente non deve rifarla
  window.ClientErr.show(hostErr, r.error, r.error.retry ? () => btn.click() : null);
  btn.disabled = false;
  btn.removeAttribute('data-busy');
  return null;
}

function doneSheet(title, text) {
  openSheet(`<h3>${esc(title)}</h3><div class="legal"><div>${text}</div></div><div class="btns"><button class="yes" id="sh-ok">Chiudi</button></div>`);
  document.getElementById('sh-ok').onclick = closeSheet;
}

// Firma della scheda di ingresso (a distanza)
function askIntake(d) {
  const s = d.intake_sign;
  openSheet(`<h3>Firma la scheda di ingresso</h3>${legalBox(s.text, `<small><b>Condizioni:</b> ${esc(s.terms)}</small>`)}
    <label class="chk"><input type="checkbox" id="sg-acc"><span>Ho letto le condizioni e le accetto.</span></label>
    ${padHtml(d.customer.name)}
    <div id="sh-err"></div><div class="btns"><button class="no" id="sh-back">Annulla</button><button class="yes" id="sh-go" disabled>Firma e conferma</button></div>`);
  const go = document.getElementById('sh-go');
  const ready = () => { go.disabled = !(pad && !pad.isEmpty() && document.getElementById('sg-acc').checked); };
  document.getElementById('sg-acc').onchange = ready;
  startPad(ready);
  document.getElementById('sh-back').onclick = closeSheet;
  go.onclick = async () => {
    const out = await send('sign', { accept: true, image: pad.toDataURL(), signer_name: document.getElementById('sg-name').value }, go);
    if (out) doneSheet('Scheda firmata', 'Grazie! La tua firma è stata registrata insieme a data e ora. Il negozio la vede subito nella tua scheda.');
  };
}

// Sì / scelta di un'opzione: conferma -> firma
function askAccept(d, optionId) {
  const f = d.quote_flow;
  const opt = optionId ? f.options.find((o) => String(o.id) === String(optionId)) : null;
  const amountText = opt ? opt.amount_text : f.quote_text;
  const text = f.accept.text.replace('{importo}', amountText) + (opt ? `\n\nSoluzione scelta: ${opt.label}.` : '');
  openSheet(`<h3>${esc(f.accept.title)}</h3>${legalBox(text)}
    <div id="sh-err"></div><div class="btns"><button class="no" id="sh-back">Torna indietro</button><button class="yes" id="sh-next">Conferma</button></div>`);
  document.getElementById('sh-back').onclick = closeSheet;
  document.getElementById('sh-next').onclick = () => {
    openSheet(`<h3>Firma per confermare</h3>${legalBox(f.sign_text)}${padHtml(d.customer.name)}
      <div id="sh-err"></div><div class="btns"><button class="no" id="sh-back2">Indietro</button><button class="yes" id="sh-go" disabled>Firma e conferma</button></div>`);
    const go = document.getElementById('sh-go');
    startPad(() => { go.disabled = !(pad && !pad.isEmpty()); });
    document.getElementById('sh-back2').onclick = () => { pad.destroy(); pad = null; askAccept(d, optionId); };
    go.onclick = async () => {
      const out = await send('decision', { action: opt ? 'option' : 'accept', option_id: opt ? opt.id : undefined, image: pad.toDataURL(), signer_name: document.getElementById('sg-name').value }, go);
      if (out) doneSheet('Preventivo confermato', 'Grazie! Abbiamo registrato la tua conferma e la tua firma con data e ora. Iniziamo i lavori.');
    };
  };
}

// No: conferma + scelta del destino del dispositivo -> firma
function askDecline(d) {
  const f = d.quote_flow;
  openSheet(`<h3>${esc(f.decline.title)}</h3>${legalBox(f.decline.text)}
    <div class="stack">
      <label class="opt"><input type="radio" name="dev" value="pickup" checked><span>${esc(f.decline.pickup)}</span></label>
      <label class="opt"><input type="radio" name="dev" value="cede"><span>${esc(f.decline.cede)}</span></label>
    </div>
    <div id="sh-err"></div><div class="btns"><button class="no" id="sh-back">Torna indietro</button><button class="yes" id="sh-next">Conferma la scelta</button></div>`);
  document.getElementById('sh-back').onclick = closeSheet;
  document.getElementById('sh-next').onclick = () => {
    const choice = document.querySelector('input[name="dev"]:checked').value;
    openSheet(`<h3>Firma per confermare</h3>${legalBox(choice === 'cede' ? f.decline.cede : f.decline.pickup, `<small>${esc(f.sign_text)}</small>`)}${padHtml(d.customer.name)}
      <div id="sh-err"></div><div class="btns"><button class="no" id="sh-back2">Indietro</button><button class="yes" id="sh-go" disabled>Firma e conferma</button></div>`);
    const go = document.getElementById('sh-go');
    startPad(() => { go.disabled = !(pad && !pad.isEmpty()); });
    document.getElementById('sh-back2').onclick = () => { pad.destroy(); pad = null; askDecline(d); };
    go.onclick = async () => {
      const out = await send('decision', { action: 'decline', device_choice: choice, image: pad.toDataURL(), signer_name: document.getElementById('sg-name').value }, go);
      if (out) doneSheet('Scelta registrata', choice === 'cede' ? 'Abbiamo registrato il rifiuto del preventivo e la cessione del dispositivo, con la tua firma e data e ora.' : `Abbiamo registrato il rifiuto del preventivo. Il dispositivo ti aspetta in negozio: passa a ritirarlo entro ${f.storage_days} giorni.`);
    };
  };
}

app.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b || !DATA) return;
  switch (b.dataset.act) {
    case 'intake': return askIntake(DATA);
    case 'accept': return askAccept(DATA, null);
    case 'option': return askAccept(DATA, (document.querySelector('input[name="qopt"]:checked') || {}).value);
    case 'decline': return askDecline(DATA);
  }
});

load();
setInterval(load, 8000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
