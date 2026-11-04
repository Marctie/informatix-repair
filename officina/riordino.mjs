// Proposta d'ordine calcolata e arrivo merce con controllo delle differenze (spunti da e-Share).
// Proposta: articoli attivi sotto (o alla) scorta minima. Quantita' = quanto serve per tornare al doppio della scorta minima
// oppure, se si vende di piu', ai consumi degli ultimi 30 giorni + scorta minima; meno quanto e' gia' in ordine.
// Arrivo: per ogni riga si scrive quanto e' arrivato davvero; gli articoli collegati al magazzino si caricano da soli
// e le differenze (mancanti, in piu') restano scritte nell'ordine.
import { db, tx } from './dbref.mjs';
import { HttpError, money, moveStock } from './logic.mjs';
import { createOrder, getOrder } from './ordini.mjs';

const NOW = "datetime('now','localtime')";
const OPEN = "('da_ordinare','ordinato')";

export async function reorderProposal() {
  const prods = await db.prepare(`SELECT p.id, p.name, p.sku, p.qty, p.min_qty, p.cost, p.supplier_id, s.name AS supplier_name,
      COALESCE((SELECT -SUM(m.delta) FROM stock_moves m WHERE m.product_id = p.id AND m.delta < 0 AND m.created_at >= datetime('now','localtime','-30 days')), 0) AS used30,
      COALESCE((SELECT SUM(i.qty - COALESCE(i.qty_received, 0)) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = p.id AND o.status IN ${OPEN}), 0) AS on_order
    FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.active = 1 AND p.min_qty > 0 AND p.qty <= p.min_qty ORDER BY s.name IS NULL, s.name, p.name`).all();
  const groups = new Map();
  for (const p of prods) {
    const target = Math.max(p.min_qty * 2, Math.ceil(p.used30) + p.min_qty);
    const qty = Math.max(0, target - Math.max(0, p.qty) - p.on_order);
    const k = p.supplier_id || 0;
    if (!groups.has(k)) groups.set(k, { supplier_id: p.supplier_id || null, supplier_name: p.supplier_name || 'Senza fornitore', lines: [], total: 0 });
    const g = groups.get(k);
    g.lines.push({ product_id: p.id, name: p.name, sku: p.sku, qty_now: p.qty, min_qty: p.min_qty, used30: p.used30, on_order: p.on_order, suggested: qty, cost: p.cost, reason: p.on_order >= target - Math.max(0, p.qty) ? 'già in ordine' : p.used30 + p.min_qty > p.min_qty * 2 ? `vendita alta: ${p.used30} in 30 giorni` : 'sotto scorta minima' });
    g.total = money(g.total + qty * (p.cost || 0));
  }
  const list = [...groups.values()];
  return { groups: list, lines: list.reduce((a, g) => a + g.lines.filter((l) => l.suggested > 0).length, 0), total: money(list.reduce((a, g) => a + g.total, 0)) };
}

/** Crea gli ordini al fornitore (uno per fornitore) dalle righe scelte. */
export async function createFromProposal(lines) {
  const chosen = (Array.isArray(lines) ? lines : []).map((l) => ({ product_id: Number(l.product_id), qty: Math.round(Number(l.qty)) })).filter((l) => l.product_id && l.qty > 0);
  if (!chosen.length) throw new HttpError(400, 'Nessuna riga scelta: non c’è nulla da ordinare.', { code: 'PROPOSTA_VUOTA', hint: 'Spunta almeno un articolo con quantità maggiore di zero.' });
  const bySupplier = new Map();
  for (const l of chosen) {
    const p = await db.prepare('SELECT id, name, cost, supplier_id FROM products WHERE id = ?').get(l.product_id);
    if (!p) throw new HttpError(404, `Articolo n. ${l.product_id} non trovato in magazzino.`, { code: 'PRODOTTO_NON_TROVATO', hint: 'Ricarica la proposta d’ordine.' });
    const k = p.supplier_id || 0;
    if (!bySupplier.has(k)) bySupplier.set(k, []);
    bySupplier.get(k).push({ description: p.name, qty: l.qty, unit_price: p.cost || 0, product_id: p.id });
  }
  const created = [];
  for (const [sup, items] of bySupplier) created.push(await createOrder({ kind: 'fornitore', supplier_id: sup || null, items, notes: 'Creato dalla proposta d’ordine' }));
  return { orders: created.map((o) => ({ id: o.id, code: o.code, supplier_name: o.supplier_name || 'Senza fornitore', lines: o.items.length, total: o.total })) };
}

/** Arrivo merce: quantita' arrivate per riga, carico a magazzino, differenze scritte nell'ordine. */
export async function receiveOrder(id, body = {}) {
  const o = await getOrder(id);
  if (!['ordinato', 'da_ordinare', 'arrivato'].includes(o.status)) throw new HttpError(409, `Ordine ${o.code} ${o.status_label.toLowerCase()}: l’arrivo non si registra.`, { code: 'ORDINE_CHIUSO', hint: 'Registra l’arrivo solo su ordini “ordinato”.' });
  if (o.items.some((i) => i.qty_received != null)) throw new HttpError(409, `L’arrivo dell’ordine ${o.code} è già stato registrato.`, { code: 'ARRIVO_GIA_REGISTRATO', hint: 'Per correzioni usa Magazzino → Rettifica.' });
  const given = new Map((Array.isArray(body.lines) ? body.lines : []).map((l) => [Number(l.item_id), l.qty_received]));
  const rows = o.items.map((i) => {
    const v = given.has(i.id) ? Number(String(given.get(i.id)).replace(',', '.')) : i.qty;
    if (!Number.isInteger(v) || v < 0) throw new HttpError(400, `Quantità arrivata non valida per «${i.description}».`, { code: 'QUANTITA_NON_VALIDA', hint: 'Scrivi un numero intero, 0 se non è arrivato.' });
    return { ...i, got: v, diff: v - i.qty };
  });
  const diffs = rows.filter((r) => r.diff !== 0).map((r) => ({ description: r.description, ordered: r.qty, received: r.got, diff: r.diff }));
  const note = diffs.length ? diffs.map((d) => `${d.description}: ordinati ${d.ordered}, arrivati ${d.received} (${d.diff > 0 ? '+' : ''}${d.diff})`).join('; ') : 'Arrivato tutto come ordinato.';
  let loaded = 0;
  await tx(async () => {
    for (const r of rows) {
      await db.prepare('UPDATE order_items SET qty_received = ? WHERE id = ?').run(r.got, r.id);
      if (r.product_id && r.got > 0 && body.load_stock !== false) { await moveStock(r.product_id, r.got, 'arrivo ordine', o.code); loaded += r.got; }
    }
    await db.prepare(`UPDATE orders SET status = 'arrivato', arrived_at = COALESCE(arrived_at, ${NOW}), received_note = ?, updated_at = ${NOW} WHERE id = ?`).run(note, id);
  });
  return { ...(await getOrder(id)), differences: diffs, loaded, received_note: note };
}

export async function receiptDifferences() {
  return db.prepare("SELECT id, code, received_note, arrived_at FROM orders WHERE received_note IS NOT NULL AND received_note <> 'Arrivato tutto come ordinato.' ORDER BY arrived_at DESC LIMIT 50").all();
}

export function registerReorderRoutes(app, h) {
  app.get('/api/riordino', h(() => reorderProposal()));
  app.post('/api/riordino', h((req) => createFromProposal(req.body.lines)));
  app.post('/api/orders/:id{[0-9]+}/receive', h((req) => receiveOrder(req.params.id, req.body)));
  app.get('/api/orders/differenze', h(() => receiptDifferences()));
}
