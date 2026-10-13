// Router e viste principali: Oggi (dashboard) e Riparazioni.
import { $, $$, esc, eur, fdate, fdt, api, toast, safe, debounce, META, loadMeta, statusBadge, progressBar, waLink, waMessage, today } from './util.js';
import { openRepairForm, openRepairDetail } from './repair.js';
import { customersView } from './customers.js';
import { stockView, suppliersView } from './stock.js';
import { salesView, cashView, settingsView } from './sales.js';

const VIEWS = [
  { id: 'oggi', label: 'Oggi', icon: '🏠', render: dashboardView },
  { id: 'riparazioni', label: 'Riparazioni', icon: '🛠️', render: repairsView },
  { id: 'clienti', label: 'Clienti', icon: '👤', render: customersView },
  { id: 'magazzino', label: 'Magazzino', icon: '📦', render: stockView },
  { id: 'vendite', label: 'Vendite', icon: '🛒', render: salesView },
  { id: 'fornitori', label: 'Fornitori', icon: '🚚', render: suppliersView },
  { id: 'cassa', label: 'Cassa', icon: '💶', render: cashView },
  { id: 'impostazioni', label: 'Impostazioni', icon: '⚙️', render: settingsView },
];

const view = $('#view');
let current = null;
export const go = (id, qs = '') => { location.hash = `#/${id}${qs}`; };

async function route() {
  const [, id = 'oggi', qs = ''] = location.hash.match(/^#\/([a-z]+)(?:\?(.*))?$/) || [];
  const v = VIEWS.find((x) => x.id === id) || VIEWS[0];
  current = v.id;
  $('#nav').innerHTML = VIEWS.map((x) => `<a href="#/${x.id}" class="${x.id === v.id ? 'on' : ''}"><span>${x.icon}</span>${x.label}</a>`).join('');
  view.innerHTML = '<p class="text-gray-400 text-sm">Caricamento…</p>';
  await safe(() => v.render(view, new URLSearchParams(qs)));
}
export const refresh = () => route();

// ---------- Oggi ----------
function repairRow(r, { showAdvance = true, wa } = {}) {
  const waKind = wa || (r.status === 'ready' ? 'ready' : r.status === 'quote_pending' ? 'quote' : r.late ? 'late' : 'generic');
  const link = waLink(r.customer_phone, waMessage(waKind, r));
  return `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-open="${r.id}">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm">${esc(r.brand_model)}</span>${statusBadge(r)}
        ${r.late ? '<span class="badge bg-red-100 text-red-700">⏰ In ritardo</span>' : ''}${r.quote_decision === 'declined' ? '<span class="badge bg-red-100 text-red-700">Preventivo rifiutato</span>' : ''}</div>
      <p class="text-xs text-gray-500 truncate">${esc(r.customer_name)} · ${esc(r.code)} · ${esc(r.problem)}${r.eta_date ? ` · consegna ${fdate(r.eta_date)}` : ''}</p>
      <div class="mt-1.5 max-w-xs">${progressBar(r)}</div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0" data-stop>
      ${link ? `<a href="${link}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" title="Scrivi su WhatsApp">💬</a>` : ''}
      ${showAdvance && r.next_status ? `<button class="btn btn-dark btn-sm" data-advance="${r.id}" data-next="${r.next_status}">${esc(r.next_label)} →</button>` : ''}
    </div>
  </div>`;
}

function bindRepairList(root, reload) {
  root.addEventListener('click', async (e) => {
    const adv = e.target.closest('[data-advance]');
    if (adv) {
      e.stopPropagation();
      if (adv.dataset.next === 'delivered') return openRepairDetail(Number(adv.dataset.advance), reload);
      await safe(async () => { await api('POST', `/api/repairs/${adv.dataset.advance}/advance`); toast('Stato aggiornato'); });
      return reload();
    }
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('[data-open]');
    if (row) openRepairDetail(Number(row.dataset.open), reload);
  });
}

async function dashboardView(el) {
  const d = await api('GET', '/api/dashboard');
  const section = (title, list, opts = {}) =>
    list.length ? `<section class="card overflow-hidden mb-4"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line">${title} <span class="text-gray-400 font-normal">(${list.length})</span></h3>${list.map((r) => repairRow(r, opts)).join('')}</section>` : '';
  const stat = (label, n, to, color) => `<a href="#/riparazioni?${to}" class="card p-4 hover:shadow-md transition"><p class="text-3xl font-heading font-extrabold ${color}">${n}</p><p class="text-xs text-gray-500 font-semibold mt-1">${label}</p></a>`;
  const c = d.counts;
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-5">
      <div><h1 class="font-heading font-extrabold text-2xl">Oggi</h1><p class="text-sm text-gray-500">${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <button class="btn btn-primary btn-lg" id="new-repair">＋ Nuova riparazione</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      ${stat('Da lavorare', (c.received || 0) + (c.diagnosing || 0) + (c.approved || 0) + (c.repairing || 0), 'open=1', 'text-primary')}
      ${stat('Pronte al ritiro', c.ready || 0, 'status=ready', 'text-emerald-600')}
      ${stat('Preventivi da approvare', c.quote_pending || 0, 'status=quote_pending', 'text-amber-600')}
      <a href="#/cassa" class="card p-4 hover:shadow-md transition"><p class="text-3xl font-heading font-extrabold text-secondary">${eur(d.cash_today)}</p><p class="text-xs text-gray-500 font-semibold mt-1">Incasso di oggi</p></a>
    </div>
    ${section('📞 Pronte: avvisa il cliente', d.ready, { showAdvance: true, wa: 'ready' })}
    ${section('⏰ In ritardo', d.late)}
    ${section('✋ Preventivo da approvare', d.to_approve)}
    ${section('📦 In attesa ricambi', d.waiting_parts)}
    ${d.low_stock.length ? `<section class="card overflow-hidden mb-4"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line flex justify-between">📉 Da riordinare (${d.low_stock.length}) <a href="#/magazzino?tab=reorder" class="text-secondary text-xs font-semibold">Apri lista ordini →</a></h3>
      ${d.low_stock.slice(0, 6).map((p) => `<div class="px-4 py-2.5 border-b border-line last:border-0 text-sm flex justify-between"><span>${esc(p.name)}</span><span class="text-gray-500">${p.qty} in magazzino (minimo ${p.min_qty})</span></div>`).join('')}</section>` : ''}
    ${!d.open_total && !d.low_stock.length ? '<div class="card p-10 text-center text-gray-500">Nessuna riparazione aperta. Tutto in ordine 🎉<br><span class="text-sm">Premi “Nuova riparazione” quando arriva un cliente.</span></div>' : ''}`;
  $('#new-repair', el).onclick = () => openRepairForm(() => refresh());
  bindRepairList(el, refresh);
}

// ---------- Riparazioni ----------
async function repairsView(el, params) {
  let status = params.get('status') || '';
  let open = params.get('open') === '1';
  let q = '';
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <h1 class="font-heading font-extrabold text-2xl">Riparazioni</h1>
      <button class="btn btn-primary" id="new-repair">＋ Nuova riparazione</button>
    </div>
    <input id="q" placeholder="Cerca cliente, telefono, modello, codice, seriale…" class="mb-3" />
    <div class="flex gap-2 flex-wrap mb-4" id="chips"></div>
    <div class="card overflow-hidden" id="list"></div>`;
  const chipsEl = $('#chips', el);
  const listEl = $('#list', el);
  async function load() {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (open && !status) qs.set('open', '1');
    if (q) qs.set('q', q);
    const list = await api('GET', `/api/repairs?${qs}`);
    chipsEl.innerHTML =
      `<span class="chip ${!status && open ? 'on' : ''}" data-f="open">Aperte</span><span class="chip ${!status && !open ? 'on' : ''}" data-f="all">Tutte</span>` +
      Object.entries(META.statuses).map(([k, v]) => `<span class="chip ${status === k ? 'on' : ''}" data-f="${k}">${esc(v.label)}</span>`).join('');
    listEl.innerHTML = list.length ? list.map((r) => repairRow(r)).join('') : '<p class="p-8 text-center text-gray-400 text-sm">Nessuna riparazione trovata.</p>';
  }
  chipsEl.onclick = (e) => {
    const c = e.target.closest('[data-f]');
    if (!c) return;
    const f = c.dataset.f;
    status = ['open', 'all'].includes(f) ? '' : f;
    open = f === 'open';
    load();
  };
  $('#q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#new-repair', el).onclick = () => openRepairForm(load);
  bindRepairList(listEl, load);
  await load();
}

// ---------- Avvio ----------
window.addEventListener('hashchange', route);
(async () => {
  await safe(loadMeta);
  route();
})();
