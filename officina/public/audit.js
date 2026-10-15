// Registro: chi ha eliminato o modificato cosa e quando. Lo vede solo l'amministratore.
import { $, esc, api, safe, debounce, fdt } from './util.js';

const ACTION = { crea: ['Creato', 'bg-emerald-100 text-emerald-700'], modifica: ['Modificato', 'bg-blue-100 text-blue-700'], elimina: ['Eliminato', 'bg-red-100 text-red-700'] };

export async function auditView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Registro</h1></div>
    <p class="hint" style="margin-bottom:var(--s3,12px)">Chi ha eliminato o modificato clienti, riparazioni, articoli, spese, vendite e impostazioni. Non si può cancellare.</p>
    <div class="fgrid c4">
      <div class="field"><label class="l" for="au-type">Tipo</label><select id="au-type"><option value="">Tutti</option></select></div>
      <div class="field"><label class="l" for="au-user">Utente</label><select id="au-user"><option value="">Tutti</option></select></div>
      <div class="field"><label class="l" for="au-from">Dal</label><input id="au-from" type="date" /></div>
      <div class="field"><label class="l" for="au-to">Al</label><input id="au-to" type="date" /></div>
    </div>
    <input id="au-q" placeholder="Cerca per nome, descrizione o utente…" />
    <div class="card overflow-hidden" id="au-list"></div>
    <div class="row" id="au-pager" style="justify-content:space-between;align-items:center"></div>`;
  let page = 1;
  const list = $('#au-list', el);
  async function load() {
    const qs = new URLSearchParams({ page });
    for (const [k, id] of [['type', 'au-type'], ['user', 'au-user'], ['from', 'au-from'], ['to', 'au-to'], ['q', 'au-q']]) {
      const v = $(`#${id}`, el).value.trim();
      if (v) qs.set(k, v);
    }
    const d = await safe(() => api('GET', `/api/audit?${qs}`));
    if (!d) return;
    const fill = (id, vals) => {
      const s = $(`#${id}`, el);
      if (s.options.length > 1) return;
      s.insertAdjacentHTML('beforeend', vals.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join(''));
    };
    fill('au-type', d.types);
    fill('au-user', d.users);
    list.innerHTML = d.rows.map((r) => {
      const [txt, cls] = ACTION[r.action] || ['Azione', 'bg-gray-100 text-gray-700'];
      return `<div class="px-4 py-3 border-b border-line last:border-0 text-sm">
        <div class="row tight" style="align-items:center;gap:.5rem;flex-wrap:wrap"><span class="badge ${cls}">${txt}</span><b>${esc(r.object_type)}</b>
          <span class="hint">${esc(fdt(r.at))} · ${esc(r.user_email)}</span></div>
        <p style="margin:.25rem 0 0">${esc(r.label || `n. ${r.object_id ?? ''}`)}${r.detail ? ` <span class="hint">— ${esc(r.detail)}</span>` : ''}</p></div>`;
    }).join('') || '<p class="empty">Nessuna voce nel registro.</p>';
    $('#au-pager', el).innerHTML = `<span class="hint">${d.total} voci · pagina ${d.page} di ${d.pages}</span>
      <span class="row tight"><button class="btn btn-outline btn-sm" id="au-prev" ${d.page <= 1 ? 'disabled' : ''}>← Precedenti</button><button class="btn btn-outline btn-sm" id="au-next" ${d.page >= d.pages ? 'disabled' : ''}>Successive →</button></span>`;
    $('#au-prev', el).onclick = () => { page = d.page - 1; load(); };
    $('#au-next', el).onclick = () => { page = d.page + 1; load(); };
  }
  const reload = () => { page = 1; load(); };
  for (const id of ['au-type', 'au-user', 'au-from', 'au-to']) $(`#${id}`, el).onchange = reload;
  $('#au-q', el).oninput = debounce(reload);
  await load();
}
