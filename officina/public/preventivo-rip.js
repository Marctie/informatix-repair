// Invio del preventivo al cliente dalla scheda riparazione: validita' in giorni (predefinita da Impostazioni) e invio per WhatsApp, email o link.
import { $, esc, eur, fdate, api, toast, safe, openModal, waLink } from './util.js';

export async function sendQuoteDialog(repairId, done) {
  const info = await safe(() => api('GET', `/api/repairs/${repairId}/online-quote`));
  if (!info) return;
  const q = info.quote;
  const items = q ? q.items : info.items;
  const total = q ? q.total : items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const state = q ? `<div class="call tip" style="margin-bottom:.6rem"><b>${esc(q.code)} · ${esc(q.status_label)}</b>${q.status === 'accettato' ? ' Il cliente ha accettato dal suo link.' : q.status === 'rifiutato' ? ' Il cliente ha rifiutato.' : q.expired ? ' È scaduto: scegli una nuova validità e rinvialo.' : ` Valido fino al ${fdate(q.valid_until)}${q.sent_at ? ` · inviato il ${fdate(q.sent_at)} (${esc(q.sent_via || 'link')})` : ''}.`}</div>` : '';
  const canSend = !q || ['bozza', 'inviato'].includes(q.status);
  const m = openModal(`${state}
    <div class="plist">${items.map((i) => `<div><span>${esc(i.description)} <span class="hint">×${i.qty}</span></span><span>${eur(i.qty * i.unit_price)}</span></div>`).join('') || '<p class="hint">Nessuna voce: scrivi prima l’importo del preventivo nella scheda.</p>'}</div>
    <div class="total-box"><span>Totale <b>${eur(total)}</b></span></div>
    ${canSend ? `<div class="field" style="margin-top:.6rem"><label class="l" for="sq-days">Validità del preventivo (giorni)</label>
      <input id="sq-days" type="number" min="1" max="365" inputmode="numeric" value="${q && !q.expired ? Math.max(1, q.days_left ?? info.default_days) : info.default_days}" />
      <span class="hint">Predefinita da Impostazioni (${info.default_days} giorni). Il cliente lo vede dal suo link e dopo la scadenza non può più accettare.</span></div>
    <div class="row" id="sq-btns">
      <button class="btn btn-green" data-via="whatsapp" ${info.phone ? '' : 'disabled'}>💬 WhatsApp</button>
      <button class="btn btn-outline" data-via="email" ${info.email ? '' : 'disabled'}>✉️ Email</button>
      <button class="btn btn-dark" data-via="link">🔗 Copia link</button></div>
    <p class="hint">${info.phone || info.email ? '' : 'Il cliente non ha telefono né email in anagrafica: usa “Copia link”. '}L’invio prepara il messaggio già scritto: tu premi invia.</p>` : ''}`,
  { title: 'Preventivo per il cliente', footer: '<button class="btn btn-outline" data-close>Chiudi</button>' });
  const btns = $('#sq-btns', m.el);
  if (btns) btns.onclick = async (e) => {
    const b = e.target.closest('[data-via]');
    if (!b || b.disabled) return;
    const via = b.dataset.via;
    const out = await safe(() => api('POST', `/api/repairs/${repairId}/online-quote`, { valid_days: $('#sq-days', m.el).value, via }));
    if (!out) return;
    if (via === 'whatsapp') window.open(waLink(out.phone, out.text), '_blank', 'noopener');
    else if (via === 'email') window.location.href = `mailto:${out.email}?subject=${encodeURIComponent(out.subject)}&body=${encodeURIComponent(out.text)}`;
    else { try { await navigator.clipboard.writeText(out.url); toast('Link copiato: incollalo dove vuoi'); } catch { window.prompt('Copia questo link:', out.url); } }
    m.close();
    done?.();
    if (via !== 'link') toast(`Preventivo ${out.quote.code} pronto da inviare`);
  };
}
