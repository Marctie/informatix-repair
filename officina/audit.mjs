// Registro delle eliminazioni e delle modifiche importanti (chi, cosa, quando).
// Un middleware osserva le richieste che scrivono (POST/PUT/PATCH/DELETE): se vanno a buon fine, ne annota una riga in audit_log.
// Non salva mai il corpo della richiesta (niente codici di sblocco o altri dati sensibili): solo tipo, id ed etichetta leggibile.
import { db } from './dbref.mjs';

const NOW = "datetime('now','localtime')";

// primo segmento del percorso /api/<seg>/... -> tipo oggetto, tabella e come descriverlo
const KINDS = {
  customers: { type: 'cliente', table: 'customers', label: (r) => r.name },
  repairs: { type: 'riparazione', table: 'repairs', label: (r) => `${r.code} · ${r.brand_model}` },
  products: { type: 'articolo', table: 'products', label: (r) => r.name },
  suppliers: { type: 'fornitore', table: 'suppliers', label: (r) => r.name },
  users: { type: 'utente', table: 'users', label: (r) => r.email },
  expenses: { type: 'spesa', table: 'expenses', label: (r) => `${r.description} (${Number(r.amount).toFixed(2)} €)` },
  services: { type: 'servizio', table: 'services', label: (r) => r.name },
  sales: { type: 'vendita', table: 'sales', label: (r) => `Vendita n. ${r.id} (${Number(r.total).toFixed(2)} €)` },
};
export const AUDIT_TYPES = ['cliente', 'riparazione', 'articolo', 'fornitore', 'utente', 'spesa', 'servizio', 'ricambio', 'vendita', 'pagamento', 'impostazioni', 'acquisto', 'carico', 'dati demo', 'retroattivo'];

// sotto-azioni importanti: "METODO ultimo-pezzo" -> [tipo, azione, descrizione]
const SUB = {
  'POST status': ['riparazione', 'modifica', 'cambio stato'],
  'POST advance': ['riparazione', 'modifica', 'avanzamento'],
  'POST deliver': ['pagamento', 'crea', 'consegna e incasso'],
  'POST deposit': ['pagamento', 'crea', 'acconto'],
  'POST parts': ['ricambio', 'crea', 'ricambio aggiunto alla riparazione'],
  'DELETE parts': ['ricambio', 'elimina', 'ricambio tolto dalla riparazione'],
  'POST move': ['articolo', 'modifica', 'movimento di magazzino'],
  'POST load': ['carico', 'crea', 'carico merce'],
};
const VERB = { POST: 'crea', PUT: 'modifica', PATCH: 'modifica', DELETE: 'elimina' };

/** Riconosce la richiesta: restituisce { kind, id, subId, type, action, detail } oppure null se non va registrata. */
export function classify(method, path) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  if (path === '/api/settings' && method === 'PUT') return { type: 'impostazioni', action: 'modifica', detail: 'impostazioni del negozio' };
  if (path === '/api/purchases/confirm') return { type: 'acquisto', action: 'crea', detail: 'documento di acquisto importato' };
  if (path === '/api/demo') return { type: 'dati demo', action: method === 'POST' ? 'crea' : 'elimina', detail: method === 'POST' ? 'caricati i dati demo' : 'cancellati i dati demo' };
  if (/^\/api\/repairs\/\d+\/parts\/\d+\/stock$/.test(path) && method === 'POST') return { kind: KINDS.repairs, id: path.split('/')[3], type: 'articolo', action: 'crea', detail: 'ricambio a mano caricato a magazzino' };
  const m = path.match(/^\/api\/([a-z]+)(?:\/(\d+))?(?:\/([a-z]+))?(?:\/(\d+))?$/);
  if (!m) return null;
  const [, seg, id, sub, subId] = m;
  const kind = KINDS[seg];
  if (!kind) return null;
  if (sub) {
    const s = SUB[`${method} ${sub}`];
    if (!s) return null;
    return { kind, id, subId, type: s[0], action: s[1], detail: s[2] };
  }
  return { kind, id, type: kind.type, action: VERB[method] };
}

async function describe(kind, id) {
  if (!kind || !id) return null;
  try {
    const row = await db.prepare(`SELECT * FROM ${kind.table} WHERE id = ?`).get(id);
    return row ? kind.label(row) : null;
  } catch { return null; }
}

export async function writeAudit({ user, action, type, id, label, detail }) {
  await db.prepare(`INSERT INTO audit_log (at, user_email, action, object_type, object_id, label, detail) VALUES (${NOW},?,?,?,?,?,?)`)
    .run(user?.email || 'locale', action, type, id == null ? null : String(id), label || null, detail || null);
}

/** Middleware Hono da montare dopo l'autenticazione. */
export const auditMiddleware = async (c, next) => {
  const cls = classify(c.req.method, c.req.path);
  const before = cls ? await describe(cls.kind, cls.id) : null;
  const reqBody = cls && ['ricambio', 'impostazioni'].includes(cls.type) || cls?.detail === 'cambio stato'
    ? await c.req.raw.clone().json().catch(() => ({})) : {};
  await next();
  if (!cls || c.res.status >= 400) return;
  try {
    let label = before;
    let id = cls.id;
    let detail = cls.detail || null;
    const json = await c.res.clone().json().catch(() => null);
    if (!label && cls.kind && json && typeof json === 'object') {
      if (!id && json.id != null) id = json.id;
      try { label = cls.kind.label(json); } catch { /* risposta senza i campi attesi */ }
      if (!label && id) label = await describe(cls.kind, id);
    }
    if (cls.type === 'ricambio') {
      if (cls.action === 'crea') { const nm = reqBody?.name || (json?.parts || []).slice(-1)[0]?.name; if (nm) detail = `${detail}: ${String(nm).slice(0, 80)}`; }
      else if (cls.subId) detail = `${detail} (n. ${cls.subId})`;
    }
    if (cls.type === 'carico' && json?.loaded) detail = `${json.loaded.qty} pz a ${Number(json.loaded.unit_price).toFixed(2)} € da ${json.loaded.supplier_name} · doc ${json.loaded.doc_number}`.slice(0, 200);
    if (cls.type === 'impostazioni') label = 'Impostazioni del negozio';
    if (cls.type === 'impostazioni') detail = `campi: ${Object.keys(reqBody || {}).join(', ')}`.slice(0, 200);
    if (cls.detail === 'cambio stato' && reqBody?.status) detail = `cambio stato → ${reqBody.status}`;
    if (cls.type === 'acquisto' && json?.purchase_id) id = json.purchase_id;
    await writeAudit({ user: c.get('user'), action: cls.action, type: cls.type, id, label, detail });
  } catch (e) { console.error('audit', e); }
};

/** Elenco con filtri e paginazione (solo amministratore). */
export async function listAudit({ type, user, from, to, q, page = 1, size = 50 } = {}) {
  const where = [];
  const args = [];
  if (type) { where.push('object_type = ?'); args.push(type); }
  if (user) { where.push('user_email = ?'); args.push(user); }
  if (from) { where.push('date(at) >= ?'); args.push(from); }
  if (to) { where.push('date(at) <= ?'); args.push(to); }
  if (q) { where.push('(label LIKE ? OR detail LIKE ? OR user_email LIKE ? OR object_id = ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, q); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM audit_log ${w}`).get(...args)).n;
  const sz = Math.min(200, Math.max(1, Number(size) || 50));
  const pg = Math.max(1, Number(page) || 1);
  const rows = await db.prepare(`SELECT * FROM audit_log ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, sz, (pg - 1) * sz);
  const users = (await db.prepare('SELECT DISTINCT user_email FROM audit_log ORDER BY user_email').all()).map((r) => r.user_email);
  return { rows, total, page: pg, size: sz, pages: Math.max(1, Math.ceil(total / sz)), types: AUDIT_TYPES, users };
}

export function registerAuditRoutes(app, h, adminOnly) {
  app.get('/api/audit', h((req) => { adminOnly(req); return listAudit(req.query); }));
}
