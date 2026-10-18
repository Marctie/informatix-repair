// Magazzino (con "Da ordinare") e Fornitori.
import { $, $$, esc, eur, fdt, api, toast, safe, debounce, openModal, confirmDelete, waLink, canSeeCosts } from './util.js';
import { loadStockDialog } from './carico.js';

const CATEGORIES = ['Ricambi', 'Accessori', 'Cavi e caricatori', 'Usato / ricondizionato', 'Software e servizi', 'Altro'];

export async function stockView(el, params) {
  let tab = params.get('tab') === 'reorder' ? 'reorder' : 'all';
  let q = '';
  let area = ''; // area (categoria) selezionata: '' = tutte
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Magazzino</h1>
      <span class="row tight">${canSeeCosts() ? '<button class="btn btn-outline" id="p-load">📥 Carico merce</button>' : ''}<button class="btn btn-primary" id="p-new">＋ Nuovo articolo</button></span></div>
    <div id="p-kpi" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>
    <div class="flex gap-3 items-center flex-wrap"><span class="chip" data-t="all">Tutti</span><select id="p-area" class="chip" aria-label="Area del magazzino" style="min-height:44px;font-size:.95rem"></select><span class="chip" data-t="reorder">📉 Da ordinare</span>
      <input id="p-q" type="search" placeholder="Cerca articolo…" class="sm:!w-64 w-full sm:ml-auto" /></div>
    <div class="card overflow-hidden" id="p-list"></div>`;
  const list = $('#p-list', el);

  async function load() {
    if (!$('#p-q', el)) return; // pagina cambiata nel frattempo
    $$('[data-t]', el).forEach((c) => c.classList.toggle('on', c.dataset.t === tab && !(c.dataset.t === 'all' && area)));
    $('#p-q', el).classList.toggle('hidden', tab === 'reorder');
    $('#p-area', el).classList.toggle('hidden', tab === 'reorder');
    const sum = await safe(() => api('GET', '/api/stock/summary'));
    if (sum && $('#p-kpi', el)) $('#p-kpi', el).innerHTML = [[sum.items, 'Articoli a catalogo', ''], [sum.units, 'Pezzi in magazzino', ''], ...(canSeeCosts() ? [[eur(sum.value_cost), 'Valore a costo', '']] : []), [sum.low, 'Sotto scorta', sum.low ? 'text-amber-600' : '']].map(([n, l, c]) => `<div class="card kpi"><b class="${c}">${n}</b><span>${l}</span></div>`).join('');
    if (tab === 'reorder') return loadReorder();
    const everything = (await safe(() => api('GET', '/api/products?q='))) || [];
    drawAreas(everything);
    const rows = ((await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`))) || []).filter((p) => !area || (p.category || 'Altro') === area);
    const badge = (p) => {
      const low = p.min_qty > 0 && p.qty <= p.min_qty;
      return `<span class="badge ${p.qty <= 0 ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}">${p.qty} pz${low ? ' · basso' : ''}</span>`;
    };
    const meta = (p) => [p.sku, p.location, p.supplier_name].filter(Boolean).map(esc).join(' · ');
    const stepper = (p) => `<span class="row tight" data-stop><button class="btn btn-outline btn-sm" data-mv="${p.id}" data-d="-1" aria-label="Togli uno">−1</button><button class="btn btn-outline btn-sm" data-mv="${p.id}" data-d="1" aria-label="Aggiungi uno">+1</button></span>`;
    const list2 = rows || [];
    if (!list2.length) { list.innerHTML = '<p class="empty">Nessun articolo. Aggiungi il primo con “Nuovo articolo”.</p>'; return; }
    list.innerHTML =
      `<div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Articolo</th><th>Categoria</th><th>Giacenza</th>${canSeeCosts() ? '<th>Costo</th>' : ''}<th>Prezzo</th><th></th></tr></thead><tbody>` +
      list2.map((p) => `<tr class="row-h" style="cursor:pointer" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="hint">${meta(p)}</div></td>
          <td class="hint" style="font-size:.85rem">${esc(p.category || '—')}</td><td>${badge(p)}</td>${canSeeCosts() ? `<td>${eur(p.cost)}</td>` : ''}<td><b>${eur(p.price)}</b></td><td data-stop style="white-space:nowrap">${stepper(p)}</td></tr>`).join('') +
      '</tbody></table></div>' +
      `<div class="only-narrow">${list2.map((p) => `<div class="pcard" style="cursor:pointer" data-id="${p.id}">
          <div class="top"><span class="name">${esc(p.name)}</span>${badge(p)}</div>
          <div class="sub">${[p.category, meta(p)].filter(Boolean).join(' · ')}</div>
          <div class="top" style="align-items:center"><span>${canSeeCosts() ? `<span class="sub">Costo</span> ${eur(p.cost)} &nbsp;·&nbsp; ` : ''}<span class="sub">Prezzo</span> <b>${eur(p.price)}</b></span>${stepper(p)}</div></div>`).join('')}</div>`;
  }

  /** Menu a tendina delle aree: elenco standard + eventuali categorie già usate, con il numero di articoli. */
  function drawAreas(all) {
    const counts = {};
    all.forEach((p) => { const k = p.category || 'Altro'; counts[k] = (counts[k] || 0) + 1; });
    const names = [...new Set([...CATEGORIES, ...Object.keys(counts)])];
    const sel = $('#p-area', el);
    if (!sel) return; // pagina cambiata nel frattempo
    sel.innerHTML = `<option value="">Aree ▾</option>` + names.map((n) => `<option value="${esc(n)}" ${n === area ? 'selected' : ''}>${esc(n)} (${counts[n] || 0})</option>`).join('');
    sel.classList.toggle('on', !!area);
    if (area && !names.includes(area)) area = '';
    sel.value = area;
  }

  async function loadReorder() {
    const rows = await safe(() => api('GET', '/api/reorder'));
    const groups = {};
    (rows || []).forEach((p) => { (groups[p.supplier_name || 'Senza fornitore'] ||= []).push(p); });
    list.innerHTML = Object.entries(groups).map(([name, items]) => {
      const sup = items[0];
      const text = `Buongiorno, vorrei ordinare:\n${items.map((p) => `- ${p.name}: ${Math.max(1, p.min_qty * 2 - p.qty)} pz`).join('\n')}\nGrazie.`;
      const wa = waLink(sup.supplier_phone, text);
      const mail = sup.supplier_email ? `mailto:${sup.supplier_email}?subject=${encodeURIComponent('Ordine')}&body=${encodeURIComponent(text)}` : null;
      return `<div class="border-b border-line last:border-0"><div class="px-4 py-3 bg-lightbg flex items-center justify-between gap-2 flex-wrap"><b>🚚 ${esc(name)}</b>
        <div class="flex gap-2 flex-wrap">${wa ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${wa}">💬 Ordina su WhatsApp</a>` : ''}${mail ? `<a class="btn btn-outline btn-sm" href="${mail}">✉️ Email</a>` : ''}
        <button class="btn btn-outline btn-sm" data-copy="${esc(text)}">📋 Copia ordine</button></div></div>
        ${items.map((p) => `<div class="px-4 py-2.5 border-t border-line" style="display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;font-size:.9rem"><span style="min-width:0;overflow-wrap:anywhere">${esc(p.name)}</span><span class="hint">${p.qty} in magazzino · minimo ${p.min_qty} · suggerito <b>${Math.max(1, p.min_qty * 2 - p.qty)}</b></span></div>`).join('')}</div>`;
    }).join('') || '<p class="empty">Niente da riordinare: tutte le scorte sono sopra il minimo ✔</p>';
  }

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-t]');
    if (t) { tab = t.dataset.t; if (tab !== 'all') area = ''; if (tab === 'all') area = ''; return load(); }
    const cp = e.target.closest('[data-copy]');
    if (cp) { await navigator.clipboard?.writeText(cp.dataset.copy); return toast('Ordine copiato'); }
    const mv = e.target.closest('[data-mv]');
    if (mv) { e.stopPropagation(); await safe(() => api('POST', `/api/products/${mv.dataset.mv}/move`, { delta: Number(mv.dataset.d), reason: 'rettifica rapida' })); return load(); }
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('tr[data-id], .pcard[data-id]');
    if (row) productForm(Number(row.dataset.id), load);
  });
  $('#p-area', el).onchange = (e) => { area = e.target.value; tab = 'all'; load(); };
  $('#p-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#p-new', el).onclick = () => productForm(null, load);
  if ($('#p-load', el)) $('#p-load', el).onclick = () => loadStockDialog({ done: load });
  await load();
}

async function productForm(id, done) {
  const [suppliers, p] = await Promise.all([api('GET', '/api/suppliers'), id ? api('GET', `/api/products?q=`).then((l) => l.find((x) => x.id === id)) : null]);
  const moves = id ? await api('GET', `/api/products/${id}/moves`) : [];
  const m = openModal(
    `<section class="sec">
      <div class="field"><label class="l" for="pf-name">Nome articolo *</label><input id="pf-name" value="${esc(p?.name || '')}" /></div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="pf-cat">Categoria</label><input id="pf-cat" list="pf-cats" value="${esc(p?.category || '')}" /><datalist id="pf-cats">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</datalist></div>
        <div class="field"><label class="l" for="pf-sku">Codice / SKU</label><input id="pf-sku" value="${esc(p?.sku || '')}" /></div>
        ${id ? `<div class="field"><label class="l">Giacenza attuale</label><input value="${p.qty} pz" disabled /></div>` : '<div class="field"><label class="l" for="pf-qty">Quantità iniziale</label><input id="pf-qty" inputmode="numeric" value="0" /></div>'}
        <div class="field"><label class="l" for="pf-min">Scorta minima</label><input id="pf-min" inputmode="numeric" value="${p?.min_qty ?? 0}" /><span class="hint">Sotto questa quantità compare in “Da ordinare”.</span></div>
        <div class="field"><label class="l" for="pf-stale">Fermo dopo (giorni)</label><input id="pf-stale" inputmode="numeric" value="${p?.stale_days ?? ''}" placeholder="generale" /><span class="hint">Vuoto = soglia generale (Impostazioni). 0 = non avvisare mai.</span></div>
        ${canSeeCosts() ? `<div class="field"><label class="l" for="pf-cost">Costo d’acquisto €</label><input id="pf-cost" inputmode="decimal" value="${p?.cost ?? ''}" /></div>` : ""}
        <div class="field"><label class="l" for="pf-price">Prezzo di vendita €</label><input id="pf-price" inputmode="decimal" value="${p?.price ?? ''}" /></div>
        <div class="field"><label class="l" for="pf-sup">Fornitore</label><select id="pf-sup"><option value="">—</option>${suppliers.map((s) => `<option value="${s.id}" ${p?.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="l" for="pf-loc">Posizione</label><input id="pf-loc" placeholder="es. cassetto A2" value="${esc(p?.location || '')}" /></div>
      </div>
      <div class="field"><label class="l" for="pf-notes">Note</label><input id="pf-notes" value="${esc(p?.notes || '')}" /></div>
    </section>
    ${id ? `<section class="sec"><h3 class="sec-t">Carico merce</h3>
      ${canSeeCosts()
        ? '<div class="row"><button class="btn btn-outline" id="pf-loadfull" style="max-width:100%;height:auto;white-space:normal;text-align:left;line-height:1.3;padding-block:.6rem">📥 Carico merce con fornitore e prezzo…</button></div><p class="hint">Quantità, fornitore, prezzo d’acquisto, data e documento: aggiorna giacenza, ultimo costo e storico prezzi.</p>'
        : '<div class="row" style="flex-wrap:nowrap"><input id="pf-add" inputmode="numeric" placeholder="Quantità arrivata" style="max-width:12rem" /><button class="btn btn-outline" id="pf-load">Registra carico</button></div>'}</section>
    <section class="sec"><h3 class="sec-t">Ultimi movimenti</h3>
      <ul class="tl">${moves.slice(0, 8).map((x) => `<li><time>${fdt(x.created_at)}</time><span><b class="${x.delta > 0 ? 'text-emerald-600' : 'text-secondary'}">${x.delta > 0 ? '+' : ''}${x.delta}</b> · ${esc(x.reason)} ${esc(x.ref || '')}</span></li>`).join('') || '<li><span class="hint">Nessun movimento.</span></li>'}</ul></section>` : ''}`,
    { title: id ? 'Modifica articolo' : 'Nuovo articolo', wide: true,
      footer: `${id ? '<button class="btn btn-ghost mr-auto" id="pf-del">Archivia</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="pf-ok">Salva</button>` }
  );
  const r = m.el;
  $('#pf-ok', r).onclick = async () => {
    const body = { name: $('#pf-name', r).value, category: $('#pf-cat', r).value, sku: $('#pf-sku', r).value, min_qty: $('#pf-min', r).value, stale_days: $('#pf-stale', r).value, cost: $('#pf-cost', r)?.value, price: $('#pf-price', r).value, supplier_id: $('#pf-sup', r).value || null, location: $('#pf-loc', r).value, notes: $('#pf-notes', r).value };
    if (!id) body.qty = $('#pf-qty', r).value;
    const out = await safe(() => (id ? api('PUT', `/api/products/${id}`, body) : api('POST', '/api/products', body)));
    if (out) { m.close(); toast('Articolo salvato'); done(); }
  };
  if (id) {
    if ($('#pf-load', r)) $('#pf-load', r).onclick = async () => {
      const out = await safe(() => api('POST', `/api/products/${id}/move`, { delta: Number($('#pf-add', r).value), reason: 'carico merce' }));
      if (out) { m.close(); toast(`Giacenza: ${out.qty} pz`); done(); }
    };
    if ($('#pf-loadfull', r)) $('#pf-loadfull', r).onclick = () => { m.close(); loadStockDialog({ product: p, done }); };
    $('#pf-del', r).onclick = async () => {
      if (!(await confirmDelete('questo articolo', { verb: 'Archiviare', detail: 'Lo storico resta.' }))) return;
      await safe(() => api('DELETE', `/api/products/${id}`)); m.close(); done();
    };
  }
}

// ---------- Fornitori ----------
const agentLine = (s) => { try { const a = JSON.parse(s.agents || '[]')[0]; return a ? `<p class="text-xs text-gray-500">Agente: ${esc(a.name || '')} ${a.phone ? '· ' + esc(a.phone) : ''}</p>` : ''; } catch { return ''; } };
export async function suppliersView(el) {
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Fornitori</h1>
    <button class="btn btn-primary" id="s-new">＋ Nuovo fornitore</button></div><div class="card overflow-hidden" id="s-list"></div>`;
  const list = $('#s-list', el);
  async function load() {
    const rows = await safe(() => api('GET', '/api/suppliers'));
    list.innerHTML = (rows || []).map((s) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-id="${s.id}">
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(s.name)}</p><p class="text-xs text-gray-500">${esc(s.phone || '')} ${s.email ? '· ' + esc(s.email) : ''} ${s.website ? '· ' + esc(s.website) : ''}</p>${agentLine(s)}</div>
      <span class="text-xs text-gray-500">${s.products_count} articoli</span>
      ${s.phone ? `<a class="btn btn-outline btn-sm" data-stop href="tel:${esc(s.phone)}">📞</a>` : ''}</div>`).join('') || '<p class="empty">Nessun fornitore. Aggiungili per collegarli agli articoli e generare gli ordini.</p>';
    list._rows = rows;
  }
  list.onclick = (e) => {
    if (e.target.closest('[data-stop]')) return;
    const r = e.target.closest('[data-id]');
    if (r) supplierForm(list._rows.find((x) => x.id === Number(r.dataset.id)), load);
  };
  $('#s-new', el).onclick = () => supplierForm(null, load);
  await load();
}

function supplierForm(s, done) {
  let agents = [];
  try { agents = JSON.parse(s?.agents || '[]'); } catch { agents = []; }
  const f = (id, label, val, attrs = '', cls = '') => `<div class="field ${cls}"><label class="l" for="${id}">${label}</label><input id="${id}" value="${esc(val || '')}" ${attrs} /></div>`;
  const agentRow = (a = {}) => `<div class="sec ag-row card panel"><div class="fgrid c2">
      <div class="field"><label class="l">Nome agente</label><input data-ag="name" value="${esc(a.name || '')}" /></div>
      <div class="field"><label class="l">Telefono</label><input data-ag="phone" inputmode="tel" value="${esc(a.phone || '')}" /></div>
      <div class="field"><label class="l">Email</label><input data-ag="email" type="email" value="${esc(a.email || '')}" /></div>
      <div class="field"><label class="l">Zona / ruolo</label><input data-ag="area" value="${esc(a.area || '')}" placeholder="es. commerciale, assistenza" /></div>
    </div><button type="button" class="btn btn-ghost btn-sm" data-ag-del>Togli agente</button></div>`;
  const m = openModal(
    `<section class="sec">
      ${f('sf-name', 'Nome / ragione sociale *', s?.name)}
      <div class="fgrid c2">${f('sf-vat', 'Partita IVA', s?.vat_number, 'inputmode="numeric"')}${f('sf-web', 'Sito web', s?.website)}
        ${f('sf-phone', 'Telefono / WhatsApp', s?.phone, 'inputmode="tel"')}${f('sf-email', 'Email', s?.email, 'type="email"')}
        ${f('sf-legal', 'Sede legale', s?.legal_address, '', 'span2')}${f('sf-pickup', 'Sede di ritiro operativa', s?.pickup_address, '', 'span2')}</div>
    </section>
    <section class="sec"><h3 class="sec-t">Agenti di riferimento</h3><div id="sf-agents" class="sec">${agents.map(agentRow).join('')}</div>
      <div class="row tight"><button type="button" class="btn btn-outline btn-sm" id="sf-addag">＋ Aggiungi agente</button></div></section>
    <section class="sec"><h3 class="sec-t">Condizioni</h3><div class="fgrid c2">
      ${f('sf-pay', 'Modalità di pagamento concordate', s?.payment_terms, 'placeholder="es. bonifico 30 gg, RiBa, contanti"', 'span2')}
      ${f('sf-min', 'Ordine minimo', s?.min_order, 'placeholder="es. 100 €"')}${f('sf-del', 'Tempi di consegna', s?.delivery_days, 'placeholder="es. 24/48 ore"')}</div>
      <div class="field"><label class="l" for="sf-notes">Note</label><textarea id="sf-notes" rows="3" placeholder="Orari, referenti, resi…">${esc(s?.notes || '')}</textarea></div>
    </section>`,
    { title: s ? 'Modifica fornitore' : 'Nuovo fornitore', wide: true, footer: `${s ? '<button class="btn btn-ghost mr-auto" id="sf-del-btn">Elimina</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="sf-ok">Salva</button>` }
  );
  const r = m.el;
  const box = $('#sf-agents', r);
  $('#sf-addag', r).onclick = () => { box.insertAdjacentHTML('beforeend', agentRow()); box.lastElementChild.querySelector('input').focus(); };
  box.onclick = (e) => { const b = e.target.closest('[data-ag-del]'); if (b) b.closest('.ag-row').remove(); };
  $('#sf-ok', r).onclick = async () => {
    const val = (id) => $(`#${id}`, r).value;
    const ag = [...box.querySelectorAll('.ag-row')].map((row) => Object.fromEntries([...row.querySelectorAll('[data-ag]')].map((i) => [i.dataset.ag, i.value])));
    const body = { name: val('sf-name'), phone: val('sf-phone'), email: val('sf-email'), website: val('sf-web'), notes: val('sf-notes'), vat_number: val('sf-vat'), legal_address: val('sf-legal'), pickup_address: val('sf-pickup'), payment_terms: val('sf-pay'), min_order: val('sf-min'), delivery_days: val('sf-del'), agents: ag };
    const out = await safe(() => (s ? api('PUT', `/api/suppliers/${s.id}`, body) : api('POST', '/api/suppliers', body)));
    if (out) { m.close(); toast('Fornitore salvato'); done(); }
  };
  if (s) $('#sf-del-btn', r).onclick = async () => { if (await confirmDelete('il fornitore')) { await safe(() => api('DELETE', `/api/suppliers/${s.id}`)); m.close(); done(); } };
}
