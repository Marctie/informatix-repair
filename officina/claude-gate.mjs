// Accesso di Claude Code alle Segnalazioni (richieste di Christian), senza passare da Cloudflare Access.
//   /api/claude/tickets...  con  Authorization: Bearer <CLAUDE_TOKEN>
// CLAUDE_TOKEN e' un segreto del Worker (e del file .env locale di Marco, mai su git). Senza segreto o con la chiave
// sbagliata l'indirizzo risponde 404 come se non esistesse. Vale SOLO per le segnalazioni: leggere l'elenco/il report,
// commentare e cambiare lo stato. Le operazioni risultano fatte da Marco (proprietario), quindi passano da Registro e Telegram.
import { sameKey } from './monitor.mjs';

const ALLOWED = [
  ['GET', /^\/api\/tickets(\/report|\/meta)?$/],
  ['GET', /^\/api\/tickets\/\d+(\/report|\/photo\/\d+)?$/],
  ['PUT', /^\/api\/tickets\/\d+$/],
  ['POST', /^\/api\/tickets\/\d+\/comments$/],
];

/** Instrada /api/claude/tickets... verso /api/tickets... dell'app admin creata con `makeApp(user)`. */
export function claudeGate({ env, makeApp }) {
  let app = null;
  return async (c) => {
    const e = env(c);
    const auth = c.req.header('authorization') || '';
    const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!e.CLAUDE_TOKEN || String(e.CLAUDE_TOKEN).length < 32 || !sameKey(key, e.CLAUDE_TOKEN)) return c.text('Non trovato', 404);
    const url = new URL(c.req.url);
    const path = url.pathname.replace(/^\/api\/claude/, '/api');
    const method = c.req.method.toUpperCase();
    if (!ALLOWED.some(([m, re]) => m === method && re.test(path))) return c.json({ ok: false, error: 'Con questa chiave si possono solo leggere e aggiornare le segnalazioni.', code: 'SOLO_SEGNALAZIONI' }, 403);
    app ||= makeApp({ email: String(e.OWNER_EMAIL || 'marco@locale').toLowerCase(), name: 'Marco', role: 'admin' });
    url.pathname = path;
    const headers = new Headers(c.req.raw.headers);
    headers.delete('authorization');
    const body = method === 'GET' ? undefined : await c.req.text();
    let ctx; try { ctx = c.executionCtx; } catch { /* fuori dal Worker (test): nessun contesto */ }
    return app.fetch(new Request(url, { method, headers, body }), c.env, ctx);
  };
}
