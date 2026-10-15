// Archivio fatture: emesse (ai clienti) e ricevute (dai fornitori), anche passate.
// Stati: da pagare / pagata in parte / non pagata (scaduta) / pagata / stornata (nota di credito). Pagamenti con metodo e data, mai nascosti.
import { $, esc, eur, fdate, api, toast, safe, debounce, openModal, confirmDelete, today, addDays, META } from './util.js';
import { archCss, n2, inVal, kpiTile, csvLink, periods, methodOptions } from './arch-ui.js';
import { customerField, bindCustomer } from './pickers.js';

const ST = {
  da_pagare: ['Da pagare', 'bg-blue-100 text-blue-700'], parziale: ['Pagata in parte', 'bg-amber-100 text-amber-800'], scaduta: ['Non pagata · scaduta', 'bg-red-100 text-red-700'],
  pagata: ['Pagata', 'bg-emerald-100 text-emerald-700'], stornata: ['Stornata', 'bg-gray-200 text-gray-700'], nota_credito: ['Nota di credito', 'bg-purple-100 text-purple-700'],
};
const stBadge = (r) => `<span class="badge ${ST[r.status][1]}">${ST[r.status][0]}</span>${r.overdue && r.status !== 'scaduta' ? `<span class="badge bg-red-100 text-red-700">scaduta da ${r.days_late} gg</span>` : ''}`;
const isAdmin = () => META.role === 'admin';
const isCassa = () => META.role === 'cassa';

export async function fattureView(el, params) {
  archCss();
  const P = periods();
  let dir = isCassa() ? 'emessa' : (params.get('dir') || 'emessa');
  let st = params.get('stato') || '';
  let per = 'tutto'; let from = ''; let to = '';
  let q = '';
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Archivio fatture</h1>
      <div class="row"><button class="btn btn-outline" id="fa-csv">⬇ Scarica CSV</button><button class="btn btn-primary" id="fa-new">＋ Nuova fattura</button></div></div>
    <div class="flex gap-2 flex-wrap chips-scroll" id="fa-dir"></div>
    <div class="flex gap-2 flex-wrap chips-scroll" id="fa-st"></div>
    <div class="fgrid c3" style="align-items:end">
      <div class="field"><label class="l" for="fa-from">Emessa dal</label><input type="date" id="fa-from" /></div>
      <div class="field"><label class="l" for="fa-to">al</label><input type="date" id="fa-to" /></div>
      <div class="field"><label class="l" for="fa-q">Cerca (numero, cliente/fornitore, note)</label><input id="fa-q" type="search" /></div>
    </div>
    <div class="flex gap-2 flex-wrap chips-scroll" id="fa-per"></div>
    <div id="fa-out" class="sec"></div>`;
  const qs = (withStatus = true) => new URLSearchParams({ ...(dir ? { direction: dir } : {}), ...(withStatus && st ? { status: st } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q ? { q } : {}) });
  const drawChips = () => {
    $('#fa-dir', el).innerHTML = [['emessa', 'Emesse (ai clienti)'], ['ricevuta', 'Ricevute (dai fornitori)'], ['', 'Tutte']].filter(([k]) => !isCassa() || k === 'emessa').map(([k, l]) => `<span class="chip ${dir === k ? 'on' : ''}" data-d="${k}">${l}</span>`).join('');
    $('#fa-st', el).innerHTML = [['', 'Tutti gli stati'], ['aperte', 'Da saldare'], ['da_pagare', 'Da pagare'], ['parziale', 'In parte'], ['scadute', 'Scadute'], ['pagata', 'Pagate'], ['stornata', 'Stornate'], ['nota_credito', 'Note di credito']].map(([k, l]) => `<span class="chip ${st === k ? 'on' : ''}" data-s="${k}">${l}</span>`).join('');
    $('#fa-per', el).innerHTML = P.map(([k, l]) => `<span class="chip ${per === k ? 'on' : ''}" data-p="${k}">${l}</span>`).join('');
    $('#fa-from', el).value = from; $('#fa-to', el).value = to;
  };
  async function load() {
    drawChips();
    const d = await safe(() => api('GET', `/api/invoices?${qs()}`));
    const out = $('#fa-out', el);
    if (!d || !out) return;
    const tt = (k) => d.totals[k];
    const dirs = dir ? [dir] : ['emessa', 'ricevuta'];
    const blocks = dirs.map((k) => {
      const t = tt(k);
      const e = k === 'emessa';
      return `${dirs.length > 1 ? `<h2 class="sec-t">${e ? 'Emesse' : 'Ricevute'}</h2>` : ''}<div class="ar-kpis k5">
        ${kpiTile(t.n, t.n === 1 ? 'Fattura' : 'Fatture')}${kpiTile(eur(t.net), `Totale${t.credited ? ' (note di credito tolte)' : ''}`)}${kpiTile(eur(t.paid), e ? 'Incassato' : 'Pagato', 'text-emerald-600')}
        ${kpiTile(eur(t.open), e ? 'Da incassare' : 'Da pagare', t.open ? 'text-amber-600' : '')}${kpiTile(eur(t.overdue), `Scadute${t.overdue_n ? ` (${t.overdue_n})` : ''}`, t.overdue ? 'text-red-600' : '')}</div>
        ${t.refund_due ? `<div class="ar-alert warn">Da restituire: <b>${eur(t.refund_due)}</b> (fatture pagate e poi stornate con nota di credito).</div>` : ''}`;
    }).join('');
    const unl = d.unlinked_purchases || [];
    out.innerHTML = `${blocks}
      ${unl.length ? `<section class="card panel sec"><h2 class="sec-t">Acquisti importati non ancora in archivio (${unl.length})</h2><p class="sec-sub">Fatture dei fornitori già lette dall’import: aggiungile all’archivio per seguire scadenze e pagamenti.</p>
        <div class="plist">${unl.slice(0, 15).map((p) => `<div><span>${esc(p.supplier_name)} · ${esc(p.doc_number)} <span class="hint">${fdate(p.doc_date)}</span></span><span><b>${eur(p.total)}</b><button class="btn btn-outline btn-sm" data-frompur="${p.id}">＋ In archivio</button></span></div>`).join('')}</div>
        ${unl.length > 15 ? `<p class="hint">…e altri ${unl.length - 15}.</p>` : ''}</section>` : ''}
      <div class="card overflow-hidden">${d.rows.map((r) => `<div class="ar-row" data-id="${r.id}">
        <div class="main"><span class="t">${esc(r.doc_type === 'nota_credito' ? 'NC ' : '')}${esc(r.number)} · ${esc(r.party)} ${!dir ? `<span class="badge bg-gray-100 text-gray-700">${r.direction === 'emessa' ? 'emessa' : 'ricevuta'}</span>` : ''}</span>
          <span class="s">${fdate(r.issue_date)}${r.due_date ? ` · scade ${fdate(r.due_date)}` : ''}${r.credit_for_number ? ` · storna ${esc(r.credit_for_number)}` : ''}${r.paid && r.doc_type === 'fattura' ? ` · pagato ${eur(r.paid)}` : ''}${r.credited && r.doc_type === 'fattura' ? ` · stornato ${eur(r.credited)}` : ''}</span></div>
        <div class="side"><b>${r.doc_type === 'nota_credito' ? '−' : ''}${eur(r.total)}</b><span class="row tight" style="justify-content:flex-end">${stBadge(r)}</span>${r.open > 0 && r.status !== 'da_pagare' ? `<span class="hint">residuo ${eur(r.open)}</span>` : ''}</div></div>`).join('') || '<p class="empty">Nessuna fattura con questi filtri. Con “Nuova fattura” puoi caricare anche quelle passate.</p>'}</div>`;
  }
  $('#fa-dir', el).onclick = (e) => { const c = e.target.closest('[data-d]'); if (c) { dir = c.dataset.d; load(); } };
  $('#fa-st', el).onclick = (e) => { const c = e.target.closest('[data-s]'); if (c) { st = c.dataset.s; load(); } };
  $('#fa-per', el).onclick = (e) => { const c = e.target.closest('[data-p]'); if (!c) return; const p = P.find((x) => x[0] === c.dataset.p); per = p[0]; from = p[2]; to = p[3]; load(); };
  const custom = () => { per = ''; from = $('#fa-from', el).value; to = $('#fa-to', el).value; load(); };
  $('#fa-from', el).onchange = custom; $('#fa-to', el).onchange = custom;
  $('#fa-q', el).oninput = debounce((e) => { q = e.target.value.trim(); load(); });
  $('#fa-csv', el).onclick = () => csvLink(`/api/invoices/export.csv?${qs()}`);
  $('#fa-new', el).onclick = () => invoiceForm(null, { direction: dir || 'emessa' }, load);
  $('#fa-out', el).onclick = async (e) => {
    const fp = e.target.closest('[data-frompur]');
    if (fp) { e.stopPropagation(); const r = await safe(() => api('POST', `/api/invoices/from-purchase/${fp.dataset.frompur}`, {})); if (r) { toast('Aggiunta all’archivio: controlla la scadenza'); load(); openInvoice(r.id, load); } return; }
    const r = e.target.closest('[data-id]'); if (r) openInvoice(Number(r.dataset.id), load);
  };
  await load();
}

/** Scheda di una fattura: dati, pagamenti, note di credito e azioni. */
export async function openInvoice(id, done) {
  const i = await safe(() => api('GET', `/api/invoices/${id}`));
  if (!i) return;
  const e = i.direction === 'emessa';
  const nc = i.doc_type === 'nota_credito';
  const canPay = !nc && i.status !== 'stornata' && i.open > 0.005;
  const m = openModal(`<section class="sec">
      <div class="row tight">${stBadge(i)}${i.retro ? '<span class="badge bg-blue-100 text-blue-700">caricata come passata</span>' : ''}</div>
      <dl class="kv"><dt>${e ? 'Cliente' : 'Fornitore'}</dt><dd><b>${esc(i.party)}</b></dd>
        <dt>Data</dt><dd>${fdate(i.issue_date)}</dd>${i.due_date ? `<dt>Scadenza</dt><dd>${fdate(i.due_date)}${i.overdue ? ` <b style="color:var(--red)">· in ritardo di ${i.days_late} giorni</b>` : ''}</dd>` : ''}
        <dt>Totale</dt><dd><b>${eur(i.total)}</b>${i.vat ? ` <span class="hint">di cui IVA ${eur(i.vat)}</span>` : ''}</dd>
        ${nc ? `<dt>Storna</dt><dd>${i.credit_for_number ? `fattura ${esc(i.credit_for_number)}` : 'nessuna fattura collegata'}</dd>` : `<dt>Pagato</dt><dd>${eur(i.paid)}</dd>${i.credited ? `<dt>Stornato</dt><dd>${eur(i.credited)}</dd>` : ''}<dt>Residuo</dt><dd><b>${eur(i.open)}</b></dd>`}
        ${i.sale ? `<dt>Vendita</dt><dd>${esc(i.sale.code)} · ${eur(i.sale.total)}</dd>` : ''}${i.repair ? `<dt>Riparazione</dt><dd>${esc(i.repair.code)} · ${esc(i.repair.brand_model)}</dd>` : ''}${i.purchase ? `<dt>Acquisto</dt><dd>${esc(i.purchase.doc_number)} del ${fdate(i.purchase.doc_date)}</dd>` : ''}
        ${i.notes ? `<dt>Note</dt><dd>${esc(i.notes)}</dd>` : ''}</dl>
      ${i.refund_due ? `<div class="ar-alert warn">Pagata e poi stornata: <b>${eur(i.refund_due)}</b> da ${e ? 'restituire al cliente' : 'farsi restituire dal fornitore'}.</div>` : ''}
    </section>
    ${nc ? '' : `<section class="sec"><h3 class="sec-t">${e ? 'Incassi' : 'Pagamenti'} (${i.payments.length})</h3>
      <div class="plist">${i.payments.map((p) => `<div><span>${fdate(p.paid_on)} · ${esc(p.method)}${p.note ? ` <span class="hint">· ${esc(p.note)}</span>` : ''}${p.payment_id ? ' <span class="hint">· in cassa</span>' : ''}${p.expense_id ? ' <span class="hint">· tra le spese</span>' : ''}</span><span><b>${eur(p.amount)}</b>${isAdmin() ? `<button class="xbtn" data-delpay="${p.id}" aria-label="Elimina pagamento">✕</button>` : ''}</span></div>`).join('') || '<p class="hint">Nessun pagamento registrato.</p>'}</div>
      ${canPay ? `<div class="sec" id="ip-form"><div class="fgrid c2">
        <div class="field"><label class="l" for="ip-amt">Importo (€)</label><input id="ip-amt" inputmode="decimal" value="${inVal(i.open)}" /></div>
        <div class="field"><label class="l" for="ip-date">Data del ${e ? 'incasso' : 'pagamento'}</label><input id="ip-date" type="date" max="${today()}" min="${i.issue_date}" value="${today()}" /></div>
        <div class="field"><label class="l" for="ip-m">Metodo</label><select id="ip-m">${methodOptions()}</select></div>
        <div class="field"><label class="l" for="ip-note">Nota</label><input id="ip-note" placeholder="facoltativa" /></div></div>
        ${e ? '<p class="hint">L’incasso entra anche in Cassa, nel giorno indicato.</p>' : '<label class="row tight" style="cursor:pointer"><input type="checkbox" id="ip-exp" style="width:auto"> <span class="text-sm">Registra anche tra le Spese</span></label>'}
        <div><button class="btn btn-primary" id="ip-go">${e ? 'Registra incasso' : 'Registra pagamento'}</button></div></div>` : ''}</section>
    ${i.credit_notes.length ? `<section class="sec"><h3 class="sec-t">Note di credito</h3><div class="plist">${i.credit_notes.map((n) => `<div><span class="ar-link" data-nc="${n.id}" style="cursor:pointer;text-decoration:underline">${esc(n.number)} <span class="hint">${fdate(n.issue_date)}</span></span><b>−${eur(n.total)}</b></div>`).join('')}</div></section>` : ''}`}
    <section class="sec"><div class="row">
      <button class="btn btn-outline btn-sm" id="iv-edit">Modifica</button>
      ${!nc && i.status !== 'stornata' ? '<button class="btn btn-outline btn-sm" id="iv-nc">↩ Nota di credito</button>' : ''}
      ${isAdmin() ? '<button class="btn btn-ghost btn-sm" id="iv-del">Elimina</button>' : ''}</div></section>`,
    { title: `${nc ? 'Nota di credito' : 'Fattura'} ${i.number}`, wide: true });
  const reload = () => { m.close(); done?.(); openInvoice(id, done); };
  if ($('#ip-go', m.el)) $('#ip-go', m.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/invoices/${id}/payments`, { amount: $('#ip-amt', m.el).value, paid_on: $('#ip-date', m.el).value, method: $('#ip-m', m.el).value, note: $('#ip-note', m.el).value, as_expense: !!$('#ip-exp', m.el)?.checked }));
    if (out) { toast(e ? 'Incasso registrato' : 'Pagamento registrato'); reload(); }
  };
  m.el.addEventListener('click', async (ev) => {
    const dp = ev.target.closest('[data-delpay]');
    if (dp) {
      if (!(await confirmDelete('questo pagamento', { detail: 'Viene tolto anche dalla Cassa/Spese se era stato registrato lì. Resta nel Registro.' }))) return;
      if (await safe(() => api('DELETE', `/api/invoices/${id}/payments/${dp.dataset.delpay}`))) { toast('Pagamento eliminato'); reload(); }
    }
    const n = ev.target.closest('[data-nc]');
    if (n) { m.close(); openInvoice(Number(n.dataset.nc), done); }
  });
  $('#iv-edit', m.el).onclick = () => { m.close(); invoiceForm(i, {}, () => { done?.(); openInvoice(id, done); }); };
  if ($('#iv-nc', m.el)) $('#iv-nc', m.el).onclick = () => { m.close(); invoiceForm(null, { direction: i.direction, doc_type: 'nota_credito', credit_for: i }, () => { done?.(); openInvoice(id, done); }); };
  if ($('#iv-del', m.el)) $('#iv-del', m.el).onclick = async () => {
    if (!(await confirmDelete(`${nc ? 'la nota di credito' : 'la fattura'} ${i.number}`, { detail: 'Resta traccia nel Registro.' }))) return;
    if (await safe(() => api('DELETE', `/api/invoices/${id}`))) { toast('Eliminata'); m.close(); done?.(); }
  };
}

/** Modulo nuova/modifica fattura. inv = fattura da modificare; pre = valori iniziali (direction, doc_type, credit_for). */
async function invoiceForm(inv, pre, done) {
  const edit = !!inv;
  let direction = inv?.direction || pre.direction || 'emessa';
  const nc = (inv?.doc_type || pre.doc_type) === 'nota_credito';
  const cf = pre.credit_for || null;
  const suppliers = direction === 'ricevuta' && !isCassa() ? (await safe(() => api('GET', '/api/suppliers'))) || [] : [];
  const issue0 = inv?.issue_date || today();
  const m = openModal(`<div class="sec">
    ${edit ? '' : `<div class="flex gap-2 flex-wrap" id="if-dir">${isCassa() ? '' : `<span class="chip ${direction === 'emessa' ? 'on' : ''}" data-d="emessa">Emessa (a un cliente)</span><span class="chip ${direction === 'ricevuta' ? 'on' : ''}" data-d="ricevuta">Ricevuta (da un fornitore)</span>`}</div>`}
    <div class="fgrid c3">
      <div class="field"><label class="l" for="if-num">Numero ${nc ? 'nota di credito' : 'fattura'} *</label><input id="if-num" value="${esc(inv?.number || '')}" placeholder="es. 24/2026" /></div>
      <div class="field"><label class="l" for="if-date">Data ${nc ? 'documento' : 'fattura'} *</label><input id="if-date" type="date" max="${today()}" value="${issue0}" /><span class="hint" id="if-datehint"></span></div>
      ${nc ? '<div></div>' : `<div class="field"><label class="l" for="if-due">Scadenza</label><input id="if-due" type="date" value="${inv?.due_date || addDaysStr(issue0, 30)}" /><span class="hint">Di solito 30 giorni dalla data.</span></div>`}
    </div>
    <div id="if-party"></div>
    <div class="fgrid c3">
      <div class="field"><label class="l" for="if-total">Totale (€) *</label><input id="if-total" inputmode="decimal" value="${inv ? inVal(inv.total) : ''}" placeholder="0,00" /></div>
      <div class="field"><label class="l" for="if-vat">di cui IVA (€)</label><input id="if-vat" inputmode="decimal" value="${inv ? inVal(inv.vat) : ''}" placeholder="0,00" /></div>
      ${nc ? `<div class="field"><label class="l" for="if-cf">Fattura che storna</label><select id="if-cf"><option value="">— nessuna —</option>${cf ? `<option value="${cf.id}" selected>${esc(cf.number)} · ${eur(cf.total)}</option>` : ''}</select></div>` : '<div></div>'}
    </div>
    <div id="if-links"></div>
    <div class="field"><label class="l" for="if-notes">Note</label><textarea id="if-notes" rows="2" placeholder="facoltative">${esc(inv?.notes || '')}</textarea></div>
    ${edit || nc ? '' : '<p class="hint">Dopo aver salvato potrai registrare gli incassi/pagamenti, anche con date passate.</p>'}
  </div>`, { title: edit ? `Modifica ${inv.number}` : nc ? 'Nuova nota di credito' : 'Nuova fattura', wide: true, full: true,
    footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="if-save">Salva</button>' });
  const g = (s) => $(s, m.el);
  let cust = null;
  const drawParty = async () => {
    const box = g('#if-party');
    if (direction === 'emessa') {
      box.innerHTML = `${customerField('if-cust', 'Cliente', { required: false })}<div class="field"><label class="l" for="if-pname">…oppure intestatario scritto a mano</label><input id="if-pname" value="${esc(inv && !inv.customer_id ? inv.party_name || '' : '')}" placeholder="solo se non è in anagrafica" /></div>`;
      cust = bindCustomer(box, 'if-cust', inv?.customer_id || cf?.customer_id || null);
    } else {
      box.innerHTML = `<div class="field"><label class="l" for="if-sup">Fornitore</label><select id="if-sup"><option value="">— scegli —</option>${suppliers.map((s) => `<option value="${s.id}" ${inv?.supplier_id === s.id || cf?.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="l" for="if-pname">…oppure nome scritto a mano</label><input id="if-pname" value="${esc(inv && !inv.supplier_id ? inv.party_name || '' : '')}" placeholder="solo se non è tra i fornitori" /></div>`;
    }
    drawLinks();
  };
  async function drawLinks() {
    const box = g('#if-links');
    if (nc || direction !== 'emessa') { box.innerHTML = ''; return; }
    const cid = cust?.value();
    const c = cid ? await safe(() => api('GET', `/api/customers/${cid}`)) : null;
    if (!g('#if-links')) return;
    box.innerHTML = c ? `<div class="fgrid c2"><div class="field"><label class="l" for="if-sale">Vendita collegata <span style="font-weight:500;color:var(--muted)">(facoltativa)</span></label><select id="if-sale"><option value="">— nessuna —</option>${c.sales.map((s) => `<option value="${s.id}" ${inv?.sale_id === s.id ? 'selected' : ''}>${esc(s.code)} · ${eur(s.total)} · ${fdate(s.created_at)}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="if-rep">Riparazione collegata <span style="font-weight:500;color:var(--muted)">(facoltativa)</span></label><select id="if-rep"><option value="">— nessuna —</option>${c.repairs.map((r) => `<option value="${r.id}" ${inv?.repair_id === r.id ? 'selected' : ''}>${esc(r.code)} · ${esc(r.brand_model)}</option>`).join('')}</select></div>
      <p class="hint span2" style="grid-column:1/-1">Se la vendita/riparazione è già stata incassata in cassa, gli incassi vengono solo collegati alla fattura (non si incassa due volte).</p></div>` : '';
  }
  await drawParty();
  if (!edit) $('#if-dir', m.el)?.addEventListener('click', async (ev) => {
    const c = ev.target.closest('[data-d]'); if (!c || c.dataset.d === direction) return;
    direction = c.dataset.d;
    if (direction === 'ricevuta' && !suppliers.length) suppliers.push(...((await safe(() => api('GET', '/api/suppliers'))) || []));
    m.el.querySelectorAll('#if-dir .chip').forEach((x) => x.classList.toggle('on', x.dataset.d === direction));
    drawParty();
  });
  g('#if-party').addEventListener('change', (ev) => { if (ev.target.id === 'if-cust') drawLinks(); });
  g('#if-date').onchange = () => {
    const d = g('#if-date').value;
    g('#if-datehint').textContent = d && d < today() ? 'Fattura passata: va benissimo, resta segnata come tale.' : '';
    if (g('#if-due') && !edit) g('#if-due').value = d ? addDaysStr(d, 30) : '';
  };
  g('#if-date').onchange();
  // note di credito: elenco delle fatture stornabili (stesso tipo)
  if (nc && !cf) safe(() => api('GET', `/api/invoices?direction=${direction}&status=aperte`)).then((d) => {
    const sel = g('#if-cf'); if (!sel || !d) return;
    sel.insertAdjacentHTML('beforeend', d.rows.filter((r) => r.doc_type === 'fattura').map((r) => `<option value="${r.id}" ${inv?.credit_for_id === r.id ? 'selected' : ''}>${esc(r.number)} · ${esc(r.party)} · ${eur(r.total)}</option>`).join(''));
  });
  g('#if-save').onclick = async () => {
    const body = { direction, doc_type: nc ? 'nota_credito' : 'fattura', number: g('#if-num').value, issue_date: g('#if-date').value, total: g('#if-total').value, vat: g('#if-vat').value, notes: g('#if-notes').value };
    if (g('#if-due')) body.due_date = g('#if-due').value;
    if (g('#if-cf')) body.credit_for_id = g('#if-cf').value || null;
    if (direction === 'emessa') { body.customer_id = cust?.value() || null; body.party_name = g('#if-pname')?.value; body.sale_id = g('#if-sale')?.value || null; body.repair_id = g('#if-rep')?.value || null; }
    else { body.supplier_id = g('#if-sup')?.value || null; body.party_name = g('#if-pname')?.value; }
    const out = await safe(() => (edit ? api('PUT', `/api/invoices/${inv.id}`, body) : api('POST', '/api/invoices', body)));
    if (!out) return;
    m.close(); toast(edit ? 'Fattura aggiornata' : 'Fattura salvata'); done?.();
    if (!edit && !nc) openInvoice(out.id, done);
  };
}

function addDaysStr(d, n) { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
void n2; void addDays;
