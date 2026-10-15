// "Blacks": clienti segnalati. Elenco gestibile, segnalazione da scheda cliente, avvisi evidenti in nuova riparazione e vendita.
// Uso interno: non compare mai nelle pagine del cliente. Rimuovere una segnalazione e' solo dell'amministratore.
import { $, esc, fdate, api, toast, safe, debounce, openModal, today } from './util.js';
import { META } from './util.js';

const isAdmin = () => META.role === 'admin';
const STYLE = 'background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;border-radius:.75rem;padding:.6rem .8rem;font-size:.85rem';

/** Riquadro rosso con le segnalazioni che corrispondono (vuoto se non ce ne sono). */
export function blackBanner(matches) {
  if (!matches?.length) return '';
  return matches.map((b) => `<div role="alert" style="${STYLE};margin-top:.5rem"><b>⛔ CLIENTE SEGNALATO (Blacks)</b> · ${esc(b.name)}${b.match && b.match !== 'cliente' ? ` <span style="opacity:.8">(stesso ${esc(b.match)})</span>` : ''}<br>${esc(b.reason)}${b.note ? ` — ${esc(b.note)}` : ''} <span style="opacity:.8">· dal ${esc(fdate(b.reported_on))}</span><br><small>Procedi con cautela (anticipo, pagamento subito). Se la segnalazione non è più valida, l’amministratore può rimuoverla da «Blacks».</small></div>`).join('');
}

/** Finestra di avviso dopo la creazione di una scheda o di una vendita. */
export function showBlackAlert(matches) {
  if (!matches?.length) return;
  openModal(`<div class="sec">${blackBanner(matches)}</div>`, { title: 'Attenzione: cliente segnalato', footer: '<button class="btn btn-primary" data-close>Ho capito</button>' });
}

/** Controllo in diretta mentre si compila: `get()` restituisce {customer_id, name, phone, email}; il risultato va nel box. */
export function watchBlack(box, get) {
  const run = debounce(async () => {
    const p = get();
    const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString();
    if (!qs || (!p.customer_id && (p.name || '').length < 3 && (p.phone || '').replace(/\D/g, '').length < 7)) { box.innerHTML = ''; return; }
    const out = await safe(() => api('GET', `/api/blacklist/check?${qs}`));
    if (box.isConnected) box.innerHTML = blackBanner(out?.matches);
  }, 350);
  return run;
}

let REASONS = null;
async function reasons() {
  if (!REASONS) REASONS = (await safe(() => api('GET', '/api/blacklist/meta')))?.reasons || ['Altro'];
  return REASONS;
}

/** Segnala un cliente (c = cliente registrato) oppure una persona nuova (c = null); `b` = segnalazione da modificare. */
export async function reportDialog({ customer = null, black = null, done } = {}) {
  const list = await reasons();
  const v = black || {};
  const m = openModal(
    `<div class="sec"><div class="fgrid c2">
        <div class="field span2"><label class="l" for="bk-name">Nome *</label><input id="bk-name" value="${esc(v.name || customer?.name || '')}" ${customer ? 'readonly' : ''} /></div>
        <div class="field"><label class="l" for="bk-phone">Telefono</label><input id="bk-phone" inputmode="tel" value="${esc(v.phone || customer?.phone || '')}" /></div>
        <div class="field"><label class="l" for="bk-email">Email</label><input id="bk-email" type="email" value="${esc(v.email || customer?.email || '')}" /></div>
        <div class="field"><label class="l" for="bk-reason">Motivo *</label><input id="bk-reason" list="bk-reasons" value="${esc(v.reason || '')}" placeholder="scegli o scrivi" /><datalist id="bk-reasons">${list.map((r) => `<option value="${esc(r)}"></option>`).join('')}</datalist></div>
        <div class="field"><label class="l" for="bk-date">Data della segnalazione</label><input id="bk-date" type="date" max="${today()}" value="${esc(v.reported_on || today())}" /></div>
        <div class="field span2"><label class="l" for="bk-note">Nota</label><textarea id="bk-note" rows="3" placeholder="Cosa è successo (importi, riparazione, date…)">${esc(v.note || '')}</textarea></div>
      </div>
      <p class="hint">Elenco interno: non lo vede nessun cliente. Ogni segnalazione e ogni modifica restano scritte nel Registro.</p></div>`,
    { title: black ? 'Modifica segnalazione' : 'Segnala cliente', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="bk-ok">Salva</button>' }
  );
  $('#bk-ok', m.el).onclick = async () => {
    const g = (id) => $(`#${id}`, m.el).value;
    const body = { name: g('bk-name'), phone: g('bk-phone'), email: g('bk-email'), reason: g('bk-reason'), reported_on: g('bk-date'), note: g('bk-note') };
    if (customer) body.customer_id = customer.id;
    const out = await safe(() => (black ? api('PUT', `/api/blacklist/${black.id}`, body) : api('POST', '/api/blacklist', body)));
    if (out) { m.close(); toast(black ? 'Segnalazione aggiornata' : 'Cliente segnalato'); done?.(); }
  };
}

function removeDialog(b, done) {
  const m = openModal(`<div class="sec"><p>Stai togliendo <b>${esc(b.name)}</b> dall’elenco dei segnalati. Non viene cancellato: resta nello storico con il motivo che scrivi qui.</p>
    <div class="field"><label class="l" for="bk-why">Perché la rimuovi? *</label><input id="bk-why" placeholder="es. ha saldato il debito" /></div></div>`,
  { title: 'Rimuovere dai Blacks?', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="bk-rm">Rimuovi</button>' });
  $('#bk-rm', m.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/blacklist/${b.id}/remove`, { removed_note: $('#bk-why', m.el).value }));
    if (out) { m.close(); toast('Segnalazione rimossa'); done?.(); }
  };
}

export async function blacksView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Blacks <span class="hint" style="font-weight:500">clienti segnalati</span></h1>
      <button class="btn btn-primary" id="bk-new">＋ Segnala una persona</button></div>
    <div class="row tight" style="align-items:center"><input id="bk-q" type="search" placeholder="Cerca per nome, telefono, motivo…" style="flex:1;min-width:12rem" />
      <label class="check"><input type="checkbox" id="bk-all" /> Mostra anche le rimosse</label></div>
    <div class="card overflow-hidden" id="bk-list"></div>
    <p class="hint">Elenco interno. All’apertura di una nuova scheda o di una vendita il gestionale avvisa se la persona (stesso cliente, telefono, email o nome) è qui dentro. Per segnalare un cliente già registrato usa «Segnala» nella sua scheda.</p>`;
  const list = $('#bk-list', el);
  let rows = [];
  async function load() {
    const qs = new URLSearchParams({ q: $('#bk-q', el).value.trim(), all: $('#bk-all', el).checked ? '1' : '' });
    rows = (await safe(() => api('GET', `/api/blacklist?${qs}`))) || [];
    list.innerHTML = rows.map((b) => `<div class="px-4 py-3 border-b border-line last:border-0" style="${b.active ? '' : 'opacity:.6'}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:.75rem;flex-wrap:wrap">
        <div class="min-w-0"><b>${esc(b.name)}</b> ${b.active ? '<span class="badge" style="background:#FEE2E2;color:#991B1B">Segnalato</span>' : '<span class="badge bg-gray-200 text-gray-600">Rimosso</span>'}
          <div class="text-xs text-gray-500">${esc([b.phone, b.email].filter(Boolean).join(' · ') || 'nessun contatto')}</div>
          <div class="text-sm" style="margin-top:.2rem">${esc(b.reason)}${b.note ? ` — ${esc(b.note)}` : ''}</div>
          <div class="text-xs text-gray-500">dal ${esc(fdate(b.reported_on))}${b.reported_by ? ` · da ${esc(b.reported_by)}` : ''}${b.active ? '' : ` · rimosso da ${esc(b.removed_by || '')}: ${esc(b.removed_note || '')}`}</div></div>
        <div class="row tight">${b.active ? `<button class="btn btn-outline btn-sm" data-edit="${b.id}">Modifica</button>${isAdmin() ? `<button class="btn btn-ghost btn-sm" data-rm="${b.id}">Rimuovi</button>` : ''}` : (isAdmin() ? `<button class="btn btn-outline btn-sm" data-restore="${b.id}">Ripristina</button>` : '')}</div>
      </div></div>`).join('') || '<p class="empty">Nessun cliente segnalato.</p>';
  }
  $('#bk-q', el).oninput = debounce(load);
  $('#bk-all', el).onchange = load;
  $('#bk-new', el).onclick = () => reportDialog({ done: load });
  list.onclick = async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const find = (id) => rows.find((x) => x.id === Number(id));
    if (t.dataset.edit) return reportDialog({ black: find(t.dataset.edit), done: load });
    if (t.dataset.rm) return removeDialog(find(t.dataset.rm), load);
    if (t.dataset.restore) { const out = await safe(() => api('POST', `/api/blacklist/${t.dataset.restore}/restore`, {})); if (out) { toast('Segnalazione ripristinata'); load(); } }
  };
  await load();
}
