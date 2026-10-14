// Clienti: elenco con ricerca, scheda con storico riparazioni e acquisti.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, statusBadge, waLink, plural } from './util.js';
import { openRepairForm, openRepairDetail } from './repair.js';

export async function customersView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Clienti</h1>
      <button class="btn btn-primary" id="c-new">＋ Nuovo cliente</button></div>
    <input id="c-q" placeholder="Cerca per nome, telefono o email…" />
    <div class="card overflow-hidden" id="c-list"></div>`;
  const list = $('#c-list', el);
  async function load(q = '') {
    const rows = await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`));
    list.innerHTML = (rows || []).map((c) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-id="${c.id}">
      <div class="w-9 h-9 rounded-full bg-secondary-light text-secondary-dark flex items-center justify-center font-bold">${esc(c.name.charAt(0).toUpperCase())}</div>
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(c.name)}</p><p class="text-xs text-gray-500">${esc(c.phone || 'nessun telefono')} ${c.email ? '· ' + esc(c.email) : ''}</p></div>
      <div class="text-xs text-gray-500 text-right">${plural(c.repairs_count, 'riparazione', 'riparazioni')}${c.open_repairs ? `<br><b class="text-secondary">${c.open_repairs} ${c.open_repairs === 1 ? 'aperta' : 'aperte'}</b>` : ''}</div></div>`).join('') || '<p class="empty">Nessun cliente.</p>';
  }
  $('#c-q', el).oninput = debounce((e) => load(e.target.value.trim()));
  $('#c-new', el).onclick = () => editCustomer(null, () => load());
  list.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) openCustomer(Number(r.dataset.id), () => load($('#c-q', el).value.trim())); };
  await load();
}

function editCustomer(c, done) {
  const m = openModal(
    `<div class="sec">
      <div class="fgrid">
        <div class="field"><label class="l" for="ce-name">Nome e cognome *</label><input id="ce-name" value="${esc(c?.name || '')}" /></div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ce-phone">Telefono</label><input id="ce-phone" inputmode="tel" value="${esc(c?.phone || '')}" /></div>
        <div class="field"><label class="l" for="ce-email">Email</label><input id="ce-email" type="email" value="${esc(c?.email || '')}" /></div>
      </div>
      <div class="field"><label class="l" for="ce-notes">Note</label><textarea id="ce-notes" rows="3" placeholder="Informazioni utili sul cliente (facoltative)">${esc(c?.notes || '')}</textarea></div>
    </div>`,
    { title: c ? 'Modifica cliente' : 'Nuovo cliente', footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ce-ok">Salva</button>` }
  );
  $('#ce-ok', m.el).onclick = async () => {
    const body = { name: $('#ce-name', m.el).value, phone: $('#ce-phone', m.el).value, email: $('#ce-email', m.el).value, notes: $('#ce-notes', m.el).value };
    const out = await safe(() => (c ? api('PUT', `/api/customers/${c.id}`, body) : api('POST', '/api/customers', body)));
    if (out) { m.close(); toast('Cliente salvato'); done?.(); }
  };
}

export async function openCustomer(id, done) {
  const c = await safe(() => api('GET', `/api/customers/${id}`));
  if (!c) return;
  const m = openModal(
    `<section class="sec">
      <dl class="kv"><dt>Telefono</dt><dd>${esc(c.phone || '—')}</dd><dt>Email</dt><dd>${esc(c.email || '—')}</dd>${c.notes ? `<dt>Note</dt><dd>${esc(c.notes)}</dd>` : ''}</dl>
      <div class="row tight">
        ${c.phone ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(c.phone, 'Ciao ' + c.name.split(' ')[0] + ',')}">💬 WhatsApp</a><a class="btn btn-outline btn-sm" href="tel:${esc(c.phone)}">📞 Chiama</a>` : ''}
        <button class="btn btn-primary btn-sm" id="cu-new">＋ Nuova riparazione</button>
        <button class="btn btn-outline btn-sm" id="cu-edit">Modifica</button>
        <button class="btn btn-ghost btn-sm" id="cu-del">Elimina</button>
      </div>
    </section>
    <section class="sec">
      <h3 class="sec-t">Riparazioni (${c.repairs.length})</h3>
      <div class="plist">${c.repairs.map((r) => `<div class="row-h" style="cursor:pointer;flex-wrap:wrap" data-rid="${r.id}"><span class="row tight"><b>${esc(r.brand_model)}</b> ${statusBadge(r)}</span><span class="hint">${esc(r.code)} · ${fdate(r.created_at)}</span></div>`).join('') || '<p class="hint">Nessuna riparazione.</p>'}</div>
    </section>
    <section class="sec">
      <h3 class="sec-t">Acquisti (${c.sales.length})</h3>
      <div class="plist">${c.sales.map((s) => `<div><span>${esc(s.code)} <span class="hint">${fdate(s.created_at)}</span></span><b>${eur(s.total)}</b></div>`).join('') || '<p class="hint">Nessun acquisto.</p>'}</div>
    </section>`,
    { title: c.name, wide: true }
  );
  $('#cu-new', m.el).onclick = () => { m.close(); openRepairForm(done, { name: c.name, phone: c.phone }); };
  $('#cu-edit', m.el).onclick = () => { m.close(); editCustomer(c, done); };
  $('#cu-del', m.el).onclick = async () => {
    if (!(await confirmDelete(c.name, { typed: 'ELIMINA', detail: 'Cliente e dati collegati.' }))) return;
    const out = await safe(() => api('DELETE', `/api/customers/${c.id}`));
    if (out) { m.close(); toast('Cliente eliminato'); done?.(); }
  };
  m.el.addEventListener('click', (e) => { const r = e.target.closest('[data-rid]'); if (r) openRepairDetail(Number(r.dataset.rid), done); });
}
