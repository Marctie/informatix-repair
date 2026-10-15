// Selettori condivisi dai moduli Ordini, Preventivi e Promemoria: cliente (con ricerca) e righe articolo.
import { $, esc, api, debounce, safe } from './util.js';

/** HTML di un campo "cliente": casella di ricerca + elenco. Si collega con bindCustomer(root, id). */
export const customerField = (id, label = 'Cliente', { required = false } = {}) => `<div class="field"><label class="l" for="${id}-q">${label}${required ? ' *' : ''}</label>
  <input id="${id}-q" type="search" placeholder="Cerca per nome o telefono…" autocomplete="off" /><select id="${id}" aria-label="${esc(label)}"></select></div>`;

/** Collega il campo cliente: carica l'elenco, filtra mentre si scrive. Ritorna { value(), set(id) }. */
export function bindCustomer(root, id, selected = null, { allowNone = true } = {}) {
  const sel = $(`#${id}`, root);
  const q = $(`#${id}-q`, root);
  let keep = selected;
  async function load(text = '') {
    const rows = (await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(text)}`))) || [];
    const cur = keep != null ? String(keep) : sel.value;
    const opts = rows.map((c) => `<option value="${c.id}">${esc(c.name)}${c.phone ? ` · ${esc(c.phone)}` : ''}</option>`);
    if (cur && !rows.some((c) => String(c.id) === cur)) opts.unshift(`<option value="${esc(cur)}">${esc(sel.selectedOptions[0]?.textContent || `Cliente #${cur}`)}</option>`);
    sel.innerHTML = (allowNone ? '<option value="">— nessun cliente —</option>' : '<option value="">Scegli un cliente…</option>') + opts.join('');
    if (cur) sel.value = cur;
    keep = null;
  }
  q.oninput = debounce(() => load(q.value.trim()));
  load();
  return { value: () => (sel.value ? Number(sel.value) : null), set: (v) => { keep = v; return load(q.value.trim()); } };
}

/** Righe articolo (descrizione, quantità, prezzo) con aggiunta/rimozione. Ritorna { value(), total() }. */
export function itemsEditor(root, mountId, items = [], { price = true } = {}) {
  const box = $(`#${mountId}`, root);
  const rowHtml = (i = {}) => `<div class="row nowrap" data-item>
    <input class="grow" data-f="description" placeholder="Articolo / descrizione" value="${esc(i.description || '')}" aria-label="Descrizione" />
    <input data-f="qty" type="number" min="1" step="1" value="${i.qty || 1}" style="width:5rem;flex:none" aria-label="Quantità" />
    ${price ? `<input data-f="unit_price" type="number" min="0" step="0.01" inputmode="decimal" value="${i.unit_price ?? ''}" placeholder="€" style="width:7rem;flex:none" aria-label="Prezzo unitario" />` : ''}
    <button class="btn btn-ghost btn-sm" data-rm aria-label="Togli riga" type="button">✕</button></div>`;
  box.innerHTML = `<div class="sec"><div class="sec" data-rows>${(items.length ? items : [{}]).map(rowHtml).join('')}</div>
    <div class="row"><button class="btn btn-outline btn-sm" data-add type="button">＋ Aggiungi articolo</button><span class="hint" data-tot></span></div></div>`;
  const rows = $('[data-rows]', box);
  const value = () => [...rows.querySelectorAll('[data-item]')].map((r) => ({
    description: r.querySelector('[data-f=description]').value, qty: r.querySelector('[data-f=qty]').value, unit_price: r.querySelector('[data-f=unit_price]')?.value ?? 0,
  })).filter((i) => String(i.description).trim());
  const total = () => value().reduce((s, i) => s + Number(i.qty || 1) * Number(String(i.unit_price || 0).replace(',', '.')), 0);
  const upd = () => { if (price) $('[data-tot]', box).textContent = `Totale ${total().toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`; box.dispatchEvent(new CustomEvent('items-change', { bubbles: true })); };
  box.addEventListener('input', upd);
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { rows.insertAdjacentHTML('beforeend', rowHtml()); rows.lastElementChild.querySelector('input').focus(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { if (rows.children.length > 1) rm.closest('[data-item]').remove(); else rm.closest('[data-item]').querySelectorAll('input').forEach((x) => { x.value = x.dataset.f === 'qty' ? 1 : ''; }); upd(); }
  });
  upd();
  return { value, total };
}

export const METHODS = [['contanti', 'Contanti'], ['carta', 'Carta'], ['bonifico', 'Bonifico']];
export const methodSelect = (id) => `<select id="${id}" aria-label="Metodo di pagamento">${METHODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
