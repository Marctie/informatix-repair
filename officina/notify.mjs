// Notifiche Telegram al proprietario: ogni azione sul gestionale, accessi ed errori.
// Solo invio: il bot non riceve comandi, quindi nessun altro può usarlo. Il messaggio va SOLO a TELEGRAM_OWNER_ID.
// Configurazione (segreti del Worker, mai nel codice):  TELEGRAM_BOT_TOKEN  e  TELEGRAM_OWNER_ID.
// Senza configurazione il sistema non fa nulla. Dati sensibili (PIN dei dispositivi, password, token) non vengono mai inviati.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SECRET_KEYS = /pass|pin|token|secret|password|cookie/i;
const eur = (n) => (n == null || n === '' ? '—' : `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const short = (s, n = 80) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const maskPhone = (p) => (p ? String(p).replace(/\s/g, '').replace(/.(?=.{3})/g, '•') : '');

const STATUS = { received: 'Ricevuto', diagnosing: 'In diagnosi', quote_pending: 'Preventivo da approvare', approved: 'Preventivo approvato', waiting_parts: 'In attesa ricambi', repairing: 'In riparazione', ready: 'Pronto per il ritiro', delivered: 'Consegnato', cancelled: 'Annullato' };
const FIELD = { brand_model: 'dispositivo', problem: 'problema', quote: 'preventivo', eta_date: 'data stimata', final_price: 'prezzo finale', tech_notes: 'note tecniche', customer_note: 'nota al cliente', serial: 'seriale', accessories: 'accessori', condition_notes: 'condizioni', urgent: 'urgenza', warranty_days: 'garanzia', device_type: 'tipo' };

const SETTING = { shop_name: 'nome negozio', shop_address: 'indirizzo', shop_phone: 'telefono negozio', public_base_url: 'indirizzo pubblico', default_warranty_days: 'garanzia', terms: 'condizioni', low_stock_default: 'soglia scorta', stale_days: 'giorni riparazione ferma', ready_days: 'giorni pronto al ritiro' };
/** Toglie dai testi d'errore qualunque cosa somigli a un token di bot. */
const scrub = (t) => String(t ?? '').replace(/\d{6,}:[A-Za-z0-9_-]{30,}/g, '[token]');

/** Elenca i campi inviati (senza i valori sensibili). */
const fields = (body, map = FIELD) => Object.keys(body || {}).filter((k) => !SECRET_KEYS.test(k)).map((k) => map[k] || k).join(', ');

/** Costruisce il testo (HTML di Telegram) di un evento. Restituisce null se non vale la pena avvisare. */
export function describeEvent({ method, path, status, user, body = {}, result = {}, error, denied, login, ip, country }) {
  const who = user ? `${esc(user.name || user.email)} (${esc(user.email)})` : denied ? `${esc(denied)} (non abilitato)` : 'visitatore';
  const where = [ip && `IP ${esc(ip)}`, country && esc(country)].filter(Boolean).join(' · ');
  const foot = `\n👤 ${who}${where ? `\n🌐 ${where}` : ''}`;

  if (denied) return `🚫 <b>Accesso negato</b>\nL’indirizzo ${esc(denied)} ha provato a entrare nel gestionale ma non è nell’elenco utenti.${foot}`;
  if (login) return `🔑 <b>Accesso al gestionale</b>${foot}`;
  if (status >= 500) return `🔴 <b>ERRORE ${status}</b>\n${esc(method)} ${esc(path)}\n${error ? `<code>${esc(short(scrub(error), 600))}</code>` : 'Errore interno'}${foot}`;

  const m = method.toUpperCase();
  const r = result || {};
  const isOk = status >= 200 && status < 300;
  const fail = (what) => `⚠️ <b>${esc(what)}: operazione non riuscita</b> (${status})\n${esc(short(r.error || '', 200))}${foot}`;

  // ---- Riparazioni
  let x;
  if (m === 'POST' && path === '/api/repairs') return isOk ? `🛠️ <b>Nuova riparazione ${esc(r.code)}</b>\n${esc(r.brand_model)} — ${esc(short(body.problem, 120))}\nCliente: ${esc(r.customer_name)} ${esc(maskPhone(r.customer_phone))}\nPreventivo: ${eur(r.quote)} · acconto ${eur(r.deposit)}${r.urgent ? ' · 🔥 URGENTE' : ''}${foot}` : fail('Nuova riparazione');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/status$/)) && m === 'POST') return isOk ? `🔄 <b>${esc(r.code)}</b> → ${esc(STATUS[r.status] || r.status)}\n${esc(r.brand_model)} · ${esc(r.customer_name)}${body.note ? `\nNota: ${esc(short(body.note, 150))}` : ''}${foot}` : fail('Cambio stato');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/advance$/)) && m === 'POST') return isOk ? `⏭️ <b>${esc(r.code)}</b> avanzata → ${esc(STATUS[r.status] || r.status)}\n${esc(r.brand_model)} · ${esc(r.customer_name)}${r.collected ? `\n💶 Incassato ${eur(r.collected)}` : ''}${foot}` : fail('Avanzamento');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/deliver$/)) && m === 'POST') return isOk ? `📦 <b>Consegna ${esc(r.code)}</b>\n${esc(r.brand_model)} · ${esc(r.customer_name)}\n💶 Incassato ${eur(r.collected)} (${esc(body.method || 'contanti')}) · totale ${eur(r.final_price)}${foot}` : fail('Consegna');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/deposit$/)) && m === 'POST') return isOk ? `💶 <b>Acconto ${eur(body.amount)}</b> su ${esc(r.code)} (${esc(body.method || 'contanti')})\n${esc(r.brand_model)} · ${esc(r.customer_name)}${foot}` : fail('Acconto');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/note$/)) && m === 'POST') return isOk ? `📝 <b>Nota su ${esc(r.code)}</b> (${body.public === false ? 'interna' : 'visibile al cliente'})\n${esc(short(body.note, 250))}${foot}` : fail('Nota');
  if ((x = path.match(/^\/api\/repairs\/(\d+)\/parts(\/\d+)?$/))) return isOk ? `🔩 <b>Ricambi ${m === 'DELETE' ? 'rimossi' : 'aggiunti'}</b> su ${esc(r.code)}${m === 'DELETE' ? '' : `\n${esc(short(body.name || (r.parts || []).at(-1)?.name || (body.product_id ? `prodotto #${body.product_id}` : ''), 100))} ×${esc(body.qty || 1)}`}${foot}` : fail('Ricambi');
  if ((x = path.match(/^\/api\/repairs\/(\d+)$/)) && m === 'PATCH') return isOk ? `✏️ <b>Riparazione ${esc(r.code)} modificata</b>\nCampi: ${esc(fields(body)) || '—'}${body.quote != null ? `\nPreventivo: ${eur(body.quote)}` : ''}${foot}` : fail('Modifica riparazione');
  if ((x = path.match(/^\/api\/track\/([^/]+)\/decision$/)) && m === 'POST') return isOk ? `${body.accept ? '✅' : '❌'} <b>Il cliente ha ${body.accept ? 'APPROVATO' : 'RIFIUTATO'} il preventivo</b>\n${esc(r.code)} · ${esc(r.device?.model)} · ${esc(r.customer?.name)}${foot}` : fail('Risposta del cliente al preventivo');

  // ---- Vendite, cassa, spese
  if (m === 'POST' && path === '/api/sales') return isOk ? `🛒 <b>Vendita ${esc(r.code)}</b> · ${eur(r.total)} (${esc(r.method)})\n${(r.items || []).map((i) => `• ${esc(short(i.name, 50))} ×${esc(i.qty)}`).join('\n')}${r.discount ? `\nSconto ${eur(r.discount)}` : ''}${foot}` : fail('Vendita');
  if (path === '/api/expenses' && m === 'POST') return isOk ? `🧾 <b>Nuova spesa</b> ${eur(r.amount)}\n${esc(short(r.description, 100))} · ${esc(r.category)}${r.vendor ? ` · ${esc(r.vendor)}` : ''}${r.reimbursable ? ' · da rimborsare' : ''}${foot}` : fail('Nuova spesa');
  if (path.startsWith('/api/expenses/') && (m === 'PUT' || m === 'DELETE')) return isOk ? `🧾 <b>Spesa ${m === 'DELETE' ? 'eliminata' : 'modificata'}</b>${r.description ? `\n${esc(short(r.description, 100))} · ${eur(r.amount)}` : ''}${foot}` : fail('Spesa');
  if (path === '/api/expenses-pdf') return isOk ? `📄 <b>Nota spese PDF generata</b>${foot}` : fail('Nota spese PDF');

  // ---- Vetrina usati
  if (/^\/api\/usati/.test(path) && m !== 'GET') {
    const pub = r.publish || {};
    const pubLine = pub.state === 'error' ? `\n🔴 <b>Pubblicazione sul sito NON riuscita</b>: ${esc(short(pub.message, 250))}`
      : pub.state === 'published' ? '\n🌐 Pubblicato sul sito'
      : pub.state === 'draft' ? '\n📝 Solo bozza (pubblicazione sul sito non attiva)' : '';
    const title = `${esc(short([r.name || body.name, r.memory, r.color].filter(Boolean).join(' '), 80))}`;
    const price = r.price != null ? ` · ${eur(r.price)}` : '';
    if (path === '/api/usati/publish') return pub.state === 'error' || r.state === 'error' ? `🔴 <b>Pubblicazione Vetrina usati NON riuscita</b>\n${esc(short(r.message, 300))}${foot}` : isOk ? `🌐 <b>Vetrina usati pubblicata</b>\n${esc(short(r.message, 200))}${foot}` : fail('Pubblicazione Vetrina usati');
    if (/\/photos/.test(path)) return isOk ? `📷 <b>Foto ${m === 'POST' ? 'aggiunta' : m === 'DELETE' ? 'tolta' : 'riordinata'}</b>: ${title}${foot}` : fail('Foto della Vetrina usati');
    if (/\/sold$/.test(path)) return isOk ? `💰 <b>Usato VENDUTO</b>: ${title}${price}${pubLine}${foot}` : fail('Segna venduto');
    if (/\/unsold$/.test(path)) return isOk ? `↩️ <b>Usato rimesso in vetrina</b>: ${title}${price}${pubLine}${foot}` : fail('Rimetti in vetrina');
    if (m === 'POST') return isOk ? `🏷️ <b>Nuovo articolo usato</b>: ${title}${price}${r.conditionLabel ? ` · ${esc(r.conditionLabel)}` : ''}${pubLine}${foot}` : fail('Nuovo articolo usato');
    if (m === 'DELETE') return isOk ? `🗑️ <b>Articolo usato eliminato</b>: ${esc(short(r.name, 80))}${pubLine}${foot}` : fail('Eliminazione articolo usato');
    return isOk ? `✏️ <b>Articolo usato modificato</b>: ${title}${price}${pubLine}${foot}` : fail('Modifica articolo usato');
  }

  // ---- Anagrafiche e magazzino
  const CRUD = [[/^\/api\/customers/, '👤', 'Cliente'], [/^\/api\/suppliers/, '🚚', 'Fornitore'], [/^\/api\/products\/(\d+)\/move/, '📦', 'Movimento di magazzino'], [/^\/api\/products/, '📦', 'Prodotto']];
  for (const [re, ico, label] of CRUD) {
    if (re.test(path) && m !== 'GET') {
      const verb = m === 'POST' && !/move/.test(path) ? 'creato' : m === 'DELETE' ? 'eliminato' : 'modificato';
      const name = r.name || body.name || (m === 'DELETE' ? `n. ${path.match(/(\d+)$/)?.[1] || '?'}` : '');
      const extra = /move/.test(path) ? `\n${esc(r.name)} ${Number(body.delta) > 0 ? '+' : ''}${esc(body.delta)} (${esc(body.reason || '—')}) → ora ${esc(r.qty)} pz` : '';
      return isOk ? `${ico} <b>${label}${/move/.test(path) ? '' : ` ${verb}`}</b>${name && !extra ? `: ${esc(short(name, 80))}` : ''}${extra}${foot}` : fail(label);
    }
  }

  // ---- Utenti e impostazioni (sicurezza)
  if (path === '/api/users' && m === 'POST') return isOk ? `🔐 <b>Nuovo utente</b>: ${esc(r.email)} (${esc(r.role)})${foot}` : fail('Nuovo utente');
  if (path.startsWith('/api/users/') && (m === 'PUT' || m === 'DELETE')) return isOk ? `🔐 <b>Utente ${m === 'DELETE' ? 'eliminato' : 'modificato'}</b>${r.email ? `: ${esc(r.email)} (${esc(r.role)}${r.active === 0 ? ', disattivato' : ''})` : ''}${foot}` : fail('Utente');
  if (path === '/api/settings' && m === 'PUT') return isOk ? `⚙️ <b>Impostazioni modificate</b>\nCampi: ${esc(fields(body, SETTING)) || '—'}${foot}` : fail('Impostazioni');
  // Solo le azioni reali: aprire le Impostazioni fa una lettura (GET /api/demo) che NON deve avvisare.
  if (path === '/api/demo' && (m === 'POST' || m === 'DELETE')) return isOk ? `🧪 <b>Dati demo ${m === 'POST' ? 'caricati' : 'eliminati'}</b>${foot}` : fail('Dati demo');
  if (path === '/api/backup/r2' && m === 'POST') return isOk ? `💾 <b>Backup salvato nel cloud</b>\n${esc(r.file || '')}${foot}` : fail('Backup nel cloud');
  if (path === '/api/backup') return isOk ? `💾 <b>Backup scaricato</b>${foot}` : fail('Backup');
  if (/^\/print\//.test(path)) return isOk ? `🖨️ <b>Stampa</b> ${esc(path.replace('/print/', ''))}${foot}` : null;

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
  if (status >= 400) return `⚠️ <b>Richiesta rifiutata ${status}</b>\n${esc(m)} ${esc(path)}\n${esc(short(r.error || '', 200))}${foot}`;
  return `ℹ️ ${esc(m)} ${esc(path)} (${status})${foot}`;
}

const lastErr = new Map();

/** Invia un messaggio al proprietario. Non lancia mai errori. */
export async function sendTelegram(env, html, fetcher = globalThis.fetch) {
  try {
    const token = env?.TELEGRAM_BOT_TOKEN;
    const owner = env?.TELEGRAM_OWNER_ID;
    if (!token || !owner || !html) return false;
    const text = html.length > 3900 ? `${html.slice(0, 3890)}…` : html;
    const res = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: String(owner), text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const envOf = (c) => ({ ...(typeof process !== 'undefined' ? process.env : {}), ...(c.env || {}) });
const wait = (c, p) => { try { c.executionCtx.waitUntil(p); } catch { /* su Node la richiesta non si chiude: si lascia correre */ } };

/** Middleware Hono: dopo ogni richiesta decide se avvisare. */
export const notifyMiddleware = async (c, next) => {
  const env = envOf(c);
  const enabled = env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_OWNER_ID;
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  let body = {};
  if (enabled && method !== 'GET' && method !== 'OPTIONS' && method !== 'HEAD') {
    try { body = await c.req.raw.clone().json(); } catch { body = {}; }
  }
  let thrown;
  try { await next(); } catch (e) { thrown = e; }
  if (enabled) {
    try {
      const status = thrown ? 500 : c.res.status;
      let result = {};
      if (!thrown && (c.res.headers.get('content-type') || '').includes('json')) { try { result = await c.res.clone().json(); } catch { result = {}; } }
      const err = thrown || c.get('err');
      const login = c.get('login_event');
      const denied = c.get('denied_email');
      let text = describeEvent({
        method, path, status, user: c.get('user'), body, result, denied, login: false,
        error: err ? `${err.message || err}` : (status >= 500 ? result.error : ''),
        ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'), country: c.req.header('cf-ipcountry'),
      });
      if (text && status >= 500) { // evita raffiche dello stesso errore
        const key = `${method} ${path} ${err?.message || ''}`;
        const last = lastErr.get(key) || 0;
        if (Date.now() - last < 300000) text = null; else lastErr.set(key, Date.now());
      }
      if (text) wait(c, sendTelegram(env, text));
      if (login && c.get('user')) wait(c, sendTelegram(env, describeEvent({ login: true, user: c.get('user'), ip: c.req.header('cf-connecting-ip'), country: c.req.header('cf-ipcountry'), method, path, status })));
    } catch { /* le notifiche non devono mai rompere il gestionale */ }
  }
  if (thrown) throw thrown;
};
