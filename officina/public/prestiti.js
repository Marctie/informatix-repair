// Dispositivi in prestito / muletto: elenco dentro "Dispositivi", sezione nella scheda riparazione, avviso se non rientra.
import { $, esc, fdate, api, toast, safe, debounce, openModal, confirmDelete, today } from './util.js';
import { customerField, bindCustomer } from './pickers.js';
import { repairPicker, repairField } from './esterne.js';
import { openRepairDetail } from './repair.js';

const statusBadge = (l) => (l.status === 'rientrato' ? '<span class="badge b-ok">Rientrato</span>'
  : l.repair_done ? '<span class="badge b-bad">⚠ Riparazione chiusa: da restituire</span>'
    : l.late ? `<span class="badge b-bad">⏰ Scaduto da ${l.late_days} g</span>` : '<span class="badge b-warn">In prestito</span>');
const dueText = (l) => (l.status === 'rientrato' ? `rientrato il ${fdate(l.returned_at)}` : l.due_at ? `da restituire entro il <span class="${l.late ? 'late-t' : ''}">${fdate(l.due_at)}</span>` : 'senza scadenza');
const btns = (l) => `<div class="rowact">${l.status === 'prestato' ? `<button class="btn btn-green btn-sm" data-la="back" data-lid="${l.id}">✔ Rientrato</button>` : `<button class="btn btn-outline btn-sm" data-la="reopen" data-lid="${l.id}">Riapri</button>`}
  <button class="btn btn-outline btn-sm" data-la="edit" data-lid="${l.id}">Modifica</button><button class="btn btn-ghost btn-sm" data-la="del" data-lid="${l.id}" aria-label="Elimina">Elimina</button></div>`;

// ---------- Modulo ----------
export async function loanForm(l, done, { repair = null } = {}) {
  const v = l || {};
  const dlg = openModal(
    `<div class="sec">
      ${repair ? `<p class="hint">Riparazione del cliente: <b>${esc(repair.code)} · ${esc(repair.brand_model)}</b> (${esc(repair.customer_name)})</p>` : l?.repair_id ? '' : ''}
      ${repair ? '' : repairField('lf-rep', 'Riparazione del cliente').replace(' *', '')}
      ${repair || l?.repair_id ? '' : customerField('lf-cust', 'Oppure solo il cliente')}
      <div class="field"><label class="l" for="lf-dev-q">Muletto dal registro Dispositivi</label>
        <input id="lf-dev-q" type="search" placeholder="Cerca per modello o seriale…" autocomplete="off" /><select id="lf-dev" aria-label="Muletto"></select></div>
      <div class="field"><label class="l" for="lf-label">…oppure descrivilo a mano *</label><input id="lf-label" value="${esc(v.label || '')}" placeholder="Es. Samsung A13 nero con caricatore" /></div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="lf-lent">Consegnato il</label><input id="lf-lent" type="date" value="${esc(v.lent_at || today())}" /></div>
        <div class="field"><label class="l" for="lf-due">Da restituire entro</label><input id="lf-due" type="date" value="${esc(v.due_at || repair?.eta_date || '')}" /><span class="hint">Vuoto: vale la consegna stimata della riparazione.</span></div>
        <div class="field span2"><label class="l" for="lf-cond">Com’è quando esce (graffi, accessori dati)</label><input id="lf-cond" value="${esc(v.condition_out || '')}" /></div>
        <div class="field span2"><label class="l" for="lf-notes">Note</label><input id="lf-notes" value="${esc(v.notes || '')}" /></div>
      </div></div>`,
    { title: l ? 'Modifica prestito' : 'Nuovo prestito (muletto)', wide: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="lf-ok">Salva</button>' }
  );
  const rep = repair || l?.repair_id ? null : repairPicker(dlg.el, 'lf-rep');
  const cust = repair || l?.repair_id ? null : bindCustomer(dlg.el, 'lf-cust', l?.customer_id || null);
  const dev = $('#lf-dev', dlg.el);
  async function loadDev(q = '') {
    const rows = (await safe(() => api('GET', `/api/prestiti/disponibili?q=${encodeURIComponent(q)}`))) || [];
    const opts = rows.map((d) => `<option value="${d.id}">${esc(d.brand_model)}${d.serial ? ` · ${esc(d.serial)}` : ''}</option>`);
    if (v.device_id && !rows.some((d) => d.id === v.device_id)) opts.unshift(`<option value="${v.device_id}">${esc(v.label)}</option>`);
    dev.innerHTML = '<option value="">— nessuno, scrivo a mano —</option>' + opts.join('');
    if (v.device_id) dev.value = String(v.device_id);
  }
  $('#lf-dev-q', dlg.el).oninput = debounce((e) => loadDev(e.target.value.trim()));
  loadDev();
  $('#lf-ok', dlg.el).onclick = async () => {
    const g = (k) => $(`#${k}`, dlg.el)?.value;
    const body = { repair_id: repair?.id || l?.repair_id || rep?.value() || null, customer_id: cust?.value() || l?.customer_id || null, device_id: dev.value || null, label: g('lf-label'), lent_at: g('lf-lent'), due_at: g('lf-due'), condition_out: g('lf-cond'), notes: g('lf-notes') };
    const out = await safe(() => (l ? api('PUT', `/api/prestiti/${l.id}`, body) : api('POST', '/api/prestiti', body)));
    if (out) { dlg.close(); toast('Prestito salvato'); done?.(out); }
  };
}

function backDialog(l, done) {
  const dlg = openModal(
    `<div class="sec"><p><b>${esc(l.label)}</b> restituito${l.customer_name ? ` da ${esc(l.customer_name)}` : ''}.</p>
      <div class="fgrid c2"><div class="field"><label class="l" for="bk-date">Data di rientro</label><input id="bk-date" type="date" value="${today()}" /></div>
        <div class="field"><label class="l" for="bk-cond">Com’è rientrato</label><input id="bk-cond" placeholder="Es. tutto ok, graffio sul retro" /></div></div></div>`,
    { title: 'Muletto rientrato', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-green" id="bk-ok">✔ Registra il rientro</button>' }
  );
  $('#bk-ok', dlg.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/prestiti/${l.id}/rientro`, { returned_at: $('#bk-date', dlg.el).value, condition_back: $('#bk-cond', dlg.el).value }));
    if (out) { dlg.close(); toast('Rientro registrato'); done?.(); }
  };
}

async function action(l, act, done) {
  if (act === 'back') backDialog(l, done);
  else if (act === 'edit') loanForm(l, done);
  else if (act === 'reopen') { if (await safe(() => api('POST', `/api/prestiti/${l.id}/riapri`, {}))) { toast('Prestito riaperto'); done(); } }
  else if (act === 'del' && (await confirmDelete(l.label, { detail: 'Si toglie la registrazione del prestito.' }))) {
    if (await safe(() => api('DELETE', `/api/prestiti/${l.id}`))) { toast('Eliminato'); done(); }
  }
}

// ---------- Pannello dentro "Dispositivi" ----------
export async function prestitiPanel(el) {
  let stato = 'fuori';
  let q = '';
  el.innerHTML = `
    <div class="row" style="justify-content:space-between"><p class="hint" style="flex:1 1 18rem;margin:0">Muletti dati ai clienti mentre il loro dispositivo è in riparazione. Se non rientrano entro la scadenza (o a riparazione chiusa) compare un avviso in campanella e in “Oggi”.</p>
      <button class="btn btn-primary" id="pr-new">＋ Nuovo prestito</button></div>
    <div class="row tight chips-scroll" id="pr-chips"></div>
    <input id="pr-q" type="search" placeholder="Cerca muletto, cliente, scheda…" aria-label="Cerca prestiti" />
    <div class="card overflow-hidden" id="pr-list"></div>`;
  const list = $('#pr-list', el);
  async function load() {
    const d = await safe(() => api('GET', `/api/prestiti?stato=${stato}&q=${encodeURIComponent(q)}`));
    if (!d || !$('#pr-list', el)) return;
    $('#pr-chips', el).innerHTML = [['fuori', 'In prestito', d.out], ['scaduti', '⏰ Scaduti', d.late], ['rientrati', 'Rientrati', d.back], ['tutti', 'Tutti', d.out + d.back]]
      .map(([k, l, n]) => `<span class="chip ${k === 'scaduti' ? 'chip-red ' : ''}${stato === k ? 'on' : ''}" data-st="${k}">${l}${n ? `<small>${n}</small>` : ''}</span>`).join('');
    if (!d.rows.length) { list.innerHTML = '<p class="empty">Nessun prestito qui.</p>'; return; }
    list.innerHTML =
      `<div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Muletto</th><th>Cliente</th><th>Riparazione</th><th>Consegna / rientro</th><th>Stato</th><th></th></tr></thead><tbody>` +
      d.rows.map((l) => `<tr class="row-h"><td><b>${esc(l.label)}</b>${l.device_serial ? `<div class="hint">${esc(l.device_serial)}</div>` : ''}</td><td>${esc(l.customer_name || '—')}${l.customer_phone ? `<div class="hint">${esc(l.customer_phone)}</div>` : ''}</td>
        <td>${l.repair_id ? `<a href="#" data-rid="${l.repair_id}"><b>${esc(l.repair_code)}</b></a> ${esc(l.repair_model || '')}` : '—'}</td><td>dal ${fdate(l.lent_at)}<div class="hint">${dueText(l)}</div></td><td>${statusBadge(l)}</td><td>${btns(l)}</td></tr>`).join('') +
      '</tbody></table></div>' +
      `<div class="only-narrow">${d.rows.map((l) => `<div class="pcard"><div class="top"><span class="name">${esc(l.label)}</span>${statusBadge(l)}</div>
        <div class="sub">${esc(l.customer_name || '—')}${l.customer_phone ? ` · ${esc(l.customer_phone)}` : ''}${l.repair_id ? ` · <a href="#" data-rid="${l.repair_id}">${esc(l.repair_code)}</a>` : ''}</div>
        <div class="sub">dal ${fdate(l.lent_at)} · ${dueText(l)}</div>${btns(l)}</div>`).join('')}</div>`;
    list._rows = Object.fromEntries(d.rows.map((l) => [l.id, l]));
  }
  $('#pr-chips', el).onclick = (ev) => { const c = ev.target.closest('[data-st]'); if (c) { stato = c.dataset.st; load(); } };
  $('#pr-q', el).oninput = debounce((ev) => { q = ev.target.value.trim(); load(); });
  list.onclick = (ev) => {
    const a = ev.target.closest('[data-la]');
    if (a) return action(list._rows[a.dataset.lid], a.dataset.la, load);
    const r = ev.target.closest('[data-rid]');
    if (r) { ev.preventDefault(); openRepairDetail(Number(r.dataset.rid), load); }
  };
  $('#pr-new', el).onclick = () => loanForm(null, load);
  await load();
}

// ---------- Sezione nella scheda riparazione ----------
export async function repairLoans(box, r, reload) {
  const d = await safe(() => api('GET', `/api/prestiti?stato=tutti&repair_id=${r.id}`));
  if (!d || !box.isConnected) return;
  box.innerHTML = `<section class="sec"><h3 class="sec-t">Muletto in prestito</h3>
    ${d.rows.length ? `<div class="xsec-list">${d.rows.map((l) => `<div class="xitem"><div class="top"><span class="ttl">${esc(l.label)}</span>${statusBadge(l)}</div>
      <div class="hint">dal ${fdate(l.lent_at)} · ${dueText(l)}${l.condition_out ? ` · all’uscita: ${esc(l.condition_out)}` : ''}</div>${btns(l)}</div>`).join('')}</div>` : '<p class="hint">Nessun muletto dato a questo cliente.</p>'}
    <div class="row tight"><button class="btn btn-outline btn-sm" data-la="new">＋ Presta un muletto</button></div></section>`;
  const map = Object.fromEntries(d.rows.map((l) => [l.id, l]));
  box.onclick = (ev) => {
    const a = ev.target.closest('[data-la]');
    if (!a) return;
    if (a.dataset.la === 'new') return loanForm(null, reload, { repair: r });
    action(map[a.dataset.lid], a.dataset.la, reload);
  };
}
