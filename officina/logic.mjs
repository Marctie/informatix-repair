// Logica di dominio del gestionale officina (stati, progressi, codici, viste pubbliche).
import { db, getSettings, tx, nowLocal } from './dbref.mjs';

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

async function addPayment(kind, refId, label, amount, method) {
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
    if (deposit > 0) await addPayment('repair', id, `Acconto ${code}`, deposit, b.deposit_method);
    if (b.quote_agreed && quote != null) {
      await db.prepare("UPDATE repairs SET status='approved', quote_decided_at=datetime('now','localtime') WHERE id=?").run(id);
      await logEvent(id, 'approved', 'Preventivo concordato al banco.');
    }
    return await getRepair(id);
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
    status_label: st.label,
    progress: progressPct(r.status),
    next_status: NEXT_STATUS[r.status] || null,
    next_label: NEXT_STATUS[r.status] ? STATUSES[NEXT_STATUS[r.status]].label : null,
    late: !!(r.eta_date && !['ready', 'delivered', 'cancelled'].includes(r.status) && r.eta_date < localDate()),
  };
  if (full) {
    out.events = await db.prepare('SELECT * FROM repair_events WHERE repair_id = ? ORDER BY id DESC').all(r.id);
    out.parts = await db.prepare('SELECT * FROM repair_parts WHERE repair_id = ? ORDER BY id').all(r.id);
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
    if (status === 'quote_pending' && r.quote == null) throw new HttpError(400, 'Inserisci prima il preventivo.');
    await db.prepare("UPDATE repairs SET status = ?, quote_decision = CASE WHEN ?='quote_pending' THEN NULL ELSE quote_decision END WHERE id = ?").run(status, status, id);
    if (status === 'approved' && !r.quote_decision) {
      await db.prepare("UPDATE repairs SET quote_decision='accepted', quote_decided_at=datetime('now','localtime') WHERE id=?").run(id);
    }
    await logEvent(id, status, note || STATUSES[status].hint, isPublic);
    return await getRepair(id);
  });
}

export async function deliverRepair(id, { final_price, method, note } = {}) {
  return tx(async () => {
    const r = await db.prepare('SELECT * FROM repairs WHERE id = ?').get(id);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    if (r.status === 'delivered') throw new HttpError(400, 'Già consegnata.');
    const final = money(num(final_price, r.final_price ?? r.quote ?? 0));
    const paid = (await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(id)).s;
    const due = Math.max(0, money(final - paid));
    await addPayment('repair', id, `Saldo ${r.code}`, due, method);
    await db.prepare("UPDATE repairs SET status='delivered', final_price=?, delivered_at=datetime('now','localtime') WHERE id=?").run(final, id);
    await logEvent(id, 'delivered', note || STATUSES.delivered.hint);
    return { ...(await getRepair(id)), collected: due };
  });
}

export async function addPart(repairId, { product_id, name, qty, unit_price }) {
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
    await db.prepare('INSERT INTO repair_parts (repair_id, product_id, name, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)').run(repairId, pid, pName, q, money(price), money(cost));
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
    const code = await nextCode('sales', 'V');
    const sale = await db.prepare("INSERT INTO sales (code, customer_id, total, discount, method, notes, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))").run(
      code, b.customer_id || null, 0, money(num(b.discount, 0)), str(b.method) || 'contanti', str(b.notes)
    );
    const saleId = Number(sale.lastInsertRowid);
    let total = 0;
    for (const it of items) {
      const q = Math.max(1, Math.round(num(it.qty, 1)));
      let name = str(it.name), price = num(it.unit_price), cost = 0, pid = null;
      if (it.product_id) {
        const p = await db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
        if (!p) throw new HttpError(404, 'Prodotto non trovato');
        pid = p.id; name = name || p.name; cost = p.cost;
        if (price == null) price = p.price;
        await moveStock(p.id, -q, 'vendita', code);
      }
      if (!name) throw new HttpError(400, 'Nome articolo obbligatorio');
      if (price == null || price < 0) throw new HttpError(400, `Prezzo mancante per ${name}`);
      await db.prepare('INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)').run(saleId, pid, name, q, money(price), money(cost));
      total += q * price;
    }
    total = money(total - num(b.discount, 0));
    if (total < 0) throw new HttpError(400, 'Lo sconto supera il totale');
    await db.prepare('UPDATE sales SET total = ? WHERE id = ?').run(total, saleId);
    await addPayment('sale', saleId, `Vendita ${code}`, total, b.method);
    return await getSale(saleId);
  });
}

export async function getSale(id) {
  const s = await db.prepare('SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?').get(id);
  if (!s) throw new HttpError(404, 'Vendita non trovata');
  return { ...s, items: await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) };
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
    awaiting_decision: r.status === 'quote_pending' && r.quote != null,
    customer_note: r.customer_note,
    received_at: r.created_at,
    delivered_at: r.delivered_at,
    warranty_days: r.warranty_days,
    events,
    shop: { name: s.shop_name, address: s.shop_address, phone: s.shop_phone },
    updated_at: r.updated_at,
  };
}

export async function customerDecision(token, accept) {
  return tx(async () => {
    const r = await db.prepare('SELECT * FROM repairs WHERE token = ?').get(token);
    if (!r) throw new HttpError(404, 'Riparazione non trovata');
    if (r.status !== 'quote_pending') throw new HttpError(409, 'Nessun preventivo in attesa di risposta.');
    if (accept) {
      await db.prepare("UPDATE repairs SET status='approved', quote_decision='accepted', quote_decided_at=datetime('now','localtime') WHERE id=?").run(r.id);
      await logEvent(r.id, 'approved', 'Preventivo approvato dal cliente online.');
    } else {
      await db.prepare("UPDATE repairs SET quote_decision='declined', quote_decided_at=datetime('now','localtime') WHERE id=?").run(r.id);
      await logEvent(r.id, 'quote_pending', 'Il cliente ha rifiutato il preventivo: contattalo.');
    }
    return await publicView(token);
  });
}

// ---------- Dashboard / report / magazzino ----------
export const UNTRACKED = 'non tracciato';
/** Condizione SQL per la cassa: se l'impostazione "cash_show_untracked" e' spenta, i pagamenti "non tracciato" restano salvati ma non entrano nei totali di cassa. */
async function cashFilter() {
  const s = await getSettings();
  return s.cash_show_untracked === '0' ? ` AND method <> '${UNTRACKED}'` : '';
}
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
    cash_today: money((await db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE date(created_at)=?${await cashFilter()}`).get(today)).s),
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
  const cf = await cashFilter();
  const byMethod = await db.prepare(`SELECT method, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ?${cf} GROUP BY method`).all(f, t);
  const byKind = await db.prepare(`SELECT kind, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ?${cf} GROUP BY kind`).all(f, t);
  const rows = await db.prepare(`SELECT * FROM payments WHERE date(created_at) BETWEEN ? AND ?${cf} ORDER BY id DESC`).all(f, t);
  const hidden = cf ? await db.prepare(`SELECT COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ? AND method = '${UNTRACKED}'`).get(f, t) : { n: 0 };
  const cost = (await db.prepare(`SELECT COALESCE(SUM(si.qty*si.unit_cost),0) AS c FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.created_at) BETWEEN ? AND ?`).get(f, t)).c
    + (await db.prepare(`SELECT COALESCE(SUM(rp.qty*rp.unit_cost),0) AS c FROM repair_parts rp JOIN repairs r ON r.id=rp.repair_id WHERE r.delivered_at IS NOT NULL AND date(r.delivered_at) BETWEEN ? AND ?`).get(f, t)).c;
  const total = money(rows.reduce((a, r) => a + r.amount, 0));
  return { from: f, to: t, total, parts_cost: money(cost), by_method: byMethod, by_kind: byKind, rows, untracked_excluded: hidden.n };
}

export async function reportByDay(from, to) {
  return await db.prepare(`SELECT date(created_at) AS day, ROUND(SUM(amount),2) AS total FROM payments WHERE date(created_at) BETWEEN ? AND ?${await cashFilter()} GROUP BY day ORDER BY day`).all(from, to);
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
