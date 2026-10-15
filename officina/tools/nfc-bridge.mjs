// Programma "ponte" tra un lettore NFC del PC (PC/SC) e il gestionale nel browser.
// Va acceso sul PC a cui e' collegato il lettore:   node officina/tools/nfc-bridge.mjs
//   --port 4952        porta locale (predefinita 4952); ascolta SOLO su 127.0.0.1
//   --origin <url>     indirizzo del gestionale autorizzato (es. https://gestionale.informatixrepair.com); predefinito: http://localhost:4950
//   --simulate         senza lettore: scrivi un UID (es. 04A1B2C3) nel terminale e premi Invio per simulare il passaggio di un chip
//
// Protocollo (lo stesso che usa officina/public/nfc.js, adattatore "bridge"):
//   GET  /events  -> flusso SSE; ogni passaggio e' una riga   data: {"uid":"04A1B2C3","token":"IXC1...."|null}
//   POST /write   -> corpo {"uid":"04A1B2C3","token":"IXC1...."}: scrive il codice sul chip (NDEF testo), risposta {"ok":true}
// Il programma NON conosce segreti e NON decide nulla: legge UID e testo del chip e li passa al gestionale, che verifica tutto sul server.
//
// Lettura reale: serve il modulo opzionale "nfc-pcsc" (npm i nfc-pcsc, richiede PC/SC: su Windows e' gia' incluso, su Linux pcscd).
// Non e' una dipendenza del gestionale: si installa solo sul PC che ha il lettore.
import http from 'node:http';
import readline from 'node:readline';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 4952));
const ORIGIN = arg('origin', 'http://localhost:4950');
const SIMULATE = process.argv.includes('--simulate');

const clients = new Set();
const send = (obj) => { for (const res of clients) res.write(`data: ${JSON.stringify(obj)}\n\n`); };
let writeHandler = async () => { throw new Error('Scrittura non disponibile con questo lettore.'); };

const server = http.createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Private-Network': 'true', Vary: 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': pronto\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.method === 'POST' && req.url === '/write') {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) break; }
    try {
      const { uid, token } = JSON.parse(body || '{}');
      if (!/^IXC1\.[A-Z0-9-]{3,20}\.\d{1,9}\.[A-Za-z0-9_-]{22}$/.test(String(token))) throw new Error('Codice non valido');
      await writeHandler(String(uid || ''), token);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }
  res.writeHead(404, cors); res.end();
});
server.listen(PORT, '127.0.0.1', () => console.log(`Ponte NFC in ascolto su http://127.0.0.1:${PORT} (gestionale autorizzato: ${ORIGIN})`));

if (SIMULATE) {
  console.log('Modalità simulazione: scrivi un UID (es. 04A1B2C3) oppure "UID TOKEN" e premi Invio.');
  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    const [uid, token] = line.trim().split(/\s+/);
    if (uid) { send({ uid, token: token || null }); console.log('inviato', uid); }
  });
  writeHandler = async (uid, token) => console.log(`(simulato) scrivo sul chip ${uid}: ${token}`);
} else {
  let NFC;
  try { ({ NFC } = await import('nfc-pcsc')); } catch { console.error('Modulo "nfc-pcsc" non installato: esegui   npm i nfc-pcsc   oppure prova con --simulate.'); process.exit(1); }
  const nfc = new NFC();
  let activeReader = null;
  nfc.on('reader', (reader) => {
    console.log(`Lettore collegato: ${reader.reader.name}`);
    reader.autoProcessing = false; // l'UID lo leggiamo noi: niente lettura automatica dei blocchi
    activeReader = reader;
    reader.on('card', async (card) => {
      let token = null;
      try { // il testo NDEF sta nei blocchi utente di un tag NTAG/Mifare Ultralight: lettura grezza dei primi 160 byte
        const data = await reader.read(4, 160, 4);
        const m = /IXC1\.[A-Z0-9-]{3,20}\.\d{1,9}\.[A-Za-z0-9_-]{22}/.exec(data.toString('latin1'));
        token = m ? m[0] : null;
      } catch { /* chip senza memoria utente leggibile: resta il solo UID */ }
      send({ uid: String(card.uid).toUpperCase(), token });
    });
    reader.on('error', (err) => console.error('Errore lettore:', err.message));
    reader.on('end', () => { console.log('Lettore scollegato'); if (activeReader === reader) activeReader = null; });
  });
  nfc.on('error', (err) => console.error('Errore PC/SC:', err.message));
  writeHandler = async (_uid, token) => {
    if (!activeReader) throw new Error('Nessun lettore collegato.');
    // record NDEF "testo" in lingua "it": 0x03 len D1 01 pl 54 02 'i' 't' <testo> FE
    const text = Buffer.from(token, 'utf8');
    const payload = Buffer.concat([Buffer.from([0x02, 0x69, 0x74]), text]);
    const ndef = Buffer.concat([Buffer.from([0xd1, 0x01, payload.length, 0x54]), payload]);
    let tlv = Buffer.concat([Buffer.from([0x03, ndef.length]), ndef, Buffer.from([0xfe])]);
    while (tlv.length % 4) tlv = Buffer.concat([tlv, Buffer.from([0])]);
    await activeReader.write(4, tlv, 4);
  };
}
