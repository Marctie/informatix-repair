// Cloudflare Worker del gestionale officina.
//  gestionale.informatixrepair.com  -> gestionale completo, dietro Cloudflare Access + tabella users
//  riparazioni.informatixrepair.com -> solo tracciamento pubblico (nessun login)
import { Hono } from 'hono';
import { useD1 } from './db-d1.mjs';
import { ensureDefaults, ensureOwner } from './dbref.mjs';
import { createAdminApp, createPublicApp, dumpAll } from './app.mjs';
import { accessAuth } from './access.mjs';
import { sendTelegram } from './notify.mjs';
import { notifyDueReminders } from './promemoria.mjs';
import { createPublisher } from './publisher.mjs';
import { r2Media } from './media.mjs';
import { storageDigest } from './remote.mjs';

// Vetrina Usati: pubblicazione su GitHub se c'e' GITHUB_TOKEN (altrimenti bozza); foto nel bucket R2 con binding MEDIA (se manca: errore chiaro)
const adminApp = createAdminApp({
  auth: accessAuth,
  trackBaseFallback: () => globalThis.__PUBLIC_BASE__,
  usati: { publisher: (c) => createPublisher(c.env), media: (c) => r2Media(c.env.MEDIA), siteUrl: (c) => c.env.SITE_URL },
});
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
app.onError(async (err, c) => {
  console.error(err);
  try { c.executionCtx.waitUntil(sendTelegram(c.env, `🔴 <b>ERRORE non gestito</b>
${c.req.method} ${new URL(c.req.url).pathname}
<code>${String(err.message || err).slice(0, 500)}</code>`)); } catch { /* ignora */ }
  return c.json({ ok: false, error: 'Errore interno' }, 500);
});
app.use('*', async (c, next) => { await init(c.env); await next(); });

// Host pubblico: SOLO tracciamento
app.use('*', async (c, next) => {
  if (new URL(c.req.url).hostname !== c.env.PUBLIC_HOST) return next();
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/')) return publicApp.fetch(c.req.raw, c.env, c.executionCtx);
  if (path.startsWith('/t/')) return serveAsset(c.env, c.req.raw, '/track');
  if (path.startsWith('/p/')) return serveAsset(c.env, c.req.raw, '/preventivo');
  if (path === '/track.js' || path === '/sigpad.js' || path === '/preventivo.js') return serveAsset(c.env, c.req.raw, path);
  return c.text('Non trovato', 404);
});

// Host gestionale (e qualunque altro): dietro Access
app.get('/t/:token', (c) => serveAsset(c.env, c.req.raw, '/track'));
app.get('/p/:token', (c) => serveAsset(c.env, c.req.raw, '/preventivo')); // pagina vuota del tracciamento: i dati arrivano da /api/track (pubblico)
app.route('/', publicApp);
app.post('/api/backup/r2', async (c) => {
  // passa dal controllo Access/utenti come tutte le rotte admin
  const gate = new Hono();
  gate.use('*', accessAuth);
  gate.post('*', async (c2) => {
    if (c2.get('user')?.role !== 'admin') return c2.json({ ok: false, error: 'Solo l’amministratore può farlo.' }, 403);
    const key = await saveBackup(c2.env);
    return c2.json(key ? { ok: true, file: key } : { ok: false, error: 'Archivio R2 non collegato.' }, key ? 200 : 503);
  });
  return gate.fetch(c.req.raw, c.env, c.executionCtx);
});
app.route('/', adminApp);
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));

/** Salva una copia JSON nel bucket R2 e tiene le ultime 30. Restituisce il nome del file. */
async function saveBackup(env) {
  if (!env.BACKUPS) return null;
  const dump = await dumpAll();
  const key = `officina-${dump.created_at.replace(' ', '_').replaceAll(':', '-')}.json`;
  await env.BACKUPS.put(key, JSON.stringify(dump), { httpMetadata: { contentType: 'application/json' } });
  const list = await env.BACKUPS.list({ prefix: 'officina-' });
  const old = list.objects.map((o) => o.key).sort().slice(0, -30);
  if (old.length) await env.BACKUPS.delete(old);
  console.log(`Backup salvato: ${key} (${list.objects.length} copie)`);
  return key;
}

export default {
  fetch: app.fetch,
  // Backup giornaliero (cron) nel bucket R2
  async scheduled(event, env) {
    await init(env);
    // ogni minuto: solo i promemoria scaduti (arrivano su Telegram anche a gestionale chiuso); il resto e' del cron notturno
    if (event.cron === '* * * * *') {
      try { await notifyDueReminders(env); } catch (e) { console.error('promemoria', e); }
      return;
    }
    try {
      const key = await saveBackup(env);
      // dispositivi non riparati con la giacenza scaduta: un promemoria al giorno finche' non si decide (smaltire o deposito)
      await sendTelegram(env, await storageDigest().catch(() => null));
      await sendTelegram(env, key ? `💾 <b>Backup notturno completato</b>\n${key}` : '⚠️ <b>Backup notturno non eseguito</b>\nArchivio R2 non collegato.');
    } catch (e) {
      await sendTelegram(env, `🔴 <b>ERRORE nel backup notturno</b>
<code>${String(e.message || e).slice(0, 500)}</code>`);
      throw e;
    }
  },
};
