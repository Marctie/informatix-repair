// Test dell'SDK astratto dei lettori NFC (officina/public/nfc.js): formati UID, lettore USB "tastiera", API unica con adattatori.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUid, extractToken, WedgeParser, createNfc, ADAPTERS } from '../public/nfc.js';

test('UID: esadecimale con separatori, decimale e byte invertiti', () => {
  assert.equal(normalizeUid('04:a1:b2:c3'), '04A1B2C3');
  assert.equal(normalizeUid('04 a1 b2 c3 d4 e5 f6'), '04A1B2C3D4E5F6');
  assert.equal(normalizeUid('04A1B2C3', { reverse: true }), 'C3B2A104');
  assert.equal(normalizeUid('3283755523', { format: 'dec' }), (3283755523).toString(16).toUpperCase().padStart(8, '0'));
  assert.equal(normalizeUid('abc'), null);
  assert.equal(normalizeUid('04A1B2'), null, 'troppo corto');
  assert.equal(normalizeUid('04A1B2C3D4E5F6A7B8C9D0'), null, 'troppo lungo');
  assert.equal(normalizeUid(null), null);
});

test('codice firmato: estratto da un testo del chip', () => {
  const t = 'IXC1.C-000012.7.abcdefghijklmnopqrstuv';
  assert.equal(extractToken(`xx ${t} yy`), t);
  assert.equal(extractToken('niente'), null);
  assert.equal(extractToken('IXC1.C-1.7.corto'), null);
});

test('lettore USB tastiera: sequenza veloce chiusa da Invio = UID; digitazione lenta ignorata', () => {
  const p = new WedgeParser({ maxGapMs: 80 });
  let t = 1000; let uid = null;
  for (const ch of '04A1B2C3') { t += 10; assert.equal(p.feed(ch, t), null); }
  uid = p.feed('Enter', t + 10);
  assert.equal(uid, '04A1B2C3');
  // digitazione a mano (pause lunghe): il buffer si svuota a ogni pausa, nessun UID
  let s = 5000;
  for (const ch of '04A1B2C3') { s += 400; p.feed(ch, s); }
  assert.equal(p.feed('Enter', s + 400), null);
  // sequenza troppo corta
  assert.equal(['1', '2', 'Enter'].map((k, i) => p.feed(k, 9000 + i * 5)).pop(), null);
  // lettore che stampa il decimale
  const d = new WedgeParser({ format: 'dec' });
  let u = 100;
  for (const ch of '3283755523') { u += 5; d.feed(ch, u); }
  assert.equal(d.feed('Enter', u + 5), (3283755523).toString(16).toUpperCase().padStart(8, '0'));
});

test('API unica: stesso codice con adattatori diversi (finto lettore), scrittura e arresto', async () => {
  const log = [];
  class FakeReader {
    static id = 'finto'; static label = 'Lettore finto';
    constructor() { this.capabilities = { read: true, write: true }; }
    available() { return true; }
    async start(emit) { this.emit = emit; log.push('start'); }
    async stop() { log.push('stop'); }
    async write(text) { log.push(`write:${text}`); }
  }
  class Unavailable { static id = 'no'; static label = 'No'; available() { return false; } get capabilities() { return {}; } }
  class ReadOnly { static id = 'solo'; static label = 'Solo lettura'; available() { return true; } get capabilities() { return { read: true, write: false }; } async start() {} async stop() {} }
  const nfc = createNfc({ adapters: [FakeReader, Unavailable, ReadOnly] });
  assert.deepEqual(nfc.list().map((x) => [x.id, x.available]), [['finto', true], ['no', false], ['solo', true]]);
  await assert.rejects(() => nfc.use('no'), /non è disponibile/);
  await assert.rejects(() => nfc.use('boh'), /sconosciuto/);
  await assert.rejects(() => nfc.start(), /Scegli prima/);

  const seen = []; const states = [];
  nfc.onTag((t) => seen.push(t)); nfc.onStatus((s) => states.push(s.state));
  await nfc.use('finto'); await nfc.start();
  assert.equal(nfc.running, true);
  nfc.submit('04:a1:b2:c3', 'IXC1.C-000001.2.abcdefghijklmnopqrstuv');
  assert.deepEqual(seen[0], { uid: '04A1B2C3', token: 'IXC1.C-000001.2.abcdefghijklmnopqrstuv', source: 'manual' });
  assert.throws(() => nfc.submit('zz'), /UID non valido/);
  assert.equal(await nfc.write('IXC1.C-000001.3.abcdefghijklmnopqrstuv'), true);
  await nfc.stop();
  assert.deepEqual(log, ['start', 'write:IXC1.C-000001.3.abcdefghijklmnopqrstuv', 'stop']);
  assert.ok(states.includes('listening') && states.includes('idle'));

  await nfc.use('solo');
  assert.equal(await nfc.write('x'), false, 'un lettore che non scrive risponde false, senza errori');
});

test('elenco adattatori predefiniti: Web NFC, USB tastiera, ponte PC/SC, a mano', () => {
  assert.deepEqual(ADAPTERS.map((A) => A.id), ['webnfc', 'hid', 'bridge', 'manual']);
  const nfc = createNfc();
  assert.equal(nfc.list().find((x) => x.id === 'manual').available, true);
  assert.equal(nfc.list().find((x) => x.id === 'webnfc').write, true);
  assert.equal(nfc.list().find((x) => x.id === 'hid').write, false);
});
