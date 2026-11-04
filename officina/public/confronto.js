// Interfaccia delle funzioni prese dal confronto con Fix-Book, e-Share e Fixh IT (2026-11-04).
// Tecnico e fase nella scheda, estensione di garanzia, usato a margine e permuta in cassa, ricevuta su WhatsApp,
// proposta d'ordine e arrivo con differenze, stati e fasi, listino pubblico, esportazioni, permessi, tecnici, previsioni, agenda.
import { $, esc, eur, fdate, api, toast, safe, openModal, confirmDelete, META, today, addDays, canSeeCosts, trackUrl } from './util.js';
import { methodSelect } from './pickers.js';
import { appesoField, appesoVal } from './retro.js';

const num = (v) => Number(String(v ?? '').replace(',', '.'));
const val = (m, id) => $(`#${id}`, m.el)?.value?.trim() ?? '';
let TECHS = null;

// ---------- Scheda riparazione: tecnico, fase, estensione di garanzia ----------
export async function mountRepairExtra(box, r, reload) {
  if (!box) return;
  TECHS ||= (await safe(() => api('GET', '/api/tecnici'))) || [];
  const cfg = await safe(() => api('GET', '/api/stati'));
  const subs = cfg?.substatuses || [];
  const done = ['delivered', 'cancelled'].includes(r.status);
  box.innerHTML = `<div class="fgrid c2">
    <div class="field"><label class="l" for="d-tech">👷 Tecnico</label><select id="d-tech" ${done ? 'disabled' : ''}><option value="">— nessuno —</option>${TECHS.map((u) => `<option value="${esc(u.email)}" ${u.email === r.tech_email ? 'selected' : ''}>${esc(u.name || u.email)}</option>`).join('')}</select></div>
    ${subs.length && !done ? `<div class="field"><label class="l" for="d-sub">🔖 Fase (la vede il cliente)</label><select id="d-sub"><option value="">— nessuna —</option>${subs.map((t) => `<option ${t === r.substatus ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>` : r.substatus ? `<div class="field"><span class="l">🔖 Fase</span><span>${esc(r.substatus)}</span></div>` : ''}
  </div>${r.status === 'delivered' ? '<div class="row tight"><button class="btn btn-outline btn-sm" id="d-warr">🛡️ Estensione garanzia</button></div>' : ''}`;
  const t = $('#d-tech', box);
  if (t) t.onchange = async () => { if (await safe(() => api('POST', `/api/repairs/${r.id}/tech`, { email: t.value }))) { toast(t.value ? 'Tecnico assegnato' : 'Tecnico tolto'); reload(); } };
  const s = $('#d-sub', box);
  if (s) s.onchange = async () => { if (await safe(() => api('POST', `/api/repairs/${r.id}/substatus`, { substatus: s.value }))) { toast('Fase aggiornata (la vede anche il cliente)'); reload(); } };
  const w = $('#d-warr', box);
  if (w) w.onclick = () => warrantyDialog('repair', r.id, `${r.code} · ${r.brand_model}`, reload);
}

export function warrantyDialog(kind, refId, what, done) {
  const m = openModal(`<div class="sec"><p class="text-sm">Estensione di garanzia per <b>${esc(what)}</b>. Parte quando finisce la garanzia attuale e si incassa come una vendita.</p>
    <div class="fgrid c2"><div class="field"><label class="l" for="w-m">Durata</label><select id="w-m"><option value="6">6 mesi</option><option value="12" selected>12 mesi</option><option value="24">24 mesi</option><option value="36">36 mesi</option><option value="3">3 mesi</option></select></div>
      <div class="field"><label class="l" for="w-p">Prezzo €</label><input id="w-p" inputmode="decimal" placeholder="es. 29,00 (0 = omaggio)" /></div></div>
    <div class="field"><label class="l" for="w-method">Incassato con</label>${methodSelect('w-method')}${appesoField('w-appeso')}</div></div>`,
  { title: 'Estensione di garanzia', footer: '<button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-primary" id="w-ok">Vendi e crea il certificato</button>' });
  $('#w-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', '/api/garanzie', { kind, ref_id: refId, months: val(m, 'w-m'), price: val(m, 'w-p') || 0, method: val(m, 'w-method'), ...appesoVal(m.el, 'w-appeso') }));
    if (!out) return;
    m.close(); done?.();
    const url = `${META.track_base}${out.url_path}`;
    openModal(`<div class="sec"><p>Certificato <b>${esc(out.code)}</b>: valido dal ${fdate(out.starts_on)} al ${fdate(out.ends_on)}.</p>
      <div class="row tight"><a class="btn btn-dark btn-sm" target="_blank" href="${esc(out.url_path)}">🖨️ Apri e stampa</a><button class="btn btn-outline btn-sm" id="w-copy">🔗 Copia link</button></div>
      <p class="hint">Il cliente lo trova anche nel link della riparazione, sotto «I tuoi documenti».</p></div>`, { title: 'Garanzia estesa' });
    $('#w-copy').onclick = () => navigator.clipboard?.writeText(url).then(() => toast('Link copiato'));
  };
}

// ---------- Cassa: usato a margine, permuta, ricevuta ----------
export async function pickMarginItem(cb) {
  const d = await safe(() => api('GET', '/api/margine?stato=disponibili'));
  if (!d) return;
  const m = openModal(d.rows.length ? `<div class="plist">${d.rows.map((x) => `<div><span><b>${esc(x.description)}</b><span class="hint" style="display:block">${esc(x.code)}${x.serial ? ` · ••••${esc(String(x.serial).slice(-4))}` : ''}</span></span><span><b>${x.price != null ? eur(x.price) : 'senza prezzo'}</b> <button class="btn btn-outline btn-sm" data-pick="${x.id}">Aggiungi</button></span></div>`).join('')}</div>`
    : '<p class="empty">Nessun usato disponibile. Registralo da Vetrina e buoni → Usato a margine.</p>', { title: 'Usato a margine da vendere' });
  m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) { cb(d.rows.find((x) => x.id === Number(b.dataset.pick))); m.close(); } });
}

export function tradeinDialog(cur, cb) {
  const t = cur || {};
  const m = openModal(`<div class="sec"><p class="hint">Il valore si scala dal totale della vendita e il bene entra nel registro dell’usato a margine. Scegli il cliente della vendita: è il cedente.</p>
    <div class="field"><label class="l" for="t-d">Cosa ritiri *</label><input id="t-d" value="${esc(t.description || '')}" placeholder="es. iPhone 11 64GB nero" /></div>
    <div class="fgrid c2"><div class="field"><label class="l" for="t-v">Valore riconosciuto € *</label><input id="t-v" inputmode="decimal" value="${esc(t.value ?? '')}" /></div>
      <div class="field"><label class="l" for="t-p">Prezzo di rivendita € <span class="hint">(facoltativo)</span></label><input id="t-p" inputmode="decimal" value="${esc(t.price ?? '')}" /></div>
      <div class="field"><label class="l" for="t-s">IMEI / seriale</label><input id="t-s" value="${esc(t.serial || '')}" /></div>
      <div class="field"><label class="l" for="t-doc">Documento del cedente</label><input id="t-doc" value="${esc(t.seller_doc || '')}" placeholder="es. CI AX1234567" /></div></div></div>`,
  { title: 'Ritiro in permuta', footer: '<button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-primary" id="t-ok">Applica alla vendita</button>' });
  $('#t-ok', m.el).onclick = () => {
    const v = num(val(m, 't-v'));
    if (!val(m, 't-d')) return toast('Scrivi cosa ritiri.', false);
    if (!(v > 0)) return toast('Scrivi il valore riconosciuto.', false);
    cb({ description: val(m, 't-d'), value: Math.round(v * 100) / 100, price: val(m, 't-p') || null, serial: val(m, 't-s') || null, seller_doc: val(m, 't-doc') || null });
    m.close();
  };
}

export async function shareSale(id) {
  const l = await safe(() => api('GET', `/api/sales/${id}/link`));
  if (l) window.open(l.wa, '_blank', 'noopener');
}

export function afterSaleDialog(sale) {
  const m = openModal(`<div class="sec"><p>Vendita <b>${esc(sale.code)}</b> registrata: ${eur(sale.total)}.${sale.tradein_item ? `<br>♻️ Permuta registrata come <b>${esc(sale.tradein_item.code)}</b> nel registro dell’usato.` : ''}</p>
    <div class="row tight"><button class="btn btn-green btn-sm" id="as-wa">💬 Ricevuta su WhatsApp</button><a class="btn btn-outline btn-sm" target="_blank" href="/print/sale/${sale.id}">🖨️ Stampa</a><button class="btn btn-outline btn-sm" id="as-w">🛡️ Estensione garanzia</button></div></div>`, { title: 'Vendita fatta' });
  $('#as-wa', m.el).onclick = () => shareSale(sale.id);
  $('#as-w', m.el).onclick = () => { m.close(); warrantyDialog('sale', sale.id, `vendita ${sale.code}`); };
}

// ---------- Ordini: proposta calcolata e arrivo merce ----------
export async function reorderDialog(done) {
  const d = await safe(() => api('GET', '/api/riordino'));
  if (!d) return;
  const rows = d.groups.map((g) => `<h3 class="sec-t">${esc(g.supplier_name)}</h3><div class="plist">${g.lines.map((l) => `<div><span><label class="row nowrap tight"><input type="checkbox" style="width:auto;flex:none" data-pid="${l.product_id}" ${l.suggested > 0 ? 'checked' : ''} /> <b>${esc(l.name)}</b></label><span class="hint" style="display:block">ora ${l.qty_now} · minimo ${l.min_qty} · venduti 30 gg ${l.used30}${l.on_order ? ` · già in ordine ${l.on_order}` : ''} · ${esc(l.reason)}</span></span>
    <input data-q="${l.product_id}" type="number" min="0" value="${l.suggested}" style="width:5rem" aria-label="Quantità da ordinare per ${esc(l.name)}" /></div>`).join('')}</div>`).join('');
  const m = openModal(d.groups.length ? `<p class="hint">Articoli sotto la scorta minima. La quantità proposta riporta la scorta al doppio del minimo (o ai consumi di 30 giorni + minimo), meno quanto è già in ordine. Correggi e conferma: si crea un ordine per ogni fornitore.</p>${rows}${canSeeCosts() ? `<p class="hint">Valore stimato: <b>${eur(d.total)}</b></p>` : ''}` : '<p class="empty">Nessun articolo sotto scorta minima. 👍</p>',
    { title: 'Proposta d’ordine', wide: true, footer: d.groups.length ? '<button class="btn btn-ghost" data-close>Chiudi</button><button class="btn btn-primary" id="ro-ok">Crea gli ordini</button>' : '' });
  const ok = $('#ro-ok', m.el);
  if (ok) ok.onclick = async () => {
    const lines = [...m.el.querySelectorAll('[data-pid]')].filter((c) => c.checked).map((c) => ({ product_id: Number(c.dataset.pid), qty: Number($(`[data-q="${c.dataset.pid}"]`, m.el).value) }));
    const out = await safe(() => api('POST', '/api/riordino', { lines }));
    if (!out) return;
    toast(`Creati ${out.orders.length} ordini: ${out.orders.map((o) => o.code).join(', ')}`);
    m.close(); done?.();
  };
}

export function receiveDialog(o, done) {
  const m = openModal(`<p class="hint">Scrivi quanti pezzi sono arrivati davvero. Gli articoli collegati al magazzino si caricano da soli; le differenze restano scritte nell’ordine e arrivano su Telegram.</p>
    <div class="plist">${o.items.map((i) => `<div><span>${esc(i.description)}<span class="hint" style="display:block">ordinati ${i.qty}${i.product_id ? ' · si carica a magazzino' : ' · non collegato al magazzino'}</span></span><input data-it="${i.id}" type="number" min="0" value="${i.qty}" style="width:5rem" aria-label="Arrivati: ${esc(i.description)}" /></div>`).join('')}</div>`,
  { title: `Arrivo merce ${o.code}`, footer: '<button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-primary" id="rc-ok">Registra arrivo</button>' });
  $('#rc-ok', m.el).onclick = async () => {
    const lines = [...m.el.querySelectorAll('[data-it]')].map((x) => ({ item_id: Number(x.dataset.it), qty_received: Number(x.value) }));
    const out = await safe(() => api('POST', `/api/orders/${o.id}/receive`, { lines }));
    if (!out) return;
    toast(out.differences.length ? `Arrivo registrato con ${out.differences.length} differenze` : 'Arrivato tutto come ordinato', !out.differences.length);
    m.close(); done?.();
  };
}

// ---------- Impostazioni: stati e fasi, listino pubblico, esportazioni ----------
export async function mountStatusSettings(box) {
  if (!box) return;
  const c = await safe(() => api('GET', '/api/stati'));
  if (!c) return;
  box.innerHTML = `<h2 class="sec-t">Stati e fasi delle riparazioni</h2>
    <p class="hint">Rinomina gli stati e cambia il testo che legge il cliente. «Nascondi» toglie lo stato dal menu «Cambia stato». Le fasi sono etichette in più (es. «Inviato al centro Samsung») che si scelgono dalla scheda e vede anche il cliente.</p>
    <div class="plist">${c.statuses.map((s) => `<div><span class="fgrid c2" style="flex:1"><input data-sl="${s.key}" value="${esc(s.label)}" aria-label="Nome dello stato ${esc(s.default_label)}" /><input data-sh="${s.key}" value="${esc(s.hint)}" aria-label="Testo per il cliente" /></span>${s.can_hide ? `<label class="row nowrap tight hint"><input type="checkbox" style="width:auto;flex:none" data-sx="${s.key}" ${s.hidden ? 'checked' : ''} /> Nascondi</label>` : '<span class="hint">sempre</span>'}</div>`).join('')}</div>
    <div class="field"><label class="l" for="ss-subs">Fasi (una per riga)</label><textarea id="ss-subs" rows="4">${esc(c.substatuses.join('\n'))}</textarea></div>
    <div class="row"><button class="btn btn-primary" id="ss-save">Salva stati e fasi</button></div>`;
  $('#ss-save', box).onclick = async () => {
    const statuses = c.statuses.map((s) => ({ key: s.key, label: $(`[data-sl="${s.key}"]`, box).value, hint: $(`[data-sh="${s.key}"]`, box).value, hidden: !!$(`[data-sx="${s.key}"]`, box)?.checked }));
    const substatuses = $('#ss-subs', box).value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (await safe(() => api('PUT', '/api/stati', { statuses, substatuses }))) { toast('Stati e fasi salvati'); const { loadMeta } = await import('./util.js'); await safe(loadMeta); mountStatusSettings(box); }
  };
}

const DEV = { smartphone: 'Smartphone', tablet: 'Tablet', computer: 'Computer', console: 'Console', altro: 'Altro' };
export async function mountPriceListSettings(box) {
  if (!box) return;
  const list = (await safe(() => api('GET', '/api/services'))) || [];
  box.innerHTML = `<h2 class="sec-t">Listino pubblico delle riparazioni</h2>
    <p class="hint">Scegli quali servizi mostrare ai clienti. Pagina pubblica: <a href="${esc(META.track_base)}/listino" target="_blank" rel="noopener">${esc(META.track_base)}/listino</a> (i dati per il sito sono in <code>/api/listino</code>). I servizi si aggiungono da Vendite → Gestisci listino.</p>
    ${list.length ? `<div class="plist">${list.map((s) => `<div data-svc="${s.id}"><span><label class="row nowrap tight"><input type="checkbox" style="width:auto;flex:none" data-pub ${s.public ? 'checked' : ''} /> <b>${esc(s.name)}</b> · ${s.price_from ? 'da ' : ''}${eur(s.price)}</label>
      <span class="row tight"><select data-dt style="width:auto">${Object.entries(DEV).map(([k, l]) => `<option value="${k}" ${(s.device_type || 'altro') === k ? 'selected' : ''}>${l}</option>`).join('')}</select><label class="row nowrap tight hint"><input type="checkbox" style="width:auto;flex:none" data-from ${s.price_from !== 0 ? 'checked' : ''} /> prezzo «da»</label><input data-note value="${esc(s.public_note || '')}" placeholder="Nota per il cliente" style="max-width:16rem" /></span></span></div>`).join('')}</div>` : '<p class="empty">Nessun servizio nel listino.</p>'}`;
  box.addEventListener('change', async (e) => {
    const row = e.target.closest('[data-svc]');
    if (!row) return;
    const out = await safe(() => api('PUT', `/api/services/${row.dataset.svc}/public`, { public: $('[data-pub]', row).checked, device_type: $('[data-dt]', row).value, price_from: $('[data-from]', row).checked, public_note: $('[data-note]', row).value }));
    if (out) toast(out.public ? 'Visibile nel listino pubblico' : 'Nascosto dal listino pubblico');
  });
}

export async function mountExportPanel(box) {
  if (!box || META.role !== 'admin') { if (box) box.remove(); return; }
  const d = await safe(() => api('GET', '/api/export'));
  if (!d) return;
  box.innerHTML = `<h2 class="sec-t">Esporta per Excel</h2><p class="hint">File CSV che Excel apre direttamente (accenti e colonne corretti). Per riparazioni e vendite vale il periodo scelto.</p>
    <div class="row tight"><input type="date" id="ex-from" class="!w-auto" value="${today().slice(0, 8)}01" aria-label="Dal" /><input type="date" id="ex-to" class="!w-auto" value="${today()}" aria-label="Al" /></div>
    <div class="row tight">${d.items.map((x) => `<button class="btn btn-outline btn-sm" data-ex="${x.key}">⬇️ ${esc(x.label)}</button>`).join('')}</div>`;
  box.onclick = (e) => { const b = e.target.closest('[data-ex]'); if (b) window.open(`/api/export/${b.dataset.ex}.csv?from=${$('#ex-from', box).value}&to=${$('#ex-to', box).value}`, '_blank'); };
}

// ---------- Utenti: permessi ----------
export async function permissionsDialog(u, done) {
  const d = await safe(() => api('GET', '/api/permessi'));
  if (!d) return;
  let deny = []; try { deny = JSON.parse(u.deny || '[]'); } catch { /* vuoto */ }
  const m = openModal(`<p class="hint">Togli a <b>${esc(u.name || u.email)}</b> le sezioni che non deve usare. Il blocco vale sul server: non basta conoscere l’indirizzo. Le riparazioni restano sempre accessibili.</p>
    <div class="plist">${d.sections.map((s) => `<div><label class="row nowrap tight"><input type="checkbox" style="width:auto;flex:none" data-deny="${s.key}" ${deny.includes(s.key) ? 'checked' : ''} /> Nega: ${esc(s.label)}</label></div>`).join('')}</div>`,
  { title: 'Permessi utente', footer: '<button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-primary" id="pm-ok">Salva permessi</button>' });
  $('#pm-ok', m.el).onclick = async () => {
    const list = [...m.el.querySelectorAll('[data-deny]')].filter((c) => c.checked).map((c) => c.dataset.deny);
    if (await safe(() => api('PUT', `/api/users/${u.id}/permessi`, { deny: list }))) { toast('Permessi salvati: valgono dal prossimo caricamento della pagina'); m.close(); done?.(); }
  };
}

// ---------- Analisi: tecnici e previsioni ----------
export async function techStatsTab(out, from, to) {
  const d = await safe(() => api('GET', `/api/tecnici/stats?from=${from}&to=${to}`));
  if (!d) return;
  out.innerHTML = `<section class="card panel sec"><h2 class="sec-t">Lavoro per tecnico</h2>${d.rows.length ? `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Tecnico</th><th class="n">Aperte</th><th class="n">Consegnate</th><th class="n">Incassato</th><th class="n">Margine stimato</th><th class="n">Giorni medi</th></tr></thead><tbody>
    ${d.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${r.open}</td><td class="n">${r.delivered}</td><td class="n">${eur(r.revenue)}</td><td class="n">${eur(r.margin)}</td><td class="n">${r.avg_days ?? '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nessuna riparazione nel periodo.</p>'}
    <p class="hint">Il tecnico si assegna dalla scheda della riparazione. Margine = prezzo finale meno costo dei ricambi.</p></section>`;
}
export async function forecastTab(out) {
  const f = await safe(() => api('GET', '/api/previsioni'));
  if (!f) return;
  const c = f.cash;
  out.innerHTML = `<section class="card panel sec"><h2 class="sec-t">Previsione di fine mese (${esc(f.month)}, giorno ${f.day} di ${f.days_in_month})</h2>
    <dl class="kv"><dt>Incassato finora</dt><dd><b>${eur(c.so_far)}</b> · media ${eur(c.daily_avg)} al giorno</dd>
      <dt>Previsione (ritmo del mese)</dt><dd><b>${eur(c.projected)}</b></dd>
      <dt>Previsione (media 90 giorni)</dt><dd>${eur(c.projected_by_90)}</dd>
      <dt>Stesso mese anno scorso</dt><dd>${c.last_year_month ? `${eur(c.last_year_month)}${c.vs_last_year_pct != null ? ` (${c.vs_last_year_pct > 0 ? '+' : ''}${String(c.vs_last_year_pct).replace('.', ',')}%)` : ''}` : '—'}</dd>
      <dt>Riparazioni entrate</dt><dd>${f.repairs.intake_so_far} finora, previste ${f.repairs.intake_projected}</dd>
      <dt>Da incassare su riparazioni aperte</dt><dd>${eur(f.repairs.open_to_collect.amount)} (${f.repairs.open_to_collect.n})</dd></dl>
    <p class="hint">Stima semplice: non tiene conto di festività o chiusure.</p></section>`;
}

// ---------- Vista: Usato a margine ----------
export async function margineView(el) {
  const S = { stato: 'disponibili', q: '' };
  const admin = META.role === 'admin';
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Usato a margine</h1><button class="btn btn-primary" id="mg-new">＋ Registra usato</button></div>
    <p class="hint">Registro dei beni usati comprati da privati o ritirati in permuta (regime del margine, art. 36 D.L. 41/1995). Si vendono da Vendite → «♻️ Usato a margine»: l’IVA si calcola sul margine e non compare in ricevuta.</p>
    <div class="row tight chips-scroll"><span class="chip on" data-st="disponibili">Disponibili</span><span class="chip" data-st="venduti">Venduti</span><span class="chip" data-st="">Tutti</span>${admin ? '<span class="chip" data-st="registro">📊 Riepilogo IVA</span>' : ''}</div>
    <input id="mg-q" type="search" placeholder="Cerca descrizione, seriale, codice…" aria-label="Cerca nel registro" />
    <div id="mg-out"></div>`;
  const out = $('#mg-out', el);
  async function load() {
    if (S.stato === 'registro') {
      const r = await safe(() => api('GET', '/api/margine/registro'));
      if (!r) return;
      out.innerHTML = `<section class="card panel sec"><h2 class="sec-t">Mese in corso (${fdate(r.from)} – ${fdate(r.to)})</h2><dl class="kv">
        <dt>Acquistati</dt><dd>${r.bought.n} (${eur(r.bought.total)}), di cui ${r.bought.permute} in permuta</dd><dt>Venduti</dt><dd>${r.sold.n} · incasso ${eur(r.sold.revenue)} · costo ${eur(r.sold.cost)}</dd>
        <dt>Margine</dt><dd><b>${eur(r.margin)}</b>${r.negative ? ` · ${r.negative} a margine negativo (IVA zero)` : ''}</dd><dt>IVA sul margine (${r.vat_rate}%)</dt><dd><b>${eur(r.vat_due)}</b></dd>
        <dt>In giacenza</dt><dd>${r.stock.n} beni · ${eur(r.stock.value)}</dd></dl><p class="hint">Metodo analitico, bene per bene. Da far confermare al commercialista.</p>
        <a class="btn btn-outline btn-sm" href="/api/export/usato.csv" target="_blank">⬇️ Registro completo per Excel</a></section>`;
      return;
    }
    const d = await safe(() => api('GET', `/api/margine?stato=${S.stato}&q=${encodeURIComponent(S.q)}`));
    if (!d) return;
    out.innerHTML = d.rows.length ? `<div class="card overflow-hidden">${d.rows.map((x) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(x.description)} ${x.sold ? '<span class="badge bg-gray-100 text-gray-500">venduto</span>' : ''}</p>
        <p class="text-xs text-gray-500">${esc(x.code)} · ${esc(x.origin_label)} il ${fdate(x.acquired_at)} · ${esc(x.seller_customer || x.seller_name || '')}${x.cost != null ? ` · costo ${eur(x.cost)}` : ''}${x.sold ? ` · venduto ${eur(x.sale_price)}` : x.price != null ? ` · prezzo ${eur(x.price)}` : ''}</p></div>
      <a class="btn btn-ghost btn-sm" target="_blank" href="/print/margine/${x.id}">🏷️ Cartellino</a>${x.sold ? '' : `<button class="btn btn-outline btn-sm" data-ed="${x.id}">Modifica</button>`}</div>`).join('')}</div>` : '<p class="empty card">Nessun bene in questo elenco.</p>';
    out._rows = d.rows;
  }
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-st]');
    if (c) { S.stato = c.dataset.st; el.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('on', x === c)); return load(); }
    const ed = e.target.closest('[data-ed]');
    if (ed) return marginForm(out._rows.find((x) => x.id === Number(ed.dataset.ed)), load);
  });
  $('#mg-new', el).onclick = () => marginForm(null, load);
  $('#mg-q', el).oninput = (e) => { S.q = e.target.value.trim(); load(); };
  await load();
}

function marginForm(x, done) {
  const v = x || {};
  const m = openModal(`<div class="sec">
    <div class="field"><label class="l" for="mf-d">Descrizione *</label><input id="mf-d" value="${esc(v.description || '')}" placeholder="es. iPhone 12 128GB blu" /></div>
    <div class="fgrid c2"><div class="field"><label class="l" for="mf-s">IMEI / seriale</label><input id="mf-s" value="${esc(v.serial || '')}" /></div>
      <div class="field"><label class="l" for="mf-o">Provenienza</label><select id="mf-o"><option value="acquisto">Acquisto da privato</option><option value="permuta" ${v.origin === 'permuta' ? 'selected' : ''}>Ritiro in permuta</option><option value="altro" ${v.origin === 'altro' ? 'selected' : ''}>Altro</option></select></div>
      <div class="field"><label class="l" for="mf-n">Cedente (nome e cognome) *</label><input id="mf-n" value="${esc(v.seller_name || v.seller_customer || '')}" /></div>
      <div class="field"><label class="l" for="mf-doc">Documento del cedente</label><input id="mf-doc" value="${esc(v.seller_doc || '')}" placeholder="es. CI AX1234567" /></div>
      <div class="field"><label class="l" for="mf-c">Prezzo pagato € *</label><input id="mf-c" inputmode="decimal" value="${esc(v.cost ?? '')}" /></div>
      <div class="field"><label class="l" for="mf-p">Prezzo di vendita €</label><input id="mf-p" inputmode="decimal" value="${esc(v.price ?? '')}" /></div>
      <div class="field"><label class="l" for="mf-a">Data di acquisto</label><input id="mf-a" type="date" value="${esc(v.acquired_at || today())}" /></div></div>
    <div class="field"><label class="l" for="mf-no">Note</label><input id="mf-no" value="${esc(v.notes || '')}" /></div></div>`,
  { title: x ? `Usato ${x.code}` : 'Registra usato a margine', footer: `${x && META.role === 'admin' ? '<button class="btn btn-ghost" id="mf-del" style="color:#B91C1C">Elimina</button>' : ''}<button class="btn btn-ghost" data-close>Annulla</button><button class="btn btn-primary" id="mf-ok">Salva</button>` });
  $('#mf-ok', m.el).onclick = async () => {
    const body = { description: val(m, 'mf-d'), serial: val(m, 'mf-s'), origin: val(m, 'mf-o'), seller_name: val(m, 'mf-n'), seller_doc: val(m, 'mf-doc'), cost: val(m, 'mf-c'), price: val(m, 'mf-p'), acquired_at: val(m, 'mf-a'), notes: val(m, 'mf-no') };
    if (x?.seller_customer_id) body.seller_customer_id = x.seller_customer_id;
    if (await safe(() => api(x ? 'PUT' : 'POST', x ? `/api/margine/${x.id}` : '/api/margine', body))) { toast('Salvato nel registro'); m.close(); done(); }
  };
  const del = $('#mf-del', m.el);
  if (del) del.onclick = async () => { if (await confirmDelete(`il bene ${x.code} dal registro`) && await safe(() => api('DELETE', `/api/margine/${x.id}`))) { m.close(); done(); } };
}

// ---------- Vista: Agenda ----------
export async function agendaView(el) {
  let from = today();
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Agenda</h1>
    <div class="row tight"><button class="btn btn-outline btn-sm" id="ag-prev">← 2 settimane</button><button class="btn btn-outline btn-sm" id="ag-today">Oggi</button><button class="btn btn-outline btn-sm" id="ag-next">2 settimane →</button></div></div>
    <p class="hint">Tutte le scadenze in un posto: promemoria, consegne previste delle riparazioni, ordini attesi e preventivi in scadenza. I promemoria si creano da Banco → Promemoria.</p><div id="ag-out"></div>`;
  const shift = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  async function load() {
    const d = await safe(() => api('GET', `/api/agenda?from=${from}&to=${shift(from, 13)}`));
    if (!d || !$('#ag-out', el)) return;
    $('#ag-out', el).className = 'stack';
    $('#ag-out', el).innerHTML = d.days.filter((x) => x.items.length || x.date === today()).map((x) => `<section class="card panel sec"><h2 class="sec-t">${new Date(`${x.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}${x.date === today() ? ' · oggi' : ''}</h2>
      ${x.items.length ? `<div class="plist">${x.items.map((i) => `<div><span>${i.icon} ${i.time ? `<b>${esc(i.time)}</b> ` : ''}<a href="${esc(i.link)}">${esc(i.title)}</a>${i.detail ? `<span class="hint" style="display:block">${esc(i.detail)}</span>` : ''}</span><span class="hint">${i.done ? 'fatto' : ''}</span></div>`).join('')}</div>` : '<p class="hint">Niente in programma.</p>'}</section>`).join('') || '<p class="empty card">Nessuna scadenza nelle prossime due settimane.</p>';
  }
  $('#ag-prev', el).onclick = () => { from = shift(from, -14); load(); };
  $('#ag-next', el).onclick = () => { from = shift(from, 14); load(); };
  $('#ag-today', el).onclick = () => { from = today(); load(); };
  await load();
}
