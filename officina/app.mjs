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

// --- Agente C: chiusure di cassa, archivio fatture, dare/avere ---
import { registerClosingRoutes, CLOSING_TABLES } from './closings.mjs';
import { registerInvoiceRoutes, invoiceAlerts, INVOICE_TABLES } from './invoices.mjs';
import { registerLedgerRoutes, ledgerAlerts, assertNoLedger, LEDGER_TABLES } from './dareavere.mjs';
// --- fine Agente C ---

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
import { registerErrorRoutes } from './registro-errori.mjs';
import { retroMiddleware, registerRetroRoutes } from './retro.mjs';
import { registerAltraRoutes, altraSummary } from './altra.mjs';
import { registerBlackRoutes, findBlacks } from './blacks.mjs';

import * as CK from './checklists.mjs';
import { LEGAL_DEFAULTS } from './legal.mjs';
import * as SG from './signatures.mjs';
import * as R from './remote.mjs';
import { toResponse } from './errori.mjs';
import { cleanCustomer, CUSTOMER_COLS } from './clienti.mjs';
import { printCustomer, printLab, printBoth, printLabel, printSale } from './print.mjs';

// --- Agente D: materiali da ordinare, preventivo da riparazione, carta punti NFC, import DDT (blocchi separati) ---
import { registerMaterialsRoutes, materialsAlerts, MATERIALS_SETTING_KEYS, validateReminderSettings } from './materiali.mjs';
import { registerRepairQuoteRoutes } from './preventivo-riparazione.mjs';
import { registerLoyaltyRoutes, LOYALTY_SETTING_KEYS, validateLoyaltySettings, LOYALTY_TABLES } from './carte.mjs';
// --- fine import agente D ---

const EXTRA_ALERTS = [orderAlerts, quoteAlerts, reminderAlertsNotify, materialsAlerts, invoiceAlerts, ledgerAlerts];
EXTRA_ALERTS.push(lottoBAlerts); // Agente B
const str = (v) => (v == null ? null : String(v).trim() || null);
const num = (v, d = 0) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
const NOW = "datetime('now','localtime')";

/** Adatta una funzione "req => dati" a una route Hono con gestione errori uniforme. */
const errCtx = (c) => {
  const u = c.get('user');
  let id; try { id = c.req.param('id'); } catch { /* nessun parametro */ }
  return { method: c.req.method, path: new URL(c.req.url).pathname, user: u?.email || u?.id || null, id: /^\d{1,12}$/.test(String(id || '')) ? id : null };
};
/** Risposta d'errore uniforme { ok:false, error, code, hint, ref? }; i 500 sono loggati con contesto. */
export const errorReply = (c, e) => {
  const r = toResponse(e, errCtx(c));
  if (r.status === 500) c.set('err', e);
  return c.json(r.body, r.status);
};
/** Legge il corpo JSON: vuoto = {}, ma un JSON rotto e' un errore chiaro (prima veniva ignorato in silenzio e si salvava a vuoto). */
const readBody = async (c) => {
  const raw = await c.req.text();
  if (!raw.trim()) return {};
  try { const b = JSON.parse(raw); return b && typeof b === 'object' ? b : {}; } catch {
    throw new L.HttpError(400, 'I dati inviati non sono leggibili (JSON non valido): l’operazione non è stata eseguita.', { code: 'JSON_NON_VALIDO', hint: 'Ricarica la pagina (Ctrl+F5) e riprova; se si ripete avvisa Marco.' });
  }
};
const h = (fn) => async (c) => {
  try {
    const m = c.req.method;
    const body = m === 'GET' || m === 'DELETE' ? {} : await readBody(c);
    return c.json(await fn({ params: c.req.param(), query: c.req.query(), body: body || {}, user: c.get('user'), c }));
  } catch (e) {
    return errorReply(c, e);
  }
};
/** Come h, ma per risposte non JSON (pagine di stampa): testo leggibile, stesso status. */
const page = (fn) => async (c) => {
  try { return await fn(c); } catch (e) {
    const r = toResponse(e, errCtx(c));
    if (r.status === 500) c.set('err', e);
    return c.text([r.body.error, r.body.hint].filter(Boolean).join('\n'), r.status);
  }
};

export const qrSvg = (t) => renderSVG(String(t || ''), { border: 1 });

// ---------- Pubblico ----------
export function createPublicApp() {
  const app = new Hono();
  app.onError((e, c) => errorReply(c, e)); // eccezioni fuori dai gestori h(): stesso formato e log con contesto
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
  app.onError((e, c) => errorReply(c, e));
  app.use('*', notifyMiddleware); // prima dell'accesso: segnala anche i tentativi negati e gli errori
  if (auth) app.use('*', auth);
  app.use('*', cassaMiddleware); // ruolo cassa: niente costi/margini nelle risposte
  app.use('/api/*', auditMiddleware); // registro eliminazioni/modifiche (dopo l'accesso: sa chi è)
  app.use('/api/*', retroMiddleware); // inserimento retroattivo (entry_date), sempre registrato

  const trackBase = async () => {
    const s = await getSettings();
    return String(s.public_base_url || (await trackBaseFallback?.()) || '').replace(/\/$/, '');
  };
  const trackUrl = async (token) => `${await trackBase()}/t/${token}`;
  const roleOf = (r) => (['admin', 'cassa'].includes(r) ? r : 'staff');
  const adminOnly = (req) => {
    if (req.user && req.user.role !== 'admin') throw new L.HttpError(403, 'Questa operazione è riservata all’amministratore: il tuo utente non ha il permesso.', { code: 'SOLO_ADMIN', hint: 'Chiedi a Christian o Marco di eseguirla, oppure di darti il ruolo amministratore.' });
  };

  registerAuditRoutes(app, h, adminOnly);
  registerErrorRoutes(app, h, adminOnly);
  registerRetroRoutes(app, h, adminOnly);
  registerBlackRoutes(app, h, adminOnly);
  registerAltraRoutes(app, h, adminOnly);
  app.get('/api/me', h((req) => ({ user: req.user || { email: 'locale', name: 'Locale', role: 'admin' } })));
  app.get('/api/meta', h(async () => ({ statuses: L.STATUSES, step_labels: L.STEP_LABELS, settings: await getSettings(), track_base: await trackBase(), device_types: CK.DEVICE_TYPES, phases: CK.PHASES })));
  app.get('/api/dashboard', h(async () => ({ ...(await L.dashboard()), storage: await R.storageList().catch(() => []) })));
  app.get('/api/settings', h(() => getSettings()));
  app.put('/api/settings', h(async (req) => {
    adminOnly(req);
    const allowed = ['shop_name', 'shop_address', 'shop_phone', 'public_base_url', 'default_warranty_days', 'terms', 'low_stock_default', 'stale_days', 'ready_days', 'quote_valid_days', 'vat_rate', ...MATERIALS_SETTING_KEYS, ...LOYALTY_SETTING_KEYS, ...Object.keys(LEGAL_DEFAULTS)];
    validateReminderSettings(req.body);
    validateLoyaltySettings(req.body);
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
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new L.HttpError(400, 'L’indirizzo email inserito non è valido: l’utente non è stato aggiunto.', { code: 'EMAIL_NON_VALIDA', hint: 'Scrivilo nella forma nome@dominio.it e riprova.' });
    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new L.HttpError(409, `L’utente ${email} esiste già: non lo aggiungo una seconda volta.`, { code: 'UTENTE_GIA_PRESENTE', hint: 'Cercalo nell’elenco utenti e modifica il suo ruolo se serve.' });
    const role = roleOf(req.body.role);
    const r = await db.prepare(`INSERT INTO users (email, name, role, created_at) VALUES (?,?,?,${NOW})`).run(email, str(req.body.name), role);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  }));
  app.put('/api/users/:id', h(async (req) => {
    adminOnly(req);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new L.HttpError(404, `Utente n. ${req.params.id} non trovato.`, { code: 'UTENTE_NON_TROVATO', hint: 'Ricarica l’elenco utenti: potrebbe essere già stato eliminato.' });
    if (u.protected) throw new L.HttpError(409, 'L’account del proprietario è protetto: non si può modificare.', { code: 'PROPRIETARIO_PROTETTO', hint: 'Per cambiare ruolo o nome usa un altro utente amministratore, non il proprietario.' });
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    await db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run(str(req.body.name) ?? u.name, roleOf(req.body.role), active, u.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  }));
  app.delete('/api/users/:id', h(async (req) => {
    adminOnly(req);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new L.HttpError(404, `Utente n. ${req.params.id} non trovato.`, { code: 'UTENTE_NON_TROVATO', hint: 'Ricarica l’elenco utenti: potrebbe essere già stato eliminato.' });
    if (u.protected) throw new L.HttpError(409, 'L’account del proprietario è protetto: non si può eliminare.', { code: 'PROPRIETARIO_PROTETTO', hint: 'Il proprietario resta sempre abilitato; elimina solo gli altri utenti.' });
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
      return errorReply(c, e.status ? e : new L.HttpError(500, 'Impossibile creare il PDF della nota spese.', { code: 'PDF_NON_CREATO', hint: 'Riprova; se si ripete avvisa Marco.' }));
    }
  });

  // Dati demo (caricabili e cancellabili dalle Impostazioni; non toccano mai i dati veri)
  app.get('/api/demo', h(async (req) => { adminOnly(req); return demoStatus(); }));
  app.post('/api/demo', h(async (req) => {
    adminOnly(req);
    const out = await loadDemo();
    if (out.already) throw new L.HttpError(409, 'I dati demo sono già stati caricati: non li carico di nuovo.', { code: 'DEMO_GIA_PRESENTI', hint: 'Se vuoi ripartire, cancella prima i dati demo da Impostazioni.' });
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
    // chi e' nell'elenco Blacks (segnalazione attiva) porta il distintivo anche in elenco
    const flag = async (rows) => { const ids = new Set((await db.prepare('SELECT customer_id FROM blacklist WHERE active = 1 AND customer_id IS NOT NULL').all()).map((r) => r.customer_id)); return rows.map((r) => ({ ...r, blacklisted: ids.has(r.id) ? 1 : 0 })); };
    if (!q) return flag(await db.prepare(`${base} ORDER BY c.created_at DESC LIMIT 300`).all());
    const like = `%${q}%`;
    return flag(await db.prepare(`${base} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.company_name LIKE ? OR c.vat_number LIKE ? OR c.fiscal_code LIKE ? OR c.city LIKE ? OR c.pec LIKE ? ORDER BY c.name LIMIT 100`).all(like, like, like, like, like, like, like, like));
  }));
  app.get('/api/customers/:id', h(async (req) => {
    const c = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!c) throw new L.HttpError(404, 'Cliente non trovato');
    return { ...c, blacklist: await findBlacks({ customer_id: c.id }), repairs: await L.listRepairs({ customer_id: c.id }), sales: await db.prepare("SELECT * FROM sales WHERE customer_id = ? AND entity = 'main' ORDER BY id DESC").all(c.id) };
  }));
  app.post('/api/customers', h(async (req) => {
    const id = await L.upsertCustomer({ ...req.body, id: undefined });
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  }));
  app.put('/api/customers/:id', h(async (req) => {
    const cur = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!cur) throw new L.HttpError(404, 'Cliente non trovato');
    const f = cleanCustomer(req.body, cur);
    await db.prepare(`UPDATE customers SET ${CUSTOMER_COLS.map((k) => `${k}=?`).join(', ')} WHERE id=?`).run(...CUSTOMER_COLS.map((k) => f[k]), req.params.id);
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  }));
  app.delete('/api/customers/:id', h(async (req) => {
    await assertNoLedger(req.params.id); // Agente C: niente eliminazione con dare/avere
    // si eliminano solo clienti senza lavori in corso; le riparazioni concluse (consegnate/annullate) se ne vanno con lui
    const open = (await db.prepare("SELECT COUNT(*) AS n FROM repairs WHERE customer_id = ? AND status NOT IN ('delivered','cancelled')").get(req.params.id)).n;
    if (open) throw new L.HttpError(409, `Non posso eliminare il cliente n. ${req.params.id}: ha ${open} riparazion${open === 1 ? 'e ancora aperta' : 'i ancora aperte'}.`, { code: 'CLIENTE_CON_RIPARAZIONI_APERTE', hint: 'Consegna o annulla le sue riparazioni aperte, poi riprova a eliminarlo.' });
    await db.prepare("DELETE FROM payments WHERE kind = 'repair' AND ref_id IN (SELECT id FROM repairs WHERE customer_id = ?)").run(req.params.id);
    await db.prepare('DELETE FROM repairs WHERE customer_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Fornitori
  app.get('/api/suppliers', h(() => db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id=s.id AND p.active=1) AS products_count FROM suppliers s ORDER BY s.name`).all()));
  // anagrafica estesa: sede legale/ritiro, P.IVA, pagamento, ordine minimo, consegna, agenti (elenco JSON ripulito)
  const supExtra = (b) => {
    const agents = (Array.isArray(b.agents) ? b.agents : []).map((x) => ({ name: str(x?.name) || '', phone: str(x?.phone) || '', email: str(x?.email) || '', area: str(x?.area) || '' })).filter((x) => x.name || x.phone || x.email).slice(0, 20);
    return [str(b.legal_address), str(b.pickup_address), str(b.vat_number), str(b.payment_terms), str(b.min_order), str(b.delivery_days), agents.length ? JSON.stringify(agents) : null];
  };
  app.post('/api/suppliers', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Manca il nome: non posso salvare senza.', { code: 'NOME_MANCANTE', hint: 'Compila il campo Nome e salva di nuovo.' });
    const r = await db.prepare(`INSERT INTO suppliers (name, phone, email, website, notes, legal_address, pickup_address, vat_number, payment_terms, min_order, delivery_days, agents, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,${NOW})`).run(str(b.name), str(b.phone), str(b.email), str(b.website), str(b.notes), ...supExtra(b));
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid);
  }));
  app.put('/api/suppliers/:id', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Manca il nome: non posso salvare senza.', { code: 'NOME_MANCANTE', hint: 'Compila il campo Nome e salva di nuovo.' });
    const r = await db.prepare('UPDATE suppliers SET name=?, phone=?, email=?, website=?, notes=?, legal_address=?, pickup_address=?, vat_number=?, payment_terms=?, min_order=?, delivery_days=?, agents=? WHERE id=?').run(str(b.name), str(b.phone), str(b.email), str(b.website), str(b.notes), ...supExtra(b), req.params.id);
    if (!r.changes) throw new L.HttpError(404, 'Fornitore non trovato');
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  }));
  app.delete('/api/suppliers/:id', h(async (req) => {
    if ((await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?').get(req.params.id)).n) throw new L.HttpError(409, `Non posso eliminare il fornitore n. ${req.params.id}: ha acquisti registrati.`, { code: 'FORNITORE_CON_ACQUISTI', hint: 'I fornitori con storico non si cancellano: lasciali in elenco (o rinominali).' });
    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));

  // Listino servizi (senza giacenza)
  const checkService = (b) => {
    if (!str(b.name)) throw new L.HttpError(400, 'Manca il nome: non posso salvare senza.', { code: 'NOME_MANCANTE', hint: 'Compila il campo Nome e salva di nuovo.' });
    for (const k of ['price', 'cost']) { const n = num(b[k], 0); if (!Number.isFinite(n) || n < 0) throw new L.HttpError(400, 'Un importo non è valido: deve essere un numero uguale o maggiore di zero.', { code: 'IMPORTO_NON_VALIDO', hint: 'Controlla prezzo e costo (es. 49,90) e salva di nuovo.' }); }
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

  // --- Agente D: routes (blocco separato) ---
  registerMaterialsRoutes(app, h); // officina/materiali.mjs
  registerRepairQuoteRoutes(app, h, { trackBase }); // officina/preventivo-riparazione.mjs
  registerLoyaltyRoutes(app, h); // officina/carte.mjs (carta punti NFC)
  // --- fine routes agente D ---

  // Dispositivi, buoni/pagamento diviso, documenti d'identita' e credenziali fornitori (dati sensibili cifrati)
  registerDeviceRoutes(app, h);
  registerVoucherRoutes(app, h, { page, getSettings });
  registerDocumentRoutes(app, h);
  registerCredentialRoutes(app, h);

  // --- Agente C: chiusure di cassa (closings.mjs), archivio fatture (invoices.mjs), dare/avere (dareavere.mjs) ---
  registerClosingRoutes(app, h, { adminOnly, media: usati.media || (() => missingMedia()) });
  registerInvoiceRoutes(app, h, { adminOnly });
  registerLedgerRoutes(app, h, { adminOnly });
  // --- fine Agente C ---
  // ===== Agente B: catalogo modelli, storico, riparazioni esterne, prestiti, note (officina/lottoB.mjs) =====
  registerLottoB(app, h, { media: usati.media || (() => missingMedia()) });
  // ===== fine blocco Agente B =====

  // Categorie del magazzino: elenco = salvate + quelle già usate dagli articoli (senza doppioni di maiuscole)
  const catName = (v) => {
    const n = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!n) throw new L.HttpError(400, 'Scrivi il nome della categoria.', { code: 'CATEGORIA_NOME_MANCANTE', hint: 'Compila il nome e riprova.' });
    if (n.length > 40) throw new L.HttpError(400, 'Il nome della categoria è troppo lungo (massimo 40 caratteri).', { code: 'CATEGORIA_NOME_LUNGO', hint: 'Usa un nome più breve.' });
    return n;
  };
  const catList = async () => {
    const saved = await db.prepare('SELECT name FROM categories').all();
    const used = await db.prepare("SELECT category AS name, COUNT(*) AS n FROM products WHERE active = 1 AND category IS NOT NULL AND TRIM(category) <> '' GROUP BY category").all();
    const m = new Map();
    for (const r of saved) m.set(r.name.toLowerCase(), { name: r.name, count: 0 });
    for (const r of used) { const k = r.name.toLowerCase(); const e = m.get(k) || { name: r.name, count: 0 }; e.count += r.n; m.set(k, e); }
    return [...m.values()].sort((x, y) => x.name.localeCompare(y.name, 'it'));
  };
  const catAdmin = (req) => { if (isCassa(req.user)) throw new L.HttpError(403, 'Le categorie le gestisce l’amministratore o il tecnico.', { code: 'RUOLO_NON_AMMESSO', hint: 'Accedi come amministratore o tecnico.' }); };
  app.get('/api/categories', h(() => catList()));
  app.post('/api/categories', h(async (req) => {
    catAdmin(req);
    const name = catName(req.body?.name);
    if ((await catList()).some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new L.HttpError(409, `La categoria “${name}” esiste già.`, { code: 'CATEGORIA_ESISTENTE', hint: 'Usa quella già presente.' });
    await db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    return catList();
  }));
  // rinomina; se il nuovo nome è di un'altra categoria le unisce (gli articoli passano alla categoria di destinazione)
  app.put('/api/categories', h(async (req) => {
    catAdmin(req);
    const from = catName(req.body?.name); const to = catName(req.body?.new_name);
    const list = await catList();
    if (!list.some((c) => c.name.toLowerCase() === from.toLowerCase())) throw new L.HttpError(404, `La categoria “${from}” non esiste più.`, { code: 'CATEGORIA_NON_TROVATA', hint: 'Aggiorna la pagina.' });
    const target = list.find((c) => c.name.toLowerCase() === to.toLowerCase() && c.name.toLowerCase() !== from.toLowerCase());
    const finalName = target ? target.name : to;
    await db.prepare('UPDATE products SET category = ? WHERE LOWER(category) = LOWER(?)').run(finalName, from);
    await db.prepare('DELETE FROM categories WHERE name = ? COLLATE NOCASE').run(from);
    await db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(finalName);
    return catList();
  }));
  app.delete('/api/categories', h(async (req) => {
    catAdmin(req);
    const name = catName(req.body?.name ?? req.query.name);
    const n = (await db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1 AND LOWER(category) = LOWER(?)').get(name)).n;
    if (n) throw new L.HttpError(409, `La categoria “${name}” ha ancora ${n} articoli.`, { code: 'CATEGORIA_IN_USO', hint: 'Per toglierla rinominala con il nome di un’altra categoria: gli articoli passano lì.' });
    await db.prepare('DELETE FROM categories WHERE name = ? COLLATE NOCASE').run(name);
    return catList();
  }));

  // Magazzino
  const checkProduct = (b) => {
    for (const k of ['cost', 'price', 'min_qty']) {
      const n = num(b[k]);
      if (!Number.isFinite(n) || n < 0) throw new L.HttpError(400, `Valore non valido: ${k === 'cost' ? 'costo' : k === 'price' ? 'prezzo' : 'scorta minima'}`);
    }
    if (b.qty !== undefined && !Number.isFinite(num(b.qty))) throw new L.HttpError(400, 'La quantità indicata non è un numero valido (o è zero): lo stock non è stato toccato.', { code: 'QUANTITA_NON_VALIDA', hint: 'Scrivi un numero diverso da zero: positivo per caricare, negativo per scaricare.' });
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
  /** Soglia "fermo" del singolo articolo: vuoto = quella generale, 0 = mai, altrimenti giorni (1-3650). */
  const staleOf = (b) => {
    if (b.stale_days === '' || b.stale_days == null) return null;
    const n = Math.round(num(b.stale_days, NaN));
    if (!Number.isFinite(n) || n < 0 || n > 3650) throw new L.HttpError(400, 'I giorni dopo cui l’articolo risulta fermo non sono validi: serve un numero tra 0 e 3650.', { code: 'GIORNI_FERMO_NON_VALIDI', hint: 'Lascia vuoto per usare la soglia generale, scrivi 0 per non avvisare mai per questo articolo.' });
    return n;
  };
  app.post('/api/products', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Manca il nome: non posso salvare senza.', { code: 'NOME_MANCANTE', hint: 'Compila il campo Nome e salva di nuovo.' });
    checkProduct(b);
    if (b.supplier_id && !(await db.prepare('SELECT id FROM suppliers WHERE id = ?').get(b.supplier_id))) throw new L.HttpError(404, 'Il fornitore scelto per l’articolo non esiste più in anagrafica.', { code: 'FORNITORE_NON_TROVATO', hint: 'Aggiorna la pagina e scegli di nuovo il fornitore, oppure lascia il campo vuoto.' });
    const qty = Math.round(num(b.qty));
    const id = await tx(async () => {
      const r = await db.prepare(`INSERT INTO products (sku, name, category, qty, min_qty, cost, price, supplier_id, location, notes, stale_days, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,${NOW})`)
        .run(str(b.sku), str(b.name), str(b.category), 0, Math.round(num(b.min_qty)), isCassa(req.user) ? 0 : num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes), staleOf(b));
      const pid = Number(r.lastInsertRowid);
      if (qty) await L.moveStock(pid, qty, 'carico iniziale', null);
      return pid;
    });
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  }));
  app.put('/api/products/:id', h(async (req) => {
    const b = req.body;
    if (!str(b.name)) throw new L.HttpError(400, 'Manca il nome: non posso salvare senza.', { code: 'NOME_MANCANTE', hint: 'Compila il campo Nome e salva di nuovo.' });
    checkProduct(b);
    if (b.supplier_id && !(await db.prepare('SELECT id FROM suppliers WHERE id = ?').get(b.supplier_id))) throw new L.HttpError(404, 'Il fornitore scelto per l’articolo non esiste più in anagrafica.', { code: 'FORNITORE_NON_TROVATO', hint: 'Aggiorna la pagina e scegli di nuovo il fornitore, oppure lascia il campo vuoto.' });
    const old = isCassa(req.user) ? await db.prepare('SELECT cost FROM products WHERE id = ?').get(req.params.id) : null;
    const r = await db.prepare('UPDATE products SET sku=?, name=?, category=?, min_qty=?, cost=?, price=?, supplier_id=?, location=?, notes=?, stale_days=? WHERE id=?')
      .run(str(b.sku), str(b.name), str(b.category), Math.round(num(b.min_qty)), old ? old.cost : num(b.cost), num(b.price), b.supplier_id || null, str(b.location), str(b.notes), staleOf(b), req.params.id);
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
    if (!delta) throw new L.HttpError(400, 'La quantità indicata non è un numero valido (o è zero): lo stock non è stato toccato.', { code: 'QUANTITA_NON_VALIDA', hint: 'Scrivi un numero diverso da zero: positivo per caricare, negativo per scaricare.' });
    await tx(() => L.moveStock(Number(req.params.id), delta, str(req.body.reason) || (delta > 0 ? 'carico' : 'scarico'), str(req.body.ref)));
    return db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  }));
  app.get('/api/products/:id/moves', h((req) => db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100').all(req.params.id)));

  // Riparazioni
  app.get('/api/repairs', h((req) => L.listRepairs({ status: str(req.query.status), q: str(req.query.q), open: req.query.open === '1', customer_id: req.query.customer_id })));
  app.post('/api/repairs', h(async (req) => {
    const r = await L.createRepair(req.body);
    return { ...r, track_url: await trackUrl(r.token), blacklist_alert: await findBlacks({ customer_id: r.customer_id }) };
  }));
  app.get('/api/repairs/:id', h(async (req) => {
    const r = await L.getRepair(req.params.id);
    return { ...r, track_url: await trackUrl(r.token) };
  }));
  app.delete('/api/repairs/:id', h(async (req) => {
    const r = await db.prepare('SELECT status, code FROM repairs WHERE id = ?').get(req.params.id);
    if (!r) throw new L.HttpError(404, 'Riparazione non trovata');
    if (!['delivered', 'cancelled'].includes(r.status)) throw new L.HttpError(409, `La riparazione ${r.code} è ancora in lavorazione (stato: ${L.STATUSES[r.status]?.label || r.status}): non si può eliminare.`, { code: 'RIPARAZIONE_NON_CONCLUSA', hint: 'Consegnala oppure annullala, poi potrai eliminarla.' });
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
    if (!r.next_status) throw new L.HttpError(400, 'La riparazione è già all’ultimo passaggio: non c’è uno stato successivo.', { code: 'NESSUN_PASSAGGIO_SUCCESSIVO', hint: 'Per chiuderla usa “Consegna e incassa”, oppure annullala.' });
    return r.next_status === 'delivered' ? L.deliverRepair(r.id, req.body || {}) : L.setStatus(r.id, r.next_status);
  }));
  app.post('/api/repairs/:id/deliver', h((req) => L.deliverRepair(req.params.id, req.body || {})));
  app.post('/api/repairs/:id/note', h((req) => L.addNote(req.params.id, req.body.note, req.body.public !== false)));
  app.post('/api/repairs/:id/parts', h((req) => L.addPart(req.params.id, req.body)));
  app.patch('/api/repairs/:id/parts/:partId', h((req) => L.updatePart(req.params.id, req.params.partId, req.body, { canCost: !isCassa(req.user) })));
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
    if (list.length > 6) throw new L.HttpError(400, `L’acconto è diviso in ${list.length} quote: il massimo è 6.`, { code: 'TROPPE_QUOTE', hint: 'Unisci le quote con lo stesso metodo di pagamento.' });
    const rows = list.map((p, i) => {
      const amount = L.money(num(p.amount));
      const method = str(p.method) || 'contanti';
      if (!(amount > 0)) throw new L.HttpError(400, list.length > 1 ? `La quota ${i + 1} dell’acconto ha un importo non valido: deve essere maggiore di zero.` : 'L’importo dell’acconto non è valido: deve essere maggiore di zero.', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi l’importo ricevuto (es. 50 o 49,90).' });
      if (/^buono$/i.test(method)) throw new L.HttpError(400, 'Il buono non si può usare come acconto: si applica solo al saldo, alla consegna.', { code: 'BUONO_NON_PER_ACCONTO', hint: 'Registra l’acconto in contanti, carta o bonifico; usa il buono quando consegni.' });
      if (/non\s*tracciat/i.test(method) || method.length > 30) throw new L.HttpError(400, 'Una quota dell’acconto ha un metodo di pagamento non ammesso: ogni incasso va registrato con il metodo reale.', { code: 'METODO_PAGAMENTO_MANCANTE', hint: 'Scegli contanti, carta, bonifico…' });
      return { amount, method };
    });
    const total = L.money(rows.reduce((a, p) => a + p.amount, 0));
    await tx(async () => {
      const r = await db.prepare('SELECT code, status FROM repairs WHERE id = ?').get(req.params.id);
      if (!r) throw new L.HttpError(404, 'Riparazione non trovata');
      // BUG corretto: l'acconto su una riparazione gia' consegnata/annullata falsava il saldo e la cassa
      if (['delivered', 'cancelled'].includes(r.status)) throw new L.HttpError(409, `La riparazione ${r.code} è ${r.status === 'delivered' ? 'già stata consegnata' : 'annullata'}: non si può più registrare un acconto.`, { code: 'ACCONTO_SU_RIPARAZIONE_CONCLUSA', hint: 'Se il cliente ha pagato qualcosa in più, registralo come vendita separata.' });
      let i = 0;
      for (const p of rows) {
        i += 1;
        await db.prepare(`INSERT INTO payments (kind, ref_id, label, amount, method, entity, created_at) VALUES (?,?,?,?,?,?,${NOW})`).run('repair', req.params.id, rows.length > 1 ? `Acconto ${r.code} · quota ${i}/${rows.length}` : `Acconto ${r.code}`, p.amount, p.method, L.entityOf(req.body));
      }
      await db.prepare('UPDATE repairs SET deposit = deposit + ? WHERE id = ?').run(total, req.params.id);
      await L.logEvent(Number(req.params.id), null, `Acconto ricevuto: ${total.toFixed(2)} €.`, 1);
    });
    return L.getRepair(req.params.id);
  }));

  // Vendite e cassa
  app.get('/api/sales', h(() => db.prepare("SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.entity = 'main' ORDER BY s.id DESC LIMIT 200").all()));
  app.post('/api/sales', h(async (req) => {
    if (isCassa(req.user) && Array.isArray(req.body.items)) {
      // la cassa non vede i costi dei servizi: il costo vero lo rimette il server (per i guadagni corretti)
      for (const it of req.body.items) {
        if (it.product_id) continue;
        const sv = await db.prepare('SELECT cost FROM services WHERE name = ? AND active = 1').get(str(it.name));
        it.unit_cost = sv ? sv.cost : 0;
      }
    }
    const sale = await L.createSale(req.body);
    return { ...sale, blacklist_alert: req.body.customer_id ? await findBlacks({ customer_id: req.body.customer_id }) : [] };
  }));
  app.get('/api/sales/:id', h(async (req) => {
    const sale = await L.getSale(req.params.id);
    // vendita di un'altra attivita': dopo la conferma la Cassa non la rivede (la gestiscono gli amministratori)
    if (sale.entity === 'altra' && req.user && req.user.role !== 'admin') throw new L.HttpError(404, 'Vendita non trovata');
    return sale;
  }));
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
  app.get('/api/analytics', h(async (req) => { adminOnly(req); const a = await L.analytics(str(req.query.from), str(req.query.to)); return { ...a, other: await altraSummary(a.from, a.to) }; }));
  app.get('/api/stock/summary', h(() => L.stockSummary()));

  // Backup: tutte le tabelle in un file JSON scaricabile (D1 non ha VACUUM INTO). Un motore con un backup suo (SQLite locale) lo passa in `backup`.
  app.get('/api/backup', async (c) => {
    try {
      if (backup) return await backup(c);
      return c.body(JSON.stringify(await dumpAll()), 200, { 'content-type': 'application/json', 'content-disposition': `attachment; filename="officina-backup-${L.localDate()}.json"` });
    } catch (e) {
      return errorReply(c, e.status ? e : new Error(`Backup non riuscito: ${e.message}`)); // 500 con codice di riferimento e log
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

const TABLES = ['settings', 'users', 'customers', 'suppliers', 'products', 'stock_moves', 'repairs', 'repair_events', 'repair_parts', 'sales', 'sale_items', 'services', 'payments', 'expenses', 'purchases', 'purchase_lines', 'price_history', 'supplier_codes', 'supplier_info', 'usati_items', 'usati_trash', 'audit_log', 'orders', 'order_items', 'quotes', 'quote_items', 'reminders', 'blacklist', 'checklist_templates', 'repair_signatures', 'quote_options'];
/** Copia di tutte le tabelle (usata dal backup JSON e dal backup giornaliero). */
export async function dumpAll() {
  const dump = { created_at: nowLocal(), tables: {} };
  for (const t of [...TABLES, ...PURCHASE_TABLES, ...DEVICE_TABLES, ...VOUCHER_TABLES, ...LOYALTY_TABLES, ...DOCUMENT_TABLES, ...CREDENTIAL_TABLES, ...CLOSING_TABLES, ...INVOICE_TABLES, ...LEDGER_TABLES]) dump.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all();
  for (const t of LOTTO_B_TABLES) dump.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all(); // Agente B
  return dump;
}
