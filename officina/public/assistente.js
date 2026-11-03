// Assistente: si scrive in italiano normale (anche con un ordine del fornitore in allegato), l'LLM sul PC di Marco propone delle operazioni,
// il gestionale le controlla e mostra un RIEPILOGO; non parte niente finche' non si preme «Conferma». Cronologia di 30 giorni.
import { $, $$, esc, fdt, api, toast, safe, busy } from './util.js';

const STATUS = {
  queued: ['In coda', 'bg-amber-100 text-amber-800'], processing: ['Sto elaborando…', 'bg-sky-100 text-sky-700'],
  awaiting_confirm: ['Da confermare', 'bg-indigo-100 text-indigo-700'], executing: ['Eseguo…', 'bg-sky-100 text-sky-700'],
  done: ['Completata', 'bg-emerald-100 text-emerald-700'], cancelled: ['Annullata', 'bg-gray-200 text-gray-600'], error: ['Errore', 'bg-red-100 text-red-700'],
};
const ICON = { new_customer: '👤', new_repair: '🛠️', repair_status: '🔄', repair_note: '📝', new_product: '📦', update_product: '✏️', stock_move: '📥', usato_add: '🏷️', usato_update: '✏️', usato_sold: '💰', usato_unsold: '↩️', search: '🔎' };
const EXAMPLES = ['Quali articoli sono sotto scorta?', 'Quali riparazioni sono ferme da più giorni?', 'Carica 3 display iPhone 12 a magazzino', 'Che prezzo mi consigli per un iPhone 13 usato?'];
const MAX_FILE = 7_500_000;

const dayLabel = (iso) => {
  const d = new Date(String(iso).replace(' ', 'T'));
  const t = new Date();
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Oggi';
  if (d.toDateString() === y.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
};
const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('File non leggibile')); r.readAsDataURL(blob); });

/** Le foto si rimpiccioliscono nel browser (1600 px, JPEG): piu' veloci da caricare e da leggere per l'LLM. */
async function prepareFile(file) {
  if (file.type.startsWith('image/')) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = null; }
    if (bmp) {
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
      if (blob) return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: await toB64(blob) };
    }
  }
  if (file.size > MAX_FILE) throw new Error('Il file è troppo grande (massimo 7 MB).');
  return { name: file.name, type: file.type || '', data: await toB64(file) };
}

function actionHtml(a, i, r) {
  const editable = r.status === 'awaiting_confirm' && a.valid && a.editablePrice;
  const done = r.results?.find((x) => x.i === i);
  return `<div class="as-act ${a.valid ? '' : 'as-bad'}${a.danger ? ' as-danger' : ''}">
    <div class="as-act-h"><span class="as-ic" aria-hidden="true">${ICON[a.type] || '•'}</span><b>${esc(a.title)}</b>
      ${a.readOnly ? '' : a.valid ? '' : '<span class="badge bg-orange-100 text-orange-800">non eseguibile</span>'}
      ${done ? `<span class="badge ${done.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${done.ok ? 'eseguita' : 'non riuscita'}</span>` : ''}</div>
    ${(a.lines || []).map((l) => `<p class="as-line">${esc(l)}</p>`).join('')}
    ${(a.warnings || []).map((w) => `<p class="as-line as-warn">⚠ ${esc(w)}</p>`).join('')}
    ${(a.errors || []).map((e) => `<p class="as-line as-err">✗ ${esc(e)}</p>`).join('')}
    ${done ? `<p class="as-line ${done.ok ? 'as-ok' : 'as-err'}">${done.ok ? '✓' : '✗'} ${esc(done.message)}</p>` : ''}
    ${editable ? `<div class="as-price"><label class="l" for="as-p-${r.id}-${i}">Prezzo € <span class="hint">(puoi correggerlo prima di confermare)</span></label><input id="as-p-${r.id}-${i}" class="as-pi" data-i="${i}" inputmode="decimal" value="${a.fields?.price ?? ''}" placeholder="vuoto" /></div>` : ''}
  </div>`;
}

function requestHtml(r, me) {
  const [label, cls] = STATUS[r.status] || [r.status, 'bg-gray-100 text-gray-700'];
  const other = r.user_email !== me;
  let bot;
  if (r.status === 'queued' || r.status === 'processing' || r.status === 'executing') {
    bot = `<p class="as-wait"><span class="as-dots"><i></i><i></i><i></i></span> ${esc(r.note || (r.status === 'queued' ? 'In coda: parte appena il PC con l’LLM è pronto.' : r.status === 'executing' ? 'Sto eseguendo le operazioni…' : 'Sto leggendo la richiesta…'))}</p>
      ${r.status === 'executing' ? '' : `<div class="row tight"><button class="btn btn-outline btn-sm" data-act="cancel" data-id="${r.id}">Annulla</button></div>`}`;
  } else if (r.status === 'error') {
    bot = `<p class="as-line as-err">✗ ${esc(r.error)}</p><div class="row tight"><button class="btn btn-outline btn-sm" data-act="retry" data-id="${r.id}">Riprova</button><button class="btn btn-outline btn-sm" data-act="cancel" data-id="${r.id}">Annulla</button></div>`;
  } else {
    bot = `<p class="as-reply">${esc(r.reply)}</p>`;
    if (r.actions?.length) bot += `<div class="as-acts">${r.actions.map((a, i) => actionHtml(a, i, r)).join('')}</div>`;
    if (r.status === 'awaiting_confirm') {
      const n = r.actions.filter((a) => !a.readOnly && a.valid).length;
      const danger = r.actions.some((a) => a.danger && a.valid);
      bot += `<div class="as-confirm"><p><b>Controlla il riepilogo.</b> ${n === 1 ? 'Verrà eseguita 1 operazione' : `Verranno eseguite ${n} operazioni`} solo dopo la tua conferma; quelle «non eseguibili» vengono saltate.</p>
        <div class="row tight"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm" data-id="${r.id}">✓ Conferma ed esegui</button><button class="btn btn-outline" data-act="cancel" data-id="${r.id}">Annulla</button></div></div>`;
    }
    if (r.suggestions?.length && r.status !== 'cancelled') bot += `<div class="as-sug"><p class="hint">💡 Suggerimenti</p><div class="row tight">${r.suggestions.map((s) => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
  }
  return `<div class="as-item" data-rid="${r.id}">
    <div class="as-me"><div class="as-bubble-me"><p>${esc(r.text) || '<i>(solo allegato)</i>'}</p>${r.attachment ? `<p class="as-att">📎 ${esc(r.attachment.name)}</p>` : ''}<p class="as-time">${other ? `${esc(r.user_name || r.user_email)} · ` : ''}${fdt(r.created_at)}</p></div></div>
    <div class="as-bot"><div class="as-bubble-bot"><div class="row tight"><span class="badge ${cls}">${label}</span>${r.duration_ms ? `<span class="hint">${Math.round(r.duration_ms / 1000)} s · ${esc(r.model || '')}</span>` : ''}</div>${bot}</div></div>
  </div>`;
}

export async function assistenteView(el, params, ME) {
  const me = ME?.email || 'locale';
  const S = { filter: 'all', reqs: [], status: null, file: null, sig: '' };
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Assistente</h1><span class="hint" id="as-status">Controllo…</span></div>
    <p class="hint">Scrivi come parleresti a un collega: «carica 3 display iPhone 12», «la R-2026-0016 è pronta», «che prezzo metto a un iPhone 13 usato?». Puoi allegare l’ordine di un fornitore (foto, PDF, CSV).
      L’assistente <b>propone</b> e ti mostra un riepilogo: non cambia nulla finché non premi «Conferma». Non incassa, non consegna e non elimina. Cronologia conservata 30 giorni. Invio per mandare, Maiusc+Invio per andare a capo.</p>
    <div class="row tight chips-scroll" id="as-chips"></div>
    <div id="as-feed"></div>
    <div id="as-empty" class="empty card" hidden><p><b>Come posso aiutarti?</b></p><p class="hint">Qualche idea:</p><div class="row tight" style="justify-content:center" id="as-ex"></div></div>
    <form class="as-compose card" id="as-form" autocomplete="off">
      <div id="as-att" class="as-attbar" hidden><span id="as-att-name"></span> <button type="button" class="btn btn-ghost btn-sm" id="as-att-x">× Togli</button></div>
      <div class="as-compose-row">
        <label class="btn btn-outline" for="as-file" title="Allega una foto, un PDF, un TXT o un CSV" style="cursor:pointer">📎</label>
        <input type="file" id="as-file" accept="image/*,.pdf,.txt,.csv,.tsv" hidden />
        <textarea id="as-text" rows="1" maxlength="4000" aria-label="Scrivi all’assistente" placeholder="Scrivi qui…"></textarea>
        <button class="btn btn-primary" id="as-send" type="submit">Invia</button>
      </div>
    </form>`;
  const feed = $('#as-feed', el);
  $('#as-ex', el).innerHTML = EXAMPLES.map((t) => `<button type="button" class="chip" data-ex="${esc(t)}">${esc(t)}</button>`).join('');
  const FILTERS = [['all', 'Tutta la cronologia'], ['confirm', 'Da confermare'], ['executed', 'Eseguite'], ['cancelled', 'Annullate'], ['mine', 'Solo mie']];

  const visible = () => S.reqs.filter((r) => ({
    all: true, confirm: ['awaiting_confirm', 'queued', 'processing'].includes(r.status), executed: r.status === 'done' && r.results?.some((x) => x.ok),
    cancelled: r.status === 'cancelled', mine: r.user_email === me,
  }[S.filter]));

  function render() {
    if (!el.isConnected) return;
    $('#as-chips', el).innerHTML = FILTERS.map(([k, n]) => `<button type="button" class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('');
    const list = visible();
    $('#as-empty', el).hidden = S.reqs.length > 0;
    let last = ''; let html = '';
    for (const r of list) { const d = dayLabel(r.created_at); if (d !== last) { html += `<p class="as-day">${esc(d)}</p>`; last = d; } html += requestHtml(r, me); }
    if (!list.length && S.reqs.length) html = '<p class="empty card">Nessuna richiesta con questo filtro.</p>';
    // non ridisegnare mentre si scrive un prezzo nel riepilogo
    if (document.activeElement?.classList?.contains('as-pi')) return;
    feed.innerHTML = html;
  }
  function paintStatus() {
    const s = S.status;
    if (!s) return;
    $('#as-status', el).innerHTML = !s.agent_online
      ? `🔴 PC con l’LLM spento o non avviato: le richieste restano in coda${s.queued ? ` (${s.queued})` : ''} e partono appena si accende`
      : !s.llm_ready ? '🟠 PC collegato ma l’LLM (Ollama) non risponde' : `🟢 PC con l’LLM collegato${s.processing ? ' · sta elaborando una richiesta' : ''}${s.queued ? ` · ${s.queued} in coda/elaborazione` : ''}`;
  }
  let timer;
  async function load(force) {
    if (!el.isConnected) { clearTimeout(timer); return; }
    const d = await safe(() => api('GET', '/api/assistant/requests'));
    if (d) {
      S.status = d.status;
      const sig = JSON.stringify(d.requests.map((r) => [r.id, r.status, r.updated_at, r.note]));
      if (force || sig !== S.sig) { const first = !S.sig; S.sig = sig; S.reqs = d.requests; render(); if (first || force === 'bottom') window.scrollTo(0, document.body.scrollHeight); }
      paintStatus();
    }
    const busyNow = S.reqs.some((r) => ['queued', 'processing', 'executing'].includes(r.status));
    clearTimeout(timer);
    timer = setTimeout(() => load(), busyNow ? 2500 : 8000);
  }

  async function send(text) {
    text = (text ?? $('#as-text', el).value).trim();
    if (!text && !S.file) return;
    await busy($('#as-send', el), async () => {
      let file;
      if (S.file) { try { file = await prepareFile(S.file); } catch (e) { toast(e.message, false); return; } }
      const r = await safe(() => api('POST', '/api/assistant/message', { text, ...(file ? { file } : {}) }));
      if (!r) return;
      $('#as-text', el).value = ''; $('#as-text', el).style.height = '';
      S.file = null; $('#as-file', el).value = ''; $('#as-att', el).hidden = true;
      await load('bottom');
    });
  }
  $('#as-form', el).onsubmit = (e) => { e.preventDefault(); send(); };
  const ta = $('#as-text', el);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`; });
  $('#as-file', el).onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    S.file = f; $('#as-att-name', el).textContent = `📎 ${f.name}`; $('#as-att', el).hidden = false;
  };
  $('#as-att-x', el).onclick = () => { S.file = null; $('#as-file', el).value = ''; $('#as-att', el).hidden = true; };
  $('#as-chips', el).onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { S.filter = b.dataset.f; render(); } };
  $('#as-empty', el).onclick = (e) => { const b = e.target.closest('[data-ex]'); if (b) send(b.dataset.ex); };
  feed.addEventListener('click', async (e) => {
    const sug = e.target.closest('[data-sug]');
    if (sug) { ta.value = sug.dataset.sug; ta.focus(); ta.dispatchEvent(new Event('input')); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, id } = b.dataset;
    await busy(b, async () => {
      let body;
      if (act === 'confirm') {
        const overrides = {};
        $$('.as-pi', b.closest('.as-item')).forEach((i) => { overrides[i.dataset.i] = { price: i.value.trim() }; });
        body = { overrides };
      }
      const r = await safe(() => api('POST', `/api/assistant/requests/${id}/${act}`, body || {}));
      if (r) toast(act === 'confirm' ? (r.failed ? `Eseguite ${r.done}, non riuscite ${r.failed}: guarda i dettagli.` : `Fatto: ${r.done} operazion${r.done === 1 ? 'e eseguita' : 'i eseguite'}.`) : act === 'cancel' ? 'Richiesta annullata.' : 'Rimessa in coda.', !r.failed);
      await load(true);
    });
  });
  await load(true);
}
