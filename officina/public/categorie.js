// Categorie del magazzino: crea, rinomina (o unisci) ed elimina. Le categorie usate compaiono anche nei suggerimenti di articoli e carico.
import { $, esc, api, toast, safe, openModal, confirmDelete } from './util.js';

export const STD_CATEGORIES = ['Ricambi', 'Accessori', 'Cavi e caricatori', 'Usato / ricondizionato', 'Software e servizi', 'Altro'];

/** Nomi delle categorie per i suggerimenti dei campi (se il server non risponde: l'elenco standard). */
export async function categoryNames() {
  const rows = await safe(() => api('GET', '/api/categories'));
  return rows?.length ? rows.map((c) => c.name) : STD_CATEGORIES;
}

export async function categorieView(el) {
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Categorie</h1>
    <button class="btn btn-primary" id="ct-new">＋ Nuova categoria</button></div>
    <p class="hint">Le categorie servono a ordinare gli articoli del Magazzino. Per unire due categorie, rinomina una con il nome dell’altra: gli articoli passano lì.</p>
    <div class="card overflow-hidden" id="ct-list"></div>`;
  const list = $('#ct-list', el);
  let rows = [];
  async function load() {
    rows = (await safe(() => api('GET', '/api/categories'))) || [];
    list.innerHTML = rows.map((c, i) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm">${esc(c.name)}</p><p class="text-xs text-gray-500">${c.count} articoli</p></div>
      <button class="btn btn-outline btn-sm" data-ren="${i}">Rinomina</button>
      <button class="btn btn-ghost btn-sm" data-del="${i}" ${c.count ? 'disabled title="Ha ancora articoli: rinominala per unirla a un’altra"' : ''}>Elimina</button></div>`).join('') || '<p class="empty">Nessuna categoria.</p>';
  }
  function nameDialog(title, value, onOk) {
    const m = openModal(`<section class="sec"><div class="field"><label class="l" for="ct-name">Nome *</label><input id="ct-name" maxlength="40" value="${esc(value)}" /></div></section>`,
      { title, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ct-ok">Salva</button>' });
    const inp = $('#ct-name', m.el);
    inp.focus(); inp.select();
    const go = async () => { if (await onOk(inp.value)) m.close(); };
    $('#ct-ok', m.el).onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }
  $('#ct-new', el).onclick = () => nameDialog('Nuova categoria', '', async (name) => {
    const out = await safe(() => api('POST', '/api/categories', { name }));
    if (out) { toast('Categoria creata'); await load(); }
    return !!out;
  });
  list.onclick = (e) => {
    const r = e.target.closest('[data-ren]'); const d = e.target.closest('[data-del]');
    if (r) {
      const c = rows[Number(r.dataset.ren)];
      nameDialog('Rinomina categoria', c.name, async (name) => {
        const out = await safe(() => api('PUT', '/api/categories', { name: c.name, new_name: name }));
        if (out) { toast('Categoria aggiornata'); await load(); }
        return !!out;
      });
    } else if (d && !d.disabled) {
      const c = rows[Number(d.dataset.del)];
      confirmDelete(`la categoria “${c.name}”`).then(async (ok) => {
        if (!ok) return;
        if (await safe(() => api('DELETE', `/api/categories?name=${encodeURIComponent(c.name)}`))) { toast('Categoria eliminata'); await load(); }
      });
    }
  };
  await load();
}
