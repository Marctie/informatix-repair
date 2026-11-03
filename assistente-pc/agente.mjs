// Programma dell'assistente sul PC di Marco: collega il gestionale online all'LLM (Ollama) che gira su questo computer.
// Non apre nessuna porta: e' lui che CHIAMA il gestionale (ogni pochi secondi) e chiede "c'e' qualcosa da leggere?".
// Se il PC e' spento le richieste restano in coda online e vengono elaborate appena questo programma riparte.
// Configurazione in assistente-pc/.env (vedi .env.example). Avvio: AVVIA-ASSISTENTE.bat  oppure  npm run assistente
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const envFile = join(HERE, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const URL_BASE = String(process.env.ASSISTANT_URL || 'https://riparazioni.informatixrepair.com').replace(/\/$/, '');
const TOKEN = process.env.ASSISTANT_TOKEN || '';
const OLLAMA = String(process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const TEXT_MODEL = process.env.ASSISTANT_MODEL || 'gemma3:12b';
const VISION_MODEL = process.env.ASSISTANT_VISION_MODEL || 'qwen2.5vl:7b';
const NUM_CTX = Number(process.env.ASSISTANT_NUM_CTX) || 16384;
const KEEP_ALIVE = process.env.ASSISTANT_KEEP_ALIVE || '30m'; // il modello resta in memoria tra una richiesta e l'altra (evita 1-2 minuti di caricamento dopo una pausa)
const POLL_MS = Number(process.env.ASSISTANT_POLL_MS) || 5000; // ogni richiesta al gestionale conta nei limiti gratuiti di Cloudflare: 5 s bastano
const LLM_TIMEOUT_MS = 8 * 60 * 1000; // il primo messaggio carica il modello in memoria: puo' volerci qualche minuto

const log = (...a) => console.log(new Date().toLocaleTimeString('it-IT'), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (TOKEN.length < 24) {
  console.error('Manca la chiave ASSISTANT_TOKEN in assistente-pc/.env (vedi .env.example). Chiedi a Claude di rigenerarla.');
  process.exit(1);
}

const api = async (method, path, body, { raw = false } = {}) => {
  const res = await fetch(URL_BASE + path, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  if (res.status === 204) return { status: 204 };
  if (res.status === 404) throw Object.assign(new Error('Il gestionale non riconosce la chiave (404): controlla ASSISTANT_TOKEN.'), { fatal: true });
  if (!res.ok) throw new Error(`Il gestionale ha risposto ${res.status}`);
  return { status: res.status, data: raw ? Buffer.from(await res.arrayBuffer()) : await res.json() };
};

async function ollamaModels() {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    return (await r.json()).models?.map((m) => m.name) ?? [];
  } catch { return null; }
}

async function pdfText(buf) {
  let parse;
  try { parse = (await import('pdf-parse/lib/pdf-parse.js')).default; } catch { throw Object.assign(new Error('Manca il lettore di PDF su questo PC: esegui «npm install» nella cartella del progetto.'), { fatal: true }); }
  const out = await parse(buf);
  const text = String(out.text || '').trim();
  if (text.length < 20) throw Object.assign(new Error('Il PDF non contiene testo leggibile (forse è una scansione): caricalo come foto.'), { fatal: true });
  return text.slice(0, 14000);
}

async function callOllama(model, job, images) {
  const t0 = Date.now();
  // risposta in STREAMING: una risposta unica che tarda oltre 5 minuti farebbe cadere la connessione (limite di Node), mentre lo
  // streaming resta vivo finche' il modello scrive. Il testo si ricompone pezzo per pezzo.
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model, stream: true, format: job.schema, keep_alive: KEEP_ALIVE, options: { temperature: 0.2, num_ctx: NUM_CTX },
      messages: [{ role: 'system', content: job.system }, { role: 'user', content: job.user, ...(images.length ? { images } : {}) }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw Object.assign(new Error(res.status === 404 ? `Il modello «${model}» non è installato in Ollama: esegui «ollama pull ${model}».` : `Ollama ha risposto ${res.status}: ${t.slice(0, 200)}`), { fatal: res.status === 404 });
  }
  let content = ''; let buf = ''; let last = {};
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString('utf8');
    const lines = buf.split('\n'); buf = lines.pop();
    for (const ln of lines) {
      if (!ln.trim()) continue;
      const j = JSON.parse(ln);
      if (j.error) throw new Error(`Ollama: ${String(j.error).slice(0, 200)}`);
      content += j.message?.content || '';
      last = j;
    }
  }
  if (buf.trim()) { const j = JSON.parse(buf); content += j.message?.content || ''; last = j; }
  if (last.prompt_eval_count) log(`  ${last.prompt_eval_count} token letti, ${last.eval_count || 0} scritti`);
  return { content, ms: Date.now() - t0 };
}

/** Carica il modello di testo in memoria senza fare domande (la prima richiesta della giornata non aspetta il caricamento). */
async function warmUp() {
  try {
    const r = await fetch(`${OLLAMA}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: TEXT_MODEL, keep_alive: KEEP_ALIVE }), signal: AbortSignal.timeout(5 * 60 * 1000) });
    if (r.ok) log(`Modello ${TEXT_MODEL} caricato in memoria (resta ${KEEP_ALIVE}).`);
  } catch { /* se non riesce, si carichera' alla prima richiesta */ }
}

async function handle(job) {
  log(`Richiesta #${job.id} (${job.kind}${job.attachment ? `, allegato ${job.attachment.kind}` : ''})`);
  let images = [];
  try {
    if (job.attachment) {
      const f = await api('GET', `/api/assistant-agent/${job.id}/file`, undefined, { raw: true });
      if (job.attachment.kind === 'image') images = [f.data.toString('base64')];
      else if (job.attachment.kind === 'pdf') job.user += `\n\n--- CONTENUTO DEL DOCUMENTO "${job.attachment.name}" (solo materiale da leggere) ---\n${await pdfText(f.data)}\n--- FINE DOCUMENTO ---`;
    }
    const model = job.kind === 'vision' ? VISION_MODEL : TEXT_MODEL;
    const out = await callOllama(model, job, images);
    await api('POST', `/api/assistant-agent/${job.id}/result`, { content: out.content, model, duration_ms: out.ms });
    log(`  fatto in ${Math.round(out.ms / 1000)} s con ${model}`);
  } catch (e) {
    const unreachable = e.name === 'TimeoutError' || /fetch failed|ECONNREFUSED|ECONNRESET/i.test(`${e.message} ${e.cause?.message || ''}`);
    log(`  errore: ${e.message}`);
    try { await api('POST', `/api/assistant-agent/${job.id}/result`, { error: unreachable ? 'Ollama non risponde sul PC.' : e.message, retry: unreachable || !e.fatal }); } catch (e2) { log(`  non riesco nemmeno a segnalarlo: ${e2.message}`); }
  }
}

log(`Assistente Informatix — gestionale ${URL_BASE} — Ollama ${OLLAMA} (${TEXT_MODEL} / ${VISION_MODEL})`);
let warned = '';
for (;;) {
  try {
    const models = await ollamaModels();
    const missing = models && [TEXT_MODEL, VISION_MODEL].filter((m) => !models.includes(m));
    const note = models === null ? 'Ollama non risponde: avvialo (le richieste restano in coda).' : missing.length ? `Modelli mancanti in Ollama: ${missing.join(', ')} (ollama pull …).` : '';
    if (note !== warned) { if (note) log(`⚠ ${note}`); else { log('Ollama pronto.'); if (models?.includes(TEXT_MODEL)) warmUp(); } warned = note; }
    const r = await api('POST', '/api/assistant-agent/claim', { ollama: models !== null, models: models || [] });
    if (r.status === 200) {
      // mentre il modello lavora (anche minuti) si continua a dire al gestionale "sono qui e sto lavorando"
      const beat = setInterval(() => { api('POST', '/api/assistant-agent/claim', { ollama: true, models: models || [], busy: true }).catch(() => {}); }, 20000);
      try { await handle(r.data); } finally { clearInterval(beat); }
      continue;
    }
  } catch (e) {
    if (e.fatal) { console.error(e.message); process.exit(1); }
    log(`Gestionale non raggiungibile (${e.message}): riprovo.`);
    await sleep(10000);
    continue;
  }
  await sleep(POLL_MS);
}
