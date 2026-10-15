// Note libere stile Keep, condivise tra tutti gli utenti: colore, fissate in alto, elenchi con caselle da spuntare, archivio, ricerca.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';

const NOW = "datetime('now','localtime')";
export const NOTE_COLORS = { giallo: 'Giallo', rosa: 'Rosa', verde: 'Verde', azzurro: 'Azzurro', viola: 'Viola', arancio: 'Arancio', grigio: 'Grigio', bianco: 'Bianco' };
const str = (v) => (v == null ? null : String(v).trim() || null);

/** Voci con casella: massimo 100, testo non vuoto. */
export function cleanItems(v) {
  if (v == null || v === '') return null;
  const arr = typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { throw new HttpError(400, 'Elenco non valido'); } })() : v;
  if (!Array.isArray(arr)) throw new HttpError(400, 'Elenco non valido');
  const items = arr.slice(0, 100).map((x) => ({ t: String(x?.t ?? '').trim().slice(0, 300), d: x?.d ? 1 : 0 })).filter((x) => x.t);
  return items.length ? JSON.stringify(items) : null;
}
const shape = (n) => { let items = []; try { items = n.items ? JSON.parse(n.items) : []; } catch { /* elenco rovinato: si mostra vuoto */ } return { ...n, pinned: !!n.pinned, archived: !!n.archived, items }; };

export function registerNoteRoutes(app, h) {
  const clean = (b, old = {}) => {
    const title = 'title' in b ? str(b.title) : old.title ?? null;
    const body = 'body' in b ? (String(b.body ?? '').trim() ? String(b.body).trim().slice(0, 20000) : null) : old.body ?? null;
    const items = 'items' in b ? cleanItems(b.items) : old.items ?? null;
    if (!title && !body && !items) throw new HttpError(400, 'La nota è vuota');
    const color = 'color' in b ? (b.color in NOTE_COLORS ? b.color : 'giallo') : old.color || 'giallo';
    return { title: title?.slice(0, 200) ?? null, body, items, color };
  };
  const one = async (id) => {
    const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!n) throw new HttpError(404, 'Nota non trovata');
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
    if (!old) throw new HttpError(404, 'Nota non trovata');
    const v = clean(req.body, old);
    const pinned = 'pinned' in req.body ? (req.body.pinned ? 1 : 0) : old.pinned;
    const archived = 'archived' in req.body ? (req.body.archived ? 1 : 0) : old.archived;
    await db.prepare(`UPDATE notes SET title=?, body=?, items=?, color=?, pinned=?, archived=?, updated_at=${NOW} WHERE id=?`).run(v.title, v.body, v.items, v.color, archived ? 0 : pinned, archived, old.id);
    return one(old.id);
  }));
  app.delete('/api/note/:id', h(async (req) => {
    const r = await db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Nota non trovata');
    return { ok: true };
  }));
}

export const NOTE_TABLES = ['notes'];
