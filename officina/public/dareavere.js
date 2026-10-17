// Dare/avere per cliente e per riparazione (anche movimenti passati) + alert "cattivo pagatore".
// Saldo = dare - avere: positivo = il cliente ci deve; negativo = abbiamo un suo credito.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, today, META } from './util.js';
import { archCss, n2, inVal, kpiTile, csvLink, methodOptions } from './arch-ui.js';
import { customerField, bindCustomer } from './pickers.js';

const TYPES = {
  debito: { label: 'Debito del cliente', cls: 'bg-red-100 text-red-700', help: 'Il cliente ci deve dei soldi (lavoro o merce lasciata da pagare). Non muove la cassa.', cash: false, sign: 'dare' },
  incasso: { label: 'Pagamento ricevuto', cls: 'bg-emerald-100 text-emerald-700', help: 'Il cliente ha pagato (anche in parte). I soldi entrano in Cassa, nel giorno indicato.', cash: true, sign: 'avere' },
  credito: { label: 'Credito del cliente', cls: 'bg-blue-100 text-blue-700', help: 'Dobbiamo qualcosa al cliente (anticipo da restituire, differenza). Non muove la cassa.', cash: false, sign: 'avere' },
  rimborso: { label: 'Rimborso al cliente', cls: 'bg-amber-100 text-amber-800', help: 'Abbiamo restituito dei soldi al cliente. Esce dalle Spese, nel giorno indicato.', cash: true, sign: 'dare' },
};
const isAdmin = () => META.role === 'admin';
const balTxt = (b) => (b > 0.004 ? `<b style="color:var(--red-d)">${eur(b)}</b> <span class="hint">ci deve</span>` : b < -0.004 ? `<b style="color:#1D4ED8">${eur(-b)}</b> <span class="hint">credito suo</span>` : '<b style="color:#047857">0,00 €</b> <span class="hint">in pari</span>');
export const badPayerBadge = () => '<span class="badge bg-red-100 text-red-700" title="Debiti non saldati o pagamenti in ritardo ricorrenti">⚠ Cattivo pagatore</span>';

// ---------- Pezzi usati dalle altre schermate ----------
let flagsCache = null;
/** Clienti segnalati: { id: {reasons, balance, ...} } (si ricarica ogni volta che si apre un elenco). */
export async function fetchFlags() {
  try { flagsCache = await api('GET', '/api/ledger/flags'); } catch { flagsCache = flagsCache || {}; }
  return flagsCache;
}
/** Avviso sotto la scelta del cliente (nuova riparazione, nuova vendita): rosso se cattivo pagatore, giallo se ha solo un saldo aperto. */
export async function debtorNotice(box, customerId) {
  archCss();
  box.querySelectorAll('[data-debtor]').forEach((x) => x.remove());
  if (!customerId) return;
  let s;
  try { s = await api('GET', `/api/ledger/status/${customerId}`); } catch { return; }
  if (!s || !box.isConnected) return;
  let html = '';
  if (s.flagged) html = `<div class="ar-alert bad" data-debtor style="margin-top:.6rem">⚠ <b>Attenzione: cattivo pagatore.</b> ${s.reasons.map(esc).join('; ')}.${s.balance > 0 ? ` Saldo da incassare: <b>${eur(s.balance)}</b>.` : ''} <a href="#/dareavere?cliente=${customerId}" class="underline">Apri dare/avere</a></div>`;
  else if (s.balance > 0.004) html = `<div class="ar-alert warn" data-debtor style="margin-top:.6rem">Ha un saldo aperto di <b>${eur(s.balance)}</b>${s.oldest_days ? ` (il più vecchio da ${s.oldest_days} giorni)` : ''}. <a href="#/dareavere?cliente=${customerId}" class="underline">Apri dare/avere</a></div>`;
  if (html) box.insertAdjacentHTML('beforeend', html);
}
/** Riquadro "Dare/avere" nella scheda cliente. */
export async function mountCustomerLedger(box, customer, done) {
  archCss();
  const d = await safe(() => api('GET', `/api/ledger/customer/${customer.id}`));
  if (!d || !box.isConnected) return;
  const s = d.status;
  box.innerHTML = `<h3 class="sec-t">Dare/avere</h3>
    ${s.flagged ? `<div class="ar-alert bad">⚠ <b>Cattivo pagatore.</b> ${s.reasons.map(esc).join('; ')}.</div>` : ''}
    <div class="row" style="justify-content:space-between"><span>${s.n ? balTxt(s.balance) : '<span class="hint">Nessun movimento.</span>'}</span>
      <span class="row tight"><button class="btn btn-outline btn-sm" id="cl-new">＋ Movimento</button><a class="btn btn-ghost btn-sm" href="#/dareavere?cliente=${customer.id}" id="cl-open">Apri</a></span></div>`;
  $('#cl-new', box).onclick = () => entryForm({ customer_id: customer.id, customer_name: customer.name }, async () => { await mountCustomerLedger(box, customer, done); done?.(); });
  $('#cl-open', box).onclick = () => document.querySelector('.modal-bg [data-close]')?.click();
}
/** Soglie del cattivo pagatore dentro Impostazioni (sezione propria, salva da sola). */
export async function mountLedgerSettings(before) {
  archCss();
  if (!before || $('#st-ledger')) return;
  const c = await safe(() => api('GET', '/api/ledger/config'));
  if (!c || !before.isConnected) return;
  const ro = isAdmin() ? '' : 'disabled';
  before.insertAdjacentHTML('beforebegin', `<section class="card panel sec" id="st-ledger"><h2 class="sec-t">Cattivo pagatore (dare/avere)</h2>
    <p class="sec-sub">Un cliente viene segnalato su scheda, nuova riparazione, nuova vendita ed elenco clienti quando supera una di queste soglie. 0 = controllo spento.</p>
    <div class="fgrid c3">
      <div class="field"><label class="l" for="lg-days">Debito non saldato oltre (giorni)</label><input id="lg-days" inputmode="numeric" value="${esc(c.ledger_bad_days)}" ${ro} /></div>
      <div class="field"><label class="l" for="lg-amt">Debito aperto da (€)</label><input id="lg-amt" inputmode="decimal" value="${esc(c.ledger_bad_amount)}" ${ro} /></div>
      <div class="field"><label class="l" for="lg-rep">Ricorrenza: debiti in ritardo</label><input id="lg-rep" inputmode="numeric" value="${esc(c.ledger_bad_repeat)}" ${ro} /><span class="hint">Quanti debiti pagati oltre i giorni sopra (o ancora aperti).</span></div>
    </div>${isAdmin() ? '<div><button class="btn btn-primary" id="lg-save">Salva soglie</button></div>' : '<p class="hint">Solo l’amministratore può cambiarle.</p>'}</section>`);
  const b = $('#lg-save');
  if (b) b.onclick = async () => {
    const o = await safe(() => api('PUT', '/api/ledger/config', { ledger_bad_days: n2($('#lg-days').value), ledger_bad_amount: n2($('#lg-amt').value), ledger_bad_repeat: n2($('#lg-rep').value) }));
    if (o) toast('Soglie salvate');
  };
}

// ---------- Vista principale ----------
export async function dareavereView(el, params) {
  archCss();
  let filtro = params.get('filtro') || '';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Dare / avere</h1>
      <div class="row"><button class="btn btn-outline" id="da-csv">⬇ Scarica CSV</button><button class="btn btn-primary" id="da-new">＋ Nuovo movimento</button></div></div>
    <input id="da-q" type="search" placeholder="Cerca cliente per nome o telefono…" />
    <div class="flex gap-2 flex-wrap chips-scroll" id="da-chips"></div>
    <div id="da-out" class="sec"></div>`;
  async function load() {
    $('#da-chips', el).innerHTML = [['', 'Tutti'], ['owing', 'Ci devono'], ['flagged', '⚠ Cattivi pagatori'], ['credit', 'Con credito']].map(([k, l]) => `<span class="chip ${filtro === k ? 'on' : ''}" data-f="${k}">${l}</span>`).join('');
    const d = await safe(() => api('GET', `/api/ledger/customers?only=${filtro}&q=${encodeURIComponent(q)}`));
    const out = $('#da-out', el);
    if (!d || !out) return;
    out.innerHTML = `<div class="ar-kpis">${kpiTile(d.totals.customers, d.totals.customers === 1 ? 'Cliente con movimenti' : 'Clienti con movimenti')}${kpiTile(eur(d.totals.owing), 'Ci devono', d.totals.owing ? 'text-red-600' : '')}${kpiTile(eur(d.totals.credit), 'Crediti dei clienti', d.totals.credit ? 'text-blue-600' : '')}${kpiTile(d.totals.flagged, d.totals.flagged === 1 ? 'Cattivo pagatore' : 'Cattivi pagatori', d.totals.flagged ? 'text-red-600' : '')}</div>
      <div class="card overflow-hidden">${d.rows.map((r) => `<div class="ar-row" data-c="${r.id}">
        <div class="main"><span class="t">${esc(r.name)} ${r.flagged ? badPayerBadge() : ''}</span>
          <span class="s">${r.phone ? `${esc(r.phone)} · ` : ''}${r.open_amount > 0 ? `debito aperto ${eur(r.open_amount)}${r.oldest_days ? ` (il più vecchio da ${r.oldest_days} gg)` : ''}` : 'nessun debito aperto'} · ultimo movimento ${fdate(r.last_date)}</span>
          ${r.flagged ? `<span class="s" style="color:#991B1B">${r.reasons.map(esc).join(' · ')}</span>` : ''}</div>
        <div class="side">${balTxt(r.balance)}</div></div>`).join('') || '<p class="empty">Nessun cliente con questi filtri. Con “Nuovo movimento” registri un debito, un pagamento o un credito (anche passato).</p>'}</div>`;
  }
  $('#da-chips', el).onclick = (e) => { const c = e.target.closest('[data-f]'); if (c) { filtro = c.dataset.f; load(); } };
  $('#da-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#da-csv', el).onclick = () => csvLink('/api/ledger/export.csv');
  $('#da-new', el).onclick = () => entryForm({}, load);
  $('#da-out', el).onclick = (e) => { const r = e.target.closest('[data-c]'); if (r) openLedger(Number(r.dataset.c), load); };
  await load();
  const open = Number(params.get('cliente'));
  if (open) openLedger(open, load);
}

/** Scheda dare/avere di un cliente: stato, movimenti, riepilogo per riparazione. */
export async function openLedger(customerId, done) {
  const d = await safe(() => api('GET', `/api/ledger/customer/${customerId}`));
  if (!d) return;
  const s = d.status;
  const m = openModal(`<section class="sec">
      ${s.flagged ? `<div class="ar-alert bad">⚠ <b>Cattivo pagatore.</b> ${s.reasons.map(esc).join('; ')}.</div>` : ''}
      <div class="ar-box"><div class="ln"><span>Dare (ci deve)</span><span>${eur(s.dare)}</span></div><div class="ln"><span>Avere (ha pagato / suo credito)</span><span>${eur(s.avere)}</span></div>
        <div class="ln tot"><span style="color:inherit">Saldo</span><span>${balTxt(s.balance)}</span></div></div>
      ${s.open_debts.length ? `<div><h3 class="sec-t" style="margin-bottom:.4rem">Debiti ancora aperti</h3><div class="plist">${s.open_debts.map((x) => `<div><span>${fdate(x.entry_date)} · ${esc(x.description)} <span class="hint">da ${x.age_days} giorni</span></span><b>${eur(x.remaining)}</b></div>`).join('')}</div></div>` : ''}
      <div class="row"><button class="btn btn-outline btn-sm" data-new="debito">＋ Debito</button><button class="btn btn-primary btn-sm" data-new="incasso">＋ Pagamento ricevuto</button><button class="btn btn-outline btn-sm" data-new="credito">＋ Credito</button><button class="btn btn-outline btn-sm" data-new="rimborso">＋ Rimborso</button>
        ${d.customer.phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(d.customer.phone)}">📞 Chiama</a>` : ''}</div>
    </section>
    ${d.by_repair.length ? `<section class="sec"><h3 class="sec-t">Per riparazione</h3><div class="plist">${d.by_repair.map((r) => `<div><span>${esc(r.code)} · ${esc(r.model)}</span><span>${balTxt(r.balance)}</span></div>`).join('')}</div></section>` : ''}
    <section class="sec"><h3 class="sec-t">Movimenti (${d.entries.length})</h3>
      <div class="plist">${d.entries.map((e) => `<div><span>${fdate(e.entry_date)} <span class="badge ${TYPES[e.entry_type].cls}">${TYPES[e.entry_type].label}</span>${e.retro ? ' <span class="badge bg-gray-100 text-gray-700">passato</span>' : ''}<span class="hint" style="display:block">${esc(e.description)}${e.repair_code ? ` · ${esc(e.repair_code)}` : ''}${e.method ? ` · ${esc(e.method)}` : ''}</span></span>
        <span><b>${e.direction === 'dare' ? '' : '−'}${eur(e.amount)}</b>${isAdmin() ? `<button class="xbtn" data-del="${e.id}" aria-label="Elimina movimento">✕</button>` : ''}</span></div>`).join('') || '<p class="hint">Nessun movimento.</p>'}</div></section>`,
  { title: d.customer.name, wide: true });
  const again = () => { m.close(); done?.(); openLedger(customerId, done); };
  m.el.addEventListener('click', async (e) => {
    const n = e.target.closest('[data-new]');
    if (n) { m.close(); entryForm({ customer_id: customerId, customer_name: d.customer.name, entry_type: n.dataset.new }, () => { done?.(); openLedger(customerId, done); }); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!(await confirmDelete('questo movimento', { detail: 'Se era un pagamento viene tolto anche dalla Cassa (un rimborso dalle Spese). Resta nel Registro.' }))) return;
      if (await safe(() => api('DELETE', `/api/ledger/${del.dataset.del}`))) { toast('Movimento eliminato'); again(); }
    }
  });
}

/** Nuovo movimento. pre = { customer_id, customer_name, entry_type }. */
function entryForm(pre, done) {
  let type = pre.entry_type || 'debito';
  const m = openModal(`<div class="sec">
    ${pre.customer_id ? `<div class="total-box"><span>👤 <b>${esc(pre.customer_name || '')}</b></span></div>` : customerField('ef-cust', 'Cliente', { required: true })}
    <div class="field"><label class="l" for="ef-type">Che movimento è?</label><select id="ef-type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${t.label}</option>`).join('')}</select><span class="hint" id="ef-help"></span></div>
    <div class="fgrid c3">
      <div class="field"><label class="l" for="ef-amt">Importo (€) *</label><input id="ef-amt" inputmode="decimal" placeholder="0,00" /></div>
      <div class="field"><label class="l" for="ef-date">Data</label><input id="ef-date" type="date" max="${today()}" value="${today()}" /><span class="hint" id="ef-datehint"></span></div>
      <div class="field" id="ef-mwrap"><label class="l" for="ef-m">Metodo *</label><select id="ef-m">${methodOptions()}</select></div>
    </div>
    <div class="field"><label class="l" for="ef-desc">Descrizione *</label><input id="ef-desc" placeholder="es. display iPhone lasciato da pagare" /></div>
    <div class="field" id="ef-rwrap"><label class="l" for="ef-rep">Riparazione collegata <span style="font-weight:500;color:var(--muted)">(facoltativa)</span></label><select id="ef-rep"><option value="">— nessuna —</option></select></div>
  </div>`, { title: 'Nuovo movimento dare/avere', wide: true, full: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ef-save">Salva</button>' });
  const g = (s) => $(s, m.el);
  const cust = pre.customer_id ? { value: () => pre.customer_id } : bindCustomer(m.el, 'ef-cust', null, { allowNone: false });
  const upType = () => { type = g('#ef-type').value; g('#ef-help').textContent = TYPES[type].help; g('#ef-mwrap').style.display = TYPES[type].cash ? '' : 'none'; };
  const loadReps = async () => {
    const cid = cust.value();
    const sel = g('#ef-rep');
    if (!cid) { sel.innerHTML = '<option value="">— nessuna —</option>'; return; }
    const c = await safe(() => api('GET', `/api/customers/${cid}`));
    if (c) sel.innerHTML = `<option value="">— nessuna —</option>${c.repairs.map((r) => `<option value="${r.id}">${esc(r.code)} · ${esc(r.brand_model)}</option>`).join('')}`;
    if (pre.repair_id) sel.value = String(pre.repair_id);
    debtorNotice(g('#ef-type').closest('.field'), cid);
  };
  g('#ef-type').onchange = upType; upType();
  g('#ef-date').onchange = () => { g('#ef-datehint').textContent = g('#ef-date').value < today() ? 'Movimento passato: resta segnato “passato” nel Registro.' : ''; };
  m.el.addEventListener('change', (e) => { if (e.target.id === 'ef-cust') loadReps(); });
  loadReps();
  g('#ef-save').onclick = async () => {
    if (!cust.value()) { toast('Scegli il cliente.', false); return; }
    const out = await safe(() => api('POST', '/api/ledger', { customer_id: cust.value(), entry_type: type, amount: g('#ef-amt').value, entry_date: g('#ef-date').value, method: TYPES[type].cash ? g('#ef-m').value : undefined, description: g('#ef-desc').value, repair_id: g('#ef-rep').value || null }));
    if (out) { m.close(); toast('Movimento registrato'); done?.(); }
  };
  void inVal;
}

/** Riquadro "Dare/avere" della scheda riparazione: i movimenti collegati a QUESTA riparazione (se ce ne sono). */
export async function mountRepairLedger(box, repair, done) {
  archCss();
  const d = await safe(() => api('GET', `/api/ledger/repair/${repair.id}`));
  if (!d || !box.isConnected) return;
  box.innerHTML = `<h3 class="sec-t">Dare/avere di questa riparazione</h3>
    ${d.entries.length ? `<div class="ar-box">${d.entries.map((e) => `<div class="ln"><span>${esc(e.type_label)} · ${esc(e.description || '')} <span class="hint">${fdate(e.entry_date)}</span></span><span>${eur(e.amount)}</span></div>`).join('')}
      <div class="ln tot"><span style="color:inherit">Saldo</span><span>${balTxt(d.balance)}</span></div></div>` : '<p class="hint">Nessun movimento collegato a questa riparazione.</p>'}
    <div class="row tight"><button class="btn btn-outline btn-sm" id="rl-new">＋ Movimento</button></div>`;
  $('#rl-new', box).onclick = () => entryForm({ customer_id: repair.customer_id, customer_name: repair.customer_name, repair_id: repair.id }, async () => { await mountRepairLedger(box, repair, done); done?.(); });
}
