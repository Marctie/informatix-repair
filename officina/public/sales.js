// Vendite al banco, cassa giornaliera e impostazioni.
import { hbars, kpi, AN_CSS } from './analytics.js';
import { createSettlement } from './buoni.js';
import { retroField, retroVal, appesoField, appesoVal } from './retro.js';
import { blackBanner, showBlackAlert } from './blacks.js';
import { debtorNotice, mountLedgerSettings } from './dareavere.js'; // Agente C
import { showDeviceAlerts } from './dispositivi.js';
import { mountMaterialsSettings } from './materiali.js'; // agente D
import { $, $$, esc, eur, fdt, fdate, api, toast, safe, debounce, today, addDays, META, loadMeta, openModal, confirmDelete, canSeeCosts, isScanEnter, beep } from './util.js';
import { lookupCode, looksLikeCode, mountLabelSettings } from './etichette.js'; // etichette prodotto e lettura dei codici a barre
import { scanWithCamera, cameraSupported } from './scan.js';

export async function salesView(el) {
  const cart = [];
  let customer = null;
  const discNow = () => Number(String($('#s-disc', el)?.value ?? '0').replace(',', '.')) || 0;
  const dueNow = () => Math.max(0, cart.reduce((a, i) => a + i.qty * i.unit_price, 0) - discNow());
  // Pagamento: metodo singolo, conto diviso e codice buono (buoni.js)
  const settle = createSettlement({ methodId: 's-method', getDue: dueNow });
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Vendite</h1></div>
    <div class="grid lg:grid-cols-5 gap-5 items-start">
      <section class="card panel sec lg:col-span-3">
        <h2 class="sec-t">Vendita veloce</h2>
        <div class="field">
          <label class="l" for="s-q">Cerca un articolo o leggi il codice a barre</label>
          <div class="row nowrap"><div class="relative grow"><input id="s-q" type="search" placeholder="Nome, codice… oppure spara il codice a barre" autocomplete="off" /><div id="s-sugg" class="suggest card hidden"></div></div>${cameraSupported() ? '<button class="btn btn-outline btn-icon" id="s-cam" type="button" aria-label="Leggi il codice con la fotocamera">📷</button>' : ''}</div>
        </div>
        <div class="field">
          <label class="l">Servizi <button class="btn btn-ghost btn-sm" id="s-svc-edit" type="button">Gestisci listino</button></label>
          <div id="s-svc" class="row tight" style="flex-wrap:wrap"></div>
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
  let services = [];
  async function loadServices() {
    services = (await safe(() => api('GET', '/api/services'))) || [];
    if (!$('#s-svc', el)) return;
    $('#s-svc', el).innerHTML = services.map((x) => `<button class="chip" type="button" data-svc="${x.id}">${esc(x.name)} · ${eur(x.price)}</button>`).join('') || '<span class="hint">Nessun servizio nel listino: aggiungili da “Gestisci listino”.</span>';
  }

  function renderCart() {
    const subtotal = cart.reduce((a, i) => a + i.qty * i.unit_price, 0);
    const keepDisc = discNow(); // lo sconto digitato non si perde quando cambia il carrello
    const keepRetro = $('#s-retro', el)?.value || ''; // idem la data di un giorno passato e la spunta "stampa"
    const keepAppeso = $('#s-appeso', el) ? $('#s-appeso', el).checked : false;
    const keepPrint = $('#s-print', el) ? $('#s-print', el).checked : wantPrint();
    const retroOpen = !!$('#s-cart details.retro[open]', el);
    $('#s-cart', el).innerHTML = cart.length
      ? `<div class="sec" style="gap:0"><h3 class="sec-t" style="margin-bottom:.9rem">Carrello</h3>${cart.map((i, idx) => `<div class="cart-item">
          <span class="name">${esc(i.name)}</span><button class="xbtn" data-rm="${idx}" aria-label="Rimuovi ${esc(i.name)}">✕</button>
          <div class="ctrl">
            <span class="qty"><button class="btn btn-outline btn-sm" data-q="${idx}" data-d="-1" aria-label="Meno">−</button><b>${i.qty}</b><button class="btn btn-outline btn-sm" data-q="${idx}" data-d="1" aria-label="Più">+</button></span>
            <span class="hint">×</span><input style="width:6.5rem" inputmode="decimal" data-p="${idx}" value="${i.unit_price}" aria-label="Prezzo unitario" />
            <span class="sub-total">${eur(i.qty * i.unit_price)}</span>
          </div>${i.product_id && i.stock != null ? `<div class="hint" style="margin-top:.3rem;${i.stock - i.qty < 0 ? 'color:var(--red-d);font-weight:700' : ''}">In magazzino ${i.stock} pz → dopo la vendita ${i.stock - i.qty}${i.stock - i.qty < 0 ? ' (giacenza insufficiente)' : ''}</div>` : ''}<input data-sn="${idx}" value="${esc(i.serial || '')}" placeholder="Seriale / IMEI (facoltativo)" aria-label="Seriale o IMEI" style="margin-top:.4rem" /></div>`).join('')}</div>
        <div class="fgrid c2" style="align-items:end">
          <div class="field"><label class="l" for="s-disc">Sconto €</label><input id="s-disc" inputmode="decimal" value="${esc(String(keepDisc))}" /></div>
          <div class="total-box" style="flex-direction:column;align-items:flex-end;gap:0"><span class="hint">Totale</span><b class="font-heading" style="font-size:1.9rem;line-height:1.1" id="s-total">${eur(Math.max(0, subtotal - keepDisc))}</b></div>
        </div>
        <div class="sec" id="s-settle"></div>
        ${retroField('s-retro')}
        ${appesoField('s-appeso', keepAppeso)}
        <label class="row tight" style="align-items:center;gap:.5rem;margin-bottom:.5rem"><input type="checkbox" id="s-print" ${keepPrint ? 'checked' : ''} style="width:1.4rem;height:1.4rem" /> Stampa la ricevuta</label>
        <button class="btn btn-green btn-lg" style="width:100%" id="s-pay">✔ Incassa</button>`
      : '<p class="empty">Il carrello è vuoto: cerca un articolo o aggiungi una voce libera.</p>';
    const disc = $('#s-disc', el);
    const rd = $('#s-retro', el);
    if (rd && keepRetro) { rd.value = keepRetro; }
    if (rd && (keepRetro || retroOpen)) rd.closest('details')?.setAttribute('open', '');
    if (disc) {
      settle.mount($('#s-settle', el));
      disc.oninput = () => { $('#s-total', el).textContent = eur(Math.max(0, subtotal - discNow())); settle.update(); };
    }
  }

  async function recent() {
    const rows = await safe(() => api('GET', '/api/sales'));
    if (!$('#s-recent', el)) return; // pagina cambiata nel frattempo
    $('#s-recent', el).innerHTML = (rows || []).slice(0, 12).map((s) => `<div><span>${esc(s.code)}<span class="hint" style="display:block">${fdt(s.created_at)} · ${esc(s.method)}${s.customer_name ? ' · ' + esc(s.customer_name) : ''}</span></span><span><b>${eur(s.total)}</b><a class="xbtn" style="color:var(--muted)" target="_blank" href="/print/sale/${s.id}" aria-label="Stampa ricevuta">🖨️</a></span></div>`).join('') || '<p class="empty">Ancora nessuna vendita.</p>';
  }

  $('#s-q', el).oninput = debounce(async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2 || q === lastScan) return sugg.classList.add('hidden');
    const rows = await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`));
    sugg.innerHTML = (rows || []).map((p) => `<div class="px-3 py-2.5 hover:bg-lightbg cursor-pointer text-sm flex justify-between gap-2 ${p.qty <= 0 ? 'opacity-50' : ''}" data-add="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}" data-qty="${p.qty}"><span class="min-w-0">${esc(p.name)}</span><span class="text-gray-500 shrink-0">${p.qty} pz · ${eur(p.price)}</span></div>`).join('') || '<div class="px-3 py-2 text-sm text-gray-400">Nessun articolo in magazzino: usa la voce libera.</div>';
    sugg.classList.remove('hidden');
  }, 200);

  /** Aggiunge un articolo al carrello (da elenco, da codice a barre o da fotocamera). p = { id, name, price, qty (giacenza) } */
  function addToCart(p) {
    const ex = cart.find((i) => i.product_id === p.id);
    if (ex) { ex.qty++; ex.stock = p.qty; } else cart.push({ product_id: p.id, name: p.name, qty: 1, unit_price: Number(p.price), stock: p.qty });
    sugg.classList.add('hidden');
    $('#s-q', el).value = '';
    renderCart();
  }
  // Codice letto con la pistola (che "scrive" le cifre e preme Invio) oppure con la fotocamera: l'articolo va nel carrello
  // e la giacenza scende all'incasso. Se il codice non e' nell'anagrafica non si inventa nulla: si avvisa.
  let lastScan = ''; // il codice appena letto non deve riaprire anche l'elenco dei suggerimenti
  async function scanCode(code, { scanned }) {
    const qIn = $('#s-q', el);
    lastScan = code;
    const p = await lookupCode(code);
    sugg.classList.add('hidden');
    if (p === undefined) { beep(false); qIn.select(); return; } // errore gia' mostrato (rete, articolo archiviato...)
    if (!p) {
      beep(false);
      toast(`Il codice ${code} non è in magazzino.`, false, { ms: 8000, hint: 'Controlla di averlo letto bene, oppure crea l’articolo da Magazzino.' });
      qIn.select();
      return;
    }
    addToCart({ id: p.id, name: p.name, price: p.price, qty: p.qty });
    beep(p.qty > 0);
    const line = cart.find((i) => i.product_id === p.id);
    if (p.qty <= 0) toast(`${p.name}: giacenza 0, controlla il magazzino.`, false, { ms: 6000 });
    else if (p.duplicates) toast(`Più articoli hanno il codice ${code}: ho preso “${p.name}”, controlla.`, false, { ms: 6000 });
    else toast(`✔ ${p.name}${line.qty > 1 ? ` ×${line.qty}` : ''}`, true, { ms: 1500 });
    if (scanned) $('#s-q', el)?.focus();
  }
  $('#s-q', el).addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const code = e.target.value.trim();
    const scanned = isScanEnter(e);
    if (!code || !(scanned || looksLikeCode(code))) return; // un nome scritto a mano resta una ricerca normale
    e.preventDefault();
    scanCode(code, { scanned });
  });
  if ($('#s-cam', el)) $('#s-cam', el).onclick = async () => { const c = await scanWithCamera(); if (c) scanCode(c.trim(), { scanned: false }); };
  // Con la pistola non serve cliccare prima nel campo: le cifre "a raffica" finiscono comunque nella ricerca
  const searchBox = $('#s-q', el);
  const grab = (e) => {
    if (!searchBox.isConnected) return document.removeEventListener('keydown', grab, true); // la vista e' stata chiusa
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if ($('#modal-root')?.children.length) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    searchBox.focus();
  };
  document.addEventListener('keydown', grab, true);
  if (window.matchMedia?.('(pointer:fine)').matches) $('#s-q', el).focus(); // sul PC il cursore e' gia' pronto per la pistola

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
    if (add) return addToCart({ id: Number(add.dataset.add), name: add.dataset.name, price: add.dataset.price, qty: Number(add.dataset.qty) });
    const pick = e.target.closest('[data-cust]');
    if (pick) {
      customer = { id: Number(pick.dataset.cust), name: pick.dataset.name };
      $('#s-cust-s', el).classList.add('hidden'); $('#s-cust', el).classList.add('hidden');
      const box = $('#s-cust-pick', el);
      box.innerHTML = `<div class="total-box" style="background:#ECFDF5;border:1px solid #A7F3D0"><span>✔ <b>${esc(customer.name)}</b></span><button class="btn btn-ghost btn-sm" id="s-unpick">cambia</button></div>`;
      box.classList.remove('hidden');
      safe(() => api('GET', `/api/blacklist/check?customer_id=${customer.id}`)).then((o) => { if (o?.matches?.length && box.isConnected) box.insertAdjacentHTML('afterend', `<div id="s-black">${blackBanner(o.matches)}</div>`); });
      debtorNotice(box, customer.id); // Agente C: avviso cattivo pagatore
      return;
    }
    if (e.target.id === 's-unpick') { $('#s-black', el)?.remove(); customer = null; $('#s-cust-pick', el).classList.add('hidden'); $('#s-cust', el).classList.remove('hidden'); $('#s-cust', el).value = ''; return; }
    const q = e.target.closest('[data-q]');
    if (q) { const i = cart[Number(q.dataset.q)]; i.qty = Math.max(1, i.qty + Number(q.dataset.d)); return renderCart(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { cart.splice(Number(rm.dataset.rm), 1); return renderCart(); }
    const sv = e.target.closest('[data-svc]');
    if (sv) { const x = services.find((y) => y.id === Number(sv.dataset.svc)); cart.push({ name: x.name, qty: 1, unit_price: x.price, unit_cost: x.cost }); return renderCart(); }
    if (e.target.id === 's-svc-edit') return servicesDialog(loadServices);
    if (e.target.id === 's-free-add') {
      const name = $('#s-free', el).value.trim(); const price = Number(String($('#s-free-p', el).value).replace(',', '.'));
      if (!name || !(price >= 0) || $('#s-free-p', el).value === '') return toast('Inserisci descrizione e importo', false);
      cart.push({ name, qty: 1, unit_price: price }); $('#s-free', el).value = ''; $('#s-free-p', el).value = ''; return renderCart();
    }
    if (e.target.id === 's-pay') {
      const printNow = $('#s-print', el).checked;
      try { localStorage.setItem('sale_print', printNow ? '1' : '0'); } catch { /* memoria non disponibile */ }
      const bad = settle.validate();
      if (bad) return toast(bad, false);
      e.target.disabled = true;
      const out = await safe(() => api('POST', '/api/sales', { items: cart, discount: $('#s-disc', el).value, customer_id: customer?.id || null, ...settle.payload(), ...retroVal(el, 's-retro'), ...appesoVal(el, 's-appeso') }));
      e.target.disabled = false;
      if (!out) return;
      cart.length = 0; settle.reset(); renderCart(); recent();
      showDeviceAlerts(out.device_alerts);
      showBlackAlert(out.blacklist_alert);
      toast(`Venduto: ${eur(out.total)}`);
      if (printNow) window.open(`/print/sale/${out.id}`, '_blank');
    }
  });
  el.addEventListener('change', (e) => {
    const sn = e.target.closest('[data-sn]');
    if (sn) { cart[Number(sn.dataset.sn)].serial = sn.value.trim(); return; }
    const p = e.target.closest('[data-p]');
    if (p) { cart[Number(p.dataset.p)].unit_price = Number(String(p.value).replace(',', '.')) || 0; renderCart(); }
  });
  renderCart();
  await Promise.all([recent(), loadServices()]);
}

export async function cashView(el, qs = new URLSearchParams()) {
  const days0 = Math.max(0, Number(qs.get('days')) || 0);
  let from = days0 ? addDays(-days0) : today(), to = today();
  let expRows = [];
  const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  el.innerHTML = `${AN_CSS}
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Cassa</h1></div>
    <div class="flex gap-2 items-center flex-wrap" id="c-period"><span class="chip" data-r="0">Oggi</span><span class="chip" data-r="7">7 giorni</span><span class="chip" data-r="30">30 giorni</span><span class="chip" data-r="90">90 giorni</span>
    <input type="date" id="c-from" class="!w-auto" value="${from}" aria-label="Dal" /><span class="text-gray-400">→</span><input type="date" id="c-to" class="!w-auto" value="${to}" aria-label="Al" /></div>
    <div class="flex gap-2 flex-wrap"><button class="btn btn-outline" id="c-newexp">＋ Nuova spesa</button><button class="btn btn-dark" id="c-nota">📄 Genera nota spese (PDF)</button></div><div id="c-out" data-an></div>`;
  async function load() {
    const r = await safe(() => api('GET', `/api/report?from=${from}&to=${to}`));
    const ex = await safe(() => api('GET', `/api/expenses?from=${from}&to=${to}`));
    if (!r || !ex || !$('#c-out', el)) return;
    expRows = ex.rows;
    const max = Math.max(1, ...r.by_day.map((d) => d.total));
    const days = Math.max(1, Math.round((new Date(`${r.to}T00:00:00Z`) - new Date(`${r.from}T00:00:00Z`)) / 86400000) + 1);
    // raggruppamenti calcolati sull'elenco dei singoli incassi
    const group = (keyOf) => {
      const m = new Map();
      for (const p of r.rows) { const k = keyOf(p); const g = m.get(k) || { name: k, total: 0, n: 0 }; g.total += p.amount; g.n += 1; m.set(k, g); }
      return [...m.values()].map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }));
    };
    const byKind = group((p) => ({ sale: 'Vendite', fattura: 'Fatture', dareavere: 'Dare/avere' }[p.kind] || 'Riparazioni')).sort((x, y) => y.total - x.total);
    const byHour = group((p) => `${p.created_at.slice(11, 13)}:00`).sort((x, y) => (x.name < y.name ? -1 : 1));
    const byDow = group((p) => DOW[new Date(`${p.created_at.slice(0, 10)}T12:00:00Z`).getUTCDay()]).sort((x, y) => DOW.indexOf(x.name) - DOW.indexOf(y.name));
    const pct = (v) => (r.total > 0 ? ` · ${Math.round((v / r.total) * 100)}%` : '');
    $('#c-out', el).innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        ${kpi(eur(r.total), 'Incassato nel periodo', 'text-secondary')}
        ${kpi(r.rows.length, r.rows.length === 1 ? 'Operazione' : 'Operazioni')}
        ${kpi(eur(r.total / days), 'Media al giorno')}
        ${canSeeCosts() ? kpi(eur(r.parts_cost), 'Costo ricambi e merce venduta', 'text-gray-600') : ''}
        ${kpi(eur(ex.total), 'Spese nel periodo', 'text-amber-600')}
        ${kpi(eur(r.total - ex.total), 'Incassi meno spese', r.total - ex.total >= 0 ? 'text-emerald-600' : 'text-red-600')}
      </div>
      ${r.vouchers?.n ? `<section class="card panel sec"><h3 class="sec-t">Buoni usati nel periodo (${r.vouchers.n})</h3>
        <div class="plist"><div><span>Buoni regalo incassati come credito <span class="hint" style="display:block">compaiono sopra come metodo “buono”</span></span><b>${eur(r.vouchers.credit)}</b></div>
        <div><span>Sconti dei buoni <span class="hint" style="display:block">già tolti dai totali delle vendite</span></span><b>${eur(r.vouchers.discount)}</b></div></div></section>` : ''}
      ${r.rows.length ? `<div class="an-cols">
        <section class="card panel sec"><h3 class="sec-t">Per metodo di pagamento</h3>${hbars([...r.by_method].sort((x, y) => y.total - x.total), { value: (m) => m.total, label: (m) => `${m.method} (${m.n})`, fmt: (v) => eur(v) + pct(v) })}</section>
        <section class="card panel sec"><h3 class="sec-t">Riparazioni e vendite</h3>${hbars(byKind, { value: (g) => g.total, label: (g) => `${g.name} (${g.n})`, fmt: (v) => eur(v) + pct(v) })}</section>
        ${r.by_day.length > 1 ? `<section class="card panel sec" style="grid-column:1/-1"><h3 class="sec-t">Incassi per giorno</h3>
          <div class="flex items-end gap-1.5 h-40 overflow-x-auto pb-1">${r.by_day.map((d) => `<div class="flex flex-col items-center justify-end h-full min-w-[2.4rem] flex-1" title="${fdate(d.day)}: ${eur(d.total)}">
            <span class="text-[10px] text-gray-500 mb-1">${Math.round(d.total)}</span><div class="w-full rounded-t bg-secondary" style="height:${Math.max(4, (d.total / max) * 100)}%"></div>
            <span class="text-[10px] text-gray-400 mt-1">${d.day.slice(8)}/${d.day.slice(5, 7)}</span></div>`).join('')}</div></section>` : ''}
        ${days > 1 ? `<section class="card panel sec"><h3 class="sec-t">Giorno della settimana</h3>${hbars(byDow, { value: (g) => g.total, fmt: eur })}</section>` : ''}
        <section class="card panel sec"><h3 class="sec-t">Ora del giorno</h3>${hbars(byHour, { value: (g) => g.total, fmt: eur })}</section>
      </div>` : ''}
      <section class="card overflow-hidden">
        <h3 class="sec-t" style="padding:1rem 1rem .2rem">Elenco degli incassi</h3>
        <div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Data</th><th>Voce</th><th>Metodo</th><th style="text-align:right">Importo</th></tr></thead><tbody>
        ${r.rows.map((p) => `<tr><td style="white-space:nowrap">${fdt(p.created_at)}</td><td>${esc(p.label)}</td><td>${esc(p.method)}</td><td style="text-align:right"><b>${eur(p.amount)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nessun incasso nel periodo.</td></tr>'}</tbody></table></div>
        <div class="only-narrow">${r.rows.map((p) => `<div class="pcard"><div class="top"><span class="name">${esc(p.label)}</span><b>${eur(p.amount)}</b></div><div class="sub">${fdt(p.created_at)} · ${esc(p.method)}</div></div>`).join('') || '<p class="empty">Nessun incasso nel periodo.</p>'}</div>
      </section>
      <section class="card overflow-hidden">
        <h3 class="sec-t" style="padding:1rem 1rem .2rem">Spese del periodo (${ex.rows.length})</h3>
        ${ex.rows.length ? `<div>${ex.rows.map((x) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-exp="${x.id}">
          <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(x.description)}</p><p class="text-xs text-gray-500">${fdate(x.spent_on)} · ${esc(x.category)}${x.vendor ? ' · ' + esc(x.vendor) : ''}${x.doc_type === 'nessuno' ? ' · <b class="text-red-600">senza giustificativo</b>' : ''}${x.reimbursable ? ' · da rimborsare' : ''}</p></div>
          <b>${eur(x.amount)}</b></div>`).join('')}</div>` : '<p class="empty">Nessuna spesa registrata nel periodo.</p>'}
      </section>
      <p class="hint">Riepilogo gestionale non fiscale: scontrini e fatture vanno emessi con il registratore telematico o il programma di fatturazione.</p>`;
  }
  $('#c-newexp', el).onclick = () => expenseForm(null, load);
  $('#c-nota', el).onclick = () => notaDialog(() => ({ from, to }));
  el.addEventListener('click', (e) => {
    const x = e.target.closest('[data-exp]');
    if (x) { expenseForm(expRows.find((r) => r.id === Number(x.dataset.exp)), load); return; }
    const c = e.target.closest('[data-r]'); if (!c) return;
    to = today(); from = addDays(-Number(c.dataset.r));
    $('#c-from', el).value = from; $('#c-to', el).value = to; load();
  });
  $('#c-from', el).onchange = (e) => { from = e.target.value; load(); };
  $('#c-to', el).onchange = (e) => { to = e.target.value; load(); };
  await load();
}

/** Ultima scelta di stampa (per postazione): di default la ricevuta si stampa. */
const wantPrint = () => { try { return localStorage.getItem('sale_print') !== '0'; } catch { return true; } };
/** Gestione del listino servizi: elenco, modifica rapida, nuovo, elimina (con doppia conferma). */
async function servicesDialog(done) {
  const m = openModal('', { title: 'Listino servizi', footer: '<button class="btn btn-outline" data-close>Chiudi</button>' });
  const body = $('.modal-body', m.el);
  const draw = async () => {
    const rows = (await safe(() => api('GET', '/api/services'))) || [];
    body.innerHTML = `<div class="plist">${rows.map((x) => `<div data-id="${x.id}"><span>${esc(x.name)}${canSeeCosts() ? `<span class="hint" style="display:block">costo ${eur(x.cost)}</span>` : ''}</span><span><b>${eur(x.price)}</b> <button class="xbtn" data-edit="${x.id}" aria-label="Modifica ${esc(x.name)}">✎</button><button class="xbtn" data-del="${x.id}" aria-label="Elimina ${esc(x.name)}">✕</button></span></div>`).join('') || '<p class="hint">Nessun servizio.</p>'}</div>
      <h3 class="sec-t" style="margin-top:1rem" id="sv-t">Nuovo servizio</h3>
      <div class="fgrid c3"><div class="field"><label class="l" for="sv-n">Nome</label><input id="sv-n" placeholder="es. Ripristino Windows 11" /></div>
        <div class="field"><label class="l" for="sv-p">Prezzo €</label><input id="sv-p" inputmode="decimal" /></div>
        ${canSeeCosts() ? '<div class="field"><label class="l" for="sv-c">Costo € (facoltativo)</label><input id="sv-c" inputmode="decimal" /></div>' : ''}</div>
      <button class="btn btn-primary" id="sv-ok">Salva servizio</button>`;
    let editing = null;
    const n = (id) => $(id, body);
    body.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'); const dl = e.target.closest('[data-del]');
      if (ed) { editing = rows.find((x) => x.id === Number(ed.dataset.edit)); n('#sv-n').value = editing.name; n('#sv-p').value = editing.price; if (n('#sv-c')) n('#sv-c').value = editing.cost; n('#sv-t').textContent = 'Modifica servizio'; n('#sv-n').focus(); }
      if (dl) { const x = rows.find((y) => y.id === Number(dl.dataset.del)); if (await confirmDelete(x.name)) { await safe(() => api('DELETE', `/api/services/${x.id}`)); await draw(); done(); } }
      if (e.target.id === 'sv-ok') {
        const b = { name: n('#sv-n').value, price: n('#sv-p').value.replace(',', '.') || 0, cost: (n('#sv-c')?.value || '').replace(',', '.') || 0 };
        const out = await safe(() => (editing ? api('PUT', `/api/services/${editing.id}`, b) : api('POST', '/api/services', b)));
        if (out) { toast('Servizio salvato'); await draw(); done(); }
      }
    };
  };
  await draw();
}
const METHODS = ['contanti', 'carta', 'bonifico'];
const DOC_LABEL = { scontrino: 'Scontrino', fattura: 'Fattura', ricevuta: 'Ricevuta', nessuno: 'Senza giustificativo' };
const opt = (list, sel, label = (v) => v) => list.map((v) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label(v))}</option>`).join('');

async function expenseForm(x, done) {
  const meta = await safe(() => api('GET', '/api/expenses/meta'));
  if (!meta) return;
  let lastBy = '';
  try { lastBy = localStorage.getItem('ex-by') || ''; } catch { /* facoltativo */ }
  const m = openModal(`<div class="sec">
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ex-date">Data</label><input id="ex-date" type="date" value="${esc(x?.spent_on || today())}" /></div>
        <div class="field"><label class="l" for="ex-amt">Importo (€) *</label><input id="ex-amt" inputmode="decimal" value="${x ? String(x.amount).replace('.', ',') : ''}" placeholder="0,00" /></div>
      </div>
      <div class="field"><label class="l" for="ex-desc">Descrizione / causale *</label><input id="ex-desc" value="${esc(x?.description || '')}" placeholder="Es. Cartucce per la stampante" /></div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ex-cat">Categoria</label><select id="ex-cat">${opt(meta.categories, x?.category || 'altro')}</select></div>
        <div class="field"><label class="l" for="ex-vendor">Fornitore / esercente</label><input id="ex-vendor" value="${esc(x?.vendor || '')}" /></div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ex-doc">Giustificativo</label><select id="ex-doc">${opt(meta.doc_types, x?.doc_type || 'scontrino', (v) => DOC_LABEL[v] || v)}</select></div>
        <div class="field"><label class="l" for="ex-num">Numero documento</label><input id="ex-num" value="${esc(x?.doc_number || '')}" /></div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ex-vat">di cui IVA (€)</label><input id="ex-vat" inputmode="decimal" value="${x?.vat ? String(x.vat).replace('.', ',') : ''}" placeholder="0,00" /></div>
        <div class="field"><label class="l" for="ex-method">Pagato con</label><select id="ex-method">${opt(METHODS, x?.method || 'contanti')}</select></div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ex-by">Anticipata da</label><input id="ex-by" value="${esc(x?.paid_by || lastBy)}" placeholder="Es. Christian" /></div>
        <label class="row tight" style="cursor:pointer;align-self:end;padding-bottom:.6rem"><input type="checkbox" id="ex-reimb" ${x?.reimbursable ? 'checked' : ''} /> Da rimborsare</label>
      </div>
    </div>`, { title: x ? 'Modifica spesa' : 'Nuova spesa', footer: `${x ? '<button class="btn btn-ghost" id="ex-del">Elimina</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ex-ok">Salva</button>` });
  $('#ex-ok', m.el).onclick = async () => {
    const body = { spent_on: $('#ex-date', m.el).value, amount: $('#ex-amt', m.el).value, description: $('#ex-desc', m.el).value, category: $('#ex-cat', m.el).value, vendor: $('#ex-vendor', m.el).value,
      doc_type: $('#ex-doc', m.el).value, doc_number: $('#ex-num', m.el).value, vat: $('#ex-vat', m.el).value, method: $('#ex-method', m.el).value, paid_by: $('#ex-by', m.el).value, reimbursable: $('#ex-reimb', m.el).checked };
    const out = await safe(() => (x ? api('PUT', `/api/expenses/${x.id}`, body) : api('POST', '/api/expenses', body)));
    if (out) { try { localStorage.setItem('ex-by', body.paid_by || ''); } catch { /* facoltativo */ } m.close(); toast('Spesa salvata'); done?.(); }
  };
  if (x) $('#ex-del', m.el).onclick = async () => {
    if (!(await confirmDelete('questa spesa'))) return;
    if (await safe(() => api('DELETE', `/api/expenses/${x.id}`))) { m.close(); toast('Spesa eliminata'); done?.(); }
  };
}

function notaDialog(range) {
  const { from, to } = range();
  let saved = '';
  try { saved = localStorage.getItem('ex-by') || ''; } catch { /* facoltativo */ }
  const m = openModal(`<div class="sec">
      <p style="font-size:.92rem">Crea il PDF con tutte le spese registrate dal <b>${fdate(from)}</b> al <b>${fdate(to)}</b>: elenco voci, totali per categoria, avvertenza sui giustificativi e spazi per le firme.</p>
      <div class="field"><label class="l" for="nt-who">Spese sostenute da (compare sul documento)</label><input id="nt-who" value="${esc(saved)}" placeholder="Es. Christian Pecoraro" /></div>
      <label class="row tight" style="cursor:pointer"><input type="checkbox" id="nt-reimb" /> Solo le spese da rimborsare</label>
      <p class="hint">Il periodo si cambia dalla Cassa. Stampa il PDF, allega scontrini e fatture originali e firma.</p>
    </div>`, { title: 'Genera nota spese', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="nt-ok">📄 Crea PDF</button>' });
  $('#nt-ok', m.el).onclick = () => {
    const who = $('#nt-who', m.el).value.trim();
    try { localStorage.setItem('ex-by', who); } catch { /* facoltativo */ }
    const q = new URLSearchParams({ from, to });
    if (who) q.set('who', who);
    if ($('#nt-reimb', m.el).checked) q.set('reimbursable', '1');
    window.open(`/api/expenses-pdf?${q}`, '_blank', 'noopener');
    m.close();
  };
}

const ONLINE = !['localhost', '127.0.0.1'].includes(location.hostname) && !/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname);

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
        <h2 class="sec-t" style="margin-top:.6rem">Avvisi</h2>
        <div class="fgrid c2">
          <div class="field"><label class="l" for="st-lsd">Scorta minima generale (pezzi)</label><input id="st-lsd" data-k="low_stock_default" type="number" min="0" inputmode="numeric" value="${esc(s.low_stock_default ?? '0')}" />
            <span class="hint">Vale per i prodotti senza soglia propria. 0 = spenta. Ogni prodotto può avere la sua nella scheda del magazzino.</span></div>
          <div class="field"><label class="l" for="st-sd">Prodotto fermo dopo (giorni)</label><input id="st-sd" data-k="stale_days" type="number" min="0" inputmode="numeric" value="${esc(s.stale_days ?? '90')}" />
            <span class="hint">Avviso se un prodotto non esce da tanti giorni. 0 = spento.</span></div>
        </div>
        <div class="field"><label class="l" for="st-rd">Riparazione pronta non ritirata dopo (giorni)</label><input id="st-rd" data-k="ready_days" type="number" min="0" inputmode="numeric" value="${esc(s.ready_days ?? '7')}" />
          <span class="hint">Ti ricorda di avvisare il cliente. 0 = spento.</span></div>
        <div class="field"><label class="l" for="st-qv">Validità dei preventivi (giorni)</label><input id="st-qv" data-k="quote_valid_days" type="number" min="1" max="365" inputmode="numeric" value="${esc(s.quote_valid_days ?? '15')}" />
          <span class="hint">Scadenza proposta quando crei un preventivo nella sezione Preventivi.</span></div>
        <h2 class="sec-t" style="margin-top:.6rem">Scheda di ingresso</h2>
        <div class="field"><label class="l" for="st-terms">Condizioni stampate sulla scheda</label><textarea id="st-terms" data-k="terms" rows="5">${esc(s.terms)}</textarea></div>
        <h2 class="sec-t" style="margin-top:.6rem">Dispositivi non riparati</h2>
        <div class="fgrid c2">
          <div class="field"><label class="l" for="st-sdays">Giorni di giacenza prima dell’avviso</label><input id="st-sdays" data-k="storage_days" type="number" min="1" inputmode="numeric" value="${esc(s.storage_days ?? '15')}" />
            <span class="hint">Passati questi giorni dal rifiuto (o dall’annullamento) compare l’avviso: smaltire o spostare in deposito a pagamento.</span></div>
          <div class="field"><label class="l" for="st-sfee">Tariffa del deposito a pagamento</label><input id="st-sfee" data-k="storage_fee" value="${esc(s.storage_fee || '')}" placeholder="es. 3 € a settimana" />
            <span class="hint">Compare nei messaggi e nei testi al cliente. Il pagamento non viene registrato in automatico.</span></div>
        </div>
        <div><button class="btn btn-primary" id="st-save">Salva impostazioni</button></div>
      </section>
      <section class="card panel sec lg:col-span-2 lg:col-start-1 lg:row-start-2" id="st-legal">
        <h2 class="sec-t">Testi di consenso e di conferma (bozze)</h2>
        <p class="hint">Sono bozze scritte per far funzionare il gestionale: <b>non sono consulenza legale</b> e vanno riviste da Christian e da un professionista. Finché non spunti “testi verificati”, ogni scheda e schermata li segna come “bozza da far verificare”. Segnaposto: {negozio} {garanzia} {codice} {importo} {dispositivo} {consegna} {giorni} {tariffa}.</p>
        <div class="field"><label class="l" for="st-lv">Stato dei testi</label><select id="st-lv" data-k="legal_verified"><option value="0" ${String(s.legal_verified) !== '1' ? 'selected' : ''}>Bozza da far verificare</option><option value="1" ${String(s.legal_verified) === '1' ? 'selected' : ''}>Testi verificati</option></select></div>
        ${[['consent_intake', 'Consenso sulla scheda di ingresso'], ['quote_accept_text', 'Conferma del preventivo (pulsante SÌ)'], ['quote_decline_text', 'Rifiuto del preventivo (introduzione)'], ['quote_decline_pickup', 'Rifiuto: “passerò a ritirarlo”'], ['quote_decline_cede', 'Rifiuto: “cedo il dispositivo al negozio”'], ['quote_sign_text', 'Frase sopra la firma']]
          .map(([k, l]) => `<div class="field"><label class="l" for="st-${k}">${l}</label><textarea id="st-${k}" data-k="${k}" rows="4">${esc(s[k] || '')}</textarea></div>`).join('')}
        <div><button class="btn btn-primary" id="st-save2">Salva impostazioni</button></div>
      </section>
      <div class="grid gap-5 lg:col-start-3 lg:row-start-1 lg:row-span-2">
      <section class="card panel sec">
        <h2 class="sec-t">Backup dei dati</h2>
        <p style="font-size:.92rem">${ONLINE ? 'Ogni notte il sistema salva da solo una copia di tutti i dati (si conservano le ultime 30). Puoi anche scaricarne una tu o salvarne una subito.' : 'Scarica una copia completa di clienti, riparazioni, magazzino e vendite. Conservala su una chiavetta o nel cloud, almeno una volta a settimana.'}</p>
        <div class="row tight"><a class="btn btn-dark" href="/api/backup" download>Scarica backup</a>${ONLINE ? '<button class="btn btn-outline" id="st-r2">Salva ora nel cloud</button>' : ''}</div>
        <p class="hint">${ONLINE ? 'Per ripristinare una copia serve l’assistenza: scrivici prima di cancellare qualcosa di importante.' : 'Per ripristinarlo: chiudi il gestionale e sostituisci <code>officina/data/officina.db</code> con il file scaricato.'}</p>
      </section>
      <section class="card panel sec" id="st-ck">
        <h2 class="sec-t">Checklist per tipo di dispositivo</h2>
        <p class="hint">Le voci dei controlli (ingresso, ritiro, collaudo) cambiano con il tipo di dispositivo. Una voce per riga; le modifiche valgono per le riparazioni nuove e per quelle ancora da compilare.</p>
        <div class="field"><label class="l" for="ck-type">Tipo di dispositivo</label><select id="ck-type">${Object.entries(META.device_types || {}).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
        <div id="ck-body" class="sec"></div>
      </section>
      <section class="card panel sec" id="st-demo">
        <h2 class="sec-t">Dati demo</h2>
        <p class="hint">Carica clienti, riparazioni in ogni stato, magazzino, vendite e incassi di esempio per vedere tutto il gestionale al lavoro. Sono segnati come “(DEMO)” e si cancellano con un click, senza toccare i dati veri.</p>
        <div class="row tight" id="st-demo-btns"><span class="hint">Controllo…</span></div>
      </section>
      </div>
      <section class="card panel sec lg:col-span-3" id="st-labels"></section>
    </div>`;
  const drawDemo = async () => {
    const d = await safe(() => api('GET', '/api/demo'));
    const box = $('#st-demo-btns', el);
    if (!d || !box) return;
    box.innerHTML = d.loaded
      ? `<button class="btn btn-outline" id="st-demo-del">🗑️ Elimina i dati demo</button><span class="hint">Presenti: ${d.customers} clienti, ${d.repairs} riparazioni, ${d.sales} vendite.</span>`
      : '<button class="btn btn-primary" id="st-demo-load">Carica i dati demo</button>';
    if ($('#st-demo-load', box)) $('#st-demo-load', box).onclick = async () => {
      if (await safe(() => api('POST', '/api/demo', {}))) { toast('Dati demo caricati: esplora il gestionale'); drawDemo(); }
    };
    if ($('#st-demo-del', box)) $('#st-demo-del', box).onclick = async () => {
      if (!(await confirmDelete('tutti i dati demo', { detail: 'I dati veri non vengono toccati.' }))) return;
      if (await safe(() => api('DELETE', '/api/demo'))) { toast('Dati demo eliminati'); drawDemo(); }
    };
  };
  drawDemo();
  mountLedgerSettings($('#st-demo', el)); // Agente C: soglie del cattivo pagatore
  mountMaterialsSettings($('#st-legal', el)); // agente D: promemoria materiali da ordinare
  mountLabelSettings($('#st-labels', el)); // template delle etichette prodotto e logo
  // checklist per tipo: tre elenchi modificabili (una voce per riga)
  const ckBox = $('#ck-body', el);
  let ckAll = {};
  const drawCk = () => {
    const t = $('#ck-type', el).value;
    const c = ckAll[t];
    if (!c) return;
    const ta = (p, title) => `<div class="field"><label class="l" for="ck-${p}">${title}</label><textarea id="ck-${p}" rows="7" data-ph="${p}">${esc((c[p] || []).join('\n'))}</textarea></div>`;
    ckBox.innerHTML = `${ta('in', 'Controllo all’ingresso')}${ta('pre', 'Al ritiro in laboratorio')}${ta('out', 'Collaudo finale')}
      <div class="row tight"><button class="btn btn-outline" id="ck-save">Salva checklist</button>${c.custom ? '<button class="btn btn-ghost" id="ck-reset">Ripristina le voci predefinite</button>' : '<span class="hint">Voci predefinite in uso.</span>'}</div>`;
    $('#ck-save', ckBox).onclick = async () => {
      const body = {};
      $$('[data-ph]', ckBox).forEach((x) => { body[x.dataset.ph] = x.value.split('\n').map((l) => l.trim()).filter(Boolean); });
      const out = await safe(() => api('PUT', `/api/checklists/${t}`, body));
      if (out) { ckAll[t] = out; toast('Checklist salvata'); drawCk(); }
    };
    const rs = $('#ck-reset', ckBox);
    if (rs) rs.onclick = async () => {
      if (!(await confirmDelete(`le voci personalizzate di ${META.device_types[t].label}`, { verb: 'Ripristinare', detail: 'Tornano le voci predefinite. Le riparazioni già compilate non cambiano.' }))) return;
      const out = await safe(() => api('DELETE', `/api/checklists/${t}`));
      if (out) { ckAll[t] = out; toast('Voci predefinite ripristinate'); drawCk(); }
    };
  };
  $('#ck-type', el).onchange = drawCk;
  safe(() => api('GET', '/api/checklists')).then((r) => { ckAll = r || {}; drawCk(); });
  if ($('#st-r2', el)) $('#st-r2', el).onclick = async () => {
    const out = await safe(() => api('POST', '/api/backup/r2', {}));
    if (out?.ok) toast('Copia salvata nel cloud');
  };
  const saveSettings = async () => {
    const body = {};
    el.querySelectorAll('[data-k]').forEach((i) => { body[i.dataset.k] = i.value; });
    if (await safe(() => api('PUT', '/api/settings', body))) { await loadMeta(); toast('Impostazioni salvate'); }
  };
  $('#st-save', el).onclick = saveSettings;
  $('#st-save2', el).onclick = saveSettings;
}
