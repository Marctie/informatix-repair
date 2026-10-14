// Buoni sconto / regalo (elenco, creazione, stampa) e il riquadro "Pagamento" condiviso da Vendite e Consegna riparazione:
// metodo singolo, conto diviso su piu' quote (metodi/persone) e codice buono. Tutto finisce in cassa, nulla e' nascosto.
import { $, $$, esc, eur, fdate, fdt, api, toast, safe, openModal, confirmDelete, today, addDays, isScanEnter } from './util.js';

const STATE_BADGE = { attivo: 'bg-emerald-100 text-emerald-700', esaurito: 'bg-gray-200 text-gray-600', scaduto: 'bg-amber-100 text-amber-800', annullato: 'bg-red-100 text-red-700' };
const KIND_ICON = { regalo: '🎁', sconto_importo: '🏷️', sconto_percentuale: '％' };
const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const METHODS = ['contanti', 'carta', 'bonifico'];
export const buonoWhat = (v) => (v.kind === 'sconto_percentuale' ? `${v.value}%` : eur(v.kind === 'regalo' ? v.balance : v.value));

// ---------- Riquadro Pagamento (buono + conto diviso) ----------
/**
 * getDue: funzione che dice quanto c'e' da pagare adesso. methodId: id del menu "metodo" (resta lo stesso di prima).
 * mount(el) disegna dentro el; payload() da' i campi da inviare all'API; validate() ritorna un messaggio d'errore o ''.
 */
export function createSettlement({ methodId, getDue }) {
  const st = { code: '', voucher: null, split: false, rows: [{ method: 'contanti', amount: '', payer: '' }, { method: 'carta', amount: '', payer: '' }], given: '', method: 'contanti' };
  let root = null;
  const applied = () => (st.voucher ? st.voucher.applies : 0);
  const rest = () => Math.max(0, r2(getDue() - applied()));

  async function recheck() {
    if (!st.code) { st.voucher = null; return; }
    const v = await safe(() => api('GET', `/api/buoni/check?code=${encodeURIComponent(st.code)}&total=${getDue()}`));
    st.voucher = v || null;
    if (!v) st.code = '';
  }
  function draw() {
    if (!root || !root.isConnected) return;
    const due = getDue();
    const left = rest();
    const sum = r2(st.rows.reduce((a, r) => a + num(r.amount), 0));
    const diff = r2(left - sum);
    const methodSel = (id, cur, attr = '') => `<select ${id ? `id="${id}"` : ''} ${attr} aria-label="Metodo di pagamento">${METHODS.map((m) => `<option ${cur === m ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
    root.innerHTML = `
      <div class="field"><label class="l" for="${methodId}-code">Codice buono <span style="font-weight:500;color:var(--muted)">(facoltativo)</span></label>
        <div class="row nowrap"><input id="${methodId}-code" autocomplete="off" placeholder="Scrivi o spara il codice" value="${esc(st.voucher ? st.voucher.code : st.code)}" ${st.voucher ? 'disabled' : ''} />
          ${st.voucher ? `<button type="button" class="btn btn-outline" data-act="unvoucher">Togli</button>` : `<button type="button" class="btn btn-outline" data-act="voucher">Applica</button>`}</div>
        ${st.voucher ? `<div class="hint" style="color:#047857">🎟️ ${esc(st.voucher.kind_label)} · <b>−${eur(st.voucher.applies)}</b>· da pagare <b>${eur(left)}</b>${st.voucher.kind === 'regalo' && st.voucher.balance > st.voucher.applies ? ` · resta ${eur(r2(st.voucher.balance - st.voucher.applies))} sul buono` : ''}</div>` : ''}</div>
      ${left > 0 ? (st.split ? `
        <div class="field"><label class="l">Conto diviso · da pagare <b>${eur(left)}</b></label>
          <div class="sec" style="gap:.5rem">${st.rows.map((r, i) => `<div class="row nowrap" data-row="${i}">
            ${methodSel('', r.method, `data-f="method" data-i="${i}"`)}<input inputmode="decimal" style="width:6.5rem" placeholder="€" data-f="amount" data-i="${i}" value="${esc(r.amount)}" aria-label="Importo quota ${i + 1}" />
            <input placeholder="Chi paga" data-f="payer" data-i="${i}" value="${esc(r.payer)}" aria-label="Chi paga" />
            ${st.rows.length > 2 ? `<button type="button" class="btn btn-ghost btn-icon" data-act="rmrow" data-i="${i}" aria-label="Togli quota">✕</button>` : ''}</div>`).join('')}</div>
          <div class="row tight">${st.rows.length < 6 ? '<button type="button" class="btn btn-outline btn-sm" data-act="addrow">＋ Aggiungi quota</button>' : ''}<button type="button" class="btn btn-ghost btn-sm" data-act="fill">Completa l’ultima</button><button type="button" class="btn btn-ghost btn-sm" data-act="single">Un solo metodo</button>
            <b style="margin-left:auto;color:${Math.abs(diff) < 0.005 ? '#047857' : '#B45309'}">${Math.abs(diff) < 0.005 ? '✔ Quadra' : diff > 0 ? `Mancano ${eur(diff)}` : `Eccedono ${eur(-diff)}`}</b></div></div>`
      : `<div class="fgrid c2" style="align-items:end">
          <div class="field"><label class="l" for="${methodId}">Pagamento</label>${methodSel(methodId, st.method)}</div>
          <div class="field"><button type="button" class="btn btn-outline" data-act="split">➗ Dividi il conto</button></div>
          ${st.method === 'contanti' ? `<div class="field"><label class="l" for="${methodId}-given">Contanti ricevuti € <span style="font-weight:500;color:var(--muted)">(per il resto)</span></label><input id="${methodId}-given" inputmode="decimal" value="${esc(st.given)}" /></div>
            <div class="field"><span class="l">Resto da dare</span><b class="font-heading" style="font-size:1.4rem" id="${methodId}-change">${num(st.given) >= left && st.given !== '' ? eur(r2(num(st.given) - left)) : '—'}</b></div>` : ''}
        </div>`)
      : `<p class="hint">Il buono copre tutto il totale: niente da incassare.</p>`}`;
  }
  async function onAct(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'voucher') { st.code = $(`#${methodId}-code`, root).value.trim(); if (!st.code) return; await recheck(); }
    else if (act === 'unvoucher') { st.voucher = null; st.code = ''; }
    else if (act === 'split') { st.split = true; st.rows[0].method = st.method; st.rows[0].amount = ''; st.rows[1].amount = ''; }
    else if (act === 'single') st.split = false;
    else if (act === 'addrow') st.rows.push({ method: 'contanti', amount: '', payer: '' });
    else if (act === 'rmrow') st.rows.splice(Number(b.dataset.i), 1);
    else if (act === 'fill') { const last = st.rows.length - 1; const others = st.rows.slice(0, last).reduce((a, r) => a + num(r.amount), 0); st.rows[last].amount = String(Math.max(0, r2(rest() - others))).replace('.', ','); }
    draw();
  }
  function onInput(e) {
    const t = e.target;
    if (t.dataset.f) {
      st.rows[Number(t.dataset.i)][t.dataset.f] = t.value;
      if (t.dataset.f === 'amount') { // aggiorna solo l'indicatore "Quadra / Mancano", senza perdere il cursore
        const sum = r2(st.rows.reduce((a, r) => a + num(r.amount), 0)); const diff = r2(rest() - sum);
        const tag = root.querySelector('b[style*="margin-left:auto"]');
        if (tag) { tag.textContent = Math.abs(diff) < 0.005 ? '✔ Quadra' : diff > 0 ? `Mancano ${eur(diff)}` : `Eccedono ${eur(-diff)}`; tag.style.color = Math.abs(diff) < 0.005 ? '#047857' : '#B45309'; }
      }
    } else if (t.id === `${methodId}-given`) {
      st.given = t.value;
      const out = $(`#${methodId}-change`, root);
      if (out) out.textContent = num(t.value) >= rest() && t.value !== '' ? eur(r2(num(t.value) - rest())) : '—';
    }
  }
  function onChange(e) {
    if (e.target.id === methodId) { st.method = e.target.value; draw(); }
    else if (e.target.dataset.f === 'method') st.rows[Number(e.target.dataset.i)].method = e.target.value;
  }
  return {
    mount(el) {
      root = el;
      root.onclick = onAct; root.oninput = onInput; root.onchange = onChange;
      root.onkeydown = (e) => { if (e.target.id === `${methodId}-code` && (e.key === 'Enter' || isScanEnter(e))) { e.preventDefault(); onAct({ target: $('[data-act="voucher"]', root) }); } };
      draw();
      if (st.voucher || st.code) recheck().then(draw); // il totale puo' essere cambiato: ricalcola lo sconto
    },
    /** da chiamare quando cambia il totale (sconto, prezzo finale...) */
    update() { if (st.voucher) recheck().then(draw); else draw(); },
    payload() {
      const out = {};
      if (st.voucher) out.voucher_code = st.voucher.code;
      if (rest() > 0) {
        if (st.split) out.payments = st.rows.filter((r) => r.amount !== '' || r.payer).map((r) => ({ method: r.method, amount: num(r.amount), payer: r.payer }));
        else out.method = st.method;
      } else out.method = 'contanti';
      return out;
    },
    validate() {
      if (!st.split || rest() <= 0) return '';
      const sum = r2(st.rows.reduce((a, r) => a + num(r.amount), 0));
      return Math.abs(sum - rest()) < 0.005 ? '' : `Le quote (${eur(sum)}) devono coincidere con il totale da pagare (${eur(rest())}).`;
    },
    reset() { st.code = ''; st.voucher = null; st.split = false; st.given = ''; st.rows = [{ method: 'contanti', amount: '', payer: '' }, { method: 'carta', amount: '', payer: '' }]; },
  };
}

// ---------- Vista "Buoni" ----------
export async function buoniView(el) {
  let filter = 'attivo';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Buoni</h1><button class="btn btn-primary" id="bv-new">＋ Nuovo buono</button></div>
    <p class="hint">Buoni regalo (credito che si può usare a più riprese) e buoni sconto. In Vendite e alla consegna di una riparazione basta scrivere o leggere il codice.</p>
    <div class="row tight chips-scroll" id="bv-chips"></div>
    <div class="card overflow-hidden" id="bv-list"></div>`;
  const list = $('#bv-list', el);
  async function load() {
    const rows = await safe(() => api('GET', '/api/buoni'));
    if (!rows || !$('#bv-list', el)) return;
    const count = (s) => rows.filter((r) => r.state === s).length;
    $('#bv-chips', el).innerHTML = [['attivo', 'Attivi'], ['', 'Tutti'], ['esaurito', 'Esauriti'], ['scaduto', 'Scaduti'], ['annullato', 'Annullati']]
      .map(([k, l]) => `<span class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${l}<small>${k ? count(k) : rows.length}</small></span>`).join('');
    const shown = rows.filter((r) => !filter || r.state === filter);
    list.innerHTML = shown.map((v) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-id="${v.id}">
      <div class="w-9 h-9 rounded-full bg-secondary-light text-secondary-dark flex items-center justify-center" aria-hidden="true">${KIND_ICON[v.kind]}</div>
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm" style="font-family:monospace">${esc(v.code)}</p>
        <p class="text-xs text-gray-500">${esc(v.kind_label)}${v.expires_at ? ` · scade il ${fdate(v.expires_at)}` : ''}${v.customer_name ? ` · ${esc(v.customer_name)}` : ''}</p></div>
      <div class="text-right"><b>${v.kind === 'regalo' ? `${eur(v.balance)} <span class="hint">di ${eur(v.value)}</span>` : buonoWhat(v)}</b><br><span class="badge ${STATE_BADGE[v.state]}">${v.state}</span></div></div>`).join('') || '<p class="empty">Nessun buono in questo elenco.</p>';
  }
  $('#bv-chips', el).onclick = (e) => { const c = e.target.closest('[data-f]'); if (c) { filter = c.dataset.f; load(); } };
  list.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) openVoucher(Number(r.dataset.id), load); };
  $('#bv-new', el).onclick = () => voucherForm(load);
  await load();
}

async function openVoucher(id, done) {
  const v = await safe(() => api('GET', `/api/buoni/${id}`));
  if (!v) return;
  const m = openModal(
    `<section class="sec"><dl class="kv"><dt>Codice</dt><dd style="font-family:monospace;font-weight:700">${esc(v.code)}</dd><dt>Tipo</dt><dd>${esc(v.kind_label)}</dd>
      <dt>Valore</dt><dd>${v.kind === 'sconto_percentuale' ? `${v.value}%` : eur(v.value)}</dd>${v.kind === 'regalo' ? `<dt>Saldo residuo</dt><dd><b>${eur(v.balance)}</b></dd>` : ''}
      <dt>Stato</dt><dd><span class="badge ${STATE_BADGE[v.state]}">${v.state}</span></dd>${v.expires_at ? `<dt>Scadenza</dt><dd>${fdate(v.expires_at)}</dd>` : ''}${v.customer_name ? `<dt>Cliente</dt><dd>${esc(v.customer_name)}</dd>` : ''}${v.notes ? `<dt>Note</dt><dd>${esc(v.notes)}</dd>` : ''}</dl>
      <div class="row tight"><a class="btn btn-outline btn-sm" target="_blank" href="/print/voucher/${v.id}">🖨️ Stampa il buono</a>
        ${v.state === 'attivo' ? '<button class="btn btn-outline btn-sm" id="bd-void">Annulla il buono</button>' : ''}${v.uses.length ? '' : '<button class="btn btn-ghost btn-sm" id="bd-del">Elimina</button>'}</div></section>
    <section class="sec"><h3 class="sec-t">Utilizzi (${v.uses.length})</h3><div class="plist">${v.uses.map((u) => `<div><span>${esc(u.label || '')}<span class="hint" style="display:block">${fdt(u.created_at)}</span></span><b>−${eur(u.amount)}</b></div>`).join('') || '<p class="hint">Mai usato.</p>'}</div></section>`,
    { title: 'Buono' }
  );
  const v2 = $('#bd-void', m.el);
  if (v2) v2.onclick = async () => {
    if (!(await confirmDelete(v.code, { verb: 'Annullare il buono', detail: 'Il buono non potrà più essere usato.' }))) return;
    if (await safe(() => api('POST', `/api/buoni/${v.id}/annulla`, {}))) { m.close(); toast('Buono annullato'); done?.(); }
  };
  const d = $('#bd-del', m.el);
  if (d) d.onclick = async () => {
    if (!(await confirmDelete(v.code, { typed: 'ELIMINA' }))) return;
    if (await safe(() => api('DELETE', `/api/buoni/${v.id}`))) { m.close(); toast('Buono eliminato'); done?.(); }
  };
}

function voucherForm(done) {
  const m = openModal(
    `<div class="sec"><div class="fgrid c2">
      <div class="field"><label class="l" for="vf-kind">Tipo</label><select id="vf-kind"><option value="regalo">Buono regalo (credito)</option><option value="sconto_importo">Sconto in euro</option><option value="sconto_percentuale">Sconto in percentuale</option></select></div>
      <div class="field"><label class="l" for="vf-val" id="vf-vl">Importo €</label><input id="vf-val" inputmode="decimal" /></div>
      <div class="field"><label class="l" for="vf-exp">Scadenza <span style="font-weight:500;color:var(--muted)">(facoltativa)</span></label><input id="vf-exp" type="date" min="${today()}" /></div>
      <div class="field"><label class="l" for="vf-code">Codice <span style="font-weight:500;color:var(--muted)">(vuoto = automatico)</span></label><input id="vf-code" autocomplete="off" style="text-transform:uppercase" /></div>
      <div class="field span2"><label class="l" for="vf-notes">Note</label><input id="vf-notes" placeholder="Es. regalo di compleanno per Mario" /></div>
    </div><div class="row tight"><button type="button" class="chip" data-exp="90">Scade tra 3 mesi</button><button type="button" class="chip" data-exp="365">Scade tra 1 anno</button></div></div>`,
    { title: 'Nuovo buono', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="vf-ok">Crea il buono</button>' }
  );
  $('#vf-kind', m.el).onchange = (e) => { $('#vf-vl', m.el).textContent = e.target.value === 'sconto_percentuale' ? 'Percentuale %' : 'Importo €'; };
  m.el.addEventListener('click', (e) => { const b = e.target.closest('[data-exp]'); if (b) $('#vf-exp', m.el).value = addDays(Number(b.dataset.exp)); });
  $('#vf-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', '/api/buoni', { kind: $('#vf-kind', m.el).value, value: $('#vf-val', m.el).value, expires_at: $('#vf-exp', m.el).value, code: $('#vf-code', m.el).value, notes: $('#vf-notes', m.el).value }));
    if (!out) return;
    m.close(); toast(`Buono creato: ${out.code}`); done?.();
    if (confirm('Vuoi stampare il buono?')) window.open(`/print/voucher/${out.id}`, '_blank');
  };
}
