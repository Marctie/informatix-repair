// Accettazione veloce di una riparazione e scheda di dettaglio.
import { scanWithCamera } from './scan.js';
import { isScanEnter, imeiCheck, $, $$, esc, eur, fdate, fdt, api, toast, safe, debounce, openModal, confirmDelete, META, statusBadge, progressBar, waLink, waMessage, today, addDays, trackUrl } from './util.js';

import { checklistGrid, checklistLegend, checklistSections, bindChecklist, bindChecklistGrids, checklistClick, readChecklist, hasAny, toItems } from './checklist.js';

// Tipi di dispositivo, etichette e suggerimenti arrivano dal server (/api/meta): cambiano con il tipo scelto.
const FALLBACK_TYPES = { smartphone: { label: 'Smartphone', serial: 'IMEI / seriale', passcode: 'PIN / schema di sblocco', accessories: ['Caricatore', 'Cover', 'SIM', 'Scheda SD', 'Cavo'] }, altro: { label: 'Altro', serial: 'Numero di serie', passcode: 'Codice di sblocco', accessories: ['Caricatore', 'Cavo'] } };
const typesMeta = () => (META.device_types && Object.keys(META.device_types).length ? META.device_types : FALLBACK_TYPES);
const typeInfo = (t) => typesMeta()[t] || typesMeta().altro || FALLBACK_TYPES.altro;
let CHECKLISTS = {}; // elenchi di controllo per tipo (si ricaricano a ogni apertura)
const loadChecklists = async () => { CHECKLISTS = (await safe(() => api('GET', '/api/checklists'))) || CHECKLISTS; return CHECKLISTS; };
const PROBLEMS = ['Schermo rotto', 'Batteria', 'Non si accende', 'Non carica', 'Lento / software', 'Acqua / liquido', 'Audio / microfono', 'Fotocamera'];
const CONDITIONS = ['Graffi', 'Display crepato', 'Ammaccature', 'Ottime condizioni'];

const toggleChips = (root, sel) => root.addEventListener('click', (e) => { const c = e.target.closest(`${sel} .chip`); if (c) c.classList.toggle('on'); });
const selected = (root, sel) => $$(`${sel} .chip.on`, root).map((c) => c.textContent.trim());

// ---------- Nuova riparazione ----------
export function openRepairForm(onDone, preset = {}) {
  const m = openModal(
    `<form id="rf" autocomplete="off">
      <section class="sec">
        <h3 class="sec-t">Cliente</h3>
        <div class="relative">
          <input id="rf-search" placeholder="Cerca un cliente già registrato…" />
          <div id="rf-sugg" class="suggest card hidden"></div>
        </div>
        <div id="rf-picked" class="hidden"></div>
        <div id="rf-new" class="fgrid c3">
          <div class="field"><label class="l" for="rf-name">Nome e cognome *</label><input id="rf-name" value="${esc(preset.name || '')}" /></div>
          <div class="field"><label class="l" for="rf-phone">Telefono</label><input id="rf-phone" inputmode="tel" value="${esc(preset.phone || '')}" /></div>
          <div class="field"><label class="l" for="rf-email">Email</label><input id="rf-email" type="email" /></div>
        </div>
      </section>

      <section class="sec">
        <h3 class="sec-t">Dispositivo</h3>
        <div class="field"><label class="l">Tipo di dispositivo</label><div class="row tight" id="rf-types">${Object.entries(typesMeta()).map(([k, v], i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-v="${k}">${esc(v.label)}</span>`).join('')}</div></div>
        <div class="fgrid c2">
          <div class="field"><label class="l" for="rf-model">Marca e modello *</label><input id="rf-model" placeholder="es. iPhone 13, Samsung A54, HP 250 G8" /></div>
          <div class="field"><label class="l" for="rf-serial">${esc(typeInfo(Object.keys(typesMeta())[0]).serial)}</label>
            <div class="row nowrap"><input id="rf-serial" autocomplete="off" placeholder="Spara col lettore o scrivi" value="${esc(preset.serial || '')}" /><button type="button" class="btn btn-outline btn-icon" id="rf-cam" aria-label="Scansiona con la fotocamera" title="Scansiona con la fotocamera">📷</button></div>
            <div id="rf-serial-hint" class="hint"></div></div>
        </div>
      </section>

      <section class="sec">
        <h3 class="sec-t">Problema segnalato *</h3>
        <div class="row tight" id="rf-problems">${PROBLEMS.map((p) => `<span class="chip chip-red">${p}</span>`).join('')}</div>
        <textarea id="rf-problem" rows="2" placeholder="Cosa non funziona? Le scelte rapide si aggiungono qui, puoi scrivere altro."></textarea>
      </section>

      <section class="sec">
        <h3 class="sec-t">Cosa lascia e in che stato</h3>
        <div class="field"><label class="l">Accessori lasciati</label><div class="row tight" id="rf-acc">${typeInfo(Object.keys(typesMeta())[0]).accessories.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>
        <div class="field"><label class="l">Stato estetico</label><div class="row tight" id="rf-cond">${CONDITIONS.map((p) => `<span class="chip">${p}</span>`).join('')}</div></div>
        <div class="fgrid c2">
          <div class="field"><label class="l" for="rf-accnote">Altri accessori o note sullo stato</label><input id="rf-accnote" placeholder="Facoltativo" /></div>
          <div class="field"><label class="l" for="rf-pass">${esc(typeInfo(Object.keys(typesMeta())[0]).passcode)}</label><input id="rf-pass" placeholder="Facoltativo" /><span class="hint">Solo uso interno: il cliente non lo vede mai.</span></div>
        </div>
      </section>

      <section class="sec">
        <h3 class="sec-t">Controllo all’ingresso</h3>
        <p class="sec-sub">Facoltativo: cosa funziona e cosa no quando il dispositivo arriva. Le voci cambiano con il tipo di dispositivo; resta salvato nella riparazione.</p>
        <div id="rf-ck"></div>
        ${checklistLegend()}
      </section>

      <section class="sec">
        <h3 class="sec-t">Preventivo e tempi</h3>
        <div class="fgrid c4 m2">
          <div class="field"><label class="l" for="rf-quote">Preventivo €</label><input id="rf-quote" inputmode="decimal" placeholder="da definire" /></div>
          <div class="field"><label class="l" for="rf-deposit">Acconto €</label><input id="rf-deposit" inputmode="decimal" placeholder="0" /></div>
          <div class="field"><label class="l" for="rf-method">Pagato con</label><select id="rf-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div>
          <div class="field"><label class="l">&nbsp;</label><label class="check box"><input type="checkbox" id="rf-agreed" /> Già concordato</label></div>
        </div>
        <div class="field">
          <label class="l">Consegna stimata</label>
          <div class="row tight">
            <div class="row tight" id="rf-eta">${[['Oggi', 0], ['Domani', 1], ['+3 giorni', 3], ['+1 settimana', 7], ['+2 settimane', 14]].map(([l, n]) => `<span class="chip" data-d="${n}">${l}</span>`).join('')}</div>
            <input type="date" id="rf-etadate" style="width:auto" aria-label="Data di consegna stimata" />
          </div>
        </div>
        <label class="check box" style="align-self:flex-start"><input type="checkbox" id="rf-urgent" /> 🔥 Urgente</label>
      </section>
    </form>`,
    { title: 'Nuova riparazione', wide: true, footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-outline btn-lg" id="rf-save">Salva</button><button class="btn btn-primary btn-lg" id="rf-save-print">🖨️ Salva e stampa</button>` }
  );
  const root = m.el;
  let customerId = null;

  // scelte rapide
  // il tipo di dispositivo cambia etichette (seriale/IMEI, PIN/password), accessori suggeriti e controlli d'ingresso
  const curType = () => $('#rf-types .chip.on', root)?.dataset.v || 'smartphone';
  const drawChecklist = () => {
    const t = curType();
    $('#rf-ck', root).innerHTML = checklistGrid(toItems((CHECKLISTS[t] || CHECKLISTS.altro || {}).in));
    const g = $('#rf-ck .ckgrid', root);
    if (g) bindChecklist(g);
  };
  const applyType = () => {
    const info = typeInfo(curType());
    $('label[for="rf-serial"]', root).textContent = info.serial;
    $('label[for="rf-pass"]', root).textContent = info.passcode;
    const on = new Set(selected(root, '#rf-acc'));
    $('#rf-acc', root).innerHTML = info.accessories.map((p) => `<span class="chip ${on.has(p) ? 'on' : ''}">${esc(p)}</span>`).join('');
    drawChecklist();
  };
  $('#rf-types', root).onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; $$('#rf-types .chip', root).forEach((x) => x.classList.remove('on')); c.classList.add('on'); applyType(); };
  loadChecklists().then(() => { if (root.isConnected) drawChecklist(); });
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

  // seriale / IMEI: lettore di codici a barre (tastiera veloce + Invio), fotocamera, controlli
  const serial = $('#rf-serial', root);
  const hint = $('#rf-serial-hint', root);
  serial.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#rf-problem', root).focus(); } });
  const checkSerial = debounce(async () => {
    const v = serial.value.trim();
    hint.innerHTML = '';
    if (v.length < 5) return;
    const parts = [];
    const ok = imeiCheck(v);
    if (ok === true) parts.push('<span class="text-emerald-600">✔ IMEI valido</span>');
    if (ok === false) parts.push('<span class="text-amber-600">⚠ IMEI non valido: controlla la lettura</span>');
    const list = await safe(() => api('GET', `/api/repairs?q=${encodeURIComponent(v)}`));
    if (!root.isConnected) return;
    const same = (list || []).filter((r) => r.serial && r.serial.toLowerCase() === v.toLowerCase());
    if (same.length) parts.push(`<button type="button" class="underline text-secondary text-left" data-prev="${same[0].id}">⚠ Già in archivio: ${esc(same[0].code)} · ${esc(same[0].customer_name)} (${esc(same[0].status_label)}): apri</button>`);
    hint.innerHTML = parts.join(' · ');
  }, 250);
  serial.addEventListener('input', checkSerial);
  if (serial.value) checkSerial();
  hint.addEventListener('click', (e) => { const b = e.target.closest('[data-prev]'); if (b) openRepairDetail(Number(b.dataset.prev)); });
  $('#rf-cam', root).onclick = async () => {
    const v = await scanWithCamera();
    if (v) { serial.value = v; serial.dispatchEvent(new Event('input')); toast(`Letto: ${v}`); }
  };

  // Se la pistola spara mentre è selezionata un'altra casella (di solito la ricerca cliente, che si apre già attiva),
  // il codice letto viene spostato nel seriale: niente da ricopiare.
  root.addEventListener('keydown', (e) => {
    if (!isScanEnter(e) || e.target === serial || !e.target.matches('input')) return;
    e.preventDefault();
    const code = e.target.value.trim();
    if (!code) return;
    e.target.value = '';
    sugg.classList.add('hidden');
    serial.value = code;
    serial.dispatchEvent(new Event('input'));
    toast(`Letto: ${code}`);
    $('#rf-problem', root).focus();
  }, true);

  // ricerca cliente esistente
  const sugg = $('#rf-sugg', root);
  $('#rf-search', root).oninput = debounce(async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) return sugg.classList.add('hidden');
    const list = await safe(() => api('GET', `/api/customers?q=${encodeURIComponent(q)}`));
    sugg.innerHTML = (list || []).map((c) => `<div data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone || '')}" data-email="${esc(c.email || '')}"><b>${esc(c.name)}</b> <span class="text-gray-500">${esc(c.phone || '')}</span>${c.repairs_count ? `<span class="text-xs text-gray-400"> · ${c.repairs_count} riparazioni</span>` : ''}</div>`).join('') || '<div style="color:#9CA3AF;cursor:default">Nessun cliente trovato: compila i campi sotto per crearne uno nuovo.</div>';
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

  const doSave = async (btn, print) => {
    // la scheda di stampa va aperta SUBITO (durante il click), altrimenti il browser blocca la finestra
    const pw = print ? window.open('about:blank', '_blank') : null;
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
      urgent: $('#rf-urgent', root).checked,
    };
    btn.disabled = true;
    const entry = $('#rf-ck .ckgrid', root) ? readChecklist($('#rf-ck .ckgrid', root)) : [];
    const r = await safe(() => api('POST', '/api/repairs', body));
    btn.disabled = false;
    if (!r) { pw?.close(); return; }
    // controllo d'ingresso compilato al banco: si salva subito nella riparazione appena creata
    if (hasAny(entry)) await safe(() => api('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'in', items: entry }));
    m.close();
    if (print) {
      if (pw) pw.location.href = `/print/both/${r.id}`;
      else toast('Il browser ha bloccato la stampa: usa il pulsante nella schermata successiva', false);
    }
    showCreated(r, onDone);
  };
  $('#rf-save', root).onclick = (ev) => doSave(ev.currentTarget, false);
  $('#rf-save-print', root).onclick = (ev) => doSave(ev.currentTarget, true);
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
        <a class="btn btn-primary btn-lg col-span-2" target="_blank" href="/print/both/${r.id}">🖨️ Stampa scheda cliente + laboratorio</a>
        <a class="btn btn-outline btn-wrap" target="_blank" href="/print/customer/${r.id}">👤 Solo scheda cliente</a>
        <a class="btn btn-outline btn-wrap" target="_blank" href="/print/lab/${r.id}">🔧 Solo scheda laboratorio</a>
        <a class="btn btn-outline btn-wrap" target="_blank" href="/print/label/${r.id}">🏷️ Etichetta dispositivo</a>
        <button class="btn btn-outline" id="cp-link">📋 Copia link</button>
        ${wa ? `<a class="btn btn-green col-span-2" target="_blank" rel="noopener" href="${wa}">💬 Invia link su WhatsApp</a>` : ''}
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
    const [r] = await Promise.all([safe(() => api('GET', `/api/repairs/${id}`)), loadChecklists()]);
    if (!r) return m.close();
    $('h2', m.el).textContent = `${r.code} · ${r.brand_model}`;
    const done = ['delivered', 'cancelled'].includes(r.status);
    const total = r.final_price ?? r.quote;
    const due = total == null ? null : Math.max(0, total - r.paid);
    const wa = (kind) => waLink(r.customer_phone, waMessage(kind, { ...r }));
    const waKind = r.status === 'ready' ? 'ready' : r.status === 'quote_pending' ? 'quote' : 'generic';
    const waHref = wa(waKind);
    const statusOptions = Object.entries(META.statuses).filter(([k]) => k !== 'delivered' && k !== r.status).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
    body.innerHTML = `
      <div class="sticky-head">
        <div class="badges">
          ${statusBadge(r).replace('class="badge ', 'class="badge badge-lg ')}
          ${done ? '' : `<button class="chip chip-red ${r.urgent ? 'on' : ''}" data-act="urgent">🔥 Urgente</button>`}
          ${r.late ? '<span class="badge bg-red-100 text-red-700">⏰ In ritardo</span>' : ''}
          ${r.quote_decision === 'declined' ? '<span class="badge bg-red-100 text-red-700">Preventivo rifiutato dal cliente</span>' : ''}
        </div>
        ${progressBar(r)}
        ${!done ? `<div class="row">
          ${r.next_status ? `<button class="btn btn-dark" data-act="advance">${esc(r.next_label)} →</button>` : ''}
          <select id="d-status" style="width:auto;min-width:11rem" aria-label="Cambia stato"><option value="">Cambia stato…</option>${statusOptions}</select>
          ${['ready', 'repairing', 'approved'].includes(r.status) ? '<button class="btn btn-green" data-act="deliver">✔ Consegna e incassa</button>' : ''}
        </div>` : ''}
      </div>

      <div class="cols">
        <div class="col">
          <section class="sec">
            <h3 class="sec-t">Cliente</h3>
            <div><b style="font-size:1.05rem">${esc(r.customer_name)}</b></div>
            <dl class="kv"><dt>Telefono</dt><dd>${esc(r.customer_phone || '—')}</dd>${r.customer_email ? `<dt>Email</dt><dd>${esc(r.customer_email)}</dd>` : ''}</dl>
            <div class="row tight">
              ${waHref ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${waHref}">💬 WhatsApp</a>` : ''}
              ${r.customer_phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(r.customer_phone)}">📞 Chiama</a>` : ''}
            </div>
          </section>

          <section class="sec">
            <h3 class="sec-t">Dispositivo</h3>
            <dl class="kv">
              <dt>Dispositivo</dt><dd><b>${esc(r.brand_model)}</b> <span class="hint">(${esc(typeInfo(r.device_type).label)})</span></dd>
              <dt>${esc(typeInfo(r.device_type).serial)}</dt><dd>${esc(r.serial || '—')}</dd>
              <dt>Problema</dt><dd>${esc(r.problem)}</dd>
              <dt>Accessori</dt><dd>${esc(r.accessories || '—')}</dd>
              <dt>Stato estetico</dt><dd>${esc(r.condition_notes || '—')}</dd>
              ${r.passcode ? `<dt>🔒 Sblocco</dt><dd><span class="font-mono" style="background:var(--bg);padding:.1rem .5rem;border-radius:.4rem">${esc(r.passcode)}</span> <span class="hint">solo interno</span></dd>` : ''}
            </dl>
          </section>

          <section class="sec">
            <h3 class="sec-t">Stampe e link</h3>
            <div class="row tight">
              <a class="btn btn-dark btn-sm" target="_blank" href="/print/both/${r.id}">🖨️ Stampa tutto</a>
              <a class="btn btn-outline btn-sm" target="_blank" href="/print/customer/${r.id}">👤 Scheda cliente</a>
              <a class="btn btn-outline btn-sm" target="_blank" href="/print/lab/${r.id}">🔧 Scheda laboratorio</a>
              <a class="btn btn-outline btn-sm" target="_blank" href="/print/label/${r.id}">🏷️ Etichetta</a>
            </div>
            <div class="row tight">
              <a class="btn btn-outline btn-sm" target="_blank" href="/t/${r.token}">👁️ Vista cliente</a>
              <button class="btn btn-outline btn-sm" data-act="copylink">📋 Copia link</button>
              <button class="btn btn-outline btn-sm" data-act="edit">✏️ Modifica</button>
            </div>
          </section>
        </div>

        <div class="col">
          <section class="sec">
            <h3 class="sec-t">Preventivo e pagamenti</h3>
            <div class="fgrid c2 m2">
              <div class="field"><label class="l" for="d-quote">Preventivo €</label><input id="d-quote" inputmode="decimal" value="${r.quote ?? ''}" ${done ? 'disabled' : ''} /></div>
              <div class="field"><label class="l" for="d-eta">Consegna stimata</label><input id="d-eta" type="date" value="${r.eta_date || ''}" ${done ? 'disabled' : ''} /></div>
            </div>
            <div class="total-box">
              <span>Versato <b>${eur(r.paid)}</b></span>
              <span>${done ? 'Totale' : 'Da saldare'} <b style="font-size:1.1rem">${eur(done ? total : due)}</b></span>
            </div>
            ${!done ? `
              <div class="row" style="flex-wrap:nowrap"><input id="d-dep" inputmode="decimal" placeholder="Nuovo acconto €" aria-label="Nuovo acconto" /><button class="btn btn-outline" data-act="deposit">Registra acconto</button></div>
              <div class="row tight"><button class="btn btn-dark btn-sm" data-act="savequote">Salva preventivo e data</button>${r.quote != null && r.status !== 'quote_pending' ? '<button class="btn btn-outline btn-sm" data-act="askquote">Chiedi approvazione</button>' : ''}</div>` : ''}
            ${r.delivered_at ? `<p class="hint">Consegnata il ${fdt(r.delivered_at)} · garanzia fino al <b>${fdate(r.warranty_until)}</b></p>` : ''}
          </section>

          <section class="sec">
            <h3 class="sec-t">Ricambi usati</h3>
            <div class="plist">
              ${r.parts.map((p) => `<div><span>${esc(p.name)} <span class="hint">×${p.qty}${p.product_id ? '' : ` · a mano, costo ${eur(p.unit_cost * p.qty)}`}</span></span><span>${eur(p.unit_price * p.qty)} ${!done ? `<button class="xbtn" data-rmpart="${p.id}" title="Rimuovi" aria-label="Rimuovi ${esc(p.name)}">✕</button>` : ''}</span></div>`).join('') || '<p class="hint" style="padding:.3rem 0">Nessun ricambio registrato.</p>'}
            </div>
            ${!done ? `<div class="relative"><input id="d-part" placeholder="Cerca un ricambio da aggiungere…" autocomplete="off" /><div id="d-part-s" class="suggest card hidden"></div></div>
            <div class="row tight"><button class="btn btn-outline btn-sm" data-act="manualpart">＋ Ricambio non a magazzino</button></div>` : ''}
            <div class="total-box"><span>Costo ricambi <b>${eur(r.parts_cost)}</b></span><span>Guadagno stimato <b>${r.profit_estimate == null ? '—' : eur(r.profit_estimate)}</b></span></div>
          </section>
        </div>
      </div>

      <section class="sec">
        <h3 class="sec-t">Note del tecnico</h3>
        <p class="sec-sub">Interne: finiscono sulla scheda laboratorio, il cliente non le vede.</p>
        <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><textarea id="d-tech" rows="2" placeholder="Diagnosi, prove fatte, cosa manca…">${esc(r.tech_notes || '')}</textarea><button class="btn btn-outline" data-act="savetech">Salva</button></div>
      </section>

      ${checklistSections(r, CHECKLISTS, r.status === 'delivered' || r.status === 'cancelled')}

      <section class="sec">
        <h3 class="sec-t">Messaggio visibile al cliente</h3>
        <p class="sec-sub">Compare in evidenza sulla pagina che il cliente apre dal QR.</p>
        <div class="row" style="flex-wrap:nowrap"><input id="d-cnote" value="${esc(r.customer_note || '')}" placeholder="es. Stiamo aspettando il display, arriva giovedì" ${done ? 'disabled' : ''} />${!done ? '<button class="btn btn-outline" data-act="savecnote">Salva</button>' : ''}</div>
      </section>

      <section class="sec">
        <h3 class="sec-t">Aggiungi una nota alla cronologia</h3>
        <div class="row">
          <input id="d-note" class="grow" placeholder="Scrivi una nota…" aria-label="Nota" />
          <label class="check"><input type="checkbox" id="d-notepub" checked /> Visibile al cliente</label>
          <button class="btn btn-outline" data-act="note">Aggiungi</button>
        </div>
      </section>

      <section class="sec">
        <h3 class="sec-t">Cronologia</h3>
        <ul class="tl">${r.events.map((e) => `<li><time>${fdt(e.created_at)}</time><span>${esc(e.note || '')} ${e.is_public ? '' : '<span class="badge bg-gray-100 text-gray-500">interna</span>'}</span></li>`).join('')}</ul>
      </section>`;

    bindChecklistGrids(body);
    // ricerca ricambi
    const ps = $('#d-part', body);
    if (ps) ps.oninput = debounce(async (e) => {
      const q = e.target.value.trim();
      const box = $('#d-part-s', body);
      if (!box) return;
      if (q.length < 2) return box.classList.add('hidden');
      const list = await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`));
      if (!box.isConnected) return; // finestra chiusa nel frattempo
      box.innerHTML = (list || []).map((p) => `<div data-pid="${p.id}" style="display:flex;justify-content:space-between;gap:.75rem"><span>${esc(p.name)}</span><span class="hint">${p.qty} pz · ${eur(p.price)}</span></div>`).join('') || '<div style="color:#9CA3AF;cursor:default">Nessun prodotto: aggiungilo dal Magazzino.</div>';
      box.classList.remove('hidden');
    }, 200);
  }

  const act = async (fn, msg) => { const out = await safe(fn); if (out !== undefined) { reloadList(); await render(); if (msg) toast(msg); } };
  body.addEventListener('click', async (e) => {
    if (await checklistClick(e, body, id, () => { reloadList(); render(); })) return;
    const rm = e.target.closest('[data-rmpart]');
    if (rm) { if (!(await confirmDelete('questo ricambio', { verb: 'Rimuovere', detail: 'Il magazzino viene ripristinato.' }))) return; return act(() => api('DELETE', `/api/repairs/${id}/parts/${rm.dataset.rmpart}`), 'Ricambio rimosso (magazzino ripristinato)'); }
    const pid = e.target.closest('[data-pid]');
    if (pid) return act(() => api('POST', `/api/repairs/${id}/parts`, { product_id: Number(pid.dataset.pid), qty: 1 }), 'Ricambio aggiunto (scalato dal magazzino)');
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'manualpart': return manualPartDialog(id, () => { reloadList(); render(); });
      case 'advance': return act(() => api('POST', `/api/repairs/${id}/advance`), 'Stato aggiornato');
      case 'deliver': return deliverDialog(id, () => { reloadList(); render(); });
      case 'savequote': return act(() => api('PATCH', `/api/repairs/${id}`, { quote: $('#d-quote', body).value, eta_date: $('#d-eta', body).value }), 'Salvato');
      case 'askquote': return act(() => api('POST', `/api/repairs/${id}/status`, { status: 'quote_pending' }), 'Il cliente può ora approvare dal link');
      case 'deposit': return act(() => api('POST', `/api/repairs/${id}/deposit`, { amount: $('#d-dep', body).value }), 'Acconto registrato');
      case 'savetech': return act(() => api('PATCH', `/api/repairs/${id}`, { tech_notes: $('#d-tech', body).value }), 'Note del tecnico salvate');
      case 'urgent': return act(() => api('PATCH', `/api/repairs/${id}`, { urgent: !b.classList.contains('on') }), 'Priorità aggiornata');
      case 'savecnote': return act(() => api('PATCH', `/api/repairs/${id}`, { customer_note: $('#d-cnote', body).value }), 'Messaggio aggiornato');
      case 'note': { const t = $('#d-note', body).value; if (!t.trim()) return; return act(() => api('POST', `/api/repairs/${id}/note`, { note: t, public: $('#d-notepub', body).checked }), 'Nota aggiunta'); }
      case 'edit': return editDialog(id, () => { reloadList(); render(); });
      case 'copylink': { await navigator.clipboard?.writeText(trackUrl((await api('GET', `/api/repairs/${id}`)).token)); return toast('Link copiato'); }
    }
  });
  body.addEventListener('change', (e) => {
    if (e.target.id === 'd-status' && e.target.value) act(() => api('POST', `/api/repairs/${id}/status`, { status: e.target.value }), 'Stato aggiornato');
  });
  await render();
}

export function deliverDialog(id, done) {
  api('GET', `/api/repairs/${id}`).then((r) => {
    const total = r.final_price ?? r.quote ?? 0;
    const m = openModal(
      `<section class="sec">
        <p>Già versato: <b>${eur(r.paid)}</b>. Controlla il totale finale e scegli come ha pagato il saldo.</p>
        <div class="fgrid c2">
          <div class="field"><label class="l" for="dl-final">Totale finale €</label><input id="dl-final" inputmode="decimal" value="${total}" /></div>
          <div class="field"><label class="l" for="dl-method">Incassato con</label><select id="dl-method"><option>contanti</option><option>carta</option><option>bonifico</option></select></div>
        </div>
        <p class="hint">Garanzia: ${r.warranty_days} giorni dalla consegna.</p>
      </section>`,
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

// Modifica dei dati di ingresso (cliente, dispositivo, problema, accessori, sblocco, garanzia).
async function editDialog(id, done) {
  const r = await safe(() => api('GET', `/api/repairs/${id}`));
  if (!r) return;
  const f = (k, label, val, extra = '') => `<div class="field"><label class="l">${label}</label><input data-k="${k}" value="${esc(val ?? '')}" ${extra} /></div>`;
  const m = openModal(
    `<section class="sec">
      <h3 class="sec-t">Cliente</h3>
      <div class="fgrid c3">${f('c_name', 'Nome', r.customer_name)}${f('c_phone', 'Telefono', r.customer_phone, 'inputmode="tel"')}${f('c_email', 'Email', r.customer_email)}</div>
    </section>
    <section class="sec">
      <h3 class="sec-t">Dispositivo</h3>
      <div class="fgrid c2">${f('brand_model', 'Marca e modello', r.brand_model)}${f('serial', typeInfo(r.device_type).serial, r.serial)}
        ${f('accessories', 'Accessori lasciati', r.accessories)}${f('condition_notes', 'Stato del dispositivo', r.condition_notes)}
        <div class="field"><label class="l">Tipo di dispositivo</label><select data-k="device_type">${Object.entries(typesMeta()).map(([k, v]) => `<option value="${k}" ${k === r.device_type ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
        ${f('passcode', `${typeInfo(r.device_type).passcode} (solo interno)`, r.passcode)}${f('warranty_days', 'Giorni di garanzia', r.warranty_days, 'inputmode="numeric"')}</div>
    </section>
    <section class="sec">
      <h3 class="sec-t">Problema segnalato</h3>
      <textarea data-k="problem" rows="3" aria-label="Problema segnalato">${esc(r.problem)}</textarea>
    </section>`,
    { title: `Modifica ${r.code}`, wide: true, footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ed-ok">Salva modifiche</button>` }
  );
  $('#ed-ok', m.el).onclick = async () => {
    const v = (k) => $(`[data-k="${k}"]`, m.el).value;
    const out = await safe(() => api('PATCH', `/api/repairs/${id}`, {
      brand_model: v('brand_model'), device_type: v('device_type'), serial: v('serial'), accessories: v('accessories'), condition_notes: v('condition_notes'),
      passcode: v('passcode'), warranty_days: v('warranty_days'), problem: v('problem'),
      customer: { name: v('c_name'), phone: v('c_phone'), email: v('c_email') },
    }));
    if (out) { m.close(); toast('Dati aggiornati'); done(); }
  };
}

/** Ricambio non caricato a magazzino: descrizione, quantità, costo d'acquisto e prezzo al cliente (non tocca le giacenze). */
function manualPartDialog(repairId, done) {
  const m = openModal(`<div class="fgrid c2">
      <div class="field" style="grid-column:1/-1"><label class="l" for="mp-name">Descrizione</label><input id="mp-name" placeholder="es. Display iPhone 12" /></div>
      <div class="field"><label class="l" for="mp-qty">Quantità</label><input id="mp-qty" inputmode="numeric" value="1" /></div>
      <div class="field"><label class="l" for="mp-code">Codice fornitore</label><input id="mp-code" /></div>
      <div class="field"><label class="l" for="mp-cost">Prezzo d’acquisto € (cad.)</label><input id="mp-cost" inputmode="decimal" /></div>
      <div class="field"><label class="l" for="mp-price">Prezzo al cliente € (cad.)</label><input id="mp-price" inputmode="decimal" placeholder="0 = incluso nel preventivo" /></div>
      <div class="field"><label class="l" for="mp-sup">Fornitore</label><input id="mp-sup" /></div>
      <div class="field"><label class="l" for="mp-date">Data d’acquisto</label><input id="mp-date" type="date" value="${today()}" /></div>
    </div><p class="hint">Non scala nessuna giacenza. Il costo entra nel guadagno della riparazione.</p>`,
    { title: 'Ricambio non a magazzino', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="mp-ok">Aggiungi</button>' });
  $('#mp-ok', m.el).onclick = async () => {
    const v = (id) => $(`#${id}`, m.el).value;
    const out = await safe(() => api('POST', `/api/repairs/${repairId}/parts`, {
      name: v('mp-name'), qty: v('mp-qty'), unit_cost: v('mp-cost').replace(',', '.'), unit_price: v('mp-price').replace(',', '.') || 0,
      supplier_code: v('mp-code'), supplier_name: v('mp-sup'), bought_at: v('mp-date'),
    }));
    if (out) { m.close(); toast('Ricambio aggiunto'); done(); }
  };
  $('#mp-name', m.el).focus();
}
