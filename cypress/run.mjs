// Avvia un'istanza isolata del gestionale officina, esegue Cypress, poi la spegne.
// Uso: npm run test:e2e   (aggiungi --open per l'interfaccia grafica)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-e2e-'));
const env = { ...process.env, OFFICINA_DB: join(dir, 'e2e.db'), OFFICINA_PORT: '4960', PUBLIC_PORT: '4961' };
delete env.ELECTRON_RUN_AS_NODE; // impostata da VS Code: impedisce a Cypress (Electron) di partire

const server = spawn(process.execPath, ['officina/server.mjs'], { env, stdio: 'ignore' });
const stop = () => { server.kill(); rmSync(dir, { recursive: true, force: true }); };

for (let i = 0; i < 40; i++) {
  try { if ((await fetch('http://127.0.0.1:4960/api/meta')).ok) break; } catch { /* non ancora pronto */ }
  await new Promise((r) => setTimeout(r, 250));
}
const args = process.argv.includes('--open') ? ['open', '--e2e'] : ['run'];
const cy = spawn('npx', ['cypress', ...args], { env, stdio: 'inherit', shell: true });
cy.on('exit', (code) => { stop(); process.exit(code ?? 1); });
