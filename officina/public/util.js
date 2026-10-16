// Helper condivisi dall'interfaccia del gestionale officina.
import { buildApiError, networkError, friendly } from './errori.js';
export { ApiError, friendly, errorText, statusPrereq } from './errori.js';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const eur = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
export const fdate = (s) => (s ? new Date(s.length === 10 ? s + 'T00:00:00' : s.replace(' ', 'T')).toLocaleDateString('it-IT') : '—');
export const fdt = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const ld = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ld(new Date());
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ld(d); };

const API_TIMEOUT_MS = 30000;
export async function api(method, path, body) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl?.abort(); }, API_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl?.signal });
  } catch (e) {
    // rete assente, server irraggiungibile, timeout, oppure Cloudflare Access che reindirizza al login (bloccato dal browser)
    throw networkError(method, path, timedOut);
  } finally { clearTimeout(timer); }
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  let raw = '';
  try { raw = await res.text(); data = raw ? JSON.parse(raw) : null; } catch { data = null; /* risposta non JSON */ }
  // errore in testo semplice (es. "Firma non trovata"): lo teniamo come messaggio
  if (data === null && raw && !/html/i.test(contentType) && !/^\s*</.test(raw) && !res.ok) data = { error: raw.slice(0, 200) };
  if (!res.ok || /html/i.test(contentType)) {
    throw buildApiError({ status: res.status, data, contentType, redirected: res.redirected, method, path });
  }
  return data;
}

/** Mostra un avviso. opts.action = { label, fn } aggiunge un pulsante; opts.ms = durata. */
export function toast(msg, ok = true, opts = {}) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = '';
  const main = document.createElement('div');
  main.textContent = msg;
  t.appendChild(main);
  if (opts.hint) { const h = document.createElement('div'); h.className = 'toast-hint'; h.textContent = opts.hint; t.appendChild(h); }
  const acts = (opts.actions || (opts.action ? [opts.action] : []));
  if (acts.length) {
    const row = document.createElement('div'); row.className = 'toast-actions';
    for (const a of acts) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label;
      b.onclick = () => { t.classList.add('hidden'); a.fn?.(); };
      row.appendChild(b);
    }
    t.appendChild(row);
  }
  t.style.background = ok ? '#0B0F19' : '#B91C1C';
  t.classList.remove('hidden');
  clearTimeout(t._h);
  const ms = opts.ms ?? (ok ? 2800 : acts.length || opts.hint ? 9000 : 4500);
  t._h = setTimeout(() => t.classList.add('hidden'), ms);
}

/** Mostra un errore in modo parlante: cosa e' successo, cosa fare, e pulsanti Riprova / Ricarica quando servono. */
export function showError(e, retryFn) {
  const f = friendly(e);
  const actions = [];
  if (f.retry && retryFn) actions.push({ label: 'Riprova', fn: () => safe(retryFn) });
  if (f.reload) actions.push({ label: 'Ricarica la pagina', fn: () => location.reload() });
  toast(f.message, false, { hint: f.hint, actions });
}

// Esegue un'azione mostrando eventuali errori come toast parlanti (con "Riprova" se la rete e' caduta).
export async function safe(fn) {
  try { return await fn(); } catch (e) { showError(e, fn); return undefined; }
}

/** Evita il doppio click: finche' l'azione e' in corso il pulsante e' disabilitato e un secondo click viene ignorato. */
const inFlight = new WeakSet();
export async function busy(el, fn) {
  if (el && inFlight.has(el)) return undefined;
  if (el) { inFlight.add(el); el.disabled = true; el.setAttribute('aria-busy', 'true'); }
  try { return await fn(); } finally { if (el) { inFlight.delete(el); el.disabled = false; el.removeAttribute('aria-busy'); } }
}

// ---------- Gestore globale degli errori non previsti ----------
let lastGlobal = { msg: '', at: 0 };
function globalFail(e) {
  const f = friendly(e);
  if (/ResizeObserver|Script error|AbortError/.test(String(e?.message || e || e?.name))) return;
  if (lastGlobal.msg === f.message && Date.now() - lastGlobal.at < 4000) return; // niente raffica di avvisi uguali
  lastGlobal = { msg: f.message, at: Date.now() };
  try { console.error('[gestionale]', e); } catch { /* console assente */ }
  try { showError(e); } catch { /* DOM non pronto */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => globalFail(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => { globalFail(ev.reason); ev.preventDefault?.(); });
  window.addEventListener('offline', () => toast('Connessione persa.', false, { hint: 'Puoi continuare a compilare: i dati restano nella schermata. Appena torna internet riprova a salvare.', ms: 8000 }));
  window.addEventListener('online', () => toast('Connessione tornata: puoi salvare.'));
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const debounce = (fn, ms = 250) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

let modalStack = [];
/** Apre un modale; ritorna { el, close }. html = contenuto del corpo. */
// full = a schermo intero sui telefoni (moduli lunghi)
export function openModal(html, { title = '', wide = false, footer = '', full = false } = {}) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = `modal-bg fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4${full ? ' modal-full' : ''}`;
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="modal-panel bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} rounded-t-2xl sm:rounded-2xl shadow-2xl">
    <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line"><h2 class="font-heading font-bold text-lg truncate">${esc(title)}</h2>
      <button class="btn btn-ghost btn-sm" data-close aria-label="Chiudi">✕</button></div>
    <div class="modal-body p-4 sm:p-5">${html}</div>${footer ? `<div class="modal-foot px-4 sm:px-5 py-3 border-t border-line flex gap-2 justify-end flex-wrap" style="padding-bottom:max(.75rem,env(safe-area-inset-bottom))">${footer}</div>` : ''}</div>`;
  root.appendChild(wrap);
  const close = () => { wrap.remove(); modalStack = modalStack.filter((m) => m !== api2); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  const api2 = { el: wrap, close };
  modalStack.push(api2);
  return api2;
}
/**
 * Doppia conferma per ogni eliminazione: 1) "Eliminare X?"  2) conferma finale "non si può annullare".
 * Con `typed` (es. 'ELIMINA') il secondo passaggio richiede di scrivere la parola: per clienti, riparazioni, utenti.
 * Ritorna una Promise<boolean>.
 */
export function confirmDelete(what, { verb = 'Eliminare', detail = '', typed = '' } = {}) {
  return new Promise((resolve) => {
    let step = 1;
    let result = false;
    const m = openModal('', { title: `${verb}?`, footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="cd-go"></button>' });
    const body = $('.modal-body', m.el);
    const go = $('#cd-go', m.el);
    const closeOrig = m.close;
    m.close = () => { closeOrig(); resolve(result); };
    const draw = () => {
      if (step === 1) {
        body.innerHTML = `<p class="text-base">${esc(verb)} <b>${esc(what)}</b>?</p>${detail ? `<p class="text-sm text-muted mt-2">${esc(detail)}</p>` : ''}`;
        go.textContent = 'Continua';
        go.disabled = false;
      } else {
        body.innerHTML = `<p class="text-base"><b>Conferma finale:</b> ${esc(what)} verrà eliminato e <b>non si può annullare</b>.</p>${typed ? `<label class="field mt-3"><span>Scrivi <b>${esc(typed)}</b> per confermare</span><input id="cd-typed" autocomplete="off" autocapitalize="characters"></label>` : ''}`;
        go.textContent = 'Confermo l’eliminazione';
        go.disabled = !!typed;
        if (typed) { const i = $('#cd-typed', m.el); i.focus(); i.oninput = () => { go.disabled = i.value.trim().toUpperCase() !== typed.toUpperCase(); }; }
      }
    };
    go.onclick = () => { if (step === 1) { step = 2; draw(); } else { result = true; m.close(); } };
    // il pulsante Annulla e la X chiudono il modale originale: li colleghiamo alla nostra close
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) m.close(); }, true);
    draw();
  });
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close(); });

// ---------- WhatsApp / contatti ----------
export function waLink(phone, text) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  else if (!p.startsWith('39') || p.length < 11) p = '39' + p;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export const STATUS_STYLE = {
  received: 'bg-gray-100 text-gray-700',
  diagnosing: 'bg-blue-100 text-blue-700',
  quote_pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-indigo-100 text-indigo-700',
  waiting_parts: 'bg-orange-100 text-orange-800',
  repairing: 'bg-sky-100 text-sky-700',
  ready: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};
export const statusBadge = (r) => `<span class="badge ${STATUS_STYLE[r.status]}">${esc(r.status_label)}</span>`;
export const progressBar = (r) => `<div class="bar ${r.status === 'ready' || r.status === 'delivered' ? 'green' : ''}" title="${r.progress}%"><i style="width:${r.progress}%"></i></div>`;

export const META = { statuses: {}, settings: {}, track_base: '', role: 'admin' };
/** Il ruolo Cassa non vede costi d'acquisto, margini e guadagni (il server non glieli manda nemmeno). */
export const canSeeCosts = () => META.role !== 'cassa';
export const trackUrl = (token) => `${META.track_base}/t/${token}`;
export async function loadMeta() {
  const m = await api('GET', '/api/meta');
  META.statuses = m.statuses;
  META.settings = m.settings;
  META.track_base = m.track_base;
  META.device_types = m.device_types || {};
  META.phases = m.phases || {};
}

/** Messaggi WhatsApp precompilati. */
export function waMessage(kind, r) {
  const shop = META.settings.shop_name || 'Informatix Repair';
  const link = r.track_url ? `\nSegui la riparazione: ${r.track_url}` : '';
  const first = String(r.customer_name || '').split(' ')[0];
  switch (kind) {
    case 'ready': return `Ciao ${first}, il tuo ${r.brand_model} è pronto per il ritiro! ${r.quote != null ? `Importo da saldare: ${eur((r.final_price ?? r.quote) - (r.paid ?? r.deposit ?? 0))}. ` : ''}Ti aspettiamo da ${shop}.${link}`;
    case 'quote': return `Ciao ${first}, per il tuo ${r.brand_model} il preventivo è di ${eur(r.quote)}${r.eta_date ? `, consegna stimata ${fdate(r.eta_date)}` : ''}. Puoi approvarlo direttamente dal link, oppure rispondi a questo messaggio.${link}`;
    case 'sign': return `Ciao ${first}, per completare l’ingresso del tuo ${r.brand_model} da ${shop} puoi leggere le condizioni e firmare la scheda direttamente dal telefono, senza scaricare nulla.${link}`;
    case 'storage': return `Ciao ${first}, il tuo ${r.brand_model} (rif. ${r.code}) non è stato riparato e ti aspetta in negozio${r.fate_since ? ` dal ${fdate(r.fate_since.slice(0, 10))}` : ''}. Dopo ${META.settings.storage_days || 15} giorni sarà custodito in deposito a pagamento (${META.settings.storage_fee || 'tariffa da definire'}) oppure potrà essere smaltito/ceduto secondo le condizioni che hai firmato. Passa a ritirarlo o scrivici per accordarci: ${META.settings.shop_phone || ''}.`;
    case 'late': return `Ciao ${first}, ti scriviamo da ${shop}: la riparazione del tuo ${r.brand_model} richiede qualche giorno in più del previsto. Ti aggiorniamo appena possibile, grazie per la pazienza.${link}`;
    default: return `Ciao ${first}, ti scriviamo da ${shop} riguardo al tuo ${r.brand_model}.${link}`;
  }
}

// ---------- Pistola lettore codici a barre ----------
// Le pistole USB si comportano come una tastiera velocissima: scrivono i caratteri a raffica e chiudono con Invio.
// Teniamo il conto dei tasti consecutivi "troppo veloci per una persona" per riconoscere quell'Invio finale.
let scanRun = 0;
let scanLast = 0;
document.addEventListener('keydown', (e) => {
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = performance.now();
  scanRun = t - scanLast < 50 ? scanRun + 1 : 1;
  scanLast = t;
}, true);
/** Vero se questo Invio è la chiusura di una lettura con la pistola (almeno 4 caratteri a raffica appena prima). */
export const isScanEnter = (e) => e.key === 'Enter' && scanRun >= 4 && performance.now() - scanLast < 150;

/** Controllo IMEI (15 cifre, algoritmo di Luhn). */
export function imeiCheck(s) {
  const v = String(s || '').trim();
  if (!/^\d{15}$/.test(v)) return null; // non è un IMEI: nessun giudizio (può essere un seriale)
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(v[14 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
