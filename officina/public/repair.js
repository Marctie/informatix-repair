// Accettazione veloce di una riparazione e scheda di dettaglio.
import { $, $$, esc, eur, fdate, fdt, api, toast, safe, debounce, openModal, META, statusBadge, progressBar, waLink, waMessage, today, addDays, trackUrl } from './util.js';

const DEVICE_TYPES = [['smartphone', '📱 Smartphone'], ['tablet', 'Tablet'], ['portatile', '💻 Portatile'], ['pc', '🖥️ PC fisso'], ['console', '🎮 Console'], ['altro', 'Altro']];
const PROBLEMS = ['Schermo rotto', 'Batteria', 'Non si accende', 'Non carica', 'Lento / software', 'Acqua / liquido', 'Audio / microfono', 'Fotocamera'];
const ACCESSORIES = ['Caricatore', 'Cover', 'SIM', 'Scheda SD', 'Borsa', 'Cavo'];
const CONDITIONS = ['Graffi', 'Display crepato', 'Ammaccature', 'Ottime condizioni'];

const toggleChips = (root, sel) => root.addEventListener('click', (e) => { const c = e.target.closest(`${sel} .chip`); if (c) c.classList.toggle('on'); });
const selected = (root, sel) => $$(`${sel} .chip.on`, root).map((c) => c.textContent.trim());

// ---------- Nuova riparazione ----------
export function openRepairForm(onDone, preset = {}) {
  const m = openModal(
    `<form id="rf" class="space-y-1" autocomplete="off">
      <div class="sec-t">Cliente</div>
      <div class="relative">
        <input id="rf-search" placeholder="Cerca cliente esistente (nome o telefono)…" />
        <div id="rf-sugg" class="hidden absolute z-10 left-0 right-0 mt-1 card shadow-lg max-h-56 overflow-y-auto"></div>
      </div>
      <div id="rf-picked" class="hidden"></div>
      <div id="rf-new" class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
        <div><label class="l">Nome e cognome *</label><input id="rf-name" value="${esc(preset.name || '')}" /></div>
        <div><label class="l">Telefono</label><input id="rf-phone" inputmode="tel" value="${esc(preset.phone || '')}" /></div>
        <div><label class="l">Email</label><input id="rf-email" type="email" /></div>
      </div>

      <div class="sec-t">Dispositivo</div>
      <div class="flex gap-2 flex-wrap mb-2" id="rf-types">${DEVICE_TYPES.map(([k, l], i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-v="${k}">${l}</span>`).join('')}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><label class="l">Marca e modello *</label><input id="rf-model" placeholder="es. iPhone 13, Samsung A54, HP 250 G8" /></div>
        <div><label class="l">Seriale / IMEI</label><input id="rf-serial" /></div>
      </div>

      <div class="sec-t">Problema segnalato *</div>
      <div class="flex gap-1.5 flex-wrap mb-2" id="rf-problems">${PROBLEMS.map((p) => `<span class="chip chip-red">${p}</span>`).join('')}</div>
      <textarea id="rf-problem" rows="2" placeholder="Cosa non funziona? (le scelte rapide si aggiungono qui)"></textarea>

      <div class="sec-t">Cosa lascia e in che stato</div>
      <div class="flex gap-1.5 flex-wrap mb-2" id="rf-acc">${ACCESSORIES.map((p) => `<span class="chip">${p}</span>`).join('')}</div>
      <div class="flex gap-1.5 flex-wrap mb-2" id="rf-cond">${CONDITIONS.map((p) => `<span class="chip">${p}</span>`).join('')}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input id="rf-accnote" placeholder="Altri accessori / note sullo stato (facoltativo)" />
        <input id="rf-pass" placeholder="PIN / schema di sblocco (facoltativo, solo uso interno)" />
      </div>

      <div class="sec-t">Preventivo e tempi</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div><label class="l">Preventivo €</label><input id="rf-quote" inputmode="decimal" placeholder="da definire" /></div>
        <div><label class="l">Acconto €</label><input id="rf-deposit" inputmode="decimal" placeholder="0" /></div>
        <div><label class="l">Pagato con</label><select id="rf-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div>
        <label class="flex items-center gap-2 text-sm font-semibold pb-2"><input type="checkbox" id="rf-agreed" class="!w-auto" /> Già concordato</label>
      </div>
      <div class="mt-2"><label class="l">Consegna stimata</label>
        <div class="flex gap-1.5 flex-wrap items-center" id="rf-eta">
          ${[['Oggi', 0], ['Domani', 1], ['+3 giorni', 3], ['+1 settimana', 7], ['+2 settimane', 14]].map(([l, n]) => `<span class="chip" data-d="${n}">${l}</span>`).join('')}
          <input type="date" id="rf-etadate" class="!w-auto" />
        </div>
      </div>
    </form>`,
    { title: 'Nuova riparazione', wide: true, footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary btn-lg" id="rf-save">Salva e crea scheda</button>` }
  );
  const root = m.el;
  let customerId = null;

  // scelte rapide
  $('#rf-types', root).onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; $$('#rf-types .chip', root).forEach((x) => x.classList.remove('on')); c.classList.add('on'); };
  toggleChips(root, '#rf-acc');
  toggleChips(root, '#rf-cond');
  $('#rf-problems', root).onclick = (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    c.classList.toggle('on');
    $('#rf-problem', root).value = selected(root, '#rf-problems').join(', ');
  };
  $('#rf-eta', root).onclick = (e) => {
    const c = e.target.closest('[data-d]'); if (!c) return;
    $('#rf-etadate', root).value = addDays(Number(c.dataset.d));
  };

  // ricerca cliente esistente
  const sugg = $('#rf-sugg', root);
  $('#rf-search', root).oninput = debounce(async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) return sugg.classList.add('hidden');
    const list = await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`));
    sugg.innerHTML = (list || []).map((c) => `<div class="px-3 py-2 hover:bg-lightbg cursor-pointer text-sm border-b border-line last:border-0" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone || '')}" data-email="${esc(c.email || '')}"><b>${esc(c.name)}</b> <span class="text-gray-500">${esc(c.phone || '')}</span>${c.repairs_count ? `<span class="text-xs text-gray-400"> · ${c.repairs_count} riparazioni</span>` : ''}</div>`).join('') || '<div class="px-3 py-2 text-sm text-gray-400">Nessun cliente: compila i campi sotto per crearne uno nuovo.</div>';
    sugg.classList.remove('hidden');
  }, 200);
  sugg.onclick = (e) => {
    const r = e.target.closest('[data-id]'); if (!r) return;
    customerId = Number(r.dataset.id);
    $('#rf-picked', root).innerHTML = `<div class="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-2 text-sm"><span>✔ <b>${esc(r.dataset.name)}</b> ${esc(r.dataset.phone)}</span><button type="button" class="btn btn-ghost btn-sm" id="rf-unpick">cambia</button></div>`;
    $('#rf-picked', root).classList.remove('hidden');
    $('#rf-new', root).classList.add('hidden');
    $('#rf-search', root).classList.add('hidden');
    sugg.classList.add('hidden');
    $('#rf-unpick', root).onclick = () => { customerId = null; $('#rf-picked', root).classList.add('hidden'); $('#rf-new', root).classList.remove('hidden'); $('#rf-search', root).classList.remove('hidden'); };
  };

  $('#rf-save', root).onclick = async (ev) => {
    const btn = ev.currentTarget;
    const accessories = [...selected(root, '#rf-acc')];
    const cond = [...selected(root, '#rf-cond')];
    const note = $('#rf-accnote', root).value.trim();
    const body = {
      customer: customerId ? { id: customerId } : { name: $('#rf-name', root).value, phone: $('#rf-phone', root).value, email: $('#rf-email', root).value },
      device_type: $('#rf-types .chip.on', root)?.dataset.v || 'smartphone',
      brand_model: $('#rf-model', root).value,
      serial: $('#rf-serial', root).value,
      problem: $('#rf-problem', root).value,
      accessories: accessories.join(', ') || (note ? '' : 'nessuno'),
      condition_notes: [...cond, note].filter(Boolean).join(', '),
      passcode: $('#rf-pass', root).value,
      quote: $('#rf-quote', root).value,
      quote_agreed: $('#rf-agreed', root).checked,
      deposit: $('#rf-deposit', root).value,
      deposit_method: $('#rf-method', root).value,
      eta_date: $('#rf-etadate', root).value,
    };
    btn.disabled = true;
    const r = await safe(() => api('POST', '/api/repairs', body));
    btn.disabled = false;
    if (!r) return;
    m.close();
    showCreated(r, onDone);
  };
  setTimeout(() => $('#rf-search', root).focus(), 50);
}

// Schermata finale dell'accettazione: QR da mostrare al cliente, stampe e WhatsApp.
function showCreated(r, onDone) {
  const wa = waLink(r.customer_phone, waMessage(r.quote != null ? 'quote' : 'generic', r));
  const m = openModal(
    `<div class="text-center">
      <p class="text-emerald-600 font-bold">✔ Riparazione registrata</p>
      <p class="font-heading font-extrabold text-3xl my-1">${esc(r.code)}</p>
      <p class="text-sm text-gray-500">${esc(r.brand_model)} · ${esc(r.customer_name)}</p>
      <img src="/api/qr?text=${encodeURIComponent(r.track_url)}" class="mx-auto my-3 w-52 h-52 border border-line rounded-xl p-2" alt="QR tracciamento" />
      <p class="text-sm font-semibold">Fai inquadrare il QR al cliente: segue la riparazione dal suo telefono.</p>
      <p class="text-xs text-gray-400 break-all mt-1">${esc(r.track_url)}</p>
      <div class="grid grid-cols-2 gap-2 mt-4">
        <a class="btn btn-primary" target="_blank" href="/print/repair/${r.id}">🖨️ Stampa scheda con QR</a>
        <a class="btn btn-outline" target="_blank" href="/print/label/${r.id}">🏷️ Etichetta dispositivo</a>
        ${wa ? `<a class="btn btn-green" target="_blank" rel="noopener" href="${wa}">💬 Invia link su WhatsApp</a>` : '<span></span>'}
        <button class="btn btn-outline" id="cp-link">📋 Copia link</button>
      </div>
      ${/localhost|127\.0\.0\.1/.test(r.track_url) ? '<p class="text-xs text-amber-600 mt-3">Il link usa “localhost”: il telefono del cliente non lo apre. Imposta l’indirizzo pubblico in Impostazioni.</p>' : ''}
    </div>`,
    { title: 'Scheda creata', footer: `<button class="btn btn-dark" data-close>Fatto</button>` }
  );
  $('#cp-link', m.el).onclick = async () => { await navigator.clipboard?.writeText(r.track_url); toast('Link copiato'); };
  m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) onDone?.(); });
}

// ---------- Dettaglio ----------
export async function openRepairDetail(id, onChange) {
  const m = openModal('<p class="text-gray-400 text-sm">Caricamento…</p>', { title: 'Riparazione', wide: true });
  const body = $('.modal-body', m.el);
  let changed = false;
  const reloadList = () => { changed = true; };
  m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === m.el) setTimeout(() => changed && onChange?.(), 0); });

  async function render() {
    const r = await safe(() => api('GET', `/api/repairs/${id}`));
    if (!r) return m.close();
    $('h2', m.el).textContent = `${r.code} · ${r.brand_model}`;
    const done = ['delivered', 'cancelled'].includes(r.status);
    const total = r.final_price ?? r.quote;
    const due = total == null ? null : Math.max(0, total - r.paid);
    const wa = (kind) => waLink(r.customer_phone, waMessage(kind, { ...r }));
    body.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mb-2">${statusBadge(r)}${r.late ? '<span class="badge bg-red-100 text-red-700">⏰ In ritardo</span>' : ''}${r.quote_decision === 'declined' ? '<span class="badge bg-red-100 text-red-700">Preventivo rifiutato dal cliente</span>' : ''}${r.quote_decision === 'accepted' ? '<span class="badge bg-emerald-100 text-emerald-700">Preventivo approvato</span>' : ''}</div>
      ${progressBar(r)}
      ${!done ? `<div class="flex gap-2 flex-wrap mt-3">
        ${r.next_status ? `<button class="btn btn-dark" data-act="advance">${esc(r.next_label)} →</button>` : ''}
        <select id="d-status" class="!w-auto"><option value="">Cambia stato…</option>${Object.entries(META.statuses).filter(([k]) => k !== 'delivered' && k !== r.status).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select>
        ${r.status === 'ready' || r.status === 'repairing' || r.status === 'approved' ? '<button class="btn btn-green" data-act="deliver">✔ Consegna e incassa</button>' : ''}
      </div>` : ''}

      <div class="grid sm:grid-cols-2 gap-x-6">
      <div>
        <div class="sec-t">Cliente</div>
        <p class="font-semibold">${esc(r.customer_name)}</p>
        <p class="text-sm text-gray-600">${esc(r.customer_phone || '—')} ${r.customer_email ? '· ' + esc(r.customer_email) : ''}</p>
        <div class="flex gap-2 mt-2 flex-wrap">
          ${wa('generic') ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${wa(r.status === 'ready' ? 'ready' : r.status === 'quote_pending' ? 'quote' : 'generic')}">💬 WhatsApp</a>` : ''}
          ${r.customer_phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(r.customer_phone)}">📞 Chiama</a>` : ''}
        </div>
        <div class="sec-t">Dispositivo</div>
        <p class="text-sm"><b>${esc(r.brand_model)}</b> <span class="text-gray-500">(${esc(r.device_type)})</span></p>
        <p class="text-sm text-gray-600">Seriale: ${esc(r.serial || '—')}</p>
        <p class="text-sm text-gray-600">Problema: ${esc(r.problem)}</p>
        <p class="text-sm text-gray-600">Accessori: ${esc(r.accessories || '—')} · Stato: ${esc(r.condition_notes || '—')}</p>
        ${r.passcode ? `<p class="text-sm text-gray-600">🔒 Sblocco: <span class="font-mono bg-lightbg px-1.5 rounded">${esc(r.passcode)}</span> <span class="text-xs text-gray-400">(solo interno)</span></p>` : ''}
        <div class="sec-t">Link e stampe</div>
        <div class="flex gap-2 flex-wrap">
          <a class="btn btn-outline btn-sm" target="_blank" href="/print/repair/${r.id}">🖨️ Scheda</a>
          <a class="btn btn-outline btn-sm" target="_blank" href="/print/label/${r.id}">🏷️ Etichetta</a>
          <a class="btn btn-outline btn-sm" target="_blank" href="/t/${r.token}">👁️ Vista cliente</a>
          <button class="btn btn-outline btn-sm" data-act="copylink">📋 Copia link</button>
        </div>
      </div>
      <div>
        <div class="sec-t">Preventivo e pagamenti</div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div><label class="l">Preventivo €</label><input id="d-quote" inputmode="decimal" value="${r.quote ?? ''}" ${done ? 'disabled' : ''} /></div>
          <div><label class="l">Consegna stimata</label><input id="d-eta" type="date" value="${r.eta_date || ''}" ${done ? 'disabled' : ''} /></div>
        </div>
        <p class="text-sm mt-2">Versato: <b>${eur(r.paid)}</b> · ${done ? 'Totale' : 'Da saldare'}: <b>${eur(done ? total : due)}</b></p>
        ${!done ? `<div class="flex gap-2 mt-2"><input id="d-dep" inputmode="decimal" placeholder="Nuovo acconto €" /><button class="btn btn-outline btn-sm" data-act="deposit">Registra acconto</button></div>
        <div class="flex gap-2 mt-2 flex-wrap"><button class="btn btn-dark btn-sm" data-act="savequote">Salva preventivo/data</button>${r.quote != null && r.status !== 'quote_pending' ? '<button class="btn btn-outline btn-sm" data-act="askquote">Chiedi approvazione</button>' : ''}</div>` : ''}
        ${r.delivered_at ? `<p class="text-sm text-gray-600 mt-2">Consegnata il ${fdt(r.delivered_at)} · garanzia fino al <b>${fdate(r.warranty_until)}</b></p>` : ''}

        <div class="sec-t">Ricambi usati</div>
        ${r.parts.map((p) => `<div class="flex justify-between items-center text-sm py-1 border-b border-line"><span>${esc(p.name)} ×${p.qty}</span><span>${eur(p.unit_price * p.qty)} ${!done ? `<button class="text-secondary ml-2" data-rmpart="${p.id}" title="Rimuovi">✕</button>` : ''}</span></div>`).join('') || '<p class="text-sm text-gray-400">Nessun ricambio registrato.</p>'}
        ${!done ? `<div class="relative mt-2"><input id="d-part" placeholder="Aggiungi ricambio dal magazzino (cerca)…" /><div id="d-part-s" class="hidden absolute z-10 left-0 right-0 mt-1 card shadow-lg max-h-48 overflow-y-auto"></div></div>` : ''}
      </div></div>

      <div class="sec-t">Messaggio visibile al cliente</div>
      <div class="flex gap-2"><input id="d-cnote" value="${esc(r.customer_note || '')}" placeholder="es. Stiamo aspettando il display, arriva giovedì" ${done ? 'disabled' : ''} />${!done ? '<button class="btn btn-outline btn-sm" data-act="savecnote">Salva</button>' : ''}</div>
      <div class="sec-t">Aggiungi nota alla cronologia</div>
      <div class="flex gap-2 items-center"><input id="d-note" placeholder="Nota…" /><label class="text-xs flex items-center gap-1 whitespace-nowrap"><input type="checkbox" id="d-notepub" class="!w-auto" checked /> visibile al cliente</label><button class="btn btn-outline btn-sm" data-act="note">Aggiungi</button></div>
      <div class="sec-t">Cronologia</div>
      <ul class="text-sm space-y-1.5">${r.events.map((e) => `<li class="flex gap-2"><span class="text-gray-400 w-24 shrink-0 text-xs pt-0.5">${fdt(e.created_at)}</span><span>${esc(e.note || '')} ${e.is_public ? '' : '<span class="badge bg-gray-100 text-gray-500">interna</span>'}</span></li>`).join('')}</ul>`;

    // ricerca ricambi
    const ps = $('#d-part', body);
    if (ps) ps.oninput = debounce(async (e) => {
      const q = e.target.value.trim();
      const box = $('#d-part-s', body);
      if (q.length < 2) return box.classList.add('hidden');
      const list = await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`));
      box.innerHTML = (list || []).map((p) => `<div class="px-3 py-2 hover:bg-lightbg cursor-pointer text-sm flex justify-between" data-pid="${p.id}"><span>${esc(p.name)}</span><span class="text-gray-500">${p.qty} pz · ${eur(p.price)}</span></div>`).join('') || '<div class="px-3 py-2 text-sm text-gray-400">Nessun prodotto: aggiungilo dal Magazzino.</div>';
      box.classList.remove('hidden');
    }, 200);
  }

  const act = async (fn, msg) => { const out = await safe(fn); if (out !== undefined) { reloadList(); if (msg) toast(msg); await render(); } };
  body.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-rmpart]');
    if (rm) return act(() => api('DELETE', `/api/repairs/${id}/parts/${rm.dataset.rmpart}`), 'Ricambio rimosso (magazzino ripristinato)');
    const pid = e.target.closest('[data-pid]');
    if (pid) return act(() => api('POST', `/api/repairs/${id}/parts`, { product_id: Number(pid.dataset.pid), qty: 1 }), 'Ricambio aggiunto (scalato dal magazzino)');
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'advance': return act(() => api('POST', `/api/repairs/${id}/advance`), 'Stato aggiornato');
      case 'deliver': return deliverDialog(id, () => { reloadList(); render(); });
      case 'savequote': return act(() => api('PATCH', `/api/repairs/${id}`, { quote: $('#d-quote', body).value, eta_date: $('#d-eta', body).value }), 'Salvato');
      case 'askquote': return act(() => api('POST', `/api/repairs/${id}/status`, { status: 'quote_pending' }), 'Il cliente può ora approvare dal link');
      case 'deposit': return act(() => api('POST', `/api/repairs/${id}/deposit`, { amount: $('#d-dep', body).value }), 'Acconto registrato');
      case 'savecnote': return act(() => api('PATCH', `/api/repairs/${id}`, { customer_note: $('#d-cnote', body).value }), 'Messaggio aggiornato');
      case 'note': { const t = $('#d-note', body).value; if (!t.trim()) return; return act(() => api('POST', `/api/repairs/${id}/note`, { note: t, public: $('#d-notepub', body).checked }), 'Nota aggiunta'); }
      case 'copylink': { await navigator.clipboard?.writeText(trackUrl((await api('GET', `/api/repairs/${id}`)).token)); return toast('Link copiato'); }
    }
  });
  body.addEventListener('change', (e) => {
    if (e.target.id === 'd-status' && e.target.value) act(() => api('POST', `/api/repairs/${id}/status`, { status: e.target.value }), 'Stato aggiornato');
  });
  await render();
}

function deliverDialog(id, done) {
  api('GET', `/api/repairs/${id}`).then((r) => {
    const total = r.final_price ?? r.quote ?? 0;
    const m = openModal(
      `<p class="text-sm mb-3">Importo totale della riparazione (già versato: <b>${eur(r.paid)}</b>).</p>
       <div class="grid grid-cols-2 gap-3"><div><label class="l">Totale finale €</label><input id="dl-final" inputmode="decimal" value="${total}" /></div>
       <div><label class="l">Incassato con</label><select id="dl-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div></div>
       <p class="text-xs text-gray-500 mt-3">Garanzia: ${r.warranty_days} giorni dalla consegna.</p>`,
      { title: 'Consegna e incasso', footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-green btn-lg" id="dl-ok">Conferma consegna</button>` }
    );
    $('#dl-ok', m.el).onclick = async () => {
      const out = await safe(() => api('POST', `/api/repairs/${id}/deliver`, { final_price: $('#dl-final', m.el).value, method: $('#dl-method', m.el).value }));
      if (!out) return;
      m.close();
      toast(`Consegnata. Incassati ${eur(out.collected)}`);
      done();
    };
  });
}
