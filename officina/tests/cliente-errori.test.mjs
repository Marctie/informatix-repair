// Test: errori per il cliente (public/cliente-errori.js, script semplice caricato con vm).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../public/cliente-errori.js', import.meta.url), 'utf8');
const mk = (fetchImpl) => {
  const ctx = { setTimeout, clearTimeout, AbortController, fetch: fetchImpl };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.ClientErr;
};
const resp = (status, body, raw) => ({ ok: status < 400, status, text: async () => raw ?? (body === undefined ? '' : JSON.stringify(body)) });

test('classificazione: niente codici tecnici, solo italiano semplice', () => {
  const C = mk(async () => resp(200, {}));
  for (const s of [0, -1, 404, 409, 410, 429, 500, 503, 400]) {
    const e = C.classify(s);
    assert.ok(e.title && e.text, `stato ${s}`);
    assert.ok(!/\b(HTTP|JSON|undefined|null|Error|E-[A-Z0-9]{5})\b|\b[45]\d\d\b/.test(`${e.title} ${e.text}`), `tecnico in ${s}: ${e.text}`);
  }
  assert.equal(C.classify(0).retry, true);
  assert.equal(C.classify(-1).retry, true);
  assert.equal(C.classify(404).retry, false);
  assert.equal(C.classify(409).reload, true);
  assert.equal(C.classify(429).retry, true);
  assert.equal(C.classify(500).retry, true);
});

test('400 con messaggio del server: lo mostra, ma il 5xx no', () => {
  const C = mk(async () => resp(200, {}));
  assert.match(C.classify(400, 'Firma mancante').text, /Firma mancante/);
  assert.doesNotMatch(C.classify(500, 'SQLITE_ERROR boom').text, /SQLITE/);
});

test('call: successo, rete caduta, 404, 409, 500, risposta non JSON', async () => {
  assert.equal(JSON.stringify((await mk(async () => resp(200, { a: 1 })).call('/x')).data), '{"a":1}');
  const net = await mk(async () => { throw new TypeError('Failed to fetch'); }).call('/x');
  assert.equal(net.ok, false); assert.equal(net.error.kind, 'network');
  assert.equal((await mk(async () => resp(404, { error: 'x' })).call('/x')).error.kind, 'notfound');
  const c409 = await mk(async () => resp(409, { error: 'Preventivo già accettato.' })).call('/x');
  assert.equal(c409.error.kind, 'decided'); assert.match(c409.error.text, /già accettato/);
  assert.equal((await mk(async () => resp(500, { error: 'boom' })).call('/x')).error.kind, 'server');
  assert.equal((await mk(async () => resp(200, null, '<html>login</html>')).call('/x')).error.kind, 'server');
});

test('call: tempo scaduto -> timeout', async () => {
  const C = mk((url, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('abort')))));
  const r = await C.call('/x', {}, 20);
  assert.equal(r.error.kind, 'timeout');
});

test('box: escape HTML e pulsante Riprova solo quando serve', () => {
  const C = mk(async () => resp(200, {}));
  assert.match(C.box(C.classify(0), true), /Riprova/);
  assert.doesNotMatch(C.box(C.classify(404), true), /Riprova/);
  assert.doesNotMatch(C.box({ title: '<img onerror=x>', text: 'a' }, false), /<img/);
});
