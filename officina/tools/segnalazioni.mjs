// Strumento per Claude Code (e Marco): legge e aggiorna le Segnalazioni di Christian direttamente nel database D1,
// con l'accesso Cloudflare gia' usato per pubblicare (wrangler). Nessuna chiave nuova.
// Le richieste arrivano anche su Telegram (avviso «Nuova segnalazione»); questo strumento serve a prenderle in carico.
// Uso (dalla cartella informatix-repair):
//   node officina/tools/segnalazioni.mjs elenco            -> segnalazioni aperte (nuove per prime)
//   node officina/tools/segnalazioni.mjs leggi <numero>    -> dettaglio completo con la cronologia
//   node officina/tools/segnalazioni.mjs commenta <numero> "testo"
//   node officina/tools/segnalazioni.mjs stato <numero> <nuova|in_corso|in_attesa|da_verificare|risolta|rifiutata> ["nota"]
// I commenti e i cambi di stato sono firmati «Marco» (come quelli scritti dal gestionale).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATI = { nuova: 'Nuova', in_corso: 'In lavorazione', in_attesa: 'In attesa di risposta', da_verificare: 'Da verificare', risolta: 'Risolta', rifiutata: 'Rifiutata' };
const AUTORE = ['marcopeluso99@gmail.com', 'Marco'];
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const code = (id) => `S-${String(id).padStart(4, '0')}`;

function sql(command) {
  // wrangler lanciato con Node senza shell: la query arriva intatta (sotto Windows la shell rovinerebbe < > e gli spazi)
  const bin = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const out = execFileSync(process.execPath, [bin, 'd1', 'execute', 'officina', '--remote', '--config', 'officina/wrangler.jsonc', '--json', '--command', command], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.slice(out.indexOf('[')))[0]?.results || [];
}
const NOW = "datetime('now', '+1 hour')"; // ora di Roma (solare); D1 lavora in UTC

const [cmd, a1, a2, a3] = process.argv.slice(2);
const id = Number(String(a1 || '').replace(/\D/g, ''));

if (cmd === 'elenco') {
  const rows = sql("SELECT id, kind, status, priority, title, created_by_name, created_at, updated_at FROM tickets WHERE status NOT IN ('risolta','rifiutata') ORDER BY status <> 'nuova', id");
  if (!rows.length) console.log('Nessuna segnalazione aperta.');
  for (const t of rows) console.log(`${code(t.id)} · ${STATI[t.status] || t.status} · ${t.kind} · priorità ${t.priority} · ${t.created_by_name || ''} ${t.created_at}\n   ${t.title}`);
} else if (cmd === 'leggi' && id) {
  const [t] = sql(`SELECT * FROM tickets WHERE id = ${id}`);
  if (!t) { console.error(`${code(id)} non esiste.`); process.exit(1); }
  const com = sql(`SELECT kind, body, author_name, created_at FROM ticket_comments WHERE ticket_id = ${id} ORDER BY id`);
  let photos = 0; try { photos = JSON.parse(t.photos || '[]').length; } catch { /* nessuna */ }
  console.log(`# ${code(t.id)} · ${t.title}\nTipo: ${t.kind} · Priorità: ${t.priority} · Stato: ${STATI[t.status]} · Aperta da ${t.created_by_name || t.created_by} il ${t.created_at}${t.page ? `\nSezione: ${t.page}` : ''}\n\n## Descrizione\n${t.description}${t.path_text ? `\n\n## Percorso\n${t.path_text}` : ''}${t.expected ? `\n\n## Come dovrebbe essere\n${t.expected}` : ''}${photos ? `\n\n## Immagini: ${photos} (si vedono nel gestionale, Segnalazioni → ${code(t.id)})` : ''}${com.length ? `\n\n## Cronologia\n${com.map((m) => `- ${m.created_at} · ${m.author_name}${m.kind === 'stato' ? ' (stato)' : ''}: ${m.body}`).join('\n')}` : ''}`);
} else if (cmd === 'commenta' && id && a2) {
  sql(`INSERT INTO ticket_comments (ticket_id, kind, body, author, author_name, created_at) VALUES (${id}, 'commento', ${q(a2)}, ${q(AUTORE[0])}, ${q(AUTORE[1])}, ${NOW}); UPDATE tickets SET updated_at = ${NOW} WHERE id = ${id}`);
  console.log(`Commento aggiunto a ${code(id)}.`);
} else if (cmd === 'stato' && id && STATI[a2]) {
  const [t] = sql(`SELECT status FROM tickets WHERE id = ${id}`);
  if (!t) { console.error(`${code(id)} non esiste.`); process.exit(1); }
  const closed = ['risolta', 'rifiutata'].includes(a2);
  sql(`UPDATE tickets SET status = ${q(a2)}, closed_at = ${closed ? `COALESCE(closed_at, ${NOW})` : 'NULL'}, updated_at = ${NOW} WHERE id = ${id}; INSERT INTO ticket_comments (ticket_id, kind, body, author, author_name, created_at) VALUES (${id}, 'stato', ${q(`${STATI[t.status]} → ${STATI[a2]}`)}, ${q(AUTORE[0])}, ${q(AUTORE[1])}, ${NOW})${a3 ? `; INSERT INTO ticket_comments (ticket_id, kind, body, author, author_name, created_at) VALUES (${id}, 'commento', ${q(a3)}, ${q(AUTORE[0])}, ${q(AUTORE[1])}, ${NOW})` : ''}`);
  console.log(`${code(id)}: ${STATI[t.status]} → ${STATI[a2]}.`);
} else {
  console.log('Uso: elenco | leggi <n> | commenta <n> "testo" | stato <n> <stato> ["nota"]');
}
