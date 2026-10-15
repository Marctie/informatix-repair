// Utenti: elenco di chi può entrare nel gestionale. Lo vede e lo modifica solo l'amministratore.
import { $, esc, api, toast, safe, openModal, confirmDelete } from './util.js';

const ROLE = { admin: 'Amministratore', staff: 'Postazione / collaboratore', cassa: 'Cassa (permessi limitati)' };

export async function usersView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Utenti</h1>
      <button class="btn btn-primary" id="u-new">＋ Nuovo utente</button></div>
    <p class="hint" style="margin-bottom:var(--s3,12px)">Entra solo chi è in questo elenco: l’accesso avviene con un codice inviato via email. Le postazioni (Cassa, Laboratorio, Vendite) sono utenti “collaboratore” e usano tutto il gestionale.</p>
    <div class="card overflow-hidden" id="u-list"></div>`;
  const list = $('#u-list', el);
  async function load() {
    const rows = await safe(() => api('GET', '/api/users'));
    list.innerHTML = (rows || []).map((u) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0" data-id="${u.id}">
      <div class="w-9 h-9 rounded-full bg-secondary-light text-secondary-dark flex items-center justify-center font-bold">${esc((u.name || u.email).charAt(0).toUpperCase())}</div>
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(u.name || u.email)}${u.protected ? ' 🔒' : ''}${u.active ? '' : ' <span class="hint">(disattivato)</span>'}</p>
        <p class="text-xs text-gray-500">${esc(u.email)} · ${ROLE[u.role]}</p></div>
      ${u.protected ? '<span class="hint">protetto</span>' : `<button class="btn btn-outline btn-sm" data-edit="${u.id}">Modifica</button>`}</div>`).join('') || '<p class="empty">Nessun utente.</p>';
    list._rows = rows || [];
  }
  $('#u-new', el).onclick = () => editUser(null, load);
  list.onclick = (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) editUser(list._rows.find((u) => u.id === Number(b.dataset.edit)), load);
  };
  await load();
}

function editUser(u, done) {
  const m = openModal(
    `<div class="sec">
      <div class="fgrid">
        <div class="field"><label class="l" for="ue-email">Email *</label><input id="ue-email" type="email" value="${esc(u?.email || '')}" ${u ? 'disabled' : ''} placeholder="nome@esempio.it" /></div>
      </div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="ue-name">Nome</label><input id="ue-name" value="${esc(u?.name || '')}" placeholder="Es. Cassa, Christian" /></div>
        <div class="field"><label class="l" for="ue-role">Ruolo</label>
          <select id="ue-role"><option value="staff" ${u?.role !== 'admin' ? 'selected' : ''}>${ROLE.staff}</option><option value="cassa" ${u?.role === 'cassa' ? 'selected' : ''}>${ROLE.cassa}</option><option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>${ROLE.admin}</option></select></div>
      </div>
      ${u ? `<label class="row tight" style="cursor:pointer"><input type="checkbox" id="ue-active" ${u.active ? 'checked' : ''} /> Può accedere</label>` : ''}
    </div>`,
    { title: u ? 'Modifica utente' : 'Nuovo utente', footer: `${u ? '<button class="btn btn-ghost" id="ue-del">Elimina</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ue-ok">Salva</button>` }
  );
  $('#ue-ok', m.el).onclick = async () => {
    const body = { email: $('#ue-email', m.el).value, name: $('#ue-name', m.el).value, role: $('#ue-role', m.el).value, active: u ? $('#ue-active', m.el).checked : true };
    const out = await safe(() => (u ? api('PUT', `/api/users/${u.id}`, body) : api('POST', '/api/users', body)));
    if (out) { m.close(); toast('Utente salvato'); done?.(); }
  };
  if (u) $('#ue-del', m.el).onclick = async () => {
    if (!(await confirmDelete(u.email, { verb: 'Togliere l’accesso a', typed: 'ELIMINA' }))) return;
    const out = await safe(() => api('DELETE', `/api/users/${u.id}`));
    if (out) { m.close(); toast('Utente eliminato'); done?.(); }
  };
}
