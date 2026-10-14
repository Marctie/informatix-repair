// Logica di dominio del gestionale officina (stati, progressi, codici, viste pubbliche).
import { db, getSettings, tx, nowLocal } from './dbref.mjs';
import { priceAlerts } from './purchases.mjs';
import { planSettlement, commitSettlement, voucherUsage } from './buoni.mjs';
import { deviceHook, alertText } from './dispositivi.mjs';

import { fillText, isVerified, buildQuoteFlow } from './legal.mjs';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- Stati riparazione ----------
// step = passo mostrato al cliente nella barra di avanzamento (0..5)
export const STATUSES = {
  received: { label: 'Ricevuto', step: 0, hint: 'Abbiamo preso in carico il tuo dispositivo.' },
  diagnosing: { label: 'In diagnosi', step: 1, hint: 'Stiamo controllando il guasto.' },
  quote_pending: { label: 'Preventivo da approvare', step: 2, hint: 'Ti abbiamo inviato il preventivo: attendiamo la tua conferma.' },
  approved: { label: 'Preventivo approvato', step: 3, hint: 'Preventivo approvato: si procede con la riparazione.' },
  waiting_parts: { label: 'In attesa ricambi', step: 3, hint: 'Stiamo aspettando il ricambio necessario.' },
  repairing: { label: 'In riparazione', step: 3, hint: 'Il tecnico sta lavorando sul tuo dispositivo.' },
  ready: { label: 'Pronto per il ritiro', step: 4, hint: 'Puoi passare a ritirare il tuo dispositivo.' },
  delivered: { label: 'Consegnato', step: 5, hint: 'Dispositivo consegnato. Grazie per averci scelto!' },
  cancelled: { label: 'Annullato / non riparabile', step: -1, hint: 'La riparazione non è stata eseguita.' },
};
export const STEP_LABELS = ['Ricevuto', 'Diagnosi', 'Preventivo', 'Lavori', 'Pronto', 'Ritirato'];
// Prossimo stato "naturale" per il pulsante rapido "Avanza".
export const NEXT_STATUS = {
  received: 'diagnosing',
  diagnosing: 'quote_pending',
  quote_pending: 'approved',
  approved: 'repairing',
  waiting_parts: 'repairing',
  repairing: 'ready',
  ready: 'delivered',
};

export const progressPct = (status) => {
  const s = STATUSES[status];
  if (!s || s.step < 0) return 0;
  return Math.round((s.step / 5) * 100);
};

// ---------- Utilità ----------
/** Data locale YYYY-MM-DD (toISOString userebbe l'UTC e sbaglierebbe giorno vicino a mezzanotte). */
export const localDate = (d = new Date()) => nowLocal(d).slice(0, 10);
const num = (v, def = null) => {
  if (v === '' || v == null) return def;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) throw new HttpError(400, `Valore numerico non valido: ${v}`);
  return n;
};
export const money = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const str = (v) => (v == null ? null : String(v).trim() || null);
const need = (v, what) => {
  const s = str(v);
  if (!s) throw new HttpError(400, `${what} obbligatorio`);
  return s;
};
export const newToken = () => {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...b)).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '');
};

async function nextCode(table, prefix) {
  const year = nowLocal().slice(0, 4);
  const like = `${prefix}-${year}-%`;
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE code LIKE ?`).get(like);
  return `${prefix}-${year}-${String(row.n + 1).padStart(4, '0')}`;
}

export async function logEvent(repairId, status, note, isPublic = 1) {
  await db.prepare("INSERT INTO repair_events (repair_id, status, note, is_public, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(
    repairId, status, note || null, isPublic ? 1 : 0
  );
  await db.prepare("UPDATE repairs SET updated_at = datetime('now','localtime') WHERE id = ?").run(repairId);
}

export async function moveStock(productId, delta, reason, ref) {
  const p = await db.prepare('SELECT qty FROM products WHERE id = ?').get(productId);
  if (!p) throw new HttpError(404, 'Prodotto non trovato');
  await db.prepare('UPDATE products SET qty = qty + ? WHERE id = ?').run(delta, productId);
  await db.prepare("INSERT INTO stock_moves (product_id, delta, reason, ref, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(productId, delta, reason, ref || null);
}

export async function addPayment(kind, refId, label, amount, method) {
  if (!amount || amount <= 0) return;
  await db.prepare("INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))").run(
    kind, refId, label, money(amount), method || 'contanti'
  );
}

// ---------- Clienti ----------
/** Chiave per riconoscere lo stesso numero scritto in modi diversi (+39 333 123 4567 = 3331234567). */
const phoneKey = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-9) : d;
};
export async function upsertCustomer({ id, name, phone, email, notes }) {
  if (id) {
    const c = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!c) throw new HttpError(404, 'Cliente non trovato');
    return c.id;
  }
  const n = need(name, 'Nome cliente');
  // evita doppioni: stesso telefono => stesso cliente
  const ph = str(phone);
  if (ph) {
    const key = phoneKey(ph);
    if (key) {
      const same = (await db.prepare('SELECT id, phone FROM customers WHERE phone IS NOT NULL').all()).find((c) => phoneKey(c.phone) === key);
      if (same) return same.id;
    }
  }
  const r = await db.prepare("INSERT INTO customers (name, phone, email, notes, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(n, ph, str(email), str(notes));
  return Number(r.lastInsertRowid);
}

// ---------- Riparazioni ----------
export async function createRepair(b) {
  return tx(async () => {
    const customerId = await upsertCustomer(b.customer || {});
    const settings = await getSettings();
    const quote = num(b.quote);
    const deposit = num(b.deposit, 0);
    if ((quote != null && quote < 0) || deposit < 0) throw new HttpError(400, 'Gli importi non possono essere negativi');
    const code = await nextCode('repairs', 'R');
    const token = newToken();
    const r = await db.prepare(
      `INSERT INTO repairs (code, token, customer_id, device_type, brand_model, serial, problem, accessories,
        condition_notes, passcode, quote, deposit, eta_date, warranty_days, quote_decision, urgent, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))`
    ).run(
      code, token, customerId, str(b.device_type) || 'smartphone', need(b.brand_model, 'Dispositivo'), str(b.serial),
      need(b.problem, 'Problema segnalato'), str(b.accessories), str(b.condition_notes), str(b.passcode),
      quote, money(deposit), str(b.eta_date), num(b.warranty_days, Number(settings.default_warranty_days) || 90),
      // se il preventivo è già concordato al banco lo consideriamo approvato dal cliente
      b.quote_agreed && quote != null ? 'accepted' : null,
      b.urgent ? 1 : 0
    );
    const id = Number(r.lastInsertRowid);
    await logEvent(id, 'received', 'Dispositivo ricevuto in laboratorio.');
    // Registro dispositivi: se il seriale e' segnalato (rubato / da verificare) lo scriviamo nella scheda e lo ritorniamo come avviso
    const deviceAlerts = await deviceHook(b.serial, 'riparazione', `Entrato in riparazione ${code}`);
    for (const a of deviceAlerts) await logEvent(id, null, alertText(a), 0);
    if (deposit > 0) await addPayment('repair', id, `Acconto ${code}`, deposit, b.deposit_method);
    if (b.quote_agreed && quote != null) {
      await db.prepare("UPDATE repairs SET status='approved', quote_decided_at=datetime('now','localtime') WHERE id=?").run(id);
      await logEvent(id, 'approved', 'Preventivo concordato al banco.');
    }
    return { ...(await getRepair(id)), device_alerts: deviceAlerts };
  });
}

const REPAIR_SELECT = `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
  FROM repairs r JOIN customers c ON c.id = r.customer_id`;

export async function getRepair(id) {
  const r = await db.prepare(`${REPAIR_SELECT} WHERE r.id = ?`).get(id);
  if (!r) throw new HttpError(404, 'Riparazione non trovata');
  return await decorateRepair(r, true);
}

async function decorateRepair(r, full = false) {
  const st = STATUSES[r.status];
  const out = {
    ...r,
    // nell'elenco i controlli compilati (JSON) non servono: si leggono nel dettaglio
    ...(full ? {} : { checklist_in: undefined, checklist_pre: undefined, checklist_out: undefined }),
    status_label: st.label,
    progress: progressPct(r.status),
    next_status: NEXT_STATUS[r.status] || null,
    next_label: NEXT_STATUS[r.status] ? STATUSES[NEXT_STATUS[r.status]].label : null,
    late: !!(r.eta_date && !['ready', 'delivered', 'cancelled'].includes(r.status) && r.eta_date < localDate()),
  };
  if (full) {
    out.events = await db.prepare('SELECT * FROM repair_events WHERE repair_id = ? ORDER BY id DESC').all(r.id);
    out.parts = await db.prepare('SELECT * FROM repair_parts WHERE repair_id = ? ORDER BY id').all(r.id);
    for (const p of ['in', 'pre', 'out']) {
      let c = null;
      try { c = r[`checklist_${p}`] ? JSON.parse(r[`checklist_${p}`]) : null; } catch { /* JSON rovinato: come se non fosse compilata */ }
      out[`checklist_${p}`] = Array.isArray(c?.items) ? c : null;
    }
    // firme raccolte (senza l'immagine, che si legge a parte): tipo, quando, come
    out.signatures = await db.prepare('SELECT id, kind, signer_name, choice, option_id, via, ip, by_user, signed_at FROM repair_signatures WHERE repair_id = ? ORDER BY id').all(r.id);
    out.quote_options = await db.prepare('SELECT id, label, amount, description FROM quote_options WHERE repair_id = ? ORDER BY sort, id').all(r.id);
    out.parts_cost = money(out.parts.reduce((a, p) => a + p.qty * p.unit_cost, 0));
    out.profit_estimate = (r.final_price ?? r.quote) == null ? null : money((r.final_price ?? r.quote) - out.parts_cost);
    out.paid = money((await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(r.id)).s);
    const warrantyUntil = r.delivered_at ? new Date(new Date(r.delivered_at.replace(' ', 'T')).getTime() + r.warranty_days * 86400000) : null;
    out.warranty_until = warrantyUntil ? localDate(warrantyUntil) : null;
  }
  return out;
}

export async function listRepairs({ status, q, customer_id, open } = {}) {
  const where = [];
  const args = [];
  if (status) { where.push('r.status = ?'); args.push(status); }
  if (open) where.push("r.status NOT IN ('delivered','cancelled')");
  if (customer_id) { where.push('r.customer_id = ?'); args.push(Number(customer_id)); }
  if (q) {
    where.push('(r.code LIKE ? OR r.brand_model LIKE ? OR r.serial LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR r.problem LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like, like, like);
  }
  const sql = `${REPAIR_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.urgent DESC, r.updated_at DESC, r.id DESC LIMIT 500`;
  return Promise.all((await db.prepare(sql).all(...args)).map((r) => decorateRepair(r)));
}

const EDITABLE = ['device_type', 'brand_model', 'serial', 'problem', 'accessories', 'condition_notes', 'passcode', 'quote', 'eta_date', 'warranty_days', 'tech_notes', 'customer_note', 'final_price'];
export async function updateRepair(id, b) {
  return tx(async () => {
    const r = await db.prepare('SELECT * FROM repairs WHERE id = ?').get(id);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    const sets = [];
    const args = [];
    for (const k of EDITABLE) {
      if (!(k in b)) continue;
      let v = b[k];
      if (['quote', 'final_price'].includes(k)) { v = num(v); if (v != null && v < 0) throw new HttpError(400, 'Gli importi non possono essere negativi'); }
      else if (k === 'warranty_days') v = num(v, 90);
      else v = str(v);
      if (['brand_model', 'problem'].includes(k) && !v) throw new HttpError(400, `${k} obbligatorio`);
      sets.push(`${k} = ?`);
      args.push(v);
    }
    if ('urgent' in b) { sets.push('urgent = ?'); args.push(b.urgent ? 1 : 0); }
    if (!sets.length) return await getRepair(id);
    // cambio preventivo dopo l'approvazione: va richiesta una nuova approvazione
    if ('quote' in b && num(b.quote) !== r.quote && ['approved', 'waiting_parts', 'repairing'].includes(r.status) && r.quote != null) {
      sets.push("quote_decision = NULL", "status = 'quote_pending'");
      await logEvent(id, 'quote_pending', `Preventivo aggiornato a ${money(num(b.quote)).toFixed(2)} €: serve una nuova approvazione.`);
    } else if ('quote' in b && num(b.quote) !== r.quote) {
      sets.push('quote_decision = NULL');
    }
    if ('eta_date' in b && str(b.eta_date) !== r.eta_date) await logEvent(id, null, str(b.eta_date) ? `Nuova data stimata: ${str(b.eta_date)}.` : 'Data stimata rimossa.');
    sets.push("updated_at = datetime('now','localtime')");
    await db.prepare(`UPDATE repairs SET ${sets.join(', ')} WHERE id = ?`).run(...args, id);
    if (b.customer && (b.customer.name || b.customer.phone || b.customer.email)) {
      await db.prepare('UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?').run(
        str(b.customer.name), str(b.customer.phone), str(b.customer.email), r.customer_id
      );
    }
    return await getRepair(id);
  });
}

export async function setStatus(id, status, note, isPublic = true) {
  return tx(async () => {
    const r = await db.prepare('SELECT * FROM repairs WHERE id = ?').get(id);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    if (!STATUSES[status]) throw new HttpError(400, 'Stato non valido');
    if (r.status === 'delivered') throw new HttpError(409, 'La riparazione è già stata consegnata.');
    if (r.status === status) throw new HttpError(400, 'La riparazione è già in questo stato.');
    if (status === 'delivered') throw new HttpError(400, 'Per consegnare usa "Consegna e incassa".');
    if (status === 'quote_pending' && r.quote == null && !(await db.prepare('SELECT 1 AS x FROM quote_options WHERE repair_id = ? LIMIT 1').get(id))) throw new HttpError(400, 'Inserisci prima il preventivo (o le opzioni).');
    await db.prepare("UPDATE repairs SET status = ?, quote_decision = CASE WHEN ?='quote_pending' THEN NULL ELSE quote_decision END WHERE id = ?").run(status, status, id);
    if (status === 'approved' && !r.quote_decision) {
      await db.prepare("UPDATE repairs SET quote_decision='accepted', quote_decided_at=datetime('now','localtime') WHERE id=?").run(id);
    }
    await logEvent(id, status, note || STATUSES[status].hint, isPublic);
    return await getRepair(id);
  });
}

export async function deliverRepair(id, { final_price, method, note, ...pay } = {}) {
  return tx(async () => {
    const r = await db.prepare('SELECT * FROM repairs WHERE id = ?').get(id);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    if (r.status === 'delivered') throw new HttpError(400, 'Già consegnata.');
    const final = money(num(final_price, r.final_price ?? r.quote ?? 0));
    const paid = (await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(id)).s;
    const due = Math.max(0, money(final - paid));
    // Buono e/o pagamento diviso (buoni.mjs): il piano controlla tutto prima di scrivere; lo sconto del buono riduce il prezzo finale
    const plan = await planSettlement({ ...pay, method }, due);
    await commitSettlement(plan, { kind: 'repair', refId: id, label: `Saldo ${r.code}` }, addPayment);
    await db.prepare("UPDATE repairs SET status='delivered', final_price=?, delivered_at=datetime('now','localtime') WHERE id=?").run(money(final - plan.discount), id);
    if (plan.voucher) await logEvent(id, null, `Buono ${plan.voucher.code}: ${money(plan.discount + plan.gift).toFixed(2)} €.`, 0);
    await logEvent(id, 'delivered', note || STATUSES.delivered.hint);
    return { ...(await getRepair(id)), collected: money(due - plan.discount - plan.gift) };
  });
}

export async function addPart(repairId, { product_id, name, qty, unit_price, unit_cost, supplier_code, supplier_name, bought_at }) {
  return tx(async () => {
    const r = await db.prepare('SELECT code FROM repairs WHERE id = ?').get(repairId);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    const q = Math.max(1, Math.round(num(qty, 1)));
    let pName = str(name), price = num(unit_price, 0), cost = 0, pid = null;
    if (product_id) {
      const p = await db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
      if (!p) throw new HttpError(404, 'Prodotto non trovato');
      pid = p.id; pName = pName || p.name; cost = p.cost;
      if (unit_price === undefined || unit_price === '') price = p.price;
      await moveStock(p.id, -q, 'riparazione', r.code);
    }
    if (!pName) throw new HttpError(400, 'Nome ricambio obbligatorio');
    // Ricambio a mano (non a magazzino): il costo d'acquisto inserito entra nel guadagno della riparazione.
    if (!pid) {
      cost = num(unit_cost, 0);
      if (cost < 0 || price < 0) throw new HttpError(400, 'Gli importi non possono essere negativi');
    }
    await db.prepare('INSERT INTO repair_parts (repair_id, product_id, name, qty, unit_price, unit_cost, supplier_code, supplier_name, bought_at) VALUES (?,?,?,?,?,?,?,?,?)').run(repairId, pid, pName, q, money(price), money(cost), pid ? null : str(supplier_code), pid ? null : str(supplier_name), pid ? null : str(bought_at));
    await logEvent(repairId, null, `Ricambio usato: ${pName}${q > 1 ? ` ×${q}` : ''}.`, 0);
    return await getRepair(repairId);
  });
}

export async function removePart(repairId, partId) {
  return tx(async () => {
    const part = await db.prepare('SELECT * FROM repair_parts WHERE id = ? AND repair_id = ?').get(partId, repairId);
    if (!part) throw new HttpError(404, 'Ricambio non trovato');
    if (part.product_id) {
      const r = await db.prepare('SELECT code FROM repairs WHERE id = ?').get(repairId);
      await moveStock(part.product_id, part.qty, 'rimosso da riparazione', r.code);
    }
    await db.prepare('DELETE FROM repair_parts WHERE id = ?').run(partId);
    return await getRepair(repairId);
  });
}

export async function addNote(id, note, isPublic) {
  const text = need(note, 'Nota');
  const r = await db.prepare('SELECT status FROM repairs WHERE id = ?').get(id);
  if (!r) throw new HttpError(404, 'Riparazione non trovata');
  await logEvent(id, null, text, isPublic);
  return await getRepair(id);
}

// ---------- Vendite ----------
export async function createSale(b) {
  return tx(async () => {
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) throw new HttpError(400, 'Aggiungi almeno un articolo');
    // 1) si legge tutto e si controlla (nessuna scrittura): totale, buono e quote del pagamento diviso
    const lines = [];
    let total = 0;
    for (const it of items) {
      const q = Math.max(1, Math.round(num(it.qty, 1)));
      let name = str(it.name), price = num(it.unit_price), cost = Math.max(0, num(it.unit_cost, 0)), pid = null;
      if (it.product_id) {
        const p = await db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
        if (!p) throw new HttpError(404, 'Prodotto non trovato');
        pid = p.id; name = name || p.name; cost = p.cost;
        if (price == null) price = p.price;
      }
      if (!name) throw new HttpError(400, 'Nome articolo obbligatorio');
      if (price == null || price < 0) throw new HttpError(400, `Prezzo mancante per ${name}`);
      lines.push({ pid, name, q, price, cost, serial: str(it.serial) });
      total += q * price;
    }
    const baseDiscount = money(num(b.discount, 0));
    total = money(total - baseDiscount);
    if (total < 0) throw new HttpError(400, 'Lo sconto supera il totale');
    const plan = await planSettlement(b, total);
    total = money(total - plan.discount);
    // 2) si scrive
    const code = await nextCode('sales', 'V');
    const sale = await db.prepare("INSERT INTO sales (code, customer_id, total, discount, method, notes, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))").run(
      code, b.customer_id || null, total, money(baseDiscount + plan.discount), plan.split || plan.gift ? plan.methodLabel : (str(b.method) || plan.methodLabel), str(b.notes)
    );
    const saleId = Number(sale.lastInsertRowid);
    const deviceAlerts = [];
    for (const l of lines) {
      if (l.pid) await moveStock(l.pid, -l.q, 'vendita', code);
      await db.prepare('INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)').run(saleId, l.pid, l.name, l.q, money(l.price), money(l.cost));
      if (l.serial) deviceAlerts.push(...await deviceHook(l.serial, 'vendita', `Venduto con ${code}`));
    }
    await commitSettlement(plan, { kind: 'sale', refId: saleId, label: `Vendita ${code}` }, addPayment);
    return { ...(await getSale(saleId)), device_alerts: deviceAlerts };
  });
}

export async function getSale(id) {
  const s = await db.prepare('SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?').get(id);
  if (!s) throw new HttpError(404, 'Vendita non trovata');
  return {
    ...s,
    items: await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id),
    // quote di pagamento (anche diviso) e buono usato: servono alla ricevuta
    payments: await db.prepare("SELECT label, amount, method FROM payments WHERE kind='sale' AND ref_id = ? ORDER BY id").all(id),
    vouchers: await db.prepare("SELECT v.code, v.kind, v.balance, u.amount FROM voucher_uses u JOIN vouchers v ON v.id=u.voucher_id WHERE u.kind = 'sale' AND u.ref_id = ?").all(id),
  };
}

// ---------- Vista pubblica per il cliente ----------
const maskPhone = (p) => (p ? p.replace(/\s/g, '').replace(/.(?=.{3})/g, '•') : null);
const maskEmail = (e) => {
  if (!e || !e.includes('@')) return null;
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
};

export async function publicView(token) {
  const r = await db.prepare(`${REPAIR_SELECT} WHERE r.token = ?`).get(token);
  if (!r) throw new HttpError(404, 'Riparazione non trovata');
  const s = await getSettings();
  const events = await db.prepare('SELECT status, note, created_at FROM repair_events WHERE repair_id = ? AND is_public = 1 ORDER BY id DESC').all(r.id);
  const paid = money((await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(r.id)).s);
  const total = r.final_price ?? r.quote;
  const st = STATUSES[r.status];
  const intakeSig = await db.prepare("SELECT signed_at FROM repair_signatures WHERE repair_id = ? AND kind = 'intake' ORDER BY id DESC LIMIT 1").get(r.id);
  // preventivo a distanza: opzioni fra cui scegliere, testi da mostrare e, a risposta data, l'esito firmato
  const options = await db.prepare('SELECT id, label, amount, description FROM quote_options WHERE repair_id = ? ORDER BY sort, id').all(r.id);
  const awaiting = r.status === 'quote_pending' && (r.quote != null || options.length > 0) && r.quote_decision !== 'declined';
  const qsig = await db.prepare("SELECT kind, choice, option_id, signed_at FROM repair_signatures WHERE repair_id = ? AND kind IN ('quote_accept','quote_decline') ORDER BY id DESC LIMIT 1").get(r.id);
  const myOpt = qsig?.option_id ? await db.prepare('SELECT label FROM quote_options WHERE id = ?').get(qsig.option_id) : null;
  return {
    code: r.code,
    status: r.status,
    status_label: st.label,
    status_hint: st.hint,
    step: st.step,
    steps: STEP_LABELS,
    progress: progressPct(r.status),
    cancelled: r.status === 'cancelled',
    device: {
      type: r.device_type,
      model: r.brand_model,
      serial_tail: r.serial ? `••••${r.serial.slice(-4)}` : null,
      problem: r.problem,
      accessories: r.accessories,
      condition: r.condition_notes,
    },
    customer: { name: r.customer_name, phone: maskPhone(r.customer_phone), email: maskEmail(r.customer_email) },
    quote: r.quote,
    final_price: r.final_price,
    deposit: r.deposit,
    paid,
    balance: total == null ? null : Math.max(0, money(total - paid)),
    eta_date: r.eta_date,
    quote_decision: r.quote_decision,
    awaiting_decision: awaiting,
    quote_flow: awaiting ? buildQuoteFlow(s, r, options) : null,
    my_decision: qsig && r.quote_decision ? { action: qsig.kind === 'quote_decline' ? 'decline' : qsig.choice === 'option' ? 'option' : 'accept', choice: qsig.kind === 'quote_decline' ? qsig.choice : null, option_label: myOpt?.label || null, signed_at: qsig.signed_at } : null,
    customer_note: r.customer_note,
    received_at: r.created_at,
    delivered_at: r.delivered_at,
    warranty_days: r.warranty_days,
    events,
    // firma della scheda di ingresso a distanza (solo se il negozio l'ha richiesta e non e' ancora firmata)
    intake_sign: r.sign_requested && !intakeSig && !['delivered', 'cancelled'].includes(r.status)
      ? { text: fillText(s.consent_intake, { negozio: s.shop_name, garanzia: r.warranty_days, codice: r.code, dispositivo: r.brand_model }), terms: s.terms, draft: !isVerified(s) } : null,
    intake_signed_at: intakeSig?.signed_at || null,
    shop: { name: s.shop_name, address: s.shop_address, phone: s.shop_phone },
    updated_at: r.updated_at,
  };
}

// ---------- Dashboard / report / magazzino ----------
export async function dashboard() {
  const counts = Object.fromEntries((await db.prepare('SELECT status, COUNT(*) AS n FROM repairs GROUP BY status').all()).map((r) => [r.status, r.n]));
  const today = localDate();
  const open = await listRepairs({ open: true });
  return {
    counts,
    open_total: open.length,
    ready: open.filter((r) => r.status === 'ready'),
    late: open.filter((r) => r.late),
    to_approve: open.filter((r) => r.status === 'quote_pending'),
    declined: open.filter((r) => r.quote_decision === 'declined'),
    waiting_parts: open.filter((r) => r.status === 'waiting_parts'),
    in_progress: open.filter((r) => ['received', 'diagnosing', 'approved', 'repairing'].includes(r.status)),
    low_stock: await lowStock(),
    cash_today: money((await db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE date(created_at)=?`).get(today)).s),
    today,
  };
}

export async function lowStock() {
  return await db.prepare(`SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email
    FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.active = 1 AND p.min_qty > 0 AND p.qty <= p.min_qty ORDER BY s.name, p.name`).all();
}

export async function report(from, to) {
  const f = from || localDate();
  const t = to || f;
  const byMethod = await db.prepare(`SELECT method, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY method`).all(f, t);
  const byKind = await db.prepare(`SELECT kind, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY kind`).all(f, t);
  const rows = await db.prepare(`SELECT * FROM payments WHERE date(created_at) BETWEEN ? AND ? ORDER BY id DESC`).all(f, t);
  const cost = (await db.prepare(`SELECT COALESCE(SUM(si.qty*si.unit_cost),0) AS c FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.created_at) BETWEEN ? AND ?`).get(f, t)).c
    + (await db.prepare(`SELECT COALESCE(SUM(rp.qty*rp.unit_cost),0) AS c FROM repair_parts rp JOIN repairs r ON r.id=rp.repair_id WHERE r.delivered_at IS NOT NULL AND date(r.delivered_at) BETWEEN ? AND ?`).get(f, t)).c;
  const total = money(rows.reduce((a, r) => a + r.amount, 0));
  return { from: f, to: t, total, parts_cost: money(cost), by_method: byMethod, by_kind: byKind, rows, vouchers: await voucherUsage(f, t) };
}

export async function reportByDay(from, to) {
  return await db.prepare(`SELECT date(created_at) AS day, ROUND(SUM(amount),2) AS total FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day`).all(from, to);
}

export async function stockSummary() {
  const s = await db.prepare(`SELECT COUNT(*) AS items, COALESCE(SUM(qty),0) AS units,
    COALESCE(SUM(MAX(qty,0)*cost),0) AS value_cost, COALESCE(SUM(MAX(qty,0)*price),0) AS value_price
    FROM products WHERE active = 1`).get();
  return { ...s, value_cost: money(s.value_cost), value_price: money(s.value_price), low: (await lowStock()).length };
}

// ---------- Ricerca per il cliente (numero ricevuta + ultime 4 cifre del telefono) ----------
const lookupFails = { n: 0, t: Date.now() };
export async function lookup(code, phone4) {
  if (Date.now() - lookupFails.t > 600000) { lookupFails.n = 0; lookupFails.t = Date.now(); }
  if (lookupFails.n >= 30) throw new HttpError(429, 'Troppi tentativi: riprova tra qualche minuto o chiamaci.');
  const fail = () => {
    lookupFails.n++;
    return new HttpError(404, 'Non troviamo questa riparazione. Controlla il numero sulla ricevuta e le ultime 4 cifre del telefono, oppure chiamaci.');
  };
  const raw = String(code || '').trim().toUpperCase();
  const last4 = String(phone4 || '').replace(/\D/g, '').slice(-4);
  if (!raw || last4.length !== 4) throw fail();
  // accetta "R-2026-0001", "2026-0001" oppure solo "0001" (anno corrente)
  const digits = raw.replace(/[^0-9-]/g, '');
  let full = raw;
  if (/^\d{4}-\d{1,4}$/.test(digits)) full = `R-${digits.split('-')[0]}-${digits.split('-')[1].padStart(4, '0')}`;
  else if (/^\d{1,4}$/.test(digits)) full = `R-${nowLocal().slice(0, 4)}-${digits.padStart(4, '0')}`;
  const r = await db.prepare(`${REPAIR_SELECT} WHERE r.code = ?`).get(full);
  if (!r || !r.customer_phone || String(r.customer_phone).replace(/\D/g, '').slice(-4) !== last4) throw fail();
  return { token: r.token };
}

// ---------- Analisi (riparazioni, incassi, vendite) ----------
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) + 1;

export async function analytics(from, to) {
  const f = from || addDays(localDate(), -29);
  const t = to || localDate();
  if (f > t) throw new HttpError(400, 'Il periodo non è valido');
  const len = daysBetween(f, t);
  const pf = addDays(f, -len);
  const pt = addDays(f, -1);
  const sum = async (a, b) => money((await db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE date(created_at) BETWEEN ? AND ?`).get(a, b)).s);

  // Riparazioni entrate nel periodo
  const byStatus = await db.prepare('SELECT status, COUNT(*) AS n FROM repairs WHERE date(created_at) BETWEEN ? AND ? GROUP BY status ORDER BY n DESC').all(f, t);
  const intake = await db.prepare('SELECT COUNT(*) AS n FROM repairs WHERE date(created_at) BETWEEN ? AND ?').get(f, t);
  const avg = await db.prepare("SELECT AVG(julianday(delivered_at) - julianday(created_at)) AS d, COUNT(*) AS n FROM repairs WHERE delivered_at IS NOT NULL AND date(delivered_at) BETWEEN ? AND ?").get(f, t);
  const models = await db.prepare('SELECT brand_model AS name, COUNT(*) AS n FROM repairs WHERE date(created_at) BETWEEN ? AND ? GROUP BY LOWER(brand_model) ORDER BY n DESC, name LIMIT 10').all(f, t);
  const types = await db.prepare('SELECT device_type AS name, COUNT(*) AS n FROM repairs WHERE date(created_at) BETWEEN ? AND ? GROUP BY device_type ORDER BY n DESC').all(f, t);
  const declined = await db.prepare("SELECT COUNT(*) AS n FROM repairs WHERE quote_decision = 'declined' AND date(created_at) BETWEEN ? AND ?").get(f, t);
  const lateNow = (await listRepairs({ open: true })).filter((r) => r.late).length;

  // Incassi
  const total = await sum(f, t);
  const prevTotal = await sum(pf, pt);
  const byDay = await reportByDay(f, t);
  const byMethod = await db.prepare(`SELECT method, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY method ORDER BY total DESC`).all(f, t);
  const rep = await report(f, t);

  // Vendite
  const sales = await db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS s FROM sales WHERE date(created_at) BETWEEN ? AND ?').get(f, t);
  const sold = await db.prepare(`SELECT si.name AS name, SUM(si.qty) AS qty, ROUND(SUM(si.qty*si.unit_price),2) AS revenue
    FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE date(s.created_at) BETWEEN ? AND ? GROUP BY LOWER(si.name) ORDER BY qty DESC, revenue DESC`).all(f, t);
  const used = await db.prepare(`SELECT rp.name AS name, SUM(rp.qty) AS qty FROM repair_parts rp JOIN repairs r ON r.id = rp.repair_id
    WHERE date(r.created_at) BETWEEN ? AND ? GROUP BY LOWER(rp.name) ORDER BY qty DESC`).all(f, t);

  return {
    from: f, to: t, days: len, prev: { from: pf, to: pt, total: prevTotal },
    repairs: { intake: intake.n, by_status: byStatus, avg_days: avg.n ? Math.round(avg.d * 10) / 10 : null, delivered: avg.n, models, types, declined: declined.n, late_now: lateNow },
    income: { total, prev_total: prevTotal, change_pct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null, by_day: byDay, by_method: byMethod, parts_cost: rep.parts_cost, margin: money(total - rep.parts_cost), avg_per_day: money(total / len) },
    sales: { count: sales.n, revenue: money(sales.s), avg_ticket: sales.n ? money(sales.s / sales.n) : 0, top: sold.slice(0, 10), bottom: sold.length > 10 ? sold.slice(-5).reverse() : [], parts_used: used.slice(0, 10) },
  };
}

// ---------- Avvisi (campanella e home) ----------
// Soglie da Impostazioni: low_stock_default (scorta minima generale per i prodotti senza soglia propria, 0 = spenta),
// stale_days (giorni senza uscite prima di segnalare un prodotto fermo, 0 = spenta), ready_days (pronte non ritirate).
export async function alerts() {
  const s = await getSettings();
  const globalMin = Math.max(0, Number(s.low_stock_default) || 0);
  const staleDays = Math.max(0, Number(s.stale_days) || 0);
  const readyDays = Math.max(0, Number(s.ready_days) || 0);
  const today = localDate();
  const ago = (ymd) => (ymd ? daysBetween(String(ymd).slice(0, 10), today) - 1 : null);
  const out = [];

  const prods = await db.prepare(`SELECT p.*, s.name AS supplier_name,
    (SELECT MAX(d) FROM (
       SELECT MAX(m.created_at) AS d FROM stock_moves m WHERE m.product_id = p.id AND m.delta < 0
       UNION ALL SELECT MAX(sa.created_at) FROM sale_items si JOIN sales sa ON sa.id = si.sale_id WHERE si.product_id = p.id
       UNION ALL SELECT MAX(r.created_at) FROM repair_parts rp JOIN repairs r ON r.id = rp.repair_id WHERE rp.product_id = p.id)) AS last_out
    FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.active = 1`).all();
  for (const p of prods) {
    const min = p.min_qty > 0 ? p.min_qty : globalMin;
    const where = p.supplier_name ? ` (fornitore: ${p.supplier_name})` : '';
    if (p.qty <= 0) out.push({ type: 'out_of_stock', severity: 'high', title: `${p.name}: esaurito`, detail: `Da riordinare${where}.`, link: '#/magazzino?tab=reorder', ref: p.id });
    else if (min > 0 && p.qty <= min) out.push({ type: 'low_stock', severity: 'medium', title: `${p.name}: sta per esaurirsi`, detail: `Restano ${p.qty} pezzi (soglia ${min}). Da riordinare${where}.`, link: '#/magazzino?tab=reorder', ref: p.id });
    else if (staleDays && p.qty > 0) {
      const since = ago(p.last_out || p.created_at);
      if (since != null && since >= staleDays) out.push({ type: 'stale', severity: 'low', title: `${p.name}: fermo da ${since} giorni`, detail: `Giacenza ${p.qty} pezzi, nessuna vendita o uso da ${since} giorni. Valuta un’offerta o controlla il prezzo di vendita (${money(p.price).toFixed(2)} €).`, link: '#/magazzino', ref: p.id });
    }
  }
  const open = await listRepairs({ open: true });
  for (const r of open) {
    if (r.late) out.push({ type: 'late', severity: 'high', title: `${r.brand_model}: in ritardo`, detail: `${r.customer_name} · ${r.code} · data stimata ${r.eta_date}.`, link: `#/riparazioni?status=${r.status}`, ref: r.id });
    if (r.quote_decision === 'declined') out.push({ type: 'declined', severity: 'medium', title: `${r.brand_model}: preventivo rifiutato`, detail: `${r.customer_name} ha rifiutato il preventivo: contattalo.`, link: '#/riparazioni?status=quote_pending', ref: r.id });
    if (readyDays && r.status === 'ready') {
      const since = ago(r.updated_at);
      if (since != null && since >= readyDays) out.push({ type: 'ready_waiting', severity: 'low', title: `${r.brand_model}: pronta da ${since} giorni`, detail: `${r.customer_name} non l’ha ancora ritirata: ricordaglielo.`, link: '#/riparazioni?status=ready', ref: r.id });
    }
  }
  try { out.push(...(await priceAlerts())); } catch { /* acquisti non ancora migrati: nessun avviso di prezzo */ }
  const rank = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { count: out.length, high: out.filter((x) => x.severity === 'high').length, items: out };
}
