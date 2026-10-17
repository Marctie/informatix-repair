// Note libere stile Keep, condivise tra tutti gli utenti: colore, fissate in alto, elenchi con caselle da spuntare, archivio, ricerca.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';

const NOW = "datetime('now','localtime')";
export const NOTE_COLORS = { giallo: 'Giallo', rosa: 'Rosa', verde: 'Verde', azzurro: 'Azzurro', viola: 'Viola', arancio: 'Arancio', grigio: 'Grigio', bianco: 'Bianco' };
const str = (v) => (v == null ? null : String(v).trim() || null);

/** Voci con casella: massimo 100, testo non vuoto. */
export function cleanItems(v) {
  if (v == null || v === '') return null;
  const arr = typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { throw new HttpError(400, 'La lista della nota non è valida: non è nel formato atteso.', { code: 'ELENCO_NON_VALIDO', hint: 'Ricarica la pagina e riscrivi la lista.' }); } })() : v;
  if (!Array.isArray(arr)) throw new HttpError(400, 'La lista della nota non è valida: non è nel formato atteso.', { code: 'ELENCO_NON_VALIDO', hint: 'Ricarica la pagina e riscrivi la lista.' });
  const items = arr.slice(0, 100).map((x) => ({ t: String(x?.t ?? '').trim().slice(0, 300), d: x?.d ? 1 : 0 })).filter((x) => x.t);
  return items.length ? JSON.stringify(items) : null;
}
const keysOf = (n) => { try { const a = n.photos ? JSON.parse(n.photos) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const shape = (n) => { let items = []; try { items = n.items ? JSON.parse(n.items) : []; } catch { /* elenco rovinato: si mostra vuoto */ } const { photos, ...rest } = n; return { ...rest, pinned: !!n.pinned, archived: !!n.archived, items, photo_count: keysOf(n).length }; };
const MAX_PHOTOS = 6;
const MAX_PHOTO = 1_500_000;
const b64ToBytes = (s) => Uint8Array.from(atob(String(s).replace(/^data:[^,]*,/, '')), (ch) => ch.charCodeAt(0));

export function registerNoteRoutes(app, h, { media } = {}) {
  const arch = (c) => { const m = media?.(c); if (!m || m.mode === 'missing') throw new HttpError(503, 'L’archivio delle foto non è collegato a questo ambiente: le foto delle note non si possono salvare né vedere (le note invece sì).', { code: 'ARCHIVIO_FOTO_NON_COLLEGATO', hint: 'Avvisa l’amministratore: serve collegare l’archivio foto.' }); return m; };
  const clean = (b, old = {}) => {
    const title = 'title' in b ? str(b.title) : old.title ?? null;
    const body = 'body' in b ? (String(b.body ?? '').trim() ? String(b.body).trim().slice(0, 20000) : null) : old.body ?? null;
    const items = 'items' in b ? cleanItems(b.items) : old.items ?? null;
    if (!title && !body && !items && !keysOf(old).length) throw new HttpError(400, 'Nota non salvata: non ha titolo, testo né voci.', { code: 'NOTA_VUOTA', hint: 'Scrivi almeno il titolo o il testo.' });
    const color = 'color' in b ? (b.color in NOTE_COLORS ? b.color : 'giallo') : old.color || 'giallo';
    return { title: title?.slice(0, 200) ?? null, body, items, color };
  };
  const one = async (id) => {
    const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!n) throw new HttpError(404, 'Nota non trovata', { code: 'NOTA_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });
    return shape(n);
  };

  app.get('/api/note/meta', h(() => ({ colors: NOTE_COLORS })));
  app.get('/api/note', h(async (req) => {
    const where = [req.query.archivio === '1' ? 'archived = 1' : 'archived = 0'];
    const args = [];
    if (req.query.color && req.query.color in NOTE_COLORS) { where.push('color = ?'); args.push(req.query.color); }
    const q = str(req.query.q);
    if (q) { where.push('(title LIKE ? OR body LIKE ? OR items LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const rows = await db.prepare(`SELECT * FROM notes WHERE ${where.join(' AND ')} ORDER BY pinned DESC, updated_at DESC, id DESC LIMIT 500`).all(...args);
    const archived = (await db.prepare('SELECT COUNT(*) AS n FROM notes WHERE archived = 1').get()).n;
    return { rows: rows.map(shape), archived };
  }));
  app.get('/api/note/:id', h((req) => one(req.params.id)));
  app.post('/api/note', h(async (req) => {
    const v = clean(req.body);
    const r = await db.prepare(`INSERT INTO notes (title, body, items, color, pinned, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,${NOW},${NOW})`)
      .run(v.title, v.body, v.items, v.color, req.body.pinned ? 1 : 0, req.user?.email || 'locale');
    return one(r.lastInsertRowid);
  }));
  app.put('/api/note/:id', h(async (req) => {
    const old = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Nota non trovata', { code: 'NOTA_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });
    const v = clean(req.body, old);
    const pinned = 'pinned' in req.body ? (req.body.pinned ? 1 : 0) : old.pinned;
    const archived = 'archived' in req.body ? (req.body.archived ? 1 : 0) : old.archived;
    await db.prepare(`UPDATE notes SET title=?, body=?, items=?, color=?, pinned=?, archived=?, updated_at=${NOW} WHERE id=?`).run(v.title, v.body, v.items, v.color, archived ? 0 : pinned, archived, old.id);
    return one(old.id);
  }));
  // Foto della nota (fino a 6, JPEG ridimensionato dal browser)
  app.post('/api/note/:id{[0-9]+}/photo', h(async (req) => {
    const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!n) throw new HttpError(404, 'Nota non trovata', { code: 'NOTA_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });
    const keys = keysOf(n);
    if (keys.length >= MAX_PHOTOS) throw new HttpError(409, `La nota ha già ${MAX_PHOTOS} foto: è il massimo.`, { code: 'TROPPE_FOTO', hint: 'Togli una foto prima di aggiungerne un’altra.' });
    let bytes;
    try { bytes = b64ToBytes(req.body.image || ''); } catch { throw new HttpError(400, 'La foto non è leggibile.', { code: 'FOTO_NON_VALIDA', hint: 'Scatta di nuovo la foto e riprova.' }); }
    if (!(bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8)) throw new HttpError(400, 'La foto non è un file JPEG.', { code: 'FOTO_NON_JPEG', hint: 'Usa una foto in formato JPG.' });
    if (bytes.length > MAX_PHOTO) throw new HttpError(413, 'La foto è troppo grande.', { code: 'FOTO_TROPPO_GRANDE', hint: 'Di solito il browser la ridimensiona da solo: ricarica la pagina e riprova.' });
    const key = `note/${n.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    await arch(req.c).put(key, bytes);
    await db.prepare(`UPDATE notes SET photos = ?, updated_at = ${NOW} WHERE id = ?`).run(JSON.stringify([...keys, key]), n.id);
    return one(n.id);
  }));
  app.delete('/api/note/:id{[0-9]+}/photo/:i{[0-9]+}', h(async (req) => {
    const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!n) throw new HttpError(404, 'Nota non trovata', { code: 'NOTA_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });
    const keys = keysOf(n);
    const i = Number(req.params.i);
    if (!keys[i]) throw new HttpError(404, 'Foto non trovata nella nota.', { code: 'FOTO_NON_TROVATA', hint: 'Aggiorna la nota: potrebbe essere già stata tolta.' });
    await arch(req.c).remove(keys[i]).catch(() => {});
    keys.splice(i, 1);
    await db.prepare(`UPDATE notes SET photos = ?, updated_at = ${NOW} WHERE id = ?`).run(keys.length ? JSON.stringify(keys) : null, n.id);
    return one(n.id);
  }));
  app.get('/api/note/:id{[0-9]+}/photo/:i{[0-9]+}', async (c) => {
    try {
      const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(c.req.param('id'));
      const key = n && keysOf(n)[Number(c.req.param('i'))];
      if (!key) return c.text('Foto non trovata', 404);
      const o = await arch(c).get(key);
      if (!o) return c.text('Foto non trovata', 404);
      return c.body(o.bytes, 200, { 'content-type': o.contentType, 'cache-control': 'private, max-age=600' });
    } catch (e) { return c.text(e.message || 'Errore', e.status || 500); }
  });
  app.delete('/api/note/:id', h(async (req) => {
    const old = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (old) for (const k of keysOf(old)) await media?.(req.c)?.remove?.(k)?.catch?.(() => {});
    const r = await db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Nota non trovata', { code: 'NOTA_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });
    return { ok: true };
  }));
}

export const NOTE_TABLES = ['notes'];
