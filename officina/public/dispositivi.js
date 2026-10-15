// Dispositivi: registro con seriale/IMEI, sottoclassi, storico e segnalazione "rubato / da verificare".
import { $, $$, esc, eur, fdate, fdt, api, toast, safe, debounce, openModal, confirmDelete, imeiCheck, isScanEnter, today } from './util.js';
import { scanWithCamera } from './scan.js';
import { openRepairDetail } from './repair.js';
import { prestitiPanel } from './prestiti.js';

let META = null;
const FLAG_BADGE = { ok: 'bg-emerald-100 text-emerald-700', stolen: 'bg-red-100 text-red-700', check: 'bg-amber-100 text-amber-800' };
const flagBadge = (d) => (d.flag === 'ok' ? '' : `<span class="badge ${FLAG_BADGE[d.flag]}">⚠ ${esc(META.flags[d.flag])}</span>`);

// Due schede: Registro (seriali/IMEI) e Prestiti (muletti dati ai clienti: officina/public/prestiti.js)
export async function dispositiviView(el, params) {
  const tab = params?.get('tab') === 'prestiti' ? 'prestiti' : 'registro';
  const loans = await safe(() => api('GET', '/api/prestiti?stato=fuori'));
  el.innerHTML = `<div class="row tight chips-scroll" id="dv-tabs"><span class="chip ${tab === 'registro' ? 'on' : ''}" data-tab="registro">Registro dispositivi</span>
    <span class="chip ${tab === 'prestiti' ? 'on' : ''}" data-tab="prestiti">Prestiti / muletto${loans?.out ? `<small>${loans.out}</small>` : ''}${loans?.late ? ' ⏰' : ''}</span></div>
    <div id="dv-body" style="display:flex;flex-direction:column;gap:1.25rem"></div>`;
  $('#dv-tabs', el).onclick = (e) => { const c = e.target.closest('[data-tab]'); if (c && c.dataset.tab !== tab) location.hash = c.dataset.tab === 'prestiti' ? '#/dispositivi?tab=prestiti' : '#/dispositivi'; };
  const body = $('#dv-body', el);
  return tab === 'prestiti' ? prestitiPanel(body) : registroView(body);
}

async function registroView(el) {
  META = META || (await safe(() => api('GET', '/api/dispositivi/meta')));
  if (!META) return;
  let cat = '';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Dispositivi</h1>
      <div class="row tight"><a class="btn btn-outline" id="dv-csv" href="/api/dispositivi/export.csv" download>⬇ Elenco seriali (CSV)</a><button class="btn btn-primary" id="dv-new">＋ Nuovo dispositivo</button></div></div>
    <p class="hint">Registro di telefoni, portatili e console con seriale/IMEI: tutto segnato per eventuali denunce. Se un seriale segnalato entra in riparazione o in vendita compare un avviso.</p>
    <div class="row tight chips-scroll" id="dv-chips"></div>
    <input id="dv-q" type="search" placeholder="Cerca per modello, seriale o IMEI (o spara con la pistola)…" />
    <div class="card overflow-hidden" id="dv-list"></div>`;
  const list = $('#dv-list', el);
  const chips = $('#dv-chips', el);

  async function load() {
    const flagFilter = cat === 'segnalati' ? '&flag=segnalati' : '';
    const data = await safe(() => api('GET', `/api/dispositivi?q=${encodeURIComponent(q)}${cat && cat !== 'segnalati' ? `&category=${cat}` : ''}${flagFilter}`));
    if (!data || !$('#dv-list', el)) return;
    const total = Object.values(data.counts).reduce((a, n) => a + n, 0);
    chips.innerHTML = `<span class="chip ${!cat ? 'on' : ''}" data-cat="">Tutti${total ? `<small>${total}</small>` : ''}</span>` +
      Object.entries(META.categories).map(([k, v]) => `<span class="chip ${cat === k ? 'on' : ''}" data-cat="${k}">${v}${data.counts[k] ? `<small>${data.counts[k]}</small>` : ''}</span>`).join('') +
      `<span class="chip chip-red ${cat === 'segnalati' ? 'on' : ''}" data-cat="segnalati">⚠ Segnalati${data.flagged ? `<small>${data.flagged}</small>` : ''}</span>`;
    $('#dv-csv', el).href = `/api/dispositivi/export.csv${cat === 'segnalati' ? '?flag=segnalati' : cat ? `?category=${cat}` : ''}`;
    const rows = data.rows;
    if (!rows.length) { list.innerHTML = '<p class="empty">Nessun dispositivo. Aggiungi il primo con “Nuovo dispositivo”.</p>'; return; }
    list.innerHTML =
      `<div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Dispositivo</th><th>Seriale / IMEI</th><th>Sottoclasse</th><th>Costo</th><th>Prezzo</th><th></th></tr></thead><tbody>` +
      rows.map((d) => `<tr class="row-h" style="cursor:pointer" data-id="${d.id}"><td><b>${esc(d.brand_model)}</b><div class="hint">${esc(META.kinds[d.kind] || d.kind)}${d.source ? ' · ' + esc(d.source) : ''}</div></td>
        <td style="font-family:monospace;font-size:.85rem">${esc(d.serial || '—')}</td><td>${esc(META.categories[d.category])}</td><td>${eur(d.cost)}</td><td><b>${eur(d.price)}</b></td><td>${flagBadge(d)}</td></tr>`).join('') +
      '</tbody></table></div>' +
      `<div class="only-narrow">${rows.map((d) => `<div class="pcard" style="cursor:pointer" data-id="${d.id}">
        <div class="top"><span class="name">${esc(d.brand_model)}</span><span class="badge bg-gray-100 text-gray-700">${esc(META.categories[d.category])}</span></div>
        <div class="sub" style="font-family:monospace">${esc(d.serial || 'nessun seriale')}</div>
        <div class="top"><span class="sub">${eur(d.price)}</span>${flagBadge(d)}</div></div>`).join('')}</div>`;
  }
  chips.onclick = (e) => { const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; load(); } };
  const qi = $('#dv-q', el);
  qi.oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  qi.addEventListener('keydown', (e) => { if (isScanEnter(e)) { q = qi.value.trim(); load(); } });
  list.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) openDevice(Number(r.dataset.id), load); };
  $('#dv-new', el).onclick = () => deviceForm(null, load);
  await load();
}

// ---------- Scheda dispositivo: dati, segnalazione, storico ----------
export async function openDevice(id, done) {
  const d = await safe(() => api('GET', `/api/dispositivi/${id}`));
  if (!d) return;
  const m = openModal(
    `${d.flag !== 'ok' ? `<div class="total-box" style="background:#FEF2F2;border:1px solid #FECACA;flex-direction:column;align-items:flex-start;gap:.2rem"><b>⚠ ${esc(d.flag_label)}</b><span class="hint">${esc(d.flag_note || '')}${d.flag_report_no ? ` · denuncia ${esc(d.flag_report_no)}` : ''}${d.flag_at ? ` · dal ${fdate(d.flag_at)}` : ''}</span></div>` : ''}
    <section class="sec">
      <dl class="kv"><dt>Sottoclasse</dt><dd>${esc(d.category_label)}</dd><dt>Tipo</dt><dd>${esc(META.kinds[d.kind] || d.kind)}</dd>
        <dt>Seriale / IMEI</dt><dd style="font-family:monospace">${esc(d.serial || '—')}</dd>${d.imei2 ? `<dt>IMEI 2</dt><dd style="font-family:monospace">${esc(d.imei2)}</dd>` : ''}
        ${d.condition_notes ? `<dt>Condizioni</dt><dd>${esc(d.condition_notes)}</dd>` : ''}${d.source ? `<dt>Provenienza</dt><dd>${esc(d.source)}</dd>` : ''}
        ${d.customer_name ? `<dt>Cliente</dt><dd>${esc(d.customer_name)}</dd>` : ''}${d.supplier_name ? `<dt>Fornitore</dt><dd>${esc(d.supplier_name)}</dd>` : ''}
        ${d.purchase_date ? `<dt>Acquistato il</dt><dd>${fdate(d.purchase_date)}</dd>` : ''}<dt>Costo / prezzo</dt><dd>${eur(d.cost)} / <b>${eur(d.price)}</b></dd>${d.notes ? `<dt>Note</dt><dd>${esc(d.notes)}</dd>` : ''}</dl>
      <div class="row tight"><button class="btn btn-outline btn-sm" id="dd-edit">Modifica</button>
        <button class="btn btn-outline btn-sm" id="dd-flag">${d.flag === 'ok' ? '⚠ Segnala rubato / da verificare' : 'Cambia segnalazione'}</button>
        <button class="btn btn-ghost btn-sm" id="dd-del">Elimina</button></div>
    </section>
    <section class="sec"><h3 class="sec-t">Riparazioni con questo seriale (${d.repairs.length})</h3>
      <div class="plist">${d.repairs.map((r) => `<div class="row-h" style="cursor:pointer" data-rid="${r.id}"><span><b>${esc(r.code)}</b> ${esc(r.brand_model)}<span class="hint" style="display:block">${esc(r.customer_name)} · ${fdate(r.created_at)}</span></span><span class="hint">${esc(r.status)}</span></div>`).join('') || '<p class="hint">Nessuna.</p>'}</div></section>
    <section class="sec"><h3 class="sec-t">Storico</h3>
      <div class="plist">${d.events.map((e) => `<div><span>${esc(e.kind)}<span class="hint" style="display:block">${esc(e.note || '')}</span></span><span class="hint">${fdt(e.created_at)}</span></div>`).join('')}</div></section>`,
    { title: d.brand_model, wide: true }
  );
  const reload = () => { m.close(); done?.(); };
  $('#dd-edit', m.el).onclick = () => { m.close(); deviceForm(d, done); };
  $('#dd-flag', m.el).onclick = () => { m.close(); flagDialog(d, done); };
  $('#dd-del', m.el).onclick = async () => {
    if (!(await confirmDelete(d.brand_model, { typed: 'ELIMINA', detail: 'Il dispositivo e il suo storico vengono tolti dal registro.' }))) return;
    if (await safe(() => api('DELETE', `/api/dispositivi/${d.id}`))) { toast('Dispositivo eliminato'); reload(); }
  };
  m.el.addEventListener('click', (e) => { const r = e.target.closest('[data-rid]'); if (r) openRepairDetail(Number(r.dataset.rid), done); });
}

function flagDialog(d, done) {
  const m = openModal(
    `<div class="sec"><div class="field"><label class="l" for="fl-flag">Stato</label><select id="fl-flag">${Object.entries(META.flags).map(([k, v]) => `<option value="${k}" ${d.flag === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="fl-note">Motivo *</label><input id="fl-note" value="${esc(d.flag_note || '')}" placeholder="Es. denunciato dal proprietario il 12/10" /></div>
      <div class="field"><label class="l" for="fl-rep">Numero di denuncia</label><input id="fl-rep" value="${esc(d.flag_report_no || '')}" /></div>
      <p class="hint">Con “Rubato” o “Da verificare” compare un avviso quando questo seriale entra in riparazione o in vendita. Togliere la segnalazione è riservato all’amministratore.</p></div>`,
    { title: 'Segnalazione del dispositivo', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="fl-ok">Salva</button>' }
  );
  const sync = () => { $('#fl-note', m.el).disabled = $('#fl-rep', m.el).disabled = $('#fl-flag', m.el).value === 'ok'; };
  $('#fl-flag', m.el).onchange = sync; sync();
  $('#fl-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/dispositivi/${d.id}/segnala`, { flag: $('#fl-flag', m.el).value, note: $('#fl-note', m.el).value, report_no: $('#fl-rep', m.el).value }));
    if (out) { m.close(); toast('Segnalazione salvata'); done?.(); }
  };
}

// ---------- Modulo nuovo / modifica ----------
function deviceForm(d, done) {
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const m = openModal(
    `<div class="sec">
      <div class="fgrid c2">
        <div class="field"><label class="l" for="df-cat">Sottoclasse</label><select id="df-cat">${opt(META.categories, d?.category || 'usato')}</select></div>
        <div class="field"><label class="l" for="df-kind">Tipo</label><select id="df-kind">${opt(META.kinds, d?.kind || 'smartphone')}</select></div>
        <div class="field span2"><label class="l" for="df-model">Marca e modello *</label><input id="df-model" value="${esc(d?.brand_model || '')}" placeholder="Es. iPhone 12 64 GB nero" /></div>
        <div class="field"><label class="l" for="df-serial">Seriale / IMEI</label>
          <div class="row nowrap"><input id="df-serial" autocomplete="off" value="${esc(d?.serial || '')}" placeholder="Spara col lettore o scrivi" /><button type="button" class="btn btn-outline btn-icon" id="df-cam" aria-label="Scansiona con la fotocamera">📷</button></div>
          <div class="hint" id="df-hint"></div></div>
        <div class="field"><label class="l" for="df-imei2">IMEI 2 (se doppia SIM)</label><input id="df-imei2" autocomplete="off" value="${esc(d?.imei2 || '')}" /></div>
        <div class="field"><label class="l" for="df-cost">Costo d’acquisto €</label><input id="df-cost" inputmode="decimal" value="${d?.cost ?? ''}" /></div>
        <div class="field"><label class="l" for="df-price">Prezzo di vendita €</label><input id="df-price" inputmode="decimal" value="${d?.price ?? ''}" /></div>
      </div>
      <details><summary class="hint" style="cursor:pointer">Più opzioni (condizioni, provenienza, data, note)</summary>
        <div class="fgrid c2" style="margin-top:.85rem">
          <div class="field"><label class="l" for="df-src">Provenienza</label><input id="df-src" value="${esc(d?.source || '')}" placeholder="Es. cliente, fornitore, asta" /></div>
          <div class="field"><label class="l" for="df-date">Data d’acquisto</label><input id="df-date" type="date" value="${esc(d?.purchase_date || today())}" /></div>
          <div class="field span2"><label class="l" for="df-cond">Condizioni</label><input id="df-cond" value="${esc(d?.condition_notes || '')}" placeholder="Es. graffi sul retro, batteria 85%" /></div>
          <div class="field span2"><label class="l" for="df-notes">Note</label><textarea id="df-notes" rows="2">${esc(d?.notes || '')}</textarea></div>
        </div></details>
    </div>`,
    { title: d ? 'Modifica dispositivo' : 'Nuovo dispositivo', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="df-ok">Salva</button>' }
  );
  const serial = $('#df-serial', m.el);
  const hint = $('#df-hint', m.el);
  const check = debounce(async () => {
    const v = serial.value.trim();
    hint.innerHTML = '';
    if (v.length < 5) return;
    const parts = [];
    const ok = imeiCheck(v);
    if (ok === true) parts.push('<span class="text-emerald-600">✔ IMEI valido</span>');
    if (ok === false) parts.push('<span class="text-amber-600">⚠ IMEI non valido: controlla la lettura</span>');
    const c = await safe(() => api('GET', `/api/dispositivi/check?serial=${encodeURIComponent(v)}`));
    const other = (c?.known || []).filter((x) => x.id !== d?.id);
    if (other.length) parts.push(`<span class="${other.some((x) => x.flag !== 'ok') ? 'text-red-600' : 'text-amber-600'}">⚠ Già nel registro: ${esc(other[0].brand_model)}${other[0].flag !== 'ok' ? ` — ${esc(other[0].flag_label)}` : ''}</span>`);
    hint.innerHTML = parts.join(' · ');
  }, 250);
  serial.addEventListener('input', check);
  serial.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#df-cost', m.el).focus(); } });
  if (serial.value) check();
  $('#df-cam', m.el).onclick = async () => { const v = await scanWithCamera(); if (v) { serial.value = v; serial.dispatchEvent(new Event('input')); toast(`Letto: ${v}`); } };
  $('#df-ok', m.el).onclick = async () => {
    const body = { category: $('#df-cat', m.el).value, kind: $('#df-kind', m.el).value, brand_model: $('#df-model', m.el).value, serial: serial.value, imei2: $('#df-imei2', m.el).value,
      cost: $('#df-cost', m.el).value, price: $('#df-price', m.el).value, source: $('#df-src', m.el).value, purchase_date: $('#df-date', m.el).value, condition_notes: $('#df-cond', m.el).value, notes: $('#df-notes', m.el).value };
    const out = await safe(() => (d ? api('PUT', `/api/dispositivi/${d.id}`, body) : api('POST', '/api/dispositivi', body)));
    if (out) { m.close(); toast('Dispositivo salvato'); done?.(); }
  };
}

/** Avviso grande per le schermate di riparazione e vendita: seriale segnalato. */
export function showDeviceAlerts(alerts) {
  if (!alerts?.length) return;
  openModal(`<div class="sec">${alerts.map((a) => `<div class="total-box" style="background:#FEF2F2;border:1px solid #FECACA;flex-direction:column;align-items:flex-start;gap:.2rem">
    <b>⚠ ${esc(a.brand_model)} · ${esc(a.serial)}</b><span>${esc(a.flag_label)}${a.flag_note ? ` — ${esc(a.flag_note)}` : ''}${a.flag_report_no ? ` (denuncia ${esc(a.flag_report_no)})` : ''}</span></div>`).join('')}
    <p class="hint">Non procedere senza verificare: l’avviso è stato scritto anche nella scheda come nota interna.</p></div>`, { title: 'Attenzione: dispositivo segnalato', footer: '<button class="btn btn-primary" data-close>Ho capito</button>' });
}
