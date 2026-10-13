// Gestionale Officina Informatix Repair (magazzino, clienti, riparazioni, vendite, fornitori).
// Avvio: npm run officina
//   Gestionale (solo questo PC, nessun login per ora):  http://127.0.0.1:4950
//   Tracciamento cliente (raggiungibile in rete):        http://<IP-del-PC>:4951/t/<codice>
import express from 'express';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { adminRouter, publicRouter } from './api.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_PORT = Number(process.env.OFFICINA_PORT || 4950);
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 4951);
process.env.PUBLIC_PORT = String(PUBLIC_PORT);

export function lanIp() {
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) return n.address;
  }
  return 'localhost';
}

export function createApps() {
  // --- Admin: solo localhost ---
  const admin = express();
  admin.use(express.static(join(HERE, 'public')));
  admin.use(adminRouter);
  admin.use(publicRouter); // anteprima dello stesso tracciamento
  admin.get('/t/:token', (req, res) => res.sendFile(join(HERE, 'public', 'track.html')));

  // --- Pubblico: solo tracciamento ---
  const pub = express();
  pub.disable('x-powered-by');
  pub.get('/t/:token', (req, res) => res.sendFile(join(HERE, 'public', 'track.html')));
  pub.get('/track.js', (req, res) => res.sendFile(join(HERE, 'public', 'track.js')));
  pub.use(publicRouter);
  pub.use((req, res) => res.status(404).type('text').send('Non trovato'));
  return { admin, pub };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { admin, pub } = createApps();
  admin.listen(ADMIN_PORT, '127.0.0.1', () => {
    console.log('\nGestionale Officina Informatix Repair');
    console.log(`--> http://localhost:${ADMIN_PORT}   (solo questo PC)`);
  });
  pub.listen(PUBLIC_PORT, '0.0.0.0', () => {
    console.log(`--> Tracciamento clienti: http://${lanIp()}:${PUBLIC_PORT}/t/<codice>   (rete locale)\n`);
  });
}
