// Vendite al banco, cassa giornaliera e impostazioni.
import { $, esc, eur, fdt, api, toast, safe, debounce, today, META, loadMeta } from './util.js';

export async function salesView(el) {
  const cart = [];
  el.innerHTML = `
    <h1 class="font-heading font-extrabold text-2xl mb-4">Vendite</h1>
    <div class="grid lg:grid-cols-5 gap-4">
      <section class="card p-4 lg:col-span-3">
        <h2 class="font-heading font-bold mb-2">Vendita veloce</h2>
        <div class="relative"><input id="s-q" placeholder="Cerca articolo (nome o codice)…" /><div id="s-sugg" class="hidden absolute z-10 left-0 right-0 mt-1 card shadow-lg max-h-64 overflow-y-auto"></div></div>
        <div class="flex gap-2 mt-2"><input id="s-free" placeholder="Voce libera (es. Pulizia software)" /><input id="s-free-p" inputmode="decimal" placeholder="€" class="!w-28" /><button class="btn btn-outline" id="s-free-add">Aggiungi</button></div>
        <div id="s-cart" class="mt-4"></div>
      </section>
      <section class="card p-4 lg:col-span-2">
        <h2 class="font-heading font-bold mb-2">Ultime vendite</h2><div id="s-recent" class="text-sm"></div>
      </section>
    </div>`;
  const sugg = $('#s-sugg', el);

  function renderCart() {
    const subtotal = cart.reduce((a, i) => a + i.qty * i.unit_price, 0);
    $('#s-cart', el).innerHTML = cart.length
      ? `${cart.map((i, idx) => `<div class="flex items-center gap-2 py-2 border-b border-line text-sm"><span class="flex-1">${esc(i.name)}</span>
          <button class="btn btn-outline btn-sm" data-q="${idx}" data-d="-1">−</button><b>${i.qty}</b><button class="btn btn-outline btn-sm" data-q="${idx}" data-d="1">+</button>
          <input class="!w-24 !py-1" inputmode="decimal" data-p="${idx}" value="${i.unit_price}" /><b class="w-20 text-right">${eur(i.qty * i.unit_price)}</b><button class="text-secondary" data-rm="${idx}">✕</button></div>`).join('')}
        <div class="grid grid-cols-3 gap-2 mt-3 items-end"><div><label class="l">Sconto €</label><input id="s-disc" inputmode="decimal" value="0" /></div>
          <div><label class="l">Pagamento</label><select id="s-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div>
          <div class="text-right"><p class="text-xs text-gray-500">Totale</p><p class="font-heading font-extrabold text-2xl" id="s-total">${eur(subtotal)}</p></div></div>
        <button class="btn btn-green btn-lg w-full mt-3" id="s-pay">✔ Incassa</button>`
      : '<p class="text-sm text-gray-400 py-6 text-center">Il carrello è vuoto: cerca un articolo o aggiungi una voce libera.</p>';
    const disc = $('#s-disc', el);
    if (disc) disc.oninput = () => { $('#s-total', el).textContent = eur(Math.max(0, subtotal - (Number(String(disc.value).replace(',', '.')) || 0))); };
  }

  async function recent() {
    const rows = await safe(() => api('GET', '/api/sales'));
    $('#s-recent', el).innerHTML = (rows || []).slice(0, 12).map((s) => `<div class="flex justify-between items-center py-2 border-b border-line"><span>${esc(s.code)} <span class="text-gray-400 text-xs">${fdt(s.created_at)} · ${esc(s.method)}</span></span><span><b>${eur(s.total)}</b> <a class="text-secondary text-xs ml-1" target="_blank" href="/print/sale/${s.id}">🖨️</a></span></div>`).join('') || '<p class="text-gray-400">Ancora nessuna vendita.</p>';
  }

  $('#s-q', el).oninput = debounce(async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) return sugg.classList.add('hidden');
    const rows = await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`));
    sugg.innerHTML = (rows || []).map((p) => `<div class="px-3 py-2 hover:bg-lightbg cursor-pointer text-sm flex justify-between ${p.qty <= 0 ? 'opacity-50' : ''}" data-add="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}"><span>${esc(p.name)}</span><span class="text-gray-500">${p.qty} pz · ${eur(p.price)}</span></div>`).join('') || '<div class="px-3 py-2 text-sm text-gray-400">Nessun articolo in magazzino: usa la voce libera.</div>';
    sugg.classList.remove('hidden');
  }, 200);
  el.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const ex = cart.find((i) => i.product_id === Number(add.dataset.add));
      if (ex) ex.qty++; else cart.push({ product_id: Number(add.dataset.add), name: add.dataset.name, qty: 1, unit_price: Number(add.dataset.price) });
      sugg.classList.add('hidden'); $('#s-q', el).value = ''; return renderCart();
    }
    const q = e.target.closest('[data-q]');
    if (q) { const i = cart[Number(q.dataset.q)]; i.qty = Math.max(1, i.qty + Number(q.dataset.d)); return renderCart(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { cart.splice(Number(rm.dataset.rm), 1); return renderCart(); }
    if (e.target.id === 's-free-add') {
      const name = $('#s-free', el).value.trim(); const price = Number(String($('#s-free-p', el).value).replace(',', '.'));
      if (!name || !(price >= 0) || $('#s-free-p', el).value === '') return toast('Inserisci descrizione e importo', false);
      cart.push({ name, qty: 1, unit_price: price }); $('#s-free', el).value = ''; $('#s-free-p', el).value = ''; return renderCart();
    }
    if (e.target.id === 's-pay') {
      e.target.disabled = true;
      const out = await safe(() => api('POST', '/api/sales', { items: cart, discount: $('#s-disc', el).value, method: $('#s-method', el).value }));
      e.target.disabled = false;
      if (!out) return;
      cart.length = 0; renderCart(); recent();
      toast(`Venduto: ${eur(out.total)}`);
      window.open(`/print/sale/${out.id}`, '_blank');
    }
  });
  el.addEventListener('change', (e) => {
    const p = e.target.closest('[data-p]');
    if (p) { cart[Number(p.dataset.p)].unit_price = Number(String(p.value).replace(',', '.')) || 0; renderCart(); }
  });
  renderCart();
  await recent();
}

export async function cashView(el) {
  let from = today(), to = today();
  el.innerHTML = `<div class="flex items-center justify-between gap-3 flex-wrap mb-4"><h1 class="font-heading font-extrabold text-2xl">Cassa</h1>
    <div class="flex gap-2 items-center flex-wrap"><span class="chip" data-r="0">Oggi</span><span class="chip" data-r="7">7 giorni</span><span class="chip" data-r="30">30 giorni</span>
    <input type="date" id="c-from" class="!w-auto" value="${from}" /><input type="date" id="c-to" class="!w-auto" value="${to}" /></div></div><div id="c-out"></div>`;
  async function load() {
    const r = await safe(() => api('GET', `/api/report?from=${from}&to=${to}`));
    if (!r) return;
    $('#c-out', el).innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="card p-4"><p class="text-3xl font-heading font-extrabold text-secondary">${eur(r.total)}</p><p class="text-xs text-gray-500 font-semibold">Incassato</p></div>
        ${r.by_method.map((m) => `<div class="card p-4"><p class="text-2xl font-heading font-extrabold">${eur(m.total)}</p><p class="text-xs text-gray-500 font-semibold">${esc(m.method)} (${m.n})</p></div>`).join('')}
        <div class="card p-4"><p class="text-2xl font-heading font-extrabold text-gray-600">${eur(r.parts_cost)}</p><p class="text-xs text-gray-500 font-semibold">Costo ricambi/merce venduta</p></div>
      </div>
      <div class="card overflow-hidden"><table class="t"><thead><tr><th>Data</th><th>Voce</th><th>Metodo</th><th style="text-align:right">Importo</th></tr></thead><tbody>
      ${r.rows.map((p) => `<tr><td>${fdt(p.created_at)}</td><td>${esc(p.label)}</td><td>${esc(p.method)}</td><td style="text-align:right"><b>${eur(p.amount)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-gray-400 py-8">Nessun incasso nel periodo.</td></tr>'}</tbody></table></div>
      <p class="text-xs text-gray-400 mt-3">Riepilogo gestionale non fiscale: scontrini/fatture vanno emessi con il registratore telematico o il programma di fatturazione.</p>`;
  }
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-r]'); if (!c) return;
    const n = Number(c.dataset.r);
    to = today(); from = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    $('#c-from', el).value = from; $('#c-to', el).value = to; load();
  });
  $('#c-from', el).onchange = (e) => { from = e.target.value; load(); };
  $('#c-to', el).onchange = (e) => { to = e.target.value; load(); };
  await load();
}

export async function settingsView(el) {
  const s = await api('GET', '/api/settings');
  const f = (k, l, extra = '') => `<div><label class="l">${l}</label><input data-k="${k}" value="${esc(s[k] || '')}" ${extra} /></div>`;
  el.innerHTML = `<h1 class="font-heading font-extrabold text-2xl mb-4">Impostazioni</h1>
    <div class="card p-5 max-w-2xl grid gap-3">
      ${f('shop_name', 'Nome del negozio')}${f('shop_address', 'Indirizzo')}${f('shop_phone', 'Telefono')}
      ${f('default_warranty_days', 'Giorni di garanzia sulle riparazioni', 'inputmode="numeric"')}
      <div><label class="l">Indirizzo pubblico per il tracciamento clienti</label><input data-k="public_base_url" value="${esc(s.public_base_url)}" placeholder="vuoto = rete locale (${esc(META.track_base)})" />
        <p class="text-xs text-gray-400 mt-1">Quando il tracciamento sarà online (es. https://riparazioni.informatixrepair.com) scrivilo qui: i QR e i link useranno questo indirizzo.</p></div>
      <div><label class="l">Condizioni stampate sulla scheda di ingresso</label><textarea data-k="terms" rows="5">${esc(s.terms)}</textarea></div>
      <div><button class="btn btn-primary" id="st-save">Salva impostazioni</button></div>
    </div>`;
  $('#st-save', el).onclick = async () => {
    const body = {};
    el.querySelectorAll('[data-k]').forEach((i) => { body[i.dataset.k] = i.value; });
    if (await safe(() => api('PUT', '/api/settings', body))) { await loadMeta(); toast('Impostazioni salvate'); }
  };
}
