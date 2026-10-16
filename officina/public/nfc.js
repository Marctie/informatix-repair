// SDK astratto per i lettori NFC: UNA sola API per il gestionale, qualunque lettore ci sia sotto.
//
//   import { createNfc } from './nfc.js';
//   const nfc = createNfc();
//   nfc.onTag(({ uid, token, source }) => ...);   // uid = esadecimale maiuscolo; token = codice firmato letto dal chip (o null)
//   await nfc.use('webnfc');  await nfc.start();   // ...  await nfc.stop();
//   await nfc.write(nextToken);                    // scrive il nuovo codice sul chip (se il lettore sa scrivere)
//
// Adattatori (nessuno dipende da un modello preciso di lettore):
//   webnfc  - telefono Android con Chrome (Web NFC, serve HTTPS): legge UID e codice, sa scrivere
//   hid     - lettore USB "tastiera" che digita l'UID e preme Invio: legge solo l'UID (non scrive)
//   bridge  - piccolo programma sul PC (officina/tools/nfc-bridge.mjs) che parla PC/SC: legge UID/codice, scrive se il lettore lo permette
//   manual  - UID digitato o incollato a mano (prove, emergenza)
// Il segreto delle firme NON e' mai qui: il browser porta solo UID e codice; la verifica e' tutta sul server.

const HEX = /^[0-9A-F]+$/;

/** UID in esadecimale maiuscolo senza separatori. `format`: 'hex' (predefinito) o 'dec' (alcuni lettori USB stampano un numero decimale); `reverse`: inverte i byte. */
export function normalizeUid(raw, { format = 'hex', reverse = false } = {}) {
  let s = String(raw ?? '').trim();
  if (format === 'dec') {
    if (!/^\d{4,20}$/.test(s)) return null;
    s = BigInt(s).toString(16);
    if (s.length % 2) s = `0${s}`;
  }
  s = s.replace(/[\s:.-]/g, '').toUpperCase();
  if (!HEX.test(s) || s.length % 2 || s.length < 8 || s.length > 20) return null;
  if (reverse) s = (s.match(/../g) || []).reverse().join('');
  return s;
}

/** Estrae il codice firmato (IXC1....) da un testo letto dal chip. */
export function extractToken(text) {
  const m = /IXC1\.[A-Z0-9-]{3,20}\.\d{1,9}\.[A-Za-z0-9_-]{22}/.exec(String(text ?? ''));
  return m ? m[0] : null;
}

/**
 * Lettore USB "tastiera": riconosce una sequenza di caratteri veloce (pause brevi) chiusa da Invio.
 * Pura e testabile: feed(chiave, istante) restituisce l'UID quando la sequenza e' completa, altrimenti null.
 */
export class WedgeParser {
  constructor({ maxGapMs = 80, minChars = 6, format = 'hex', reverse = false } = {}) {
    Object.assign(this, { maxGapMs, minChars, format, reverse });
    this.buf = ''; this.last = 0;
  }
  feed(key, now) {
    if (now - this.last > this.maxGapMs) this.buf = '';
    this.last = now;
    if (key === 'Enter') {
      const raw = this.buf; this.buf = '';
      return raw.length >= this.minChars ? normalizeUid(raw, { format: this.format, reverse: this.reverse }) : null;
    }
    if (key.length === 1) this.buf += key;
    return null;
  }
}

// ---------- Adattatori ----------
class Adapter {
  constructor(opts = {}) { this.opts = opts; this.emit = () => {}; this.fail = () => {}; }
  get capabilities() { return { read: true, write: false }; }
  available() { return true; }
  async start(emit, fail) { this.emit = emit; this.fail = fail; }
  async stop() {}
  async write() { throw new Error('Questo lettore non sa scrivere sul chip.'); }
}

/** Telefono Android: Web NFC (Chrome, HTTPS). */
export class WebNfcAdapter extends Adapter {
  static id = 'webnfc'; static label = 'Telefono Android (NFC integrato)';
  get capabilities() { return { read: true, write: true }; }
  available() { return typeof window !== 'undefined' && 'NDEFReader' in window && window.isSecureContext; }
  async start(emit, fail) {
    await super.start(emit, fail);
    this.ctl = new AbortController();
    this.reader = new window.NDEFReader();
    await this.reader.scan({ signal: this.ctl.signal });
    this.reader.onreadingerror = () => fail(new Error('Chip non leggibile: riprova ad avvicinarlo.'));
    this.reader.onreading = (ev) => {
      let token = null;
      for (const r of ev.message?.records || []) {
        try { token = extractToken(new TextDecoder(r.encoding || 'utf-8').decode(r.data)) || token; } catch { /* record non testuale */ }
      }
      const uid = normalizeUid(ev.serialNumber);
      if (uid) emit({ uid, token, source: 'webnfc' }); else fail(new Error('UID non leggibile.'));
    };
  }
  async stop() { this.ctl?.abort(); this.reader = null; }
  /** Scrivere richiede di riavvicinare il chip al telefono. */
  async write(text) {
    const w = new window.NDEFReader();
    await w.write({ records: [{ recordType: 'text', data: String(text) }] }, { overwrite: true });
  }
}

/** Lettore USB che "scrive come una tastiera": solo UID, niente scrittura. */
export class HidWedgeAdapter extends Adapter {
  static id = 'hid'; static label = 'Lettore USB (come una tastiera)';
  available() { return typeof window !== 'undefined'; }
  async start(emit, fail) {
    await super.start(emit, fail);
    this.parser = new WedgeParser(this.opts);
    this.onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.hasAttribute('data-nfc-wedge');
      if (typing) return; // non rubare i tasti a chi sta scrivendo in un campo normale
      if (this.opts.format) this.parser.format = this.opts.format; // le scelte fatte nell'interfaccia valgono subito
      if ('reverse' in this.opts) this.parser.reverse = !!this.opts.reverse;
      const uid = this.parser.feed(e.key, performance.now());
      if (uid) { e.preventDefault(); emit({ uid, token: null, source: 'hid' }); }
    };
    window.addEventListener('keydown', this.onKey, true);
  }
  async stop() { if (this.onKey) window.removeEventListener('keydown', this.onKey, true); this.onKey = null; }
}

/** Programma sul PC (PC/SC): eventi in arrivo da {url}/events (SSE), scrittura con POST {url}/write. */
export class BridgeAdapter extends Adapter {
  static id = 'bridge'; static label = 'Lettore PC (programma ponte PC/SC)';
  get url() { return String(this.opts.url || 'http://127.0.0.1:4952').replace(/\/$/, ''); }
  get capabilities() { return { read: true, write: true }; }
  available() { return typeof EventSource !== 'undefined'; }
  async start(emit, fail) {
    await super.start(emit, fail);
    this.es = new EventSource(`${this.url}/events`);
    this.es.onmessage = (m) => {
      try {
        const d = JSON.parse(m.data);
        const uid = normalizeUid(d.uid);
        if (uid) emit({ uid, token: extractToken(d.token), source: 'bridge', lastUid: uid });
      } catch { fail(new Error('Messaggio del lettore non valido.')); }
    };
    this.es.onerror = () => fail(new Error('Programma ponte non raggiungibile: è acceso sul PC?'));
  }
  async stop() { this.es?.close(); this.es = null; }
  async write(text, uid) {
    let res;
    try { res = await fetch(`${this.url}/write`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, token: text }) }); }
    catch { throw new Error('Programma ponte del lettore non raggiungibile: controlla che sia acceso sul PC, poi riprova a scrivere il chip.'); }
    if (!res.ok) throw new Error('Scrittura sul chip non riuscita: riavvicina il chip al lettore e riprova.');
  }
}

/** UID a mano: nessun hardware (prove, emergenza). Si usa con nfc.submit(). */
export class ManualAdapter extends Adapter {
  static id = 'manual'; static label = 'A mano (digita l’UID)';
}

export const ADAPTERS = [WebNfcAdapter, HidWedgeAdapter, BridgeAdapter, ManualAdapter];

/** Crea il lettore. `adapters`: classi disponibili; `options`: { hid: {format,reverse}, bridge: {url} }. */
export function createNfc({ adapters = ADAPTERS, options = {} } = {}) {
  const tagHandlers = new Set();
  const statusHandlers = new Set();
  let current = null;
  let running = false;
  let lastUid = null;
  const status = (s) => statusHandlers.forEach((f) => f(s));
  const emit = (tag) => { lastUid = tag.uid; tagHandlers.forEach((f) => f(tag)); };
  const fail = (err) => status({ state: 'error', error: err.message || String(err) });
  const make = (id) => { const A = adapters.find((x) => x.id === id); return A ? new A(options[id] || {}) : null; };
  const api = {
    /** Adattatori elencati con la disponibilita' su questo dispositivo. */
    list: () => adapters.map((A) => { const a = new A(options[A.id] || {}); return { id: A.id, label: A.label, available: a.available(), write: a.capabilities.write }; }),
    get current() { return current ? { id: current.constructor.id, ...current.capabilities } : null; },
    get running() { return running; },
    async use(id) {
      if (running) await api.stop();
      const a = make(id);
      if (!a) throw new Error('Lettore sconosciuto.');
      if (!a.available()) throw new Error('Questo lettore non è disponibile su questo dispositivo.');
      current = a;
      status({ state: 'idle', adapter: id });
      return api.current;
    },
    async start() {
      if (!current) throw new Error('Scegli prima un lettore.');
      try { await current.start(emit, fail); running = true; status({ state: 'listening', adapter: current.constructor.id }); }
      catch (e) { running = false; fail(e); throw e; }
    },
    async stop() { try { await current?.stop(); } finally { running = false; status({ state: 'idle' }); } },
    /** Simula/consegna un passaggio a mano (adattatore "manual" o prove). */
    submit(uidText, token = null, opts = {}) {
      const uid = normalizeUid(uidText, opts);
      if (!uid) throw new Error('UID non valido: servono 4-10 byte in esadecimale (es. 04A1B2C3).');
      emit({ uid, token: extractToken(token), source: 'manual' });
    },
    /** Scrive il nuovo codice sul chip. Ritorna false (senza errori) se il lettore non sa scrivere: serve allora il PIN o la riemissione. */
    async write(text) {
      if (!current?.capabilities.write) return false;
      await current.write(text, lastUid);
      return true;
    },
    onTag(fn) { tagHandlers.add(fn); return () => tagHandlers.delete(fn); },
    onStatus(fn) { statusHandlers.add(fn); return () => statusHandlers.delete(fn); },
  };
  return api;
}
