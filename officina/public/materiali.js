// Materiali da ordinare: tutto cio' che e' "da ordinare" (ordini e ricambi delle riparazioni) raggruppato per fornitore,
// con testo pronto (WhatsApp / email / copia) e "segna ordinato" in blocco. In Impostazioni: promemoria giornaliero su Telegram.
import { $, $$, esc, api, toast, safe, waLink, META } from './util.js';

const shop = () => META.settings.shop_name || 'Informatix Repair';
const DAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Gio'], [5, 'Ven'], [6, 'Sab'], [0, 'Dom']];

const lineHtml = (l) => `<div><span>${l.qty}× ${esc(l.description)} <span class="hint">${esc(l.ref)}${l.for ? ` · per ${esc(l.for)}` : ''}${l.source === 'riparazione' ? ' · ricambio riparazione' : ''}</span></span></div>`;

export async function materialiView(el) {
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Materiali da ordinare</h1>
      <div class="row"><a class="btn btn-outline" href="#/ordini">📮 Ordini</a></div></div>
    <p class="hint">Qui trovi insieme tutto ciò che è “da ordinare”: gli ordini dei clienti e del negozio e i ricambi segnati “da ordinare” nelle riparazioni, divisi per fornitore.</p>
    <div id="mt-body" class="grid gap-4"></div>`;
  const body = $('#mt-body', el);
  let groups = [];
  async function load() {
    const d = await safe(() => api('GET', '/api/materiali'));
    groups = d?.groups || [];
    body.innerHTML = groups.length ? groups.map((g, n) => `<section class="card panel sec"><h3 class="sec-t">${esc(g.supplier_name)} <span class="hint">· ${g.lines.length} ${g.lines.length === 1 ? 'riga' : 'righe'}</span></h3>
        <div class="plist">${g.lines.map(lineHtml).join('')}</div>
        <div class="row">${g.supplier_phone ? `<a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(g.supplier_phone, g.text)}">💬 WhatsApp</a>` : ''}
          ${g.supplier_email ? `<a class="btn btn-outline btn-sm" href="mailto:${esc(g.supplier_email)}?subject=${encodeURIComponent('Ordine ' + shop())}&body=${encodeURIComponent(g.text)}">✉️ Email</a>` : ''}
          <button class="btn btn-outline btn-sm" data-copy="${n}">Copia testo</button>
          <button class="btn btn-dark btn-sm" data-sent="${n}">Fatto: segna ordinati</button></div></section>`).join('')
      : '<p class="empty card panel">Niente da ordinare: tutto è già stato richiesto ai fornitori 👍</p>';
  }
  body.onclick = async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { try { await navigator.clipboard.writeText(groups[Number(c.dataset.copy)].text); toast('Testo copiato'); } catch { toast('Copia non riuscita', false); } return; }
    const s = e.target.closest('[data-sent]');
    if (s) {
      const g = groups[Number(s.dataset.sent)];
      if (await safe(() => api('POST', '/api/materiali/mark-ordered', { order_ids: g.order_ids, part_ids: g.part_ids }))) { toast('Segnati come ordinati'); load(); }
    }
  };
  load();
}

/** Riquadro "Promemoria materiali da ordinare" per la pagina Impostazioni: orario, giorni e interruttore. */
export async function mountMaterialsSettings(host) {
  if (!host) return;
  const cfg = await safe(() => api('GET', '/api/materiali/config'));
  if (!cfg) return;
  const sec = document.createElement('section');
  sec.className = 'card panel sec lg:col-span-2 lg:col-start-1 lg:row-start-3';
  sec.id = 'st-materials';
  sec.innerHTML = `<h2 class="sec-t">Promemoria materiali da ordinare</h2>
    <p class="hint">Ogni giorno all’orario scelto arriva un messaggio su Telegram con l’elenco da ordinare, <b>solo se c’è qualcosa da ordinare</b>.</p>
    <div class="fgrid c2">
      <div class="field"><label class="l" for="mt-on">Promemoria</label><select id="mt-on"><option value="1" ${cfg.enabled ? 'selected' : ''}>Acceso</option><option value="0" ${cfg.enabled ? '' : 'selected'}>Spento</option></select></div>
      <div class="field"><label class="l" for="mt-time">Orario</label><input id="mt-time" type="time" value="${esc(cfg.time)}" /></div>
    </div>
    <div class="field"><span class="l">Giorni</span><div class="row">${DAYS.map(([d, l]) => `<label class="chip ${cfg.days.includes(d) ? 'on' : ''}" style="cursor:pointer"><input type="checkbox" data-day="${d}" ${cfg.days.includes(d) ? 'checked' : ''} hidden />${l}</label>`).join('')}</div>
      <span class="hint">Predefinito: dal lunedì al venerdì alle 12:00.</span></div>
    <div><button class="btn btn-primary" id="mt-save">Salva promemoria</button></div>`;
  host.after(sec);
  sec.addEventListener('change', (e) => { const cb = e.target.closest('[data-day]'); if (cb) cb.closest('.chip').classList.toggle('on', cb.checked); });
  $('#mt-save', sec).onclick = async () => {
    const days = $$('[data-day]', sec).filter((x) => x.checked).map((x) => x.dataset.day).join(',');
    if (!days) return toast('Scegli almeno un giorno', false);
    if (await safe(() => api('PUT', '/api/settings', { materials_reminder_enabled: $('#mt-on', sec).value, materials_reminder_time: $('#mt-time', sec).value || '12:00', materials_reminder_days: days }))) toast('Promemoria salvato');
  };
}
