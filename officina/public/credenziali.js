// Credenziali dei portali dei fornitori (solo amministratore): password cifrate, "Mostra" e "Copia" registrati.
import { $, esc, fdt, api, toast, safe, openModal, confirmDelete, waLink } from './util.js';

export async function credenzialiView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Credenziali fornitori</h1>
      <div class="row tight"><button class="btn btn-outline" id="cr-log">Registro accessi</button><button class="btn btn-primary" id="cr-new">＋ Nuovo accesso</button></div></div>
    <p class="hint">Accessi ai portali dei fornitori: visibili solo all’amministratore. Le password sono cifrate; “Mostra” e “Copia” registrano chi e quando.</p>
    <div id="cr-warn"></div>
    <div class="card overflow-hidden" id="cr-list"></div>`;
  const list = $('#cr-list', el);
  let rows = [];
  let ready = true;
  async function load() {
    const d = await safe(() => api('GET', '/api/credenziali'));
    if (!d || !$('#cr-list', el)) return;
    rows = d.rows; ready = d.vault_ready;
    $('#cr-warn', el).innerHTML = ready ? '' : '<div class="total-box" style="background:#FEF2F2;border:1px solid #FECACA"><span>⚠ La cassaforte non è configurata (manca la chiave VAULT_KEY): non si possono salvare password. Vedi il manuale.</span></div>';
    list.innerHTML = rows.map((c) => `<div class="px-4 py-3 border-b border-line last:border-0" data-id="${c.id}">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div class="min-w-0"><p class="font-semibold text-sm">${esc(c.supplier_name)}${c.label ? ` · ${esc(c.label)}` : ''}</p>
        <p class="text-xs text-gray-500">${c.username ? `Utente: <b>${esc(c.username)}</b>` : 'nessun utente'}${c.pw_changed_at ? ` · password cambiata il ${fdt(c.pw_changed_at)}` : ''}</p>
        ${c.agent_name || c.agent_phone ? `<p class="text-xs text-gray-500">Agente: ${esc(c.agent_name || '')} ${esc(c.agent_phone || '')}</p>` : ''}</div>
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Modifica</button></div>
      <div class="row tight" style="margin-top:.5rem">
        ${c.url ? `<a class="btn btn-outline btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">🌐 Apri il sito</a>` : ''}
        ${c.username ? `<button class="btn btn-outline btn-sm" data-cu="${c.id}">📋 Copia utente</button>` : ''}
        ${c.has_password ? `<button class="btn btn-primary btn-sm" data-cp="${c.id}">📋 Copia password</button><button class="btn btn-outline btn-sm" data-show="${c.id}">👁 Mostra</button><span class="hint" data-pw="${c.id}"></span>` : '<span class="hint">nessuna password salvata</span>'}
        ${c.agent_phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(c.agent_phone)}">📞 Chiama</a><a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${waLink(c.agent_phone, 'Buongiorno ' + (c.agent_name || '') + ',')}">💬 WhatsApp</a>` : ''}</div></div>`).join('') || '<p class="empty">Nessun accesso salvato. Aggiungi il primo con “Nuovo accesso”.</p>';
  }
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };
  list.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) return credForm(rows.find((r) => r.id === Number(b.dataset.edit)), load);
    if (b.dataset.cu) { const c = rows.find((r) => r.id === Number(b.dataset.cu)); return toast((await copy(c.username)) ? 'Utente copiato' : 'Copia non riuscita: selezionalo a mano', true); }
    if (b.dataset.cp || b.dataset.show) {
      const id = Number(b.dataset.cp || b.dataset.show);
      const out = await safe(() => api('POST', `/api/credenziali/${id}/rivela`, { action: b.dataset.cp ? 'copia' : 'mostra' }));
      if (!out) return;
      if (b.dataset.cp) return toast((await copy(out.password)) ? 'Password copiata (accesso registrato)' : 'Copia non riuscita: usa “Mostra”', true);
      const span = $(`[data-pw="${id}"]`, list);
      span.innerHTML = `<code style="user-select:all;font-size:.95rem">${esc(out.password)}</code>`;
      setTimeout(() => { span.textContent = ''; }, 15000); // si nasconde da sola
    }
  };
  $('#cr-new', el).onclick = () => credForm(null, load);
  $('#cr-log', el).onclick = async () => {
    const log = (await safe(() => api('GET', '/api/accessi?area=credenziali'))) || [];
    openModal(`<div class="plist">${log.map((l) => `<div><span>${esc(l.action)} <span class="hint">· ${esc(l.detail || '')}</span><span class="hint" style="display:block">${esc(l.by_user || '')}</span></span><span class="hint">${fdt(l.created_at)}</span></div>`).join('') || '<p class="hint">Ancora nessun accesso.</p>'}</div>`, { title: 'Registro accessi alle credenziali', wide: true });
  };
  await load();
}

async function credForm(c, done) {
  const sup = (await safe(() => api('GET', '/api/suppliers'))) || [];
  if (!sup.length) return toast('Prima aggiungi un fornitore dalla sezione Fornitori', false);
  const m = openModal(
    `<div class="sec"><div class="fgrid c2">
      <div class="field"><label class="l" for="cf-sup">Fornitore *</label><select id="cf-sup" ${c ? 'disabled' : ''}>${sup.map((s) => `<option value="${s.id}" ${c?.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="cf-label">Nome del portale</label><input id="cf-label" value="${esc(c?.label || '')}" placeholder="Es. Area ordini" /></div>
      <div class="field span2"><label class="l" for="cf-url">Sito web</label><input id="cf-url" inputmode="url" value="${esc(c?.url || '')}" placeholder="www.fornitore.it" /></div>
      <div class="field"><label class="l" for="cf-user">Nome utente</label><input id="cf-user" autocomplete="off" value="${esc(c?.username || '')}" /></div>
      <div class="field"><label class="l" for="cf-pw">Password ${c?.has_password ? '<span style="font-weight:500;color:var(--muted)">(vuoto = non cambiare)</span>' : ''}</label><input id="cf-pw" type="password" autocomplete="new-password" /></div>
      <div class="field"><label class="l" for="cf-agent">Agente di riferimento</label><input id="cf-agent" value="${esc(c?.agent_name || '')}" /></div>
      <div class="field"><label class="l" for="cf-phone">Telefono agente</label><input id="cf-phone" inputmode="tel" value="${esc(c?.agent_phone || '')}" /></div>
      <div class="field span2"><label class="l" for="cf-notes">Note</label><input id="cf-notes" value="${esc(c?.notes || '')}" /></div>
    </div></div>`,
    { title: c ? 'Modifica accesso' : 'Nuovo accesso', footer: `${c ? '<button class="btn btn-ghost" id="cf-del">Elimina</button>' : ''}<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="cf-ok">Salva</button>` }
  );
  $('#cf-ok', m.el).onclick = async () => {
    const body = { supplier_id: $('#cf-sup', m.el).value, label: $('#cf-label', m.el).value, url: $('#cf-url', m.el).value, username: $('#cf-user', m.el).value, password: $('#cf-pw', m.el).value,
      agent_name: $('#cf-agent', m.el).value, agent_phone: $('#cf-phone', m.el).value, notes: $('#cf-notes', m.el).value };
    const out = await safe(() => (c ? api('PUT', `/api/credenziali/${c.id}`, body) : api('POST', '/api/credenziali', body)));
    if (out) { m.close(); toast('Accesso salvato'); done?.(); }
  };
  if (c) $('#cf-del', m.el).onclick = async () => {
    if (!(await confirmDelete(`${c.supplier_name}${c.label ? ' · ' + c.label : ''}`, { typed: 'ELIMINA' }))) return;
    if (await safe(() => api('DELETE', `/api/credenziali/${c.id}`))) { m.close(); toast('Accesso eliminato'); done?.(); }
  };
}
