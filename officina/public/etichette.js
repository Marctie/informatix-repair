// Etichette prodotto: template (Impostazioni), stampa dal Magazzino e codici a barre degli articoli.
// L'anteprima e la stampa sono disegnate dal server (etichette.mjs): quello che vedi nell'editor e' quello che esce dalla stampante.
import { $, $$, esc, eur, api, toast, safe, debounce, openModal, confirmDelete, busy, META } from './util.js';

const MM = 96 / 25.4; // pixel per millimetro a 96 dpi
const num = (v, d = 0) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d; };
const snap = (n) => Math.round(n * 2) / 2; // passo di mezzo millimetro
const r1 = (n) => Math.round(n * 10) / 10;

let cache = null;
/** Template, misure proposte e stato del logo. */
export async function loadLabelData(force = false) {
  if (!cache || force) cache = await api('GET', '/api/labels/templates');
  return cache;
}

// ---------- Codici a barre ----------
/** EAN-13 valido? (13 cifre, cifra di controllo giusta) */
export function isEan13(s) {
  const v = String(s || '');
  if (!/^\d{13}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(v[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(v[12]);
}
/** Frase sotto il campo "Codice a barre" dell'articolo. */
export function codeHint(v) {
  const c = String(v || '').trim();
  if (!c) return 'Vuoto: lo assegno io (codice interno del negozio) la prima volta che stampi l’etichetta. Se l’articolo ha già un codice sulla confezione, leggilo qui con la pistola.';
  if (/^\d{13}$/.test(c) && !isEan13(c)) return '⚠️ Questo codice di 13 cifre ha la cifra di controllo sbagliata: probabilmente un numero è stato scritto male. Meglio leggerlo con la pistola.';
  if (isEan13(c) && c[0] === '2') return 'Codice interno del negozio (EAN-13).';
  if (isEan13(c)) return 'Codice EAN-13 valido.';
  return 'Verrà stampato come codice a barre Code 128.';
}
/** Cerca l'articolo dal codice letto. Ritorna l'articolo, null se non esiste; con altri errori mostra l'avviso e ritorna undefined. */
export async function lookupCode(code) {
  return safe(async () => {
    try { return await api('GET', `/api/products/by-code/${encodeURIComponent(code)}`); } catch (e) {
      if (e?.code === 'CODICE_NON_TROVATO') return null;
      throw e;
    }
  });
}
/** Vero se il testo sembra un codice (e non il nome di un articolo scritto a mano). */
export const looksLikeCode = (s) => /^[0-9A-Za-z\-_./]{6,}$/.test(s) && /\d/.test(s);

// ---------- Stampa ----------
/** Prepara (assegna i codici mancanti) e apre la pagina di stampa. items = [{ product_id, qty }]. */
export async function printLabels(items, { templateId = null, skip = 0, preview = false } = {}) {
  const win = window.open('about:blank', '_blank'); // aperta subito dal click: dopo l'attesa del server il browser potrebbe bloccarla
  const out = await safe(() => api('POST', '/api/labels/prepare', { items, template_id: templateId, skip }));
  if (!out) { win?.close(); return null; }
  if (!win) { toast('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito e riprova.', false); return out; }
  win.location.href = out.url + (preview ? '&noprint=1' : '');
  toast(`${out.count} etichett${out.count === 1 ? 'a pronta' : 'e pronte'}${out.assigned ? ` · assegnat${out.assigned === 1 ? 'o 1 codice' : `i ${out.assigned} codici`}` : ''}`);
  return out;
}

/** Finestra "Stampa etichette": sceglie articoli e quantita'. preselect = [{ product_id, qty }]. */
export async function openLabelPrint({ preselect = [] } = {}) {
  const data = await safe(() => loadLabelData(true));
  if (!data) return;
  const sel = new Map(preselect.map((x) => [x.product_id, x.qty]));
  let filter = 'all';
  let rows = [];
  const tpls = data.templates;
  const admin = META.role !== 'cassa';
  const m = openModal(
    `<section class="sec">
      <div class="fgrid c2">
        <div class="field"><label class="l" for="lp-tpl">Template</label><select id="lp-tpl">${tpls.map((t) => `<option value="${t.id}" ${t.is_default ? 'selected' : ''}>${esc(t.name)}${t.is_default ? ' (predefinito)' : ''}</option>`).join('')}</select>
          <span class="hint" id="lp-tinfo"></span></div>
        <div class="field hidden" id="lp-skipf"><label class="l" for="lp-skip">Inizia dalla posizione n.</label><input id="lp-skip" inputmode="numeric" value="1" /><span class="hint">Per riusare un foglio adesivo già in parte staccato.</span></div>
      </div>
      ${admin ? '<span class="hint">Per cambiare grafica e misure: <a href="#/impostazioni" data-close style="text-decoration:underline">Impostazioni → Etichette prodotto</a>.</span>' : ''}
    </section>
    <section class="sec"><h3 class="sec-t">Articoli</h3>
      <div class="row"><input id="lp-q" type="search" class="grow" placeholder="Cerca per nome, categoria o codice…" autocomplete="off" />
        <span class="chip on" data-f="all">Tutti</span><span class="chip" data-f="nocode">Senza codice</span><span class="chip" data-f="sel">Scelti</span></div>
      <div class="row tight"><button class="btn btn-outline btn-sm" id="lp-one" type="button">1 per ogni articolo qui sotto</button><button class="btn btn-outline btn-sm" id="lp-stock" type="button">Quanti ne ho in magazzino</button><button class="btn btn-ghost btn-sm" id="lp-none" type="button">Azzera</button></div>
      <div id="lp-list" class="plist"></div>
    </section>`,
    { title: 'Stampa etichette', wide: true, footer: '<span class="hint" id="lp-sum" style="margin-right:auto"></span><button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-outline" id="lp-prev">Anteprima</button><button class="btn btn-primary" id="lp-print">🖨️ Stampa</button>' }
  );
  const r = m.el;
  const tplNow = () => tpls.find((t) => t.id === Number($('#lp-tpl', r).value)) || tpls[0];
  const total = () => [...sel.values()].reduce((a, b) => a + b, 0);
  const summary = () => {
    const n = total();
    $('#lp-sum', r).textContent = n ? `${n} etichett${n === 1 ? 'a' : 'e'} · ${[...sel.values()].filter(Boolean).length} articol${sel.size === 1 ? 'o' : 'i'}` : 'Nessuna etichetta scelta';
    $('#lp-print', r).disabled = !n;
    $('#lp-prev', r).disabled = !n;
  };
  const tinfo = () => {
    const t = tplNow();
    $('#lp-tinfo', r).textContent = `${t.width} × ${t.height} mm${t.layout === 'sheet' ? ` · foglio A4 ${t.sheet.cols} × ${t.sheet.rows}` : ' · rotolo'}`;
    $('#lp-skipf', r).classList.toggle('hidden', t.layout !== 'sheet');
  };
  const draw = () => {
    const shown = rows.filter((p) => (filter === 'nocode' ? !p.barcode : filter === 'sel' ? (sel.get(p.id) || 0) > 0 : true));
    $('#lp-list', r).innerHTML = shown.map((p) => `<div data-id="${p.id}"><span><b>${esc(p.name)}</b><span class="hint" style="display:block">${p.barcode ? esc(p.barcode) : 'senza codice (lo assegno io)'} · ${p.qty} pz · ${eur(p.price)}</span></span>
        <span><input class="lp-qty" type="number" min="0" max="500" inputmode="numeric" value="${sel.get(p.id) || 0}" aria-label="Etichette per ${esc(p.name)}" style="width:5.2rem" /></span></div>`).join('')
      || '<p class="empty">Nessun articolo.</p>';
    r.shown = shown;
    summary();
  };
  const load = async () => {
    const q = $('#lp-q', r).value.trim();
    rows = (await safe(() => api('GET', `/api/products?q=${encodeURIComponent(q)}`))) || [];
    const missing = [...sel.keys()].filter((id) => !rows.some((p) => p.id === id));
    if (missing.length && filter === 'sel') rows = ((await safe(() => api('GET', '/api/products?q='))) || []).filter((p) => sel.has(p.id));
    draw();
  };
  $('#lp-q', r).oninput = debounce(load, 250);
  $('#lp-tpl', r).onchange = tinfo;
  r.addEventListener('input', (e) => {
    const inp = e.target.closest('.lp-qty');
    if (!inp) return;
    const id = Number(inp.closest('[data-id]').dataset.id);
    const n = Math.min(Math.max(Math.round(num(inp.value)), 0), 500);
    if (n) sel.set(id, n); else sel.delete(id);
    summary();
  });
  r.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]');
    if (f) { filter = f.dataset.f; $$('[data-f]', r).forEach((c) => c.classList.toggle('on', c === f)); return load(); }
    if (e.target.id === 'lp-one') { (r.shown || []).forEach((p) => sel.set(p.id, 1)); return draw(); }
    if (e.target.id === 'lp-stock') { (r.shown || []).forEach((p) => { if (p.qty > 0) sel.set(p.id, Math.min(p.qty, 500)); }); return draw(); }
    if (e.target.id === 'lp-none') { sel.clear(); return draw(); }
    const go = (preview) => async (btn) => {
      const items = [...sel.entries()].map(([product_id, qty]) => ({ product_id, qty }));
      if (!items.length) return;
      const t = tplNow();
      const out = await busy(btn, () => printLabels(items, { templateId: t.id, skip: t.layout === 'sheet' ? Math.max(0, Math.round(num($('#lp-skip', r).value, 1)) - 1) : 0, preview }));
      if (out?.assigned) load(); // i codici appena assegnati compaiono nell'elenco
    };
    if (e.target.id === 'lp-print') return go(false)(e.target);
    if (e.target.id === 'lp-prev') return go(true)(e.target);
  });
  tinfo();
  await load();
}

// ---------- Impostazioni: elenco dei template e logo ----------
export async function mountLabelSettings(el) {
  el.innerHTML = `<h2 class="sec-t">Etichette prodotto e codici a barre</h2>
    <p class="hint">Qui crei e modifichi i modelli di etichetta (misura, logo, nome, prezzo, codice a barre). Si stampano dal <b>Magazzino → Etichette</b>, dal “Carico merce” o dalla scheda dell’articolo. In cassa basta leggere il codice a barre: l’articolo si aggiunge al carrello e la giacenza scende da sola quando incassi.</p>
    <div id="lb-list" class="lb-tpls"></div>
    <div class="row"><button class="btn btn-primary" id="lb-new" type="button">＋ Nuovo template</button>
      <button class="btn btn-outline" id="lb-assign" type="button" style="max-width:100%;height:auto;white-space:normal;text-align:left;line-height:1.3;padding-block:.6rem">🔢 Assegna il codice agli articoli che non ce l’hanno</button></div>
    <h3 class="sec-t" style="margin-top:.6rem">Logo sulle etichette</h3>
    <div class="row" style="align-items:center;gap:1rem"><span class="lb-logo-prev"><img id="lb-logo" alt="Logo sulle etichette" /></span><span class="hint grow" id="lb-logo-info"></span></div>
    <div class="row"><label class="btn btn-outline" for="lb-file">🖼️ Carica il tuo logo</label><input id="lb-file" type="file" accept="image/*" class="hidden" />
      <button class="btn btn-ghost" id="lb-logo-reset" type="button">Torna al logo Informatix</button></div>
    <p class="hint">La stampante delle etichette stampa solo in nero: il logo viene preparato in bianco e nero (puoi regolare la soglia prima di salvarlo).</p>`;
  const list = $('#lb-list', el);
  async function load() {
    const d = await safe(() => loadLabelData(true));
    if (!d || !list.isConnected) return;
    list.innerHTML = d.templates.map((t) => `<div class="lb-tpl" data-id="${t.id}"><div class="lb-tpl-i"><b>${esc(t.name)}</b> ${t.is_default ? '<span class="badge b-ok">predefinito</span>' : ''}<span class="hint" style="display:block">${t.width} × ${t.height} mm · ${t.layout === 'sheet' ? 'foglio A4' : 'rotolo'} · ${t.elements.filter((e) => e.on).map((e) => esc(d.types[e.type] || e.type)).join(', ')}</span></div>
        <div class="row tight"><button class="btn btn-outline btn-sm" data-act="edit" type="button">✏️ Modifica</button><button class="btn btn-ghost btn-sm" data-act="dup" type="button" title="Duplica">⧉</button>${t.is_default ? '' : '<button class="btn btn-ghost btn-sm" data-act="def" type="button" title="Usa come predefinito">★</button>'}<button class="btn btn-ghost btn-sm" data-act="test" type="button" title="Stampa un’etichetta di prova">🖨️</button><button class="btn btn-ghost btn-sm" data-act="del" type="button" title="${d.templates.length > 1 ? 'Elimina' : 'È l’unico template: non si può eliminare'}" ${d.templates.length > 1 ? '' : 'disabled'}>🗑️</button></div></div>`).join('');
    list._d = d;
    const img = $('#lb-logo', el);
    img.src = `/api/labels/logo/${d.logo.custom ? 'custom' : 'word'}?v=${d.logo.version}`;
    $('#lb-logo-info', el).textContent = d.logo.custom ? 'Stai usando il tuo logo. Nel template scegli quale logo mostrare.' : 'Logo Informatix (scritta). Nel template puoi scegliere anche il logo completo.';
    $('#lb-logo-reset', el).classList.toggle('hidden', !d.logo.custom);
  }
  list.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const t = list._d.templates.find((x) => x.id === Number(b.closest('[data-id]').dataset.id));
    const act = b.dataset.act;
    if (act === 'edit') return openTemplateEditor(t, { onSaved: load });
    if (act === 'dup') return openTemplateEditor({ ...t, id: undefined, name: `${t.name} (copia)`.slice(0, 60), is_default: false }, { onSaved: load });
    if (act === 'def') { if (await safe(() => api('POST', `/api/labels/templates/${t.id}/default`))) { toast('Template predefinito cambiato'); load(); } return; }
    if (act === 'test') return void window.open(`/print/labels?sample=1&template=${t.id}&qty=1`, '_blank');
    if (act === 'del') {
      if (!(await confirmDelete(`il template “${t.name}”`, { detail: 'Le etichette già stampate non cambiano.' }))) return;
      if (await safe(() => api('DELETE', `/api/labels/templates/${t.id}`))) { toast('Template eliminato'); load(); }
    }
  };
  $('#lb-new', el).onclick = () => {
    const base = list._d.templates.find((t) => t.is_default) || list._d.templates[0];
    openTemplateEditor({ ...base, id: undefined, name: 'Nuovo template', is_default: false }, { onSaved: load });
  };
  $('#lb-assign', el).onclick = async (e) => {
    const out = await busy(e.currentTarget, () => safe(() => api('POST', '/api/labels/assign-missing', {})));
    if (out) toast(out.assigned ? `Codice assegnato a ${out.assigned} articol${out.assigned === 1 ? 'o' : 'i'}` : 'Tutti gli articoli hanno già un codice');
  };
  $('#lb-logo-reset', el).onclick = async () => {
    if (!(await confirmDelete('il tuo logo', { verb: 'Togliere', detail: 'Tornerà il logo Informatix sulle etichette.' }))) return;
    if (await safe(() => api('DELETE', '/api/labels/logo'))) { toast('Logo Informatix ripristinato'); load(); }
  };
  $('#lb-file', el).onchange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) logoPrep(f, load);
  };
  await load();
}

/** Prepara il logo caricato: bianco e nero con soglia regolabile, sfondo trasparente, ritagliato. */
function logoPrep(file, done) {
  if (file.size > 8 * 1024 * 1024) return toast('L’immagine è troppo grande (massimo 8 MB).', false);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); toast('Non riesco a leggere questa immagine: prova con un PNG o un JPG.', false); };
  img.onload = () => {
    const sw = img.naturalWidth || 600, sh = img.naturalHeight || 300;
    const k = Math.min(1, 600 / sw);
    const W = Math.max(1, Math.round(sw * k)), H = Math.max(1, Math.round(sh * k));
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sc = src.getContext('2d', { willReadFrequently: true });
    sc.fillStyle = '#fff'; sc.fillRect(0, 0, W, H); sc.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(url);
    const px = sc.getImageData(0, 0, W, H);
    const m = openModal(`<section class="sec"><div class="lb-stage"><canvas id="lg-cv" style="max-width:100%;background:#fff"></canvas></div>
      <div class="field"><label class="l" for="lg-th">Soglia del nero</label><input id="lg-th" type="range" min="60" max="230" value="150" /><span class="hint">Più a destra = più nero (anche i grigi chiari). Il fondo bianco diventa trasparente.</span></div></section>`,
    { title: 'Prepara il logo in bianco e nero', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="lg-ok">Usa questo logo</button>' });
    const cv = $('#lg-cv', m.el);
    const make = () => {
      const th = Number($('#lg-th', m.el).value);
      const out = new ImageData(W, H);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lum = 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
        if (lum < th) { out.data[i + 3] = 255; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
      const full = document.createElement('canvas'); full.width = W; full.height = H; full.getContext('2d').putImageData(out, 0, 0);
      cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
      const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(full, x0, y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
    };
    make();
    $('#lg-th', m.el).oninput = debounce(make, 60);
    $('#lg-ok', m.el).onclick = async (e) => {
      const out = await busy(e.currentTarget, () => safe(() => api('PUT', '/api/labels/logo', { data_url: cv.toDataURL('image/png') })));
      if (!out) return;
      m.close();
      cache = null;
      toast('Logo salvato', true, { ms: 9000, action: { label: 'Usalo in tutti i template', fn: () => useCustomLogoEverywhere().then(done) } });
      done();
    };
  };
  img.src = url;
}
async function useCustomLogoEverywhere() {
  const d = await safe(() => loadLabelData(true));
  for (const t of d?.templates || []) {
    if (!t.elements.some((e) => e.type === 'logo' && e.logo !== 'custom')) continue;
    await safe(() => api('PUT', `/api/labels/templates/${t.id}`, { ...t, elements: t.elements.map((e) => (e.type === 'logo' ? { ...e, logo: 'custom' } : e)) }));
  }
  cache = null;
  toast('Il tuo logo è ora su tutte le etichette');
}

// ---------- Editor del template ----------
const FALLBACK = { x: 2, y: 2, w: 20, h: 5, size: 8, bold: false, align: 'left' };
const TEXTY = ['name', 'price', 'code', 'category', 'sku', 'shop', 'text'];

/** Editor: anteprima disegnata dal server, elementi trascinabili, misure e testi. tpl senza id = nuovo template. */
export async function openTemplateEditor(tpl, { onSaved } = {}) {
  const data = await safe(() => loadLabelData());
  if (!data) return;
  const cfg = JSON.parse(JSON.stringify(tpl));
  cfg.sheet = { cols: 3, rows: 8, top: 0, left: 0, gap_x: 0, gap_y: 0, ...(cfg.sheet || {}) };
  for (const type of Object.keys(data.types)) if (!cfg.elements.some((e) => e.type === type)) cfg.elements.push({ type, on: false, ...FALLBACK, ...(type === 'text' ? { text: 'Testo' } : {}), ...(type === 'logo' ? { w: 22, h: 6, logo: 'word' } : {}) });
  let selected = Math.max(0, cfg.elements.findIndex((e) => e.on));
  const products = ((await safe(() => api('GET', '/api/products?q='))) || []).slice(0, 80);
  const m = openModal(
    `<div class="lb-ed">
      <div class="lb-pv">
        <div class="lb-stage" id="le-stage"><div class="lb-paper" id="le-paper"><div class="lb-scale" id="le-scale"></div><div class="lb-ov" id="le-ov"></div></div></div>
        <div id="le-warn" class="lb-warn"></div>
        <div class="field"><label class="l" for="le-prod">Anteprima con l’articolo</label><select id="le-prod"><option value="">Articolo di esempio</option>${products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <p class="hint">Trascina gli elementi per spostarli e il quadratino rosso per ridimensionarli (misure in millimetri). L’anteprima è identica alla stampa.</p>
      </div>
      <div class="lb-ct">
        <section class="sec"><h3 class="sec-t">Etichetta</h3>
          <div class="field"><label class="l" for="le-name">Nome del template</label><input id="le-name" maxlength="60" value="${esc(cfg.name)}" /></div>
          <div class="fgrid c2">
            <div class="field span2"><label class="l" for="le-preset">Misura</label><select id="le-preset"><option value="">Personalizzata</option>${data.presets.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select></div>
            <div class="field"><label class="l" for="le-w">Larghezza (mm)</label><input id="le-w" inputmode="decimal" value="${cfg.width}" /></div>
            <div class="field"><label class="l" for="le-h">Altezza (mm)</label><input id="le-h" inputmode="decimal" value="${cfg.height}" /></div>
            <div class="field"><label class="l" for="le-layout">Si stampa su</label><select id="le-layout"><option value="roll">Rotolo</option><option value="sheet">Foglio A4 adesivo</option></select></div>
            <label class="check box" style="align-self:end"><input type="checkbox" id="le-border" ${cfg.border ? 'checked' : ''} /> Bordo attorno</label>
          </div>
          <div id="le-sheet" class="fgrid c3 m2 hidden">
            ${[['cols', 'Colonne'], ['rows', 'Righe'], ['top', 'Margine alto (mm)'], ['left', 'Margine sinistro (mm)'], ['gap_x', 'Spazio tra colonne (mm)'], ['gap_y', 'Spazio tra righe (mm)']].map(([k, l]) => `<div class="field"><label class="l" for="le-s-${k}">${l}</label><input id="le-s-${k}" data-s="${k}" inputmode="decimal" value="${cfg.sheet[k]}" /></div>`).join('')}
          </div>
        </section>
        <section class="sec"><h3 class="sec-t">Cosa mostrare</h3><div id="le-els" class="lb-els"></div></section>
        <section class="sec" id="le-props"></section>
      </div>
    </div>`,
    { title: tpl.id ? 'Modifica template etichetta' : 'Nuovo template etichetta', wide: true,
      footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-outline" id="le-test" type="button">🖨️ Prova di stampa</button><button class="btn btn-primary" id="le-save" type="button">Salva</button>' }
  );
  $('.modal-panel', m.el)?.classList.add('lb-wide');
  const r = m.el;
  $('#le-layout', r).value = cfg.layout;
  let k = 1; // pixel dello schermo per pixel a 96 dpi

  const cleanCfg = () => ({ name: cfg.name, width: num(cfg.width), height: num(cfg.height), layout: cfg.layout, sheet: cfg.sheet, border: cfg.border, elements: cfg.elements });
  const matchPreset = () => {
    const p = data.presets.find((x) => x.w === num(cfg.width) && x.h === num(cfg.height) && (!x.sheet || cfg.layout === 'sheet'));
    $('#le-preset', r).value = p ? p.id : '';
  };

  // --- anteprima disegnata dal server ---
  let seq = 0;
  const refresh = async () => {
    const my = ++seq;
    const warn = $('#le-warn', r);
    let out;
    try { out = await api('POST', '/api/labels/preview', { template: cleanCfg(), product_id: $('#le-prod', r).value || null }); } catch (e) {
      if (my === seq && warn) { warn.innerHTML = `<span class="lb-w">⚠️ ${esc(e.message || 'Anteprima non disponibile')}</span>`; }
      return;
    }
    if (my !== seq || !warn) return;
    let st = $('#lb-css');
    if (!st) { st = document.createElement('style'); st.id = 'lb-css'; document.head.appendChild(st); }
    st.textContent = out.css;
    $('#le-scale', r).innerHTML = out.html;
    warn.innerHTML = out.warnings.map((w) => `<span class="lb-w">⚠️ ${esc(w)}</span>`).join('');
  };
  const schedule = debounce(refresh, 220);

  // --- scala e riquadri trascinabili ---
  const placeBox = (box, e) => {
    const s = MM * k;
    box.style.cssText = `left:${e.x * s}px;top:${e.y * s}px;width:${e.w * s}px;height:${e.h * s}px`;
  };
  const drawOv = () => {
    const W = num(cfg.width, 62), H = num(cfg.height, 30);
    const stage = $('#le-stage', r);
    const avail = Math.max(120, stage.clientWidth - 24);
    k = Math.max(0.4, Math.min(avail / (W * MM), 360 / (H * MM), 5));
    const paper = $('#le-paper', r);
    paper.style.width = `${W * MM * k}px`;
    paper.style.height = `${H * MM * k}px`;
    const sc = $('#le-scale', r);
    sc.style.transform = `scale(${k})`;
    sc.style.transformOrigin = '0 0';
    sc.style.width = `${W}mm`;
    sc.style.height = `${H}mm`;
    $('#le-ov', r).innerHTML = cfg.elements.map((e, i) => (e.on ? `<div class="lb-box ${i === selected ? 'sel' : ''}" data-i="${i}" title="${esc(data.types[e.type])}"><span class="h"></span></div>` : '')).join('');
    $$('.lb-box', r).forEach((b) => placeBox(b, cfg.elements[Number(b.dataset.i)]));
  };

  // --- elenco elementi e proprieta' ---
  const drawEls = () => {
    $('#le-els', r).innerHTML = cfg.elements.map((e, i) => `<div class="lb-el ${i === selected ? 'sel' : ''}" data-i="${i}"><input type="checkbox" data-on="${i}" ${e.on ? 'checked' : ''} aria-label="Mostra: ${esc(data.types[e.type])}" /><span>${esc(data.types[e.type])}</span></div>`).join('');
  };
  const drawProps = () => {
    const e = cfg.elements[selected];
    const box = $('#le-props', r);
    if (!e) { box.innerHTML = ''; return; }
    const f = (key, label, extra = '') => `<div class="field"><label class="l" for="ep-${key}">${label}</label><input id="ep-${key}" data-p="${key}" inputmode="decimal" value="${e[key] ?? ''}" ${extra} /></div>`;
    box.innerHTML = `<h3 class="sec-t">Proprietà: ${esc(data.types[e.type])}</h3>
      <div class="fgrid c4 m2">${f('x', 'Da sinistra (mm)')}${f('y', 'Dall’alto (mm)')}${f('w', 'Larghezza (mm)')}${f('h', 'Altezza (mm)')}</div>
      ${TEXTY.includes(e.type) ? `<div class="fgrid c3 m2">${f('size', 'Corpo (pt)')}
        <div class="field"><label class="l" for="ep-align">Allineamento</label><select id="ep-align" data-p="align">${[['left', 'A sinistra'], ['center', 'Al centro'], ['right', 'A destra']].map(([v, l]) => `<option value="${v}" ${e.align === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <label class="check box" style="align-self:end"><input type="checkbox" data-p="bold" ${e.bold ? 'checked' : ''} /> Grassetto</label></div>` : ''}
      ${e.type === 'name' ? `<div class="field"><label class="l" for="ep-lines">Righe al massimo</label><select id="ep-lines" data-p="lines">${[1, 2, 3, 4].map((n) => `<option ${Number(e.lines || 2) === n ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="hint">Se il nome non sta, il carattere si rimpicciolisce da solo.</span></div>` : ''}
      ${e.type === 'text' ? `<div class="field"><label class="l" for="ep-text">Testo</label><input id="ep-text" data-p="text" maxlength="80" value="${esc(e.text || '')}" /></div>` : ''}
      ${e.type === 'logo' ? `<div class="field"><label class="l" for="ep-logo">Quale logo</label><select id="ep-logo" data-p="logo"><option value="word" ${e.logo === 'word' ? 'selected' : ''}>Solo la scritta Informatix</option><option value="full" ${e.logo === 'full' ? 'selected' : ''}>Logo completo (con l’omino)</option><option value="custom" ${e.logo === 'custom' ? 'selected' : ''} ${data.logo.custom ? '' : 'disabled'}>Il tuo logo${data.logo.custom ? '' : ' (caricalo da Impostazioni)'}</option></select></div>
        <div class="field"><label class="l" for="ep-align">Allineamento nel riquadro</label><select id="ep-align" data-p="align">${[['left', 'A sinistra'], ['center', 'Al centro'], ['right', 'A destra']].map(([v, l]) => `<option value="${v}" ${e.align === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
      ${e.type === 'barcode' ? '<p class="hint">Il tipo di codice (EAN-13 oppure Code 128) lo scelgo io in base al codice dell’articolo. Più il riquadro è largo, più è facile da leggere con la pistola.</p>' : ''}`;
  };
  const syncInputs = () => {
    const e = cfg.elements[selected];
    for (const key of ['x', 'y', 'w', 'h']) { const i = $(`#ep-${key}`, r); if (i && e) i.value = e[key]; }
  };
  const select = (i) => { selected = i; drawEls(); drawProps(); $$('.lb-box', r).forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === i)); };

  // --- eventi ---
  const metaChanged = () => { cfg.name = $('#le-name', r).value; cfg.width = $('#le-w', r).value; cfg.height = $('#le-h', r).value; cfg.layout = $('#le-layout', r).value; cfg.border = $('#le-border', r).checked; $('#le-sheet', r).classList.toggle('hidden', cfg.layout !== 'sheet'); matchPreset(); drawOv(); schedule(); };
  ['#le-name', '#le-w', '#le-h', '#le-layout', '#le-border'].forEach((s) => { $(s, r).addEventListener('input', metaChanged); $(s, r).addEventListener('change', metaChanged); });
  $('#le-preset', r).onchange = (ev) => {
    const p = data.presets.find((x) => x.id === ev.target.value);
    if (!p) return;
    // cambiando misura gli elementi si adattano alla nuova etichetta (posizioni e dimensioni in proporzione, corpo del testo col lato piu' piccolo)
    const ow = num(cfg.width, p.w), oh = num(cfg.height, p.h);
    const sx = p.w / ow, sy = p.h / oh;
    if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
      for (const e of cfg.elements) {
        e.x = r1(e.x * sx); e.w = r1(Math.max(2, e.w * sx)); e.y = r1(e.y * sy); e.h = r1(Math.max(2, e.h * sy));
        if (e.size) e.size = Math.max(4.5, Math.round(e.size * Math.min(sx, sy) * 2) / 2);
      }
      drawProps();
    }
    $('#le-w', r).value = p.w; $('#le-h', r).value = p.h;
    $('#le-layout', r).value = p.sheet ? 'sheet' : 'roll';
    if (p.sheet) { Object.assign(cfg.sheet, p.sheet); $$('[data-s]', r).forEach((i) => { i.value = cfg.sheet[i.dataset.s]; }); }
    metaChanged();
  };
  $$('[data-s]', r).forEach((i) => i.addEventListener('input', () => { cfg.sheet[i.dataset.s] = i.value; schedule(); }));
  $('#le-prod', r).onchange = refresh;
  $('#le-els', r).addEventListener('click', (ev) => {
    const on = ev.target.closest('[data-on]');
    if (on) { cfg.elements[Number(on.dataset.on)].on = on.checked; if (on.checked) selected = Number(on.dataset.on); drawEls(); drawProps(); drawOv(); schedule(); return; }
    const row = ev.target.closest('[data-i]');
    if (row) select(Number(row.dataset.i));
  });
  $('#le-props', r).addEventListener('input', (ev) => {
    const t = ev.target.closest('[data-p]');
    if (!t) return;
    const e = cfg.elements[selected];
    const key = t.dataset.p;
    if (t.type === 'checkbox') e[key] = t.checked;
    else if (['x', 'y', 'w', 'h', 'size', 'lines'].includes(key)) e[key] = num(t.value, e[key]);
    else e[key] = t.value;
    const b = $(`.lb-box[data-i="${selected}"]`, r);
    if (b) placeBox(b, e);
    schedule();
  });
  $('#le-ov', r).addEventListener('pointerdown', (ev) => {
    const box = ev.target.closest('.lb-box');
    if (!box) return;
    ev.preventDefault();
    const i = Number(box.dataset.i);
    if (i !== selected) select(i);
    const e = cfg.elements[i];
    const resize = !!ev.target.closest('.h');
    const st = { x: ev.clientX, y: ev.clientY, ex: e.x, ey: e.y, ew: e.w, eh: e.h };
    box.setPointerCapture(ev.pointerId);
    const move = (mv) => {
      const dx = (mv.clientX - st.x) / (MM * k), dy = (mv.clientY - st.y) / (MM * k);
      if (resize) { e.w = Math.max(2, snap(st.ew + dx)); e.h = Math.max(2, snap(st.eh + dy)); } else { e.x = Math.max(0, snap(st.ex + dx)); e.y = Math.max(0, snap(st.ey + dy)); }
      placeBox(box, e);
      syncInputs();
    };
    const up = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up); e.x = r1(e.x); e.y = r1(e.y); e.w = r1(e.w); e.h = r1(e.h); schedule(); };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  });
  const onResize = () => { if (!r.isConnected) return window.removeEventListener('resize', onResize); drawOv(); };
  window.addEventListener('resize', onResize);

  const save = async (btn) => {
    const body = cleanCfg();
    const out = await busy(btn, () => safe(() => (tpl.id ? api('PUT', `/api/labels/templates/${tpl.id}`, body) : api('POST', '/api/labels/templates', body))));
    if (out) { cache = null; tpl.id = out.id; }
    return out;
  };
  $('#le-save', r).onclick = async (ev) => { const out = await save(ev.currentTarget); if (out) { m.close(); toast('Template salvato'); onSaved?.(out); } };
  $('#le-test', r).onclick = async (ev) => { const out = await save(ev.currentTarget); if (out) { window.open(`/print/labels?sample=1&template=${out.id}&qty=1`, '_blank'); onSaved?.(out); } };

  matchPreset();
  metaChanged();
  drawEls();
  drawProps();
  await refresh();
}
