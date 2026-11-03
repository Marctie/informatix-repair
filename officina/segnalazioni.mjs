// Segnalazioni e richieste: chi usa il gestionale (di solito Christian) apre un task per Marco — errore, miglioria, nuova funzione
// o domanda — con testo, percorso fatto, foto e dati tecnici automatici. Ogni task ha commenti e uno stato; un report completo
// (testo + foto) si scarica in Markdown per essere letto e lavorato. Ogni utente vede le proprie, l'amministratore vede tutte.
import { db } from './dbref.mjs';
import { HttpError } from './errori.mjs';
import { writeAudit } from './audit.mjs';

const NOW = "datetime('now','localtime')";
export const TICKET_KINDS = { errore: 'Qualcosa non funziona', miglioria: 'Da cambiare o migliorare', nuova: 'Funzione nuova da aggiungere', domanda: 'Domanda o dubbio' };
export const TICKET_PRIORITIES = { bassa: 'Bassa', normale: 'Normale', alta: 'Alta', urgente: 'Urgente' };
export const TICKET_STATUSES = { nuova: 'Nuova', in_corso: 'In lavorazione', in_attesa: 'In attesa di risposta', da_verificare: 'Da verificare', risolta: 'Risolta', rifiutata: 'Non si fa' };
const OPEN = ['nuova', 'in_corso', 'in_attesa', 'da_verificare'];
const CLOSED = ['risolta', 'rifiutata'];
export const TICKET_TABLES = ['tickets', 'ticket_comments'];
const MAX_PHOTOS = 6;
const MAX_PHOTO = 1_500_000;

const str = (v, max) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, max) : null; };
export const ticketCode = (id) => `S-${String(id).padStart(4, '0')}`;
const isAdmin = (u) => !u || u.role === 'admin';
const keysOf = (t) => { try { const a = t.photos ? JSON.parse(t.photos) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const b64ToBytes = (s) => Uint8Array.from(atob(String(s).replace(/^data:[^,]*,/, '')), (ch) => ch.charCodeAt(0));
const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const parseJson = (s, dflt) => { try { return s ? JSON.parse(s) : dflt; } catch { return dflt; } };

const shape = (t, extra = {}) => {
  const { photos, context, ...rest } = t;
  return { ...rest, code: ticketCode(t.id), kind_label: TICKET_KINDS[t.kind] || t.kind, priority_label: TICKET_PRIORITIES[t.priority] || t.priority, status_label: TICKET_STATUSES[t.status] || t.status, open: OPEN.includes(t.status), photo_count: keysOf(t).length, context: parseJson(context, {}), ...extra };
};

/** Dati tecnici mandati dal browser: solo testo breve, mai dati sensibili. */
function cleanContext(c) {
  if (!c || typeof c !== 'object') return null;
  const o = {};
  for (const k of ['url', 'ua', 'viewport', 'version', 'language', 'online']) if (c[k] != null) o[k] = String(c[k]).slice(0, 300);
  if (Array.isArray(c.errors)) o.errors = c.errors.slice(-5).map((e) => ({ at: String(e?.at ?? '').slice(0, 40), msg: String(e?.msg ?? '').slice(0, 300) })).filter((e) => e.msg);
  return Object.keys(o).length ? JSON.stringify(o) : null;
}

const notFound = () => new HttpError(404, 'Segnalazione non trovata.', { code: 'SEGNALAZIONE_NON_TROVATA', hint: 'Aggiorna l’elenco: potrebbe essere stata eliminata.' });

export async function ticketAlerts(c) {
  const u = c?.get?.('user');
  if (!u?.email) return [];
  const rows = await db.prepare("SELECT id, title, status FROM tickets WHERE created_by = ? AND status IN ('da_verificare','in_attesa') ORDER BY updated_at DESC LIMIT 20").all(u.email);
  return rows.map((t) => ({
    type: 'ticket', severity: 'medium', ref: t.id, link: `#/segnalazioni?id=${t.id}`,
    title: t.status === 'in_attesa' ? `${ticketCode(t.id)}: serve la tua risposta` : `${ticketCode(t.id)}: da verificare`,
    detail: `${t.title} — ${t.status === 'in_attesa' ? 'ti è stata fatta una domanda' : 'controlla se ora va bene e chiudila'}.`,
  }));
}

export function registerTicketRoutes(app, h, adminOnly, { media } = {}) {
  const arch = (c) => { const m = media?.(c); if (!m || m.mode === 'missing') throw new HttpError(503, 'L’archivio delle foto non è collegato a questo ambiente: le immagini delle segnalazioni non si possono salvare né vedere (il testo sì).', { code: 'ARCHIVIO_FOTO_NON_COLLEGATO', hint: 'Avvisa l’amministratore: serve collegare l’archivio foto.' }); return m; };
  const load = async (id, user) => {
    const t = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!t || (!isAdmin(user) && t.created_by !== user?.email)) throw notFound();
    return t;
  };
  const addComment = (id, kind, body, user) => db.prepare(`INSERT INTO ticket_comments (ticket_id, kind, body, author, author_name, created_at) VALUES (?,?,?,?,?,${NOW})`)
    .run(id, kind, body, user?.email || 'locale', user?.name || null);
  const detail = async (id, user) => {
    const t = await load(id, user);
    const comments = await db.prepare('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY id').all(t.id);
    return shape(t, { comments });
  };
  const checkImages = (list) => {
    if (list == null || list === '') return [];
    if (!Array.isArray(list)) throw new HttpError(400, 'Le foto non sono nel formato atteso.', { code: 'FOTO_NON_VALIDA', hint: 'Ricarica la pagina e riprova.' });
    if (list.length > MAX_PHOTOS) throw new HttpError(409, `Si possono allegare al massimo ${MAX_PHOTOS} immagini.`, { code: 'TROPPE_FOTO', hint: 'Togli qualche immagine e riprova.' });
    return list.map((s) => {
      let bytes;
      try { bytes = b64ToBytes(s || ''); } catch { throw new HttpError(400, 'Un’immagine non è leggibile.', { code: 'FOTO_NON_VALIDA', hint: 'Riprova con un’altra immagine.' }); }
      if (!(bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8)) throw new HttpError(400, 'Un’immagine non è in formato JPEG.', { code: 'FOTO_NON_JPEG', hint: 'Usa foto o schermate in formato JPG/PNG: il browser le converte da solo.' });
      if (bytes.length > MAX_PHOTO) throw new HttpError(413, 'Un’immagine è troppo grande.', { code: 'FOTO_TROPPO_GRANDE', hint: 'Ricarica la pagina e riprova: di solito il browser la riduce da solo.' });
      return bytes;
    });
  };
  const keyFor = (id) => `ticket/${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  const clean = (b, old = {}) => {
    const kind = 'kind' in b ? b.kind : old.kind || 'errore';
    if (!(kind in TICKET_KINDS)) throw new HttpError(400, 'Scegli di che tipo di segnalazione si tratta.', { code: 'TIPO_NON_VALIDO', hint: 'Scegli tra: qualcosa non funziona, da cambiare, funzione nuova, domanda.' });
    const title = 'title' in b ? str(b.title, 200) : old.title;
    if (!title) throw new HttpError(400, 'Scrivi un titolo breve: in poche parole, di cosa si tratta.', { code: 'TITOLO_MANCANTE', hint: 'Esempio: «Il prezzo del preventivo non si salva».' });
    const description = 'description' in b ? str(b.description, 10000) : old.description;
    if (!description) throw new HttpError(400, 'Descrivi cosa succede o cosa ti serve.', { code: 'DESCRIZIONE_MANCANTE', hint: 'Più dettagli scrivi, più in fretta posso intervenire.' });
    const priority = 'priority' in b ? b.priority : old.priority || 'normale';
    if (!(priority in TICKET_PRIORITIES)) throw new HttpError(400, 'La priorità scelta non è valida.', { code: 'PRIORITA_NON_VALIDA', hint: 'Scegli: bassa, normale, alta o urgente.' });
    return {
      kind, title, description, priority,
      page: 'page' in b ? str(b.page, 80) : old.page ?? null,
      path_text: 'path_text' in b ? str(b.path_text, 3000) : old.path_text ?? null,
      expected: 'expected' in b ? str(b.expected, 5000) : old.expected ?? null,
    };
  };

  app.get('/api/tickets/meta', h(() => ({ kinds: TICKET_KINDS, priorities: TICKET_PRIORITIES, statuses: TICKET_STATUSES, open: OPEN, closed: CLOSED })));

  app.get('/api/tickets', h(async (req) => {
    const where = [];
    const args = [];
    if (!isAdmin(req.user)) { where.push('created_by = ?'); args.push(req.user.email); }
    const s = req.query.stato || 'aperte';
    if (s === 'aperte') where.push(`status IN (${OPEN.map(() => '?').join(',')})`), args.push(...OPEN);
    else if (s === 'chiuse') where.push(`status IN (${CLOSED.map(() => '?').join(',')})`), args.push(...CLOSED);
    else if (s in TICKET_STATUSES) where.push('status = ?'), args.push(s);
    if (req.query.tipo in TICKET_KINDS) where.push('kind = ?'), args.push(req.query.tipo);
    const q = str(req.query.q, 100);
    if (q) { where.push('(title LIKE ? OR description LIKE ? OR path_text LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const rank = "CASE priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END";
    const rows = await db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id AND c.kind = 'commento') AS comment_count FROM tickets t ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${s === 'chiuse' ? 'closed_at DESC' : `${rank}, updated_at DESC`}, id DESC LIMIT 300`).all(...args);
    const mine = isAdmin(req.user) ? '' : ' WHERE created_by = ?';
    const counts = await db.prepare(`SELECT status, COUNT(*) AS n FROM tickets${mine} GROUP BY status`).all(...(mine ? [req.user.email] : []));
    const by = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    return { rows: rows.map((t) => shape(t, { comment_count: t.comment_count })), counts: by, open: OPEN.reduce((n, k) => n + (by[k] || 0), 0), closed: CLOSED.reduce((n, k) => n + (by[k] || 0), 0) };
  }));

  app.post('/api/tickets', h(async (req) => {
    const v = clean(req.body);
    const images = checkImages(req.body.images);
    const m = images.length ? arch(req.c) : null;
    const u = req.user;
    const r = await db.prepare(`INSERT INTO tickets (kind, title, description, page, path_text, expected, priority, status, context, created_by, created_by_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,'nuova',?,?,?,${NOW},${NOW})`)
      .run(v.kind, v.title, v.description, v.page, v.path_text, v.expected, v.priority, cleanContext(req.body.context), u?.email || 'locale', u?.name || null);
    const id = Number(r.lastInsertRowid);
    if (images.length) {
      const keys = [];
      try {
        for (const bytes of images) { const k = keyFor(id); await m.put(k, bytes); keys.push(k); }
      } catch (e) {
        for (const k of keys) await m.remove(k).catch(() => {});
        await db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
        throw e;
      }
      await db.prepare('UPDATE tickets SET photos = ? WHERE id = ?').run(JSON.stringify(keys), id);
    }
    return detail(id, u);
  }));

  // Report in Markdown (con le immagini incorporate se foto=1): per leggere e lavorare la segnalazione senza aprire il gestionale.
  const report = async (t, comments, withPhotos, c) => {
    const L = [];
    const ctx = parseJson(t.context, {});
    L.push(`# ${ticketCode(t.id)} · ${t.title}`, '');
    L.push(`- **Tipo**: ${TICKET_KINDS[t.kind] || t.kind}`, `- **Priorità**: ${TICKET_PRIORITIES[t.priority] || t.priority}`, `- **Stato**: ${TICKET_STATUSES[t.status] || t.status}`);
    L.push(`- **Aperta da**: ${t.created_by_name ? `${t.created_by_name} (${t.created_by})` : t.created_by} il ${t.created_at}`);
    if (t.closed_at) L.push(`- **Chiusa il**: ${t.closed_at}`);
    if (t.page) L.push(`- **Sezione del gestionale**: ${t.page}`);
    L.push('', t.kind === 'nuova' ? '## Cosa serve (funzione nuova)' : t.kind === 'domanda' ? '## La domanda' : '## Cosa succede', '', t.description);
    if (t.path_text) L.push('', '## Percorso fatto (come ci è arrivato)', '', t.path_text);
    if (t.expected) L.push('', t.kind === 'nuova' ? '## Come lo vorrebbe' : '## Come dovrebbe funzionare', '', t.expected);
    if (Object.keys(ctx).length) {
      L.push('', '## Dati tecnici (automatici)', '');
      if (ctx.url) L.push(`- Pagina: ${ctx.url}`);
      if (ctx.viewport) L.push(`- Schermo: ${ctx.viewport}`);
      if (ctx.ua) L.push(`- Browser: ${ctx.ua}`);
      if (ctx.version) L.push(`- Versione: ${ctx.version}`);
      if (ctx.errors?.length) { L.push('- Errori comparsi poco prima:'); for (const e of ctx.errors) L.push(`  - ${e.at ? `${e.at} · ` : ''}${e.msg}`); }
    }
    const keys = keysOf(t);
    if (keys.length) {
      L.push('', `## Immagini allegate (${keys.length})`, '');
      for (let i = 0; i < keys.length; i++) {
        let line = `- Immagine ${i + 1}: /api/tickets/${t.id}/photo/${i}`;
        if (withPhotos) {
          const o = await arch(c).get(keys[i]).catch(() => null);
          if (o) line = `- Immagine ${i + 1}:\n\n  ![Immagine ${i + 1}](data:${o.contentType};base64,${toB64(o.bytes)})`;
        }
        L.push(line);
      }
    }
    if (comments.length) { L.push('', '## Cronologia', ''); for (const m of comments) L.push(`- ${m.created_at} · ${m.author_name || m.author}${m.kind === 'stato' ? ' (stato)' : ''}: ${m.body.replace(/\n/g, '\n  ')}`); }
    return L.join('\n');
  };
  app.get('/api/tickets/report', h(async (req) => {
    adminOnly(req);
    const s = req.query.stato || 'aperte';
    const list = s === 'tutte' ? null : s === 'chiuse' ? CLOSED : s in TICKET_STATUSES ? [s] : OPEN;
    const rows = await db.prepare(`SELECT * FROM tickets ${list ? `WHERE status IN (${list.map(() => '?').join(',')})` : ''} ORDER BY id`).all(...(list || []));
    const parts = [];
    for (const t of rows) parts.push(await report(t, await db.prepare('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY id').all(t.id), req.query.foto === '1', req.c));
    const stamp = new Date().toISOString().slice(0, 10);
    return { filename: `segnalazioni-${s}-${stamp}.md`, count: rows.length, markdown: `# Segnalazioni (${s}) · ${stamp} · ${rows.length}\n\n${parts.join('\n\n---\n\n') || 'Nessuna segnalazione.'}\n` };
  }));
  app.get('/api/tickets/:id{[0-9]+}/report', h(async (req) => {
    const t = await load(req.params.id, req.user);
    const comments = await db.prepare('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY id').all(t.id);
    return { filename: `${ticketCode(t.id)}.md`, markdown: `${await report(t, comments, req.query.foto === '1', req.c)}\n` };
  }));

  app.get('/api/tickets/:id{[0-9]+}', h((req) => detail(req.params.id, req.user)));

  app.put('/api/tickets/:id{[0-9]+}', h(async (req) => {
    const old = await load(req.params.id, req.user);
    const b = req.body;
    const admin = isAdmin(req.user);
    if (!admin && old.status !== 'nuova') throw new HttpError(409, 'Questa segnalazione è già stata presa in carico: non si può più modificare.', { code: 'SEGNALAZIONE_IN_CARICO', hint: 'Aggiungi un commento per dire cosa è cambiato.' });
    const v = clean(b, old);
    let status = old.status;
    if (admin && 'status' in b && b.status !== old.status) {
      if (!(b.status in TICKET_STATUSES)) throw new HttpError(400, 'Lo stato scelto non è valido.', { code: 'STATO_NON_VALIDO', hint: 'Scegli uno stato dall’elenco.' });
      status = b.status;
    }
    await db.prepare(`UPDATE tickets SET kind=?, title=?, description=?, page=?, path_text=?, expected=?, priority=?, status=?, closed_at=${CLOSED.includes(status) ? `COALESCE(closed_at, ${NOW})` : 'NULL'}, updated_at=${NOW} WHERE id=?`)
      .run(v.kind, v.title, v.description, v.page, v.path_text, v.expected, v.priority, status, old.id);
    if (status !== old.status) {
      await addComment(old.id, 'stato', `${TICKET_STATUSES[old.status]} → ${TICKET_STATUSES[status]}`, req.user);
      await writeAudit({ user: req.user, action: 'modifica', type: 'richiesta', id: old.id, label: `${ticketCode(old.id)} · ${old.title}`, detail: `stato: ${TICKET_STATUSES[old.status]} → ${TICKET_STATUSES[status]}` });
    }
    const note = str(b.note, 5000);
    if (admin && note) await addComment(old.id, 'commento', note, req.user);
    return { ...(await detail(old.id, req.user)), prev_status: old.status, note: note || null };
  }));

  app.post('/api/tickets/:id{[0-9]+}/comments', h(async (req) => {
    const t = await load(req.params.id, req.user);
    const body = str(req.body.body, 5000);
    if (!body) throw new HttpError(400, 'Scrivi il commento prima di inviarlo.', { code: 'COMMENTO_VUOTO', hint: 'Il commento non può essere vuoto.' });
    await addComment(t.id, 'commento', body, req.user);
    // chi ha aperto la segnalazione risponde a una domanda: torna "nuova" perché venga ripresa
    let reopened = false;
    if (t.status === 'in_attesa' && t.created_by === (req.user?.email || 'locale')) {
      await db.prepare(`UPDATE tickets SET status = 'nuova', updated_at = ${NOW} WHERE id = ?`).run(t.id);
      await addComment(t.id, 'stato', `${TICKET_STATUSES.in_attesa} → ${TICKET_STATUSES.nuova}`, req.user);
      reopened = true;
    } else await db.prepare(`UPDATE tickets SET updated_at = ${NOW} WHERE id = ?`).run(t.id);
    return { ...(await detail(t.id, req.user)), reopened, comment: body };
  }));

  app.post('/api/tickets/:id{[0-9]+}/photo', h(async (req) => {
    const t = await load(req.params.id, req.user);
    const keys = keysOf(t);
    if (keys.length >= MAX_PHOTOS) throw new HttpError(409, `La segnalazione ha già ${MAX_PHOTOS} immagini: è il massimo.`, { code: 'TROPPE_FOTO', hint: 'Togli un’immagine prima di aggiungerne un’altra.' });
    const [bytes] = checkImages([req.body.image]);
    const k = keyFor(t.id);
    await arch(req.c).put(k, bytes);
    await db.prepare(`UPDATE tickets SET photos = ?, updated_at = ${NOW} WHERE id = ?`).run(JSON.stringify([...keys, k]), t.id);
    return detail(t.id, req.user);
  }));
  app.delete('/api/tickets/:id{[0-9]+}/photo/:i{[0-9]+}', h(async (req) => {
    const t = await load(req.params.id, req.user);
    const keys = keysOf(t);
    const i = Number(req.params.i);
    if (!keys[i]) throw new HttpError(404, 'Immagine non trovata nella segnalazione.', { code: 'FOTO_NON_TROVATA', hint: 'Aggiorna la segnalazione: potrebbe essere già stata tolta.' });
    await arch(req.c).remove(keys[i]).catch(() => {});
    keys.splice(i, 1);
    await db.prepare(`UPDATE tickets SET photos = ?, updated_at = ${NOW} WHERE id = ?`).run(keys.length ? JSON.stringify(keys) : null, t.id);
    return detail(t.id, req.user);
  }));
  app.get('/api/tickets/:id{[0-9]+}/photo/:i{[0-9]+}', async (c) => {
    try {
      const t = await load(c.req.param('id'), c.get('user'));
      const key = keysOf(t)[Number(c.req.param('i'))];
      const o = key && (await arch(c).get(key));
      if (!o) return c.text('Immagine non trovata', 404);
      return c.body(o.bytes, 200, { 'content-type': o.contentType, 'cache-control': 'private, max-age=600' });
    } catch (e) { return c.text(e.message || 'Errore', e.status || 500); }
  });

  app.delete('/api/tickets/:id{[0-9]+}', h(async (req) => {
    adminOnly(req);
    const t = await load(req.params.id, req.user);
    for (const k of keysOf(t)) await media?.(req.c)?.remove?.(k)?.catch?.(() => {});
    await db.prepare('DELETE FROM ticket_comments WHERE ticket_id = ?').run(t.id);
    await db.prepare('DELETE FROM tickets WHERE id = ?').run(t.id);
    await writeAudit({ user: req.user, action: 'elimina', type: 'richiesta', id: t.id, label: `${ticketCode(t.id)} · ${t.title}` });
    return { ok: true, code: ticketCode(t.id), title: t.title };
  }));
}
