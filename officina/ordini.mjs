// Ordini: cio' che va ordinato al fornitore per un cliente (pellicola per Tizio, case per Caio...) oppure per il negozio.
// Stati: da_ordinare -> ordinato -> arrivato -> consegnato (oppure annullato). L'acconto e' un incasso normale (tabella payments, kind 'order').
import { db, tx, nowLocal } from './dbref.mjs';
import { assertMethod, HttpError, money, localDate, entityOf } from './logic.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));

export const ORDER_STATUS = {
  da_ordinare: 'Da ordinare', ordinato: 'Ordinato', arrivato: 'Arrivato', consegnato: 'Consegnato', annullato: 'Annullato',
};
export const ORDER_TABLES = ['orders', 'order_items'];

/** Prossimo codice annuale (es. O-2026-0001), calcolato sul massimo gia' usato cosi' non si ripete dopo un'eliminazione. */
export async function nextDocCode(table, prefix) {
  const year = nowLocal().slice(0, 4);
  const rows = await db.prepare(`SELECT code FROM ${table} WHERE code LIKE ?`).all(`${prefix}-${year}-%`);
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.code).split('-').pop()) || 0), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

const SELECT = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email, r.code AS repair_code,
  (SELECT COALESCE(SUM(qty*unit_price),0) FROM order_items i WHERE i.order_id=o.id) AS total,
  (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.kind='order' AND p.ref_id=o.id) AS paid
  FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN suppliers s ON s.id=o.supplier_id LEFT JOIN repairs r ON r.id=o.repair_id`;

const shape = (o) => ({ ...o, status_label: ORDER_STATUS[o.status] || o.status, total: money(o.total), paid: money(o.paid), balance: money(Math.max(0, o.total - o.paid)) });

export async function getOrder(id) {
  const o = await db.prepare(`${SELECT} WHERE o.id = ?`).get(id);
  if (!o) throw new HttpError(404, 'Ordine non trovato', { code: 'ORDINE_NON_TROVATO', hint: 'Riapri l’elenco degli ordini: potrebbe essere stato eliminato.' });
  return { ...shape(o), items: await db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id) };
}

function cleanItems(list) {
  const items = (Array.isArray(list) ? list : []).map((i) => ({ description: str(i.description), qty: Math.max(1, Math.round(num(i.qty, 1))), unit_price: num(i.unit_price, 0) })).filter((i) => i.description);
  if (!items.length) throw new HttpError(400, 'Ordine senza articoli: serve almeno un articolo con la descrizione compilata.', { code: 'ORDINE_SENZA_ARTICOLI', hint: 'Aggiungi almeno un articolo da ordinare (descrizione e quantità) e salva di nuovo.' });
  if (items.some((i) => !Number.isFinite(i.unit_price) || i.unit_price < 0)) throw new HttpError(400, 'Un articolo dell’ordine ha un prezzo non valido (non numerico o negativo).', { code: 'ORDINE_PREZZO_NON_VALIDO', hint: 'Correggi il prezzo con un numero uguale o maggiore di zero (es. 12,50).' });
  return items;
}

async function checkLinks(b) {
  const kind = b.kind === 'fornitore' ? 'fornitore' : 'cliente';
  if (kind === 'cliente' && !b.customer_id) throw new HttpError(400, 'Un ordine per un cliente richiede di sapere chi è il cliente: nessun cliente scelto.', { code: 'ORDINE_CLIENTE_MANCANTE', hint: 'Scegli il cliente dall’anagrafica oppure crea un ordine per il fornitore.' });
  for (const [k, t, msg] of [['customer_id', 'customers', 'Cliente non trovato'], ['supplier_id', 'suppliers', 'Fornitore non trovato'], ['repair_id', 'repairs', 'Riparazione non trovata']]) {
    if (b[k] && !(await db.prepare(`SELECT id FROM ${t} WHERE id = ?`).get(b[k]))) throw new HttpError(404, `${msg}: il record collegato all’ordine non esiste più`, { code: 'COLLEGAMENTO_NON_TROVATO', hint: 'Aggiorna la pagina e scegli di nuovo cliente, fornitore o riparazione.' });
  }
  return kind;
}

async function addDeposit(orderId, code, amount, method, entity = 'main') {
  const a = money(amount);
  if (!(a > 0)) throw new HttpError(400, 'L’importo dell’acconto non è valido: serve un numero maggiore di zero.', { code: 'ACCONTO_NON_VALIDO', hint: 'Scrivi l’acconto in euro (es. 20,00).' });
  assertMethod(method);
  const ins = await db.prepare(`INSERT INTO payments (kind, ref_id, label, amount, method, entity, created_at) VALUES (?,?,?,?,?,?,${NOW})`).run('order', orderId, `Acconto ordine ${code}`, a, str(method) || 'contanti', entity);
  await db.prepare('UPDATE orders SET deposit = deposit + ? WHERE id = ?').run(a, orderId);
  // Controllo anti doppio incasso: due acconti simultanei potrebbero aver superato entrambi il controllo sul residuo.
  const tot = (await db.prepare('SELECT COALESCE(SUM(qty * unit_price),0) AS t FROM order_items WHERE order_id = ?').get(orderId)).t;
  const paid = (await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind = 'order' AND ref_id = ? AND id <= ?").get(orderId, Number(ins.lastInsertRowid))).s;
  if (paid > tot + 0.005) {
    await db.prepare('DELETE FROM payments WHERE id = ?').run(Number(ins.lastInsertRowid));
    await db.prepare('UPDATE orders SET deposit = deposit - ? WHERE id = ?').run(a, orderId);
    throw new HttpError(409, `Ordine ${code}: nello stesso istante è stato registrato un altro acconto e questo avrebbe superato il totale: il tuo acconto NON è stato registrato.`, { code: 'ACCONTO_DOPPIO', hint: 'Ricarica l’ordine e controlla gli acconti già presenti prima di riprovare.' });
  }
}

export async function createOrder(b) {
  const kind = await checkLinks(b);
  const items = cleanItems(b.items);
  const deposit = num(b.deposit, 0);
  if (deposit < 0) throw new HttpError(400, 'L’acconto indicato è negativo: un acconto non può essere inferiore a zero.', { code: 'ACCONTO_NEGATIVO', hint: 'Scrivi 0 oppure un importo positivo.' });
  if (kind === 'fornitore' && deposit > 0) throw new HttpError(400, 'L’acconto non è ammesso: riguarda solo gli ordini presi per i clienti, non quelli al fornitore.', { code: 'ACCONTO_SOLO_CLIENTI', hint: 'Togli l’acconto, oppure cambia il tipo dell’ordine in “cliente”.' });
  if (deposit > items.reduce((s, i) => s + i.qty * i.unit_price, 0) + 0.001) throw new HttpError(400, 'L’acconto indicato è più alto del totale dell’ordine: non si può incassare più di quanto costa.', { code: 'ACCONTO_SUPERA_TOTALE', hint: 'Abbassa l’acconto o controlla i prezzi degli articoli.' });
  return tx(async () => {
    const code = await nextDocCode('orders', 'O');
    const r = await db.prepare(`INSERT INTO orders (code, kind, customer_id, supplier_id, repair_id, expected_date, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,${NOW},${NOW})`)
      .run(code, kind, b.customer_id || null, b.supplier_id || null, b.repair_id || null, str(b.expected_date), str(b.notes));
    const id = Number(r.lastInsertRowid);
    for (const i of items) await db.prepare('INSERT INTO order_items (order_id, description, qty, unit_price) VALUES (?,?,?,?)').run(id, i.description, i.qty, i.unit_price);
    if (deposit > 0) {
      await addDeposit(id, code, deposit, b.deposit_method, entityOf(b));
    }
    return getOrder(id);
  });
}

export async function updateOrder(id, b) {
  const cur = await getOrder(id);
  if (['consegnato', 'annullato'].includes(cur.status)) throw new HttpError(409, `Ordine ${cur.code} già ${cur.status_label.toLowerCase()}: un ordine chiuso non si modifica.`, { code: 'ORDINE_CHIUSO', hint: 'Se serve ancora, riapri l’ordine (un ordine annullato torna “da ordinare”) oppure creane uno nuovo.' });
  const kind = await checkLinks({ ...cur, ...b, kind: cur.kind });
  return tx(async () => {
    await db.prepare(`UPDATE orders SET customer_id=?, supplier_id=?, repair_id=?, expected_date=?, notes=?, updated_at=${NOW} WHERE id=?`)
      .run(kind === 'cliente' ? (b.customer_id ?? cur.customer_id) : null, b.supplier_id ?? cur.supplier_id ?? null, b.repair_id ?? cur.repair_id ?? null, 'expected_date' in b ? str(b.expected_date) : cur.expected_date, 'notes' in b ? str(b.notes) : cur.notes, id);
    if (b.items) {
      const items = cleanItems(b.items);
      if (items.reduce((s, i) => s + i.qty * i.unit_price, 0) + 0.001 < cur.paid) throw new HttpError(400, `Ordine ${cur.code}: il nuovo totale è inferiore all’acconto già incassato (${cur.paid} €).`, { code: 'TOTALE_SOTTO_ACCONTO', hint: 'Alza i prezzi/quantità oppure annulla l’ordine e restituisci l’acconto.' });
      await db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
      for (const i of items) await db.prepare('INSERT INTO order_items (order_id, description, qty, unit_price) VALUES (?,?,?,?)').run(id, i.description, i.qty, i.unit_price);
    }
    return getOrder(id);
  });
}

const FLOW = { da_ordinare: ['ordinato', 'annullato'], ordinato: ['arrivato', 'da_ordinare', 'annullato'], arrivato: ['consegnato', 'ordinato', 'annullato'], consegnato: [], annullato: ['da_ordinare'] };

/** Cambia stato. Alla consegna, con `collect` incassa il saldo residuo (tracciato in cassa). */
export async function setOrderStatus(id, status, { collect, method, appeso } = {}) {
  const o = await getOrder(id);
  if (!ORDER_STATUS[status]) throw new HttpError(400, `Stato ordine “${status}” non valido: non esiste tra gli stati degli ordini.`, { code: 'STATO_ORDINE_NON_VALIDO', hint: 'Scegli uno degli stati proposti (da ordinare, ordinato, arrivato, consegnato, annullato).' });
  if (status === o.status) return o;
  if (!FLOW[o.status].includes(status)) throw new HttpError(409, `Ordine ${o.code}: da “${ORDER_STATUS[o.status]}” non si passa a “${ORDER_STATUS[status]}”.`, { code: 'ORDINE_PASSAGGIO_NON_AMMESSO', hint: 'Segui l’ordine dei passaggi: da ordinare, ordinato, arrivato, consegnato.' });
  return tx(async () => {
    const col = { ordinato: 'ordered_at', arrivato: 'arrived_at', consegnato: 'delivered_at' }[status];
    await db.prepare(`UPDATE orders SET status=?, ${col ? `${col}=${NOW},` : ''} updated_at=${NOW} WHERE id=?`).run(status, id);
    if (status === 'consegnato' && collect && o.balance > 0) {
      assertMethod(method);
      await db.prepare(`INSERT INTO payments (kind, ref_id, label, amount, method, entity, created_at) VALUES (?,?,?,?,?,?,${NOW})`).run('order', id, `Saldo ordine ${o.code}`, o.balance, str(method) || 'contanti', entityOf({ appeso }));
    }
    return getOrder(id);
  });
}

/** Righe ancora "da ordinare", raggruppate per fornitore: la lista per fare un ordine unico. */
export async function toOrder() {
  const rows = await db.prepare(`SELECT o.id AS order_id, o.code, o.kind, o.supplier_id, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email,
      c.name AS customer_name, i.description, i.qty
    FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN suppliers s ON s.id = o.supplier_id LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 'da_ordinare' ORDER BY s.name IS NULL, s.name, o.id, i.id`).all();
  const groups = new Map();
  for (const r of rows) {
    const k = r.supplier_id || 0;
    if (!groups.has(k)) groups.set(k, { supplier_id: r.supplier_id, supplier_name: r.supplier_name || 'Senza fornitore', supplier_phone: r.supplier_phone, supplier_email: r.supplier_email, order_ids: [], lines: [] });
    const g = groups.get(k);
    if (!g.order_ids.includes(r.order_id)) g.order_ids.push(r.order_id);
    g.lines.push({ order_id: r.order_id, code: r.code, description: r.description, qty: r.qty, for: r.kind === 'cliente' ? r.customer_name : 'Negozio' });
  }
  return [...groups.values()];
}

/** Avvisi per campanella e "Oggi". */
export async function orderAlerts() {
  const out = [];
  const today = localDate();
  const arrived = await db.prepare(`${SELECT} WHERE o.status = 'arrivato' AND o.kind = 'cliente' ORDER BY o.arrived_at`).all();
  for (const o of arrived) out.push({ type: 'order_arrived', severity: 'medium', title: `Ordine ${o.code} arrivato`, detail: `${o.customer_name}: avvisalo che può ritirare${o.total - o.paid > 0 ? ` (da saldare ${money(o.total - o.paid).toFixed(2)} €)` : ''}.`, link: '#/ordini?stato=arrivato', ref: o.id });
  const late = await db.prepare(`${SELECT} WHERE o.status = 'ordinato' AND o.expected_date IS NOT NULL AND o.expected_date < ?`).all(today);
  for (const o of late) out.push({ type: 'order_late', severity: 'medium', title: `Ordine ${o.code} in ritardo`, detail: `${o.customer_name || o.supplier_name || 'Negozio'}: doveva arrivare il ${o.expected_date}. Sollecita il fornitore.`, link: '#/ordini?stato=ordinato', ref: o.id });
  return out;
}

export function registerOrderRoutes(app, h) {
  app.get('/api/orders', h(async (req) => {
    const where = [];
    const args = [];
    if (req.query.stato === 'aperti') where.push("o.status IN ('da_ordinare','ordinato','arrivato')");
    else if (req.query.stato) { where.push('o.status = ?'); args.push(req.query.stato); }
    if (req.query.kind) { where.push('o.kind = ?'); args.push(req.query.kind); }
    if (req.query.customer_id) { where.push('o.customer_id = ?'); args.push(req.query.customer_id); }
    if (req.query.repair_id) { where.push('o.repair_id = ?'); args.push(req.query.repair_id); }
    const q = str(req.query.q);
    if (q) {
      where.push('(o.code LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.description LIKE ?))');
      args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const list = await db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.id DESC LIMIT 300`).all(...args);
    const items = list.length ? await db.prepare(`SELECT order_id, description, qty FROM order_items WHERE order_id IN (${list.map(() => '?').join(',')}) ORDER BY id`).all(...list.map((o) => o.id)) : [];
    return list.map((o) => ({ ...shape(o), items: items.filter((i) => i.order_id === o.id) }));
  }));
  app.get('/api/orders/meta', h(() => ({ statuses: ORDER_STATUS, flow: FLOW })));
  app.get('/api/orders/to-order', h(() => toOrder()));
  app.post('/api/orders/mark-ordered', h(async (req) => {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
    if (!ids.length) throw new HttpError(400, 'Nessun ordine selezionato: non so quali segnare come ordinati.', { code: 'ORDINI_NESSUNO_SELEZIONATO', hint: 'Spunta almeno un ordine nell’elenco e riprova.' });
    await tx(async () => { for (const id of ids) { const o = await getOrder(id); if (o.status === 'da_ordinare') await setOrderStatus(id, 'ordinato'); } });
    return { ok: true, count: ids.length };
  }));
  app.get('/api/orders/:id', h((req) => getOrder(req.params.id)));
  app.post('/api/orders', h((req) => createOrder(req.body)));
  app.put('/api/orders/:id', h((req) => updateOrder(req.params.id, req.body)));
  app.post('/api/orders/:id/status', h((req) => setOrderStatus(req.params.id, req.body.status, { collect: !!req.body.collect, method: req.body.method, appeso: req.body.appeso })));
  app.post('/api/orders/:id/deposit', h(async (req) => {
    const o = await getOrder(req.params.id);
    if (['consegnato', 'annullato'].includes(o.status)) throw new HttpError(409, `Ordine ${o.code} già ${o.status_label.toLowerCase()}: non accetta più acconti.`, { code: 'ORDINE_CHIUSO', hint: 'Un acconto si registra solo su ordini ancora aperti.' });
    if (o.kind !== 'cliente') throw new HttpError(400, 'L’acconto non è ammesso: riguarda solo gli ordini presi per i clienti, non quelli al fornitore.', { code: 'ACCONTO_SOLO_CLIENTI', hint: 'Togli l’acconto, oppure cambia il tipo dell’ordine in “cliente”.' });
    if (num(req.body.amount) > o.balance + 0.001) throw new HttpError(400, `Ordine ${o.code}: l’acconto supera il residuo da pagare (${o.balance} €).`, { code: 'ACCONTO_SUPERA_RESIDUO', hint: 'Scrivi un acconto non superiore al residuo, oppure consegna l’ordine incassando il saldo.' });
    await tx(() => addDeposit(o.id, o.code, num(req.body.amount), req.body.method, entityOf(req.body)));
    return getOrder(o.id);
  }));
  app.delete('/api/orders/:id', h(async (req) => {
    const o = await getOrder(req.params.id);
    if (o.paid > 0) throw new HttpError(409, `Ordine ${o.code}: ci sono incassi registrati (${o.paid} €), quindi non si può eliminare per non perdere traccia dei soldi.`, { code: 'ORDINE_CON_INCASSI', hint: 'Annulla l’ordine invece di eliminarlo.' });
    await db.prepare('DELETE FROM orders WHERE id = ?').run(o.id);
    return { ok: true };
  }));
}
