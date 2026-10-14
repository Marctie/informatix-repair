// Vetrina usati: elenco a schede, modulo di inserimento/modifica con foto ridimensionate nel browser e pubblicazione sul sito.
import { $, $$, esc, fdate, api, toast, safe, debounce, openModal } from './util.js';

const STATUS = {
  active: ['bg-emerald-100 text-emerald-700', 'In vetrina'],
  sold: ['bg-amber-100 text-amber-800', 'Venduto'],
  expired: ['bg-gray-200 text-gray-600', 'Scaduto'],
};
const LABELS = ['Nuovo sigillato', 'Come nuovo', 'Usato', 'Usato con scatola', 'Ricondizionato'];
const SPEC_KEYS = ['Chip', 'Schermo', 'Fotocamera', 'Confezione', 'Garanzia'];
const FULL = { w: 1400, h: 1750, q: 0.82 };
const THUMB = { s: 160, q: 0.78 };

const price = (p) => (p == null ? 'Su richiesta' : Number(p).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: p % 1 ? 2 : 0 }));
const title = (it) => [it.name, it.memory, it.color].filter(Boolean).join(' ');
const catLabel = (meta, v) => meta.categories.find(([k]) => k === v)?.[1] || v;
const publishBadge = (p) => {
  if (!p.enabled) return '<span class="badge bg-gray-200 text-gray-700">Bozza · pubblicazione sul sito non attiva</span>';
  if (p.error) return '<span class="badge bg-red-100 text-red-700">Pubblicazione non riuscita</span>';
  if (p.dirty) return '<span class="badge bg-amber-100 text-amber-800">Modifiche da pubblicare</span>';
  return `<span class="badge bg-emerald-100 text-emerald-700">Sito aggiornato${p.published_at ? ` · ${esc(fdate(p.published_at.slice(0, 10)))}` : ''}</span>`;
};

/** Ridimensiona una foto nel browser (canvas) e restituisce JPEG in base64: grande (max 1400x1750) e miniatura quadrata 160. */
export async function resizePhoto(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file).catch(() => null); }
  if (!bmp) throw new Error(`Formato foto non supportato: ${file.name}`);
  const draw = (cw, ch, sx, sy, sw, sh, q) => {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
    g.drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
    return new Promise((res, rej) => c.toBlob((b) => {
      if (!b) return rej(new Error('Foto non convertibile'));
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('Foto non leggibile'));
      r.readAsDataURL(b);
    }, 'image/jpeg', q));
  };
  const k = Math.min(FULL.w / bmp.width, FULL.h / bmp.height, 1);
  const image = await draw(Math.round(bmp.width * k), Math.round(bmp.height * k), 0, 0, bmp.width, bmp.height, FULL.q);
  const side = Math.min(bmp.width, bmp.height);
  const thumb = await draw(THUMB.s, THUMB.s, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, THUMB.q);
  bmp.close?.();
  return { image, thumb };
}

export async function usatiView(el, _params, ME) {
  const meta = await api('GET', '/api/usati/meta');
  let data = { items: [], publish: {} };
  let tab = 'active';
  let q = '';
  const isAdmin = !ME || ME.role === 'admin';

  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Vetrina usati</h1>
      <button class="btn btn-primary" id="u-new">＋ Nuovo articolo</button></div>
    <section class="card panel sec" id="u-pub" aria-live="polite"></section>
    <div class="fgrid">
      <input id="u-q" type="search" placeholder="Cerca un articolo…" aria-label="Cerca un articolo" />
      <div class="row chips-scroll" id="u-tabs" role="tablist"></div>
    </div>
    <div class="fgrid c3" id="u-list"></div>`;

  const counts = () => {
    const c = { active: 0, sold: 0, expired: 0, all: data.items.length };
    data.items.forEach((i) => { c[i.status]++; });
    return c;
  };
  function paint() {
    const c = counts();
    $('#u-tabs', el).innerHTML = [['active', 'In vetrina'], ['sold', 'Venduti'], ['expired', 'Scaduti'], ['all', 'Tutti']]
      .map(([k, l]) => `<button type="button" class="chip ${tab === k ? 'on' : ''}" role="tab" aria-selected="${tab === k}" data-t="${k}">${l}<small>${c[k]}</small></button>`).join('');
    const p = data.publish;
    $('#u-pub', el).innerHTML = `<div class="row"><h2 class="sec-t grow">Pubblicazione sul sito</h2>${publishBadge(p)}</div>
      ${!p.enabled ? '<p class="hint">Gli articoli sono salvati qui nel gestionale ma non vanno ancora sul sito: la pubblicazione sul sito non è ancora attiva.</p>' : ''}
      ${p.error ? `<p class="hint" style="color:#B91C1C">${esc(p.error)}</p>` : ''}
      ${p.enabled && (p.dirty || p.error) ? '<div class="row"><button class="btn btn-dark btn-sm" id="u-publish">Pubblica ora</button></div>' : ''}`;
    const needle = q.toLowerCase();
    const list = data.items.filter((i) => (tab === 'all' || i.status === tab) && (!needle || `${title(i)} ${i.conditionLabel || ''}`.toLowerCase().includes(needle)));
    $('#u-list', el).innerHTML = list.length ? list.map((it) => {
      const [cls, lab] = STATUS[it.status];
      const badge = it.status === 'sold' ? `Venduto · scompare in ${it.daysLeft} g` : lab;
      const thumb = it.photo_urls[0]?.thumb;
      return `<article class="card ucard ${it.status === 'sold' ? 'is-sold' : ''} ${it.status === 'expired' ? 'is-expired' : ''}" data-slug="${esc(it.slug)}">
        <div class="uc-media">
          ${thumb ? `<img class="thumb" src="${esc(thumb)}" alt="" loading="lazy" />` : '<div class="thumb thumb-ph">📷<span>Nessuna foto</span></div>'}
          <span class="uc-status badge ${cls}">${esc(badge)}</span>
          ${it.featured ? '<span class="uc-star" title="In evidenza" aria-label="In evidenza">★</span>' : ''}
          ${it.photos > 1 ? `<span class="uc-count" aria-label="${it.photos} foto">📷 ${it.photos}</span>` : ''}
        </div>
        <div class="uc-body">
          <div class="uc-meta"><span>${esc(catLabel(meta, it.category))}</span>${it.conditionLabel ? `<i aria-hidden="true"></i><span>${esc(it.conditionLabel)}</span>` : ''}</div>
          <b class="uc-title font-heading">${esc(title(it))}</b>
          <div class="uc-price font-heading">${price(it.price)}${it.photos ? '' : '<span class="uc-nophoto">senza foto</span>'}</div>
        </div>
        <div class="uc-actions">
          <button class="btn btn-outline btn-sm" data-act="edit">Modifica</button>
          <button class="btn ${it.sold ? 'btn-outline' : 'btn-dark'} btn-sm" data-act="${it.sold ? 'unsold' : 'sold'}">${it.sold ? 'Rimetti in vetrina' : 'Segna venduto'}</button>
          ${isAdmin ? '<button class="btn btn-ghost btn-icon btn-sm" data-act="del" aria-label="Elimina articolo" title="Elimina">✕</button>' : ''}
        </div></article>`;
    }).join('') : `<p class="empty card span2" style="grid-column:1/-1">${data.items.length ? 'Nessun articolo in questo elenco.' : 'Nessun articolo: premi “Nuovo articolo”.'}</p>`;
  }
  async function load() { data = await api('GET', '/api/usati'); paint(); }
  const announce = (r, okMsg) => {
    const p = r?.publish;
    if (!p) return toast(okMsg);
    toast(p.state === 'error' ? p.message : p.state === 'draft' ? `${okMsg} Solo bozza: la pubblicazione sul sito non è ancora attiva.` : `${okMsg} ${p.message}`, p.state !== 'error');
  };

  $('#u-new', el).onclick = () => openForm(null, meta, async (r) => { await load(); announce(r, 'Articolo salvato.'); });
  $('#u-q', el).oninput = debounce((e) => { q = e.target.value.trim(); paint(); }, 150);
  $('#u-tabs', el).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; paint(); } };
  el.addEventListener('click', async (e) => {
    if (e.target.closest('#u-publish')) {
      const r = await safe(() => api('POST', '/api/usati/publish'));
      if (r) { toast(r.message, r.state !== 'error'); await load(); }
      return;
    }
    const btn = e.target.closest('[data-act]');
    const slug = btn?.closest('[data-slug]')?.dataset.slug;
    if (!btn || !slug) return;
    const it = data.items.find((i) => i.slug === slug);
    const act = btn.dataset.act;
    if (act === 'edit') return openForm(it, meta, async (r) => { await load(); announce(r, 'Articolo salvato.'); });
    if (act === 'del') {
      if (!confirm(`Eliminare “${title(it)}” e le sue foto?`)) return;
      const r = await safe(() => api('DELETE', `/api/usati/${slug}`));
      if (r) { await load(); announce(r, 'Articolo eliminato.'); }
      return;
    }
    const r = await safe(() => api('POST', `/api/usati/${slug}/${act}`));
    if (r) { await load(); announce(r, act === 'sold' ? `Venduto: resta in vetrina barrato per ${meta.grace_days} giorni.` : 'Rimesso in vetrina.'); }
  });
  await load();
}

// ---------- modulo ----------
const chipRow = (id, items, on, multi) => `<div class="row tight" id="${id}" role="group">${items.map(([v, l]) => `<button type="button" class="chip ${(multi ? on.includes(v) : on === v) ? 'on' : ''}" data-v="${esc(v)}" aria-pressed="${multi ? on.includes(v) : on === v}">${esc(l)}</button>`).join('')}</div>`;
const specRow = (k = '', v = '') => `<div class="row nowrap" data-spec><input class="sp-k" placeholder="Voce (es. Chip)" aria-label="Voce" value="${esc(k)}" style="max-width:40%" /><input class="sp-v" placeholder="Valore (es. A18 Pro)" aria-label="Valore" value="${esc(v)}" /><button type="button" class="btn btn-ghost btn-icon" data-rm aria-label="Togli riga">✕</button></div>`;

function openForm(it, meta, done) {
  const x = it || { condition: 'usato', category: 'smartphone', specs: [], photo_urls: [] };
  // foto: elenco unico (esistenti e nuove) nell'ordine mostrato; la prima e' la copertina
  let photos = (x.photo_urls || []).map((p) => ({ ...p }));
  const removed = [];
  const label = x.conditionLabel || (it ? '' : 'Usato');

  const m = openModal(`
    <form id="uf" novalidate>
    <section class="sec"><h3 class="sec-t">🏷️ Articolo</h3>
      <div class="field"><label class="l" for="uf-name">Nome *</label><input id="uf-name" value="${esc(x.name || '')}" placeholder="es. iPhone 15" autocomplete="off" /></div>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="uf-memory">Memoria / versione</label><input id="uf-memory" value="${esc(x.memory || '')}" placeholder="es. 128 GB" /></div>
        <div class="field"><label class="l" for="uf-color">Colore</label><input id="uf-color" value="${esc(x.color || '')}" placeholder="es. Nero" /></div>
      </div>
      <div class="field"><span class="l" style="font-size:.8rem;font-weight:600">Categoria</span>${chipRow('uf-cat', meta.categories, x.category, false)}</div>
    </section>
    <section class="sec"><h3 class="sec-t">✓ Condizione</h3>
      <div class="field"><span class="l" style="font-size:.8rem;font-weight:600">È…</span>${chipRow('uf-cond', meta.conditions, x.condition, false)}</div>
      <div class="field"><label class="l" for="uf-label">Dicitura sulla scheda</label><input id="uf-label" value="${esc(label)}" placeholder="es. Usato con scatola" />
        <div class="row tight" id="uf-labels">${LABELS.map((l) => `<button type="button" class="chip" data-label="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>
    </section>
    <section class="sec"><h3 class="sec-t">💶 Prezzo e vetrina</h3>
      <div class="fgrid c2"><div class="field"><label class="l" for="uf-price">Prezzo (€)</label><input id="uf-price" inputmode="decimal" value="${x.price ?? ''}" placeholder="vuoto = su richiesta" /></div></div>
      <div class="row tight" id="uf-flags">
        <button type="button" class="chip chip-red ${x.featured ? 'on' : ''}" data-flag="featured" aria-pressed="${!!x.featured}">★ In evidenza in home</button>
        <button type="button" class="chip chip-red ${x.contact ? 'on' : ''}" data-flag="contact" aria-pressed="${!!x.contact}">📞 “Contatta il negozio”</button>
      </div>
    </section>
    <section class="sec"><h3 class="sec-t">📷 Foto</h3>
      <p class="sec-sub">Si ridimensionano da sole prima dell’invio. La prima è la copertina: tocca una foto per metterla per prima.</p>
      <div class="photo-grid" id="uf-photos"></div>
      <div class="row"><label class="btn btn-outline" for="uf-file" style="cursor:pointer">＋ Aggiungi foto</label><input id="uf-file" type="file" accept="image/*" multiple class="sr-only" style="position:absolute;width:1px;height:1px;opacity:0" /></div>
    </section>
    <section class="sec"><h3 class="sec-t">📝 Descrizione</h3>
      <div class="field"><label class="l" for="uf-tag">Frase breve (sotto il nome)</label><input id="uf-tag" value="${esc(x.tagline || '')}" placeholder="es. Come nuovo, batteria al 95%" /></div>
      <div class="field"><label class="l" for="uf-desc">Descrizione</label><textarea id="uf-desc" rows="4" placeholder="Stato, accessori inclusi, garanzia…">${esc(x.description || '')}</textarea></div>
    </section>
    <section class="sec"><h3 class="sec-t">🔧 Scheda tecnica</h3>
      <div class="sec" id="uf-specs" style="gap:.6rem">${(x.specs?.length ? x.specs : [['', '']]).map(([k, v]) => specRow(k, v)).join('')}</div>
      <div class="row tight">${SPEC_KEYS.map((k) => `<button type="button" class="chip" data-speckey="${esc(k)}">＋ ${esc(k)}</button>`).join('')}</div>
    </section>
    <section class="sec"><h3 class="sec-t">⚡ Batteria (se c’è)</h3>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="uf-bat">Salute batteria (%)</label><input id="uf-bat" inputmode="numeric" value="${x.battery ?? ''}" placeholder="es. 92" /></div>
        <div class="field"><label class="l" for="uf-cyc">Cicli di carica</label><input id="uf-cyc" inputmode="numeric" value="${x.cycles ?? ''}" placeholder="es. 210" /></div>
      </div>
    </section></form>`,
  { title: it ? 'Modifica articolo' : 'Nuovo articolo', wide: true, full: true,
    footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary btn-lg" id="uf-save">Salva e pubblica</button>` });
  const root = m.el;

  const paintPhotos = () => {
    $('#uf-photos', root).innerHTML = photos.length ? photos.map((p, i) => `<div class="ph ${i === 0 ? 'cover' : ''}">
      <button type="button" class="ph-pick" data-cover="${i}" aria-label="${i === 0 ? 'Copertina' : `Metti la foto ${i + 1} per prima`}"><img src="${esc(p.thumb)}" alt="Foto ${i + 1}" /></button>
      ${i === 0 ? '<span class="ph-tag">Copertina</span>' : ''}
      <button type="button" class="xbtn ph-x" data-rmphoto="${i}" aria-label="Togli la foto ${i + 1}">✕</button></div>`).join('') : '<p class="hint">Nessuna foto.</p>';
  };
  paintPhotos();

  const single = (sel) => root.addEventListener('click', (e) => { const c = e.target.closest(`${sel} .chip`); if (!c) return; $$(`${sel} .chip`, root).forEach((b) => { b.classList.toggle('on', b === c); b.setAttribute('aria-pressed', b === c); }); });
  single('#uf-cat'); single('#uf-cond');
  root.addEventListener('click', (e) => {
    const flag = e.target.closest('[data-flag]');
    if (flag) { flag.classList.toggle('on'); flag.setAttribute('aria-pressed', flag.classList.contains('on')); return; }
    const lab = e.target.closest('[data-label]');
    if (lab) { $('#uf-label', root).value = lab.dataset.label; return; }
    const sk = e.target.closest('[data-speckey]');
    if (sk) { const box = $('#uf-specs', root); const empty = $$('[data-spec]', box).find((r) => !$('.sp-k', r).value && !$('.sp-v', r).value); if (empty) { $('.sp-k', empty).value = sk.dataset.speckey; $('.sp-v', empty).focus(); } else { box.insertAdjacentHTML('beforeend', specRow(sk.dataset.speckey)); $('.sp-v', box.lastElementChild).focus(); } return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { const box = $('#uf-specs', root); rm.closest('[data-spec]').remove(); if (!box.children.length) box.insertAdjacentHTML('beforeend', specRow()); return; }
    const cov = e.target.closest('[data-cover]');
    if (cov) { const i = Number(cov.dataset.cover); if (i > 0) { photos.unshift(...photos.splice(i, 1)); paintPhotos(); } return; }
    const rp = e.target.closest('[data-rmphoto]');
    if (rp) { const [p] = photos.splice(Number(rp.dataset.rmphoto), 1); if (p.name) removed.push(p.name); paintPhotos(); }
  });
  $('#uf-cond', root).addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); const lab = $('#uf-label', root);
    if (c && !it && LABELS.includes(lab.value)) lab.value = c.dataset.v === 'nuovo' ? 'Nuovo sigillato' : 'Usato';
  });
  $('#uf-file', root).addEventListener('change', (e) => {
    const room = meta.max_photos - photos.length;
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (e.target.files.length > files.length) toast(`Massimo ${meta.max_photos} foto per articolo`, false);
    for (const f of files) photos.push({ file: f, thumb: URL.createObjectURL(f) });
    e.target.value = '';
    paintPhotos();
  });

  const btn = $('#uf-save', root);
  btn.onclick = async () => {
    const val = (id) => $(id, root).value.trim();
    const body = {
      name: val('#uf-name'), memory: val('#uf-memory'), color: val('#uf-color'),
      category: $('#uf-cat .chip.on', root)?.dataset.v, condition: $('#uf-cond .chip.on', root)?.dataset.v,
      conditionLabel: val('#uf-label'), price: val('#uf-price'),
      featured: $('[data-flag=featured]', root).classList.contains('on'), contact: $('[data-flag=contact]', root).classList.contains('on'),
      tagline: val('#uf-tag'), description: val('#uf-desc'), battery: val('#uf-bat'), cycles: val('#uf-cyc'),
      specs: $$('[data-spec]', root).map((r) => [$('.sp-k', r).value.trim(), $('.sp-v', r).value.trim()]).filter(([k, v]) => k && v),
    };
    if (!body.name) { $('#uf-name', root).focus(); return toast('Scrivi il nome dell’articolo', false); }
    if (!body.category || !body.condition) return toast('Scegli categoria e condizione', false);
    btn.disabled = true;
    const say = (t) => { btn.textContent = t; };
    try {
      say('Salvo…');
      let saved = await api(it ? 'PUT' : 'POST', it ? `/api/usati/${it.slug}?publish=0` : '/api/usati?publish=0', body);
      const slug = saved.slug;
      let photoError = '';
      try {
        for (const name of removed) saved = await api('DELETE', `/api/usati/${slug}/photos/${name}`);
        const news = photos.filter((p) => p.file);
        let n = 0;
        for (const p of photos) {
          if (!p.file) continue;
          say(`Foto ${++n} di ${news.length}…`);
          const { image, thumb } = await resizePhoto(p.file);
          saved = await api('POST', `/api/usati/${slug}/photos`, { image, thumb });
          p.name = saved.photo_urls.at(-1).name;
        }
        const order = photos.map((p) => p.name);
        const current = saved.photo_urls.map((p) => p.name);
        if (order.length && order.join() !== current.join()) await api('PUT', `/api/usati/${slug}/photos/order`, { order });
      } catch (e) { photoError = e.message; }
      say('Pubblico…');
      const pub = await api('POST', '/api/usati/publish');
      photos.forEach((p) => p.file && URL.revokeObjectURL(p.thumb));
      m.close();
      if (photoError) toast(`Articolo salvato, ma le foto no: ${photoError}`, false);
      done?.({ ...saved, publish: pub });
    } catch (e) {
      toast(e.message, false);
      btn.disabled = false;
      say('Salva e pubblica');
    }
  };
}
