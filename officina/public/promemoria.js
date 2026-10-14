// Promemoria con data e ora: elenco, inserimento veloce, collegamento a cliente/riparazione/ordine, riquadro in "Oggi".
import { $, esc, fdate, api, toast, safe, debounce, openModal, confirmDelete, addDays, today } from './util.js';
import { customerField, bindCustomer } from './pickers.js';
import { refreshBell } from './app.js';

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const inHours = (h) => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + h); return localInput(d); };
const atTime = (days, hh) => `${addDays(days)}T${hh}`;
const whenText = (r) => {
  const day = r.due_at.slice(0, 10);
  const t = r.due_at.slice(11);
  const label = day === today() ? 'oggi' : day === addDays(1) ? 'domani' : day === addDays(-1) ? 'ieri' : fdate(day);
  return `${label} alle ${t}`;
};
const links = (r) => [r.customer_name && `👤 ${esc(r.customer_name)}`, r.repair_code && `🛠️ ${esc(r.repair_code)}${r.repair_model ? ` ${esc(r.repair_model)}` : ''}`, r.order_code && `📮 ${esc(r.order_code)}`].filter(Boolean).join(' · ');

function reminderRow(r, { compact = false } = {}) {
  return `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 ${r.done ? 'opacity-60' : ''}" data-id="${r.id}">
    <button class="btn btn-outline btn-sm" data-done="${r.id}" data-to="${r.done ? 0 : 1}" aria-label="${r.done ? 'Riapri' : 'Fatto'}" title="${r.done ? 'Riapri' : 'Segna come fatto'}" style="min-width:2.25rem;padding-inline:.5rem">${r.done ? '↺' : '✓'}</button>
    <div class="min-w-0 flex-1 ${compact ? '' : 'cursor-pointer'}" ${compact ? '' : `data-edit="${r.id}"`}>
      <div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-sm ${r.done ? 'line-through' : ''}">${esc(r.title)}</span>
        ${r.overdue ? '<span class="badge bg-red-100 text-red-700">⏰ Scaduto</span>' : r.today ? '<span class="badge bg-amber-100 text-amber-800">Oggi</span>' : ''}</div>
      <p class="text-xs text-gray-500 truncate">${esc(whenText(r))}${links(r) ? ` · ${links(r)}` : ''}${r.body ? ` · ${esc(r.body)}` : ''}</p>
    </div>
    ${r.done ? '' : `<div class="flex items-center gap-1.5 shrink-0"><button class="btn btn-ghost btn-sm" data-snooze="${r.id}" title="Rimanda">Rimanda</button></div>`}</div>`;
}

async function act(el, reload) {
  el.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-done]');
    if (d) { await safe(() => api('POST', `/api/reminders/${d.dataset.done}/done`, { done: d.dataset.to === '1' })); refreshBell(); return reload(); }
    const s = e.target.closest('[data-snooze]');
    if (s) return snoozeDialog(Number(s.dataset.snooze), () => { refreshBell(); reload(); });
    const ed = e.target.closest('[data-edit]');
    if (ed) { const r = await safe(() => api('GET', `/api/reminders/${ed.dataset.edit}`)); if (r) reminderForm(r, () => { refreshBell(); reload(); }); }
  });
}

function snoozeDialog(id, done) {
  const m = openModal(`<div class="row"><button class="btn btn-outline" data-m="60">Tra 1 ora</button><button class="btn btn-outline" data-m="180">Tra 3 ore</button><button class="btn btn-outline" data-t="1">Domani alla stessa ora</button></div>`, { title: 'Rimanda il promemoria' });
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m],[data-t]');
    if (!b) return;
    if (await safe(() => api('POST', `/api/reminders/${id}/snooze`, b.dataset.t ? { tomorrow: true } : { minutes: Number(b.dataset.m) }))) { m.close(); toast('Promemoria rimandato'); done?.(); }
  });
}

export async function promemoriaView(el, params) {
  let stato = params.get('stato') || 'aperti';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Promemoria</h1>
      <button class="btn btn-outline" id="pm-more">＋ Con cliente / riparazione…</button></div>
    <section class="card panel"><div class="sec"><div class="fgrid">
      <div class="field"><label class="l" for="pm-title">Cosa devo ricordare?</label><input id="pm-title" placeholder="Es. Richiamare Marta per il preventivo" autocomplete="off" /></div></div>
      <div class="fgrid c2"><div class="field"><label class="l" for="pm-when">Quando</label><input id="pm-when" type="datetime-local" value="${inHours(1)}" /></div>
        <div class="field"><label class="l">Scorciatoie</label><div class="row tight"><button class="btn btn-outline btn-sm" data-q="${inHours(1)}">Tra 1 ora</button><button class="btn btn-outline btn-sm" data-q="${atTime(0, '18:00')}">Oggi 18:00</button><button class="btn btn-outline btn-sm" data-q="${atTime(1, '09:00')}">Domani 9:00</button></div></div></div>
      <div class="row"><button class="btn btn-primary" id="pm-add">Aggiungi promemoria</button></div></div></section>
    <div class="flex gap-2 flex-wrap chips-scroll" id="pm-chips"></div>
    <div class="card overflow-hidden" id="pm-list"></div>`;
  const list = $('#pm-list', el);
  const chips = [['aperti', 'Aperti'], ['oggi', 'Da fare oggi'], ['fatti', 'Fatti']];
  async function load() {
    $('#pm-chips', el).innerHTML = chips.map(([k, l]) => `<span class="chip ${stato === k ? 'on' : ''}" data-f="${k}">${l}</span>`).join('') + '<input id="pm-q" type="search" placeholder="Cerca…" style="max-width:14rem" />';
    $('#pm-q', el).value = q;
    $('#pm-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load().then(() => $('#pm-q', el).focus()); });
    const rows = await safe(() => api('GET', `/api/reminders?stato=${stato}&q=${encodeURIComponent(q)}`));
    list.innerHTML = rows?.length ? rows.map((r) => reminderRow(r)).join('') : `<p class="empty">${stato === 'fatti' ? 'Ancora niente di completato.' : 'Nessun promemoria: scrivine uno qui sopra.'}</p>`;
  }
  $('#pm-chips', el).onclick = (e) => { const c = e.target.closest('[data-f]'); if (c) { stato = c.dataset.f; load(); } };
  el.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => { $('#pm-when', el).value = b.dataset.q; }; });
  const add = async () => {
    const out = await safe(() => api('POST', '/api/reminders', { title: $('#pm-title', el).value, due_at: $('#pm-when', el).value }));
    if (out) { $('#pm-title', el).value = ''; toast('Promemoria aggiunto'); refreshBell(); load(); }
  };
  $('#pm-add', el).onclick = add;
  $('#pm-title', el).onkeydown = (e) => { if (e.key === 'Enter') add(); };
  $('#pm-more', el).onclick = () => reminderForm(null, () => { refreshBell(); load(); }, { title: $('#pm-title', el).value, due_at: $('#pm-when', el).value });
  act(list, load);
  await load();
}

export async function reminderForm(r, done, preset = {}) {
  const [repairs, orders] = await Promise.all([safe(() => api('GET', '/api/repairs?open=1')), safe(() => api('GET', '/api/orders?stato=aperti'))]);
  const m = openModal(
    `<div class="sec">
      <div class="field"><label class="l" for="pf-title">Cosa devo ricordare? *</label><input id="pf-title" value="${esc(r?.title || preset.title || '')}" /></div>
      <div class="field"><label class="l" for="pf-body">Dettagli</label><textarea id="pf-body" rows="2">${esc(r?.body || '')}</textarea></div>
      <div class="field"><label class="l" for="pf-when">Data e ora *</label><input id="pf-when" type="datetime-local" value="${esc((r?.due_at || preset.due_at || '').replace(' ', 'T') || inHours(1))}" /></div>
    </div>
    <div class="sec"><h3 class="sec-t">Collega (facoltativo)</h3>
      ${customerField('pf-customer', 'Cliente')}
      <div class="fgrid c2">
        <div class="field"><label class="l" for="pf-repair">Riparazione</label><select id="pf-repair"><option value="">— nessuna —</option>${(repairs || []).map((x) => `<option value="${x.id}">${esc(x.code)} · ${esc(x.brand_model)} · ${esc(x.customer_name)}</option>`).join('')}</select></div>
        <div class="field"><label class="l" for="pf-order">Ordine</label><select id="pf-order"><option value="">— nessuno —</option>${(orders || []).map((x) => `<option value="${x.id}">${esc(x.code)} · ${esc(x.customer_name || 'Negozio')}</option>`).join('')}</select></div>
      </div></div>
    ${r ? '<div class="sec"><div class="row"><button class="btn btn-ghost btn-sm" id="pf-del">Elimina promemoria</button></div></div>' : ''}`,
    { title: r ? 'Modifica promemoria' : 'Nuovo promemoria', wide: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="pf-ok">Salva</button>' }
  );
  const addOpt = (sel, val, text) => { if (val && ![...sel.options].some((o) => o.value === String(val))) sel.insertAdjacentHTML('beforeend', `<option value="${val}">${esc(text)}</option>`); };
  const rep = $('#pf-repair', m.el);
  const ord = $('#pf-order', m.el);
  addOpt(rep, r?.repair_id || preset.repair_id, r?.repair_code || 'Riparazione collegata');
  addOpt(ord, r?.order_id || preset.order_id, r?.order_code || 'Ordine collegato');
  rep.value = r?.repair_id || preset.repair_id || '';
  ord.value = r?.order_id || preset.order_id || '';
  const cust = bindCustomer(m.el, 'pf-customer', r?.customer_id || preset.customer_id || null);
  $('#pf-ok', m.el).onclick = async () => {
    const body = { title: $('#pf-title', m.el).value, body: $('#pf-body', m.el).value, due_at: $('#pf-when', m.el).value, customer_id: cust.value(), repair_id: rep.value || null, order_id: ord.value || null };
    const out = await safe(() => (r ? api('PUT', `/api/reminders/${r.id}`, body) : api('POST', '/api/reminders', body)));
    if (out) { m.close(); toast(r ? 'Promemoria aggiornato' : 'Promemoria aggiunto'); done?.(); }
  };
  if (r) $('#pf-del', m.el).onclick = async () => {
    if (!(await confirmDelete('questo promemoria', { detail: r.title }))) return;
    if (await safe(() => api('DELETE', `/api/reminders/${r.id}`))) { m.close(); toast('Promemoria eliminato'); done?.(); }
  };
}

/** Riquadro "Promemoria di oggi" nella pagina Oggi (scaduti e in programma oggi). */
export async function mountTodayReminders(el) {
  const rows = await safe(() => api('GET', '/api/reminders?stato=oggi'));
  if (!rows?.length) return;
  const html = `<section class="card overflow-hidden" id="today-reminders"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line flex justify-between gap-2"><span>🔔 Promemoria di oggi <span class="text-gray-400 font-normal">(${rows.length})</span></span>
    <a class="text-secondary text-xs font-semibold" href="#/promemoria">Apri →</a></h3>${rows.map((r) => reminderRow(r, { compact: true })).join('')}</section>`;
  el.querySelector('.grid')?.insertAdjacentHTML('afterend', html);
  const box = $('#today-reminders', el);
  if (box) act(box, () => { $('#today-reminders', el)?.remove(); mountTodayReminders(el); });
}

// Controllo periodico (ogni minuto): fa partire l'avviso Telegram dei promemoria scaduti e aggiorna la campanella.
let lastDue = -1;
setInterval(async () => {
  if (document.hidden) return;
  const t = await api('GET', '/api/reminders/tick').catch(() => null);
  if (!t) return;
  if (t.due !== lastDue) { if (lastDue >= 0 && t.due > lastDue) toast('🔔 Hai un promemoria scaduto'); lastDue = t.due; refreshBell(); }
}, 60000);
