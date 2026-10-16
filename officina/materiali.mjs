// Materiali da ordinare: unica lista di tutto cio' che e' "da ordinare", dagli ordini (cliente/negozio) e dai ricambi
// delle riparazioni, raggruppata per fornitore. Segna ordinato in blocco, testo pronto per WhatsApp/email e
// promemoria giornaliero su Telegram (orario e giorni configurabili in Impostazioni), solo se c'e' qualcosa da ordinare.
import { db, tx, getSettings, nowLocal } from './dbref.mjs';
import { HttpError } from './logic.mjs';
import { setOrderStatus, getOrder } from './ordini.mjs';
import { sendTelegram } from './notify.mjs';

const NOW = "datetime('now','localtime')";
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export const PART_STATES = { da_ordinare: 'Da ordinare', ordinato: 'Ordinato', arrivato: 'Arrivato' };
export const MATERIALS_DEFAULTS = { materials_reminder_enabled: '1', materials_reminder_time: '12:00', materials_reminder_days: '1,2,3,4,5' };
/** Impostazioni modificabili da Impostazioni (il registro dell'ultimo invio e' interno e non si modifica da fuori). */
export const MATERIALS_SETTING_KEYS = Object.keys(MATERIALS_DEFAULTS);

/** Testo pronto per il fornitore (WhatsApp / email / copia). */
export const supplierText = (shop, lines) => `Buongiorno, da ${shop || 'Informatix Repair'} vorremmo ordinare:\n${lines.map((l) => `- ${l.qty}× ${l.description}${l.code_supplier ? ` (cod. ${l.code_supplier})` : ''}`).join('\n')}\nGrazie!`;

/** Tutte le righe "da ordinare", raggruppate per fornitore (le righe senza fornitore finiscono in un gruppo a parte). */
export async function materialsToOrder() {
  const settings = await getSettings();
  const suppliers = await db.prepare('SELECT id, name, phone, email FROM suppliers').all();
  const byName = new Map(suppliers.map((s) => [norm(s.name), s]));
  const supById = new Map(suppliers.map((s) => [s.id, s]));
  const groups = new Map();
  const group = (sup, fallbackName) => {
    const key = sup ? `s${sup.id}` : fallbackName ? `n${norm(fallbackName)}` : 'none';
    if (!groups.has(key)) groups.set(key, { key, supplier_id: sup?.id || null, supplier_name: sup?.name || fallbackName || 'Senza fornitore', supplier_phone: sup?.phone || null, supplier_email: sup?.email || null, order_ids: [], part_ids: [], lines: [] });
    return groups.get(key);
  };
  const orderRows = await db.prepare(`SELECT o.id AS order_id, o.code, o.kind, o.supplier_id, c.name AS customer_name, i.description, i.qty
    FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 'da_ordinare' ORDER BY o.id, i.id`).all();
  for (const r of orderRows) {
    const g = group(supById.get(r.supplier_id));
    if (!g.order_ids.includes(r.order_id)) g.order_ids.push(r.order_id);
    g.lines.push({ source: 'ordine', order_id: r.order_id, ref: r.code, description: r.description, qty: r.qty, for: r.kind === 'cliente' ? r.customer_name : 'Negozio' });
  }
  const partRows = await db.prepare(`SELECT p.id, p.name, p.qty, p.supplier_name, p.supplier_code, r.id AS repair_id, r.code, r.brand_model, c.name AS customer_name
    FROM repair_parts p JOIN repairs r ON r.id = p.repair_id LEFT JOIN customers c ON c.id = r.customer_id
    WHERE p.order_state = 'da_ordinare' ORDER BY p.id`).all();
  for (const p of partRows) {
    const g = group(byName.get(norm(p.supplier_name)), p.supplier_name);
    g.part_ids.push(p.id);
    g.lines.push({ source: 'riparazione', part_id: p.id, repair_id: p.repair_id, ref: p.code, description: p.name, qty: p.qty, code_supplier: p.supplier_code, for: [p.customer_name, p.brand_model].filter(Boolean).join(' · ') });
  }
  const list = [...groups.values()].sort((a, b) => (a.supplier_name === 'Senza fornitore') - (b.supplier_name === 'Senza fornitore') || a.supplier_name.localeCompare(b.supplier_name, 'it'));
  for (const g of list) g.text = supplierText(settings.shop_name, g.lines);
  return list;
}

export const countMaterials = (groups) => groups.reduce((n, g) => n + g.lines.length, 0);

/** Segna "ordinato" in blocco ordini e ricambi indicati (gli altri stati non si toccano). */
export async function markOrdered({ order_ids = [], part_ids = [] } = {}) {
  const oids = [...new Set((Array.isArray(order_ids) ? order_ids : []).map(Number).filter(Boolean))];
  const pids = [...new Set((Array.isArray(part_ids) ? part_ids : []).map(Number).filter(Boolean))];
  if (!oids.length && !pids.length) throw new HttpError(400, 'Operazione non eseguita: non è selezionato nessun ordine né ricambio.', { code: 'NESSUNA_SELEZIONE', hint: 'Spunta almeno una riga e riprova.' });
  let orders = 0, parts = 0;
  await tx(async () => {
    for (const id of oids) { const o = await getOrder(id); if (o.status === 'da_ordinare') { await setOrderStatus(id, 'ordinato'); orders++; } }
    for (const id of pids) {
      const r = await db.prepare(`UPDATE repair_parts SET order_state='ordinato', ordered_at=${NOW} WHERE id=? AND order_state='da_ordinare'`).run(id);
      parts += r.changes ? 1 : 0;
    }
  });
  return { ok: true, orders, parts };
}

/** Cambia lo stato di un ricambio di riparazione: da_ordinare | ordinato | arrivato | null (non serve ordinarlo). */
export async function setPartState(partId, state) {
  const p = await db.prepare('SELECT id FROM repair_parts WHERE id = ?').get(partId);
  if (!p) throw new HttpError(404, 'Ricambio non trovato', { code: 'RICAMBIO_NON_TROVATO', hint: 'Aggiorna l’elenco: potrebbe essere stato eliminato.' });
  const st = state ? String(state) : null;
  if (st && !PART_STATES[st]) throw new HttpError(400, 'Lo stato indicato per il ricambio non esiste.', { code: 'STATO_RICAMBIO_NON_VALIDO', hint: 'Scegli uno degli stati proposti.' });
  await db.prepare(`UPDATE repair_parts SET order_state=?, ordered_at=${st === 'ordinato' ? NOW : 'ordered_at'} WHERE id=?`).run(st, partId);
  return db.prepare('SELECT * FROM repair_parts WHERE id = ?').get(partId);
}

// ---------- Promemoria giornaliero ----------
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
/** Legge e normalizza le impostazioni del promemoria (valori sbagliati tornano al predefinito). */
export function reminderConfig(settings = {}) {
  const get = (k) => (settings[k] == null || settings[k] === '' ? MATERIALS_DEFAULTS[k] : String(settings[k]));
  const m = get('materials_reminder_time').trim().match(HHMM) || MATERIALS_DEFAULTS.materials_reminder_time.match(HHMM);
  const days = get('materials_reminder_days').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return {
    enabled: get('materials_reminder_enabled') === '1',
    time: `${m[1].padStart(2, '0')}:${m[2]}`,
    days: days.length ? [...new Set(days)] : [1, 2, 3, 4, 5], // 0 = domenica ... 6 = sabato
  };
}
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Dopo l'orario scelto il messaggio parte entro questa finestra (se il cron salta qualche minuto parte comunque; oltre, si aspetta il giorno dopo). */
export const REMINDER_WINDOW_MIN = 120;

/** Controlla i valori in arrivo da Impostazioni. */
export function validateReminderSettings(b) {
  if ('materials_reminder_time' in b && !HHMM.test(String(b.materials_reminder_time).trim())) throw new HttpError(400, 'L’orario del promemoria materiali non è valido.', { code: 'ORARIO_NON_VALIDO', hint: 'Usa il formato ore:minuti, es. 12:00.' });
  if ('materials_reminder_days' in b) {
    const ok = String(b.materials_reminder_days).split(',').map((x) => x.trim()).filter(Boolean);
    if (ok.some((d) => !/^[0-6]$/.test(d))) throw new HttpError(400, 'I giorni del promemoria materiali non sono validi.', { code: 'GIORNI_NON_VALIDI', hint: 'Scegli giorni della settimana da 0 (domenica) a 6 (sabato).' });
  }
}

/** Chiamata dal cron al minuto: invia su Telegram l'elenco da ordinare, una volta al giorno, nei giorni scelti e solo se c'e' qualcosa. */
export async function notifyMaterialsDue(env, fetcher, now = nowLocal()) {
  if (!env?.TELEGRAM_BOT_TOKEN || !env?.TELEGRAM_OWNER_ID) return { sent: false, reason: 'telegram' };
  const settings = await getSettings();
  const cfg = reminderConfig(settings);
  if (!cfg.enabled) return { sent: false, reason: 'spento' };
  const today = now.slice(0, 10);
  if (!cfg.days.includes(new Date(`${today}T12:00:00`).getDay())) return { sent: false, reason: 'giorno' };
  const diff = minutes(now.slice(11, 16)) - minutes(cfg.time);
  if (diff < 0 || diff >= REMINDER_WINDOW_MIN) return { sent: false, reason: 'orario' };
  if (settings.materials_reminder_last === today) return { sent: false, reason: 'gia_inviato' };
  const groups = await materialsToOrder();
  const total = countMaterials(groups);
  if (!total) return { sent: false, reason: 'niente' };
  const body = groups.map((g) => `\n<b>${esc(g.supplier_name)}</b>\n${g.lines.map((l) => `• ${l.qty}× ${esc(l.description)}${l.for ? ` <i>(${esc(l.for)})</i>` : ''}`).join('\n')}`).join('\n');
  const ok = await sendTelegram(env, `📦 <b>Materiali da ordinare</b> (${total})\n${body}`, fetcher);
  if (ok) await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('materials_reminder_last', today);
  return { sent: ok, reason: ok ? 'ok' : 'errore', count: total };
}

const envOf = (c) => ({ ...(typeof process !== 'undefined' ? process.env : {}), ...(c?.env || {}) });

/** Per /api/alerts: fa partire il promemoria (mai bloccante) e mostra una riga in "Oggi" se c'e' materiale da ordinare. */
export async function materialsAlerts(c) {
  try { await notifyMaterialsDue(envOf(c)); } catch { /* le notifiche non devono rompere gli avvisi */ }
  const n = countMaterials(await materialsToOrder());
  return n ? [{ type: 'materials_to_order', severity: 'low', title: `${n} ${n === 1 ? 'materiale' : 'materiali'} da ordinare`, detail: 'Apri la lista per fornitore e segna ordinato.', link: '#/materiali' }] : [];
}

export function registerMaterialsRoutes(app, h) {
  app.get('/api/materiali', h(async () => { const groups = await materialsToOrder(); return { count: countMaterials(groups), groups }; }));
  app.post('/api/materiali/mark-ordered', h((req) => markOrdered(req.body)));
  app.post('/api/materiali/parts/:id/state', h((req) => setPartState(req.params.id, req.body.state)));
  app.get('/api/materiali/config', h(async () => reminderConfig(await getSettings())));
}
