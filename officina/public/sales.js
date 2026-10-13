// Vendite al banco, cassa giornaliera e impostazioni.
import { $, esc, eur, fdt, fdate, api, toast, safe, debounce, today, addDays, META, loadMeta } from './util.js';

export async function salesView(el) {
  const cart = [];
  let customer = null;
  el.innerHTML = `
    <h1 class="font-heading font-extrabold text-2xl mb-4">Vendite</h1>
    <div class="grid lg:grid-cols-5 gap-4">
      <section class="card p-4 lg:col-span-3">
        <h2 class="font-heading font-bold mb-3">Vendita veloce</h2>
        <div class="relative"><input id="s-q" type="search" placeholder="Cerca articolo (nome o codice)…" autocomplete="off" /><div id="s-sugg" class="hidden absolute z-10 left-0 right-0 mt-1 card shadow-lg max-h-64 overflow-y-auto"></div></div>
        <div class="grid grid-cols-[1fr_6rem_auto] gap-2 mt-2"><input id="s-free" placeholder="Voce libera (es. Pulizia software)" /><input id="s-free-p" inputmode="decimal" placeholder="€" /><button class="btn btn-outline" id="s-free-add">Aggiungi</button></div>
        <div class="relative mt-2"><input id="s-cust" placeholder="Cliente (facoltativo, per lo storico)" autocomplete="off" /><div id="s-cust-s" class="hidden absolute z-10 left-0 right-0 mt-1 card shadow-lg max-h-48 overflow-y-auto"></div></div>
        <div id="s-cust-pick" class="hidden"></div>
        <div id="s-cart" class="mt-4"></div>
      </section>
      <section class="card p-4 lg:col-span-2 self-start">
        <h2 class="font-heading font-bold mb-2">Ultime vendite</h2><div id="s-recent" class="text-sm"></div>
      </section>
    </div>`;
  const sugg = $('#s-sugg', el);

  function renderCart() {
    const subtotal = cart.reduce((a, i) => a + i.qty * i.unit_price, 0);
    $('#s-cart', el).innerHTML = cart.length
      ? `${cart.map((i, idx) => `<div class="py-2.5 border-b border-line text-sm">
          <div class="flex items-start justify-between gap-2"><span class="font-semibold min-w-0">${esc(i.name)}</span><button class="text-secondary p-1" data-rm="${idx}" aria-label="Rimuovi">✕</button></div>
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            <button class="btn btn-outline btn-sm" data-q="${idx}" data-d="-1" aria-label="Meno">−</button><b class="w-6 text-center">${i.qty}</b><button class="btn btn-outline btn-sm" data-q="${idx}" data-d="1" aria-label="Più">+</button>
            <span class="text-gray-400">×</span><input class="!w-24 !min-h-0 !py-1" inputmode="decimal" data-p="${idx}" value="${i.unit_price}" aria-label="Prezzo unitario" />
            <b class="ml-auto">${eur(i.qty * i.unit_price)}</b></div></div>`).join('')}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 items-end"><div><label class="l">Sconto €</label><input id="s-disc" inputmode="decimal" value="0" /></div>
          <div><label class="l">Pagamento</label><select id="s-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div>
          <div class="col-span-2 sm:col-span-1 text-right"><p class="text-xs text-gray-500">Totale</p><p class="font-heading font-extrabold text-3xl" id="s-total">${eur(subtotal)}</p></div></div>
        <button class="btn btn-green btn-lg w-full mt-4" id="s-pay">✔ Incassa</button>`
      : '<p class="empty">Il carrello è vuoto: cerca un articolo o aggiungi una voce libera.</p>';
    const disc = $('#s-disc', el);
    if (disc) disc.oninput = () => { $('#s-total', el).textContent = eur(Math.max(0, subtotal - (Number(String(disc.value).replace(',', '.')) || 0))); };
  }

  async function recent() {
    const rows = await safe(() => api('GET', '/api/sales'));
    $('#s-recent', el).innerHTML = (rows || []).slice(0, 12).map((s) => `<div class="flex justify-between items-center gap-2 py-2 border-b border-line last:border-0"><span class="min-w-0">${esc(s.code)} <span class="text-gray-400 text-xs block sm:inline">${fdt(s.created_at)} · ${esc(s.method)}${s.customer_name ? ' · ' + esc(s.customer_name) : ''}</span></span><span class="shrink-0"><b>${eur(s.total)}</b> <a class="text-secondary ml-1" target="_blank" href="/print/sale/${s.id}" aria-label="Stampa">🖨️</a></span></div>`).join('') || '<p class="empty">Ancora nessuna vendita.</p>';
  }

  $('#s-q', el).oninput = debounce(async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) return sugg.classList.add('hidden');
    const rows = await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`));
    sugg.innerHTML = (rows || []).map((p) => `<div class="px-3 py-2.5 hover:bg-lightbg cursor-pointer text-sm flex justify-between gap-2 ${p.qty <= 0 ? 'opacity-50' : ''}" data-add="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}"><span class="min-w-0">${esc(p.name)}</span><span class="text-gray-500 shrink-0">${p.qty} pz · ${eur(p.price)}</span></div>`).join('') || '<div class="px-3 py-2 text-sm text-gray-400">Nessun articolo in magazzino: usa la voce libera.</div>';
    sugg.classList.remove('hidden');
  }, 200);

  $('#s-cust', el).oninput = debounce(async (e) => {
    const q = e.target.value.trim();
    const box = $('#s-cust-s', el);
    if (q.length < 2) return box.classList.add('hidden');
    const rows = await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`));
    box.innerHTML = (rows || []).map((c) => `<div class="px-3 py-2.5 hover:bg-lightbg cursor-pointer text-sm" data-cust="${c.id}" data-name="${esc(c.name)}"><b>${esc(c.name)}</b> <span class="text-gray-500">${esc(c.phone || '')}</span></div>`).join('') || '<div class="px-3 py-2 text-sm text-gray-400">Nessun cliente trovato.</div>';
    box.classList.remove('hidden');
  }, 200);

  el.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const ex = cart.find((i) => i.product_id === Number(add.dataset.add));
      if (ex) ex.qty++; else cart.push({ product_id: Number(add.dataset.add), name: add.dataset.name, qty: 1, unit_price: Number(add.dataset.price) });
      sugg.classList.add('hidden'); $('#s-q', el).value = ''; return renderCart();
    }
    const pick = e.target.closest('[data-cust]');
    if (pick) {
      customer = { id: Number(pick.dataset.cust), name: pick.dataset.name };
      $('#s-cust-s', el).classList.add('hidden'); $('#s-cust', el).classList.add('hidden');
      const box = $('#s-cust-pick', el);
      box.innerHTML = `<div class="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-2 text-sm"><span>✔ <b>${esc(customer.name)}</b></span><button class="btn btn-ghost btn-sm" id="s-unpick">cambia</button></div>`;
      box.classList.remove('hidden');
      return;
    }
    if (e.target.id === 's-unpick') { customer = null; $('#s-cust-pick', el).classList.add('hidden'); $('#s-cust', el).classList.remove('hidden'); $('#s-cust', el).value = ''; return; }
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
      const out = await safe(() => api('POST', '/api/sales', { items: cart, discount: $('#s-disc', el).value, method: $('#s-method', el).value, customer_id: customer?.id || null }));
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
  el.innerHTML = `<div class="flex items-center justify-between gap-3 flex-wrap mb-4"><h1 class="font-heading font-extrabold text-2xl">Cassa</h1></div>
    <div class="flex gap-2 items-center flex-wrap mb-4"><span class="chip" data-r="0">Oggi</span><span class="chip" data-r="7">7 giorni</span><span class="chip" data-r="30">30 giorni</span>
    <input type="date" id="c-from" class="!w-auto" value="${from}" aria-label="Dal" /><span class="text-gray-400">→</span><input type="date" id="c-to" class="!w-auto" value="${to}" aria-label="Al" /></div><div id="c-out"></div>`;
  async function load() {
    const r = await safe(() => api('GET', `/api/report?from=${from}&to=${to}`));
    if (!r) return;
    const max = Math.max(1, ...r.by_day.map((d) => d.total));
    $('#c-out', el).innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="card kpi"><b class="text-secondary">${eur(r.total)}</b><span>Incassato nel periodo</span></div>
        ${r.by_method.map((m) => `<div class="card kpi"><b>${eur(m.total)}</b><span>${esc(m.method)} (${m.n})</span></div>`).join('')}
        <div class="card kpi"><b class="text-gray-600">${eur(r.parts_cost)}</b><span>Costo ricambi e merce venduta</span></div>
      </div>
      ${r.by_day.length > 1 ? `<div class="card p-4 mb-4"><h3 class="font-heading font-bold text-sm mb-3">Incassi per giorno</h3>
        <div class="flex items-end gap-1.5 h-36 overflow-x-auto pb-1">${r.by_day.map((d) => `<div class="flex flex-col items-center justify-end h-full min-w-[2.2rem] flex-1" title="${fdate(d.day)}: ${eur(d.total)}">
          <span class="text-[10px] text-gray-500 mb-1">${Math.round(d.total)}</span><div class="w-full rounded-t bg-secondary" style="height:${Math.max(4, (d.total / max) * 100)}%"></div>
          <span class="text-[10px] text-gray-400 mt-1">${d.day.slice(8)}/${d.day.slice(5, 7)}</span></div>`).join('')}</div></div>` : ''}
      <div class="card overflow-hidden"><div class="tbl-wrap"><table class="t"><thead><tr><th>Data</th><th>Voce</th><th>Metodo</th><th style="text-align:right">Importo</th></tr></thead><tbody>
      ${r.rows.map((p) => `<tr><td class="whitespace-nowrap">${fdt(p.created_at)}</td><td>${esc(p.label)}</td><td>${esc(p.method)}</td><td style="text-align:right"><b>${eur(p.amount)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nessun incasso nel periodo.</td></tr>'}</tbody></table></div></div>
      <p class="text-xs text-gray-400 mt-3">Riepilogo gestionale non fiscale: scontrini e fatture vanno emessi con il registratore telematico o il programma di fatturazione.</p>`;
  }
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-r]'); if (!c) return;
    to = today(); from = addDays(-Number(c.dataset.r));
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
    <div class="grid lg:grid-cols-3 gap-4 items-start">
    <div class="card p-4 sm:p-5 grid gap-3 lg:col-span-2">
      ${f('shop_name', 'Nome del negozio')}${f('shop_address', 'Indirizzo')}${f('shop_phone', 'Telefono')}
      ${f('default_warranty_days', 'Giorni di garanzia sulle riparazioni', 'inputmode="numeric"')}
      <div><label class="l">Indirizzo pubblico per il tracciamento clienti</label><input data-k="public_base_url" value="${esc(s.public_base_url)}" placeholder="vuoto = rete locale (${esc(META.track_base)})" />
        <p class="text-xs text-gray-400 mt-1">Quando il tracciamento sarà online (es. https://riparazioni.informatixrepair.com) scrivilo qui: i QR e i link useranno questo indirizzo.</p></div>
      <div><label class="l">Condizioni stampate sulla scheda di ingresso</label><textarea data-k="terms" rows="5">${esc(s.terms)}</textarea></div>
      <div><button class="btn btn-primary" id="st-save">Salva impostazioni</button></div>
    </div>
    <div class="card p-4 sm:p-5">
      <h2 class="font-heading font-bold mb-1">💾 Backup dei dati</h2>
      <p class="text-sm text-gray-500 mb-3">Scarica una copia completa di clienti, riparazioni, magazzino e vendite. Conservala su una chiavetta o nel cloud, almeno una volta a settimana.</p>
      <a class="btn btn-dark w-full" href="/api/backup" download>Scarica backup</a>
      <p class="text-xs text-gray-400 mt-3">Per ripristinarlo: chiudi il gestionale e sostituisci <code>officina/data/officina.db</code> con il file scaricato.</p>
    </div></div>`;
  $('#st-save', el).onclick = async () => {
    const body = {};
    el.querySelectorAll('[data-k]').forEach((i) => { body[i.dataset.k] = i.value; });
    if (await safe(() => api('PUT', '/api/settings', body))) { await loadMeta(); toast('Impostazioni salvate'); }
  };
}
