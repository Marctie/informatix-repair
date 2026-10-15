// Router, navigazione, ricerca globale e viste principali: Oggi (dashboard) e Riparazioni.
import './icons.js';
import { $, esc, eur, fdate, api, toast, safe, debounce, META, loadMeta, statusBadge, progressBar, waLink, waMessage, openModal, isScanEnter } from './util.js';
import { scanWithCamera } from './scan.js';
import { openRepairForm, openRepairDetail, deliverDialog } from './repair.js';
import { customersView, openCustomer } from './customers.js';
import { stockView, suppliersView } from './stock.js';
import { salesView, cashView, settingsView } from './sales.js';
import { usersView } from './users.js';
import { auditView } from './audit.js';
import { analyticsView } from './analytics.js';
import { usatiView } from './usati.js';
import { portaleView } from './portale.js';
import { purchasesView } from './purchases.js';
import { ordiniView } from './ordini.js';
import { preventiviView } from './preventivi.js';
import { promemoriaView, mountTodayReminders } from './promemoria.js';

import { dispositiviView } from './dispositivi.js';
import { buoniView } from './buoni.js';
import { credenzialiView } from './credenziali.js';
import { blacksView } from './blacks.js';
// --- Agente C ---
import { chiusureView } from './chiusure.js';
import { fattureView } from './fatture.js';
import { dareavereView } from './dareavere.js';
// --- fine Agente C ---

// Menu a gruppi: le voci di tutti i giorni in alto, la gestione in fondo. L'ordine qui e' l'ordine nel menu.
const GROUPS = [
  { id: 'base', label: '' },
  { id: 'banco', label: 'Banco' },
  { id: 'magazzino', label: 'Magazzino e acquisti' },
  { id: 'negozio', label: 'Vetrina e buoni' },
  { id: 'gestione', label: 'Gestione' },
];
const VIEWS = [
  { id: 'portale', label: 'Portale', icon: '🧭', render: portaleView, group: 'base' },
  { id: 'oggi', label: 'Oggi', icon: '🏠', render: dashboardView, bottom: true, group: 'base' },
  { id: 'riparazioni', label: 'Riparazioni', icon: '🛠️', render: repairsView, bottom: true, group: 'banco' },
  { id: 'clienti', label: 'Clienti', icon: '👤', render: customersView, bottom: true, group: 'banco' },
  { id: 'vendite', label: 'Vendite', icon: '🛒', render: salesView, group: 'banco' },
  { id: 'cassa', label: 'Cassa', icon: '💶', render: cashView, group: 'banco' },
  { id: 'preventivi', label: 'Preventivi', icon: '📝', render: preventiviView, group: 'banco' },
  { id: 'promemoria', label: 'Promemoria', icon: '🔔', render: promemoriaView, group: 'banco' },
  { id: 'magazzino', label: 'Magazzino', icon: '📦', render: stockView, bottom: true, group: 'magazzino' },
  { id: 'ordini', label: 'Ordini', icon: '📮', render: ordiniView, group: 'magazzino' },
  { id: 'acquisti', label: 'Acquisti', icon: '🧾', render: purchasesView, group: 'magazzino' },
  { id: 'fornitori', label: 'Fornitori', icon: '🚚', render: suppliersView, group: 'magazzino' },
  { id: 'dispositivi', label: 'Dispositivi', icon: '📱', render: dispositiviView, group: 'magazzino' },
  { id: 'usati', label: 'Vetrina usati', icon: '🏷️', render: usatiView, group: 'negozio' },
  { id: 'buoni', label: 'Buoni', icon: '🎟️', render: buoniView, group: 'negozio' },
  { id: 'blacks', label: 'Blacks', icon: '⛔', render: blacksView, group: 'gestione' },
  { id: 'analisi', label: 'Analisi', icon: '📊', render: analyticsView, admin: true, group: 'gestione' },
  { id: 'impostazioni', label: 'Impostazioni', icon: '⚙️', render: settingsView, notCassa: true, group: 'gestione' },
  { id: 'utenti', label: 'Utenti', icon: '🔑', render: usersView, admin: true, group: 'gestione' },
  { id: 'credenziali', label: 'Credenziali', icon: '🔐', render: credenzialiView, admin: true, group: 'gestione' },
  { id: 'registro', label: 'Registro', icon: '📜', render: auditView, admin: true, group: 'gestione' },
  // --- Agente C ---
  { id: 'chiusure', label: 'Chiusure cassa', icon: '🧮', render: chiusureView, group: 'banco' },
  { id: 'dareavere', label: 'Dare/avere', icon: '⚖️', render: dareavereView, group: 'banco' },
  { id: 'fatture', label: 'Archivio fatture', icon: '🗂️', render: fattureView, group: 'gestione' },
  // --- fine Agente C ---
];
// L'utente collegato (Cloudflare Access): le voci riservate all'amministratore le vede solo lui.
let ME = null;
const visible = () => VIEWS.filter((x) => (!x.admin || ME?.role === 'admin') && !(x.notCassa && ME?.role === 'cassa'));
const ONLINE = !['localhost', '127.0.0.1'].includes(location.hostname) && !/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname);
const MANUAL = { href: '/manuale.html', label: 'Manuale', icon: '📖', group: 'gestione', external: true };

// Gruppi chiusi nella barra laterale: comodita' della singola postazione (il browser puo' non salvarli: nessun problema)
const NAV_KEY = 'ix-nav-chiusi';
const closedGroups = () => { try { return new Set(JSON.parse(localStorage.getItem(NAV_KEY) || '[]')); } catch { return new Set(); } };
const saveClosed = (set) => { try { localStorage.setItem(NAV_KEY, JSON.stringify([...set])); } catch { /* memoria del browser non disponibile */ } };
/** Voci visibili divise per gruppo (solo i gruppi con almeno una voce); `filter` toglie per esempio quelle della barra in basso. */
const grouped = (filter = () => true) => GROUPS.map((g) => ({ ...g, items: [...visible(), MANUAL].filter((x) => x.group === g.id && filter(x)) })).filter((g) => g.items.length);
const navLink = (x, cur, cls = '') => `<a href="${x.external ? x.href : `#/${x.id}`}" class="${cls}${x.id === cur ? ' on' : ''}"${x.id === cur ? ' aria-current="page"' : ''}${x.external ? ' target="_blank" rel="noopener"' : ''}><span class="ico">${x.icon}</span>${x.label}</a>`;
function sideNav(cur) {
  const closed = closedGroups();
  return grouped().map((g) => {
    if (!g.label) return g.items.map((x) => navLink(x, cur)).join('');
    const open = !closed.has(g.id) || g.items.some((x) => x.id === cur); // il gruppo della pagina aperta resta sempre visibile
    return `<div class="nav-grp"><button type="button" class="nav-grp-h" data-grp="${g.id}" aria-expanded="${open}" aria-controls="grp-${g.id}">${g.label}<span class="chev" aria-hidden="true">›</span></button>
      <div class="nav-grp-items" id="grp-${g.id}"${open ? '' : ' hidden'}>${g.items.map((x) => navLink(x, cur)).join('')}</div></div>`;
  }).join('');
}
document.addEventListener('click', (e) => {
  const h = e.target.closest('.nav-grp-h');
  if (!h) return;
  const open = h.getAttribute('aria-expanded') !== 'true';
  h.setAttribute('aria-expanded', String(open));
  $(`#grp-${h.dataset.grp}`).hidden = !open;
  const closed = closedGroups();
  if (open) closed.delete(h.dataset.grp); else closed.add(h.dataset.grp);
  saveClosed(closed);
});

const view = $('#view');

// ---------- Avvisi: campanella e riquadro in home ----------
const ALERT_ICO = { invoice_overdue: '🗂️', invoice_due: '🗂️', bad_payer: '⚠️', out_of_stock: '🛑', low_stock: '📉', stale: '🐌', late: '⏰', declined: '❌', ready_waiting: '📞', storage_due: '📦', storage_soon: '📦', fate_unknown: '❓' };
const alertRow = (a) => `<a href="${a.link}" class="flex gap-3 px-4 py-3 border-b border-line last:border-0 text-sm hover:bg-lightbg" data-alert>
  <span aria-hidden="true">${ALERT_ICO[a.type] || '🔔'}</span><span class="min-w-0"><b class="block">${esc(a.title)}</b><span class="text-gray-500">${esc(a.detail)}</span></span></a>`;
export async function refreshBell() {
  const d = await safe(() => api('GET', '/api/alerts'));
  const n = $('#bell-n');
  if (!d || !n) return d;
  n.textContent = d.count > 99 ? '99+' : d.count;
  n.classList.toggle('hidden', !d.count);
  $('#bell').setAttribute('aria-label', d.count ? `Avvisi: ${d.count}` : 'Avvisi');
  return d;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#bell')) return;
  const d = await refreshBell();
  if (!d) return;
  const m = openModal(d.items.length ? `<div class="card overflow-hidden">${d.items.map(alertRow).join('')}</div>` : '<p class="empty">Nessun avviso: è tutto a posto 👍</p>', { title: `Avvisi (${d.count})` });
  m.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-alert]')) m.close(); });
});
export const refresh = () => route();

async function route() {
  const [, id = 'portale', qs = ''] = location.hash.match(/^#\/([a-z]+)(?:\?(.*))?$/) || [];
  const v = visible().find((x) => x.id === id) || VIEWS[0];
  $('#nav').innerHTML = sideNav(v.id);
  const inMore = !v.bottom;
  const bottomItems = VIEWS.filter((x) => x.bottom).map((x) => navLink(x, v.id));
  // il pulsante "Nuova" sta al centro della barra: sempre a portata di pollice e mai sopra i contenuti
  bottomItems.splice(2, 0, `<button id="nav-new" class="nav-new" aria-label="Nuova riparazione"><span class="plus">＋</span>Nuova</button>`);
  $('#bottom-nav').innerHTML = bottomItems.join('') +
    `<button id="more-btn" class="${inMore ? 'on' : ''}" aria-expanded="false" aria-controls="more-menu"><span class="ico">☰</span>Altro</button>`;
  closeMore();
  view.innerHTML = '<p class="text-gray-400 text-sm">Caricamento…</p>';
  window.scrollTo(0, 0);
  await safe(() => v.render(view, new URLSearchParams(qs), ME));
  refreshBell();
}

// menu "Altro" (telefono e tablet): pannello dal basso con le voci a gruppi, a griglia; si chiude cliccando fuori o con Esc
function closeMore() {
  $('#more-menu').classList.add('hidden');
  $('#more-btn')?.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => {
  const menu = $('#more-menu');
  if (e.target.closest('#more-btn')) {
    if (!menu.classList.contains('hidden')) { closeMore(); return; }
    const cur = (location.hash.match(/^#\/([a-z]+)/) || [])[1];
    menu.innerHTML = grouped((x) => !x.bottom).map((g) => `<section class="more-grp">${g.label ? `<h2>${g.label}</h2>` : ''}<div class="more-grid">${g.items.map((x) => navLink(x, cur, 'more-tile')).join('')}</div></section>`).join('');
    menu.classList.remove('hidden');
    $('#more-btn').setAttribute('aria-expanded', 'true');
  } else if (!e.target.closest('#more-menu') || e.target.closest('a')) closeMore();
  if (!e.target.closest('#gsearch') && !e.target.closest('#gsearch-res')) $('#gsearch-res').classList.add('hidden');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#more-menu').classList.contains('hidden')) { closeMore(); $('#more-btn')?.focus(); } });

// ---------- Azioni rapide ----------
const newRepair = (preset) => openRepairForm(() => refresh(), preset);
document.addEventListener('click', (e) => { if (e.target.closest('#nav-new')) newRepair(); });
$('#top-new').onclick = () => newRepair();

// Scorciatoie da tastiera + lettura con la pistola codici a barre quando nessun campo è selezionato.
// La pistola "scrive" a raffica e chiude con Invio: se arrivano 4+ caratteri veloci è una lettura, non una scorciatoia.
let scanBuf = '';
let scanTimer = null;
function shortcut(k) {
  if ($('#modal-root').children.length) return;
  if (k === 'n' || k === 'N') newRepair();
  if (k === '/') $('#gsearch').focus();
}
async function onScan(code) {
  const serialField = $('#rf-serial');
  if (serialField) { // modulo di nuova riparazione aperto: il codice va nel seriale
    serialField.value = code;
    serialField.dispatchEvent(new Event('input'));
    toast(`Letto: ${code}`);
    return;
  }
  const list = await safe(() => api('GET', `/api/repairs?q=${encodeURIComponent(code)}`));
  if (list?.length === 1) return openRepairDetail(list[0].id, refresh);
  if (list?.length > 1) { gs.value = code; gs.dispatchEvent(new Event('input')); return toast(`${list.length} riparazioni trovate: scegli dall'elenco`); }
  const m = openModal(
    `<p class="text-sm">Nessuna riparazione con il codice <b class="font-mono">${esc(code)}</b>.</p><p class="text-sm text-gray-500 mt-1">Vuoi aprire una nuova riparazione con questo seriale?</p>`,
    { title: 'Codice letto', footer: `<button class="btn btn-outline" data-close>No</button><button class="btn btn-primary" id="scan-new">＋ Nuova riparazione</button>` }
  );
  $('#scan-new', m.el).onclick = () => { m.close(); newRepair({ serial: code }); };
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,textarea,select')) return;
  if (e.key === 'Enter') {
    if (scanBuf.length >= 4) { e.preventDefault(); const c = scanBuf; scanBuf = ''; clearTimeout(scanTimer); onScan(c); }
    return;
  }
  if (e.key.length !== 1) return;
  scanBuf += e.key;
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => { // nessun Invio: un tasto solo = scorciatoia; molti tasti veloci = lettura senza suffisso
    const b = scanBuf;
    scanBuf = '';
    if (b.length === 1) shortcut(b);
    else if (b.length >= 6) onScan(b);
  }, 130);
});

// ---------- Ricerca globale ----------
const gs = $('#gsearch');
const setSearchHint = () => { gs.placeholder = window.innerWidth < 480 ? 'Cerca…' : 'Cerca cliente, modello, codice…'; };
setSearchHint();
window.addEventListener('resize', setSearchHint);
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
// Invio nella ricerca: se c'è un solo risultato (tipico dopo una lettura con la pistola) lo apre subito
gs.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const q = gs.value.trim();
  if (q.length < 2) return;
  const list = await safe(() => api('GET', `/api/repairs?q=${encodeURIComponent(q)}`));
  if (list?.length === 1) { gs.value = ''; gsRes.classList.add('hidden'); openRepairDetail(list[0].id, refresh); }
  else if (!list?.length && isScanEnter(e)) { gsRes.classList.add('hidden'); onScan(q); }
});
$('#scan-btn').onclick = async () => { const v = await scanWithCamera(); if (v) onScan(v); };
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
        ${r.urgent ? '<span class="badge bg-red-600 text-white">🔥 Urgente</span>' : ''}${r.late ? '<span class="badge bg-red-100 text-red-700">⏰ In ritardo</span>' : ''}${r.quote_decision === 'declined' ? '<span class="badge bg-red-100 text-red-700">Preventivo rifiutato</span>' : ''}</div>
      <p class="text-xs text-gray-500 truncate">${esc(r.customer_name)} · ${esc(r.code)} · ${esc(r.problem)}${r.eta_date ? ` · consegna ${fdate(r.eta_date)}` : ''}</p>
      <div class="mt-1.5 max-w-xs">${progressBar(r)}</div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0" data-stop>
      ${link ? `<a href="${link}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" title="Scrivi su WhatsApp" aria-label="WhatsApp">💬<span class="sm:hidden">WhatsApp</span></a>` : ''}
      ${showAdvance && r.next_status ? `<button class="btn btn-dark btn-sm btn-wrap flex-1 sm:flex-none" data-advance="${r.id}" data-next="${r.next_status}">${esc(r.next_label)} →</button>` : ''}
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

// Dispositivi non riparati ancora in negozio: giorni di giacenza e scadenza (avviso quando passano i giorni stabiliti)
function storageSection(list) {
  if (!list.length) return '';
  const row = (x) => {
    const link = waLink(x.customer_phone, waMessage('storage', { ...x, customer_name: x.customer_name, brand_model: x.brand_model, code: x.code, fate_since: x.fate_since }));
    const state = x.unknown ? '<span class="badge bg-gray-100 text-gray-700">destino da registrare</span>'
      : x.device_fate === 'deposito' ? '<span class="badge bg-sky-100 text-sky-700">in deposito a pagamento</span>'
        : x.due ? `<span class="badge bg-red-100 text-red-700">giacenza scaduta da ${x.days_in_store - x.days_total} gg</span>`
          : `<span class="badge bg-amber-100 text-amber-800">mancano ${x.days_left} gg</span>`;
    return `<div class="row-h flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-open="${x.id}">
      <div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-sm">${esc(x.brand_model)}</span>${state}</div>
        <p class="text-xs text-gray-500 truncate">${esc(x.customer_name)} · ${esc(x.code)}${x.days_in_store != null ? ` · in negozio da ${x.days_in_store} giorni` : ''}</p></div>
      <div class="flex items-center gap-1.5 shrink-0" data-stop>${link && x.device_fate === 'giacenza' ? `<a href="${link}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" title="Avvisa il cliente su WhatsApp" aria-label="WhatsApp">💬<span class="sm:hidden">WhatsApp</span></a>` : ''}</div>
    </div>`;
  };
  return `<section class="card overflow-hidden"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line">📦 Non riparati ancora in negozio <span class="text-gray-400 font-normal">(${list.length})</span></h3>${list.map(row).join('')}</section>`;
}

// ---------- Oggi ----------
async function dashboardView(el) {
  const d = await api('GET', '/api/dashboard');
  const al = await refreshBell();
  const section = (title, list, opts = {}) =>
    list.length ? `<section class="card overflow-hidden"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line">${title} <span class="text-gray-400 font-normal">(${list.length})</span></h3>${list.map((r) => repairRow(r, opts)).join('')}</section>` : '';
  const c = d.counts;
  const todo = (c.received || 0) + (c.diagnosing || 0) + (c.approved || 0) + (c.repairing || 0);
  const parts = [];
  if (c.ready) parts.push(`<b>${c.ready}</b> ${c.ready === 1 ? 'pronta' : 'pronte'} da ritirare`);
  if (c.quote_pending) parts.push(`<b>${c.quote_pending}</b> ${c.quote_pending === 1 ? 'preventivo' : 'preventivi'} da approvare`);
  if (d.late.length) parts.push(`<b class="text-secondary">${d.late.length}</b> in ritardo`);
  el.innerHTML = `
    <div class="page-head">
      <div><h1 class="font-heading font-extrabold text-2xl">Oggi</h1>
        <p class="text-sm text-gray-500 first-letter:uppercase">${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}${parts.length ? ' · ' + parts.join(' · ') : ''}</p></div>
      <button class="btn btn-primary btn-lg hidden sm:inline-flex lg:hidden" id="new-repair">＋ Nuova riparazione</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <a href="#/riparazioni?open=1" class="card kpi"><b>${todo}</b><span>Da lavorare</span></a>
      <a href="#/riparazioni?status=ready" class="card kpi"><b class="text-emerald-600">${c.ready || 0}</b><span>Pronte al ritiro</span></a>
      <a href="#/riparazioni?status=quote_pending" class="card kpi"><b class="text-amber-600">${c.quote_pending || 0}</b><span>Preventivi da approvare</span></a>
      <a href="#/cassa" class="card kpi"><b class="text-secondary">${eur(d.cash_today)}</b><span>Incasso di oggi</span></a>
    </div>
    ${al && al.items.length ? `<section class="card overflow-hidden"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line flex justify-between gap-2">🔔 Avvisi (${al.count}) <button class="text-secondary text-xs font-semibold" id="open-bell">Vedi tutti →</button></h3>${al.items.slice(0, 5).map(alertRow).join('')}</section>` : ''}
    ${section('📞 Pronte: avvisa il cliente', d.ready, { wa: 'ready' })}
    ${section('⏰ In ritardo', d.late)}
    ${section('✋ Preventivo da approvare', d.to_approve)}
    ${section('🔧 In lavorazione', d.in_progress)}
    ${section('📦 In attesa ricambi', d.waiting_parts)}
    ${storageSection(d.storage || [])}
    ${d.low_stock.length ? `<section class="card overflow-hidden"><h3 class="px-4 py-3 font-heading font-bold text-sm border-b border-line flex justify-between gap-2">📉 Da riordinare (${d.low_stock.length}) <a href="#/magazzino?tab=reorder" class="text-secondary text-xs font-semibold">Lista ordini →</a></h3>
      ${d.low_stock.slice(0, 6).map((p) => `<div class="px-4 py-2.5 border-b border-line last:border-0 text-sm flex justify-between gap-3"><span class="min-w-0 truncate">${esc(p.name)}</span><span class="text-gray-500 shrink-0">${p.qty} pz (min. ${p.min_qty})</span></div>`).join('')}</section>` : ''}
    ${!d.open_total ? '<div class="card empty">Nessuna riparazione aperta. Tutto in ordine 🎉<br><span class="text-xs">Quando arriva un cliente premi “Nuova riparazione”.</span></div>' : ''}`;
  $('#open-bell', el)?.addEventListener('click', () => $('#bell').click());
  $('#new-repair', el).onclick = () => newRepair();
  bindRepairList(el, refresh);
  mountTodayReminders(el); // riquadro "Promemoria di oggi" (officina/public/promemoria.js)
}

// ---------- Riparazioni ----------
async function repairsView(el, params) {
  let status = params.get('status') || '';
  let open = params.get('open') === '1' || (!status && !params.has('all'));
  let q = '';
  el.innerHTML = `
    <div class="page-head">
      <h1 class="font-heading font-extrabold text-2xl">Riparazioni</h1>
      <button class="btn btn-primary hidden sm:inline-flex lg:hidden" id="new-repair">＋ Nuova riparazione</button>
    </div>
    <input id="q" type="search" placeholder="Filtra per cliente, telefono, modello, codice, seriale…" />
    <div class="flex gap-2 flex-wrap chips-scroll" id="chips"></div>
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
  ME = (await safe(() => api('GET', '/api/me')))?.user || null;
  META.role = ME?.role || 'admin';
  route();
})();
