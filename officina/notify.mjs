// Notifiche Telegram al proprietario: ogni azione sul gestionale, accessi ed errori.
// Solo invio: il bot non riceve comandi, quindi nessun altro può usarlo. Il messaggio va SOLO a TELEGRAM_OWNER_ID.
// Configurazione (segreti del Worker, mai nel codice):  TELEGRAM_BOT_TOKEN  e  TELEGRAM_OWNER_ID.
// Senza configurazione il sistema non fa nulla. Dati sensibili (PIN dei dispositivi, password, token) non vengono mai inviati.
// I testi usano i dati veri: prima dell'azione si leggono dal database i nomi di cio' che si elimina o si tocca (`pre`),
// dopo l'azione gli incassi effettivi (`post`). Le operazioni minori (stampe, foto, checklist...) arrivano senza suono.
import { db, DEFAULT_SETTINGS } from './dbref.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SECRET_KEYS = /pass|pin|token|secret|password|cookie/i;
const eur = (n) => (n == null || n === '' ? '—' : `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const short = (s, n = 80) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const maskPhone = (p) => (p ? String(p).replace(/\s/g, '').replace(/.(?=.{3})/g, '•') : '');
const join = (...a) => a.filter((x) => x != null && x !== '').join(' · ');
/** 2026-10-30 -> 30/10/2026 (anche con l'ora: 2026-10-16 09:30 -> 16/10 09:30). */
const dmy = (d) => { const t = String(d ?? ''); const x = t.match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d:\d\d))?/); return x ? (x[4] ? `${x[3]}/${x[2]} ${x[4]}` : `${x[3]}/${x[2]}/${x[1]}`) : t; };
const cap = (t) => { const s = String(t ?? ''); return s.charAt(0).toUpperCase() + s.slice(1); };

const STATUS = { received: 'Ricevuto', diagnosing: 'In diagnosi', quote_pending: 'Preventivo da approvare', approved: 'Preventivo approvato', waiting_parts: 'In attesa ricambi', repairing: 'In riparazione', ready: 'Pronto per il ritiro', delivered: 'Consegnato', cancelled: 'Annullato' };
const FIELD = { brand_model: 'dispositivo', problem: 'problema', quote: 'preventivo', eta_date: 'data stimata', final_price: 'prezzo finale', tech_notes: 'note tecniche', customer_note: 'nota al cliente', serial: 'seriale', accessories: 'accessori', condition_notes: 'condizioni', urgent: 'urgenza', warranty_days: 'garanzia', device_type: 'tipo', customer: 'cliente', sign_requested: 'firma a distanza', quote_option_id: 'opzione scelta' };
const SETTING = {
  shop_name: 'nome negozio', shop_address: 'indirizzo', shop_phone: 'telefono negozio', public_base_url: 'indirizzo pubblico', default_warranty_days: 'garanzia (giorni)',
  terms: 'condizioni sulla scheda', low_stock_default: 'scorta minima generale', stale_days: 'giorni prodotto fermo', ready_days: 'giorni pronta non ritirata',
  storage_days: 'giorni di giacenza', storage_fee: 'tariffa del deposito', legal_verified: 'stato dei testi legali', quote_valid_days: 'validità preventivi (giorni)',
  loyalty_points_per_euro: 'punti per euro (carte)', loyalty_redeem_step: 'punti per gradino di riscatto', loyalty_euro_per_step: 'euro per gradino di riscatto', loyalty_voucher_months: 'validità buono punti (mesi)', loyalty_max_accrual: 'massimo punti per operazione', loyalty_max_redeem_day: 'massimo punti riscattabili al giorno',
  materials_reminder_enabled: 'promemoria materiali da ordinare', materials_reminder_time: 'orario promemoria materiali', materials_reminder_days: 'giorni promemoria materiali',
  consent_intake: 'testo consenso all’ingresso', quote_accept_title: 'titolo accettazione preventivo', quote_accept_text: 'testo accettazione preventivo',
  quote_decline_title: 'titolo rifiuto preventivo', quote_decline_text: 'testo rifiuto preventivo', quote_decline_pickup: 'testo ritiro dopo il rifiuto',
  quote_decline_cede: 'testo cessione dopo il rifiuto', quote_sign_text: 'testo firma del preventivo', storage_notice: 'avviso di giacenza',
};
const PHASE = { in: 'all’ingresso', pre: 'al ritiro in laboratorio', out: 'collaudo finale' };
const FATE = { giacenza: 'in giacenza (attende il ritiro)', ritirato: 'ritirato dal cliente', ceduto: 'lasciato al negozio (smaltire / pezzi)', deposito: 'in deposito a pagamento', smaltito: 'smaltito / recuperato' };
const VOUCHER = { regalo: 'Buono regalo', sconto_importo: 'Buono sconto', sconto_percentuale: 'Buono sconto %' };
const DEVICE_FLAG = { ok: 'regolare', stolen: 'RUBATO / smarrito', check: 'DA VERIFICARE' };
const DOC = { carta_identita: 'Carta d’identità', patente: 'Patente', passaporto: 'Passaporto', altro: 'Documento' };
const PRINT = { customer: 'scheda cliente', repair: 'scheda cliente', lab: 'scheda laboratorio', both: 'scheda cliente + laboratorio', label: 'etichetta', sale: 'ricevuta di vendita', quote: 'preventivo', voucher: 'buono' };
// Sezioni del gestionale, per dire in parole cosa si stava facendo quando qualcosa va storto
const SECTIONS = [[/^\/api\/repairs/, 'Riparazioni'], [/^\/api\/track/, 'Tracciamento cliente'], [/^\/api\/sales/, 'Vendite'], [/^\/api\/customers|^\/api\/clienti/, 'Clienti'], [/^\/api\/suppliers/, 'Fornitori'],
  [/^\/api\/products|^\/api\/stock|^\/api\/reorder/, 'Magazzino'], [/^\/api\/services/, 'Listino servizi'], [/^\/api\/expenses/, 'Spese'], [/^\/api\/usati/, 'Vetrina usati'], [/^\/api\/orders/, 'Ordini'],
  [/^\/api\/quotes/, 'Preventivi'], [/^\/api\/reminders/, 'Promemoria'], [/^\/api\/buoni/, 'Buoni'], [/^\/api\/carte/, 'Carte punti'], [/^\/api\/materiali/, 'Materiali da ordinare'], [/^\/api\/dispositivi/, 'Dispositivi'], [/^\/api\/documenti/, 'Documenti d’identità'],
  [/^\/api\/credenziali/, 'Credenziali fornitori'], [/^\/api\/purchases/, 'Acquisti'], [/^\/api\/users/, 'Utenti'], [/^\/api\/settings|^\/api\/checklists/, 'Impostazioni'], [/^\/api\/audit/, 'Registro'],
  [/^\/api\/backup/, 'Backup'], [/^\/api\/demo/, 'Dati demo'], [/^\/print\//, 'Stampa']];
const VERB = { POST: 'registrare', PUT: 'modificare', PATCH: 'modificare', DELETE: 'eliminare', GET: 'aprire' };
const section = (path) => SECTIONS.find(([re]) => re.test(path))?.[1] || path;

/** Toglie dai testi d'errore qualunque cosa somigli a un token di bot. */
const scrub = (t) => String(t ?? '').replace(/\d{6,}:[A-Za-z0-9_-]{30,}/g, '[token]');
/** Elenca i campi inviati (senza i valori sensibili). */
const fields = (body, map = FIELD) => Object.keys(body || {}).filter((k) => !SECRET_KEYS.test(k)).map((k) => map[k] || k).join(', ');
/** Importo e metodi di un acconto (singolo oppure diviso in piu' quote). */
const depositList = (b) => (Array.isArray(b?.payments) && b.payments.length ? b.payments : [{ amount: b?.amount, method: b?.method }]);
const depositTotal = (b) => depositList(b).reduce((a, p) => a + (Number(String(p.amount ?? 0).replace(',', '.')) || 0), 0);
const depositHow = (b) => depositList(b).map((p) => `${esc(p.method || 'contanti')}${depositList(b).length > 1 ? ` ${eur(String(p.amount).replace(',', '.'))}` : ''}`).join(' + ');
/** Riga "codice · dispositivo · cliente" di una riparazione (dalla risposta o, se manca, dal database). */
const repLine = (r, p) => join(esc(r.code || p.code), esc(r.brand_model || p.brand_model), esc(r.customer_name || p.customer_name));
const payList = (rows) => rows.map((p) => `${esc(p.method)} ${eur(p.amount)}${/\((.+)\)$/.test(p.label || '') ? ` (${esc(p.label.match(/\((.+)\)$/)[1])})` : ''}`).join(' + ');

/** Impostazioni davvero cambiate (il modulo manda sempre tutti i campi): confronto con i valori di prima. */
function settingChanges(body, prev) {
  const out = [];
  for (const [k, v] of Object.entries(body || {})) {
    if (SECRET_KEYS.test(k)) continue;
    const before = prev ? (prev[k] ?? DEFAULT_SETTINGS[k] ?? '') : undefined;
    if (before !== undefined && String(before) === String(v ?? '')) continue;
    const label = SETTING[k] || k;
    const val = String(v ?? '');
    if (k === 'legal_verified') out.push(`${label}: ${val === '1' ? 'testi verificati' : 'bozza da far verificare'}`);
    else if (before !== undefined && val.length <= 40 && String(before).length <= 40 && !val.includes('\n')) out.push(`${label}: ${esc(before) || '—'} → ${esc(val) || '—'}`);
    else out.push(`${label} (testo modificato)`);
  }
  return out;
}

/** Costruisce il testo (HTML di Telegram) di un evento. Restituisce null se non vale la pena avvisare. */
export function describeEvent({ method, path, status, user, body = {}, result = {}, error, denied, login, ip, country, pre = {}, post = {} }) {
  const who = user ? `${esc(user.name || user.email)} (${esc(user.email)})` : denied ? `${esc(denied)} (non abilitato)` : /^\/api\/(track|quote)\//.test(path || '') ? 'cliente (dal link)' : 'visitatore';
  const where = [ip && `IP ${esc(ip)}`, country && esc(country)].filter(Boolean).join(' · ');
  const foot = `\n👤 ${who}${where ? `\n🌐 ${where}` : ''}`;

  if (denied) return `🚫 <b>Accesso negato</b>\nL’indirizzo ${esc(denied)} ha provato a entrare nel gestionale ma non è nell’elenco utenti.${foot}`;
  if (login) return `🔑 <b>Accesso al gestionale</b>${foot}`;
  if (status >= 500) return `🔴 <b>ERRORE ${status}</b> in ${esc(section(path))}\n${esc(method)} ${esc(path)}\n${error ? `<code>${esc(short(scrub(error), 600))}</code>` : 'Errore interno'}${foot}`;

  const m = method.toUpperCase();
  const r = result || {};
  const p = pre || {};
  const isOk = status >= 200 && status < 300;
  const fail = (what) => `⚠️ <b>${esc(what)}: operazione non riuscita</b> (${status})\n${esc(short(r.error || '', 200))}${foot}`;
  if (status === 401 || status === 403) return `⛔ <b>Operazione non permessa</b> (${status})\nTentativo di ${VERB[m] || m} in ${esc(section(path))}\n${esc(short(r.error || '', 200))}${foot}`;
  const alerts = (list) => (list || []).map((a) => `\n🚨 <b>Seriale segnalato</b>: ${esc(short(a.brand_model || a.title || '', 60))} ${esc(a.flag_label || DEVICE_FLAG[a.flag] || '')}`.trimEnd()).join('');

  // ---- Riparazioni
  let x;
  if (m === 'POST' && path === '/api/repairs') {
    if (!isOk) return fail('Nuova riparazione');
    const money = [r.quote != null ? `Preventivo ${eur(r.quote)}` : 'Preventivo da fare', Number(r.deposit) > 0 ? `acconto ${eur(r.deposit)}${body.deposit_method ? ` (${esc(body.deposit_method)})` : ''}` : ''];
    return `🛠️ <b>Nuova riparazione ${esc(r.code)}</b>${r.urgent ? ' · 🔥 URGENTE' : ''}\n${esc(r.brand_model)} — ${esc(short(r.problem || body.problem, 120))}\nCliente: ${esc(r.customer_name)} ${esc(maskPhone(r.customer_phone))}\n${join(...money)}${r.status === 'approved' ? '\n✅ Preventivo concordato al banco' : ''}${alerts(r.device_alerts)}${foot}`;
  }
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/status$/)) && m === 'POST') return isOk ? `🔄 <b>${esc(r.code)}</b> → ${esc(STATUS[r.status] || r.status)}\n${join(esc(r.brand_model), esc(r.customer_name))}${r.status === 'cancelled' && r.device_fate ? `\n📦 Dispositivo ${esc(FATE[r.device_fate] || r.device_fate)}` : ''}${body.note ? `\nNota: ${esc(short(body.note, 150))}` : ''}${foot}` : fail('Cambio stato');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/advance$/)) && m === 'POST') return isOk ? `⏭️ <b>${esc(r.code)}</b> → ${esc(STATUS[r.status] || r.status)}\n${join(esc(r.brand_model), esc(r.customer_name))}${foot}` : fail('Avanzamento');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/deliver$/)) && m === 'POST') {
    if (!isOk) return fail('Consegna');
    const now = (post.payments || []).filter((q) => /^Saldo /.test(q.label || ''));
    const cash = now.filter((q) => q.method !== 'buono');
    const prev = (post.payments || []).filter((q) => !/^Saldo /.test(q.label || '')).reduce((a, q) => a + Number(q.amount || 0), 0);
    const vouchers = (post.vouchers || []).map((v) => `\n🎁 ${esc(VOUCHER[v.kind] || 'Buono')} ${esc(v.code)}: ${eur(v.amount)}${v.kind === 'regalo' ? ' (credito del buono)' : ' di sconto'}`).join('');
    const paidNow = cash.length ? `💶 Incassato ora ${eur(r.collected)}: ${payList(cash)}` : `💶 Incassato ora ${eur(r.collected)}${r.collected > 0 && body.method ? ` (${esc(body.method)})` : ''}`;
    return `📦 <b>Consegnata ${esc(r.code)}</b>\n${join(esc(r.brand_model), esc(r.customer_name))}\nTotale ${eur(r.final_price)}${prev > 0 ? ` · già versati ${eur(prev)} di acconto` : ''}\n${paidNow}${vouchers}${foot}`;
  }
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/deposit$/)) && m === 'POST') return isOk ? `💶 <b>Acconto ${eur(depositTotal(body))}</b> (${depositHow(body)}) su ${esc(r.code)}\n${join(esc(r.brand_model), esc(r.customer_name))}\nVersato finora: ${eur(r.paid)}${foot}` : fail('Acconto');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/note$/)) && m === 'POST') return isOk ? `📝 <b>Nota su ${esc(r.code)}</b> (${body.public === false ? 'interna' : 'visibile al cliente'})\n${esc(short(body.note, 250))}${foot}` : fail('Nota');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/parts\/(\d+)\/stock$/)) && m === 'POST') return isOk ? `📦 <b>Ricambio caricato a magazzino</b>: ${esc(short(r.name, 80))}${r.created ? ' (nuovo articolo)' : ''}\nDa ${repLine({}, p)}${foot}` : fail('Carico del ricambio a magazzino');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/parts(\/\d+)?$/))) {
    if (!isOk) return fail('Ricambi');
    if (m === 'DELETE') return `🔩 <b>Ricambio tolto</b> da ${esc(r.code)}${foot}`;
    const last = (r.parts || []).at(-1) || {};
    const name = body.name || last.name || (body.product_id ? `prodotto #${body.product_id}` : '');
    return `🔩 <b>Ricambio aggiunto</b> su ${esc(r.code)}\n${esc(short(name, 100))} ×${esc(body.qty || last.qty || 1)}${body.product_id ? ' (dal magazzino)' : last.unit_cost ? ` · costo ${eur(last.unit_cost)}` : ''}${foot}`;
  }
  if ((x = path.match(/^\/api\/repairs\/(\d+)$/)) && m === 'PATCH') {
    if (!isOk) return fail('Modifica riparazione');
    const f = fields(body);
    if (!f) return null; // solo campi riservati (es. PIN): niente da dire
    return `✏️ <b>Riparazione ${esc(r.code)} modificata</b>\n${join(esc(r.brand_model), esc(r.customer_name))}\nCampi: ${esc(f)}${body.quote != null ? `\nPreventivo: ${eur(body.quote)}` : ''}${body.final_price != null ? `\nPrezzo finale: ${eur(body.final_price)}` : ''}${alerts(r.device_alerts)}${foot}`;
  }
  if ((x = path.match(/^\/api\/repairs\/(\d+)$/)) && m === 'DELETE') {
    if (!isOk) return fail('Eliminazione riparazione');
    const cash = Number(p.pay_sum) > 0 ? `\n💶 Tolti dalla cassa ${esc(p.pay_n)} incass${p.pay_n === 1 ? 'o' : 'i'} per ${eur(p.pay_sum)}` : '';
    return `🗑️ <b>Riparazione eliminata</b> ${repLine({}, p) || `n. ${esc(x[1])}`}${cash}${foot}`;
  }
  if ((x = path.match(/^\/api\/track\/([^/]+)\/decision$/)) && m === 'POST') {
    if (!isOk) return fail('Risposta del cliente al preventivo');
    const yes = body.action !== 'decline';
    const what = body.action === 'decline' ? (body.device_choice === 'cede' ? '\n📦 Ha CEDUTO il dispositivo al negozio (da smaltire / recuperare pezzi)' : '\n📦 Ritirerà il dispositivo non riparato: giacenza di 15 giorni') : body.action === 'option' ? `\nSoluzione scelta: ${esc(short(r.my_decision?.option_label, 80))} · ${eur(r.quote)}` : `\nImporto: ${eur(r.quote)}`;
    return `${yes ? '✅' : '❌'} <b>Il cliente ha ${yes ? 'APPROVATO' : 'RIFIUTATO'} il preventivo</b> (firmato)\n${join(esc(r.code), esc(r.device?.model), esc(r.customer?.name))}${what}${foot}`;
  }
  if ((x = path.match(/^\/api\/quote\/([^/]+)\/decision$/)) && m === 'POST') {
    if (!isOk) return fail('Risposta del cliente al preventivo');
    const yes = r.decision === 'accettato';
    return `${yes ? '✅' : '❌'} <b>Il cliente ha ${yes ? 'ACCETTATO' : 'RIFIUTATO'} il preventivo ${esc(r.code)}</b> (firmato dal link)\n${join(esc(r.who), `totale ${eur(r.total)}`)}${yes ? '\nPuoi convertirlo in riparazione o in vendita.' : ''}${foot}`;
  }
  if ((x = path.match(/^\/api\/track\/([^/]+)\/sign$/)) && m === 'POST') return isOk ? `✍️ <b>Scheda di ingresso FIRMATA dal cliente</b> (da link)\n${esc(r.code || '')}${foot}` : fail('Firma della scheda di ingresso');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/signature$/)) && m === 'POST') return isOk ? `✍️ <b>${body.kind === 'disposal' ? 'Cessione del dispositivo firmata' : 'Scheda di ingresso firmata al banco'}</b>\n${repLine(r, p)}${body.signer_name ? `\nFirma: ${esc(short(body.signer_name, 60))}` : ''}${foot}` : fail('Firma');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/request-signature$/)) && m === 'POST') return isOk ? `📲 <b>Firma a distanza richiesta</b>\n${repLine(r, p)}${foot}` : fail('Richiesta di firma');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/fate$/)) && m === 'POST') return isOk ? `📦 <b>Destino del dispositivo</b>: ${esc(FATE[body.fate] || body.fate)}\n${repLine(r, p)}${body.note ? `\nNota: ${esc(short(body.note, 120))}` : ''}${foot}` : fail('Destino del dispositivo');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/quote-options/)) && m !== 'GET') return isOk ? `🧾 <b>Opzione di preventivo ${m === 'DELETE' ? 'tolta' : 'aggiunta'}</b>\n${repLine(r, p)}${m === 'POST' ? `\n${esc(short(body.label, 80))} · ${eur(body.amount)}` : ''}${foot}` : fail('Opzioni di preventivo');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/checklist$/)) && m === 'PUT') {
    if (!isOk) return fail('Controllo');
    const items = r.check?.items || [];
    const ko = items.filter((i) => ['ko', 'no', 'fail', false].includes(i.state ?? i.value)).length;
    return `☑️ <b>Controllo ${esc(PHASE[body.phase] || body.phase)} compilato</b>\n${repLine(r, p)}${items.length ? `\n${items.length} voci${ko ? `, ${ko} non superate` : ''}` : ''}${foot}`;
  }
  if ((x = path.match(/^\/api\/checklists\/(\w+)$/)) && (m === 'PUT' || m === 'DELETE')) return isOk ? `☑️ <b>Checklist ${m === 'DELETE' ? 'ripristinata' : 'modificata'}</b>: ${esc(x[1])}${foot}` : fail('Checklist');

  // ---- Vendite, cassa, spese
  if (m === 'POST' && path === '/api/sales') {
    if (!isOk) return fail('Vendita');
    const pays = (r.payments || []).filter((q) => q.method !== 'buono');
    const how = pays.length > 1 ? `diviso: ${payList(pays)}` : esc(pays[0]?.method || r.method);
    const vouchers = (r.vouchers || []).map((v) => `\n🎁 ${esc(VOUCHER[v.kind] || 'Buono')} ${esc(v.code)}: ${eur(v.amount)}${v.kind === 'regalo' ? ' (credito del buono)' : ' di sconto'}`).join('');
    const voucherOff = (r.vouchers || []).filter((v) => v.kind !== 'regalo').reduce((a, v) => a + Number(v.amount || 0), 0);
    const baseOff = Math.round((Number(r.discount || 0) - voucherOff) * 100) / 100; // lo sconto del buono e' gia' nella riga del buono
    const items = (r.items || []).map((i) => `• ${esc(short(i.name, 50))} ×${esc(i.qty)} · ${eur(i.unit_price)}`).join('\n');
    return `🛒 <b>Vendita ${esc(r.code)}</b> · ${eur(r.total)}\n💶 ${how}${r.customer_name ? `\nCliente: ${esc(r.customer_name)}` : ''}\n${items}${baseOff > 0 ? `\nSconto ${eur(baseOff)}` : ''}${vouchers}${alerts(r.device_alerts)}${foot}`;
  }
  if (path === '/api/expenses' && m === 'POST') return isOk ? `🧾 <b>Nuova spesa</b> ${eur(r.amount)} (${esc(r.method || 'contanti')})\n${join(esc(short(r.description, 100)), esc(r.category), esc(r.vendor))}${r.reimbursable ? ' · da rimborsare' : ''}${foot}` : fail('Nuova spesa');
  if ((x = path.match(/^\/api\/expenses\/(\d+)$/)) && (m === 'PUT' || m === 'DELETE')) {
    const d = m === 'DELETE' ? p : r;
    return isOk ? `🧾 <b>Spesa ${m === 'DELETE' ? 'eliminata' : 'modificata'}</b>${d.description ? `\n${esc(short(d.description, 100))} · ${eur(d.amount)}` : ''}${foot}` : fail('Spesa');
  }
  if (path === '/api/expenses-pdf') return isOk ? `📄 <b>Nota spese PDF generata</b>${foot}` : fail('Nota spese PDF');

  // ---- Buoni
  if (path === '/api/buoni' && m === 'POST') return isOk ? `🎁 <b>${esc(VOUCHER[r.kind] || 'Buono')} creato</b>: ${esc(r.code)}\nValore ${r.kind === 'sconto_percentuale' ? `${esc(r.value)}%` : eur(r.value)}${r.expires_at ? ` · scade il ${esc(dmy(r.expires_at))}` : ''}\n(nessun incasso: il credito entra in cassa quando il buono viene usato)${foot}` : fail('Nuovo buono');
  if ((x = path.match(/^\/api\/buoni\/(\d+)\/annulla$/)) && m === 'POST') return isOk ? `🎁 <b>Buono annullato</b>: ${esc(r.code)} (residuo ${r.kind === 'sconto_percentuale' ? '—' : eur(r.balance)})${foot}` : fail('Annullamento buono');
  if ((x = path.match(/^\/api\/buoni\/(\d+)$/)) && m === 'DELETE') return isOk ? `🗑️ <b>Buono eliminato</b>: ${esc(p.code || `n. ${x[1]}`)}${foot}` : fail('Eliminazione buono');

  // ---- Ordini
  if (/^\/api\/orders/.test(path) && m !== 'GET') {
    const head = `${esc(r.code)}${r.customer_name ? ` · ${esc(r.customer_name)}` : r.kind === 'negozio' ? ' · per il negozio' : ''}`;
    const items = (r.items || []).slice(0, 5).map((i) => `• ${esc(short(i.description, 50))} ×${esc(i.qty)}`).join('\n');
    if (path === '/api/orders' && m === 'POST') return isOk ? `🛍️ <b>Nuovo ordine ${head}</b>\n${items}\nTotale ${eur(r.total)}${Number(r.paid) > 0 ? ` · acconto ${eur(r.paid)}${body.deposit_method ? ` (${esc(body.deposit_method)})` : ''}` : ''}${r.supplier_name ? `\nFornitore: ${esc(r.supplier_name)}` : ''}${foot}` : fail('Nuovo ordine');
    if (path === '/api/orders/mark-ordered') return isOk ? `🛍️ <b>${esc(r.count)} ordin${r.count === 1 ? 'e segnato' : 'i segnati'} come ordinat${r.count === 1 ? 'o' : 'i'}</b> al fornitore${foot}` : fail('Segna ordinati');
    if (/\/status$/.test(path)) return isOk ? `🛍️ <b>Ordine ${head}</b> → ${esc(r.status_label || r.status)}${r.status === 'consegnato' ? `\nPagato ${eur(r.paid)} su ${eur(r.total)}${Number(r.balance) > 0 ? ` · ⚠️ resta da incassare ${eur(r.balance)}` : ''}` : ''}${r.status === 'arrivato' && r.customer_name ? '\nDa avvisare il cliente' : ''}${foot}` : fail('Stato dell’ordine');
    if (/\/deposit$/.test(path)) return isOk ? `💶 <b>Acconto ${eur(body.amount)}</b> (${esc(body.method || 'contanti')}) sull’ordine ${head}\nPagato ${eur(r.paid)} su ${eur(r.total)}${foot}` : fail('Acconto dell’ordine');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Ordine eliminato</b>: ${esc(p.code || path.split('/').pop())}${foot}` : fail('Eliminazione ordine');
    return isOk ? `✏️ <b>Ordine ${head} modificato</b>\nTotale ${eur(r.total)}${foot}` : fail('Modifica ordine');
  }

  // ---- Preventivi (sezione autonoma)
  if (/^\/api\/quotes/.test(path) && m !== 'GET') {
    const q = r.quote || r;
    const head = `${esc(q.code)}${q.who || q.customer_name ? ` · ${esc(q.who || q.customer_name)}` : ''}`;
    if (path === '/api/quotes' && m === 'POST') return isOk ? `🧾 <b>Nuovo preventivo ${head}</b>\nTotale ${eur(q.total)}${q.discount ? ` (sconto ${eur(q.discount)})` : ''} · valido fino al ${esc(dmy(q.valid_until))}${foot}` : fail('Nuovo preventivo');
    if (/\/link$/.test(path)) return isOk ? `🔗 <b>Link online creato</b> per il preventivo ${esc(p.code)}${p.who ? ` · ${esc(p.who)}` : ''}\n(il cliente potrà accettarlo e firmarlo dal telefono)${foot}` : fail('Link del preventivo');
    if (/\/status$/.test(path)) return isOk ? `🧾 <b>Preventivo ${head}</b> → ${esc(cap(q.status))}\nTotale ${eur(q.total)}${foot}` : fail('Stato del preventivo');
    if (/\/convert$/.test(path)) return isOk ? `🔁 <b>Preventivo ${head} convertito</b> in ${q.sale_code ? `vendita ${esc(q.sale_code)} (incassata ${body.method ? `in ${esc(body.method)}` : ''})` : q.repair_code ? `riparazione ${esc(q.repair_code)}` : esc(body.to)}\nTotale ${eur(q.total)}${foot}` : fail('Conversione del preventivo');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Preventivo eliminato</b>: ${esc(p.code || path.split('/').pop())}${foot}` : fail('Eliminazione preventivo');
    return isOk ? `✏️ <b>Preventivo ${head} modificato</b>\nTotale ${eur(q.total)}${foot}` : fail('Modifica preventivo');
  }

  // ---- Promemoria
  if (/^\/api\/reminders/.test(path) && m !== 'GET') {
    const ref = join(esc(r.customer_name), esc(r.repair_code), esc(r.order_code));
    const when = esc(dmy(r.due_at));
    if (path === '/api/reminders' && m === 'POST') return isOk ? `🔔 <b>Nuovo promemoria</b> per ${when}\n${esc(short(r.title, 120))}${ref ? `\n${ref}` : ''}${foot}` : fail('Nuovo promemoria');
    if (/\/done$/.test(path)) return isOk ? `✅ <b>Promemoria ${r.done ? 'fatto' : 'riaperto'}</b>: ${esc(short(r.title, 100))}${foot}` : fail('Promemoria');
    if (/\/snooze$/.test(path)) return isOk ? `⏰ <b>Promemoria rimandato</b> a ${when}: ${esc(short(r.title, 100))}${foot}` : fail('Promemoria');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Promemoria eliminato</b>: ${esc(short(p.title || '', 100))}${foot}` : fail('Eliminazione promemoria');
    return isOk ? `✏️ <b>Promemoria modificato</b> (${when}): ${esc(short(r.title, 100))}${foot}` : fail('Modifica promemoria');
  }

  // ---- Registro dispositivi
  if (/^\/api\/dispositivi/.test(path) && m !== 'GET') {
    const dev = `${esc(r.brand_model || p.brand_model)}${(r.serial || p.serial) ? ` (seriale …${esc(String(r.serial || p.serial).slice(-4))})` : ''}`;
    if (/\/segnala$/.test(path)) return isOk ? `${r.flag === 'ok' ? '✅' : '🚨'} <b>Dispositivo ${r.flag === 'ok' ? 'tornato regolare' : `segnalato ${esc(DEVICE_FLAG[r.flag] || r.flag)}`}</b>\n${dev}${r.flag_report_no ? `\nDenuncia n. ${esc(r.flag_report_no)}` : ''}${r.flag_note ? `\nMotivo: ${esc(short(r.flag_note, 120))}` : ''}${foot}` : fail('Segnalazione dispositivo');
    if (m === 'POST') return isOk ? `📱 <b>Dispositivo registrato</b>: ${dev}\n${join(esc(r.category), r.price != null ? `prezzo ${eur(r.price)}` : '')}${foot}` : fail('Nuovo dispositivo');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Dispositivo eliminato</b>: ${dev}${foot}` : fail('Eliminazione dispositivo');
    return isOk ? `✏️ <b>Dispositivo modificato</b>: ${dev}${foot}` : fail('Modifica dispositivo');
  }

  // ---- Documenti d'identita' e credenziali (dati sensibili: si avvisa anche quando si guardano, mai i contenuti)
  if (path === '/api/documenti/config' && m === 'PUT') return isOk ? `🔐 <b>Permessi dei documenti d’identità modificati</b>\nPossono vederli: amministratore${(body.roles || []).filter((x) => x !== 'admin').map((x) => `, ${esc(x)}`).join('')}${foot}` : fail('Permessi documenti');
  if ((x = path.match(/^\/api\/documenti\/(\d+)$/)) && m === 'GET') return isOk ? `🪪 <b>Documento d’identità aperto</b>: ${esc(r.type_label || DOC[r.doc_type] || 'documento')} di ${esc(r.customer_name)}${foot}` : null;
  if (path === '/api/documenti' && m === 'POST') return isOk ? `🪪 <b>Documento d’identità salvato</b>: ${esc(DOC[r.doc_type] || 'documento')} di ${esc(p.customer_name || `cliente n. ${r.customer_id}`)} (${esc(r.files)} foto, cifrato)${foot}` : fail('Salvataggio documento');
  if ((x = path.match(/^\/api\/documenti\/(\d+)$/)) && m === 'DELETE') return isOk ? `🗑️ <b>Documento d’identità eliminato</b>: ${esc(DOC[p.doc_type] || 'documento')}${p.customer_name ? ` di ${esc(p.customer_name)}` : ''}${foot}` : fail('Eliminazione documento');
  if (/^\/api\/credenziali/.test(path) && m !== 'GET') {
    const what = `${esc(r.label || p.label || 'accesso')} di ${esc(p.supplier_name || 'fornitore')}`;
    if (/\/rivela$/.test(path)) return isOk ? `🔓 <b>Password ${body.action === 'copia' ? 'copiata' : 'mostrata'}</b>: ${what}${foot}` : fail('Lettura password');
    if (m === 'POST') return isOk ? `🔐 <b>Credenziale salvata</b>: ${what}${foot}` : fail('Nuova credenziale');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Credenziale eliminata</b>: ${what}${foot}` : fail('Eliminazione credenziale');
    return isOk ? `🔐 <b>Credenziale modificata</b>: ${what}${body.password ? ' (password cambiata)' : ''}${foot}` : fail('Modifica credenziale');
  }

  // ---- Vetrina usati
  if (/^\/api\/usati/.test(path) && m !== 'GET') {
    const pub = r.publish || {};
    const pubLine = pub.state === 'error' ? `\n🔴 <b>Pubblicazione sul sito NON riuscita</b>: ${esc(short(pub.message, 250))}`
      : pub.state === 'published' ? '\n🌐 Pubblicato sul sito'
      : pub.state === 'draft' ? '\n📝 Solo bozza (pubblicazione sul sito non attiva)' : '';
    const title = `${esc(short([r.name || body.name, r.memory, r.color].filter(Boolean).join(' '), 80))}`;
    const price = r.price != null ? ` · ${eur(r.price)}` : '';
    if (path === '/api/usati/publish') return pub.state === 'error' || r.state === 'error' ? `🔴 <b>Pubblicazione Vetrina usati NON riuscita</b>\n${esc(short(r.message, 300))}${foot}` : isOk ? `🌐 <b>Vetrina usati pubblicata</b>\n${esc(short(r.message, 200))}${foot}` : fail('Pubblicazione Vetrina usati');
    if (/\/photos/.test(path)) return isOk ? `📷 <b>Foto ${m === 'POST' ? 'aggiunta' : m === 'DELETE' ? 'tolta' : 'riordinate'}</b>: ${title}${foot}` : fail('Foto della Vetrina usati');
    if (/\/sold$/.test(path)) return isOk ? `💰 <b>Usato VENDUTO</b>: ${title}${price}${pubLine}${foot}` : fail('Segna venduto');
    if (/\/unsold$/.test(path)) return isOk ? `↩️ <b>Usato rimesso in vetrina</b>: ${title}${price}${pubLine}${foot}` : fail('Rimetti in vetrina');
    if (m === 'POST') return isOk ? `🏷️ <b>Nuovo articolo usato</b>: ${title}${price}${r.conditionLabel ? ` · ${esc(r.conditionLabel)}` : ''}${pubLine}${foot}` : fail('Nuovo articolo usato');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Articolo usato eliminato</b>: ${esc(short(r.name, 80))}${pubLine}${foot}` : fail('Eliminazione articolo usato');
    return isOk ? `✏️ <b>Articolo usato modificato</b>: ${title}${price}${pubLine}${foot}` : fail('Modifica articolo usato');
  }

  // ---- Magazzino: carico merce (prima delle anagrafiche: anche questi indirizzi iniziano con /api/products)
  if ((path === '/api/products/load' || /^\/api\/products\/\d+\/load$/.test(path)) && m === 'POST') {
    if (!isOk) return fail('Carico merce');
    const l = r.loaded || {};
    return `📥 <b>Carico merce</b>: ${esc(short(r.name, 80))}${l.new_product ? ' (nuovo articolo)' : ''}\n+${esc(l.qty)} pz a ${eur(l.unit_price)} cad.${l.supplier_name ? ` da ${esc(l.supplier_name)}` : ''}${l.doc_number && !/^CARICO-/.test(l.doc_number) ? ` · doc. ${esc(l.doc_number)}` : ''}\nGiacenza ora ${esc(r.qty)} pz · costo medio ${eur(l.avg_cost)}${foot}`;
  }
  if ((x = path.match(/^\/api\/products\/(\d+)\/move$/)) && m === 'POST') return isOk ? `📦 <b>Movimento di magazzino</b>\n${esc(r.name)} ${Number(body.delta) > 0 ? '+' : ''}${esc(body.delta)} (${esc(body.reason || '—')}) → ora ${esc(r.qty)} pz${foot}` : fail('Movimento di magazzino');
  if (/^\/api\/services/.test(path) && m !== 'GET') {
    const d = m === 'DELETE' ? p : r;
    return isOk ? `🧰 <b>Servizio ${m === 'POST' ? 'aggiunto al listino' : m === 'DELETE' ? 'tolto dal listino' : 'modificato'}</b>: ${esc(short(d.name || '', 80))}${d.price != null ? ` · ${eur(d.price)}` : ''}${foot}` : fail('Listino servizi');
  }

  // ---- Anagrafiche e magazzino
  const CRUD = [[/^\/api\/customers/, '👤', 'Cliente'], [/^\/api\/suppliers/, '🚚', 'Fornitore'], [/^\/api\/products/, '📦', 'Prodotto']];
  for (const [re, ico, label] of CRUD) {
    if (re.test(path) && m !== 'GET') {
      if (!isOk) return fail(label);
      if (m === 'DELETE') {
        const extra = label === 'Cliente' && p.rep_n ? `\nCon ${esc(p.rep_n)} riparazion${p.rep_n === 1 ? 'e conclusa' : 'i concluse'}${Number(p.pay_sum) > 0 ? ` · 💶 tolti dalla cassa ${eur(p.pay_sum)}` : ''}` : label === 'Prodotto' && p.qty ? `\nGiacenza al momento: ${esc(p.qty)} pz` : '';
        return `🗑️ <b>${label} eliminato</b>: ${esc(short(p.name || `n. ${path.match(/(\d+)$/)?.[1] || '?'}`, 80))}${extra}${foot}`;
      }
      const name = r.name || body.name || '';
      const extra = label === 'Prodotto' && m === 'POST' ? `\n${esc(r.qty ?? 0)} pz · vendita ${eur(r.price)}` : '';
      return `${ico} <b>${label} ${m === 'POST' ? 'creato' : 'modificato'}</b>${name ? `: ${esc(short(name, 80))}` : ''}${extra}${foot}`;
    }
  }

  // ---- Utenti e impostazioni (sicurezza)
  if (path === '/api/users' && m === 'POST') return isOk ? `🔐 <b>Nuovo utente</b>: ${esc(r.email)} (${esc(r.role)})${foot}` : fail('Nuovo utente');
  if ((x = path.match(/^\/api\/users\/(\d+)$/)) && (m === 'PUT' || m === 'DELETE')) {
    const d = m === 'DELETE' ? p : r;
    return isOk ? `🔐 <b>Utente ${m === 'DELETE' ? 'eliminato' : 'modificato'}</b>${d.email ? `: ${esc(d.email)} (${esc(d.role)}${d.active === 0 ? ', disattivato' : ''})` : ''}${foot}` : fail('Utente');
  }
  if (path === '/api/settings' && m === 'PUT') {
    if (!isOk) return fail('Impostazioni');
    const ch = settingChanges(body, pre.settings);
    if (!ch.length) return null; // salvate senza cambiare nulla
    return `⚙️ <b>Impostazioni modificate</b>\n${ch.slice(0, 12).map((c) => `• ${c}`).join('\n')}${ch.length > 12 ? `\n… e altre ${ch.length - 12}` : ''}${foot}`;
  }
  // Solo le azioni reali: aprire le Impostazioni fa una lettura (GET /api/demo) che NON deve avvisare.
  if (path === '/api/demo' && (m === 'POST' || m === 'DELETE')) return isOk ? `🧪 <b>Dati demo ${m === 'POST' ? 'caricati' : 'eliminati'}</b>${foot}` : fail('Dati demo');
  if (path === '/api/backup/r2' && m === 'POST') return isOk ? `💾 <b>Backup salvato nel cloud</b>\n${esc(r.file || '')}${foot}` : fail('Backup nel cloud');
  if (path === '/api/backup') return isOk ? `💾 <b>Backup scaricato</b>${foot}` : fail('Backup');
  if ((x = path.match(/^\/print\/(\w+)\/(\d+)/))) return isOk ? `🖨️ <b>Stampa ${esc(PRINT[x[1]] || x[1])}</b> ${esc(p.code || `n. ${x[2]}`)}${p.brand_model ? ` · ${esc(p.brand_model)}` : ''}${foot}` : null;

  // ---- Acquisti dai fornitori (import fatture)
  if (m === 'POST' && path === '/api/purchases/confirm') {
    if (!isOk) return fail('Import acquisto');
    const big = (r.changes || []).filter((c) => Math.abs(c.pct) > 5);
    const ch = big.slice(0, 8).map((c) => `${c.direction === 'up' ? '▲' : '▼'} ${esc(short(c.product_name, 40))} · ${esc(short(c.supplier_name, 24))}: ${eur(c.prev_price)} → ${eur(c.price)} (${c.pct > 0 ? '+' : ''}${String(c.pct).replace('.', ',')}%)`).join('\n');
    return `📥 <b>Acquisto importato</b> da ${esc(r.supplier_name)}${r.supplier_created ? ' (nuovo fornitore)' : ''}
Fattura ${esc(r.doc_number)} · ${eur(r.total)} · ${esc(r.lines_count)} righe caricate${r.new_products ? ` (${esc(r.new_products)} prodotti nuovi)` : ''}${ch ? `
⚠️ Variazioni di prezzo oltre il 5%:
${ch}` : ''}${foot}`;
  }
  if (path.startsWith('/api/purchases/preview')) return isOk ? null : fail('Lettura fattura');

  if (m === 'GET') return null; // le letture normali non si segnalano
  if (status >= 400) return `⚠️ <b>${esc(section(path))}: operazione non riuscita</b> (${status})\n${esc(short(r.error || '', 200))}${foot}`;
  return `ℹ️ <b>${esc(section(path))}</b>: ${esc(m)} ${esc(path)}${foot}`;
}

/** Operazioni minori o di routine: il messaggio arriva senza suono. */
export function isQuiet(method, path, status) {
  if (status >= 400 && status !== 401 && status !== 403 && status < 500) return true; // errori di compilazione: li vede gia' chi usa il gestionale
  return /^\/print\//.test(path) || /\/(checklist|photos|note|quote-options|request-signature)(\/|$)/.test(path)
    || /^\/api\/reminders/.test(path) || /^\/api\/checklists/.test(path) || (method === 'PUT' && /^\/api\/(products|suppliers|customers|services)\//.test(path));
}

// ---- Dati letti dal database prima dell'azione (per nominare cio' che si elimina o si tocca)
const REPAIR_CTX = 'SELECT r.code, r.brand_model, c.name AS customer_name FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE r.id = ?';
const PRE = [
  ['DELETE', /^\/api\/repairs\/(\d+)$/, `SELECT r.code, r.brand_model, c.name AS customer_name,
    (SELECT COUNT(*) FROM payments p WHERE p.kind = 'repair' AND p.ref_id = r.id) AS pay_n,
    (SELECT ROUND(COALESCE(SUM(amount), 0), 2) FROM payments p WHERE p.kind = 'repair' AND p.ref_id = r.id) AS pay_sum
    FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE r.id = ?`],
  ['*', /^\/api\/repairs\/(\d+)\/(signature|request-signature|checklist|quote-options|fate|parts\/\d+\/stock)/, REPAIR_CTX],
  ['GET', /^\/print\/(?:customer|repair|lab|both|label)\/(\d+)/, REPAIR_CTX],
  ['GET', /^\/print\/sale\/(\d+)/, 'SELECT code FROM sales WHERE id = ?'],
  ['GET', /^\/print\/quote\/(\d+)/, 'SELECT code FROM quotes WHERE id = ?'],
  ['GET', /^\/print\/voucher\/(\d+)/, 'SELECT code FROM vouchers WHERE id = ?'],
  ['DELETE', /^\/api\/customers\/(\d+)$/, `SELECT name, (SELECT COUNT(*) FROM repairs WHERE customer_id = c.id) AS rep_n,
    (SELECT ROUND(COALESCE(SUM(p.amount), 0), 2) FROM payments p JOIN repairs r ON p.kind = 'repair' AND p.ref_id = r.id WHERE r.customer_id = c.id) AS pay_sum
    FROM customers c WHERE id = ?`],
  ['DELETE', /^\/api\/products\/(\d+)$/, 'SELECT name, qty FROM products WHERE id = ?'],
  ['DELETE', /^\/api\/suppliers\/(\d+)$/, 'SELECT name FROM suppliers WHERE id = ?'],
  ['DELETE', /^\/api\/services\/(\d+)$/, 'SELECT name, price FROM services WHERE id = ?'],
  ['DELETE', /^\/api\/users\/(\d+)$/, 'SELECT email, role FROM users WHERE id = ?'],
  ['DELETE', /^\/api\/expenses\/(\d+)$/, 'SELECT description, amount FROM expenses WHERE id = ?'],
  ['DELETE', /^\/api\/buoni\/(\d+)$/, 'SELECT code FROM vouchers WHERE id = ?'],
  ['DELETE', /^\/api\/orders\/(\d+)$/, 'SELECT code FROM orders WHERE id = ?'],
  ['DELETE', /^\/api\/quotes\/(\d+)$/, 'SELECT code FROM quotes WHERE id = ?'],
  ['POST', /^\/api\/quotes\/(\d+)\/link$/, 'SELECT q.code, COALESCE(c.name, q.customer_name) AS who FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id WHERE q.id = ?'],
  ['DELETE', /^\/api\/reminders\/(\d+)$/, 'SELECT title FROM reminders WHERE id = ?'],
  ['DELETE', /^\/api\/dispositivi\/(\d+)$/, 'SELECT brand_model, serial FROM devices WHERE id = ?'],
  ['DELETE', /^\/api\/documenti\/(\d+)$/, 'SELECT d.doc_type, c.name AS customer_name FROM id_documents d JOIN customers c ON c.id = d.customer_id WHERE d.id = ?'],
  ['*', /^\/api\/credenziali\/(\d+)/, 'SELECT k.label, s.name AS supplier_name FROM supplier_credentials k JOIN suppliers s ON s.id = k.supplier_id WHERE k.id = ?'],
];
async function preload(method, path, body) {
  try {
    if (method === 'PUT' && path === '/api/settings') return { settings: Object.fromEntries((await db.prepare('SELECT key, value FROM settings').all()).map((s) => [s.key, s.value])) };
    if (method === 'POST' && path === '/api/documenti' && body?.customer_id) return (await db.prepare('SELECT name AS customer_name FROM customers WHERE id = ?').get(body.customer_id)) || {};
    if (method === 'POST' && path === '/api/credenziali' && body?.supplier_id) return (await db.prepare('SELECT name AS supplier_name FROM suppliers WHERE id = ?').get(body.supplier_id)) || {};
    for (const [mm, re, sql] of PRE) {
      const x = (mm === '*' || mm === method) && path.match(re);
      if (x) return (await db.prepare(sql).get(x[1])) || {};
    }
  } catch { /* tabella non ancora migrata: si avvisa con meno dettagli */ }
  return {};
}
/** Dopo la consegna: gli incassi veri (quote, metodi) e i buoni usati. */
async function postload(method, path) {
  const x = method === 'POST' && path.match(/^\/api\/repairs\/(\d+)\/deliver$/);
  if (!x) return {};
  try {
    return {
      payments: await db.prepare("SELECT label, amount, method FROM payments WHERE kind = 'repair' AND ref_id = ? ORDER BY id").all(x[1]),
      vouchers: await db.prepare("SELECT v.code, v.kind, u.amount FROM voucher_uses u JOIN vouchers v ON v.id = u.voucher_id WHERE u.kind = 'repair' AND u.ref_id = ?").all(x[1]),
    };
  } catch { return {}; }
}

const lastErr = new Map();

/** Invia un messaggio al proprietario. Non lancia mai errori. `silent`: arriva senza suono. */
export async function sendTelegram(env, html, fetcher = globalThis.fetch, { silent = false } = {}) {
  try {
    const token = env?.TELEGRAM_BOT_TOKEN;
    const owner = env?.TELEGRAM_OWNER_ID;
    if (!token || !owner || !html) return false;
    const text = html.length > 3900 ? `${html.slice(0, 3890)}…` : html;
    const res = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: String(owner), text, parse_mode: 'HTML', disable_web_page_preview: true, ...(silent ? { disable_notification: true } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const envOf = (c) => ({ ...(typeof process !== 'undefined' ? process.env : {}), ...(c.env || {}) });
const wait = (c, p) => { try { c.executionCtx.waitUntil(p); } catch { /* su Node la richiesta non si chiude: si lascia correre */ } };
// Letture che meritano un avviso (dati sensibili); le anteprime di stampa (?noprint=1) no.
const WATCHED_GET = (path, url) => /^\/api\/documenti\/\d+$/.test(path) || (/^\/print\//.test(path) && url.searchParams.get('noprint') !== '1');

/** Middleware Hono: dopo ogni richiesta decide se avvisare. */
export const notifyMiddleware = async (c, next) => {
  const env = envOf(c);
  const enabled = env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_OWNER_ID;
  const method = c.req.method;
  const url = new URL(c.req.url);
  const path = url.pathname;
  const writes = method !== 'GET' && method !== 'OPTIONS' && method !== 'HEAD';
  let body = {};
  let pre = {};
  if (enabled && writes) {
    try { body = await c.req.raw.clone().json(); } catch { body = {}; }
  }
  if (enabled && (writes || WATCHED_GET(path, url))) pre = await preload(method, path, body);
  let thrown;
  try { await next(); } catch (e) { thrown = e; }
  const quietRead = method === 'GET' && !thrown && c.res.status < 500 && !WATCHED_GET(path, url); // letture normali: nessun avviso
  if (enabled && !quietRead) {
    try {
      const status = thrown ? 500 : c.res.status;
      let result = {};
      if (!thrown && (c.res.headers.get('content-type') || '').includes('json')) { try { result = await c.res.clone().json(); } catch { result = {}; } }
      const post = status < 300 ? await postload(method, path) : {};
      const err = thrown || c.get('err');
      const login = c.get('login_event');
      const denied = c.get('denied_email');
      let text = describeEvent({
        method, path, status, user: c.get('user'), body, result, denied, login: false, pre, post,
        error: err ? `${err.message || err}` : (status >= 500 ? result.error : ''),
        ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'), country: c.req.header('cf-ipcountry'),
      });
      if (text && status >= 500) { // evita raffiche dello stesso errore
        const key = `${method} ${path} ${err?.message || ''}`;
        const last = lastErr.get(key) || 0;
        if (Date.now() - last < 300000) text = null; else lastErr.set(key, Date.now());
      }
      if (text) wait(c, sendTelegram(env, text, undefined, { silent: isQuiet(method, path, status) }));
      if (login && c.get('user')) wait(c, sendTelegram(env, describeEvent({ login: true, user: c.get('user'), ip: c.req.header('cf-connecting-ip'), country: c.req.header('cf-ipcountry'), method, path, status })));
    } catch { /* le notifiche non devono mai rompere il gestionale */ }
  }
  if (thrown) throw thrown;
};
