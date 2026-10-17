// Vista admin "Altra attività" (pagamenti appesi): incassi di un'altra azienda di Christian, da fatturare a parte.
// Solo amministratori. Si può correggere, spostare su Informatix Repair, eliminare o aggiungere un incasso: tutto va nel Registro.
import { $, esc, eur, fdate, api, safe, toast, openModal, confirmDelete } from './util.js';
import { hbars, kpi, AN_CSS } from './analytics.js';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const KIND = { sale: 'Vendita', repair: 'Riparazione', altra: 'Incasso diretto' };
const METHODS = ['contanti', 'carta', 'bonifico'];

export async function altraView(el) {
  let from = `${today().slice(0, 8)}01`, to = today();
  el.innerHTML = `${AN_CSS}
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Altra attività</h1><button class="btn btn-primary" id="al-new">＋ Nuovo incasso</button></div>
    <p class="hint">Pagamenti segnati come “appesi”: appartengono all’altra azienda e verranno fatturati da lei. La Cassa li inserisce e poi non li vede più; qui li vedete solo voi, e ogni modifica resta nel Registro.</p>
    <div class="fgrid c2"><div class="field"><label class="l" for="al-from">Dal</label><input id="al-from" type="date" value="${from}" /></div>
      <div class="field"><label class="l" for="al-to">Al</label><input id="al-to" type="date" value="${to}" /></div></div>
    <div id="al-out" data-an></div>`;
  const out = $('#al-out', el);

  async function load() {
    const d = await safe(() => api('GET', `/api/altra?from=${from}&to=${to}`));
    if (!d || !$('#al-out', el)) return;
    out.innerHTML = `<div class="grid grid-cols-2 gap-3">${kpi(eur(d.total), 'Incassato per l’altra attività', 'text-secondary')}${kpi(d.n, d.n === 1 ? 'Pagamento' : 'Pagamenti')}</div>
      <section class="card panel sec"><h3 class="sec-t">Per metodo di pagamento</h3>${hbars(d.by_method, { value: (x) => x.total, label: (x) => x.method, fmt: eur })}</section>
      <section class="card panel sec"><h3 class="sec-t">Pagamenti</h3>${d.rows.length ? d.rows.map((p) => `
        <div class="row" style="justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--line,#e5e7eb);flex-wrap:wrap" data-id="${p.id}">
          <div><b>${eur(p.amount)}</b> · ${esc(p.method)} <span class="hint">· ${fdate(p.created_at)}</span><br>
            <span class="hint">${esc(KIND[p.kind] || p.kind)}${p.ref_code ? ` ${esc(p.ref_code)}` : ''}${p.customer_name ? ` · ${esc(p.customer_name)}` : ''} · ${esc(p.label || '')}</span></div>
          <div class="row tight"><button class="btn btn-outline btn-sm" data-act="edit">Modifica</button><button class="btn btn-outline btn-sm" data-act="move">Riporta su Informatix</button><button class="btn btn-ghost btn-sm" data-act="del">Elimina</button></div>
        </div>`).join('') : '<p class="empty">Nessun pagamento appeso nel periodo.</p>'}</section>`;
    out.querySelectorAll('[data-id]').forEach((row) => {
      const p = d.rows.find((x) => x.id === Number(row.dataset.id));
      row.onclick = async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'edit') return form(p);
        if (act === 'move') { if (await safe(() => api('POST', `/api/altra/payments/${p.id}/move`, { to: 'main' }))) { toast('Riportato su Informatix Repair'); load(); } }
        if (act === 'del' && await confirmDelete(`il pagamento di ${eur(p.amount)}`, { detail: 'Resta scritto nel Registro.' })) {
          if (await safe(() => api('DELETE', `/api/altra/payments/${p.id}`))) { toast('Pagamento eliminato'); load(); }
        }
      };
    });
  }

  function form(p) {
    const m = openModal(`<div class="stack">
      <div class="field"><label class="l" for="af-amount">Importo €</label><input id="af-amount" inputmode="decimal" value="${p ? p.amount : ''}" /></div>
      <div class="field"><label class="l" for="af-method">Metodo</label><select id="af-method">${METHODS.map((x) => `<option ${p?.method === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="af-date">Data</label><input id="af-date" type="date" max="${today()}" value="${p ? String(p.created_at).slice(0, 10) : today()}" /></div>
      <div class="field"><label class="l" for="af-label">Descrizione</label><input id="af-label" maxlength="120" value="${esc(p?.label || '')}" placeholder="Es. Ordine Rossi" /></div></div>`,
    { title: p ? 'Modifica pagamento' : 'Nuovo incasso altra attività', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="af-ok">Salva</button>' });
    $('#af-ok', m.el).onclick = async () => {
      const body = { amount: $('#af-amount', m.el).value, method: $('#af-method', m.el).value, date: $('#af-date', m.el).value, label: $('#af-label', m.el).value };
      const r = await safe(() => (p ? api('PUT', `/api/altra/payments/${p.id}`, body) : api('POST', '/api/altra/payments', body)));
      if (r) { m.close(); toast('Salvato'); load(); }
    };
  }

  $('#al-new', el).onclick = () => form(null);
  $('#al-from', el).onchange = (e) => { from = e.target.value; if (from && to) load(); };
  $('#al-to', el).onchange = (e) => { to = e.target.value; if (from && to) load(); };
  await load();
}
