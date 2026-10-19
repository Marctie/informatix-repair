// Carico merce: arrivo di un articolo (esistente o nuovo) con quantità, fornitore, prezzo d'acquisto, data e documento.
// Aggiorna giacenza, ultimo costo e storico prezzi di Acquisti (grafico e avvisi).
import { $, esc, eur, api, toast, safe, debounce, openModal, today } from './util.js';
import { categoryNames } from './categorie.js';
import { vatBlock, bindVat, ensureVatDefault } from './iva.js';
import { printLabels } from './etichette.js';

/** product = articolo già scelto (da Magazzino); senza: si cerca o si crea un articolo nuovo. */
export async function loadStockDialog({ product = null, done } = {}) {
  const suppliers = (await safe(() => api('GET', '/api/suppliers'))) || [];
  const cats = await categoryNames();
  await ensureVatDefault();
  let prod = product;
  const supOpts = (sel) => `<option value="">— nessun fornitore —</option>${suppliers.map((s) => `<option value="${s.id}" ${Number(sel) === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`;
  const m = openModal(
    `<section class="sec">
      <div id="cl-pick" class="sec"></div>
      <div id="cl-new" class="sec hidden">
        <div class="fgrid c2">
          <div class="field span2"><label class="l" for="cl-name">Nome del nuovo articolo *</label><input id="cl-name" /></div>
          <div class="field"><label class="l" for="cl-cat">Categoria</label><input id="cl-cat" list="cl-cats" /><datalist id="cl-cats">${cats.map((x) => `<option>${esc(x)}</option>`).join('')}</datalist></div>
          <div class="field"><label class="l" for="cl-sku">Codice / SKU</label><input id="cl-sku" /></div>
          <div class="field"><label class="l" for="cl-price">Prezzo di vendita €</label><input id="cl-price" inputmode="decimal" /></div>
        </div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="cl-qty">Quantità arrivata *</label><input id="cl-qty" inputmode="numeric" value="1" /></div>
        <div class="field"><label class="l" for="cl-sup">Fornitore</label><select id="cl-sup">${supOpts(prod?.supplier_id)}</select></div>
        <div class="field"><label class="l" for="cl-cost">Prezzo d’acquisto € (cad.) *</label><input id="cl-cost" inputmode="decimal" value="${prod?.cost ? prod.cost : ''}" /><span class="hint" id="cl-hint"></span></div>
        <div class="field"><label class="l" for="cl-date">Data</label><input id="cl-date" type="date" value="${today()}" /></div>
        <div class="field"><label class="l" for="cl-code">Codice del fornitore</label><input id="cl-code" /></div>
        <div class="field"><label class="l" for="cl-doc">N. documento (DDT / fattura)</label><input id="cl-doc" /></div>
      </div>
      ${vatBlock('cl')}
      <p class="hint">Il fornitore è facoltativo: senza, aggiorno solo giacenza e ultimo costo (niente storico prezzi). Con il fornitore scrivo il prezzo nello storico di Acquisti. Con lo stesso n. documento più articoli finiscono nello stesso documento.</p>
    </section>`,
    { title: 'Carico merce', wide: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="cl-ok">Registra carico</button>' }
  );
  const r = m.el;
  const vatVals = bindVat(r, 'cl', '#cl-cost');
  const pick = $('#cl-pick', r);

  const hint = async () => {
    if (!prod) { $('#cl-hint', r).textContent = ''; return; }
    const d = await safe(() => api('GET', `/api/purchases/prices?product_id=${prod.id}`));
    $('#cl-hint', r).textContent = d?.series?.length ? `Ultimo ${eur(prod.cost)} · medio ${eur(d.avg_cost)}` : (prod.cost ? `Ultimo costo: ${eur(prod.cost)}` : '');
  };
  const chosen = () => {
    pick.innerHTML = `<div class="row" style="align-items:center;justify-content:space-between;gap:.75rem"><span><b>${esc(prod.name)}</b> <span class="hint">· in magazzino ${prod.qty} pz</span></span>${product ? '' : '<button class="btn btn-outline btn-sm" id="cl-change">Cambia</button>'}</div>`;
    $('#cl-new', r).classList.add('hidden');
    if (!$('#cl-sup', r).value && prod.supplier_id) $('#cl-sup', r).value = prod.supplier_id;
    if (!$('#cl-cost', r).value && prod.cost) $('#cl-cost', r).value = prod.cost;
    hint();
    const ch = $('#cl-change', r);
    if (ch) ch.onclick = search;
  };
  function search() {
    prod = null;
    $('#cl-hint', r).textContent = '';
    pick.innerHTML = `<div class="field"><label class="l" for="cl-q">Articolo</label><input id="cl-q" type="search" placeholder="Cerca per nome o codice…" autocomplete="off" /></div>
      <div id="cl-res" class="plist"></div>
      <div class="row tight"><button class="btn btn-outline btn-sm" id="cl-newbtn">＋ Articolo nuovo (non ancora a catalogo)</button></div>`;
    $('#cl-new', r).classList.add('hidden');
    const q = $('#cl-q', r);
    const find = debounce(async () => {
      const t = q.value.trim();
      const rows = t ? (await safe(() => api('GET', `/api/products?q=${encodeURIComponent(t)}`))) || [] : [];
      $('#cl-res', r).innerHTML = rows.slice(0, 8).map((p) => `<div data-pick="${p.id}" style="cursor:pointer"><span>${esc(p.name)}<span class="hint" style="display:block">${esc(p.sku || '')}</span></span><span class="hint">${p.qty} pz</span></div>`).join('') || (t ? '<p class="hint">Nessun articolo trovato.</p>' : '');
      $('#cl-res', r)._rows = rows;
    });
    q.oninput = find;
    q.focus();
    $('#cl-res', r).onclick = (e) => {
      const x = e.target.closest('[data-pick]');
      if (!x) return;
      prod = $('#cl-res', r)._rows.find((p) => p.id === Number(x.dataset.pick));
      chosen();
    };
    $('#cl-newbtn', r).onclick = () => {
      pick.innerHTML = '<div class="row" style="align-items:center;justify-content:space-between"><b>Articolo nuovo</b><button class="btn btn-outline btn-sm" id="cl-back">Cerca tra quelli esistenti</button></div>';
      $('#cl-new', r).classList.remove('hidden');
      $('#cl-back', r).onclick = search;
      $('#cl-name', r).focus();
    };
  }
  if (prod) chosen(); else search();

  $('#cl-ok', r).onclick = async () => {
    const v = (id) => $(`#${id}`, r).value;
    const isNew = !prod;
    const body = { qty: v('cl-qty'), supplier_id: v('cl-sup') || null, unit_price: v('cl-cost').replace(',', '.'), date: v('cl-date'), supplier_code: v('cl-code'), doc_number: v('cl-doc'), ...vatVals() };
    if (isNew) Object.assign(body, { name: v('cl-name'), category: v('cl-cat'), sku: v('cl-sku'), price: v('cl-price').replace(',', '.') });
    const out = await safe(() => api('POST', isNew ? '/api/products/load' : `/api/products/${prod.id}/load`, body));
    if (out) {
      m.close();
      const n = Math.min(Math.max(Math.round(out.loaded.qty), 1), 500);
      // un'etichetta per ogni pezzo arrivato, subito: il pulsante resta qualche secondo
      toast(`Caricati ${out.loaded.qty} pz · ora ${out.qty} in magazzino`, true, { ms: 12000, action: { label: `🏷️ Stampa ${n} etichett${n === 1 ? 'a' : 'e'}`, fn: () => printLabels([{ product_id: out.id, qty: n }]) } });
      done?.(out);
    }
  };
}
