// Applicazione HTTP (Hono) del gestionale officina: gira identica su Node (PC) e su Cloudflare Workers.
//  - createAdminApp: tutto il gestionale (protetto da Cloudflare Access o solo localhost)
//  - createPublicApp: solo il tracciamento per il cliente
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { renderSVG } from 'uqr';
import { db, getSettings, tx, nowLocal } from './dbref.mjs';
import * as L from './logic.mjs';
import { barcodeSvg } from './barcode.mjs';
import { listExpenses, createExpense, updateExpense, deleteExpense, CATEGORIES, DOC_TYPES } from './expenses.mjs';
import { buildNotaSpese } from './notaspese.mjs';
import { notifyMiddleware } from './notify.mjs';
import { registerMonitorRoutes } from './monitor.mjs';
import { registerPurchaseRoutes, PURCHASE_TABLES } from './purchases.mjs';
import { registerOrderRoutes, orderAlerts } from './ordini.mjs';
import { registerQuoteRoutes, quoteAlerts, registerPublicQuoteRoutes } from './preventivi.mjs';
import { registerReminderRoutes, reminderAlertsNotify } from './promemoria.mjs';

import { registerDeviceRoutes, DEVICE_TABLES } from './dispositivi.mjs';
import { registerVoucherRoutes, VOUCHER_TABLES } from './buoni.mjs';
import { registerDocumentRoutes, DOCUMENT_TABLES } from './documenti.mjs';
import { registerCredentialRoutes, CREDENTIAL_TABLES } from './credenziali.mjs';
import { registerLottoB, lottoBAlerts, LOTTO_B_TABLES } from './lottoB.mjs'; // Agente B
import { demoStatus, loadDemo, deleteDemo } from './demo.mjs';
import { mountUsati } from './usati.mjs';
import { draftPublisher } from './publisher.mjs';
import { missingMedia } from './media.mjs';
import { cassaMiddleware, isCassa } from './roles.mjs';
import { auditMiddleware, registerAuditRoutes } from './audit.mjs';

import * as CK from './checklists.mjs';
import { LEGAL_DEFAULTS } from './legal.mjs';
import * as SG from './signatures.mjs';
import * as R from './remote.mjs';
import { printCustomer, printLab, printBoth, printLabel, printSale } from './print.mjs';

const EXTRA_ALERTS = [orderAlerts, quoteAlerts, reminderAlertsNotify];
EXTRA_ALERTS.push(lottoBAlerts); // Agente B: rientri esterni in ritardo, muletti non rientrati
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const NOW = "datetime('now','localtime')";

/** Adatta una funzione "req => dati" a una route Hono con gestione errori uniforme. */
const h = (fn) => async (c) => {
  try {
    const m = c.req.method;
    const body = m === 'GET' || m === 'DELETE' ? {} : await c.req.json().catch(() => ({}));
    return c.json(await fn({ params: c.req.param(), query: c.req.query(), body: body || {}, user: c.get('user'), c }));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) { console.error(e); c.set('err', e); }
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
  app.use('/api/track/*', notifyMiddleware);
  app.use('/api/quote/*', notifyMiddleware);
  // Il sito pubblico (altro dominio) chiama la ricerca per numero ricevuta
  app.use('/api/lookup', cors({ origin: ['https://informatixrepair.com', 'https://www.informatixrepair.com'], allowMethods: ['POST', 'OPTIONS'], allowHeaders: ['content-type'] }));
  app.get('/api/track/:token', h((req) => L.publicView(req.params.token)));
  app.post('/api/track/:token/sign', h((req) => SG.signIntakeRemote(req.params.token, req.body, req.c)));
  app.post('/api/track/:token/decision', h((req) => R.customerDecision(req.params.token, req.body, req.c)));
  // Ricerca "per anziani": numero ricevuta + ultime 4 cifre del telefono -> codice di tracciamento
  app.post('/api/lookup', h((req) => L.lookup(req.body?.code, req.body?.phone4)));
  // Preventivo autonomo: il cliente lo vede e lo firma dal link /p/<codice>
  registerPublicQuoteRoutes(app, h);
  // Bot di controllo sul telefono: riepilogo numerico, solo con la chiave MONITOR_TOKEN (altrimenti 404)
  registerMonitorRoutes(app, { env: (c) => ({ ...(typeof process !== 'undefined' ? process.env : {}), ...(c.env || {}) }) });
  return app;
}

// ---------- Admin ----------
// usati = { publisher:(c)=>publisher, media:(c)=>archivio foto, siteUrl:(c)=>url del sito } per la Vetrina Usati (senza: bozza e nessun archivio foto)
export function createAdminApp({ trackBaseFallback, backup, auth, usati = {} } = {}) {
  const app = new Hono();
  app.use('*', notifyMiddleware); // prima dell'accesso: segnala anche i tentativi negati e gli errori
  if (auth) app.use('*', auth);
  app.use('*', cassaMiddleware); // ruolo cassa: niente costi/margini nelle risposte
  app.use('/api/*', auditMiddleware); // registro eliminazioni/modifiche (dopo l'accesso: sa chi è)

  const trackBase = async () => {
    const s = await getSettings();
    return String(s.public_base_url || (await trackBaseFallback?.()) || '').replace(/\/$/, '');
  };
  const trackUrl = async (token) => `${await trackBase()}/t/${token}`;
  const roleOf = (r) => (['admin', 'cassa'].includes(r) ? r : 'staff');
  const adminOnly = (req) => {
    if (req.user && req.user.role !== 'admin') throw new L.HttpError(403, 'Solo l’amministratore può farlo.');
  };

  registerAuditRoutes(app, h, adminOnly);
  app.get('/api/me', h((req) => ({ user: req.user || { email: 'locale', name: 'Locale', role: 'admin' } })));
  app.get('/api/meta', h(async () => ({ statuses: L.STATUSES, step_labels: L.STEP_LABELS, settings: await getSettings(), track_base: await trackBase(), device_types: CK.DEVICE_TYPES, phases: CK.PHASES })));
  app.get('/api/dashboard', h(async () => ({ ...(await L.dashboard()), storage: await R.storageList().catch(() => []) })));
  app.get('/api/settings', h(() => getSettings()));
  app.put('/api/settings', h(async (req) => {
    adminOnly(req);
    const allowed = ['shop_name', 'shop_address', 'shop_phone', 'public_base_url', 'default_warranty_days', 'terms', 'low_stock_default', 'stale_days', 'ready_days', 'quote_valid_days', ...Object.keys(LEGAL_DEFAULTS)];
    for (const k of allowed) {
      if (k in req.body) await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(req.body[k] ?? ''));
    }
    return getSettings();
  }));

  // Checklist di controllo per tipo di dispositivo (modificabili dal proprietario)
  app.get('/api/checklists', h(() => CK.getChecklists()));
  app.put('/api/checklists/:type', h((req) => { adminOnly(req); return CK.saveTemplate(req.params.type, req.body); }));
  app.delete('/api/checklists/:type', h((req) => { adminOnly(req); return CK.resetTemplate(req.params.type); }));

  // Vetrina Usati (articoli, foto, pubblicazione sul sito)
  mountUsati(app, { h, adminOnly, publisher: usati.publisher || (() => draftPublisher()), media: usati.media || (() => missingMedia()), siteUrl: usati.siteUrl });

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
    const role = roleOf(req.body.role);
    const r = await db.prepare(`INSERT INTO users (email, name, role, created_at) VALUES (?,?,?,${NOW})`).run(email, str(req.body.name), role);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  }));
  app.put('/api/users/:id', h(async (req) => {
    adminOnly(req);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new L.HttpError(404, 'Utente non trovato');
    if (u.protected) throw new L.HttpError(409, 'Il proprietario è protetto: non si modifica.');
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    await db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run(str(req.body.name) ?? u.name, roleOf(req.body.role), active, u.id);
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

  // Spese (uscite) e nota spese in PDF
  app.get('/api/expenses/meta', h(() => ({ categories: CATEGORIES, doc_types: DOC_TYPES })));
  app.get('/api/expenses', h((req) => listExpenses({ from: str(req.query.from), to: str(req.query.to), reimbursable: req.query.reimbursable === '1', paid_by: str(req.query.paid_by) })));
  app.post('/api/expenses', h((req) => createExpense(req.body)));
  app.put('/api/expenses/:id', h((req) => updateExpense(req.params.id, req.body)));
  app.delete('/api/expenses/:id', h((req) => deleteExpense(req.params.id)));
  app.get('/api/expenses-pdf', async (c) => {
    try {
      const data = await listExpenses({ from: str(c.req.query('from')), to: str(c.req.query('to')), reimbursable: c.req.query('reimbursable') === '1', paid_by: str(c.req.query('paid_by')) });
      const bytes = await buildNotaSpese({ shop: await getSettings(), data, who: str(c.req.query('who')) || str(c.req.query('paid_by')) || '' });
      return c.body(bytes, 200, { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="nota-spese-${data.from}_${data.to}.pdf"`, 'cache-control': 'no-store' });
    } catch (e) {
      return c.json({ ok: false, error: e.status ? e.message : 'Impossibile creare il PDF' }, e.status || 500);
    }
  });

  // Dati demo (caricabili e cancellabili dalle Impostazioni; non toccano mai i dati veri)
  app.get('/api/demo', h(async (req) => { adminOnly(req); return demoStatus(); }));
  app.post('/api/demo', h(async (req) => {
    adminOnly(req);
    const out = await loadDemo();
    if (out.already) throw new L.HttpError(409, 'I dati demo sono già presenti.');
    return out;
  }));
  app.delete('/api/demo', h(async (req) => {
    adminOnly(req);
    try { return await deleteDemo(); } catch (e) {
      if (/FOREIGN KEY|constraint/i.test(String(e.message))) throw new L.HttpError(409, 'Un cliente o un prodotto demo è stato usato in una riparazione o vendita vera: eliminala prima, poi riprova.');
      throw e;
    }
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
    // si eliminano solo clienti senza lavori in corso; le riparazioni concluse (consegnate/annullate) se ne vanno con lui
    const open = (await db.prepare("SELECT COUNT(*) AS n FROM repairs WHERE customer_id = ? AND status NOT IN ('delivered','cancelled')").get(req.params.id)).n;
    if (open) throw new L.HttpError(409, 'Il cliente ha riparazioni ancora aperte: concludile prima di eliminarlo.');
    await db.prepare("DELETE FROM payments WHERE kind = 'repair' AND ref_id IN (SELECT id FROM repairs WHERE customer_id = ?)").run(req.params.id);
    await db.prepare('DELETE FROM repairs WHERE customer_id = ?').run(req.params.id);
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
    if ((await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?').get(req.params.id)).n) throw new L.HttpError(409, 'Il fornitore ha acquisti registrati: non si può eliminare.');
    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Listino servizi (senza giacenza)
  const checkService = (b) => {
    if (!str(b.name)) throw new L.HttpError(400, 'Nome obbligatorio');
    for (const k of ['price', 'cost']) { const n = num(b[k], 0); if (!Number.isFinite(n) || n < 0) throw new L.HttpError(400, 'Importo non valido'); }
  };
  app.get('/api/services', h(() => db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all()));
  app.post('/api/services', h(async (req) => {
    checkService(req.body);
    const cost = isCassa(req.user) ? 0 : num(req.body.cost, 0); // la cassa non conosce né imposta i costi
    const r = await db.prepare('INSERT INTO services (name, price, cost) VALUES (?,?,?)').run(str(req.body.name), num(req.body.price, 0), cost);
    return db.prepare('SELECT * FROM services WHERE id = ?').get(r.lastInsertRowid);
  }));
  app.put('/api/services/:id', h(async (req) => {
    checkService(req.body);
    const old = isCassa(req.user) ? await db.prepare('SELECT cost FROM services WHERE id = ?').get(req.params.id) : null;
    const r = await db.prepare('UPDATE services SET name=?, price=?, cost=? WHERE id=?').run(str(req.body.name), num(req.body.price, 0), old ? old.cost : num(req.body.cost, 0), req.params.id);
    if (!r.changes) throw new L.HttpError(404, 'Servizio non trovato');
    return db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  }));
  app.delete('/api/services/:id', h(async (req) => {
    await db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Acquisti dai fornitori: import fatture, storico e analisi prezzi (officina/purchases.mjs)
  registerPurchaseRoutes(app, h);
  // Ordini per clienti e fornitori (officina/ordini.mjs)
  registerOrderRoutes(app, h);
  // Preventivi con data di validita' (officina/preventivi.mjs)
  registerQuoteRoutes(app, h);
  // Promemoria con data/ora e avviso Telegram (officina/promemoria.mjs)
  registerReminderRoutes(app, h);

  // Dispositivi, buoni/pagamento diviso, documenti d'identita' e credenziali fornitori (dati sensibili cifrati)
  registerDeviceRoutes(app, h);
  registerVoucherRoutes(app, h, { page, getSettings });
  registerDocumentRoutes(app, h);
  registerCredentialRoutes(app, h);

  // ===== Agente B: catalogo modelli, storico, riparazioni esterne, prestiti, note (officina/lottoB.mjs) =====
  registerLottoB(app, h);
  // ===== fine blocco Agente B =====

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
        .run(str(b.sku), str(b.name), str(b.category), 0, Math.round(num(b.min_qty)), isCassa(req.user) ? 0 : num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes));
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
    const old = isCassa(req.user) ? await db.prepare('SELECT cost FROM products WHERE id = ?').get(req.params.id) : null;
    const r = await db.prepare('UPDATE products SET sku=?, name=?, category=?, min_qty=?, cost=?, price=?, supplier_id=?, location=?, notes=? WHERE id=?')
      .run(str(b.sku), str(b.name), str(b.category), Math.round(num(b.min_qty)), old ? old.cost : num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes), req.params.id);
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
  app.delete('/api/repairs/:id', h(async (req) => {
    const r = await db.prepare('SELECT status FROM repairs WHERE id = ?').get(req.params.id);
    if (!r) throw new L.HttpError(404, 'Riparazione non trovata');
    if (!['delivered', 'cancelled'].includes(r.status)) throw new L.HttpError(409, 'Si possono eliminare solo riparazioni concluse (consegnate o annullate).');
    await db.prepare("DELETE FROM payments WHERE kind = 'repair' AND ref_id = ?").run(req.params.id); // via anche gli incassi della riparazione (cassa)
    await db.prepare('DELETE FROM repairs WHERE id = ?').run(req.params.id); // storico, ricambi e firme vanno via
    return { ok: true };
  }));
  app.patch('/api/repairs/:id', h((req) => L.updateRepair(req.params.id, req.body)));
  app.post('/api/repairs/:id/status', h(async (req) => {
    const out = await L.setStatus(req.params.id, req.body.status, str(req.body.note), req.body.public !== false);
    // "Annullato / non riparabile": si registra dove sta il dispositivo (predefinito: in giacenza, partono i giorni di attesa)
    if (req.body.status === 'cancelled') { await R.markUnrepairable(out.id, { fate: req.body.device_fate, note: req.body.fate_note }); return L.getRepair(out.id); }
    return out;
  }));
  // Preventivo con piu' opzioni fra cui il cliente sceglie dal suo link
  app.get('/api/repairs/:id/quote-options', h((req) => R.listOptions(req.params.id)));
  app.post('/api/repairs/:id/quote-options', h((req) => R.addOption(req.params.id, req.body)));
  app.delete('/api/repairs/:id/quote-options/:oid', h((req) => R.removeOption(req.params.id, req.params.oid)));
  // Destino del dispositivo non riparato (giacenza, ritirato, ceduto, deposito, smaltito)
  app.post('/api/repairs/:id/fate', h(async (req) => { await R.setFate(req.params.id, { fate: req.body.fate, note: req.body.note }, { resetCount: !!req.body.restart }); return L.getRepair(req.params.id); }));
  app.get('/api/storage', h(() => R.storageList()));
  app.post('/api/repairs/:id/advance', h(async (req) => {
    const r = await L.getRepair(req.params.id);
    if (!r.next_status) throw new L.HttpError(400, 'Nessun passaggio successivo.');
    return r.next_status === 'delivered' ? L.deliverRepair(r.id, req.body || {}) : L.setStatus(r.id, r.next_status);
  }));
  app.post('/api/repairs/:id/deliver', h((req) => L.deliverRepair(req.params.id, req.body || {})));
  app.post('/api/repairs/:id/note', h((req) => L.addNote(req.params.id, req.body.note, req.body.public !== false)));
  app.post('/api/repairs/:id/parts', h((req) => L.addPart(req.params.id, req.body)));
  app.delete('/api/repairs/:id/parts/:partId', h((req) => L.removePart(req.params.id, req.params.partId)));
  app.put('/api/repairs/:id/checklist', h(async (req) => ({ ok: true, check: await CK.saveRepairCheck(req.params.id, req.body.phase, req.body.items, req.user) })));
  // Firme: scheda di ingresso firmata al banco (tablet/mouse) o richiesta a distanza dal link del cliente
  app.post('/api/repairs/:id/signature', h(async (req) => {
    const sig = await SG.signIntake(req.params.id, req.body, req.c, req.user);
    // la cessione firmata chiude la questione: il dispositivo e' del negozio, niente conto alla rovescia
    if (req.body.kind === 'disposal') await R.setFate(req.params.id, { fate: 'ceduto', note: 'cessione firmata al banco' });
    return sig;
  }));
  app.post('/api/repairs/:id/request-signature', h((req) => SG.requestSignature(req.params.id)));
  app.get('/api/repairs/:id/signatures', h((req) => SG.listSignatures(req.params.id)));
  app.get('/api/repairs/:id/signatures/:sid/image', async (c) => {
    const row = await db.prepare('SELECT image FROM repair_signatures WHERE id = ? AND repair_id = ?').get(c.req.param('sid'), c.req.param('id'));
    if (!row) return c.text('Firma non trovata', 404);
    const bin = atob(row.image.slice(22));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return c.body(bytes, 200, { 'content-type': 'image/png', 'cache-control': 'private, no-store' });
  });
  app.post('/api/repairs/:id/deposit', h(async (req) => {
    // un solo importo (amount + method) oppure piu' quote su metodi diversi (payments), ognuna tracciata in cassa
    const list = Array.isArray(req.body.payments) && req.body.payments.length ? req.body.payments : [{ method: req.body.method, amount: req.body.amount }];
    if (list.length > 6) throw new L.HttpError(400, 'Al massimo 6 quote di pagamento.');
    const rows = list.map((p, i) => {
      const amount = L.money(num(p.amount));
      const method = str(p.method) || 'contanti';
      if (!(amount > 0)) throw new L.HttpError(400, list.length > 1 ? `Quota ${i + 1}: importo non valido` : 'Importo non valido');
      if (/^buono$/i.test(method)) throw new L.HttpError(400, 'Il buono si usa alla consegna, non per l’acconto.');
      if (/non\s*tracciat/i.test(method) || method.length > 30) throw new L.HttpError(400, 'Ogni quota deve avere un metodo di pagamento registrato (contanti, carta, bonifico…).');
      return { amount, method };
    });
    const total = L.money(rows.reduce((a, p) => a + p.amount, 0));
    await tx(async () => {
      const r = await db.prepare('SELECT code FROM repairs WHERE id = ?').get(req.params.id);
      if (!r) throw new L.HttpError(404, 'Riparazione non trovata');
      let i = 0;
      for (const p of rows) {
        i += 1;
        await db.prepare(`INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,${NOW})`).run('repair', req.params.id, rows.length > 1 ? `Acconto ${r.code} · quota ${i}/${rows.length}` : `Acconto ${r.code}`, p.amount, p.method);
      }
      await db.prepare('UPDATE repairs SET deposit = deposit + ? WHERE id = ?').run(total, req.params.id);
      await L.logEvent(Number(req.params.id), null, `Acconto ricevuto: ${total.toFixed(2)} €.`, 1);
    });
    return L.getRepair(req.params.id);
  }));

  // Vendite e cassa
  app.get('/api/sales', h(() => db.prepare('SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 200').all()));
  app.post('/api/sales', h(async (req) => {
    if (isCassa(req.user) && Array.isArray(req.body.items)) {
      // la cassa non vede i costi dei servizi: il costo vero lo rimette il server (per i guadagni corretti)
      for (const it of req.body.items) {
        if (it.product_id) continue;
        const sv = await db.prepare('SELECT cost FROM services WHERE name = ? AND active = 1').get(str(it.name));
        it.unit_cost = sv ? sv.cost : 0;
      }
    }
    return L.createSale(req.body);
  }));
  app.get('/api/sales/:id', h((req) => L.getSale(req.params.id)));
  app.get('/api/report', h(async (req) => {
    const r = await L.report(str(req.query.from), str(req.query.to));
    return { ...r, by_day: await L.reportByDay(r.from, r.to) };
  }));
  // avvisi del gestionale + quelli dei moduli Ordini / Preventivi / Promemoria
  app.get('/api/alerts', h(async (req) => {
    const base = await L.alerts();
    const extra = (await Promise.all(EXTRA_ALERTS.map((f) => f(req.c).catch(() => [])))).flat().concat(await R.storageAlerts().catch(() => []));
    const rank = { high: 0, medium: 1, low: 2 };
    const items = [...base.items, ...extra].sort((x, y) => rank[x.severity] - rank[y.severity]);
    return { count: items.length, high: items.filter((x) => x.severity === 'high').length, items };
  }));
  app.get('/api/analytics', h(async (req) => { adminOnly(req); return L.analytics(str(req.query.from), str(req.query.to)); }));
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
    r.ck_lists = await CK.listFor(r.device_type); // voci dei controlli per il tipo di dispositivo
    r.sign_intake = await SG.lastSignature(r.id, 'intake'); // firma della scheda di ingresso (con immagine)
    r.intake_texts = await SG.intakeTexts(r);
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

const TABLES = ['settings', 'users', 'customers', 'suppliers', 'products', 'stock_moves', 'repairs', 'repair_events', 'repair_parts', 'sales', 'sale_items', 'services', 'payments', 'expenses', 'purchases', 'purchase_lines', 'price_history', 'supplier_codes', 'supplier_info', 'usati_items', 'usati_trash', 'audit_log', 'orders', 'order_items', 'quotes', 'quote_items', 'reminders', 'checklist_templates', 'repair_signatures', 'quote_options'];
/** Copia di tutte le tabelle (usata dal backup JSON e dal backup giornaliero). */
export async function dumpAll() {
  const dump = { created_at: nowLocal(), tables: {} };
  for (const t of [...TABLES, ...PURCHASE_TABLES, ...DEVICE_TABLES, ...VOUCHER_TABLES, ...DOCUMENT_TABLES, ...CREDENTIAL_TABLES]) dump.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all();
  for (const t of LOTTO_B_TABLES) dump.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all(); // Agente B
  return dump;
}
