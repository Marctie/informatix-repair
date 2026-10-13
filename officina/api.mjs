// Route HTTP del gestionale officina.
//  - adminRouter: tutto il gestionale (si monta SOLO su 127.0.0.1, nessun login per ora)
//  - publicRouter: solo il tracciamento per il cliente (può essere esposto in rete/online)
import express from 'express';
import QRCode from 'qrcode';
import { db, getSettings, tx } from './db.mjs';
import * as L from './logic.mjs';
import { printRepair, printLabel, printSale } from './print.mjs';

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    res.status(status).json({ ok: false, error: status === 500 ? 'Errore interno' : e.message });
  }
};
const str = (v) => (v == null ? null : String(v).trim() || null);

export function trackUrl(token, req) {
  const base = getSettings().public_base_url || process.env.PUBLIC_BASE_URL || `http://${req?.hostname || 'localhost'}:${process.env.PUBLIC_PORT || 4951}`;
  return `${base.replace(/\/$/, '')}/t/${token}`;
}

// ---------- Pubblico ----------
export const publicRouter = express.Router();
publicRouter.use(express.json({ limit: '100kb' }));
publicRouter.get('/api/track/:token', wrap((req) => L.publicView(req.params.token)));
publicRouter.post('/api/track/:token/decision', wrap((req) => L.customerDecision(req.params.token, !!req.body?.accept)));

// ---------- Admin ----------
export const adminRouter = express.Router();
adminRouter.use(express.json({ limit: '1mb' }));
const A = adminRouter;

A.get('/api/meta', wrap(() => ({ statuses: L.STATUSES, step_labels: L.STEP_LABELS, settings: getSettings() })));
A.get('/api/dashboard', wrap(() => L.dashboard()));
A.get('/api/settings', wrap(() => getSettings()));
A.put('/api/settings', wrap((req) => {
  const allowed = ['shop_name', 'shop_address', 'shop_phone', 'public_base_url', 'default_warranty_days', 'terms'];
  for (const k of allowed) if (k in req.body) db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(req.body[k] ?? ''));
  return getSettings();
}));

// QR (SVG) di un testo qualunque
A.get('/api/qr', async (req, res) => {
  try {
    const svg = await QRCode.toString(String(req.query.text || ''), { type: 'svg', margin: 1 });
    res.type('image/svg+xml').send(svg);
  } catch (e) {
    res.status(400).end();
  }
});

// Clienti
A.get('/api/customers', wrap((req) => {
  const q = str(req.query.q);
  const base = `SELECT c.*, (SELECT COUNT(*) FROM repairs r WHERE r.customer_id=c.id) AS repairs_count,
    (SELECT COUNT(*) FROM repairs r WHERE r.customer_id=c.id AND r.status NOT IN ('delivered','cancelled')) AS open_repairs FROM customers c`;
  if (!q) return db.prepare(`${base} ORDER BY c.created_at DESC LIMIT 300`).all();
  const like = `%${q}%`;
  return db.prepare(`${base} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? ORDER BY c.name LIMIT 100`).all(like, like, like);
}));
A.get('/api/customers/:id', wrap((req) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) throw new L.HttpError(404, 'Cliente non trovato');
  return { ...c, repairs: L.listRepairs({ customer_id: c.id }), sales: db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC').all(c.id) };
}));
A.post('/api/customers', wrap((req) => {
  const id = L.upsertCustomer({ name: req.body.name, phone: req.body.phone, email: req.body.email, notes: req.body.notes });
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}));
A.put('/api/customers/:id', wrap((req) => {
  const b = req.body;
  if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
  const r = db.prepare('UPDATE customers SET name=?, phone=?, email=?, notes=? WHERE id=?').run(str(b.name), str(b.phone), str(b.email), str(b.notes), req.params.id);
  if (!r.changes) throw new L.HttpError(404, 'Cliente non trovato');
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
}));
A.delete('/api/customers/:id', wrap((req) => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM repairs WHERE customer_id = ?').get(req.params.id).n;
  if (n) throw new L.HttpError(409, 'Il cliente ha delle riparazioni: non si può eliminare.');
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

// Fornitori
A.get('/api/suppliers', wrap(() => db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id=s.id AND p.active=1) AS products_count FROM suppliers s ORDER BY s.name`).all()));
A.post('/api/suppliers', wrap((req) => {
  const b = req.body;
  if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
  const r = db.prepare('INSERT INTO suppliers (name, phone, email, website, notes) VALUES (?,?,?,?,?)').run(str(b.name), str(b.phone), str(b.email), str(b.website), str(b.notes));
  return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid);
}));
A.put('/api/suppliers/:id', wrap((req) => {
  const b = req.body;
  if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
  const r = db.prepare('UPDATE suppliers SET name=?, phone=?, email=?, website=?, notes=? WHERE id=?').run(str(b.name), str(b.phone), str(b.email), str(b.website), str(b.notes), req.params.id);
  if (!r.changes) throw new L.HttpError(404, 'Fornitore non trovato');
  return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
}));
A.delete('/api/suppliers/:id', wrap((req) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

// Magazzino
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
A.get('/api/products', wrap((req) => {
  const q = str(req.query.q);
  const where = ['p.active = 1'];
  const args = [];
  if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.low) where.push('p.min_qty > 0 AND p.qty <= p.min_qty');
  return db.prepare(`SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE ${where.join(' AND ')} ORDER BY p.name LIMIT 500`).all(...args);
}));
A.get('/api/reorder', wrap(() => L.lowStock()));
A.post('/api/products', wrap((req) => {
  const b = req.body;
  if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
  const qty = Math.round(num(b.qty));
  const id = tx(() => {
    const r = db.prepare('INSERT INTO products (sku, name, category, qty, min_qty, cost, price, supplier_id, location, notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(str(b.sku), str(b.name), str(b.category), 0, Math.round(num(b.min_qty)), num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes));
    const pid = Number(r.lastInsertRowid);
    if (qty) L.moveStock(pid, qty, 'carico iniziale', null);
    return pid;
  });
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}));
A.put('/api/products/:id', wrap((req) => {
  const b = req.body;
  if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
  const r = db.prepare('UPDATE products SET sku=?, name=?, category=?, min_qty=?, cost=?, price=?, supplier_id=?, location=?, notes=? WHERE id=?')
    .run(str(b.sku), str(b.name), str(b.category), Math.round(num(b.min_qty)), num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes), req.params.id);
  if (!r.changes) throw new L.HttpError(404, 'Prodotto non trovato');
  return db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
}));
A.delete('/api/products/:id', wrap((req) => {
  // archiviazione: lo storico di vendite/riparazioni resta coerente
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  return { ok: true };
}));
A.post('/api/products/:id/move', wrap((req) => {
  const delta = Math.round(num(req.body.delta));
  if (!delta) throw new L.HttpError(400, 'Quantità non valida');
  tx(() => L.moveStock(Number(req.params.id), delta, str(req.body.reason) || (delta > 0 ? 'carico' : 'scarico'), str(req.body.ref)));
  return db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
}));
A.get('/api/products/:id/moves', wrap((req) => db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100').all(req.params.id)));

// Riparazioni
A.get('/api/repairs', wrap((req) => L.listRepairs({ status: str(req.query.status), q: str(req.query.q), open: req.query.open === '1', customer_id: req.query.customer_id })));
A.post('/api/repairs', wrap((req) => {
  const r = L.createRepair(req.body);
  return { ...r, track_url: trackUrl(r.token, req) };
}));
A.get('/api/repairs/:id', wrap((req) => {
  const r = L.getRepair(req.params.id);
  return { ...r, track_url: trackUrl(r.token, req) };
}));
A.patch('/api/repairs/:id', wrap((req) => L.updateRepair(req.params.id, req.body)));
A.post('/api/repairs/:id/status', wrap((req) => L.setStatus(req.params.id, req.body.status, str(req.body.note), req.body.public !== false)));
A.post('/api/repairs/:id/advance', wrap((req) => {
  const r = L.getRepair(req.params.id);
  if (!r.next_status) throw new L.HttpError(400, 'Nessun passaggio successivo.');
  return r.next_status === 'delivered' ? L.deliverRepair(r.id, req.body || {}) : L.setStatus(r.id, r.next_status);
}));
A.post('/api/repairs/:id/deliver', wrap((req) => L.deliverRepair(req.params.id, req.body || {})));
A.post('/api/repairs/:id/note', wrap((req) => L.addNote(req.params.id, req.body.note, req.body.public !== false)));
A.post('/api/repairs/:id/parts', wrap((req) => L.addPart(req.params.id, req.body)));
A.delete('/api/repairs/:id/parts/:partId', wrap((req) => L.removePart(req.params.id, req.params.partId)));
A.post('/api/repairs/:id/deposit', wrap((req) => {
  const amount = num(req.body.amount);
  if (!(amount > 0)) throw new L.HttpError(400, 'Importo non valido');
  tx(() => {
    const r = db.prepare('SELECT code FROM repairs WHERE id = ?').get(req.params.id);
    if (!r) throw new L.HttpError(404, 'Riparazione non trovata');
    db.prepare('INSERT INTO payments (kind, ref_id, label, amount, method) VALUES (?,?,?,?,?)').run('repair', req.params.id, `Acconto ${r.code}`, L.money(amount), str(req.body.method) || 'contanti');
    db.prepare('UPDATE repairs SET deposit = deposit + ? WHERE id = ?').run(L.money(amount), req.params.id);
    L.logEvent(Number(req.params.id), null, `Acconto ricevuto: ${amount.toFixed(2)} €.`, 1);
  });
  return L.getRepair(req.params.id);
}));

// Vendite e cassa
A.get('/api/sales', wrap(() => db.prepare('SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 200').all()));
A.post('/api/sales', wrap((req) => L.createSale(req.body)));
A.get('/api/sales/:id', wrap((req) => L.getSale(req.params.id)));
A.get('/api/report', wrap((req) => L.report(str(req.query.from), str(req.query.to))));

// Stampe (HTML pronto per la stampante)
A.get('/print/repair/:id', (req, res) => {
  try {
    const r = L.getRepair(req.params.id);
    res.type('html').send(printRepair(r, trackUrl(r.token, req), getSettings()));
  } catch (e) { res.status(e.status || 500).send(e.message); }
});
A.get('/print/label/:id', (req, res) => {
  try {
    const r = L.getRepair(req.params.id);
    res.type('html').send(printLabel(r, trackUrl(r.token, req)));
  } catch (e) { res.status(e.status || 500).send(e.message); }
});
A.get('/print/sale/:id', (req, res) => {
  try {
    res.type('html').send(printSale(L.getSale(req.params.id), getSettings()));
  } catch (e) { res.status(e.status || 500).send(e.message); }
});
