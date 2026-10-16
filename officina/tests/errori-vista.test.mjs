// Test: vista admin "Errori" (logica pura in public/errori.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeErrorRow, errorsQuery } from '../public/errori.js';

test('describeErrorRow: riga completa', () => {
  const x = describeErrorRow({ severity: 'security', at: '2026-10-16 10:00:00', last_at: '2026-10-16 10:04:00', user_email: 'a@b.it', user_name: 'Christian', action: 'Avanzamento riparazione', entity: 'R-2026-12', reason: 'Manca il preventivo', hint: 'Inseriscilo', count: 3, ref: 'E-ABCDE', status: 400 });
  assert.equal(x.severityLabel, 'Sicurezza');
  assert.equal(x.who, 'Christian');
  assert.equal(x.repeats, 3);
  assert.equal(x.repeatsLabel, '3 volte');
  assert.equal(x.when, '2026-10-16 10:04:00');
  assert.equal(x.first, '2026-10-16 10:00:00');
});

test('describeErrorRow: campi mancanti non rompono nulla', () => {
  const x = describeErrorRow({});
  assert.equal(x.who, 'visitatore');
  assert.equal(x.severity, 'error');
  assert.equal(x.doing, 'Operazione non indicata');
  assert.equal(x.reason, 'Motivo non registrato');
  assert.equal(x.repeatsLabel, '1 volta');
  assert.equal(x.first, '');
  assert.equal(describeErrorRow({ method: 'POST', path: '/api/x' }).doing, 'POST /api/x');
  assert.doesNotThrow(() => describeErrorRow());
});

test('errorsQuery: scarta i vuoti, pagina minima 1', () => {
  assert.equal(errorsQuery({ severity: 'error', q: ' E-12345 ', user: '' }, 2), 'page=2&severity=error&q=E-12345');
  assert.equal(errorsQuery({}, 0), 'page=1');
  assert.equal(errorsQuery(undefined, 'x'), 'page=1');
});
