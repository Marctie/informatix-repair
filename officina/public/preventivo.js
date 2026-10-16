// Pagina pubblica del preventivo: il cliente lo legge e, se vuole, lo accetta o lo rifiuta firmando col dito.
// Si apre da /p/<codice> (link dato dal negozio). Nessun dato personale oltre al nome: niente telefono ne' email.
const token = location.pathname.split('/').pop();
const app = document.getElementById('app');
const ov = document.getElementById('ov');
const sheet = document.getElementById('sheet');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
const fdate = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fdt = (s) => new Date(String(s).replace(' ', 'T')).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

let DATA = null;
let pad = null;

async function load() {
  const r = await window.ClientErr.call(`/api/quote/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!r.ok) { app.innerHTML = '<div class="err"><div id="ld-err"></div></div>'; window.ClientErr.show(document.getElementById('ld-err'), r.error, load); return; }
  DATA = r.data;
  render(DATA);
}

function render(d) {
  document.title = `Preventivo ${d.code}`;
  document.getElementById('shop').textContent = d.shop.name;
  const badge = d.decision === 'accettato' ? '<span class="badge ok">Accettato</span>' : d.decision === 'rifiutato' ? '<span class="badge ko">Rifiutato</span>' : d.expired ? '<span class="badge ko">Scaduto</span>' : '';
  const left = d.days_left == null || d.days_left > 3 ? '' : ` (${d.days_left === 0 ? 'scade oggi' : d.days_left === 1 ? 'scade domani' : `restano ${d.days_left} giorni`})`;
  const valid = d.decision || d.status === 'convertito' ? '' : `<div class="valid">${d.expired ? 'Questo preventivo è <b>scaduto</b> il' : 'Valido fino a'} <b>${esc(fdate(d.valid_until))}</b>${d.expired ? '' : left}</div>`;
  let ask = '';
  if (d.can_answer) {
    ask = `<div class="card ask"><h2>Vuoi accettare?</h2><p style="margin:0">Se sei d'accordo, accetta e firma direttamente da qui: non serve stampare nulla.</p>
      <div class="btns"><button class="yes" data-act="accept">Sì, accetto</button><button class="no" data-act="decline">No, grazie</button></div></div>`;
  } else if (d.signed) {
    ask = `<div class="note done-note"><span>✔ ${d.signed.kind === 'accept' ? 'Hai accettato' : 'Hai rifiutato'} il preventivo e firmato il <b>${esc(fdt(d.signed.signed_at))}</b>. ${d.signed.kind === 'accept' ? 'Il negozio ti contatterà per i prossimi passi.' : ''}</span></div>`;
  } else if (d.decision) {
    ask = `<div class="note done-note"><span>Questo preventivo risulta ${esc(d.decision)}.</span></div>`;
  } else if (d.expired) {
    ask = `<div class="card ask"><p style="margin:0">Il preventivo è scaduto: chiamaci al <b>${esc(d.shop.phone)}</b> per aggiornarlo.</p></div>`;
  }
  app.innerHTML = `<div class="card"><h1>Preventivo ${esc(d.code)}</h1><div class="status">${esc(d.who)}</div>${badge}${valid}
      <table class="items" style="margin-top:12px"><tbody>${d.items.map((i) => `<tr><td>${i.qty > 1 ? `${i.qty} × ` : ''}${esc(i.description)}</td><td>${eur(i.total)}</td></tr>`).join('')}</tbody></table>
      ${d.discount ? `<div class="tot"><span>Sconto</span><span>-${eur(d.discount)}</span></div>` : ''}
      <div class="tot"><span>Totale</span><b>${eur(d.total)}</b></div>
      ${d.notes ? `<p class="hint" style="margin-top:10px"><b>Note:</b> ${esc(d.notes)}</p>` : ''}</div>
    ${ask}
    <div class="card"><h2>Condizioni</h2><p class="hint">${esc(d.terms)}</p></div>`;
  document.getElementById('foot').innerHTML = `${esc(d.shop.name)} · ${esc(d.shop.address)}<br>Tel. <a href="tel:${esc(d.shop.phone)}">${esc(d.shop.phone)}</a>`;
}

function openSheet(html) { sheet.innerHTML = html; ov.hidden = false; document.body.style.overflow = 'hidden'; sheet.scrollTop = 0; }
function closeSheet() { if (pad) { pad.destroy(); pad = null; } ov.hidden = true; sheet.innerHTML = ''; document.body.style.overflow = ''; load(); }
ov.addEventListener('mousedown', (e) => { if (e.target === ov && !sheet.querySelector('[data-busy]')) closeSheet(); });

const padHtml = (name) => `<div><label class="lbl" for="sg-name">Nome di chi firma</label><input class="inp" id="sg-name" value="${esc(name || '')}" autocomplete="name"></div>
  <div class="padbox"><label class="lbl">Firma qui sotto con il dito</label><canvas id="sg-canvas" aria-label="Riquadro della firma"></canvas>
    <div class="padtools"><span id="sg-hint">Firma non ancora disegnata.</span><button type="button" class="linkbtn" id="sg-clear">Cancella e rifai</button></div></div>`;
function startPad(ready) {
  pad = window.SigPad.create(document.getElementById('sg-canvas'), { onChange: (empty) => { document.getElementById('sg-hint').textContent = empty ? 'Firma non ancora disegnata.' : 'Firma acquisita.'; ready(); } });
  setTimeout(() => pad.refit(), 60);
  document.getElementById('sg-clear').onclick = () => pad.clear();
}

function ask(action) {
  const yes = action === 'accept';
  const text = yes ? `Accetto il preventivo ${DATA.code} di ${eur(DATA.total)}, valido fino al ${fdate(DATA.valid_until)}, alle condizioni indicate.` : `Non accetto il preventivo ${DATA.code} di ${eur(DATA.total)}.`;
  openSheet(`<h3>${yes ? 'Conferma e firma' : 'Rifiuta il preventivo'}</h3><div class="legal"><div>${esc(text)}</div>${yes ? `<small>${esc(DATA.terms)}</small>` : ''}</div>${yes ? '' : '<div><label class="lbl" for="sg-why">Vuoi dirci il motivo? (facoltativo)</label><input class="inp" id="sg-why" maxlength="300" placeholder="es. prezzo troppo alto, ho trovato altrove…"></div>'}${padHtml(DATA.who)}
    <div id="sh-err"></div><div class="btns"><button class="no" id="sh-back">Annulla</button><button class="yes" id="sh-go" disabled>${yes ? 'Firma e accetta' : 'Firma e rifiuta'}</button></div>`);
  const go = document.getElementById('sh-go');
  startPad(() => { go.disabled = !(pad && !pad.isEmpty()); });
  document.getElementById('sh-back').onclick = closeSheet;
  go.onclick = async () => {
    go.disabled = true;
    go.setAttribute('data-busy', '1');
    const hostErr = document.getElementById('sh-err');
    if (hostErr) hostErr.innerHTML = '';
    const r = await window.ClientErr.call(`/api/quote/${encodeURIComponent(token)}/decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, image: pad.toDataURL(), signer_name: document.getElementById('sg-name').value, reason: document.getElementById('sg-why')?.value || '' }) });
    if (!r.ok) {
      // la firma resta sul riquadro: il cliente non deve rifarla
      window.ClientErr.show(hostErr, r.error, r.error.retry ? () => go.click() : null);
      go.disabled = false;
      go.removeAttribute('data-busy');
      return;
    }
    {
      if (pad) { pad.destroy(); pad = null; }
      openSheet(`<h3>${yes ? 'Preventivo accettato' : 'Risposta registrata'}</h3><div class="legal"><div>${yes ? 'Grazie! Abbiamo registrato la tua accettazione e la tua firma con data e ora. Ti contatteremo a breve.' : 'Abbiamo registrato il tuo rifiuto. Per qualsiasi dubbio chiamaci.'}</div></div><div class="btns"><button class="yes" id="sh-ok">Chiudi</button></div>`);
      document.getElementById('sh-ok').onclick = closeSheet;
    }
  };
}
app.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b && DATA) ask(b.dataset.act); });
load();
