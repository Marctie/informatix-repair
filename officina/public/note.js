// Note libere stile Keep, condivise tra gli utenti: note rapide, colori, fissate in alto, elenchi con caselle, archivio, ricerca.
import { $, $$, esc, fdate, api, toast, safe, debounce, openModal, confirmDelete } from './util.js';
import { resizePhoto } from './usati.js';

let COLORS = null;
const dots = (cur, attr = 'data-c') => Object.entries(COLORS).map(([k, n]) => `<button type="button" class="cdot nc-${k} ${cur === k ? 'on' : ''}" ${attr}="${k}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('');

function noteCard(n) {
  const open = n.items.filter((i) => !i.d);
  const done = n.items.filter((i) => i.d);
  const checks = (arr) => arr.map((i) => `<label class="${i.d ? 'd' : ''}"><input type="checkbox" data-nid="${n.id}" data-idx="${n.items.indexOf(i)}" ${i.d ? 'checked' : ''} /><span>${esc(i.t)}</span></label>`).join('');
  return `<article class="note nc-${n.color} ${n.pinned ? 'pin' : ''}" data-id="${n.id}" tabindex="0" aria-label="Nota ${esc(n.title || '')}">
    ${n.photo_count ? `<div class="nphotos">${Array.from({ length: n.photo_count }, (_, i) => `<img src="/api/note/${n.id}/photo/${i}" alt="Foto ${i + 1} della nota" loading="lazy" />`).join('')}</div>` : ''}
    ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}${n.body ? `<div class="nb">${esc(n.body)}</div>` : ''}
    ${n.items.length ? `<div class="nitems">${checks(open)}${done.length ? `<div class="hint" style="margin:.25rem 0 0">${done.length} fatt${done.length === 1 ? 'a' : 'e'}</div>${checks(done)}` : ''}</div>` : ''}
    <div class="nfoot"><span>${fdate(n.updated_at)}${n.created_by && n.created_by !== 'locale' ? ` · ${esc(n.created_by.split('@')[0])}` : ''}</span>
      <span class="nact"><button data-act="pin" title="${n.pinned ? 'Togli da fissate' : 'Fissa in alto'}">${n.pinned ? 'Sblocca' : 'Fissa'}</button><button data-act="arch" title="${n.archived ? 'Ripristina' : 'Archivia'}">${n.archived ? 'Ripristina' : 'Archivia'}</button><button data-act="del" title="Elimina">Elimina</button></span></div></article>`;
}

export async function noteView(el) {
  const meta = await safe(() => api('GET', '/api/note/meta'));
  if (!meta) return;
  COLORS = meta.colors;
  const S = { q: '', color: '', archivio: false };
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Note</h1>
      <button class="btn btn-primary" id="nt-new">＋ Nota completa</button></div>
    <p class="hint">Appunti liberi per tutto il negozio, visibili a tutti gli utenti: scrivi e premi Invio per una nota rapida, oppure apri la nota completa per titolo, colore ed elenchi con le caselle da spuntare. Le note fissate restano in alto.</p>
    <div class="row nowrap"><input id="nt-quick" placeholder="Scrivi una nota rapida e premi Invio…" aria-label="Nota rapida" /><button class="btn btn-outline" id="nt-add">Aggiungi</button></div>
    <div class="row tight chips-scroll" id="nt-chips"></div>
    <input id="nt-q" type="search" placeholder="Cerca nelle note…" aria-label="Cerca nelle note" />
    <div id="nt-list"></div>`;
  const list = $('#nt-list', el);
  let notes = {};
  async function load() {
    const d = await safe(() => api('GET', `/api/note?q=${encodeURIComponent(S.q)}${S.color ? `&color=${S.color}` : ''}${S.archivio ? '&archivio=1' : ''}`));
    if (!d || !$('#nt-list', el)) return;
    notes = Object.fromEntries(d.rows.map((n) => [n.id, n]));
    $('#nt-chips', el).innerHTML = `<span class="chip ${!S.archivio ? 'on' : ''}" data-arch="0">Note</span><span class="chip ${S.archivio ? "on" : ""}" data-arch="1">Archivio${d.archived ? `<small>${d.archived}</small>` : ''}</span>` +
      `<span class="cdots" style="margin-left:.5rem">${Object.keys(COLORS).map((k) => `<button type="button" class="cdot nc-${k} ${S.color === k ? 'on' : ''}" data-fc="${k}" title="Solo ${esc(COLORS[k])}" aria-label="Solo ${esc(COLORS[k])}"></button>`).join('')}</span>`;
    if (!d.rows.length) { list.innerHTML = `<p class="empty card">${S.q || S.color ? 'Nessuna nota trovata.' : S.archivio ? 'Archivio vuoto.' : 'Nessuna nota: scrivine una qui sopra.'}</p>`; return; }
    const pinned = d.rows.filter((n) => n.pinned);
    const rest = d.rows.filter((n) => !n.pinned);
    list.innerHTML = (pinned.length ? `<h2 class="sec-t" style="margin-bottom:.85rem">Fissate</h2><div class="notes-grid">${pinned.map(noteCard).join('')}</div>` : '') +
      (rest.length ? `${pinned.length ? '<h2 class="sec-t" style="margin:.4rem 0 .85rem">Altre</h2>' : ''}<div class="notes-grid">${rest.map(noteCard).join('')}</div>` : '');
  }
  const quick = async () => {
    const i = $('#nt-quick', el);
    const text = i.value.trim();
    if (!text) return;
    if (await safe(() => api('POST', '/api/note', { body: text }))) { i.value = ''; load(); }
  };
  $('#nt-quick', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quick(); } });
  $('#nt-add', el).onclick = quick;
  $('#nt-new', el).onclick = () => noteEditor(null, load);
  $('#nt-q', el).oninput = debounce((e) => { S.q = e.target.value.trim(); load(); });
  $('#nt-chips', el).onclick = (e) => {
    const a = e.target.closest('[data-arch]');
    const c = e.target.closest('[data-fc]');
    if (a) { S.archivio = a.dataset.arch === '1'; load(); }
    if (c) { S.color = S.color === c.dataset.fc ? '' : c.dataset.fc; load(); }
  };
  list.addEventListener('change', async (e) => { // casella spuntata direttamente sulla nota
    const cb = e.target.closest('input[data-nid]');
    if (!cb) return;
    const n = notes[cb.dataset.nid];
    const items = n.items.map((i, k) => (k === Number(cb.dataset.idx) ? { ...i, d: cb.checked ? 1 : 0 } : i));
    if (await safe(() => api('PUT', `/api/note/${n.id}`, { items }))) load();
  });
  list.addEventListener('click', async (e) => {
    if (e.target.closest('input[data-nid]') || e.target.closest('label')) return;
    const card = e.target.closest('.note');
    if (!card) return;
    const n = notes[card.dataset.id];
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'pin') { if (await safe(() => api('PUT', `/api/note/${n.id}`, { pinned: !n.pinned }))) load(); }
    else if (act === 'arch') { if (await safe(() => api('PUT', `/api/note/${n.id}`, { archived: !n.archived }))) { toast(n.archived ? 'Nota ripristinata' : 'Nota archiviata'); load(); } }
    else if (act === 'del') { if (await confirmDelete(n.title || 'questa nota', { detail: 'La nota sparisce per tutti gli utenti.' }) && (await safe(() => api('DELETE', `/api/note/${n.id}`)))) { toast('Nota eliminata'); load(); } }
    else noteEditor(n, load);
  });
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('note')) noteEditor(notes[e.target.dataset.id], load); });
  await load();
}

function noteEditor(n, done) {
  const v = n || { title: '', body: '', items: [], color: 'giallo', pinned: false };
  let color = v.color;
  const itemRow = (i = { t: '', d: 0 }) => `<div class="ed-item" data-item><input type="checkbox" ${i.d ? 'checked' : ''} aria-label="Fatto" /><input type="text" value="${esc(i.t)}" placeholder="Voce dell’elenco" maxlength="300" /><button type="button" class="btn btn-ghost btn-sm" data-rm aria-label="Togli voce">✕</button></div>`;
  const dlg = openModal(
    `<div class="sec">
      <div class="field"><label class="l" for="ne-title">Titolo</label><input id="ne-title" value="${esc(v.title || '')}" maxlength="200" placeholder="Facoltativo" /></div>
      <div class="field"><label class="l" for="ne-body">Testo</label><textarea id="ne-body" rows="5" placeholder="Scrivi la nota…">${esc(v.body || '')}</textarea></div>
      <div class="field"><label class="l">Elenco con caselle</label><div id="ne-items" class="sec" style="gap:.5rem">${v.items.map(itemRow).join('')}</div>
        <div class="row tight"><button type="button" class="btn btn-outline btn-sm" id="ne-additem">＋ Aggiungi voce</button></div></div>
      <div class="field"><label class="l">Foto <span class="hint">(fino a 6)</span></label><div id="ne-photos" class="nphotos edit"></div>
        <div class="row tight"><label class="btn btn-outline btn-sm" for="ne-file" style="cursor:pointer">📷 Aggiungi foto</label><input type="file" id="ne-file" accept="image/*" capture="environment" style="display:none" /></div></div>
      <div class="field"><label class="l">Colore</label><div class="cdots" id="ne-colors">${dots(color)}</div></div>
      <label class="check box" style="align-self:flex-start"><input type="checkbox" id="ne-pin" ${v.pinned ? 'checked' : ''} /> Fissa in alto</label>
    </div>`,
    { title: n ? 'Modifica nota' : 'Nuova nota', wide: true, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="ne-ok">Salva</button>' }
  );
  const box = $('#ne-items', dlg.el);
  $('#ne-additem', dlg.el).onclick = () => { box.insertAdjacentHTML('beforeend', itemRow()); box.lastElementChild.querySelector('input[type=text]').focus(); };
  box.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) e.target.closest('[data-item]').remove(); });
  box.addEventListener('keydown', (e) => { // Invio in una voce: nuova voce sotto
    if (e.key !== 'Enter' || e.target.type !== 'text') return;
    e.preventDefault();
    e.target.closest('[data-item]').insertAdjacentHTML('afterend', itemRow());
    e.target.closest('[data-item]').nextElementSibling.querySelector('input[type=text]').focus();
  });
  $('#ne-colors', dlg.el).onclick = (e) => {
    const c = e.target.closest('[data-c]');
    if (!c) return;
    color = c.dataset.c;
    $$('#ne-colors .cdot', dlg.el).forEach((d) => d.classList.toggle('on', d.dataset.c === color));
  };
  // Foto: la nota si salva da sé alla prima foto (se è nuova), poi ogni foto va subito sul server
  let cur = n;
  const drawPhotos = () => {
    const cnt = cur?.photo_count || 0;
    $('#ne-photos', dlg.el).innerHTML = Array.from({ length: cnt }, (_, i) => `<span class="np"><img src="/api/note/${cur.id}/photo/${i}?t=${Date.now()}" alt="Foto ${i + 1}" /><button type="button" data-rmp="${i}" aria-label="Togli la foto ${i + 1}">✕</button></span>`).join('') || '<span class="hint">Nessuna foto.</span>';
  };
  drawPhotos();
  $('#ne-file', dlg.el).onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!cur) {
      cur = await safe(() => api('POST', '/api/note', { title: $('#ne-title', dlg.el).value || 'Foto', body: $('#ne-body', dlg.el).value, color }));
      if (!cur) return;
      changed = true;
    }
    const out = await safe(async () => { const { image } = await resizePhoto(file); return api('POST', `/api/note/${cur.id}/photo`, { image }); });
    if (out) { cur = out; changed = true; drawPhotos(); }
  };
  $('#ne-photos', dlg.el).onclick = async (e) => {
    const b = e.target.closest('[data-rmp]');
    if (!b) return;
    const out = await safe(() => api('DELETE', `/api/note/${cur.id}/photo/${b.dataset.rmp}`));
    if (out) { cur = out; changed = true; drawPhotos(); }
  };
  let changed = false;
  const closeOrig = dlg.close;
  dlg.close = () => { closeOrig(); if (changed) { changed = false; done?.(); } };
  dlg.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) dlg.close(); }, true);
  $('#ne-ok', dlg.el).onclick = async () => {
    const items = $$('[data-item]', box).map((r) => ({ t: $('input[type=text]', r).value, d: $('input[type=checkbox]', r).checked ? 1 : 0 }));
    const body = { title: $('#ne-title', dlg.el).value, body: $('#ne-body', dlg.el).value, items, color, pinned: $('#ne-pin', dlg.el).checked };
    const out = await safe(() => (cur ? api('PUT', `/api/note/${cur.id}`, body) : api('POST', '/api/note', body)));
    if (out) { dlg.close(); toast('Nota salvata'); done?.(); }
  };
  setTimeout(() => $(n ? '#ne-body' : '#ne-title', dlg.el)?.focus(), 50);
}
