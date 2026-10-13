// Vendite al banco, cassa giornaliera e impostazioni.
import { $, esc, eur, fdt, fdate, api, toast, safe, debounce, today, addDays, META, loadMeta } from './util.js';

export async function salesView(el) {
  const cart = [];
  let customer = null;
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Vendite</h1></div>
    <div class="grid lg:grid-cols-5 gap-5 items-start">
      <section class="card panel sec lg:col-span-3">
        <h2 class="sec-t">Vendita veloce</h2>
        <div class="field">
          <label class="l" for="s-q">Cerca un articolo</label>
          <div class="relative"><input id="s-q" type="search" placeholder="Nome o codice dell'articolo" autocomplete="off" /><div id="s-sugg" class="suggest card hidden"></div></div>
        </div>
        <div class="field">
          <label class="l" for="s-free">Oppure aggiungi una voce libera</label>
          <div class="free-row"><input id="s-free" placeholder="es. Pulizia software" /><input id="s-free-p" inputmode="decimal" placeholder="Importo €" aria-label="Importo" /><button class="btn btn-outline" id="s-free-add">Aggiungi</button></div>
        </div>
        <div class="field">
          <label class="l" for="s-cust">Cliente <span style="font-weight:500;color:var(--muted)">(facoltativo, per lo storico)</span></label>
          <div class="relative"><input id="s-cust" placeholder="Cerca per nome o telefono" autocomplete="off" /><div id="s-cust-s" class="suggest card hidden"></div></div>
          <div id="s-cust-pick" class="hidden"></div>
        </div>
        <div id="s-cart" class="sec" style="margin-top:.4rem"></div>
      </section>
      <section class="card panel sec lg:col-span-2">
        <h2 class="sec-t">Ultime vendite</h2><div id="s-recent" class="plist"></div>
      </section>
    </div>`;
  const sugg = $('#s-sugg', el);

  function renderCart() {
    const subtotal = cart.reduce((a, i) => a + i.qty * i.unit_price, 0);
    $('#s-cart', el).innerHTML = cart.length
      ? `<div class="sec" style="gap:0"><h3 class="sec-t" style="margin-bottom:.9rem">Carrello</h3>${cart.map((i, idx) => `<div class="cart-item">
          <span class="name">${esc(i.name)}</span><button class="xbtn" data-rm="${idx}" aria-label="Rimuovi ${esc(i.name)}">✕</button>
          <div class="ctrl">
            <span class="qty"><button class="btn btn-outline btn-sm" data-q="${idx}" data-d="-1" aria-label="Meno">−</button><b>${i.qty}</b><button class="btn btn-outline btn-sm" data-q="${idx}" data-d="1" aria-label="Più">+</button></span>
            <span class="hint">×</span><input style="width:6.5rem" inputmode="decimal" data-p="${idx}" value="${i.unit_price}" aria-label="Prezzo unitario" />
            <span class="sub-total">${eur(i.qty * i.unit_price)}</span>
          </div></div>`).join('')}</div>
        <div class="fgrid c3" style="align-items:end">
          <div class="field"><label class="l" for="s-disc">Sconto €</label><input id="s-disc" inputmode="decimal" value="0" /></div>
          <div class="field"><label class="l" for="s-method">Pagamento</label><select id="s-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div>
          <div class="total-box" style="flex-direction:column;align-items:flex-end;gap:0"><span class="hint">Totale</span><b class="font-heading" style="font-size:1.9rem;line-height:1.1" id="s-total">${eur(subtotal)}</b></div>
        </div>
        <button class="btn btn-green btn-lg" style="width:100%" id="s-pay">✔ Incassa</button>`
      : '<p class="empty">Il carrello è vuoto: cerca un articolo o aggiungi una voce libera.</p>';
    const disc = $('#s-disc', el);
    if (disc) disc.oninput = () => { $('#s-total', el).textContent = eur(Math.max(0, subtotal - (Number(String(disc.value).replace(',', '.')) || 0))); };
  }

  async function recent() {
    const rows = await safe(() => api('GET', '/api/sales'));
    if (!$('#s-recent', el)) return; // pagina cambiata nel frattempo
    $('#s-recent', el).innerHTML = (rows || []).slice(0, 12).map((s) => `<div><span>${esc(s.code)}<span class="hint" style="display:block">${fdt(s.created_at)} · ${esc(s.method)}${s.customer_name ? ' · ' + esc(s.customer_name) : ''}</span></span><span><b>${eur(s.total)}</b><a class="xbtn" style="color:var(--muted)" target="_blank" href="/print/sale/${s.id}" aria-label="Stampa ricevuta">🖨️</a></span></div>`).join('') || '<p class="empty">Ancora nessuna vendita.</p>';
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
    if (!box) return;
    if (q.length < 2) return box.classList.add('hidden');
    const rows = await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`));
    if (!box.isConnected) return; // l'utente ha cambiato pagina nel frattempo
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
      box.innerHTML = `<div class="total-box" style="background:#ECFDF5;border:1px solid #A7F3D0"><span>✔ <b>${esc(customer.name)}</b></span><button class="btn btn-ghost btn-sm" id="s-unpick">cambia</button></div>`;
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
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Cassa</h1></div>
    <div class="flex gap-2 items-center flex-wrap"><span class="chip" data-r="0">Oggi</span><span class="chip" data-r="7">7 giorni</span><span class="chip" data-r="30">30 giorni</span>
    <input type="date" id="c-from" class="!w-auto" value="${from}" aria-label="Dal" /><span class="text-gray-400">→</span><input type="date" id="c-to" class="!w-auto" value="${to}" aria-label="Al" /></div><div id="c-out"></div>`;
  async function load() {
    const r = await safe(() => api('GET', `/api/report?from=${from}&to=${to}`));
    if (!r || !$('#c-out', el)) return;
    const max = Math.max(1, ...r.by_day.map((d) => d.total));
    $('#c-out', el).innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card kpi"><b class="text-secondary">${eur(r.total)}</b><span>Incassato nel periodo</span></div>
        ${r.by_method.map((m) => `<div class="card kpi"><b>${eur(m.total)}</b><span>${esc(m.method)} (${m.n})</span></div>`).join('')}
        <div class="card kpi"><b class="text-gray-600">${eur(r.parts_cost)}</b><span>Costo ricambi e merce venduta</span></div>
      </div>
      ${r.by_day.length > 1 ? `<div class="card panel sec"><h3 class="sec-t">Incassi per giorno</h3>
        <div class="flex items-end gap-1.5 h-36 overflow-x-auto pb-1">${r.by_day.map((d) => `<div class="flex flex-col items-center justify-end h-full min-w-[2.2rem] flex-1" title="${fdate(d.day)}: ${eur(d.total)}">
          <span class="text-[10px] text-gray-500 mb-1">${Math.round(d.total)}</span><div class="w-full rounded-t bg-secondary" style="height:${Math.max(4, (d.total / max) * 100)}%"></div>
          <span class="text-[10px] text-gray-400 mt-1">${d.day.slice(8)}/${d.day.slice(5, 7)}</span></div>`).join('')}</div></div>` : ''}
      <div class="card overflow-hidden">
        <div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Data</th><th>Voce</th><th>Metodo</th><th style="text-align:right">Importo</th></tr></thead><tbody>
        ${r.rows.map((p) => `<tr><td style="white-space:nowrap">${fdt(p.created_at)}</td><td>${esc(p.label)}</td><td>${esc(p.method)}</td><td style="text-align:right"><b>${eur(p.amount)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nessun incasso nel periodo.</td></tr>'}</tbody></table></div>
        <div class="only-narrow">${r.rows.map((p) => `<div class="pcard"><div class="top"><span class="name">${esc(p.label)}</span><b>${eur(p.amount)}</b></div><div class="sub">${fdt(p.created_at)} · ${esc(p.method)}</div></div>`).join('') || '<p class="empty">Nessun incasso nel periodo.</p>'}</div>
      </div>
      <p class="hint">Riepilogo gestionale non fiscale: scontrini e fatture vanno emessi con il registratore telematico o il programma di fatturazione.</p>`;
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
  const f = (k, l, extra = '') => `<div class="field"><label class="l" for="st-${k}">${l}</label><input id="st-${k}" data-k="${k}" value="${esc(s[k] || '')}" ${extra} /></div>`;
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Impostazioni</h1></div>
    <div class="grid lg:grid-cols-3 gap-5 items-start">
      <section class="card panel sec lg:col-span-2">
        <h2 class="sec-t">Dati del negozio</h2>
        <div class="fgrid c2">
          ${f('shop_name', 'Nome del negozio')}${f('shop_phone', 'Telefono')}
          <div class="span2">${f('shop_address', 'Indirizzo')}</div>
          ${f('default_warranty_days', 'Giorni di garanzia sulle riparazioni', 'inputmode="numeric"')}
        </div>
        <h2 class="sec-t" style="margin-top:.6rem">Tracciamento per i clienti</h2>
        <div class="field"><label class="l" for="st-url">Indirizzo pubblico</label><input id="st-url" data-k="public_base_url" value="${esc(s.public_base_url)}" placeholder="vuoto = rete locale (${esc(META.track_base)})" />
          <span class="hint">Quando il tracciamento sarà online (es. https://riparazioni.informatixrepair.com) scrivilo qui: i QR e i link useranno questo indirizzo.</span></div>
        <h2 class="sec-t" style="margin-top:.6rem">Scheda di ingresso</h2>
        <div class="field"><label class="l" for="st-terms">Condizioni stampate sulla scheda</label><textarea id="st-terms" data-k="terms" rows="5">${esc(s.terms)}</textarea></div>
        <div><button class="btn btn-primary" id="st-save">Salva impostazioni</button></div>
      </section>
      <section class="card panel sec">
        <h2 class="sec-t">Backup dei dati</h2>
        <p style="font-size:.92rem">Scarica una copia completa di clienti, riparazioni, magazzino e vendite. Conservala su una chiavetta o nel cloud, almeno una volta a settimana.</p>
        <a class="btn btn-dark" href="/api/backup" download>Scarica backup</a>
        <p class="hint">Per ripristinarlo: chiudi il gestionale e sostituisci <code>officina/data/officina.db</code> con il file scaricato.</p>
      </section>
    </div>`;
  $('#st-save', el).onclick = async () => {
    const body = {};
    el.querySelectorAll('[data-k]').forEach((i) => { body[i.dataset.k] = i.value; });
    if (await safe(() => api('PUT', '/api/settings', body))) { await loadMeta(); toast('Impostazioni salvate'); }
  };
}
