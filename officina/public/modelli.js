// Catalogo marche/modelli: gestione completa + suggerimenti (dalla terza lettera) per la scheda riparazione.
import { $, $$, esc, api, toast, safe, debounce, openModal, confirmDelete } from './util.js';

const MIN = 3; // lettere minime per i suggerimenti
let META = null;
const loadMeta = async () => (META = META || (await safe(() => api('GET', '/api/modelli/meta'))));

// ---------- Suggerimenti sotto un campo di testo ----------
/**
 * Collega un campo "marca e modello" al catalogo: dalla terza lettera compare l'elenco, frecce + Invio o tocco per scegliere.
 * getKind() = tipo di dispositivo scelto (per mettere prima i modelli di quel tipo); onPick(modello) = scelta fatta.
 */
export function attachModelSuggest(input, { getKind = () => '', onPick = () => {} } = {}) {
  if (!input) return;
  const holder = input.parentElement;
  holder.classList.add('relative');
  const box = document.createElement('div');
  box.className = 'msug card hidden';
  box.setAttribute('role', 'listbox');
  holder.appendChild(box);
  let rows = [];
  let cur = -1;
  let seq = 0;
  const hide = () => { box.classList.add('hidden'); cur = -1; };
  const mark = (t, q) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let out = esc(t);
    for (const w of words) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
    return out;
  };
  const draw = (q) => {
    if (!rows.length) {
      box.innerHTML = `<div class="new">Nessun modello trovato: “${esc(q)}” verrà aggiunto al catalogo quando salvi la scheda.</div>`;
    } else {
      box.innerHTML = rows.map((m, i) => `<div role="option" data-i="${i}" class="${i === cur ? 'act' : ''}"><span>${mark(m.label, q)}</span><small>${esc(m.kind_label)}</small></div>`).join('');
    }
    box.classList.remove('hidden');
  };
  const pick = (i) => {
    const m = rows[i];
    if (!m) return;
    input.value = m.label;
    hide();
    onPick(m);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const search = debounce(async () => {
    const q = input.value.trim();
    if (q.length < MIN) { rows = []; return hide(); }
    const my = ++seq;
    const kind = getKind();
    let res = await safe(() => api('GET', `/api/modelli/suggest?q=${encodeURIComponent(q)}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`));
    if (res && !res.rows.length && kind) res = await safe(() => api('GET', `/api/modelli/suggest?q=${encodeURIComponent(q)}`));
    if (my !== seq || !input.isConnected || !res) return;
    rows = res.rows;
    cur = -1;
    draw(q);
  }, 140);
  input.addEventListener('input', search);
  input.addEventListener('keydown', (e) => {
    if (box.classList.contains('hidden') || !rows.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      $$('[data-i]', box).forEach((d) => d.classList.toggle('act', Number(d.dataset.i) === cur));
      $(`[data-i="${cur}"]`, box)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); e.stopPropagation(); pick(cur); }
    else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  });
  box.addEventListener('mousedown', (e) => { const d = e.target.closest('[data-i]'); if (d) { e.preventDefault(); pick(Number(d.dataset.i)); } });
  input.addEventListener('blur', () => setTimeout(hide, 120));
}

// ---------- Sezione "Modelli" ----------
export async function modelliView(el) {
  if (!(await loadMeta())) return;
  const S = { kind: '', brand: '', source: '', q: '' };
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Modelli</h1>
      <div class="row tight"><a class="btn btn-outline" id="md-csv" href="/api/modelli/export.csv" download>⬇ Esporta CSV</a>
        <button class="btn btn-outline" id="md-imp">⬆ Importa CSV</button><button class="btn btn-primary" id="md-new">＋ Nuovo modello</button></div></div>
    <p class="hint">Catalogo di marche e modelli: nella scheda riparazione, dalla terza lettera compaiono i suggerimenti. Se il modello non c’è, viene aggiunto da solo quando crei la scheda.</p>
    <div class="row tight chips-scroll" id="md-chips"></div>
    <div class="fbar">
      <input id="md-q" type="search" placeholder="Cerca marca, modello o parola chiave (dalla terza lettera)…" aria-label="Cerca nel catalogo" />
      <div class="row nowrap"><select id="md-brand" aria-label="Marca"><option value="">Tutte le marche</option></select>
        <select id="md-src" aria-label="Provenienza"><option value="">Qualsiasi provenienza</option>${Object.entries(META.sources).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
    </div>
    <div class="stat-row" id="md-stat"></div>
    <div class="card overflow-hidden" id="md-list"></div>
    <div class="row"><button class="btn btn-ghost btn-sm" id="md-reset">↺ Rimetti i modelli di partenza cancellati</button></div>`;
  const list = $('#md-list', el);

  async function loadBrands() {
    const b = (await safe(() => api('GET', `/api/modelli/brands${S.kind ? `?kind=${S.kind}` : ''}`))) || [];
    const sel = $('#md-brand', el);
    sel.innerHTML = '<option value="">Tutte le marche</option>' + b.map((x) => `<option value="${esc(x.brand)}" ${x.brand === S.brand ? 'selected' : ''}>${esc(x.brand)} (${x.n})</option>`).join('');
  }
  const qs = () => new URLSearchParams(Object.entries(S).filter(([, v]) => v)).toString();
  async function load() {
    const d = await safe(() => api('GET', `/api/modelli?${qs()}`));
    if (!d || !$('#md-list', el)) return;
    const total = Object.values(d.counts).reduce((a, n) => a + n, 0);
    $('#md-chips', el).innerHTML = `<span class="chip ${!S.kind ? 'on' : ''}" data-kind="">Tutti<small>${total}</small></span>` +
      Object.entries(META.kinds).map(([k, v]) => `<span class="chip ${S.kind === k ? 'on' : ''}" data-kind="${k}">${esc(v)}${d.counts[k] ? `<small>${d.counts[k]}</small>` : ''}</span>`).join('');
    $('#md-csv', el).href = `/api/modelli/export.csv${qs() ? `?${qs()}` : ''}`;
    $('#md-stat', el).innerHTML = `<span><b>${d.rows.length}</b> modelli mostrati${d.rows.length >= 1500 ? ' (primi 1500: restringi la ricerca)' : ''}</span>${d.auto ? `<span><b>${d.auto}</b> aggiunti dalle schede</span>` : ''}`;
    if (!d.rows.length) { list.innerHTML = '<p class="empty">Nessun modello. Cambia i filtri o aggiungine uno con “Nuovo modello”.</p>'; return; }
    list.innerHTML =
      `<div class="tbl-wrap only-wide"><table class="t"><thead><tr><th>Marca</th><th>Modello</th><th>Tipo</th><th>Parole chiave</th><th>Usato</th><th></th></tr></thead><tbody>` +
      d.rows.map((m) => `<tr class="row-h" data-id="${m.id}"><td><b>${esc(m.brand)}</b></td><td>${esc(m.model)}${m.source === 'auto' ? ' <span class="badge b-info">da scheda</span>' : ''}</td><td>${esc(m.kind_label)}</td>
        <td class="hint">${esc(m.keywords || '')}</td><td>${m.uses || ''}</td><td><div class="rowact"><button class="btn btn-outline btn-sm" data-edit="${m.id}">Modifica</button><button class="btn btn-ghost btn-sm" data-del="${m.id}" aria-label="Elimina ${esc(m.label)}">Elimina</button></div></td></tr>`).join('') +
      '</tbody></table></div>' +
      `<div class="only-narrow">${d.rows.map((m) => `<div class="pcard"><div class="top"><span class="name">${esc(m.label)}</span><span class="badge b-idle">${esc(m.kind_label)}</span></div>
        <div class="sub">${esc(m.brand)}${m.keywords ? ` · ${esc(m.keywords)}` : ''}${m.source === 'auto' ? ' · da scheda' : ''}</div>
        <div class="rowact"><button class="btn btn-outline btn-sm" data-edit="${m.id}">Modifica</button><button class="btn btn-ghost btn-sm" data-del="${m.id}">Elimina</button></div></div>`).join('')}</div>`;
    list._rows = Object.fromEntries(d.rows.map((m) => [m.id, m]));
  }
  $('#md-chips', el).onclick = (e) => { const c = e.target.closest('[data-kind]'); if (c) { S.kind = c.dataset.kind; S.brand = ''; loadBrands(); load(); } };
  $('#md-brand', el).onchange = (e) => { S.brand = e.target.value; load(); };
  $('#md-src', el).onchange = (e) => { S.source = e.target.value; load(); };
  $('#md-q', el).oninput = debounce((e) => { const v = e.target.value.trim(); S.q = v.length >= MIN || !v ? v : S.q; load(); });
  list.onclick = async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) modelForm(list._rows[ed.dataset.edit], () => { loadBrands(); load(); });
    if (del) {
      const m = list._rows[del.dataset.del];
      if (!(await confirmDelete(m.label, { detail: 'Esce solo dal catalogo: le schede già fatte non cambiano.' }))) return;
      if (await safe(() => api('DELETE', `/api/modelli/${m.id}`))) { toast('Modello eliminato'); loadBrands(); load(); }
    }
  };
  $('#md-new', el).onclick = () => modelForm(null, () => { loadBrands(); load(); }, { kind: S.kind || 'smartphone', brand: S.brand });
  $('#md-imp', el).onclick = () => importDialog(() => { loadBrands(); load(); });
  $('#md-reset', el).onclick = async () => { const r = await safe(() => api('POST', '/api/modelli/ripristina')); if (r) { toast(r.added ? `Rimessi ${r.added} modelli di partenza` : 'Niente da rimettere: ci sono già tutti'); loadBrands(); load(); } };
  await loadBrands();
  await load();
}

function modelForm(m, done, preset = {}) {
  const v = m || preset;
  const dlg = openModal(
    `<div class="sec"><div class="fgrid c2">
      <div class="field"><label class="l" for="mf-kind">Tipo</label><select id="mf-kind">${Object.entries(META.kinds).map(([k, n]) => `<option value="${k}" ${v.kind === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="mf-brand">Marca *</label><input id="mf-brand" value="${esc(v.brand || '')}" placeholder="Es. Samsung" /></div>
      <div class="field span2"><label class="l" for="mf-model">Modello *</label><input id="mf-model" value="${esc(v.model || '')}" placeholder="Es. Galaxy A54" /></div>
      <div class="field span2"><label class="l" for="mf-kw">Parole chiave (facoltative)</label><input id="mf-kw" value="${esc(v.keywords || '')}" placeholder="Es. galaxy sm-a546" /><span class="hint">Parole in più con cui trovare questo modello (nome commerciale, sigla).</span></div>
    </div></div>`,
    { title: m ? 'Modifica modello' : 'Nuovo modello', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="mf-ok">Salva</button>' }
  );
  $('#mf-ok', dlg.el).onclick = async () => {
    const body = { kind: $('#mf-kind', dlg.el).value, brand: $('#mf-brand', dlg.el).value, model: $('#mf-model', dlg.el).value, keywords: $('#mf-kw', dlg.el).value };
    const out = await safe(() => (m ? api('PUT', `/api/modelli/${m.id}`, body) : api('POST', '/api/modelli', body)));
    if (out) { dlg.close(); toast('Modello salvato'); done?.(); }
  };
  setTimeout(() => $(m ? '#mf-model' : '#mf-brand', dlg.el)?.focus(), 50);
}

function importDialog(done) {
  const dlg = openModal(
    `<div class="sec"><p class="hint">File CSV con le colonne <b>Tipo; Marca; Modello; Parole chiave</b> (la prima riga con i titoli è facoltativa). Tipo: smartphone, tablet, portatile, pc, console, altro. I modelli già presenti si saltano. Si apre e si salva anche con Excel.</p>
      <div class="field"><label class="l" for="im-file">File CSV</label><input id="im-file" type="file" accept=".csv,text/csv,text/plain" /></div>
      <div class="field"><label class="l" for="im-text">…oppure incolla qui le righe</label><textarea id="im-text" rows="5" placeholder="smartphone;Samsung;Galaxy A56;galaxy"></textarea></div>
      <div id="im-res" class="hint"></div></div>`,
    { title: 'Importa modelli da CSV', footer: '<button class="btn btn-outline" data-close>Chiudi</button><button class="btn btn-primary" id="im-ok">Importa</button>' }
  );
  $('#im-file', dlg.el).onchange = async (e) => { const f = e.target.files[0]; if (f) $('#im-text', dlg.el).value = await f.text(); };
  $('#im-ok', dlg.el).onclick = async () => {
    const csv = $('#im-text', dlg.el).value;
    if (!csv.trim()) return toast('Scegli un file o incolla le righe', false);
    const r = await safe(() => api('POST', '/api/modelli/import', { csv }));
    if (!r) return;
    $('#im-res', dlg.el).innerHTML = `<b>${r.added}</b> aggiunti, ${r.skipped} già presenti${r.error_count ? `, <span class="late-t">${r.error_count} righe da correggere</span>:<br>${r.errors.map(esc).join('<br>')}` : ''}`;
    toast(`Importati ${r.added} modelli`);
    done?.();
  };
}
