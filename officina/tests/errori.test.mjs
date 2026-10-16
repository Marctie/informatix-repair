// Test: errori parlanti dell'interfaccia (logica pura di public/errori.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, buildApiError, networkError, friendly, errorText, statusPrereq } from '../public/errori.js';

const build = (status, data, extra = {}) => buildApiError({ status, data, contentType: data ? 'application/json' : 'text/html', ...extra });

test('400: il messaggio del server resta, hint del backend usato se presente', () => {
  const e = build(400, { error: 'Inserisci prima il preventivo (o le opzioni).', code: 'quote_missing', hint: 'Compila il campo Preventivo.' });
  assert.equal(e.kind, 'input');
  assert.equal(e.message, 'Inserisci prima il preventivo (o le opzioni).');
  assert.equal(e.hint, 'Compila il campo Preventivo.');
  assert.equal(e.code, 'quote_missing');
  assert.equal(friendly(e).retry, false);
});

test('400 senza hint: nessun suggerimento inventato', () => {
  const e = build(400, { error: 'Prezzo mancante per Cavo' });
  assert.equal(e.hint, '');
  assert.equal(errorText(e), 'Prezzo mancante per Cavo');
});

test('401 e pagina di login HTML = sessione scaduta, con Ricarica', () => {
  for (const e of [build(401, { error: 'x' }), buildApiError({ status: 200, data: null, contentType: 'text/html', redirected: true }), buildApiError({ status: 403, data: null, contentType: 'text/html' })]) {
    assert.equal(e.kind, 'session');
    assert.match(e.message, /sessione/i);
    assert.equal(friendly(e).reload, true);
  }
});

test('403, 404, 409, 429, 5xx hanno messaggi e azioni giusti', () => {
  assert.equal(build(403, { error: 'Solo amministratori' }).kind, 'forbidden');
  assert.equal(build(403, { error: 'Solo amministratori' }).message, 'Solo amministratori');
  assert.equal(build(404, { error: 'Riparazione non trovata' }).kind, 'notfound');
  assert.equal(build(409, { error: 'Già consegnata.' }).kind, 'conflict');
  const r = build(429, { error: 'Troppi tentativi' });
  assert.equal(r.kind, 'rate'); assert.equal(friendly(r).retry, true);
  const s = build(503, null, { contentType: 'text/html' });
  assert.equal(s.kind, 'server'); assert.equal(friendly(s).retry, true); assert.ok(s.hint);
});

test('rete assente e timeout: Riprova e dati conservati', () => {
  const n = networkError('POST', '/api/sales', false);
  assert.equal(n.kind, 'network'); assert.equal(friendly(n).retry, true); assert.match(n.hint, /ancora qui/);
  const t = networkError('POST', '/api/sales', true);
  assert.equal(t.kind, 'timeout'); assert.match(t.hint, /due volte/);
});

test('eccezioni JS: messaggio umano, mai "Cannot set properties of null"', () => {
  const f = friendly(new TypeError("Cannot set properties of null (setting 'textContent')"));
  assert.doesNotMatch(f.message, /Cannot/);
  assert.equal(f.reload, true);
  assert.equal(friendly(new Error('Valore non valido')).message, 'Valore non valido');
  assert.ok(new ApiError('x') instanceof Error);
});

test('prerequisiti: avanzare a "in attesa di approvazione" senza preventivo si ferma prima del server', () => {
  const p = statusPrereq({ quote: null, quote_options: [] }, 'quote_pending');
  assert.equal(p.fix, 'quote'); assert.match(p.message, /Manca il preventivo/);
  assert.equal(statusPrereq({ quote: 80, quote_options: [] }, 'quote_pending'), null);
  assert.equal(statusPrereq({ quote: 0, quote_options: [] }, 'quote_pending'), null);
  assert.equal(statusPrereq({ quote: null, quote_options: [{ id: 1 }] }, 'quote_pending'), null);
  assert.equal(statusPrereq({ quote: null, quote_options: [] }, 'repairing'), null);
});
