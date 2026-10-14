// Preventivi autonomi con data di validità: creazione, invio, stampa/PDF, conversione in riparazione o vendita.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, waLink, addDays, META } from './util.js';
import { customerField, bindCustomer, itemsEditor, methodSelect } from './pickers.js';
import { openRepairDetail } from './repair.js';

const STATUS = {
  bozza: { cls: 'bg-gray-100 text-gray-700', next: 'inviato', nextLabel: 'Segna inviato' },
  inviato: { cls: 'bg-blue-100 text-blue-700', next: 'accettato', nextLabel: 'Accettato' },
  accettato: { cls: 'bg-emerald-100 text-emerald-700', next: null },
  rifiutato: { cls: 'bg-red-100 text-red-700', next: null },
  convertito: { cls: 'bg-gray-200 text-gray-600', next: null },
  scaduto: { cls: 'bg-red-100 text-red-700', next: null },
};
const badge = (q) => `<span class="badge ${STATUS[q.status_view]?.cls || ''}">${esc(q.status_label)}</span>`;
const shop = () => META.settings.shop_name || 'Informatix Repair';
const validity = (q) => {
  if (!['bozza', 'inviato'].includes(q.status)) return `valido fino al ${fdate(q.valid_until)}`;
  if (q.expired) return `scaduto il ${fdate(q.valid_until)}`;
  return q.days_left === 0 ? 'scade oggi' : q.days_left === 1 ? 'scade domani' : q.days_left <= 7 ? `scade tra ${q.days_left} giorni` : `valido fino al ${fdate(q.valid_until)}`;
};
const waText = (q) => `Ciao ${String(q.who || '').split(' ')[0]}, da ${shop()}: ecco il preventivo ${q.code}${q.items.length ? ` (${q.items.map((i) => i.description).slice(0, 3).join(', ')}${q.items.length > 3 ? '…' : ''})` : ''}, totale ${eur(q.total)}. È valido fino al ${fdate(q.valid_until)}. Per accettare rispondi a questo messaggio o passa in negozio.`;

function quoteRow(q) {
  const st = STATUS[q.status_view];
  return `<div class="row-h flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-open="${q.id}">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-sm">${esc(q.who)}</span>${badge(q)}
        ${!q.expired && ['bozza', 'inviato'].includes(q.status) && q.days_left <= 3 ? '<span class="badge bg-amber-100 text-amber-800">⏰ In scadenza</span>' : ''}</div>
      <p class="text-xs text-gray-500 truncate">${esc(q.code)} · ${esc(validity(q))}${q.repair_code ? ` · rip. ${esc(q.repair_code)}` : ''}${q.sale_code ? ` · vendita ${esc(q.sale_code)}` : ''}</p>
    </div>
    <div class="flex items-center gap-1.5 shrink-0" data-stop><span class="text-sm font-semibold">${eur(q.total)}</span>
      ${q.status_view === 'bozza' ? `<button class="btn btn-dark btn-sm" data-adv="${q.id}" data-next="inviato">${st.nextLabel} →</button>` : ''}
      ${q.status_view === 'inviato' ? `<button class="btn btn-dark btn-sm" data-adv="${q.id}" data-next="accettato">Accettato →</button>` : ''}
    </div></div>`;
}

export async function preventiviView(el, params) {
  let stato = params.get('stato') || 'aperti';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Preventivi</h1>
      <button class="btn btn-primary" id="q-new">＋ Nuovo preventivo</button></div>
    <input id="q-q" type="search" placeholder="Cerca per cliente, voce, codice…" />
    <div class="flex gap-2 flex-wrap chips-scroll" id="q-chips"></div>
    <div class="card overflow-hidden" id="q-list"></div>`;
  const list = $('#q-list', el);
  const chips = [['aperti', 'Aperti'], ['bozza', 'Bozze'], ['inviato', 'Inviati'], ['accettato', 'Accettati'], ['scaduto', 'Scaduti'], ['convertito', 'Convertiti'], ['rifiutato', 'Rifiutati'], ['', 'Tutti']];
  async function load() {
    $('#q-chips', el).innerHTML = chips.map(([k, l]) => `<span class="chip ${stato === k ? 'on' : ''}" data-f="${k}">${l}</span>`).join('');
    const rows = await safe(() => api('GET', `/api/quotes?stato=${stato}&q=${encodeURIComponent(q)}`));
    list.innerHTML = rows?.length ? rows.map(quoteRow).join('') : '<p class="empty">Nessun preventivo. Premi “Nuovo preventivo” (anche per chi non ha ancora un dispositivo in laboratorio, es. assemblaggio PC).</p>';
  }
  $('#q-chips', el).onclick = (e) => { const c = e.target.closest('[data-f]'); if (c) { stato = c.dataset.f; load(); } };
  $('#q-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#q-new', el).onclick = () => quoteForm(null, load);
  list.onclick = async (e) => {
    const adv = e.target.closest('[data-adv]');
    if (adv) { e.stopPropagation(); await safe(async () => { await api('POST', `/api/quotes/${adv.dataset.adv}/status`, { status: adv.dataset.next }); toast('Stato aggiornato'); }); return load(); }
    if (e.target.closest('[data-stop]')) return;
    const r = e.target.closest('[data-open]');
    if (r) openQuote(Number(r.dataset.open), load);
  };
  await load();
}

export async function openQuote(id, done) {
  const q = await safe(() => api('GET', `/api/quotes/${id}`));
  if (!q) return;
  const live = !['convertito'].includes(q.status);
  const canConvert = ['bozza', 'inviato', 'accettato'].includes(q.status) && !q.expired;
  const wa = waLink(q.who_phone, waText(q));
  const m = openModal(
    `<section class="sec">
      <dl class="kv"><dt>Stato</dt><dd>${badge(q)}</dd><dt>Cliente</dt><dd>${esc(q.who)}${q.who_phone ? ` · ${esc(q.who_phone)}` : ''}</dd>
        <dt>Validità</dt><dd><b>${fdate(q.valid_until)}</b> <span class="hint">${esc(validity(q))}</span></dd>
        ${q.repair_code ? `<dt>Riparazione</dt><dd>${esc(q.repair_code)}</dd>` : ''}${q.sale_code ? `<dt>Vendita</dt><dd>${esc(q.sale_code)}</dd>` : ''}
        ${q.notes ? `<dt>Note</dt><dd>${esc(q.notes)}</dd>` : ''}<dt>Creato</dt><dd>${fdate(q.created_at)}</dd></dl></section>
    <section class="sec"><h3 class="sec-t">Voci</h3>
      <div class="plist">${q.items.map((i) => `<div><span>${i.qty}× ${esc(i.description)}</span><b>${eur(i.qty * i.unit_price)}</b></div>`).join('')}</div>
      <dl class="kv">${q.discount ? `<dt>Sconto</dt><dd>-${eur(q.discount)}</dd>` : ''}<dt>Totale</dt><dd><b>${eur(q.total)}</b></dd></dl></section>
    <section class="sec"><div class="row">
      <a class="btn btn-outline btn-sm" href="/print/quote/${q.id}" target="_blank" rel="noopener">🖨️ Stampa / PDF</a>
      ${wa ? `<a class="btn btn-green btn-sm" id="qd-wa" target="_blank" rel="noopener" href="${wa}">💬 WhatsApp</a>` : ''}
      ${q.status === 'bozza' ? '<button class="btn btn-dark btn-sm" data-st="inviato">Segna inviato</button>' : ''}
      ${['bozza', 'inviato'].includes(q.status) ? '<button class="btn btn-dark btn-sm" data-st="accettato">Accettato dal cliente</button><button class="btn btn-outline btn-sm" data-st="rifiutato">Rifiutato</button>' : ''}
      ${canConvert ? '<button class="btn btn-primary btn-sm" id="qd-rep">→ Riparazione</button><button class="btn btn-primary btn-sm" id="qd-sale">→ Vendita</button>' : ''}
      ${live ? '<button class="btn btn-outline btn-sm" id="qd-edit">Modifica / prolunga</button>' : ''}
      <button class="btn btn-ghost btn-sm" id="qd-del">Elimina</button></div></section>`,
    { title: `Preventivo ${q.code}`, wide: true }
  );
  const again = () => { m.close(); openQuote(id, done); done?.(); };
  m.el.addEventListener('click', async (e) => {
    const st = e.target.closest('[data-st]');
    if (st) { if (await safe(() => api('POST', `/api/quotes/${id}/status`, { status: st.dataset.st }))) again(); }
    if (e.target.closest('#qd-wa') && q.status === 'bozza') { await safe(() => api('POST', `/api/quotes/${id}/status`, { status: 'inviato' })); done?.(); }
  });
  if ($('#qd-edit', m.el)) $('#qd-edit', m.el).onclick = () => { m.close(); quoteForm(q, done); };
  if ($('#qd-rep', m.el)) $('#qd-rep', m.el).onclick = () => { m.close(); convertToRepair(q, done); };
  if ($('#qd-sale', m.el)) $('#qd-sale', m.el).onclick = () => { m.close(); convertToSale(q, done); };
  $('#qd-del', m.el).onclick = async () => {
    if (!(await confirmDelete(`il preventivo ${q.code}`))) return;
    if (await safe(() => api('DELETE', `/api/quotes/${id}`))) { m.close(); toast('Preventivo eliminato'); done?.(); }
  };
}

function convertToRepair(q, done) {
  const m = openModal(`<div class="sec"><p class="text-sm">Il preventivo <b>${esc(q.code)}</b> (${eur(q.total)}) diventa una riparazione${q.status === 'accettato' ? ' già <b>approvata</b>' : ''}.</p>
    <div class="fgrid"><div class="field"><label class="l" for="cr-model">Dispositivo *</label><input id="cr-model" placeholder="Es. iPhone 13, Asus ROG…" /></div>
      <div class="field"><label class="l" for="cr-problem">Problema / lavoro</label><input id="cr-problem" value="${esc(q.items.map((i) => i.description).join(', '))}" /></div></div></div>`,
  { title: 'Converti in riparazione', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="cr-ok">Crea riparazione</button>' });
  $('#cr-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/quotes/${q.id}/convert`, { to: 'repair', brand_model: $('#cr-model', m.el).value, problem: $('#cr-problem', m.el).value }));
    if (out) { m.close(); toast(`Riparazione ${out.repair.code} creata`); done?.(); openRepairDetail(out.repair.id, done); }
  };
}

function convertToSale(q, done) {
  const m = openModal(`<div class="sec"><p class="text-sm">Il preventivo <b>${esc(q.code)}</b> diventa una <b>vendita da ${eur(q.total)}</b>: l'incasso viene registrato in cassa adesso.</p>
    <div class="field"><label class="l" for="cs-method">Incassato con</label>${methodSelect('cs-method')}</div></div>`,
  { title: 'Converti in vendita', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="cs-ok">Registra la vendita</button>' });
  $('#cs-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/quotes/${q.id}/convert`, { to: 'sale', method: $('#cs-method', m.el).value }));
    if (out) { m.close(); toast(`Vendita ${out.sale.code} registrata`); done?.(); }
  };
}

export async function quoteForm(q, done, preset = {}) {
  const meta = await safe(() => api('GET', '/api/quotes/meta'));
  const m = openModal(
    `<div class="sec">
      ${customerField('qf-customer', 'Cliente in anagrafica')}
      <div class="fgrid c2" id="qf-free">
        <div class="field"><label class="l" for="qf-name">…oppure nome (se non è in anagrafica)</label><input id="qf-name" value="${esc(q?.customer_id ? '' : q?.customer_name || '')}" placeholder="Nome e cognome" /></div>
        <div class="field"><label class="l" for="qf-phone">Telefono</label><input id="qf-phone" inputmode="tel" value="${esc(q?.customer_id ? '' : q?.customer_phone || '')}" /></div>
      </div>
      <div class="fgrid c2"><div class="field"><label class="l" for="qf-valid">Valido fino al *</label><input id="qf-valid" type="date" value="${esc(q?.valid_until || addDays(meta?.valid_days || 15))}" />
        <span class="hint">Proposta: ${meta?.valid_days || 15} giorni da oggi.</span></div>
        <div class="field"><label class="l" for="qf-disc">Sconto (€)</label><input id="qf-disc" type="number" min="0" step="0.01" inputmode="decimal" value="${q?.discount || ''}" placeholder="0" /></div></div>
    </div>
    <div class="sec"><h3 class="sec-t">Voci del preventivo</h3><div id="qf-items"></div></div>
    <div class="sec"><div class="field"><label class="l" for="qf-notes">Note per il cliente</label><textarea id="qf-notes" rows="2" placeholder="Es. tempi di consegna, garanzia…">${esc(q?.notes || '')}</textarea></div>
      <div class="field"><label class="l" for="qf-terms">Condizioni stampate sul preventivo</label><textarea id="qf-terms" rows="3">${esc(q?.terms || meta?.terms || '')}</textarea></div></div>`,
    { title: q ? `Modifica ${q.code}` : 'Nuovo preventivo', wide: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="qf-ok">Salva preventivo</button>' }
  );
  const cust = bindCustomer(m.el, 'qf-customer', q?.customer_id || preset.customer_id || null);
  const items = itemsEditor(m.el, 'qf-items', q?.items || preset.items || []);
  $('#qf-ok', m.el).onclick = async () => {
    const body = { customer_id: cust.value(), customer_name: $('#qf-name', m.el).value, customer_phone: $('#qf-phone', m.el).value, valid_until: $('#qf-valid', m.el).value, discount: $('#qf-disc', m.el).value,
      items: items.value(), notes: $('#qf-notes', m.el).value, terms: $('#qf-terms', m.el).value };
    const out = await safe(() => (q ? api('PUT', `/api/quotes/${q.id}`, body) : api('POST', '/api/quotes', body)));
    if (out) { m.close(); toast(q ? 'Preventivo aggiornato' : `Preventivo ${out.code} creato`); done?.(); if (!q) openQuote(out.id, done); }
  };
}
