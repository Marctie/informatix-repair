// Cloudflare Worker del gestionale officina.
//  gestionale.informatixrepair.com  -> gestionale completo, dietro Cloudflare Access + tabella users
//  riparazioni.informatixrepair.com -> solo tracciamento pubblico (nessun login)
import { Hono } from 'hono';
import { useD1 } from './db-d1.mjs';
import { ensureDefaults, ensureOwner } from './dbref.mjs';
import { createAdminApp, createPublicApp, dumpAll } from './app.mjs';
import { accessAuth } from './access.mjs';

const adminApp = createAdminApp({ auth: accessAuth, trackBaseFallback: () => globalThis.__PUBLIC_BASE__ });
const publicApp = createPublicApp();

const NO_STORE = { 'Cache-Control': 'no-cache' };
const serveAsset = async (env, request, path) => {
  const url = new URL(request.url);
  url.pathname = path;
  return env.ASSETS.fetch(new Request(url, request));
};

let ready = false;
async function init(env) {
  useD1(env.DB);
  globalThis.__PUBLIC_BASE__ = env.PUBLIC_BASE_URL || '';
  if (ready) return;
  await ensureDefaults();
  await ensureOwner(env.OWNER_EMAIL);
  ready = true;
}

const app = new Hono();
app.use('*', async (c, next) => { await init(c.env); await next(); });

// Host pubblico: SOLO tracciamento
app.use('*', async (c, next) => {
  if (new URL(c.req.url).hostname !== c.env.PUBLIC_HOST) return next();
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/')) return publicApp.fetch(c.req.raw, c.env, c.executionCtx);
  if (path.startsWith('/t/')) return serveAsset(c.env, c.req.raw, '/track.html');
  if (path === '/track.js') return serveAsset(c.env, c.req.raw, '/track.js');
  return c.text('Non trovato', 404);
});

// Host gestionale (e qualunque altro): dietro Access
app.get('/t/:token', (c) => serveAsset(c.env, c.req.raw, '/track.html')); // pagina vuota del tracciamento: i dati arrivano da /api/track (pubblico)
app.route('/', publicApp);
app.route('/', adminApp);
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Backup giornaliero: copia JSON nel bucket R2 (se collegato)
  async scheduled(event, env) {
    await init(env);
    if (!env.BACKUPS) return;
    const dump = await dumpAll();
    await env.BACKUPS.put(`officina-${dump.created_at.slice(0, 10)}.json`, JSON.stringify(dump));
  },
};
