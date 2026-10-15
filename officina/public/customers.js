// Clienti: elenco con ricerca, scheda con storico riparazioni e acquisti.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, statusBadge, waLink, plural } from './util.js';
import { openRepairForm, openRepairDetail } from './repair.js';
import { openDocuments } from './documenti.js';
import { blackBanner, reportDialog } from './blacks.js';

export async function customersView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Clienti</h1>
      <button class="btn btn-primary" id="c-new">＋ Nuovo cliente</button></div>
    <input id="c-q" placeholder="Cerca per nome, ragione sociale, P.IVA, telefono, email…" />
    <div class="card overflow-hidden" id="c-list"></div>`;
  const list = $('#c-list', el);
  async function load(q = '') {
    const rows = await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`));
    list.innerHTML = (rows || []).map((c) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-id="${c.id}">
      <div class="w-9 h-9 rounded-full bg-secondary-light text-secondary-dark flex items-center justify-center font-bold">${esc(c.name.charAt(0).toUpperCase())}</div>
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(c.name)}${c.blacklisted ? ' <span class="badge" style="background:#FEE2E2;color:#991B1B">⛔ Segnalato</span>' : ''}${c.kind === 'azienda' ? ' <span class="badge" style="background:#E0E7FF;color:#3730A3">Azienda</span>' : ''}</p><p class="text-xs text-gray-500">${esc(c.phone || 'nessun telefono')} ${c.email ? '· ' + esc(c.email) : ''}${c.vat_number ? ' · P.IVA ' + esc(c.vat_number) : ''}</p></div>
      <div class="text-xs text-gray-500 text-right">${plural(c.repairs_count, 'riparazione', 'riparazioni')}${c.open_repairs ? `<br><b class="text-secondary">${c.open_repairs} ${c.open_repairs === 1 ? 'aperta' : 'aperte'}</b>` : ''}</div></div>`).join('') || '<p class="empty">Nessun cliente.</p>';
  }
  $('#c-q', el).oninput = debounce((e) => load(e.target.value.trim()));
  $('#c-new', el).onclick = () => editCustomer(null, () => load());
  list.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) openCustomer(Number(r.dataset.id), () => load($('#c-q', el).value.trim())); };
  await load();
}

function editCustomer(c, done) {
  const isCo = c?.kind === 'azienda';
  const m = openModal(
    `<div class="sec">
      <div class="field"><label class="l" for="ce-kind">Tipo cliente</label>
        <select id="ce-kind"><option value="privato"${isCo ? '' : ' selected'}>Privato</option><option value="azienda"${isCo ? ' selected' : ''}>Azienda / professionista</option></select></div>
      <div class="fgrid">
        <div class="field"><label class="l" for="ce-name" id="ce-name-l">${isCo ? 'Ragione sociale *' : 'Nome e cognome *'}</label><input id="ce-name" value="${esc(c?.name || '')}" /></div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ce-phone">Telefono</label><input id="ce-phone" inputmode="tel" value="${esc(c?.phone || '')}" /></div>
        <div class="field"><label class="l" for="ce-email">Email</label><input id="ce-email" type="email" value="${esc(c?.email || '')}" /></div>
      </div>
    </div>
    <div class="sec" id="ce-fisc">
      <h3 class="sec-t">Dati fiscali e indirizzo <span class="hint">(facoltativi)</span></h3>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ce-vat">Partita IVA</label><input id="ce-vat" inputmode="numeric" maxlength="13" value="${esc(c?.vat_number || '')}" /></div>
        <div class="field"><label class="l" for="ce-cf">Codice fiscale</label><input id="ce-cf" maxlength="16" autocapitalize="characters" value="${esc(c?.fiscal_code || '')}" /></div>
      </div>
      <div class="field"><label class="l" for="ce-addr">Indirizzo</label><input id="ce-addr" value="${esc(c?.address || '')}" /></div>
      <div class="fgrid c3">
        <div class="field"><label class="l" for="ce-zip">CAP</label><input id="ce-zip" inputmode="numeric" maxlength="5" value="${esc(c?.zip || '')}" /></div>
        <div class="field"><label class="l" for="ce-city">Città</label><input id="ce-city" value="${esc(c?.city || '')}" /></div>
        <div class="field"><label class="l" for="ce-prov">Provincia</label><input id="ce-prov" maxlength="2" autocapitalize="characters" value="${esc(c?.province || '')}" /></div>
      </div>
      <div class="fgrid c2" id="ce-co">
        <div class="field"><label class="l" for="ce-sdi">Codice SDI</label><input id="ce-sdi" maxlength="7" autocapitalize="characters" value="${esc(c?.sdi_code || '')}" /></div>
        <div class="field"><label class="l" for="ce-pec">PEC</label><input id="ce-pec" type="email" value="${esc(c?.pec || '')}" /></div>
      </div>
    </div>
    <div class="sec"><div class="field"><label class="l" for="ce-notes">Note</label><textarea id="ce-notes" rows="3" placeholder="Informazioni utili sul cliente (facoltative)">${esc(c?.notes || '')}</textarea></div></div>`,
    { title: c ? 'Modifica cliente' : 'Nuovo cliente', footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ce-ok">Salva</button>` }
  );
  const sync = () => {
    const co = $('#ce-kind', m.el).value === 'azienda';
    $('#ce-name-l', m.el).textContent = co ? 'Ragione sociale *' : 'Nome e cognome *';
    $('#ce-co', m.el).classList.toggle('hidden', !co);
  };
  $('#ce-kind', m.el).onchange = sync;
  sync();
  $('#ce-ok', m.el).onclick = async () => {
    const v = (id) => $(id, m.el).value;
    const kind = v('#ce-kind');
    const body = { kind, name: v('#ce-name'), company_name: kind === 'azienda' ? v('#ce-name') : '', phone: v('#ce-phone'), email: v('#ce-email'), vat_number: v('#ce-vat'), fiscal_code: v('#ce-cf'), address: v('#ce-addr'), zip: v('#ce-zip'), city: v('#ce-city'), province: v('#ce-prov'), sdi_code: kind === 'azienda' ? v('#ce-sdi') : '', pec: kind === 'azienda' ? v('#ce-pec') : '', notes: v('#ce-notes') };
    const out = await safe(() => (c ? api('PUT', `/api/customers/${c.id}`, body) : api('POST', '/api/customers', body)));
    if (out) { m.close(); toast('Cliente salvato'); done?.(); }
  };
}

export async function openCustomer(id, done) {
  const c = await safe(() => api('GET', `/api/customers/${id}`));
  if (!c) return;
  const m = openModal(
    `${c.blacklist?.length ? `<section class="sec">${blackBanner(c.blacklist)}</section>` : ''}<section class="sec">
      <dl class="kv">${c.kind === 'azienda' ? '<dt>Tipo</dt><dd>Azienda</dd>' : ''}<dt>Telefono</dt><dd>${esc(c.phone || '—')}</dd><dt>Email</dt><dd>${esc(c.email || '—')}</dd>${c.vat_number ? `<dt>P.IVA</dt><dd>${esc(c.vat_number)}</dd>` : ''}${c.fiscal_code ? `<dt>Codice fiscale</dt><dd>${esc(c.fiscal_code)}</dd>` : ''}${c.address || c.city ? `<dt>Indirizzo</dt><dd>${esc([c.address, [c.zip, c.city].filter(Boolean).join(' '), c.province && '(' + c.province + ')'].filter(Boolean).join(', '))}</dd>` : ''}${c.sdi_code ? `<dt>SDI</dt><dd>${esc(c.sdi_code)}</dd>` : ''}${c.pec ? `<dt>PEC</dt><dd>${esc(c.pec)}</dd>` : ''}${c.notes ? `<dt>Note</dt><dd>${esc(c.notes)}</dd>` : ''}</dl>
      <div class="row tight">
        ${c.phone ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(c.phone, 'Ciao ' + c.name.split(' ')[0] + ',')}">💬 WhatsApp</a><a class="btn btn-outline btn-sm" href="tel:${esc(c.phone)}">📞 Chiama</a>` : ''}
        <button class="btn btn-primary btn-sm" id="cu-new">＋ Nuova riparazione</button>
        <button class="btn btn-outline btn-sm" id="cu-docs">🪪 Documenti</button>
        <button class="btn btn-outline btn-sm" id="cu-edit">Modifica</button>
        ${c.blacklist?.some((b) => b.match === 'cliente') ? '' : '<button class="btn btn-ghost btn-sm" id="cu-black">⛔ Segnala</button>'}
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
  $('#cu-docs', m.el).onclick = () => openDocuments(c);
  const bk = $('#cu-black', m.el);
  if (bk) bk.onclick = () => { m.close(); reportDialog({ customer: c, done: () => { done?.(); openCustomer(c.id, done); } }); };
  $('#cu-edit', m.el).onclick = () => { m.close(); editCustomer(c, done); };
  $('#cu-del', m.el).onclick = async () => {
    if (!(await confirmDelete(c.name, { typed: 'ELIMINA', detail: 'Il cliente e le sue riparazioni concluse vengono cancellati (con i loro incassi in cassa).' }))) return;
    const out = await safe(() => api('DELETE', `/api/customers/${c.id}`));
    if (out) { m.close(); toast('Cliente eliminato'); done?.(); }
  };
  m.el.addEventListener('click', (e) => { const r = e.target.closest('[data-rid]'); if (r) openRepairDetail(Number(r.dataset.rid), done); });
}
