// Magazzino (con "Da ordinare") e Fornitori.
import { $, $$, esc, eur, fdt, api, toast, safe, debounce, openModal } from './util.js';

const CATEGORIES = ['Ricambi', 'Accessori', 'Cavi e caricatori', 'Usato / ricondizionato', 'Software e servizi', 'Altro'];

export async function stockView(el, params) {
  let tab = params.get('tab') === 'reorder' ? 'reorder' : 'all';
  let q = '';
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4"><h1 class="font-heading font-extrabold text-2xl">Magazzino</h1>
      <button class="btn btn-primary" id="p-new">＋ Nuovo articolo</button></div>
    <div class="flex gap-2 mb-3 items-center flex-wrap"><span class="chip" data-t="all">Tutti</span><span class="chip" data-t="reorder">📉 Da ordinare</span>
      <input id="p-q" placeholder="Cerca nome, codice, categoria…" class="!w-64 ml-auto" /></div>
    <div class="card overflow-hidden" id="p-list"></div>`;
  const list = $('#p-list', el);

  async function load() {
    $$('[data-t]', el).forEach((c) => c.classList.toggle('on', c.dataset.t === tab));
    $('#p-q', el).classList.toggle('hidden', tab === 'reorder');
    if (tab === 'reorder') return loadReorder();
    const rows = await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`));
    list.innerHTML = `<table class="t"><thead><tr><th>Articolo</th><th>Categoria</th><th>Giacenza</th><th>Costo</th><th>Prezzo</th><th></th></tr></thead><tbody>` +
      ((rows || []).map((p) => {
        const low = p.min_qty > 0 && p.qty <= p.min_qty;
        return `<tr class="row-h cursor-pointer" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="text-xs text-gray-400">${esc(p.sku || '')} ${p.location ? '· ' + esc(p.location) : ''} ${p.supplier_name ? '· ' + esc(p.supplier_name) : ''}</div></td>
          <td class="text-gray-500">${esc(p.category || '—')}</td>
          <td><span class="badge ${p.qty <= 0 ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}">${p.qty} pz${low ? ' · basso' : ''}</span></td>
          <td>${eur(p.cost)}</td><td><b>${eur(p.price)}</b></td>
          <td class="whitespace-nowrap" data-stop><button class="btn btn-outline btn-sm" data-mv="${p.id}" data-d="-1">−1</button> <button class="btn btn-outline btn-sm" data-mv="${p.id}" data-d="1">+1</button></td></tr>`;
      }).join('') || '<tr><td colspan="6" class="text-center text-gray-400 py-8">Nessun articolo. Aggiungi il primo con “Nuovo articolo”.</td></tr>') + '</tbody></table>';
  }

  async function loadReorder() {
    const rows = await safe(() => api('GET', '/api/reorder'));
    const groups = {};
    (rows || []).forEach((p) => { (groups[p.supplier_name || 'Senza fornitore'] ||= []).push(p); });
    list.innerHTML = Object.entries(groups).map(([name, items]) => {
      const sup = items[0];
      const text = `Buongiorno, vorrei ordinare:\n${items.map((p) => `- ${p.name}: ${Math.max(1, p.min_qty * 2 - p.qty)} pz`).join('\n')}\nGrazie.`;
      const wa = sup.supplier_phone ? `https://wa.me/${('39' + sup.supplier_phone.replace(/\D/g, '')).replace(/^3939/, '39')}?text=${encodeURIComponent(text)}` : null;
      const mail = sup.supplier_email ? `mailto:${sup.supplier_email}?subject=${encodeURIComponent('Ordine')}&body=${encodeURIComponent(text)}` : null;
      return `<div class="border-b border-line last:border-0"><div class="px-4 py-3 bg-lightbg flex items-center justify-between gap-2 flex-wrap"><b>🚚 ${esc(name)}</b>
        <div class="flex gap-2">${wa ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${wa}">💬 Ordina su WhatsApp</a>` : ''}${mail ? `<a class="btn btn-outline btn-sm" href="${mail}">✉️ Email</a>` : ''}
        <button class="btn btn-outline btn-sm" data-copy="${esc(text)}">📋 Copia ordine</button></div></div>
        ${items.map((p) => `<div class="px-4 py-2 flex justify-between text-sm border-t border-line"><span>${esc(p.name)}</span><span class="text-gray-500">${p.qty} in magazzino · minimo ${p.min_qty} · suggerito ${Math.max(1, p.min_qty * 2 - p.qty)}</span></div>`).join('')}</div>`;
    }).join('') || '<p class="p-8 text-center text-gray-400 text-sm">Niente da riordinare: tutte le scorte sono sopra il minimo ✔</p>';
  }

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-t]');
    if (t) { tab = t.dataset.t; return load(); }
    const cp = e.target.closest('[data-copy]');
    if (cp) { await navigator.clipboard?.writeText(cp.dataset.copy); return toast('Ordine copiato'); }
    const mv = e.target.closest('[data-mv]');
    if (mv) { e.stopPropagation(); await safe(() => api('POST', `/api/products/${mv.dataset.mv}/move`, { delta: Number(mv.dataset.d), reason: 'rettifica rapida' })); return load(); }
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('tr[data-id]');
    if (row) productForm(Number(row.dataset.id), load);
  });
  $('#p-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#p-new', el).onclick = () => productForm(null, load);
  await load();
}

async function productForm(id, done) {
  const [suppliers, p] = await Promise.all([api('GET', '/api/suppliers'), id ? api('GET', `/api/products?q=`).then((l) => l.find((x) => x.id === id)) : null]);
  const moves = id ? await api('GET', `/api/products/${id}/moves`) : [];
  const m = openModal(
    `<div class="grid grid-cols-2 gap-3">
      <div class="col-span-2"><label class="l">Nome articolo *</label><input id="pf-name" value="${esc(p?.name || '')}" /></div>
      <div><label class="l">Categoria</label><input id="pf-cat" list="pf-cats" value="${esc(p?.category || '')}" /><datalist id="pf-cats">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</datalist></div>
      <div><label class="l">Codice / SKU</label><input id="pf-sku" value="${esc(p?.sku || '')}" /></div>
      ${id ? `<div><label class="l">Giacenza attuale</label><input value="${p.qty} pz" disabled /></div>` : '<div><label class="l">Quantità iniziale</label><input id="pf-qty" inputmode="numeric" value="0" /></div>'}
      <div><label class="l">Scorta minima (avviso riordino)</label><input id="pf-min" inputmode="numeric" value="${p?.min_qty ?? 0}" /></div>
      <div><label class="l">Costo d’acquisto €</label><input id="pf-cost" inputmode="decimal" value="${p?.cost ?? ''}" /></div>
      <div><label class="l">Prezzo di vendita €</label><input id="pf-price" inputmode="decimal" value="${p?.price ?? ''}" /></div>
      <div><label class="l">Fornitore</label><select id="pf-sup"><option value="">—</option>${suppliers.map((s) => `<option value="${s.id}" ${p?.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div><label class="l">Posizione (scaffale/cassetto)</label><input id="pf-loc" value="${esc(p?.location || '')}" /></div>
      <div class="col-span-2"><label class="l">Note</label><input id="pf-notes" value="${esc(p?.notes || '')}" /></div>
    </div>
    ${id ? `<div class="sec-t">Carico merce</div><div class="flex gap-2"><input id="pf-add" inputmode="numeric" placeholder="Quantità arrivata" class="!w-40" /><button class="btn btn-outline btn-sm" id="pf-load">Registra carico</button></div>
    <div class="sec-t">Ultimi movimenti</div><ul class="text-xs text-gray-600 space-y-1">${moves.slice(0, 8).map((x) => `<li>${fdt(x.created_at)} · <b class="${x.delta > 0 ? 'text-emerald-600' : 'text-secondary'}">${x.delta > 0 ? '+' : ''}${x.delta}</b> · ${esc(x.reason)} ${esc(x.ref || '')}</li>`).join('') || '<li>Nessuno</li>'}</ul>` : ''}`,
    { title: id ? 'Modifica articolo' : 'Nuovo articolo', wide: true,
      footer: `${id ? '<button class="btn btn-ghost mr-auto" id="pf-del">Archivia</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="pf-ok">Salva</button>` }
  );
  const r = m.el;
  $('#pf-ok', r).onclick = async () => {
    const body = { name: $('#pf-name', r).value, category: $('#pf-cat', r).value, sku: $('#pf-sku', r).value, min_qty: $('#pf-min', r).value, cost: $('#pf-cost', r).value, price: $('#pf-price', r).value, supplier_id: $('#pf-sup', r).value || null, location: $('#pf-loc', r).value, notes: $('#pf-notes', r).value };
    if (!id) body.qty = $('#pf-qty', r).value;
    const out = await safe(() => (id ? api('PUT', `/api/products/${id}`, body) : api('POST', '/api/products', body)));
    if (out) { m.close(); toast('Articolo salvato'); done(); }
  };
  if (id) {
    $('#pf-load', r).onclick = async () => {
      const out = await safe(() => api('POST', `/api/products/${id}/move`, { delta: Number($('#pf-add', r).value), reason: 'carico merce' }));
      if (out) { m.close(); toast(`Giacenza: ${out.qty} pz`); done(); }
    };
    $('#pf-del', r).onclick = async () => {
      if (!confirm('Archiviare questo articolo? Lo storico resta.')) return;
      await safe(() => api('DELETE', `/api/products/${id}`)); m.close(); done();
    };
  }
}

// ---------- Fornitori ----------
export async function suppliersView(el) {
  el.innerHTML = `<div class="flex items-center justify-between gap-3 flex-wrap mb-4"><h1 class="font-heading font-extrabold text-2xl">Fornitori</h1>
    <button class="btn btn-primary" id="s-new">＋ Nuovo fornitore</button></div><div class="card overflow-hidden" id="s-list"></div>`;
  const list = $('#s-list', el);
  async function load() {
    const rows = await safe(() => api('GET', '/api/suppliers'));
    list.innerHTML = (rows || []).map((s) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-id="${s.id}">
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(s.name)}</p><p class="text-xs text-gray-500">${esc(s.phone || '')} ${s.email ? '· ' + esc(s.email) : ''} ${s.website ? '· ' + esc(s.website) : ''}</p></div>
      <span class="text-xs text-gray-500">${s.products_count} articoli</span>
      ${s.phone ? `<a class="btn btn-outline btn-sm" data-stop href="tel:${esc(s.phone)}">📞</a>` : ''}</div>`).join('') || '<p class="p-8 text-center text-gray-400 text-sm">Nessun fornitore. Aggiungili per collegarli agli articoli e generare gli ordini.</p>';
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
  const m = openModal(
    `<div class="grid grid-cols-2 gap-3"><div class="col-span-2"><label class="l">Nome *</label><input id="sf-name" value="${esc(s?.name || '')}" /></div>
     <div><label class="l">Telefono / WhatsApp</label><input id="sf-phone" value="${esc(s?.phone || '')}" /></div><div><label class="l">Email</label><input id="sf-email" value="${esc(s?.email || '')}" /></div>
     <div class="col-span-2"><label class="l">Sito web</label><input id="sf-web" value="${esc(s?.website || '')}" /></div>
     <div class="col-span-2"><label class="l">Note (tempi di consegna, minimo d’ordine…)</label><textarea id="sf-notes" rows="2">${esc(s?.notes || '')}</textarea></div></div>`,
    { title: s ? 'Modifica fornitore' : 'Nuovo fornitore', footer: `${s ? '<button class="btn btn-ghost mr-auto" id="sf-del">Elimina</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="sf-ok">Salva</button>` }
  );
  $('#sf-ok', m.el).onclick = async () => {
    const body = { name: $('#sf-name', m.el).value, phone: $('#sf-phone', m.el).value, email: $('#sf-email', m.el).value, website: $('#sf-web', m.el).value, notes: $('#sf-notes', m.el).value };
    const out = await safe(() => (s ? api('PUT', `/api/suppliers/${s.id}`, body) : api('POST', '/api/suppliers', body)));
    if (out) { m.close(); toast('Fornitore salvato'); done(); }
  };
  if (s) $('#sf-del', m.el).onclick = async () => { if (confirm('Eliminare il fornitore?')) { await safe(() => api('DELETE', `/api/suppliers/${s.id}`)); m.close(); done(); } };
}
