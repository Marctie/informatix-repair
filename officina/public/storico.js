// Storico riparazioni: tutte le riparazioni con i dettagli, ricerca e filtri, esportazione CSV, scheda riassuntiva.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, META, canSeeCosts, addDays, today } from './util.js';
import { openRepairDetail } from './repair.js';

const OUT_BADGE = { 'Riparato e consegnato': 'b-ok', 'Non riparata / annullata': 'b-bad', 'Pronta, da ritirare': 'b-info', 'In corso': 'b-warn' };
const outBadge = (r) => `<span class="badge ${OUT_BADGE[r.outcome] || 'b-idle'}">${esc(r.outcome)}</span>`;
const PERIODS = [['', 'Sempre'], ['30', 'Ultimi 30 giorni'], ['90', 'Ultimi 90 giorni'], ['365', 'Ultimo anno']];

export async function storicoView(el, params) {
  const S = { q: '', customer: params.get('customer') || '', brand: '', model: '', status: '', from: '', to: '', campo: 'ingresso', device_type: '' };
  const brands = ((await safe(() => api('GET', '/api/modelli/brands'))) || []).map((b) => b.brand);
  const statuses = Object.entries(META.statuses || {});
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Storico riparazioni</h1>
      <a class="btn btn-outline" id="st-csv" href="/api/storico/export.csv" download>⬇ Esporta CSV</a></div>
    <p class="hint">Tutte le riparazioni (anche quelle chiuse da anni) con cliente, dispositivo, seriale, problema, esito${canSeeCosts() ? ', costi e margine' : ''}. Cerca e filtra, poi esporta il risultato.</p>
    <section class="card panel"><div class="fbar c4">
      <div class="field span2"><label class="l" for="st-q">Cerca</label><input id="st-q" type="search" placeholder="Scheda, cliente, telefono, modello, seriale, problema…" value="${esc(S.q)}" /></div>
      <div class="field"><label class="l" for="st-cust">Cliente</label><input id="st-cust" type="search" placeholder="Nome o telefono" value="${esc(S.customer)}" /></div>
      <div class="field"><label class="l" for="st-status">Stato</label><select id="st-status"><option value="">Tutti</option><option value="aperte">Aperte</option><option value="chiuse">Chiuse</option>${statuses.map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="st-brand">Marca</label><input id="st-brand" list="st-brands" placeholder="Es. Samsung" autocomplete="off" /><datalist id="st-brands">${brands.map((b) => `<option value="${esc(b)}"></option>`).join('')}</datalist></div>
      <div class="field"><label class="l" for="st-model">Modello</label><input id="st-model" placeholder="Es. A54" autocomplete="off" /></div>
      <div class="field"><label class="l" for="st-type">Tipo</label><select id="st-type"><option value="">Tutti</option>${Object.entries(META.device_types || { smartphone: { label: 'Smartphone' }, tablet: { label: 'Tablet' }, portatile: { label: 'Portatile' }, pc: { label: 'PC fisso' } }).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="st-per">Periodo</label><select id="st-per">${PERIODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}<option value="x">Date precise…</option></select></div>
      <div class="field span2 hidden" id="st-dates"><label class="l">Dal / al</label><div class="row nowrap"><input id="st-from" type="date" aria-label="Dal" /><input id="st-to" type="date" aria-label="Al" />
        <select id="st-campo" aria-label="Riferito a" style="width:auto"><option value="ingresso">per data di ingresso</option><option value="consegna">per data di consegna</option></select></div></div>
    </div></section>
    <div class="stat-row" id="st-stat"></div>
    <div class="card overflow-hidden" id="st-list"></div>`;
  const list = $('#st-list', el);
  const qs = () => new URLSearchParams(Object.entries(S).filter(([k, v]) => v && !(k === 'campo' && !S.from && !S.to))).toString();
  let rows = {};
  async function load() {
    const d = await safe(() => api('GET', `/api/storico?${qs()}`));
    if (!d || !$('#st-list', el)) return;
    $('#st-csv', el).href = `/api/storico/export.csv?${qs()}`;
    const t = d.totals;
    $('#st-stat', el).innerHTML = `<span><b>${t.count}</b> riparazioni${t.count >= 500 ? ' (prime 500: restringi i filtri; il CSV ne contiene fino a 2000)' : ''}</span><span><b>${t.closed}</b> consegnate</span><span>Incassato sulle consegnate <b>${eur(t.amount)}</b></span>${t.cost != null ? `<span>Costi <b>${eur(t.cost)}</b></span><span>Margine <b>${eur(t.margin)}</b></span>` : ''}`;
    rows = Object.fromEntries(d.rows.map((r) => [r.id, r]));
    if (!d.rows.length) { list.innerHTML = '<p class="empty">Nessuna riparazione con questi filtri.</p>'; return; }
    list.innerHTML =
      `<div class="tbl-wrap only-wide"><table class="t" style="min-width:56rem"><thead><tr><th>Scheda</th><th>Cliente</th><th>Dispositivo</th><th>Problema</th><th>Esito</th><th>Importo</th>${canSeeCosts() ? '<th>Costi</th><th>Margine</th>' : ''}</tr></thead><tbody>` +
      d.rows.map((r) => `<tr class="row-h" style="cursor:pointer" data-id="${r.id}"><td><b>${esc(r.code)}</b><div class="hint">${fdate(r.created_at)}${r.delivered_at ? ` → ${fdate(r.delivered_at)}` : ''}</div></td>
        <td>${esc(r.customer_name)}<div class="hint">${esc(r.customer_phone || '')}</div></td><td><b>${esc(r.brand_model)}</b>${r.color ? ` <span class="hint">${esc(r.color)}</span>` : ''}<div class="hint" style="font-family:monospace">${esc(r.serial || '')}</div></td>
        <td style="max-width:16rem"><span class="hint" style="color:inherit">${esc(r.problem)}</span></td><td>${outBadge(r)}<div class="hint">${esc(r.status_label)}</div></td><td>${eur(r.amount)}</td>
        ${canSeeCosts() ? `<td>${eur(r.total_cost)}${r.external_count ? `<div class="hint">${r.external_count} est.</div>` : ''}</td><td>${r.margin == null ? '—' : eur(r.margin)}</td>` : ''}</tr>`).join('') +
      '</tbody></table></div>' +
      `<div class="only-narrow">${d.rows.map((r) => `<div class="pcard" style="cursor:pointer" data-id="${r.id}"><div class="top"><span class="name">${esc(r.brand_model)}</span>${outBadge(r)}</div>
        <div class="sub">${esc(r.code)} · ${esc(r.customer_name)} · ${fdate(r.created_at)}</div><div class="sub">${esc(r.problem)}</div>
        <div class="top"><span class="sub">${esc(r.serial || 'senza seriale')}</span><b>${eur(r.amount)}</b></div></div>`).join('')}</div>`;
  }
  const set = (k, id) => { $(`#${id}`, el).oninput = debounce((e) => { S[k] = e.target.value.trim(); load(); }); };
  set('q', 'st-q'); set('customer', 'st-cust'); set('brand', 'st-brand'); set('model', 'st-model');
  $('#st-status', el).onchange = (e) => { S.status = e.target.value; load(); };
  $('#st-type', el).onchange = (e) => { S.device_type = e.target.value; load(); };
  $('#st-per', el).onchange = (e) => {
    const v = e.target.value;
    $('#st-dates', el).classList.toggle('hidden', v !== 'x');
    if (v === 'x') return;
    S.from = v ? addDays(-Number(v)) : '';
    S.to = '';
    load();
  };
  for (const [k, id] of [['from', 'st-from'], ['to', 'st-to']]) $(`#${id}`, el).onchange = (e) => { S[k] = e.target.value; load(); };
  $('#st-campo', el).onchange = (e) => { S.campo = e.target.value; load(); };
  list.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) openSummary(rows[r.dataset.id].id, load); };
  if (S.customer) $('#st-cust', el).value = S.customer;
  await load();
}

/** Scheda riassuntiva: tutti i dettagli; "Apri la scheda completa" porta alla riparazione vera e propria. */
async function openSummary(id, done) {
  const r = await safe(() => api('GET', `/api/storico/${id}`));
  if (!r) return;
  const m = openModal(
    `<section class="sec"><div class="row tight">${outBadge(r)}<span class="badge b-idle">${esc(r.status_label)}</span></div>
      <dl class="kv"><dt>Cliente</dt><dd>${esc(r.customer_name)}${r.customer_phone ? ` · ${esc(r.customer_phone)}` : ''}</dd>
        <dt>Dispositivo</dt><dd><b>${esc(r.brand_model)}</b>${r.color ? ` (${esc(r.color)})` : ''}</dd><dt>Seriale / IMEI</dt><dd style="font-family:monospace">${esc(r.serial || '—')}</dd>
        <dt>Problema</dt><dd>${esc(r.problem)}</dd>${r.tech_notes ? `<dt>Note tecniche</dt><dd>${esc(r.tech_notes)}</dd>` : ''}
        <dt>Ingresso</dt><dd>${fdate(r.created_at)}</dd>${r.delivered_at ? `<dt>Consegna</dt><dd>${fdate(r.delivered_at)}</dd>` : ''}<dt>Garanzia</dt><dd>${r.warranty_days} giorni</dd>
        <dt>Preventivo / finale</dt><dd>${eur(r.quote)} / <b>${eur(r.final_price)}</b>${r.deposit ? ` · acconto ${eur(r.deposit)}` : ''}</dd>
        ${canSeeCosts() ? `<dt>Costi</dt><dd>ricambi ${eur(r.parts_cost)} · esterni ${eur(r.external_cost)}${r.margin != null ? ` · margine <b>${eur(r.margin)}</b>` : ''}</dd>` : ''}</dl></section>
    ${r.parts.length ? `<section class="sec"><h3 class="sec-t">Ricambi (${r.parts.length})</h3><div class="plist">${r.parts.map((p) => `<div><span>${esc(p.name)} <span class="hint">×${p.qty}</span></span><span>${eur(p.unit_price * p.qty)}</span></div>`).join('')}</div></section>` : ''}
    ${r.externals.length ? `<section class="sec"><h3 class="sec-t">Riparazioni esterne</h3><div class="plist">${r.externals.map((e) => `<div><span>${esc(e.lab)} <span class="hint">${esc(e.work || '')} · ${esc(e.status.replace('_', ' '))}</span></span><span>${canSeeCosts() ? eur(e.cost) : ''}</span></div>`).join('')}</div></section>` : ''}
    ${r.loans.length ? `<section class="sec"><h3 class="sec-t">Muletti</h3><div class="plist">${r.loans.map((l) => `<div><span>${esc(l.label)}</span><span class="hint">${fdate(l.lent_at)} → ${l.returned_at ? fdate(l.returned_at) : 'fuori'}</span></div>`).join('')}</div></section>` : ''}
    <section class="sec"><h3 class="sec-t">Cronologia</h3><ul class="tl">${r.events.map((e) => `<li><time>${fdate(e.created_at)}</time><span>${esc(e.note || '')}</span></li>`).join('')}</ul></section>`,
    { title: `${r.code} · ${r.brand_model}`, wide: true, footer: '<button class="btn btn-outline" data-close>Chiudi</button><button class="btn btn-primary" id="sd-open">Apri la scheda completa</button>' }
  );
  $('#sd-open', m.el).onclick = () => { m.close(); openRepairDetail(id, done); };
}
