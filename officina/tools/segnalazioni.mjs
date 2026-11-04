// Strumento per Claude Code (e Marco): legge e aggiorna le Segnalazioni di Christian senza aprire il gestionale.
// La chiave CLAUDE_TOKEN sta nel file `segnalazioni.env.local` accanto a questo script (escluso da git: *.local).
// Uso:
//   node officina/tools/segnalazioni.mjs elenco [aperte|nuova|in_corso|tutte] [--foto] [--file percorso.md]
//   node officina/tools/segnalazioni.mjs leggi <numero> [--foto] [--file percorso.md]
//   node officina/tools/segnalazioni.mjs commenta <numero> "testo"
//   node officina/tools/segnalazioni.mjs stato <numero> <nuova|in_corso|in_attesa|da_verificare|risolta|rifiutata> "nota"
// Non stampa mai la chiave.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SEGNALAZIONI_BASE || 'https://riparazioni.informatixrepair.com';
const env = Object.fromEntries(readFileSync(join(HERE, 'segnalazioni.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.CLAUDE_TOKEN) { console.error('Manca CLAUDE_TOKEN in segnalazioni.env.local'); process.exit(1); }
const [cmd, a1, a2, a3] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const flag = (n) => process.argv.includes(`--${n}`);
const fileArg = (() => { const i = process.argv.indexOf('--file'); return i > 0 ? process.argv[i + 1] : null; })();

async function call(method, path, body) {
  const r = await fetch(`${BASE}/api/claude${path}`, { method, headers: { authorization: `Bearer ${env.CLAUDE_TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) { console.error(`Errore ${r.status}: ${typeof d === 'string' ? d : d.error || JSON.stringify(d)}`); process.exit(1); }
  return d;
}
const out = (md) => { if (fileArg) { writeFileSync(fileArg, md); console.log(`Salvato in ${fileArg}`); } else console.log(md); };

if (cmd === 'elenco') {
  const d = await call('GET', `/tickets/report?stato=${a1 || 'aperte'}${flag('foto') ? '&foto=1' : ''}`);
  out(d.markdown);
} else if (cmd === 'leggi' && a1) {
  out((await call('GET', `/tickets/${Number(String(a1).replace(/\D/g, ''))}/report${flag('foto') ? '?foto=1' : ''}`)).markdown);
} else if (cmd === 'commenta' && a1 && a2) {
  const d = await call('POST', `/tickets/${Number(String(a1).replace(/\D/g, ''))}/comments`, { body: a2 });
  console.log(`Commento aggiunto a ${d.code} (${d.status_label}).`);
} else if (cmd === 'stato' && a1 && a2) {
  const d = await call('PUT', `/tickets/${Number(String(a1).replace(/\D/g, ''))}`, { status: a2, ...(a3 ? { note: a3 } : {}) });
  console.log(`${d.code}: ora «${d.status_label}».`);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 9).join('\n'));
}
