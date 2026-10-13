// Applicazione HTTP (Hono) del gestionale officina: gira identica su Node (PC) e su Cloudflare Workers.
//  - createAdminApp: tutto il gestionale (protetto da Cloudflare Access o solo localhost)
//  - createPublicApp: solo il tracciamento per il cliente
import { Hono } from 'hono';
import { renderSVG } from 'uqr';
import { db, getSettings, tx, nowLocal } from './dbref.mjs';
import * as L from './logic.mjs';
import { barcodeSvg } from './barcode.mjs';
import { printCustomer, printLab, printBoth, printLabel, printSale } from './print.mjs';

const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const NOW = "datetime('now','localtime')";

/** Adatta una funzione "req => dati" a una route Hono con gestione errori uniforme. */
const h = (fn) => async (c) => {
  try {
    const m = c.req.method;
    const body = m === 'GET' || m === 'DELETE' ? {} : await c.req.json().catch(() => ({}));
    return c.json(await fn({ params: c.req.param(), query: c.req.query(), body: body || {}, user: c.get('user') }));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    return c.json({ ok: false, error: status === 500 ? 'Errore interno' : e.message }, status);
  }
};
/** Come h, ma per risposte non JSON (pagine di stampa). */
const page = (fn) => async (c) => {
  try { return await fn(c); } catch (e) { return c.text(e.message || 'Errore', e.status || 500); }
};

export const qrSvg = (t) => renderSVG(String(t || ''), { border: 1 });

// ---------- Pubblico ----------
export function createPublicApp() {
  const app = new Hono();
  app.get('/api/track/:token', h((req) => L.publicView(req.params.token)));
  app.post('/api/track/:token/decision', h((req) => L.customerDecision(req.params.token, !!req.body?.accept)));
  // Ricerca "per anziani": numero ricevuta + ultime 4 cifre del telefono -> codice di tracciamento
  app.post('/api/lookup', h((req) => L.lookup(req.body?.code, req.body?.phone4)));
  return app;
}

// ---------- Admin ----------
export function createAdminApp({ trackBaseFallback, backup, auth } = {}) {
  const app = new Hono();
  if (auth) app.use('*', auth);

  const trackBase = async () => {
    const s = await getSettings();
    return String(s.public_base_url || (await trackBaseFallback?.()) || '').replace(/\/$/, '');
  };
  const trackUrl = async (token) => `${await trackBase()}/t/${token}`;
  const adminOnly = (req) => {
    if (req.user && req.user.role !== 'admin') throw new L.HttpError(403, 'Solo l’amministratore può farlo.');
  };

  app.get('/api/me', h((req) => ({ user: req.user || { email: 'locale', name: 'Locale', role: 'admin' } })));
  app.get('/api/meta', h(async () => ({ statuses: L.STATUSES, step_labels: L.STEP_LABELS, settings: await getSettings(), track_base: await trackBase() })));
  app.get('/api/dashboard', h(() => L.dashboard()));
  app.get('/api/settings', h(() => getSettings()));
  app.put('/api/settings', h(async (req) => {
    adminOnly(req);
    const allowed = ['shop_name', 'shop_address', 'shop_phone', 'public_base_url', 'default_warranty_days', 'terms'];
    for (const k of allowed) {
      if (k in req.body) await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(req.body[k] ?? ''));
    }
    return getSettings();
  }));

  // Utenti (solo amministratore)
  app.get('/api/users', h(async (req) => {
    adminOnly(req);
    return db.prepare('SELECT * FROM users ORDER BY protected DESC, name, email').all();
  }));
  app.post('/api/users', h(async (req) => {
    adminOnly(req);
    const email = str(req.body.email)?.toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new L.HttpError(400, 'Email non valida');
    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new L.HttpError(409, 'Utente già presente');
    const role = req.body.role === 'admin' ? 'admin' : 'staff';
    const r = await db.prepare(`INSERT INTO users (email, name, role, created_at) VALUES (?,?,?,${NOW})`).run(email, str(req.body.name), role);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  }));
  app.put('/api/users/:id', h(async (req) => {
    adminOnly(req);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new L.HttpError(404, 'Utente non trovato');
    if (u.protected) throw new L.HttpError(409, 'Il proprietario è protetto: non si modifica.');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    await db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run(str(req.body.name) ?? u.name, req.body.role === 'admin' ? 'admin' : 'staff', active, u.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  }));
  app.delete('/api/users/:id', h(async (req) => {
    adminOnly(req);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new L.HttpError(404, 'Utente non trovato');
    if (u.protected) throw new L.HttpError(409, 'Il proprietario è protetto: non si elimina.');
    await db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    return { ok: true };
  }));

  // QR e codice a barre (SVG)
  app.get('/api/qr', (c) => {
    const t = c.req.query('text');
    if (!t) return c.body(null, 400);
    return c.body(qrSvg(t), 200, { 'content-type': 'image/svg+xml' });
  });
  app.get('/api/barcode', (c) => {
    const t = String(c.req.query('text') || '').slice(0, 60);
    if (!t) return c.body(null, 400);
    return c.body(barcodeSvg(t), 200, { 'content-type': 'image/svg+xml' });
  });

  // Clienti
  app.get('/api/customers', h(async (req) => {
    const q = str(req.query.q);
    const base = `SELECT c.*, (SELECT COUNT(*) FROM repairs r WHERE r.customer_id=c.id) AS repairs_count,
      (SELECT COUNT(*) FROM repairs r WHERE r.customer_id=c.id AND r.status NOT IN ('delivered','cancelled')) AS open_repairs FROM customers c`;
    if (!q) return db.prepare(`${base} ORDER BY c.created_at DESC LIMIT 300`).all();
    const like = `%${q}%`;
    return db.prepare(`${base} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? ORDER BY c.name LIMIT 100`).all(like, like, like);
  }));
  app.get('/api/customers/:id', h(async (req) => {
    const c = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!c) throw new L.HttpError(404, 'Cliente non trovato');
    return { ...c, repairs: await L.listRepairs({ customer_id: c.id }), sales: await db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC').all(c.id) };
  }));
  app.post('/api/customers', h(async (req) => {
    const id = await L.upsertCustomer({ name: req.body.name, phone: req.body.phone, email: req.body.email, notes: req.body.notes });
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  }));
  app.put('/api/customers/:id', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
    const r = await db.prepare('UPDATE customers SET name=?, phone=?, email=?, notes=? WHERE id=?').run(str(b.name), str(b.phone), str(b.email), str(b.notes), req.params.id);
    if (!r.changes) throw new L.HttpError(404, 'Cliente non trovato');
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  }));
  app.delete('/api/customers/:id', h(async (req) => {
    const n = (await db.prepare('SELECT COUNT(*) AS n FROM repairs WHERE customer_id = ?').get(req.params.id)).n;
    if (n) throw new L.HttpError(409, 'Il cliente ha delle riparazioni: non si può eliminare.');
    await db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Fornitori
  app.get('/api/suppliers', h(() => db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id=s.id AND p.active=1) AS products_count FROM suppliers s ORDER BY s.name`).all()));
  app.post('/api/suppliers', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
    const r = await db.prepare(`INSERT INTO suppliers (name, phone, email, website, notes, created_at) VALUES (?,?,?,?,?,${NOW})`).run(str(b.name), str(b.phone), str(b.email), str(b.website), str(b.notes));
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid);
  }));
  app.put('/api/suppliers/:id', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
    const r = await db.prepare('UPDATE suppliers SET name=?, phone=?, email=?, website=?, notes=? WHERE id=?').run(str(b.name), str(b.phone), str(b.email), str(b.website), str(b.notes), req.params.id);
    if (!r.changes) throw new L.HttpError(404, 'Fornitore non trovato');
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  }));
  app.delete('/api/suppliers/:id', h(async (req) => {
    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Magazzino
  const checkProduct = (b) => {
    for (const k of ['cost', 'price', 'min_qty']) {
      const n = num(b[k]);
      if (!Number.isFinite(n) || n < 0) throw new L.HttpError(400, `Valore non valido: ${k === 'cost' ? 'costo' : k === 'price' ? 'prezzo' : 'scorta minima'}`);
    }
    if (b.qty !== undefined && !Number.isFinite(num(b.qty))) throw new L.HttpError(400, 'Quantità non valida');
  };
  app.get('/api/products', h(async (req) => {
    const q = str(req.query.q);
    const where = ['p.active = 1'];
    const args = [];
    if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (req.query.low) where.push('p.min_qty > 0 AND p.qty <= p.min_qty');
    return db.prepare(`SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE ${where.join(' AND ')} ORDER BY p.name LIMIT 500`).all(...args);
  }));
  app.get('/api/reorder', h(() => L.lowStock()));
  app.post('/api/products', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
    checkProduct(b);
    const qty = Math.round(num(b.qty));
    const id = await tx(async () => {
      const r = await db.prepare(`INSERT INTO products (sku, name, category, qty, min_qty, cost, price, supplier_id, location, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,${NOW})`)
        .run(str(b.sku), str(b.name), str(b.category), 0, Math.round(num(b.min_qty)), num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes));
      const pid = Number(r.lastInsertRowid);
      if (qty) await L.moveStock(pid, qty, 'carico iniziale', null);
      return pid;
    });
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  }));
  app.put('/api/products/:id', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
    checkProduct(b);
    const r = await db.prepare('UPDATE products SET sku=?, name=?, category=?, min_qty=?, cost=?, price=?, supplier_id=?, location=?, notes=? WHERE id=?')
      .run(str(b.sku), str(b.name), str(b.category), Math.round(num(b.min_qty)), num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes), req.params.id);
    if (!r.changes) throw new L.HttpError(404, 'Prodotto non trovato');
    return db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  }));
  app.delete('/api/products/:id', h(async (req) => {
    // archiviazione: lo storico di vendite/riparazioni resta coerente
    await db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));
  app.post('/api/products/:id/move', h(async (req) => {
    const delta = Math.round(num(req.body.delta));
    if (!delta) throw new L.HttpError(400, 'Quantità non valida');
    await tx(() => L.moveStock(Number(req.params.id), delta, str(req.body.reason) || (delta > 0 ? 'carico' : 'scarico'), str(req.body.ref)));
    return db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  }));
  app.get('/api/products/:id/moves', h((req) => db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100').all(req.params.id)));

  // Riparazioni
  app.get('/api/repairs', h((req) => L.listRepairs({ status: str(req.query.status), q: str(req.query.q), open: req.query.open === '1', customer_id: req.query.customer_id })));
  app.post('/api/repairs', h(async (req) => {
    const r = await L.createRepair(req.body);
    return { ...r, track_url: await trackUrl(r.token) };
  }));
  app.get('/api/repairs/:id', h(async (req) => {
    const r = await L.getRepair(req.params.id);
    return { ...r, track_url: await trackUrl(r.token) };
  }));
  app.patch('/api/repairs/:id', h((req) => L.updateRepair(req.params.id, req.body)));
  app.post('/api/repairs/:id/status', h((req) => L.setStatus(req.params.id, req.body.status, str(req.body.note), req.body.public !== false)));
  app.post('/api/repairs/:id/advance', h(async (req) => {
    const r = await L.getRepair(req.params.id);
    if (!r.next_status) throw new L.HttpError(400, 'Nessun passaggio successivo.');
    return r.next_status === 'delivered' ? L.deliverRepair(r.id, req.body || {}) : L.setStatus(r.id, r.next_status);
  }));
  app.post('/api/repairs/:id/deliver', h((req) => L.deliverRepair(req.params.id, req.body || {})));
  app.post('/api/repairs/:id/note', h((req) => L.addNote(req.params.id, req.body.note, req.body.public !== false)));
  app.post('/api/repairs/:id/parts', h((req) => L.addPart(req.params.id, req.body)));
  app.delete('/api/repairs/:id/parts/:partId', h((req) => L.removePart(req.params.id, req.params.partId)));
  app.post('/api/repairs/:id/deposit', h(async (req) => {
    const amount = num(req.body.amount);
    if (!(amount > 0)) throw new L.HttpError(400, 'Importo non valido');
    await tx(async () => {
      const r = await db.prepare('SELECT code FROM repairs WHERE id = ?').get(req.params.id);
      if (!r) throw new L.HttpError(404, 'Riparazione non trovata');
      await db.prepare(`INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,${NOW})`).run('repair', req.params.id, `Acconto ${r.code}`, L.money(amount), str(req.body.method) || 'contanti');
      await db.prepare('UPDATE repairs SET deposit = deposit + ? WHERE id = ?').run(L.money(amount), req.params.id);
      await L.logEvent(Number(req.params.id), null, `Acconto ricevuto: ${amount.toFixed(2)} €.`, 1);
    });
    return L.getRepair(req.params.id);
  }));

  // Vendite e cassa
  app.get('/api/sales', h(() => db.prepare('SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 200').all()));
  app.post('/api/sales', h((req) => L.createSale(req.body)));
  app.get('/api/sales/:id', h((req) => L.getSale(req.params.id)));
  app.get('/api/report', h(async (req) => {
    const r = await L.report(str(req.query.from), str(req.query.to));
    return { ...r, by_day: await L.reportByDay(r.from, r.to) };
  }));
  app.get('/api/stock/summary', h(() => L.stockSummary()));

  // Backup: tutte le tabelle in un file JSON scaricabile (D1 non ha VACUUM INTO). Un motore con un backup suo (SQLite locale) lo passa in `backup`.
  app.get('/api/backup', async (c) => {
    try {
      if (backup) return await backup(c);
      return c.body(JSON.stringify(await dumpAll()), 200, { 'content-type': 'application/json', 'content-disposition': `attachment; filename="officina-backup-${L.localDate()}.json"` });
    } catch (e) {
      console.error(e);
      return c.json({ ok: false, error: 'Backup non riuscito' }, 500);
    }
  });

  // Stampe (HTML pronto per la stampante). ?noprint=1 = niente stampa automatica (anteprima).
  const printRoute = (render) => page(async (c) => {
    const r = await L.getRepair(c.req.param('id'));
    return c.html(render(r, await trackUrl(r.token), await getSettings(), { noprint: c.req.query('noprint') === '1' }));
  });
  app.get('/print/customer/:id', printRoute(printCustomer));
  app.get('/print/repair/:id', printRoute(printCustomer)); // vecchio indirizzo, resta valido
  app.get('/print/lab/:id', printRoute(printLab));
  app.get('/print/both/:id', printRoute(printBoth));
  app.get('/print/label/:id', printRoute((r, url, s, req) => printLabel(r, url, req)));
  app.get('/print/sale/:id', page(async (c) => c.html(printSale(await L.getSale(c.req.param('id')), await getSettings(), { noprint: c.req.query('noprint') === '1' }))));

  return app;
}

const TABLES = ['settings', 'users', 'customers', 'suppliers', 'products', 'stock_moves', 'repairs', 'repair_events', 'repair_parts', 'sales', 'sale_items', 'payments'];
/** Copia di tutte le tabelle (usata dal backup JSON e dal backup giornaliero). */
export async function dumpAll() {
  const dump = { created_at: nowLocal(), tables: {} };
  for (const t of TABLES) dump.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all();
  return dump;
}
