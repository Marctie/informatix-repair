// Router, navigazione, ricerca globale e viste principali: Oggi (dashboard) e Riparazioni.
import { $, esc, eur, fdate, api, toast, safe, debounce, META, loadMeta, statusBadge, progressBar, waLink, waMessage } from './util.js';
import { openRepairForm, openRepairDetail, deliverDialog } from './repair.js';
import { customersView, openCustomer } from './customers.js';
import { stockView, suppliersView } from './stock.js';
import { salesView, cashView, settingsView } from './sales.js';

const VIEWS = [
  { id: 'oggi', label: 'Oggi', icon: '🏠', render: dashboardView, bottom: true },
  { id: 'riparazioni', label: 'Riparazioni', icon: '🛠️', render: repairsView, bottom: true },
  { id: 'clienti', label: 'Clienti', icon: '👤', render: customersView, bottom: true },
  { id: 'magazzino', label: 'Magazzino', icon: '📦', render: stockView, bottom: true },
  { id: 'vendite', label: 'Vendite', icon: '🛒', render: salesView },
  { id: 'fornitori', label: 'Fornitori', icon: '🚚', render: suppliersView },
  { id: 'cassa', label: 'Cassa', icon: '💶', render: cashView },
  { id: 'impostazioni', label: 'Impostazioni', icon: '⚙️', render: settingsView },
];
const MANUAL = { href: '/manuale.html', label: 'Manuale', icon: '📖' };

const view = $('#view');
export const refresh = () => route();

async function route() {
  const [, id = 'oggi', qs = ''] = location.hash.match(/^#\/([a-z]+)(?:\?(.*))?$/) || [];
  const v = VIEWS.find((x) => x.id === id) || VIEWS[0];
  $('#nav').innerHTML =
    VIEWS.map((x) => `<a href="#/${x.id}" class="${x.id === v.id ? 'on' : ''}"><span class="ico">${x.icon}</span>${x.label}</a>`).join('') +
    `<a href="${MANUAL.href}" target="_blank" rel="noopener"><span class="ico">${MANUAL.icon}</span>${MANUAL.label}</a>`;
  const inMore = !v.bottom;
  $('#bottom-nav').innerHTML =
    VIEWS.filter((x) => x.bottom).map((x) => `<a href="#/${x.id}" class="${x.id === v.id ? 'on' : ''}"><span class="ico">${x.icon}</span>${x.label}</a>`).join('') +
    `<button id="more-btn" class="${inMore ? 'on' : ''}" style="${inMore ? 'color:#fff;background:rgba(220,38,38,.9)' : ''}"><span class="ico">☰</span>Altro</button>`;
  $('#more-menu').classList.add('hidden');
  view.innerHTML = '<p class="text-gray-400 text-sm">Caricamento…</p>';
  window.scrollTo(0, 0);
  await safe(() => v.render(view, new URLSearchParams(qs)));
}

// menu "Altro" (mobile) e chiusura dei popup cliccando fuori
document.addEventListener('click', (e) => {
  const menu = $('#more-menu');
  if (e.target.closest('#more-btn')) {
    const item = (href, icon, label, extra = '') => `<a href="${href}" ${extra} class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-lightbg font-semibold text-sm">${icon} ${label}</a>`;
    menu.innerHTML = VIEWS.filter((x) => !x.bottom).map((x) => item(`#/${x.id}`, x.icon, x.label)).join('') + item(MANUAL.href, MANUAL.icon, MANUAL.label, 'target="_blank" rel="noopener"');
    menu.classList.toggle('hidden');
  } else if (!e.target.closest('#more-menu')) menu.classList.add('hidden');
  if (!e.target.closest('#gsearch') && !e.target.closest('#gsearch-res')) $('#gsearch-res').classList.add('hidden');
});

// ---------- Azioni rapide ----------
const newRepair = () => openRepairForm(() => refresh());
$('#fab').onclick = newRepair;
$('#top-new').onclick = newRepair;
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey || $('#modal-root').children.length) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newRepair(); }
  if (e.key === '/') { e.preventDefault(); $('#gsearch').focus(); }
});

// ---------- Ricerca globale ----------
const gs = $('#gsearch');
const gsRes = $('#gsearch-res');
gs.addEventListener('input', debounce(async () => {
  const q = gs.value.trim();
  if (q.length < 2) return gsRes.classList.add('hidden');
  const [reps, custs] = await Promise.all([
    safe(() => api('GET', `/api/repairs?q=${encodeURIComponent(q)}`)),
    safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`)),
  ]);
  const r = (reps || []).slice(0, 6);
  const c = (custs || []).slice(0, 4);
  gsRes.innerHTML =
    (r.length ? `<p class="sec-t px-3 pt-3 !mt-0">Riparazioni</p>${r.map((x) => `<div class="row-h px-3 py-2 cursor-pointer border-b border-line" data-rid="${x.id}"><b class="text-sm">${esc(x.brand_model)}</b> ${statusBadge(x)}<p class="text-xs text-gray-500">${esc(x.customer_name)} · ${esc(x.code)}</p></div>`).join('')}` : '') +
    (c.length ? `<p class="sec-t px-3 pt-3 !mt-0">Clienti</p>${c.map((x) => `<div class="row-h px-3 py-2 cursor-pointer border-b border-line" data-cid="${x.id}"><b class="text-sm">${esc(x.name)}</b><p class="text-xs text-gray-500">${esc(x.phone || '')}</p></div>`).join('')}` : '') ||
    '<p class="p-4 text-sm text-gray-400">Nessun risultato.</p>';
  gsRes.classList.remove('hidden');
}, 220));
gsRes.addEventListener('click', (e) => {
  const rid = e.target.closest('[data-rid]');
  const cid = e.target.closest('[data-cid]');
  gsRes.classList.add('hidden');
  if (rid) { gs.value = ''; openRepairDetail(Number(rid.dataset.rid), refresh); }
  if (cid) { gs.value = ''; openCustomer(Number(cid.dataset.cid), refresh); }
});

// ---------- Elenco riparazioni (usato in Oggi e Riparazioni) ----------
function repairRow(r, { showAdvance = true, wa } = {}) {
  const waKind = wa || (r.status === 'ready' ? 'ready' : r.status === 'quote_pending' ? 'quote' : r.late ? 'late' : 'generic');
  const link = waLink(r.customer_phone, waMessage(waKind, r));
  return `<div class="row-h flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-open="${r.id}">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-sm">${esc(r.brand_model)}</span>${statusBadge(r)}
        ${r.late ? '<span class="badge bg-red-100 text-red-700">⏰ In ritardo</span>' : ''}${r.quote_decision === 'declined' ? '<span class="badge bg-red-100 text-red-700">Preventivo rifiutato</span>' : ''}</div>
      <p class="text-xs text-gray-500 truncate">${esc(r.customer_name)} · ${esc(r.code)} · ${esc(r.problem)}${r.eta_date ? ` · consegna ${fdate(r.eta_date)}` : ''}</p>
      <div class="mt-1.5 max-w-xs">${progressBar(r)}</div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0" data-stop>
      ${link ? `<a href="${link}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" title="Scrivi su WhatsApp" aria-label="WhatsApp">💬<span class="sm:hidden">WhatsApp</span></a>` : ''}
      ${showAdvance && r.next_status ? `<button class="btn btn-dark btn-sm flex-1 sm:flex-none" data-advance="${r.id}" data-next="${r.next_status}">${esc(r.next_label)} →</button>` : ''}
    </div>
  </div>`;
}

function bindRepairList(root, reload) {
  root.addEventListener('click', async (e) => {
    const adv = e.target.closest('[data-advance]');
    if (adv) {
      e.stopPropagation();
      if (adv.dataset.next === 'delivered') return deliverDialog(Number(adv.dataset.advance), reload);
      adv.disabled = true;
      await safe(async () => { await api('POST', `/api/repairs/${adv.dataset.advance}/advance`); toast('Stato aggiornato'); });
      return reload();
    }
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('[data-open]');
    if (row) openRepairDetail(Number(row.dataset.open), reload);
  });
}

// ---------- Oggi ----------
async function dashboardView(el) {
  const d = await api('GET', '/api/dashboard');
  const section = (title, list, opts = {}) =>
    list.length ? `<section class="card overflow-hidden mb-4"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line">${title} <span class="text-gray-400 font-normal">(${list.length})</span></h3>${list.map((r) => repairRow(r, opts)).join('')}</section>` : '';
  const c = d.counts;
  const todo = (c.received || 0) + (c.diagnosing || 0) + (c.approved || 0) + (c.repairing || 0);
  const parts = [];
  if (c.ready) parts.push(`<b>${c.ready}</b> ${c.ready === 1 ? 'pronta' : 'pronte'} da ritirare`);
  if (c.quote_pending) parts.push(`<b>${c.quote_pending}</b> ${c.quote_pending === 1 ? 'preventivo' : 'preventivi'} da approvare`);
  if (d.late.length) parts.push(`<b class="text-secondary">${d.late.length}</b> in ritardo`);
  el.innerHTML = `
    <div class="flex items-end justify-between gap-3 flex-wrap mb-5">
      <div><h1 class="font-heading font-extrabold text-2xl">Oggi</h1>
        <p class="text-sm text-gray-500 first-letter:uppercase">${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}${parts.length ? ' · ' + parts.join(' · ') : ''}</p></div>
      <button class="btn btn-primary btn-lg hidden sm:inline-flex lg:hidden" id="new-repair">＋ Nuova riparazione</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <a href="#/riparazioni?open=1" class="card kpi"><b>${todo}</b><span>Da lavorare</span></a>
      <a href="#/riparazioni?status=ready" class="card kpi"><b class="text-emerald-600">${c.ready || 0}</b><span>Pronte al ritiro</span></a>
      <a href="#/riparazioni?status=quote_pending" class="card kpi"><b class="text-amber-600">${c.quote_pending || 0}</b><span>Preventivi da approvare</span></a>
      <a href="#/cassa" class="card kpi"><b class="text-secondary">${eur(d.cash_today)}</b><span>Incasso di oggi</span></a>
    </div>
    ${section('📞 Pronte: avvisa il cliente', d.ready, { wa: 'ready' })}
    ${section('⏰ In ritardo', d.late)}
    ${section('✋ Preventivo da approvare', d.to_approve)}
    ${section('🔧 In lavorazione', d.in_progress)}
    ${section('📦 In attesa ricambi', d.waiting_parts)}
    ${d.low_stock.length ? `<section class="card overflow-hidden mb-4"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line flex justify-between gap-2">📉 Da riordinare (${d.low_stock.length}) <a href="#/magazzino?tab=reorder" class="text-secondary text-xs font-semibold">Lista ordini →</a></h3>
      ${d.low_stock.slice(0, 6).map((p) => `<div class="px-4 py-2.5 border-b border-line last:border-0 text-sm flex justify-between gap-3"><span class="min-w-0 truncate">${esc(p.name)}</span><span class="text-gray-500 shrink-0">${p.qty} pz (min. ${p.min_qty})</span></div>`).join('')}</section>` : ''}
    ${!d.open_total ? '<div class="card empty">Nessuna riparazione aperta. Tutto in ordine 🎉<br><span class="text-xs">Quando arriva un cliente premi “Nuova riparazione”.</span></div>' : ''}`;
  $('#new-repair', el).onclick = newRepair;
  bindRepairList(el, refresh);
}

// ---------- Riparazioni ----------
async function repairsView(el, params) {
  let status = params.get('status') || '';
  let open = params.get('open') === '1' || (!status && !params.has('all'));
  let q = '';
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <h1 class="font-heading font-extrabold text-2xl">Riparazioni</h1>
      <button class="btn btn-primary hidden sm:inline-flex lg:hidden" id="new-repair">＋ Nuova riparazione</button>
    </div>
    <input id="q" type="search" placeholder="Filtra per cliente, telefono, modello, codice, seriale…" class="mb-3" />
    <div class="flex gap-2 flex-wrap mb-4" id="chips"></div>
    <div class="card overflow-hidden" id="list"></div>`;
  const chipsEl = $('#chips', el);
  const listEl = $('#list', el);
  const dash = await safe(() => api('GET', '/api/dashboard'));
  const counts = dash?.counts || {};
  const openCount = Object.entries(counts).filter(([k]) => !['delivered', 'cancelled'].includes(k)).reduce((a, [, n]) => a + n, 0);
  const total = Object.values(counts).reduce((a, n) => a + n, 0);
  async function load() {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (open && !status) qs.set('open', '1');
    if (q) qs.set('q', q);
    const list = await safe(() => api('GET', `/api/repairs?${qs}`));
    chipsEl.innerHTML =
      `<span class="chip ${!status && open ? 'on' : ''}" data-f="open">Aperte<small>${openCount}</small></span><span class="chip ${!status && !open ? 'on' : ''}" data-f="all">Tutte<small>${total}</small></span>` +
      Object.entries(META.statuses).map(([k, v]) => `<span class="chip ${status === k ? 'on' : ''}" data-f="${k}">${esc(v.label)}${counts[k] ? `<small>${counts[k]}</small>` : ''}</span>`).join('');
    listEl.innerHTML = list?.length ? list.map((r) => repairRow(r)).join('') : '<p class="empty">Nessuna riparazione trovata.</p>';
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
  $('#new-repair', el).onclick = () => openRepairForm(() => refresh());
  bindRepairList(listEl, load);
  await load();
}

// ---------- Avvio ----------
window.addEventListener('hashchange', route);
(async () => {
  await safe(loadMeta);
  route();
})();
