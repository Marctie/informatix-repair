// Verifica del token di Cloudflare Access (JWT RS256) e ricerca dell'utente nella tabella `users`.
// Access fa entrare "chiunque con codice email"; qui si decide chi può davvero usare il gestionale.
import { db } from './dbref.mjs';

const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64(s)));

let keyCache = { at: 0, keys: [] };
async function getKeys(team) {
  if (Date.now() - keyCache.at < 3600_000 && keyCache.keys.length) return keyCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Certificati Access non raggiungibili');
  keyCache = { at: Date.now(), keys: (await res.json()).keys };
  return keyCache.keys;
}

/** Restituisce il payload del JWT se firma, scadenza, emittente e audience sono corretti; altrimenti null. */
export async function verifyAccessJwt(token, { team, aud }) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    const header = json(h);
    const payload = json(p);
    const jwk = (await getKeys(team)).find((k) => k.kid === header.kid);
    if (!jwk || header.alg !== 'RS256') return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (payload.iss !== `https://${team}`) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Middleware Hono: fallisce SEMPRE in chiusura (nessun accesso se Access non è configurato). */
export const accessAuth = async (c, next) => {
  const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud } = c.env;
  if (!team || !aud) return c.json({ ok: false, error: 'L’accesso protetto non è ancora configurato su questo servizio: non posso verificare chi sei.', code: 'ACCESSO_NON_CONFIGURATO', hint: 'Avvisa Marco: mancano le impostazioni di Cloudflare Access.' }, 503);
  const payload = await verifyAccessJwt(c.req.header('Cf-Access-Jwt-Assertion'), { team, aud });
  if (!payload?.email) return c.json({ ok: false, error: 'La sessione non è valida o è scaduta: non risulta nessun accesso effettuato.', code: 'SESSIONE_NON_VALIDA', hint: 'Ricarica la pagina e accedi di nuovo con la tua email.' }, 401);
  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(payload.email).toLowerCase());
  if (!user) { c.set('denied_email', String(payload.email).toLowerCase()); return c.json({ ok: false, error: 'Questo indirizzo email non è abilitato all’uso del gestionale.', code: 'UTENTE_NON_ABILITATO', hint: 'Chiedi a Christian di aggiungerti in Impostazioni > Utenti.' }, 403); }
  c.set('user', user);
  // nuovo accesso: primo uso dopo 6 ore di inattività
  const last = user.last_seen_at ? Date.parse(String(user.last_seen_at).replace(' ', 'T') + 'Z') : 0;
  if (!last || Date.now() - last > 6 * 3600 * 1000) {
    c.set('login_event', true);
    await db.prepare("UPDATE users SET last_seen_at = datetime('now','localtime') WHERE id = ?").run(user.id);
  }
  await next();
};
