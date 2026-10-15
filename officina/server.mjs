// Gestionale Officina Informatix Repair (magazzino, clienti, riparazioni, vendite, fornitori) — avvio sul PC.
// Avvio: npm run officina
//   Gestionale (solo questo PC, nessun login):      http://127.0.0.1:4950
//   Tracciamento cliente (raggiungibile in rete):    http://<IP-del-PC>:4951/t/<codice>
// La versione online (Cloudflare Workers + D1) usa gli stessi file: vedi worker.mjs.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { networkInterfaces, tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { raw } from './db-node.mjs';
import { createAdminApp, createPublicApp } from './app.mjs';
import { localDate } from './logic.mjs';
import { fsMedia } from './media-node.mjs';
import { draftPublisher, createPublisher } from './publisher.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_PORT = Number(process.env.OFFICINA_PORT || 4950);
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 4951);
process.env.PUBLIC_PORT = String(PUBLIC_PORT);

// IP del PC in rete locale: preferisce Wi-Fi/Ethernet reali, scarta schede virtuali (VirtualBox, VMware, WSL, Docker...).
export function lanIp() {
  const cands = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const n of list || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      const virtual = /vbox|virtual|vmware|vethernet|wsl|docker|hyper-v|loopback|bluetooth/i.test(name) || n.address.startsWith('192.168.56.') || n.address.startsWith('169.254.');
      const wifi = /wi-?fi|wlan|wireless/i.test(name);
      cands.push({ address: n.address, score: (virtual ? 0 : 10) + (wifi ? 2 : 0) });
    }
  }
  cands.sort((x, y) => y.score - x.score);
  return cands[0]?.address || 'localhost';
}

const noCache = (c, next) => next().then(() => { c.res.headers.set('Cache-Control', 'no-cache'); });
const trackPage = (c) => c.html(readFileSync(join(HERE, 'public', 'track.html'), 'utf8'));
const quotePage = (c) => c.html(readFileSync(join(HERE, 'public', 'preventivo.html'), 'utf8'));

// `usati` permette ai test di iniettare un publisher finto e un archivio foto in memoria.
// Sul PC la Vetrina Usati resta in bozza: pubblica sul sito solo con OFFICINA_USATI_PUBLISH=github (e GITHUB_TOKEN/GITHUB_REPO).
export function createApps({ usati, auth } = {}) {
  const adminApi = createAdminApp({
    auth,
    usati: usati || {
      publisher: () => (process.env.OFFICINA_USATI_PUBLISH === 'github' ? createPublisher(process.env) : draftPublisher()),
      media: () => fsMedia(process.env.OFFICINA_MEDIA || join(HERE, 'data', 'media')),
      siteUrl: () => process.env.SITE_URL,
    },
    trackBaseFallback: () => process.env.PUBLIC_BASE_URL || `http://${lanIp()}:${PUBLIC_PORT}`,
    // backup SQLite: copia coerente del file, scaricabile dal browser
    backup: async (c) => {
      const file = join(tmpdir(), `officina-backup-${Date.now()}.db`);
      try {
        raw.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
        const buf = readFileSync(file);
        return c.body(buf, 200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="officina-backup-${localDate()}.db"` });
      } finally { rmSync(file, { force: true }); }
    },
  });
  const pubApi = createPublicApp();

  const admin = new Hono();
  admin.use('*', noCache);
  admin.route('/', adminApi);
  admin.route('/', pubApi); // anteprima dello stesso tracciamento
  admin.get('/t/:token', trackPage);
  admin.get('/p/:token', quotePage);
  admin.use('*', serveStatic({ root: relative(process.cwd(), join(HERE, 'public')) || '.' }));

  const pub = new Hono();
  pub.get('/t/:token', trackPage);
  pub.get('/p/:token', quotePage);
  pub.get('/preventivo.js', (c) => c.body(readFileSync(join(HERE, 'public', 'preventivo.js')), 200, { 'content-type': 'text/javascript; charset=utf-8' }));
  pub.get('/track.js', (c) => c.body(readFileSync(join(HERE, 'public', 'track.js')), 200, { 'content-type': 'text/javascript; charset=utf-8' }));
  pub.get('/sigpad.js', (c) => c.body(readFileSync(join(HERE, 'public', 'sigpad.js')), 200, { 'content-type': 'text/javascript; charset=utf-8' }));
  pub.route('/', pubApi);
  pub.notFound((c) => c.text('Non trovato', 404));
  return { admin, pub };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Chiave della cassaforte (documenti d'identita' e password fornitori) sul PC: variabile VAULT_KEY oppure file locale
  // officina/data/vault.key (cartella data/ esclusa da git, mai nel repository). Va conservata a parte: senza non si decifra nulla.
  if (!process.env.VAULT_KEY) {
    const keyFile = join(HERE, 'data', 'vault.key');
    if (!existsSync(keyFile)) { mkdirSync(dirname(keyFile), { recursive: true }); writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600 }); console.log('Creata la chiave della cassaforte in officina/data/vault.key: conservane una copia al sicuro.'); }
    process.env.VAULT_KEY = readFileSync(keyFile, 'utf8').trim();
  }
  const { admin, pub } = createApps();
  serve({ fetch: admin.fetch, port: ADMIN_PORT, hostname: '127.0.0.1' }, () => {
    console.log('\nGestionale Officina Informatix Repair');
    console.log(`--> http://localhost:${ADMIN_PORT}   (solo questo PC)`);
  });
  serve({ fetch: pub.fetch, port: PUBLIC_PORT, hostname: '0.0.0.0' }, () => {
    console.log(`--> Tracciamento clienti: http://${lanIp()}:${PUBLIC_PORT}/t/<codice>   (rete locale)\n`);
  });
}
