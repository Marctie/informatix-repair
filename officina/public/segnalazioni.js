// Segnalazioni e richieste: si apre un task per Marco (errore, miglioria, funzione nuova, domanda) con testo, percorso fatto, immagini
// e dati tecnici automatici. Ogni segnalazione ha stato e commenti; l'amministratore scarica un report completo da leggere e lavorare.
import { $, $$, esc, fdt, api, toast, safe, busy, debounce, openModal, confirmDelete, recentErrors } from './util.js';
import { resizePhoto } from './usati.js';

const KIND_ICON = { errore: '🐞', miglioria: '🔧', nuova: '✨', domanda: '❓' };
const PRIO_STYLE = { bassa: 'bg-gray-100 text-gray-700', normale: 'bg-blue-100 text-blue-700', alta: 'bg-amber-100 text-amber-800', urgente: 'bg-red-100 text-red-700' };
const STATUS_STYLE = { nuova: 'bg-blue-100 text-blue-700', in_corso: 'bg-sky-100 text-sky-700', in_attesa: 'bg-amber-100 text-amber-800', da_verificare: 'bg-indigo-100 text-indigo-700', risolta: 'bg-emerald-100 text-emerald-700', rifiutata: 'bg-gray-200 text-gray-600' };
const MAX_IMAGES = 6;
const WORDS = {
  errore: { d: 'Cosa succede?', dh: 'Racconta cosa hai visto: cosa è comparso, cosa non è andato come doveva.', e: 'Cosa ti aspettavi che succedesse?' },
  miglioria: { d: 'Cosa vuoi cambiare?', dh: 'Descrivi cosa c’è adesso e cosa non ti convince.', e: 'Come lo vorresti?' },
  nuova: { d: 'Cosa ti serve che non c’è?', dh: 'Spiega a cosa servirebbe e in quale momento del lavoro lo useresti.', e: 'Come immagini che funzioni? (campi, pulsanti, stampa, avvisi…)' },
  domanda: { d: 'Qual è la domanda?', dh: 'Scrivi il dubbio: rispondo qui.', e: 'Cosa stavi cercando di fare?' },
};

let META = null;
let lastPage = 'portale';
const clean = (t) => String(t || '').replace(/[^\p{L}\p{N}\s/'’-]/gu, '').trim();
const sectionLabel = (id) => clean($$('#nav a').find((a) => (a.getAttribute('href') || '').startsWith(`#/${id}`))?.textContent) || id;
const trackPage = () => { const id = (location.hash.match(/^#\/([a-z]+)/) || [])[1]; if (id && id !== 'segnalazioni') lastPage = id; };
if (typeof window !== 'undefined') { window.addEventListener('hashchange', trackPage); setTimeout(trackPage, 0); }

const badge = (cls, text) => `<span class="badge ${cls}">${esc(text)}</span>`;
const loadMeta = async () => { META ||= await api('GET', '/api/tickets/meta'); return META; };
const download = (name, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const context = () => ({ url: location.href, ua: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, language: navigator.language, online: navigator.onLine, errors: recentErrors.slice(-5) });

/** Modulo di nuova segnalazione (o modifica, finché è "Nuova"). Si apre anche dal pulsante 📣 in alto, su qualsiasi pagina. */
export async function openTicketForm({ ticket = null, done } = {}) {
  const meta = await safe(loadMeta);
  if (!meta) return;
  const v = ticket || { kind: 'errore', title: '', description: '', page: sectionLabel(lastPage), path_text: '', expected: '', priority: 'normale' };
  const sections = [...new Set($$('#nav a').map((a) => clean(a.textContent)).filter(Boolean))];
  if (v.page && !sections.includes(v.page)) sections.unshift(v.page);
  let kind = v.kind;
  const images = []; // { image: base64, url } ancora da inviare
  const dlg = openModal(
    `<div class="sec">
      <div class="field"><label class="l">Di cosa si tratta?</label><div class="row tight chips-scroll" id="tk-kinds">${Object.entries(meta.kinds).map(([k, n]) => `<button type="button" class="chip ${k === kind ? 'on' : ''}" data-k="${k}">${KIND_ICON[k]} ${esc(n)}</button>`).join('')}</div></div>
      <div class="field"><label class="l" for="tk-title">Titolo breve</label><input id="tk-title" maxlength="200" value="${esc(v.title)}" placeholder="Es. Il prezzo del preventivo non si salva" /></div>
      <div class="field"><label class="l" for="tk-desc" id="tk-desc-l"></label><textarea id="tk-desc" rows="5">${esc(v.description)}</textarea><div class="hint" id="tk-desc-h"></div></div>
      <div class="field"><label class="l" for="tk-page">In quale sezione?</label><select id="tk-page"><option value="">Non so / più sezioni</option>${sections.map((s) => `<option ${s === v.page ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="tk-path">Percorso fatto <span class="hint">(i passaggi per arrivarci)</span></label><textarea id="tk-path" rows="3" placeholder="Es. Riparazioni → R-2026-0016 → Preventivo → scrivo 100 → Salva">${esc(v.path_text || '')}</textarea></div>
      <div class="field"><label class="l" for="tk-exp" id="tk-exp-l"></label><textarea id="tk-exp" rows="3">${esc(v.expected || '')}</textarea></div>
      ${ticket ? '' : `<div class="field"><label class="l">Immagini <span class="hint">(schermate o foto, fino a ${MAX_IMAGES})</span></label><div id="tk-imgs" class="nphotos edit"></div>
        <div class="row tight"><label class="btn btn-outline btn-sm" for="tk-file" style="cursor:pointer">🖼️ Aggiungi immagini</label><input type="file" id="tk-file" accept="image/*" multiple style="display:none" /><span class="hint">Puoi anche incollare una schermata con Ctrl+V.</span></div></div>`}
      <div class="field"><label class="l" for="tk-prio">Quanto è importante?</label><select id="tk-prio">${Object.entries(meta.priorities).map(([k, n]) => `<option value="${k}" ${k === v.priority ? 'selected' : ''}>${esc(n)}${k === 'urgente' ? ' — mi blocca il lavoro' : ''}</option>`).join('')}</select></div>
      <p class="hint">Insieme alla segnalazione vengono salvati in automatico la pagina in cui ti trovi, il tipo di schermo e gli ultimi errori comparsi: servono a capire il problema.</p>
    </div>`,
    { title: ticket ? `Modifica ${ticket.code}` : 'Nuova segnalazione', wide: true, full: true, footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="tk-ok">${ticket ? 'Salva' : 'Invia a Marco'}</button>` },
  );
  const el = dlg.el;
  const words = () => {
    const w = WORDS[kind];
    $('#tk-desc-l', el).textContent = w.d; $('#tk-desc-h', el).textContent = w.dh; $('#tk-exp-l', el).textContent = w.e;
    $$('#tk-kinds .chip', el).forEach((c) => c.classList.toggle('on', c.dataset.k === kind));
  };
  words();
  $('#tk-kinds', el).onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { kind = b.dataset.k; words(); } };
  const draw = () => {
    const box = $('#tk-imgs', el);
    if (!box) return;
    box.innerHTML = images.map((im, i) => `<span class="np"><img src="${im.url}" alt="Immagine ${i + 1}" /><button type="button" data-rm="${i}" aria-label="Togli l’immagine ${i + 1}">✕</button></span>`).join('') || '<span class="hint">Nessuna immagine.</span>';
  };
  const addFiles = async (files) => {
    for (const f of [...files].filter((x) => x.type.startsWith('image/'))) {
      if (images.length >= MAX_IMAGES) { toast(`Massimo ${MAX_IMAGES} immagini.`, false); break; }
      const out = await safe(() => resizePhoto(f));
      if (out) images.push({ image: out.image, url: `data:image/jpeg;base64,${out.thumb}` });
    }
    draw();
  };
  if (!ticket) {
    draw();
    $('#tk-file', el).onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
    $('#tk-imgs', el).onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { images.splice(Number(b.dataset.rm), 1); draw(); } };
    el.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.some((x) => x.type.startsWith('image/'))) { e.preventDefault(); addFiles(f); } });
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
  }
  $('#tk-ok', el).onclick = (e) => busy(e.currentTarget, async () => {
    const body = { kind, title: $('#tk-title', el).value, description: $('#tk-desc', el).value, page: $('#tk-page', el).value, path_text: $('#tk-path', el).value, expected: $('#tk-exp', el).value, priority: $('#tk-prio', el).value };
    if (!ticket) { body.images = images.map((i) => i.image); body.context = context(); }
    const out = await safe(() => (ticket ? api('PUT', `/api/tickets/${ticket.id}`, body) : api('POST', '/api/tickets', body)));
    if (!out) return;
    dlg.close();
    toast(ticket ? 'Segnalazione salvata' : `Segnalazione ${out.code} inviata: Marco riceve l’avviso su Telegram`);
    done?.(out);
  });
  setTimeout(() => $('#tk-title', el)?.focus(), 50);
}

function openDetail(id, ME, done) {
  const isAdmin = !ME || ME.role === 'admin';
  const dlg = openModal('<p class="hint">Caricamento…</p>', { title: 'Segnalazione', wide: true });
  let changed = false;
  const closeOrig = dlg.close;
  dlg.close = () => { closeOrig(); if (changed) { changed = false; done?.(); } };
  dlg.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) dlg.close(); }, true);
  const show = async () => {
    const t = await safe(() => api('GET', `/api/tickets/${id}`));
    if (!t) { dlg.close(); return; }
    const w = WORDS[t.kind];
    const mine = ME && t.created_by === ME.email;
    $('h2', dlg.el).textContent = `${t.code} · ${t.title}`;
    const ctx = t.context || {};
    const block = (title, text) => (text ? `<div class="tk-box"><div class="tk-lbl">${esc(title)}</div><div class="tk-txt">${esc(text)}</div></div>` : '');
    $('.modal-body', dlg.el).innerHTML = `<div class="sec">
      <div class="tk-top"><div class="badges">${badge('bg-gray-100 text-gray-700', `${KIND_ICON[t.kind]} ${t.kind_label}`)}${badge(PRIO_STYLE[t.priority], `Priorità ${t.priority_label.toLowerCase()}`)}${badge(STATUS_STYLE[t.status], t.status_label)}</div><p class="tk-meta">Aperta da <b>${esc(t.created_by_name || t.created_by)}</b> il ${fdt(t.created_at)}${t.page ? ` · sezione <b>${esc(t.page)}</b>` : ''}${t.closed_at ? ` · chiusa il ${fdt(t.closed_at)}` : ''}</p></div>
      ${block(w.d.replace('?', ''), t.description)}${block('Percorso fatto', t.path_text)}${block(w.e.replace('?', ''), t.expected)}
      ${t.photo_count ? `<div class="field"><label class="l">Immagini</label><div class="nphotos edit">${Array.from({ length: t.photo_count }, (_, i) => `<span class="np"><a href="/api/tickets/${t.id}/photo/${i}" target="_blank" rel="noopener"><img src="/api/tickets/${t.id}/photo/${i}" alt="Immagine ${i + 1}" style="width:8rem;height:8rem" /></a>${(isAdmin || mine) ? `<button type="button" data-rmp="${i}" aria-label="Togli l’immagine ${i + 1}">✕</button>` : ''}</span>`).join('')}</div></div>` : ''}
      ${(isAdmin || mine) && t.photo_count < MAX_IMAGES ? `<div class="row tight"><label class="btn btn-outline btn-sm" for="td-file" style="cursor:pointer">🖼️ Aggiungi immagine</label><input type="file" id="td-file" accept="image/*" style="display:none" /></div>` : ''}
      ${Object.keys(ctx).length ? `<details><summary class="hint" style="cursor:pointer">Dati tecnici automatici</summary><div class="hint" style="white-space:pre-wrap;word-break:break-all">${esc([ctx.url && `Pagina: ${ctx.url}`, ctx.viewport && `Schermo: ${ctx.viewport}`, ctx.ua && `Browser: ${ctx.ua}`, ...(ctx.errors || []).map((e) => `Errore ${e.at}: ${e.msg}`)].filter(Boolean).join('\n'))}</div></details>` : ''}
      <h3 class="tk-sec">Cronologia</h3>
      <div class="tk-log" id="td-log">${t.comments.map((c) => (c.kind === 'stato' ? `<div class="tk-ev"><span class="tk-dot"></span><span>${esc(c.body)} <span class="tk-when">· ${esc(c.author_name || c.author)} · ${fdt(c.created_at)}</span></span></div>` : `<div class="tk-msg"><div class="tk-av" aria-hidden="true">${esc(String(c.author_name || c.author).trim().charAt(0).toUpperCase())}</div><div class="tk-bub"><div class="tk-h"><b>${esc(c.author_name || c.author)}</b><span>${fdt(c.created_at)}</span></div><div class="tk-b">${esc(c.body)}</div></div></div>`)).join('') || '<p class="hint">Ancora nessun commento.</p>'}</div>
      <div class="field tk-comp"><label class="l" for="td-comment">${t.status === 'in_attesa' && mine ? 'Rispondi alla domanda' : 'Aggiungi un commento'}</label><textarea id="td-comment" rows="3" placeholder="Scrivi qui… (Ctrl+Invio per inviare)"></textarea>
        <div class="tk-right"><button class="btn btn-primary btn-sm" id="td-send">Invia commento</button></div></div>
      ${isAdmin ? `<div class="tk-admin"><div class="tk-lbl">Gestione della segnalazione</div><div class="tk-adm-row"><select id="td-status" aria-label="Stato">${Object.entries(META.statuses).map(([k, n]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><button class="btn btn-primary btn-sm" id="td-save">Aggiorna stato</button></div>
        <details><summary>Aggiungi una nota per chi ha aperto la segnalazione</summary><textarea id="td-note" rows="2" placeholder="Es. cosa ho fatto, o la domanda da fare"></textarea></details></div>` : ''}
      <div class="tk-acts">${t.status === 'nuova' && (isAdmin || mine) ? '<button class="btn btn-outline btn-sm" id="td-edit">✏️ Modifica</button>' : ''}${isAdmin ? '<button class="btn btn-outline btn-sm" id="td-report">⬇ Report (.md)</button><button class="btn btn-outline btn-sm" id="td-report-img">⬇ Report con immagini</button><button class="btn btn-ghost btn-sm tk-del" id="td-del">🗑 Elimina</button>' : ''}</div>
    </div>`;
    const el = dlg.el;
    const act = (sel, fn) => { const b = $(sel, el); if (b) b.onclick = (e) => busy(e.currentTarget, fn); };
    act('#td-send', async () => { const o = await safe(() => api('POST', `/api/tickets/${t.id}/comments`, { body: $('#td-comment', el).value })); if (o) { changed = true; toast('Commento inviato'); show(); } });
    $('#td-comment', el)?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#td-send', el)?.click(); } });
    act('#td-save', async () => { const o = await safe(() => api('PUT', `/api/tickets/${t.id}`, { ...pick(t), status: $('#td-status', el).value, note: $('#td-note', el).value })); if (o) { changed = true; toast('Segnalazione aggiornata'); show(); } });
    act('#td-edit', async () => { dlg.close(); openTicketForm({ ticket: t, done }); });
    const rep = (foto) => async () => { const o = await safe(() => api('GET', `/api/tickets/${t.id}/report${foto ? '?foto=1' : ''}`)); if (o) download(o.filename, o.markdown); };
    act('#td-report', rep(false)); act('#td-report-img', rep(true));
    act('#td-del', async () => { if (await confirmDelete(`${t.code} · ${t.title}`, { detail: 'Sparisce con commenti e immagini.' }) && (await safe(() => api('DELETE', `/api/tickets/${t.id}`)))) { toast('Segnalazione eliminata'); changed = true; dlg.close(); } });
    const file = $('#td-file', el);
    if (file) file.onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const o = await safe(async () => { const { image } = await resizePhoto(f); return api('POST', `/api/tickets/${t.id}/photo`, { image }); }); if (o) { changed = true; show(); } };
    $$('[data-rmp]', el).forEach((b) => { b.onclick = async () => { if (await safe(() => api('DELETE', `/api/tickets/${t.id}/photo/${b.dataset.rmp}`))) { changed = true; show(); } }; });
  };
  const pick = (t) => ({ kind: t.kind, title: t.title, description: t.description, page: t.page, path_text: t.path_text, expected: t.expected, priority: t.priority });
  show();
}

export async function segnalazioniView(el, params, ME) {
  const meta = await safe(loadMeta);
  if (!meta) return;
  const isAdmin = !ME || ME.role === 'admin';
  const S = { stato: 'aperte', tipo: '', q: '' };
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Segnalazioni</h1>
      <div class="row tight">${isAdmin ? '<button class="btn btn-outline" id="sg-report">⬇ Report di tutte le aperte</button>' : ''}<button class="btn btn-primary" id="sg-new">＋ Nuova segnalazione</button></div></div>
    <p class="hint">Qui apri un task per Marco: qualcosa che non funziona, una cosa da cambiare, una funzione nuova da aggiungere o una domanda. Allega schermate e racconta il percorso che hai fatto: ogni segnalazione arriva a Marco su Telegram e puoi seguirne lo stato e i commenti. Dal pulsante 📣 in alto puoi segnalare da qualsiasi pagina.</p>
    <div class="row tight chips-scroll" id="sg-chips"></div>
    <div class="row nowrap"><select id="sg-tipo" aria-label="Tipo"><option value="">Tutti i tipi</option>${Object.entries(meta.kinds).map(([k, n]) => `<option value="${k}">${KIND_ICON[k]} ${esc(n)}</option>`).join('')}</select><input id="sg-q" type="search" placeholder="Cerca nelle segnalazioni…" aria-label="Cerca" /></div>
    <div id="sg-list"></div>`;
  const list = $('#sg-list', el);
  async function load() {
    const d = await safe(() => api('GET', `/api/tickets?stato=${S.stato}${S.tipo ? `&tipo=${S.tipo}` : ''}&q=${encodeURIComponent(S.q)}`));
    if (!d || !$('#sg-list', el)) return;
    $('#sg-chips', el).innerHTML = [['aperte', `Aperte${d.open ? `<small>${d.open}</small>` : ''}`], ['da_verificare', `Da verificare${d.counts.da_verificare ? `<small>${d.counts.da_verificare}</small>` : ''}`], ['chiuse', `Chiuse${d.closed ? `<small>${d.closed}</small>` : ''}`], ['tutte', 'Tutte']].map(([k, l]) => `<span class="chip ${S.stato === k ? 'on' : ''}" data-s="${k}">${l}</span>`).join('');
    list.innerHTML = d.rows.length ? d.rows.map((t) => `<article class="card tk-card tk-s-${t.status}" data-id="${t.id}" tabindex="0">
      <div class="badges"><b>${t.code}</b> ${badge('bg-gray-100 text-gray-700', `${KIND_ICON[t.kind]} ${t.kind_label}`)}${badge(PRIO_STYLE[t.priority], t.priority_label)}${badge(STATUS_STYLE[t.status], t.status_label)}</div>
      <h3 class="tk-title">${esc(t.title)}</h3>
      <div class="tk-meta">${esc(t.created_by_name || t.created_by)} · ${fdt(t.created_at)}${t.page ? ` · ${esc(t.page)}` : ''}${t.photo_count ? ` · 🖼️ ${t.photo_count}` : ''}${t.comment_count ? ` · 💬 ${t.comment_count}` : ''}</div></article>`).join('')
      : `<p class="empty card">${S.q || S.tipo ? 'Nessuna segnalazione trovata.' : S.stato === 'chiuse' ? 'Nessuna segnalazione chiusa.' : 'Nessuna segnalazione aperta 👍'}</p>`;
  }
  $('#sg-new', el).onclick = () => openTicketForm({ done: load });
  const rep = $('#sg-report', el);
  if (rep) rep.onclick = (e) => busy(e.currentTarget, async () => { const o = await safe(() => api('GET', '/api/tickets/report?stato=aperte&foto=1')); if (o) { download(o.filename, o.markdown); toast(`Report scaricato (${o.count} segnalazioni, con immagini)`); } });
  $('#sg-chips', el).onclick = (e) => { const c = e.target.closest('[data-s]'); if (c) { S.stato = c.dataset.s; load(); } };
  $('#sg-tipo', el).onchange = (e) => { S.tipo = e.target.value; load(); };
  $('#sg-q', el).oninput = debounce((e) => { S.q = e.target.value.trim(); load(); });
  const open = (e) => { const c = e.target.closest('[data-id]'); if (c && (e.type === 'click' || e.key === 'Enter')) openDetail(c.dataset.id, ME, load); };
  list.addEventListener('click', open);
  list.addEventListener('keydown', open);
  await load();
  if (params?.get('id')) openDetail(params.get('id'), ME, load);
}
