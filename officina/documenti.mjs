// Documenti d'identita' dei clienti (punto 17). Dati sensibili: SEMPRE cifrati a riposo (vault.mjs), accesso solo admin
// (e, se l'admin lo abilita, altri ruoli), ogni accesso e' registrato, cancellazione con doppia conferma, nessuna notifica con i contenuti.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';
import { encryptText, decryptText, encryptJson, decryptJson, logAccess, vaultReady } from './vault.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);

export const DOC_TYPES = { carta_identita: 'Carta d’identità', patente: 'Patente', passaporto: 'Passaporto', altro: 'Altro documento' };
export const PURPOSES = { acquisto_usato: 'Acquisto di un usato dal cliente', ritiro: 'Ritiro / consegna', denuncia: 'Tutela in caso di denuncia o querela', altro: 'Altro' };
const MAX_FILE = 1_000_000; // byte per immagine (le foto si ridimensionano nel browser): resta sotto il limite di riga di D1
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ROLES_ALLOWED = ['cassa', 'staff'];

export const DOCUMENT_TABLES = ['id_documents', 'id_document_files', 'sensitive_access_log'];

export function registerDocumentRoutes(app, h) {
  const rolesSetting = async () => {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'id_docs_roles'").get();
    return String(row?.value || '').split(',').map((x) => x.trim()).filter((x) => ROLES_ALLOWED.includes(x));
  };
  const isAdmin = (req) => !req.user || req.user.role === 'admin';
  // Admin sempre; gli altri ruoli solo se l'admin li ha abilitati (impostazione prudente: nessuno)
  const gate = async (req) => {
    if (isAdmin(req)) return;
    if (!(await rolesSetting()).includes(req.user.role)) throw new HttpError(403, 'Non hai il permesso di vedere i documenti d’identità.');
  };
  const adminOnly = (req) => { if (!isAdmin(req)) throw new HttpError(403, 'Solo l’amministratore può farlo.'); };
  const who = (req) => req.user?.email || 'locale';

  app.get('/api/documenti/config', h(async (req) => {
    const roles = await rolesSetting();
    const allowed = isAdmin(req) || roles.includes(req.user.role);
    return { allowed, vault_ready: vaultReady(req.c), roles, doc_types: DOC_TYPES, purposes: PURPOSES, is_admin: isAdmin(req) };
  }));
  app.put('/api/documenti/config', h(async (req) => {
    adminOnly(req);
    const roles = (Array.isArray(req.body.roles) ? req.body.roles : []).filter((x) => ROLES_ALLOWED.includes(x));
    await db.prepare("INSERT INTO settings (key,value) VALUES ('id_docs_roles',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(roles.join(','));
    await logAccess(db, req.user, 'documenti', 'permessi', null, `ruoli abilitati: ${roles.join(', ') || 'nessuno'}`);
    return { roles };
  }));

  // Registro accessi (documenti e credenziali), solo admin
  app.get('/api/accessi', h(async (req) => {
    adminOnly(req);
    const area = str(req.query.area);
    return area ? db.prepare('SELECT * FROM sensitive_access_log WHERE area = ? ORDER BY id DESC LIMIT 300').all(area) : db.prepare('SELECT * FROM sensitive_access_log ORDER BY id DESC LIMIT 300').all();
  }));

  // Elenco documenti di un cliente: solo metadati, nessun dato in chiaro
  app.get('/api/clienti/:id/documenti', h(async (req) => {
    await gate(req);
    const rows = await db.prepare(`SELECT d.id, d.customer_id, d.doc_type, d.purpose, d.consent, d.consent_at, d.captured_by, d.created_at,
      (SELECT COUNT(*) FROM id_document_files f WHERE f.document_id = d.id) AS files FROM id_documents d WHERE d.customer_id = ? ORDER BY d.id DESC`).all(req.params.id);
    await logAccess(db, req.user, 'documenti', 'elenco', Number(req.params.id), 'elenco documenti del cliente');
    return rows.map((r) => ({ ...r, type_label: DOC_TYPES[r.doc_type], purpose_label: PURPOSES[r.purpose] || r.purpose }));
  }));

  // Immagine / PDF decifrato (non si mette in cache)
  app.get('/api/documenti/files/:fileId', async (c) => {
    try {
      const req = { user: c.get('user') };
      await gate(req);
      const f = await db.prepare('SELECT * FROM id_document_files WHERE id = ?').get(c.req.param('fileId'));
      if (!f) throw new HttpError(404, 'File non trovato');
      const bytes = await decryptText(c, f.file_enc, { bytes: true });
      await logAccess(db, req.user, 'documenti', 'file', f.document_id, `${f.side}`);
      return c.body(bytes, 200, { 'content-type': f.mime || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    } catch (e) { return c.json({ ok: false, error: e.status ? e.message : 'Errore interno' }, e.status || 500); }
  });

  app.get('/api/documenti/:id', h(async (req) => {
    await gate(req);
    const d = await db.prepare('SELECT d.*, c.name AS customer_name FROM id_documents d JOIN customers c ON c.id=d.customer_id WHERE d.id = ?').get(req.params.id);
    if (!d) throw new HttpError(404, 'Documento non trovato');
    const data = await decryptJson(req.c, d.data_enc);
    await logAccess(db, req.user, 'documenti', 'visione', d.id, d.customer_name);
    const files = await db.prepare('SELECT id, side, mime FROM id_document_files WHERE document_id = ? ORDER BY id').all(d.id);
    const { data_enc, ...meta } = d;
    return { ...meta, type_label: DOC_TYPES[d.doc_type], purpose_label: PURPOSES[d.purpose] || d.purpose, data, files };
  }));

  app.post('/api/documenti', h(async (req) => {
    await gate(req);
    const b = req.body;
    const cust = await db.prepare('SELECT id, name FROM customers WHERE id = ?').get(b.customer_id);
    if (!cust) throw new HttpError(404, 'Cliente non trovato');
    if (!b.consent) throw new HttpError(400, 'Serve la presa visione dell’informativa privacy da parte del cliente.');
    const docType = b.doc_type in DOC_TYPES ? b.doc_type : 'carta_identita';
    const purpose = b.purpose in PURPOSES ? b.purpose : null;
    const files = Array.isArray(b.files) ? b.files.slice(0, 4) : [];
    const prepared = [];
    for (const f of files) {
      const mime = String(f.mime || '');
      if (!MIMES.includes(mime)) throw new HttpError(400, 'Formato non ammesso: usa una foto (JPG, PNG, WebP) o un PDF.');
      let bytes;
      try { bytes = Uint8Array.from(atob(String(f.data_b64 || '')), (ch) => ch.charCodeAt(0)); } catch { throw new HttpError(400, 'File non leggibile'); }
      if (!bytes.length) throw new HttpError(400, 'File vuoto');
      if (bytes.length > MAX_FILE) throw new HttpError(400, 'File troppo grande (massimo 1 MB): usa una foto più piccola.');
      prepared.push({ side: f.side === 'retro' ? 'retro' : 'fronte', mime, enc: await encryptText(req.c, bytes) });
    }
    const dt = b.data || {};
    const data = { holder: str(dt.holder), number: str(dt.number), birth_date: str(dt.birth_date), issuer: str(dt.issuer), expiry: str(dt.expiry), notes: str(dt.notes) };
    if (!data.number && !prepared.length) throw new HttpError(400, 'Inserisci almeno il numero del documento o una foto.');
    const r = await db.prepare(`INSERT INTO id_documents (customer_id, doc_type, purpose, data_enc, consent, consent_at, captured_by, created_at) VALUES (?,?,?,?,1,${NOW},?,${NOW})`)
      .run(cust.id, docType, purpose, await encryptJson(req.c, data), who(req));
    const id = Number(r.lastInsertRowid);
    for (const f of prepared) await db.prepare('INSERT INTO id_document_files (document_id, side, mime, file_enc) VALUES (?,?,?,?)').run(id, f.side, f.mime, f.enc);
    await logAccess(db, req.user, 'documenti', 'creato', id, cust.name);
    return { id, customer_id: cust.id, doc_type: docType, files: prepared.length };
  }));

  // Cancellazione definitiva: solo admin, con conferma esplicita (la finestra "doppia conferma" manda ?confirm=ELIMINA)
  app.delete('/api/documenti/:id', h(async (req) => {
    adminOnly(req);
    if (req.query.confirm !== 'ELIMINA') throw new HttpError(400, 'Cancellazione non confermata.');
    const d = await db.prepare('SELECT id, customer_id FROM id_documents WHERE id = ?').get(req.params.id);
    if (!d) throw new HttpError(404, 'Documento non trovato');
    await db.prepare('DELETE FROM id_document_files WHERE document_id = ?').run(d.id);
    await db.prepare('DELETE FROM id_documents WHERE id = ?').run(d.id);
    await logAccess(db, req.user, 'documenti', 'eliminato', d.id, `cliente ${d.customer_id}`);
    return { ok: true };
  }));
}
