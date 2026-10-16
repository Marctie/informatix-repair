// Carte punti NFC: emissione, lettura, accredito, riscatto in buono regalo, blocco/sostituzione. Tutta la logica e la sicurezza stanno sul server;
// qui c'e' solo l'interfaccia e il lettore (officina/public/nfc.js, uguale per qualunque lettore).
import { $, $$, esc, eur, fdt, api, toast, safe, openModal, META } from './util.js';
import { customerField, bindCustomer } from './pickers.js';
import { createNfc } from './nfc.js';

const STATUS_CLS = { attiva: 'bg-emerald-100 text-emerald-700', bloccata: 'bg-red-100 text-red-700', persa: 'bg-gray-200 text-gray-600', annullata: 'bg-gray-200 text-gray-600' };
const EVENT = { emissione: 'Emessa', verifica: 'Passaggio', accredito: 'Punti accreditati', riscatto: 'Riscatto', rettifica: 'Rettifica', riemissione: 'Nuovo codice sul chip', blocco: 'Bloccata', sblocco: 'Sbloccata', sostituzione: 'Sostituita', tentativo_fallito: 'Tentativo fallito', sospetta_clonazione: 'Sospetta copia' };
const isAdmin = () => META.role !== 'staff' && META.role !== 'cassa';
// Il lettore USB "tastiera" puo' stampare l'UID in esadecimale o decimale, e a volte coi byte invertiti: si sceglie qui e si ricorda su questa postazione.
const HID_KEY = 'ix-nfc-hid';
const hidOpts = (() => { try { return { format: 'hex', reverse: false, ...JSON.parse(localStorage.getItem(HID_KEY) || '{}') }; } catch { return { format: 'hex', reverse: false }; } })();
const nfc = createNfc({ options: { hid: hidOpts } });

function readerBar(host, onStatus) {
  const opts = nfc.list();
  host.innerHTML = `<div class="fgrid c2" style="align-items:end">
      <div class="field"><label class="l" for="nf-adapter">Lettore</label><select id="nf-adapter">${opts.map((o) => `<option value="${o.id}" ${o.available ? '' : 'disabled'}>${esc(o.label)}${o.available ? '' : ' (non disponibile qui)'}</option>`).join('')}</select></div>
      <div class="field"><button class="btn btn-dark" id="nf-toggle">▶ Attiva lettore</button></div>
    </div>
    <div class="fgrid c2" id="nf-hidopt" style="display:none">
      <div class="field"><label class="l" for="nf-fmt">Come scrive l’UID il lettore USB</label><select id="nf-fmt"><option value="hex">Esadecimale (04A1B2C3)</option><option value="dec">Numero decimale</option></select></div>
      <div class="field"><label class="l" for="nf-rev">Ordine dei byte</label><select id="nf-rev"><option value="0">Normale</option><option value="1">Invertito</option></select></div></div>
    <div class="field" id="nf-hand" style="display:none"><label class="l" for="nf-uid">UID a mano</label>
      <div class="row nowrap"><input id="nf-uid" data-nfc-wedge autocomplete="off" placeholder="es. 04A1B2C3" /><button class="btn btn-outline" id="nf-go">Leggi</button></div>
      <span class="hint">Con un lettore USB metti il cursore qui e passa la carta: l’UID si scrive da solo e Invio lo manda.</span></div>
    <p class="hint" id="nf-status" role="status">Lettore spento.</p>`;
  const sel = $('#nf-adapter', host); const toggle = $('#nf-toggle', host); const hand = $('#nf-hand', host);
  const first = opts.find((o) => o.available);
  if (first) sel.value = first.id;
  const hidBox = $('#nf-hidopt', host);
  $('#nf-fmt', host).value = hidOpts.format; $('#nf-rev', host).value = hidOpts.reverse ? '1' : '0';
  const saveHid = () => { hidOpts.format = $('#nf-fmt', host).value; hidOpts.reverse = $('#nf-rev', host).value === '1'; try { localStorage.setItem(HID_KEY, JSON.stringify(hidOpts)); } catch { /* memoria del browser non disponibile */ } };
  $('#nf-fmt', host).onchange = saveHid; $('#nf-rev', host).onchange = saveHid;
  const sync = () => { hand.style.display = ['manual', 'hid'].includes(sel.value) ? '' : 'none'; hidBox.style.display = sel.value === 'hid' ? '' : 'none'; };
  sync();
  nfc.onStatus((s) => {
    const t = $('#nf-status', host);
    if (!t) return;
    t.textContent = s.state === 'listening' ? '📡 In ascolto: avvicina la carta al lettore.' : s.state === 'error' ? `⚠️ ${s.error}` : 'Lettore spento.';
    toggle.textContent = s.state === 'listening' ? '■ Ferma lettore' : '▶ Attiva lettore';
    onStatus?.(s);
  });
  sel.onchange = async () => { await nfc.stop(); sync(); };
  toggle.onclick = async () => {
    if (nfc.running) return nfc.stop();
    try { await nfc.use(sel.value); await nfc.start(); } catch (e) { toast(e.message, false); }
  };
  $('#nf-go', host).onclick = () => {
    const v = $('#nf-uid', host).value;
    try { nfc.submit(v); $('#nf-uid', host).value = ''; } catch (e) { toast(e.message, false); }
  };
  $('#nf-uid', host).onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const taken = e.defaultPrevented; // già preso dal lettore USB attivo (adattatore "tastiera")
    e.preventDefault();
    if (taken) { $('#nf-uid', host).value = ''; return; }
    $('#nf-go', host).click();
  };
}

/** Prova a scrivere il nuovo codice sul chip; se il lettore non scrive, lo dice chiaramente. */
async function writeToken(token) {
  if (!token) return;
  try {
    if (await nfc.write(token)) toast('Codice nuovo scritto sul chip');
    else toast('Questo lettore non scrive sul chip: il codice resta valido solo col PIN (usa “Riscrivi codice” da un telefono con NFC)', false);
  } catch (e) { toast(`Scrittura sul chip non riuscita: ${e.message}. Usa “Riscrivi codice”.`, false); }
}

export async function carteView(el) {
  const meta = await safe(() => api('GET', '/api/carte/meta'));
  if (!meta) return;
  const R = meta.rules;
  el.innerHTML = `<div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Carte punti</h1><button class="btn btn-primary" id="ca-new">＋ Nuova carta</button></div>
    ${meta.configured ? '' : '<div class="call warn"><b>Manca il segreto delle carte</b>Imposta <code>NFC_SECRET</code> (o <code>VAULT_KEY</code>): senza non si può emettere né verificare nessuna carta. Vedi il manuale.</div>'}
    <div class="grid lg:grid-cols-3 gap-5 items-start">
      <section class="card panel sec lg:col-span-2"><h2 class="sec-t">Lettore</h2><div id="ca-reader"></div></section>
      <section class="card panel sec"><h2 class="sec-t">Regole dei punti</h2>
        <p class="hint">Provvisorie, in attesa del regolamento definitivo. Oggi: <b>${R.points_per_euro}</b> punti per ogni euro; ogni <b>${R.redeem_step}</b> punti = buono regalo da <b>${eur(R.euro_per_step)}</b>, valido ${R.voucher_months} mesi. Massimo ${R.max_accrual} punti per operazione e ${R.max_redeem_day} punti riscattabili al giorno per carta.</p>
        ${isAdmin() ? '<button class="btn btn-outline btn-sm" id="ca-rules">Modifica le regole</button>' : ''}</section>
    </div>
    <div id="ca-scan"></div>
    <input id="ca-q" type="search" placeholder="Cerca per cliente, telefono o numero carta…" />
    <div class="card overflow-hidden" id="ca-list"></div>`;
  readerBar($('#ca-reader', el));
  const off = nfc.onTag((tag) => { if (el.isConnected) onTag(tag); else off(); });
  const list = $('#ca-list', el);
  async function load() {
    const rows = await safe(() => api('GET', `/api/carte?q=${encodeURIComponent($('#ca-q', el).value.trim())}`)) || [];
    list.innerHTML = rows.length ? rows.map((k) => `<div class="row-h flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 cursor-pointer" data-open="${k.id}">
        <div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 flex-wrap"><b class="text-sm">${esc(k.customer_name)}</b><span class="badge ${STATUS_CLS[k.status]}">${esc(k.status_label)}</span></div>
          <p class="text-xs text-gray-500 truncate">${esc(k.card_no)} · ${k.last_used_at ? `ultimo uso ${fdt(k.last_used_at)}` : 'mai usata'}</p></div>
        <b class="text-sm shrink-0">${k.points} pt</b></div>`).join('') : '<p class="empty">Nessuna carta. Premi “Nuova carta” e avvicina il chip del cliente.</p>';
  }
  $('#ca-q', el).oninput = () => { clearTimeout(load.t); load.t = setTimeout(load, 250); };
  list.onclick = (e) => { const r = e.target.closest('[data-open]'); if (r) openCard(Number(r.dataset.open), null, load); };
  $('#ca-new', el).onclick = () => newCardDialog(load);
  const rulesBtn = $('#ca-rules', el);
  if (rulesBtn) rulesBtn.onclick = () => rulesDialog(R, () => carteView(el));
  load();

  async function onTag(tag) {
    const out = await safe(() => api('POST', '/api/carte/scan', { uid: tag.uid, token: tag.token }));
    if (!out) return;
    openCard(out.card.id, out, load);
    if (out.next_token) writeToken(out.next_token); // il codice vecchio non vale piu': subito quello nuovo sul chip
  }
}

/** Scheda carta: saldo, azioni, storico. `scan` = risultato del passaggio (con la sessione verificata), se la carta e' stata appena letta. */
async function openCard(id, scan, done) {
  const d = await safe(() => api('GET', `/api/carte/${id}`));
  if (!d) return;
  let session = scan?.session || null;
  const level = scan?.level || null;
  const k = d.card;
  const m = openModal('', { title: `${k.card_no} · ${k.customer_name}`, wide: true, footer: '<button class="btn btn-outline" data-close>Chiudi</button>' });
  const body = $('.modal-body', m.el);
  const draw = (card, events) => {
    body.innerHTML = `<div class="total-box"><span>Punti <b style="font-size:1.4rem">${card.points}</b></span><span><span class="badge ${STATUS_CLS[card.status]}">${esc(card.status_label)}</span> ${level === 'token' ? '<span class="badge bg-emerald-100 text-emerald-700">codice verificato</span>' : level === 'uid' ? '<span class="badge bg-amber-100 text-amber-800">solo UID: per riscattare serve il PIN</span>' : ''}</span></div>
      ${card.locked_reason ? `<div class="call warn"><b>${esc(card.status_label)}</b>${esc(card.locked_reason)}</div>` : ''}
      ${session && card.status === 'attiva' ? `<div class="row tight"><button class="btn btn-dark btn-sm" data-act="accrue">＋ Accredita punti da vendita/riparazione</button><button class="btn btn-green btn-sm" data-act="redeem">🎁 Riscatta in buono</button></div>` : card.status === 'attiva' ? '<p class="hint">Per accreditare o riscattare avvicina la carta al lettore (la verifica dura 5 minuti).</p>' : ''}
      <div class="row tight" style="margin-top:.5rem">
        ${card.status === 'attiva' ? '<button class="btn btn-outline btn-sm" data-act="block">Blocca</button><button class="btn btn-outline btn-sm" data-act="reissue">Riscrivi codice</button>' : ''}
        ${isAdmin() && card.status === 'bloccata' ? '<button class="btn btn-outline btn-sm" data-act="unblock">Sblocca</button>' : ''}
        ${isAdmin() && ['attiva', 'bloccata'].includes(card.status) ? '<button class="btn btn-outline btn-sm" data-act="adjust">Rettifica punti</button><button class="btn btn-outline btn-sm" data-act="replace">Carta persa / sostituisci</button>' : ''}</div>
      <h3 class="sec-t" style="margin-top:1rem">Storico</h3>
      <div class="plist">${events.map((e) => `<div><span>${esc(EVENT[e.kind] || e.kind)} ${e.points ? `<b>${e.points > 0 ? '+' : ''}${e.points}</b>` : ''} <span class="hint">${esc(e.detail || '')}${e.voucher_code ? ` · buono ${esc(e.voucher_code)}` : ''}</span></span><span class="hint">${fdt(e.created_at)} · ${esc(e.by_user || '')}</span></div>`).join('') || '<p class="hint">Nessun movimento.</p>'}</div>`;
  };
  draw(k, d.events);
  const reload = async () => { const x = await safe(() => api('GET', `/api/carte/${id}`)); if (x) draw(x.card, x.events); done?.(); return x; };
  body.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'block') { const why = window.prompt('Motivo del blocco (resta nel registro):', 'carta smarrita'); if (why !== null && (await safe(() => api('POST', `/api/carte/${id}/block`, { reason: why })))) { toast('Carta bloccata'); reload(); } }
    if (act === 'unblock') { const why = window.prompt('Perché la sblocchi? (resta nel registro)', 'cliente identificato in negozio'); if (why && (await safe(() => api('POST', `/api/carte/${id}/unblock`, { reason: why })))) { toast('Carta sbloccata'); reload(); } }
    if (act === 'adjust') {
      const p = window.prompt('Punti da aggiungere (o togliere, con il meno):'); if (!p) return;
      const why = window.prompt('Motivo della rettifica (obbligatorio, resta nel registro):'); if (!why) return;
      if (await safe(() => api('POST', `/api/carte/${id}/adjust`, { points: p, reason: why }))) { toast('Saldo rettificato'); reload(); }
    }
    if (act === 'reissue') {
      const pin = isAdmin() ? '' : window.prompt('PIN della carta (lo sa il cliente):') || '';
      const out = await safe(() => api('POST', `/api/carte/${id}/reissue`, { pin }));
      if (out) { await writeToken(out.token); reload(); }
    }
    if (act === 'replace') {
      const uid = window.prompt('Nuovo chip: scrivi o incolla il suo UID (es. 04A1B2C3):'); if (!uid) return;
      const out = await safe(() => api('POST', `/api/carte/${id}/replace`, { uid }));
      if (out) { await writeToken(out.token); openModal(`<p>Nuova carta <b>${esc(out.card.card_no)}</b> con ${esc(out.card.points)} punti.</p><p>PIN da dare al cliente: <b style="font-size:1.4em;letter-spacing:.1em">${esc(out.pin)}</b></p><p class="hint">Il PIN non viene più mostrato: scrivilo o comunicalo ora.</p>`, { title: 'Carta sostituita', footer: '<button class="btn btn-primary" data-close>Ho capito</button>' }); m.close(); done?.(); }
    }
    if (act === 'accrue') accrueDialog(k, session, async () => { reload(); });
    if (act === 'redeem') redeemDialog(id, session, level, async () => { reload(); });
  };
}

async function accrueDialog(card, session, done) {
  const rows = (await safe(() => api('GET', `/api/carte/creditable?customer_id=${card.customer_id}`))) || [];
  const m = openModal(rows.length ? `<p class="hint">Vendite e riparazioni consegnate di ${esc(card.customer_name)} non ancora premiate. L’importo lo legge il server dal documento.</p>
    <div class="plist">${rows.map((r, i) => `<div><span>${r.ref_kind === 'sale' ? '🛒' : '🛠️'} ${esc(r.code)} <span class="hint">${eur(r.amount)}</span></span><button class="btn btn-dark btn-sm" data-i="${i}">＋ ${r.points} punti</button></div>`).join('')}</div>`
    : '<p class="empty">Niente da accreditare: tutte le vendite e riparazioni consegnate hanno già dato i loro punti.</p>', { title: 'Accredita punti' });
  m.el.onclick = async (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const r = rows[Number(b.dataset.i)];
    if (await safe(() => api('POST', `/api/carte/${card.id}/accrue`, { ref_kind: r.ref_kind, ref_id: r.ref_id, session }))) { toast(`${r.points} punti accreditati`); m.close(); done(); }
  };
}

function redeemDialog(id, session, level, done) {
  const m = openModal(`<div class="field"><label class="l" for="rd-p">Punti da riscattare</label><input id="rd-p" inputmode="numeric" placeholder="multipli di ${esc(String(META.settings?.loyalty_redeem_step || 100))}" /></div>
    ${level === 'token' ? '' : '<div class="field"><label class="l" for="rd-pin">PIN della carta</label><input id="rd-pin" inputmode="numeric" type="password" autocomplete="off" /><span class="hint">La carta è stata letta solo dall’UID: il PIN dimostra che è del cliente.</span></div>'}`,
  { title: 'Riscatta in buono regalo', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="rd-ok">Crea il buono</button>' });
  $('#rd-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', `/api/carte/${id}/redeem`, { points: $('#rd-p', m.el).value, session, pin: $('#rd-pin', m.el)?.value || '' }));
    if (out) { m.close(); toast(`Buono ${out.voucher.code} da ${eur(out.voucher.value)} creato (scade il ${out.voucher.expires_at})`); done(); }
  };
}

function newCardDialog(done) {
  const m = openModal(`${customerField('nc-c', 'Cliente', { required: true })}
    <div class="field"><label class="l" for="nc-uid">UID del chip</label><input id="nc-uid" data-nfc-wedge autocomplete="off" placeholder="avvicina il chip al lettore o scrivi l’UID" />
      <span class="hint">Con il lettore attivo (sopra) si compila da solo.</span></div>
    <div class="field"><label class="l" for="nc-pin">PIN <span style="font-weight:500;color:var(--muted)">(facoltativo: se vuoto lo scelgo io)</span></label><input id="nc-pin" inputmode="numeric" maxlength="8" autocomplete="off" /></div>`,
  { title: 'Nuova carta punti', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="nc-ok">Emetti la carta</button>' });
  const cust = bindCustomer(m.el, 'nc-c', null, { allowNone: false });
  const off = nfc.onTag((t) => { const i = $('#nc-uid', m.el); if (i) i.value = t.uid; });
  m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) off(); });
  $('#nc-ok', m.el).onclick = async () => {
    const out = await safe(() => api('POST', '/api/carte/issue', { customer_id: cust.value(), uid: $('#nc-uid', m.el).value, pin: $('#nc-pin', m.el).value }));
    if (!out) return;
    off(); m.close(); done?.();
    await writeToken(out.token);
    const r = openModal(`<div class="call tip"><b>Carta ${esc(out.card.card_no)} emessa</b>${esc(out.card.customer_name)}</div>
      <p style="margin:.6rem 0">PIN della carta (mostrato <b>una volta sola</b>, consegnalo al cliente):</p>
      <p class="font-heading" style="font-size:2.2rem;letter-spacing:.3rem;font-weight:800;text-align:center">${esc(out.pin)}</p>
      <p class="hint">Se il lettore non ha scritto il codice sul chip, la carta funziona comunque con UID + PIN. Il codice si può riscrivere da una scheda con “Riscrivi codice”.</p>`, { title: 'Carta pronta', footer: '<button class="btn btn-primary" data-close>Fatto, PIN consegnato</button>' });
    return r;
  };
}

function rulesDialog(R, done) {
  const rows = [['loyalty_points_per_euro', 'Punti per ogni euro speso', R.points_per_euro], ['loyalty_redeem_step', 'Punti per ogni “gradino” di riscatto', R.redeem_step], ['loyalty_euro_per_step', 'Euro di buono per ogni gradino', R.euro_per_step],
    ['loyalty_voucher_months', 'Validità del buono (mesi)', R.voucher_months], ['loyalty_max_accrual', 'Massimo punti per operazione', R.max_accrual], ['loyalty_max_redeem_day', 'Massimo punti riscattabili al giorno (per carta)', R.max_redeem_day]];
  const m = openModal(`<div class="fgrid c2">${rows.map(([k, l, v]) => `<div class="field"><label class="l" for="${k}">${l}</label><input id="${k}" data-k="${k}" inputmode="decimal" value="${esc(v)}" /></div>`).join('')}</div>
    <p class="hint">Cambiano solo le operazioni future: i punti già dati non si ricalcolano.</p>`,
  { title: 'Regole dei punti', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="rl-ok">Salva</button>' });
  $('#rl-ok', m.el).onclick = async () => {
    const body = Object.fromEntries($$('[data-k]', m.el).map((i) => [i.dataset.k, i.value]));
    if (await safe(() => api('PUT', '/api/settings', body))) { m.close(); toast('Regole salvate'); done?.(); }
  };
}
