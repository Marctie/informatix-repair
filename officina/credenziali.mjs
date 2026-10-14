// Credenziali dei portali dei fornitori (punto 18): solo amministratore, password cifrate (vault.mjs), mai nei log o nelle notifiche.
// La password non esce mai nell'elenco: si ottiene solo con "rivela" (Mostra / Copia), che registra chi e quando.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';
import { encryptText, decryptText, logAccess, vaultReady } from './vault.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);

export const CREDENTIAL_TABLES = ['supplier_credentials'];

/** Solo http/https: l'indirizzo viene aperto con un click, niente "javascript:". */
export function cleanUrl(v) {
  const s = str(v);
  if (!s) return null;
  const u = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let parsed;
  try { parsed = new URL(u); } catch { throw new HttpError(400, 'Indirizzo del sito non valido'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new HttpError(400, 'Indirizzo del sito non valido (solo http o https)');
  return parsed.href;
}

export function registerCredentialRoutes(app, h) {
  const adminOnly = (req) => { if (req.user && req.user.role !== 'admin') throw new HttpError(403, 'Solo l’amministratore può farlo.'); };
  const publicRow = ({ password_enc, ...r }) => ({ ...r, has_password: !!password_enc });

  app.get('/api/credenziali', h(async (req) => {
    adminOnly(req);
    const sid = str(req.query.supplier_id);
    const sql = 'SELECT c.*, s.name AS supplier_name FROM supplier_credentials c JOIN suppliers s ON s.id=c.supplier_id' + (sid ? ' WHERE c.supplier_id = ?' : '') + ' ORDER BY s.name, c.label, c.id';
    const rows = sid ? await db.prepare(sql).all(sid) : await db.prepare(sql).all();
    return { vault_ready: vaultReady(req.c), rows: rows.map(publicRow) };
  }));

  const clean = (b) => {
    const supplier_id = Number(b.supplier_id);
    if (!supplier_id) throw new HttpError(400, 'Scegli il fornitore');
    return { supplier_id, label: str(b.label), url: cleanUrl(b.url), username: str(b.username), agent_name: str(b.agent_name), agent_phone: str(b.agent_phone), notes: str(b.notes) };
  };

  app.post('/api/credenziali', h(async (req) => {
    adminOnly(req);
    const v = clean(req.body);
    if (!(await db.prepare('SELECT id FROM suppliers WHERE id = ?').get(v.supplier_id))) throw new HttpError(404, 'Fornitore non trovato');
    const pw = str(req.body.password);
    const enc = pw ? await encryptText(req.c, pw) : null; // se manca la chiave si ferma qui, prima di scrivere
    const r = await db.prepare(`INSERT INTO supplier_credentials (supplier_id, label, url, username, password_enc, agent_name, agent_phone, notes, pw_changed_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,${NOW},${NOW})`)
      .run(v.supplier_id, v.label, v.url, v.username, enc, v.agent_name, v.agent_phone, v.notes, pw ? (await db.prepare(`SELECT ${NOW} AS t`).get()).t : null);
    await logAccess(db, req.user, 'credenziali', 'creato', Number(r.lastInsertRowid), v.label);
    return publicRow(await db.prepare('SELECT * FROM supplier_credentials WHERE id = ?').get(r.lastInsertRowid));
  }));

  app.put('/api/credenziali/:id', h(async (req) => {
    adminOnly(req);
    const old = await db.prepare('SELECT * FROM supplier_credentials WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Credenziale non trovata');
    const v = clean({ supplier_id: old.supplier_id, ...req.body });
    let enc = old.password_enc;
    let changed = old.pw_changed_at;
    const pw = str(req.body.password);
    if (pw) { enc = await encryptText(req.c, pw); changed = (await db.prepare(`SELECT ${NOW} AS t`).get()).t; }
    else if (req.body.clear_password) { enc = null; changed = null; }
    await db.prepare(`UPDATE supplier_credentials SET label=?, url=?, username=?, password_enc=?, agent_name=?, agent_phone=?, notes=?, pw_changed_at=?, updated_at=${NOW} WHERE id=?`)
      .run(v.label, v.url, v.username, enc, v.agent_name, v.agent_phone, v.notes, changed, old.id);
    await logAccess(db, req.user, 'credenziali', pw ? 'password cambiata' : 'modificato', old.id, v.label);
    return publicRow(await db.prepare('SELECT * FROM supplier_credentials WHERE id = ?').get(old.id));
  }));

  // Mostra / Copia: restituisce la password e registra l'accesso
  app.post('/api/credenziali/:id/rivela', h(async (req) => {
    adminOnly(req);
    const row = await db.prepare('SELECT c.*, s.name AS supplier_name FROM supplier_credentials c JOIN suppliers s ON s.id=c.supplier_id WHERE c.id = ?').get(req.params.id);
    if (!row) throw new HttpError(404, 'Credenziale non trovata');
    if (!row.password_enc) throw new HttpError(404, 'Nessuna password salvata');
    const password = await decryptText(req.c, row.password_enc);
    await logAccess(db, req.user, 'credenziali', req.body.action === 'copia' ? 'copia' : 'mostra', row.id, `${row.supplier_name}${row.label ? ` · ${row.label}` : ''}`);
    return { password };
  }));

  app.delete('/api/credenziali/:id', h(async (req) => {
    adminOnly(req);
    const row = await db.prepare('SELECT id, label FROM supplier_credentials WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError(404, 'Credenziale non trovata');
    await db.prepare('DELETE FROM supplier_credentials WHERE id = ?').run(row.id);
    await logAccess(db, req.user, 'credenziali', 'eliminato', row.id, row.label);
    return { ok: true };
  }));
}
