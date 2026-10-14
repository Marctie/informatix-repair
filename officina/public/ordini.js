// Ordini: cosa ordinare al fornitore per un cliente (o per il negozio), con stato, acconto e avviso all'arrivo.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, waLink, META } from './util.js';
import { customerField, bindCustomer, itemsEditor, methodSelect } from './pickers.js';

const STATUS = {
  da_ordinare: { label: 'Da ordinare', cls: 'bg-gray-100 text-gray-700', next: 'ordinato', nextLabel: 'Segna ordinato' },
  ordinato: { label: 'Ordinato', cls: 'bg-blue-100 text-blue-700', next: 'arrivato', nextLabel: 'È arrivato' },
  arrivato: { label: 'Arrivato', cls: 'bg-emerald-100 text-emerald-700', next: 'consegnato', nextLabel: 'Consegna' },
  consegnato: { label: 'Consegnato', cls: 'bg-gray-200 text-gray-600' },
  annullato: { label: 'Annullato', cls: 'bg-red-100 text-red-700' },
};
const badge = (s) => `<span class="badge ${STATUS[s]?.cls || ''}">${esc(STATUS[s]?.label || s)}</span>`;
const itemsText = (o) => (o.items || []).map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.description}`).join(', ');
const shop = () => META.settings.shop_name || 'Informatix Repair';

/** Messaggio WhatsApp per il cliente quando l'ordine è arrivato. */
export const arrivedMessage = (o) => `Ciao ${String(o.customer_name || '').split(' ')[0]}, da ${shop()}: è arrivato il tuo ordine (${itemsText(o)}). ${o.balance > 0 ? `Resta da saldare ${eur(o.balance)}. ` : ''}Puoi passare a ritirarlo quando vuoi!`;

function orderRow(o) {
  const st = STATUS[o.status];
  const who = o.kind === 'cliente' ? o.customer_name : `Negozio${o.supplier_name ? ` · ${o.supplier_name}` : ''}`;
  return `<div class="row-h flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-open="${o.id}">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-sm">${esc(who)}</span>${badge(o.status)}${o.kind === 'fornitore' ? '<span class="badge bg-gray-100 text-gray-700">Per il negozio</span>' : ''}
        ${o.status === 'ordinato' && o.expected_date && o.expected_date < new Date().toISOString().slice(0, 10) ? '<span class="badge bg-red-100 text-red-700">⏰ In ritardo</span>' : ''}</div>
      <p class="text-xs text-gray-500 truncate">${esc(o.code)} · ${esc(itemsText(o))}${o.expected_date ? ` · atteso ${fdate(o.expected_date)}` : ''}${o.repair_code ? ` · rip. ${esc(o.repair_code)}` : ''}</p>
    </div>
    <div class="flex items-center gap-1.5 shrink-0" data-stop>
      ${o.total ? `<span class="text-sm font-semibold">${eur(o.total)}${o.paid ? `<span class="hint"> · acconto ${eur(o.paid)}</span>` : ''}</span>` : ''}
      ${o.status === 'arrivato' && o.kind === 'cliente' && waLink(o.customer_phone, '') ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(o.customer_phone, arrivedMessage(o))}" title="Avvisa su WhatsApp">💬 Avvisa</a>` : ''}
      ${st.next ? `<button class="btn btn-dark btn-sm" data-adv="${o.id}" data-next="${st.next}">${st.nextLabel} →</button>` : ''}
    </div></div>`;
}

export async function ordiniView(el, params) {
  let stato = params.get('stato') || 'aperti';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Ordini</h1>
      <div class="row"><button class="btn btn-outline" id="o-toorder">📋 Da ordinare</button><button class="btn btn-primary" id="o-new">＋ Nuovo ordine</button></div></div>
    <input id="o-q" type="search" placeholder="Cerca per cliente, articolo, fornitore, codice…" />
    <div class="flex gap-2 flex-wrap chips-scroll" id="o-chips"></div>
    <div class="card overflow-hidden" id="o-list"></div>`;
  const list = $('#o-list', el);
  const chips = [['aperti', 'Aperti'], ['da_ordinare', 'Da ordinare'], ['ordinato', 'Ordinati'], ['arrivato', 'Arrivati'], ['consegnato', 'Consegnati'], ['annullato', 'Annullati'], ['', 'Tutti']];
  async function load() {
    $('#o-chips', el).innerHTML = chips.map(([k, l]) => `<span class="chip ${stato === k ? 'on' : ''}" data-f="${k}">${l}</span>`).join('');
    const rows = await safe(() => api('GET', `/api/orders?stato=${stato}&q=${encodeURIComponent(q)}`));
    list.innerHTML = rows?.length ? rows.map(orderRow).join('') : '<p class="empty">Nessun ordine. Premi “Nuovo ordine” per registrarne uno (es. pellicola per un cliente).</p>';
  }
  $('#o-chips', el).onclick = (e) => { const c = e.target.closest('[data-f]'); if (c) { stato = c.dataset.f; load(); } };
  $('#o-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#o-new', el).onclick = () => orderForm(null, load);
  $('#o-toorder', el).onclick = () => toOrderDialog(load);
  list.onclick = async (e) => {
    const adv = e.target.closest('[data-adv]');
    if (adv) { e.stopPropagation(); return advance(Number(adv.dataset.adv), adv.dataset.next, load); }
    if (e.target.closest('[data-stop]')) return;
    const r = e.target.closest('[data-open]');
    if (r) openOrder(Number(r.dataset.open), load);
  };
  await load();
}

/** Passa allo stato successivo; alla consegna chiede se incassare il saldo. */
async function advance(id, next, done) {
  if (next === 'consegnato') return deliverDialog(id, done);
  await safe(async () => { await api('POST', `/api/orders/${id}/status`, { status: next }); toast(next === 'arrivato' ? 'Arrivato: avvisa il cliente' : 'Stato aggiornato'); });
  done?.();
}

async function deliverDialog(id, done) {
  const o = await safe(() => api('GET', `/api/orders/${id}`));
  if (!o) return;
  const m = openModal(`<div class="sec"><p class="text-sm">Consegna dell'ordine <b>${esc(o.code)}</b>${o.customer_name ? ` a <b>${esc(o.customer_name)}</b>` : ''}.</p>
    ${o.balance > 0 ? `<div class="fgrid c2"><div class="field"><label class="l">Saldo da incassare</label><input value="${eur(o.balance)}" disabled /></div>
      <div class="field"><label class="l" for="dv-method">Incassato con</label>${methodSelect('dv-method')}</div></div>` : '<p class="hint">Già pagato per intero.</p>'}</div>`,
    { title: 'Consegna ordine', footer: `<button class="btn btn-outline" data-close>Annulla</button>${o.balance > 0 ? '<button class="btn btn-primary" id="dv-pay">Incassa e consegna</button>' : ''}<button class="btn btn-dark" id="dv-go">${o.balance > 0 ? 'Consegna senza incasso' : 'Consegna'}</button>` });
  const go = (collect) => async () => { const r = await safe(() => api('POST', `/api/orders/${id}/status`, { status: 'consegnato', collect, method: $('#dv-method', m.el)?.value })); if (r) { m.close(); toast('Ordine consegnato'); done?.(); } };
  $('#dv-go', m.el).onclick = go(false);
  if ($('#dv-pay', m.el)) $('#dv-pay', m.el).onclick = go(true);
}

export async function openOrder(id, done) {
  const o = await safe(() => api('GET', `/api/orders/${id}`));
  if (!o) return;
  const st = STATUS[o.status];
  const open = !['consegnato', 'annullato'].includes(o.status);
  const m = openModal(
    `<section class="sec">
      <dl class="kv"><dt>Stato</dt><dd>${badge(o.status)}</dd>
        <dt>Per</dt><dd>${o.kind === 'cliente' ? `${esc(o.customer_name)}${o.customer_phone ? ` · ${esc(o.customer_phone)}` : ''}` : 'Negozio'}</dd>
        ${o.supplier_name ? `<dt>Fornitore</dt><dd>${esc(o.supplier_name)}</dd>` : ''}${o.repair_code ? `<dt>Riparazione</dt><dd>${esc(o.repair_code)}</dd>` : ''}
        ${o.expected_date ? `<dt>Atteso il</dt><dd>${fdate(o.expected_date)}</dd>` : ''}${o.notes ? `<dt>Note</dt><dd>${esc(o.notes)}</dd>` : ''}
        <dt>Creato</dt><dd>${fdate(o.created_at)}${o.arrived_at ? ` · arrivato ${fdate(o.arrived_at)}` : ''}${o.delivered_at ? ` · consegnato ${fdate(o.delivered_at)}` : ''}</dd></dl>
    </section>
    <section class="sec"><h3 class="sec-t">Articoli</h3>
      <div class="plist">${o.items.map((i) => `<div><span>${i.qty}× ${esc(i.description)}</span><b>${i.unit_price ? eur(i.qty * i.unit_price) : ''}</b></div>`).join('')}</div>
      ${o.total ? `<dl class="kv"><dt>Totale</dt><dd><b>${eur(o.total)}</b></dd><dt>Acconto/pagato</dt><dd>${eur(o.paid)}</dd><dt>Da saldare</dt><dd><b>${eur(o.balance)}</b></dd></dl>` : ''}
    </section>
    <section class="sec"><div class="row">
      ${open && st.next ? `<button class="btn btn-dark btn-sm" id="od-adv">${st.nextLabel} →</button>` : ''}
      ${o.status === 'arrivato' && o.kind === 'cliente' && waLink(o.customer_phone, '') ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(o.customer_phone, arrivedMessage(o))}">💬 Avvisa il cliente</a>` : ''}
      ${open && o.kind === 'cliente' && o.balance > 0 ? '<button class="btn btn-outline btn-sm" id="od-dep">＋ Acconto</button>' : ''}
      ${open ? '<button class="btn btn-outline btn-sm" id="od-edit">Modifica</button>' : ''}
      ${open ? '<button class="btn btn-ghost btn-sm" id="od-cancel">Annulla ordine</button>' : ''}
      ${o.status === 'annullato' ? '<button class="btn btn-outline btn-sm" id="od-reopen">Riapri</button>' : ''}
      <button class="btn btn-ghost btn-sm" id="od-del">Elimina</button></div></section>`,
    { title: `Ordine ${o.code}`, wide: true }
  );
  const reload = () => { m.close(); done?.(); };
  const again = () => { m.close(); openOrder(id, done); done?.(); };
  if ($('#od-adv', m.el)) $('#od-adv', m.el).onclick = async () => { if (st.next === 'consegnato') { m.close(); return deliverDialog(id, done); } await advance(id, st.next); again(); };
  if ($('#od-dep', m.el)) $('#od-dep', m.el).onclick = () => depositDialog(o, again);
  if ($('#od-edit', m.el)) $('#od-edit', m.el).onclick = () => { m.close(); orderForm(o, done); };
  if ($('#od-cancel', m.el)) $('#od-cancel', m.el).onclick = async () => { if (confirm('Annullare l’ordine?')) { await safe(() => api('POST', `/api/orders/${id}/status`, { status: 'annullato' })); again(); } };
  if ($('#od-reopen', m.el)) $('#od-reopen', m.el).onclick = async () => { await safe(() => api('POST', `/api/orders/${id}/status`, { status: 'da_ordinare' })); again(); };
  $('#od-del', m.el).onclick = async () => {
    if (!(await confirmDelete(`l’ordine ${o.code}`, { detail: o.paid ? 'Ha incassi registrati: andrà annullato, non eliminato.' : '' }))) return;
    if (await safe(() => api('DELETE', `/api/orders/${id}`))) { toast('Ordine eliminato'); reload(); }
  };
}

function depositDialog(o, done) {
  const m = openModal(`<div class="sec"><div class="fgrid c2"><div class="field"><label class="l" for="dp-amt">Importo (max ${eur(o.balance)})</label><input id="dp-amt" type="number" min="0" step="0.01" inputmode="decimal" /></div>
    <div class="field"><label class="l" for="dp-method">Pagato con</label>${methodSelect('dp-method')}</div></div></div>`,
  { title: 'Acconto ordine', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="dp-ok">Incassa acconto</button>' });
  $('#dp-ok', m.el).onclick = async () => {
    if (await safe(() => api('POST', `/api/orders/${o.id}/deposit`, { amount: $('#dp-amt', m.el).value, method: $('#dp-method', m.el).value }))) { m.close(); toast('Acconto registrato'); done?.(); }
  };
}

export async function orderForm(o, done, preset = {}) {
  const sups = (await safe(() => api('GET', '/api/suppliers'))) || [];
  const kind0 = o?.kind || preset.kind || 'cliente';
  const m = openModal(
    `<div class="sec">
      <div class="field"><label class="l" for="of-kind">Ordine</label><select id="of-kind" ${o ? 'disabled' : ''}><option value="cliente">Per un cliente</option><option value="fornitore">Per il negozio (scorte)</option></select></div>
      <div id="of-cust">${customerField('of-customer', 'Cliente', { required: true })}</div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="of-sup">Fornitore (facoltativo)</label><select id="of-sup"><option value="">— da decidere —</option>${sups.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="l" for="of-eta">Data prevista di arrivo</label><input id="of-eta" type="date" value="${esc(o?.expected_date || '')}" /></div>
      </div>
    </div>
    <div class="sec"><h3 class="sec-t">Articoli da ordinare</h3><div id="of-items"></div></div>
    <div class="sec" id="of-money"><h3 class="sec-t">Acconto</h3>
      ${o ? '<p class="hint">L’acconto si aggiunge dalla scheda dell’ordine.</p>' : `<div class="fgrid c2"><div class="field"><label class="l" for="of-dep">Acconto incassato ora (€)</label><input id="of-dep" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" /></div>
        <div class="field"><label class="l" for="of-method">Pagato con</label>${methodSelect('of-method')}</div></div>`}</div>
    <div class="sec"><div class="field"><label class="l" for="of-notes">Note</label><textarea id="of-notes" rows="2" placeholder="Es. colore, modello esatto, link del prodotto…">${esc(o?.notes || '')}</textarea></div></div>`,
    { title: o ? `Modifica ${o.code}` : 'Nuovo ordine', wide: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="of-ok">Salva ordine</button>' }
  );
  const kindEl = $('#of-kind', m.el);
  kindEl.value = kind0;
  $('#of-sup', m.el).value = o?.supplier_id || preset.supplier_id || '';
  const cust = bindCustomer(m.el, 'of-customer', o?.customer_id || preset.customer_id || null, { allowNone: false });
  const items = itemsEditor(m.el, 'of-items', o?.items || preset.items || []);
  const sync = () => { const c = kindEl.value === 'cliente'; $('#of-cust', m.el).classList.toggle('hidden', !c); $('#of-money', m.el).classList.toggle('hidden', !c); };
  kindEl.onchange = sync;
  sync();
  $('#of-ok', m.el).onclick = async () => {
    const body = { kind: kindEl.value, customer_id: cust.value(), supplier_id: $('#of-sup', m.el).value || null, expected_date: $('#of-eta', m.el).value || null, notes: $('#of-notes', m.el).value, items: items.value(), repair_id: o?.repair_id || preset.repair_id || null };
    if (!o) { body.deposit = $('#of-dep', m.el)?.value || 0; body.deposit_method = $('#of-method', m.el)?.value; }
    const out = await safe(() => (o ? api('PUT', `/api/orders/${o.id}`, body) : api('POST', '/api/orders', body)));
    if (out) { m.close(); toast(o ? 'Ordine aggiornato' : `Ordine ${out.code} creato`); done?.(); }
  };
}

/** Elenco "da ordinare" raggruppato per fornitore, con messaggio pronto e conferma di ordine unico. */
async function toOrderDialog(done) {
  const groups = (await safe(() => api('GET', '/api/orders/to-order'))) || [];
  const textOf = (g) => `Buongiorno, da ${shop()} vorremmo ordinare:\n${g.lines.map((l) => `- ${l.qty}× ${l.description}`).join('\n')}\nGrazie!`;
  const m = openModal(groups.length ? groups.map((g, n) => `<section class="sec"><h3 class="sec-t">${esc(g.supplier_name)}</h3>
      <div class="plist">${g.lines.map((l) => `<div><span>${l.qty}× ${esc(l.description)} <span class="hint">${esc(l.code)} · per ${esc(l.for || '—')}</span></span></div>`).join('')}</div>
      <div class="row">${g.supplier_phone ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(g.supplier_phone, textOf(g))}">💬 WhatsApp</a>` : ''}
        ${g.supplier_email ? `<a class="btn btn-outline btn-sm" href="mailto:${esc(g.supplier_email)}?subject=${encodeURIComponent('Ordine ' + shop())}&body=${encodeURIComponent(textOf(g))}">✉️ Email</a>` : ''}
        <button class="btn btn-outline btn-sm" data-copy="${n}">Copia testo</button><button class="btn btn-dark btn-sm" data-sent="${n}">Fatto: segna ordinati</button></div></section>`).join('')
    : '<p class="empty">Niente da ordinare: tutti gli ordini sono già stati inviati ai fornitori 👍</p>', { title: 'Da ordinare ai fornitori', wide: true });
  m.el.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { try { await navigator.clipboard.writeText(textOf(groups[Number(c.dataset.copy)])); toast('Testo copiato'); } catch { toast('Copia non riuscita', false); } }
    const s = e.target.closest('[data-sent]');
    if (s && (await safe(() => api('POST', '/api/orders/mark-ordered', { ids: groups[Number(s.dataset.sent)].order_ids })))) { m.close(); toast('Ordini segnati come ordinati'); done?.(); }
  });
}
