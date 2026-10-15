// Riparazioni esterne: laboratorio terzo, invio/rientro, costo, stato. Elenco dedicato + sezione dentro la scheda riparazione.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, today, canSeeCosts } from './util.js';
import { openRepairDetail } from './repair.js';

const BADGE = { da_inviare: 'b-idle', inviata: 'b-warn', rientrata: 'b-ok', annullata: 'b-bad' };
const statusBadge = (e) => `<span class="badge ${e.late ? 'b-bad' : BADGE[e.status] || 'b-idle'}">${e.late ? '⏰ In ritardo' : esc(e.status_label)}</span>`;

/** Campo "riparazione" con ricerca: ritorna { value() }. Usato anche dai prestiti. */
export function repairPicker(root, id, selected = null) {
  const q = $(`#${id}-q`, root);
  const sel = $(`#${id}`, root);
  async function load(text = '', keep = sel.value) {
    const rows = (await safe(() => api('GET', `/api/storico?limit=40${text ? `&q=${encodeURIComponent(text)}` : ''}`)))?.rows || [];
    const opts = rows.map((r) => `<option value="${r.id}">${esc(r.code)} · ${esc(r.brand_model)} · ${esc(r.customer_name)}</option>`);
    if (keep && !rows.some((r) => String(r.id) === String(keep))) opts.unshift(`<option value="${keep}">${esc(sel.selectedOptions[0]?.textContent || `Riparazione #${keep}`)}</option>`);
    sel.innerHTML = '<option value="">Scegli la riparazione…</option>' + opts.join('');
    if (keep) sel.value = keep;
  }
  q.oninput = debounce(() => load(q.value.trim()));
  load('', selected);
  return { value: () => (sel.value ? Number(sel.value) : null), set: (v) => load(q.value.trim(), v) };
}
export const repairField = (id, label = 'Riparazione') => `<div class="field"><label class="l" for="${id}-q">${label} *</label>
  <input id="${id}-q" type="search" placeholder="Cerca per scheda, modello o cliente…" autocomplete="off" /><select id="${id}" aria-label="${label}"></select></div>`;

// ---------- Modulo ----------
export async function externalForm(e, done, { repair = null } = {}) {
  const suppliers = (await safe(() => api('GET', '/api/suppliers'))) || [];
  const meta = (await safe(() => api('GET', '/api/esterne/meta'))) || { statuses: {} };
  const v = e || {};
  const dlg = openModal(
    `<div class="sec">
      ${repair || e ? `<p class="hint">Riparazione: <b>${esc(repair ? `${repair.code} · ${repair.brand_model}` : `${e.repair_code} · ${e.brand_model}`)}</b></p>` : repairField('ef-rep')}
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ef-sup">Laboratorio (anagrafica fornitori)</label><select id="ef-sup"><option value="">— scrivo il nome a mano —</option>${suppliers.map((s) => `<option value="${s.id}" ${v.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="l" for="ef-lab">Nome del laboratorio</label><input id="ef-lab" value="${esc(v.supplier_id ? '' : v.lab_name || '')}" placeholder="Es. Micro-saldature Rossi" /></div>
        <div class="field span2"><label class="l" for="ef-work">Lavorazione richiesta</label><input id="ef-work" value="${esc(v.work || '')}" placeholder="Es. Ricostruzione pad scheda madre" /></div>
        <div class="field"><label class="l" for="ef-status">Stato</label><select id="ef-status">${Object.entries(meta.statuses).map(([k, n]) => `<option value="${k}" ${(v.status || 'da_inviare') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        ${canSeeCosts() ? `<div class="field"><label class="l" for="ef-cost">Costo del laboratorio €</label><input id="ef-cost" inputmode="decimal" value="${v.cost ?? ''}" /></div>` : ''}
        <div class="field"><label class="l" for="ef-sent">Inviata il</label><input id="ef-sent" type="date" value="${esc(v.sent_at || '')}" /></div>
        <div class="field"><label class="l" for="ef-exp">Rientro previsto</label><input id="ef-exp" type="date" value="${esc(v.expected_back || '')}" /></div>
        <div class="field"><label class="l" for="ef-back">Rientrata il</label><input id="ef-back" type="date" value="${esc(v.returned_at || '')}" /></div>
        <div class="field"><label class="l" for="ef-track">Tracciamento spedizione</label><input id="ef-track" value="${esc(v.tracking || '')}" /></div>
        <div class="field span2"><label class="l" for="ef-notes">Note</label><textarea id="ef-notes" rows="2">${esc(v.notes || '')}</textarea></div>
      </div></div>`,
    { title: e ? 'Modifica riparazione esterna' : 'Nuova riparazione esterna', wide: true, footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ef-ok">Salva</button>` }
  );
  const rep = repair || e ? null : repairPicker(dlg.el, 'ef-rep');
  $('#ef-ok', dlg.el).onclick = async () => {
    const g = (k) => $(`#${k}`, dlg.el)?.value;
    const body = { repair_id: repair?.id || e?.repair_id || rep?.value(), supplier_id: g('ef-sup') || null, lab_name: g('ef-lab'), work: g('ef-work'), status: g('ef-status'), sent_at: g('ef-sent'), expected_back: g('ef-exp'), returned_at: g('ef-back'), tracking: g('ef-track'), notes: g('ef-notes') };
    if (canSeeCosts()) body.cost = g('ef-cost');
    const out = await safe(() => (e ? api('PUT', `/api/esterne/${e.id}`, body) : api('POST', '/api/esterne', body)));
    if (out) { dlg.close(); toast('Riparazione esterna salvata'); done?.(out); }
  };
}

async function returnDialog(e, done) {
  const dlg = openModal(
    `<div class="sec"><p>Rientro da <b>${esc(e.lab)}</b> (${esc(e.repair_code)} · ${esc(e.brand_model)}).</p>
      <div class="fgrid c2"><div class="field"><label class="l" for="rt-date">Data di rientro</label><input id="rt-date" type="date" value="${today()}" /></div>
        ${canSeeCosts() ? `<div class="field"><label class="l" for="rt-cost">Costo finale €</label><input id="rt-cost" inputmode="decimal" value="${e.cost ?? ''}" /></div>` : ''}</div></div>`,
    { title: 'Segna il rientro', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-green" id="rt-ok">✔ Rientrata</button>' }
  );
  $('#rt-ok', dlg.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/esterne/${e.id}/rientro`, { date: $('#rt-date', dlg.el).value, cost: $('#rt-cost', dlg.el)?.value }));
    if (out) { dlg.close(); toast('Rientro registrato'); done?.(); }
  };
}

async function action(e, act, done) {
  if (act === 'send') { if (await safe(() => api('POST', `/api/esterne/${e.id}/invia`, {}))) { toast('Segnata come inviata'); done(); } }
  else if (act === 'back') returnDialog(e, done);
  else if (act === 'edit') externalForm(e, done);
  else if (act === 'del') {
    if (!(await confirmDelete(`${e.lab} · ${e.repair_code}`, { detail: 'Si toglie solo questa lavorazione esterna.' }))) return;
    if (await safe(() => api('DELETE', `/api/esterne/${e.id}`))) { toast('Eliminata'); done(); }
  }
}
const btns = (e) => `<div class="rowact">${e.status === 'da_inviare' ? `<button class="btn btn-outline btn-sm" data-ea="send" data-eid="${e.id}">Segna inviata</button>` : ''}${['da_inviare', 'inviata'].includes(e.status) ? `<button class="btn btn-green btn-sm" data-ea="back" data-eid="${e.id}">✔ Rientrata</button>` : ''}
  <button class="btn btn-outline btn-sm" data-ea="edit" data-eid="${e.id}">Modifica</button><button class="btn btn-ghost btn-sm" data-ea="del" data-eid="${e.id}" aria-label="Elimina">Elimina</button></div>`;

// ---------- Elenco dedicato ----------
export async function esterneView(el, params) {
  let stato = params.get('stato') || 'aperte';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Riparazioni esterne</h1>
      <button class="btn btn-primary" id="ex-new">＋ Nuova riparazione esterna</button></div>
    <p class="hint">Dispositivi o pezzi mandati a un laboratorio esterno: quando sono partiti, quando devono rientrare e quanto costano. Si collegano alla riparazione del cliente e si vedono anche dalla sua scheda.</p>
    <div class="row tight chips-scroll" id="ex-chips"></div>
    <input id="ex-q" type="search" placeholder="Cerca laboratorio, scheda, modello, cliente, spedizione…" aria-label="Cerca" />
    <div class="card overflow-hidden" id="ex-list"></div>`;
  const list = $('#ex-list', el);
  async function load() {
    const d = await safe(() => api('GET', `/api/esterne?stato=${stato}&q=${encodeURIComponent(q)}`));
    if (!d || !$('#ex-list', el)) return;
    const c = d.counts;
    const chips = [['aperte', 'Aperte', (c.da_inviare || 0) + (c.inviata || 0)], ['in_ritardo', '⏰ In ritardo', d.late], ['rientrata', 'Rientrate', c.rientrata || 0], ['annullata', 'Annullate', c.annullata || 0]];
    $('#ex-chips', el).innerHTML = chips.map(([k, l, n]) => `<span class="chip ${k === 'in_ritardo' ? 'chip-red ' : ''}${stato === k ? 'on' : ''}" data-st="${k}">${l}${n ? `<small>${n}</small>` : ''}</span>`).join('');
    if (!d.rows.length) { list.innerHTML = '<p class="empty">Nessuna riparazione esterna qui.</p>'; return; }
    list.innerHTML =
      `<div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Laboratorio</th><th>Riparazione</th><th>Stato</th><th>Invio / rientro</th>${canSeeCosts() ? '<th>Costo</th>' : ''}<th></th></tr></thead><tbody>` +
      d.rows.map((e) => `<tr class="row-h"><td><b>${esc(e.lab)}</b><div class="hint">${esc(e.work || '')}</div></td>
        <td><a href="#" data-rid="${e.repair_id}"><b>${esc(e.repair_code)}</b></a> ${esc(e.brand_model)}<div class="hint">${esc(e.customer_name)}</div></td><td>${statusBadge(e)}</td>
        <td>${e.sent_at ? fdate(e.sent_at) : '—'} → ${e.returned_at ? fdate(e.returned_at) : e.expected_back ? `<span class="${e.late ? 'late-t' : ''}">prev. ${fdate(e.expected_back)}</span>` : '—'}</td>${canSeeCosts() ? `<td>${eur(e.cost)}</td>` : ''}<td>${btns(e)}</td></tr>`).join('') +
      '</tbody></table></div>' +
      `<div class="only-narrow">${d.rows.map((e) => `<div class="pcard"><div class="top"><span class="name">${esc(e.lab)}</span>${statusBadge(e)}</div>
        <div class="sub"><a href="#" data-rid="${e.repair_id}"><b>${esc(e.repair_code)}</b></a> ${esc(e.brand_model)} · ${esc(e.customer_name)}</div>
        <div class="sub">${esc(e.work || '')}${e.sent_at ? ` · inviata ${fdate(e.sent_at)}` : ''}${e.expected_back && e.status === 'inviata' ? ` · rientro ${fdate(e.expected_back)}` : ''}${canSeeCosts() && e.cost != null ? ` · ${eur(e.cost)}` : ''}</div>${btns(e)}</div>`).join('')}</div>`;
    list._rows = Object.fromEntries(d.rows.map((e) => [e.id, e]));
  }
  $('#ex-chips', el).onclick = (ev) => { const c = ev.target.closest('[data-st]'); if (c) { stato = c.dataset.st; load(); } };
  $('#ex-q', el).oninput = debounce((ev) => { q = ev.target.value.trim(); load(); });
  list.onclick = (ev) => {
    const a = ev.target.closest('[data-ea]');
    if (a) return action(list._rows[a.dataset.eid], a.dataset.ea, load);
    const r = ev.target.closest('[data-rid]');
    if (r) { ev.preventDefault(); openRepairDetail(Number(r.dataset.rid), load); }
  };
  $('#ex-new', el).onclick = () => externalForm(null, load);
  await load();
}

// ---------- Sezione nella scheda riparazione ----------
export async function repairExternals(box, r, reload) {
  const d = await safe(() => api('GET', `/api/esterne?stato=tutte&repair_id=${r.id}`));
  if (!d || !box.isConnected) return;
  const rows = d.rows;
  box.innerHTML = `<section class="sec"><h3 class="sec-t">Riparazione esterna</h3>
    ${rows.length ? `<div class="xsec-list">${rows.map((e) => `<div class="xitem"><div class="top"><span class="ttl">${esc(e.lab)}</span>${statusBadge(e)}</div>
      <div class="hint">${esc(e.work || '')}${e.sent_at ? ` · inviata ${fdate(e.sent_at)}` : ''}${e.returned_at ? ` · rientrata ${fdate(e.returned_at)}` : e.expected_back ? ` · rientro previsto ${fdate(e.expected_back)}` : ''}${canSeeCosts() && e.cost != null ? ` · costo ${eur(e.cost)}` : ''}${e.tracking ? ` · sped. ${esc(e.tracking)}` : ''}</div>${btns(e)}</div>`).join('')}</div>` : '<p class="hint">Nessuna: se il dispositivo va a un laboratorio esterno, registralo qui.</p>'}
    <div class="row tight"><button class="btn btn-outline btn-sm" data-ea="new">＋ Manda a un laboratorio esterno</button></div></section>`;
  const map = Object.fromEntries(rows.map((e) => [e.id, e]));
  box.onclick = (ev) => {
    const a = ev.target.closest('[data-ea]');
    if (!a) return;
    if (a.dataset.ea === 'new') return externalForm(null, reload, { repair: r });
    action(map[a.dataset.eid], a.dataset.ea, reload);
  };
}
