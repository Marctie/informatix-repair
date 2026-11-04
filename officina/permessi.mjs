// Permessi personalizzati per utente (spunto da Fix-Book: "ruoli e permessi personalizzabili").
// Oltre al ruolo (admin / staff / cassa) l'amministratore puo' togliere a un singolo utente intere sezioni.
// Il blocco e' sul SERVER (le API rispondono 403), il menu nasconde le voci. L'amministratore non si limita.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';

export const SECTIONS = {
  magazzino: { label: 'Magazzino e fornitori', re: /^\/api\/(products|stock|suppliers|categories|labels|riordino)(\/|$)/, views: ['magazzino', 'fornitori', 'categorie'] },
  ordini: { label: 'Ordini e materiali', re: /^\/api\/(orders|materiali)(\/|$)/, views: ['ordini', 'materiali'] },
  acquisti: { label: 'Acquisti e fatture fornitori', re: /^\/api\/(purchases|ddt)(\/|$)/, views: ['acquisti'] },
  vendite: { label: 'Vendite e cassa', re: /^\/api\/(sales|closings|garanzie)(\/|$)/, views: ['vendite', 'cassa'] },
  usato: { label: 'Vetrina usati e usato a margine', re: /^\/api\/(usati|margine)(\/|$)/, views: ['usati', 'margine'] },
  preventivi: { label: 'Preventivi', re: /^\/api\/quotes(\/|$)/, views: ['preventivi'] },
  clienti: { label: 'Clienti', re: /^\/api\/customers(\/|$)/, views: ['clienti'] },
  fatture: { label: 'Fatture e dare/avere', re: /^\/api\/(invoices|ledger)(\/|$)/, views: [] },
  spese: { label: 'Spese', re: /^\/api\/expenses(\/|$)/, views: [] },
  buoni: { label: 'Buoni e carte punti', re: /^\/api\/(buoni|carte)(\/|$)/, views: ['buoni', 'carte'] },
  documenti: { label: 'Documenti d’identità e credenziali', re: /^\/api\/(documenti|credenziali)(\/|$)/, views: [] },
  report: { label: 'Analisi, report ed esportazioni', re: /^\/api\/(analytics|report|export|previsioni|tecnici\/stats)(\/|$)/, views: ['analisi'] },
  assistente: { label: 'Assistente', re: /^\/api\/assistant(\/|$)/, views: ['assistente'] },
};

export const parseDeny = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.filter((k) => SECTIONS[k]) : []; } catch { return []; } };

/** Middleware dopo l'accesso: un utente non admin con sezioni negate riceve 403 su quelle API. */
export const permissionsMiddleware = async (c, next) => {
  const u = c.get('user');
  if (!u || u.role === 'admin' || !c.req.path.startsWith('/api/')) return next();
  let deny = u.deny;
  if (deny === undefined && u.email) deny = (await db.prepare('SELECT deny FROM users WHERE email = ?').get(String(u.email).toLowerCase()).catch(() => null))?.deny;
  const list = parseDeny(deny);
  // le schede di riparazione leggono i clienti: la lettura dei clienti resta sempre permessa
  const hit = list.find((k) => SECTIONS[k].re.test(c.req.path) && !(k === 'clienti' && c.req.method === 'GET'));
  if (hit) return c.json({ ok: false, error: `Il tuo utente non ha accesso alla sezione «${SECTIONS[hit].label}».`, code: 'SEZIONE_NON_PERMESSA', hint: 'Chiedi all’amministratore di abilitarla (Gestione → Utenti → Permessi).' }, 403);
  return next();
};

export function registerPermissionRoutes(app, h, adminOnly) {
  app.get('/api/permessi', h(() => ({ sections: Object.entries(SECTIONS).map(([k, s]) => ({ key: k, label: s.label, views: s.views })) })));
  app.get('/api/permessi/miei', h(async (req) => {
    if (!req.user || req.user.role === 'admin') return { deny: [], hidden_views: [] };
    const row = await db.prepare('SELECT deny FROM users WHERE email = ?').get(String(req.user.email || '').toLowerCase());
    const deny = parseDeny(row?.deny);
    return { deny, hidden_views: deny.flatMap((k) => SECTIONS[k].views) };
  }));
  app.put('/api/users/:id{[0-9]+}/permessi', h(async (req) => {
    adminOnly(req);
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new HttpError(404, `Utente n. ${req.params.id} non trovato.`, { code: 'UTENTE_NON_TROVATO', hint: 'Ricarica l’elenco utenti.' });
    if (u.role === 'admin') throw new HttpError(409, 'Un amministratore vede sempre tutto: i permessi si limitano solo a staff e cassa.', { code: 'ADMIN_SENZA_LIMITI', hint: 'Cambia prima il ruolo dell’utente.' });
    const deny = [...new Set((Array.isArray(req.body.deny) ? req.body.deny : []).filter((k) => SECTIONS[k]))];
    await db.prepare('UPDATE users SET deny = ? WHERE id = ?').run(deny.length ? JSON.stringify(deny) : null, u.id);
    return { ...(await db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)), deny_labels: deny.map((k) => SECTIONS[k].label) };
  }));
}
