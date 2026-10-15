// Chiusure di cassa: archivio con atteso (dagli incassi del giorno) e contato, differenza evidenziata, foto facoltativa,
// ricerca per periodo, totali mensili, CSV, blocco/sblocco e chiusure di giorni passati.
import { $, esc, eur, fdate, fdt, api, toast, safe, debounce, openModal, confirmDelete, today, META } from './util.js';
import { archCss, n2, r2, inVal, sgn, monthName, kpiTile, csvLink, periods } from './arch-ui.js';
import { resizePhoto } from './usati.js';

const dow = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long' });
const diffCls = (d) => (Math.abs(d) < 0.005 ? 'ok' : Math.abs(d) <= 5 ? 'warn' : 'bad');
const diffBadge = (d) => (Math.abs(d) < 0.005 ? '<span class="badge bg-emerald-100 text-emerald-700">✔ Quadra</span>' : `<span class="badge ${Math.abs(d) <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}">${d > 0 ? 'Più' : 'Meno'} ${eur(Math.abs(d))}</span>`);
const isAdmin = () => META.role === 'admin';

export async function chiusureView(el) {
  archCss();
  const P = periods();
  let per = 'mese';
  let from = P[0][2]; let to = P[0][3];
  let q = ''; let onlyDiff = false;
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Chiusure di cassa</h1>
      <div class="row"><button class="btn btn-outline" id="ch-csv">⬇ Scarica CSV</button><button class="btn btn-primary" id="ch-new">＋ Nuova chiusura</button></div></div>
    <div class="flex gap-2 flex-wrap chips-scroll" id="ch-chips"></div>
    <div class="fgrid c3" style="align-items:end">
      <div class="field"><label class="l" for="ch-from">Dal</label><input type="date" id="ch-from" /></div>
      <div class="field"><label class="l" for="ch-to">Al</label><input type="date" id="ch-to" /></div>
      <div class="field"><label class="l" for="ch-q">Cerca (operatore, note, data)</label><input id="ch-q" type="search" placeholder="es. Christian, mancano…" /></div>
    </div>
    <div id="ch-out" class="sec"></div>`;
  const drawChips = () => {
    $('#ch-chips', el).innerHTML = P.map(([k, l]) => `<span class="chip ${per === k ? 'on' : ''}" data-p="${k}">${l}</span>`).join('') + `<span class="chip chip-red ${onlyDiff ? 'on' : ''}" data-diff>Solo con differenza</span>`;
    $('#ch-from', el).value = from; $('#ch-to', el).value = to;
  };
  const qs = () => new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q ? { q } : {}), ...(onlyDiff ? { only_diff: '1' } : {}) });
  async function load() {
    drawChips();
    const d = await safe(() => api('GET', `/api/closings?${qs()}`));
    const out = $('#ch-out', el);
    if (!d || !out) return;
    const t = d.totals;
    out.innerHTML = `
      <div class="ar-kpis">${kpiTile(t.n, t.n === 1 ? 'Chiusura' : 'Chiusure')}${kpiTile(eur(t.expected), 'Atteso totale')}${kpiTile(eur(t.counted), 'Contato totale')}${kpiTile(sgn(t.difference), t.with_diff ? `Differenza (${t.with_diff} ${t.with_diff === 1 ? 'giorno' : 'giorni'} non quadra)` : 'Differenza: tutto quadra', `ar-diff ${diffCls(t.difference)}`)}</div>
      ${d.by_month.length ? `<section class="card panel sec"><h2 class="sec-t">Totali per mese</h2><div>${d.by_month.map((m) => `<div class="ar-mrow"><span class="h">${esc(monthName(m.month))}</span>
        <span class="n hint">${m.n} ${m.n === 1 ? 'chiusura' : 'chiusure'}${m.with_diff ? ` · ${m.with_diff} con differenza` : ''}</span><span style="text-align:right"><b>${eur(m.counted)}</b> <span class="hint">contati</span> ${diffBadge(m.difference)}</span></div>`).join('')}</div></section>` : ''}
      <div class="card overflow-hidden">${d.rows.map((r) => `<div class="ar-row" data-id="${r.id}">
        <div class="main"><span class="t">${fdate(r.day)} <span style="font-weight:500;color:var(--muted);text-transform:capitalize">${dow(r.day)}</span>${r.retro ? '<span class="badge bg-blue-100 text-blue-700">retroattiva</span>' : ''}${r.locked ? '<span class="badge bg-gray-200 text-gray-700">🔒 bloccata</span>' : ''}${r.has_photo ? '<span class="badge bg-gray-100 text-gray-700">📷 foto</span>' : ''}</span>
          <span class="s">${esc(r.operator)} · atteso ${eur(r.expected_total)} · contato ${eur(r.counted_total)}${r.notes ? ` · “${esc(r.notes.length > 70 ? `${r.notes.slice(0, 70)}…` : r.notes)}”` : ''}</span></div>
        <div class="side">${diffBadge(r.difference)}</div></div>`).join('') || '<p class="empty">Nessuna chiusura in questo periodo. Premi “Nuova chiusura” (anche per giorni passati).</p>'}</div>`;
  }
  $('#ch-chips', el).onclick = (e) => {
    if (e.target.closest('[data-diff]')) { onlyDiff = !onlyDiff; return load(); }
    const c = e.target.closest('[data-p]'); if (!c) return;
    const p = P.find((x) => x[0] === c.dataset.p); per = p[0]; from = p[2]; to = p[3]; load();
  };
  const custom = () => { per = ''; from = $('#ch-from', el).value; to = $('#ch-to', el).value; load(); };
  $('#ch-from', el).onchange = custom; $('#ch-to', el).onchange = custom;
  $('#ch-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#ch-csv', el).onclick = () => csvLink(`/api/closings/export.csv?${qs()}`);
  $('#ch-new', el).onclick = () => closingForm(null, load);
  $('#ch-out', el).onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) closingForm(Number(r.dataset.id), load); };
  await load();
}

/** Nuova chiusura (id nullo) o apertura/modifica di una esistente. */
async function closingForm(id, done) {
  let c = id ? await safe(() => api('GET', `/api/closings/${id}`)) : null;
  if (id && !c) return;
  let day = c?.day || today();
  let exp = null; // atteso dagli incassi
  let photoFile = null;
  const locked = !!c?.locked;
  const dis = locked ? 'disabled' : '';
  const m = openModal(`<div class="sec">
    ${locked ? `<div class="ar-alert warn">🔒 Chiusura <b>bloccata</b> da ${esc(c.locked_by || '—')} il ${fdt(c.locked_at)}. Per cambiarla serve prima lo sblocco (solo amministratore, con il motivo: resta nel Registro).</div>` : ''}
    <div class="fgrid c3">
      <div class="field"><label class="l" for="cf-day">Giorno *</label><input type="date" id="cf-day" max="${today()}" value="${day}" ${c ? 'disabled' : ''} /><span class="hint" id="cf-dayhint"></span></div>
      <div class="field"><label class="l" for="cf-op">Operatore *</label><input id="cf-op" value="${esc(c?.operator || '')}" placeholder="chi ha chiuso la cassa" ${dis} /></div>
      <div class="field"><label class="l" for="cf-float">Fondo cassa (€)</label><input id="cf-float" inputmode="decimal" value="${c ? inVal(c.float_amount) : ''}" placeholder="0,00" ${dis} /><span class="hint">I contanti che restano nel cassetto per il giorno dopo.</span></div>
    </div>
    <div id="cf-exp"></div>
    <div><h3 class="sec-t" style="margin-bottom:.6rem">Quanto hai contato</h3>
    <div class="fgrid c3">
      <div class="field"><label class="l" for="cf-cash">Contanti nel cassetto (€)</label><input id="cf-cash" inputmode="decimal" value="${c ? inVal(c.cnt_cash) : ''}" placeholder="0,00" ${dis} /><span class="hint">Fondo compreso.</span></div>
      <div class="field"><label class="l" for="cf-pos">Totale POS / carte (€)</label><input id="cf-pos" inputmode="decimal" value="${c ? inVal(c.cnt_pos) : ''}" placeholder="0,00" ${dis} /><span class="hint">Dallo scontrino di chiusura del POS.</span></div>
      <div class="field"><label class="l" for="cf-oth">Altro (bonifici, buoni…) (€)</label><input id="cf-oth" inputmode="decimal" value="${c ? inVal(c.cnt_other) : ''}" placeholder="0,00" ${dis} /></div>
    </div></div>
    <div id="cf-res"></div>
    <div class="field"><label class="l" for="cf-notes">Note</label><textarea id="cf-notes" rows="3" placeholder="es. 2 € di resto mancanti, scontrino strappato… (facoltative)" ${dis}>${esc(c?.notes || '')}</textarea></div>
    <div class="field"><label class="l">Foto dello scontrino/cassa <span style="font-weight:500;color:var(--muted)">(facoltativa)</span></label>
      <div id="cf-photo"></div></div>
    ${c && (c.updated_at || c.created_by) ? `<p class="hint">Creata da ${esc(c.created_by || '—')} il ${fdt(c.created_at)}${c.retro ? ' · <b>chiusura retroattiva</b>' : ''}${c.updated_at ? ` · ultima modifica ${esc(c.updated_by || '')} il ${fdt(c.updated_at)}` : ''}. Tutte le modifiche sono nel Registro.</p>` : ''}
  </div>`, {
    title: c ? `Chiusura del ${fdate(c.day)}` : 'Nuova chiusura di cassa', wide: true, full: true,
    footer: `<button class="btn btn-outline" data-close>Chiudi</button>
      ${c && !locked && isAdmin() ? '<button class="btn btn-ghost" id="cf-del">Elimina</button>' : ''}
      ${c && locked && isAdmin() ? '<button class="btn btn-outline" id="cf-unlock">🔓 Sblocca…</button>' : ''}
      ${c && !locked ? '<button class="btn btn-dark" id="cf-lock">🔒 Blocca</button>' : ''}
      ${!locked ? `<button class="btn btn-primary" id="cf-save">${c ? 'Salva modifiche' : 'Salva chiusura'}</button>` : ''}`,
  });
  const g = (i) => $(i, m.el);
  const sums = () => {
    const base = c && !exp?._fresh ? { exp_cash: c.exp_cash, exp_pos: c.exp_pos, exp_other: c.exp_other, cash_out: c.cash_out } : exp || { exp_cash: 0, exp_pos: 0, exp_other: 0, cash_out: 0 };
    const fl = n2(g('#cf-float').value);
    const drawer = r2(fl + base.exp_cash - base.cash_out);
    const expTot = r2(drawer + base.exp_pos + base.exp_other);
    const cC = n2(g('#cf-cash').value); const cP = n2(g('#cf-pos').value); const cO = n2(g('#cf-oth').value);
    return { base, fl, drawer, expTot, cC, cP, cO, cntTot: r2(cC + cP + cO), dCash: r2(cC - drawer), dPos: r2(cP - base.exp_pos), dOth: r2(cO - base.exp_other) };
  };
  const drawExp = () => {
    const s = sums();
    const b = s.base;
    g('#cf-exp').innerHTML = `<div class="ar-box"><h3 class="sec-t">Atteso dagli incassi del giorno ${c ? '<span class="hint" style="text-transform:none;letter-spacing:0;font-weight:500">(fotografia al momento del salvataggio)</span>' : ''}</h3>
      <div class="ln"><span>Fondo cassa</span><span>${eur(s.fl)}</span></div>
      <div class="ln"><span>Incassi in contanti</span><span>${eur(b.exp_cash)}</span></div>
      <div class="ln"><span>− Spese pagate in contanti dalla cassa</span><span>${eur(b.cash_out)}</span></div>
      <div class="ln"><span>= Contanti attesi nel cassetto</span><b>${eur(s.drawer)}</b></div>
      <div class="ln"><span>Incassi POS / carte</span><span>${eur(b.exp_pos)}</span></div>
      <div class="ln"><span>Altro (bonifici, buoni…)</span><span>${eur(b.exp_other)}</span></div>
      <div class="ln tot"><span style="color:inherit">Atteso totale</span><span>${eur(s.expTot)}</span></div>
      ${c && !locked ? '<div><button type="button" class="btn btn-outline btn-sm" id="cf-recalc">↻ Ricalcola l’atteso con gli incassi di adesso</button></div>' : ''}</div>`;
    const b2 = g('#cf-recalc');
    if (b2) b2.onclick = async () => { const p = await safe(() => api('GET', `/api/closings/preview?day=${c.day}`)); if (p) { exp = { ...p.expected, _fresh: true, _recalc: true }; drawExp(); drawRes(); toast('Atteso ricalcolato: salva per confermare'); } };
  };
  const drawRes = () => {
    const s = sums();
    const d = r2(s.cntTot - s.expTot);
    const cls = diffCls(d);
    const parts = [['contanti', s.dCash], ['POS', s.dPos], ['altro', s.dOth]].filter(([, v]) => Math.abs(v) >= 0.005);
    g('#cf-res').innerHTML = `<div class="ar-box" style="flex-direction:row;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem">
      <div><span class="hint">Contato totale ${eur(s.cntTot)} · atteso ${eur(s.expTot)}</span><div class="ar-diff ${cls}">${Math.abs(d) < 0.005 ? '✔ Quadra' : `${d > 0 ? 'In più' : 'Mancano'} ${eur(Math.abs(d))}`}</div></div>
      ${parts.length && Math.abs(d) >= 0.005 || parts.length > 1 ? `<span class="hint">${parts.map(([n, v]) => `${n}: ${sgn(v)}`).join(' · ')}</span>` : ''}</div>`;
  };
  const drawPhoto = () => {
    const has = c?.has_photo;
    g('#cf-photo').innerHTML = `${has ? `<img class="ar-photo" src="/api/closings/${c.id}/photo?t=${Date.now()}" alt="Foto della chiusura" />` : ''}
      ${photoFile ? `<p class="hint">📷 Foto scelta: ${esc(photoFile.name)} (verrà allegata al salvataggio)</p>` : ''}
      ${locked ? '' : `<div class="row tight"><label class="btn btn-outline btn-sm" style="cursor:pointer">${has || photoFile ? '📷 Cambia foto' : '📷 Scatta o scegli una foto'}<input type="file" id="cf-file" accept="image/*" capture="environment" hidden></label>${has ? '<button type="button" class="btn btn-ghost btn-sm" id="cf-rmphoto">Togli foto</button>' : ''}${photoFile ? '<button type="button" class="btn btn-ghost btn-sm" id="cf-nophoto">Annulla scelta</button>' : ''}</div>`}`;
    const f = g('#cf-file');
    if (f) f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      if (c) { await uploadPhoto(file); } else { photoFile = file; drawPhoto(); }
    };
    if (g('#cf-rmphoto')) g('#cf-rmphoto').onclick = async () => { const o = await safe(() => api('DELETE', `/api/closings/${c.id}/photo`)); if (o) { c = o; toast('Foto tolta'); drawPhoto(); done?.(); } };
    if (g('#cf-nophoto')) g('#cf-nophoto').onclick = () => { photoFile = null; drawPhoto(); };
  };
  const uploadPhoto = async (file, cid = c?.id) => {
    const r = await safe(async () => { const { image } = await resizePhoto(file); return api('POST', `/api/closings/${cid}/photo`, { image }); });
    if (r) { c = r; photoFile = null; toast('Foto allegata'); drawPhoto(); done?.(); }
    return r;
  };
  async function loadExp() {
    day = g('#cf-day').value;
    if (!day) return;
    const p = await safe(() => api('GET', `/api/closings/preview?day=${day}`));
    if (!p) return;
    exp = { ...p.expected, _fresh: true };
    const hint = g('#cf-dayhint');
    if (p.existing && !c) hint.innerHTML = `⚠ Esiste già una chiusura di questo giorno: <a href="#" id="cf-open" class="underline">aprila</a>.`;
    else hint.textContent = day < today() ? 'Chiusura di un giorno passato: va benissimo, resta segnata “retroattiva”.' : '';
    const o = g('#cf-open');
    if (o) o.onclick = (e) => { e.preventDefault(); m.close(); closingForm(p.existing.id, done); };
    drawExp(); drawRes();
  }
  if (c) { drawExp(); drawRes(); drawPhoto(); } else { drawPhoto(); drawRes(); await loadExp(); }
  if (!c) g('#cf-day').onchange = loadExp;
  m.el.addEventListener('input', (e) => { if (e.target.closest('#cf-float,#cf-cash,#cf-pos,#cf-oth')) { drawExp(); drawRes(); } });

  const body = (extra = {}) => ({ day, operator: g('#cf-op').value, float_amount: g('#cf-float').value, cnt_cash: g('#cf-cash').value, cnt_pos: g('#cf-pos').value, cnt_other: g('#cf-oth').value, notes: g('#cf-notes').value, ...extra });
  if (g('#cf-save')) g('#cf-save').onclick = async () => {
    if (!g('#cf-op').value.trim()) { toast('Scrivi chi ha chiuso la cassa.', false); return g('#cf-op').focus(); }
    const out = await safe(() => (c ? api('PUT', `/api/closings/${c.id}`, body({ recalc: !!exp?._recalc })) : api('POST', '/api/closings', body())));
    if (!out) return;
    if (photoFile) { const ok = await uploadPhoto(photoFile, out.id); if (!ok) toast('Chiusura salvata, ma la foto non è stata allegata.', false); }
    toast(c ? 'Chiusura aggiornata' : 'Chiusura salvata'); m.close(); done?.();
  };
  if (g('#cf-lock')) g('#cf-lock').onclick = async () => { const o = await safe(() => api('POST', `/api/closings/${c.id}/lock`, {})); if (o) { toast('Chiusura bloccata'); m.close(); done?.(); } };
  if (g('#cf-unlock')) g('#cf-unlock').onclick = () => {
    const u = openModal('<div class="sec"><p class="text-sm">Lo sblocco resta nel Registro con il motivo e il tuo nome.</p><div class="field"><label class="l" for="uk-why">Motivo *</label><input id="uk-why" placeholder="es. errore nel conteggio dei contanti" /></div></div>',
      { title: 'Sblocca la chiusura', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="uk-go">Sblocca</button>' });
    $('#uk-go', u.el).onclick = async () => { const o = await safe(() => api('POST', `/api/closings/${c.id}/unlock`, { reason: $('#uk-why', u.el).value })); if (o) { u.close(); m.close(); toast('Chiusura sbloccata'); done?.(); closingForm(c.id, done); } };
  };
  if (g('#cf-del')) g('#cf-del').onclick = async () => {
    if (!(await confirmDelete(`la chiusura del ${fdate(c.day)}`, { detail: 'Resta traccia nel Registro con importi e operatore.' }))) return;
    if (await safe(() => api('DELETE', `/api/closings/${c.id}`))) { toast('Chiusura eliminata'); m.close(); done?.(); }
  };
}
