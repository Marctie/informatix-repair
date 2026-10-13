// Esegue i test Cypress contro un'istanza isolata del gestionale officina.
// Ogni file di test parte con un database NUOVO e vuoto (nessuna dipendenza tra file) e non tocca mai officina/data.
// Uso:  npm run test:e2e                              tutti i test in cypress/e2e
//       npm run test:e2e -- --spec cypress/tools/manuale-screens.cy.js   un file preciso
//       npm run test:e2e -- --open                    interfaccia grafica (un solo DB)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const open = process.argv.includes('--open');
const extra = process.argv.slice(2).filter((a) => a !== '--open');
const specIdx = extra.indexOf('--spec');
const specs = specIdx >= 0 ? [extra[specIdx + 1]] : readdirSync('cypress/e2e').filter((f) => f.endsWith('.cy.js')).map((f) => `cypress/e2e/${f}`);
const baseExtra = specIdx >= 0 ? extra.filter((_, i) => i !== specIdx && i !== specIdx + 1) : extra;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOnce(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'officina-e2e-'));
  const env = { ...process.env, OFFICINA_DB: join(dir, 'e2e.db'), OFFICINA_PORT: '4960', PUBLIC_PORT: '4961' };
  delete env.ELECTRON_RUN_AS_NODE; // impostata da VS Code: impedisce a Cypress (Electron) di partire
  const server = spawn(process.execPath, ['officina/server.mjs'], { env, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch('http://127.0.0.1:4960/api/meta')).ok) break; } catch { /* non ancora pronto */ }
    await wait(250);
  }
  const args = open ? ['open', '--e2e', ...baseExtra] : ['run', '--spec', spec, ...baseExtra];
  const code = await new Promise((res) => spawn('npx', ['cypress', ...args], { env, stdio: 'inherit', shell: true }).on('exit', (c) => res(c ?? 1)));
  server.kill();
  await wait(1200);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* DB ancora bloccato: pulizia a cura del sistema */ }
  return code;
}

let failed = 0;
for (const spec of open ? [''] : specs) failed += (await runOnce(spec)) ? 1 : 0;
process.exit(failed ? 1 : 0);
