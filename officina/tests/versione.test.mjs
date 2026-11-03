// La versione mostrata nel gestionale deve avere 4 numeri e coincidere con la prima voce delle note di rilascio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/versione.js', import.meta.url), 'utf8');
const version = src.match(/VERSION = '([^']+)'/)?.[1];
const notes = [...src.matchAll(/\{ v: '([^']+)', date: '[^']+', type: '(funzione|correzione|base)'/g)].map((m) => m[1]);

test('versione a quattro numeri, uguale alla nota piu\' recente', () => {
  assert.match(version, /^\d+\.\d+\.\d+\.\d+$/);
  assert.equal(notes[0], version);
});

test('note in ordine decrescente e senza doppioni', () => {
  const n = notes.map((v) => v.split('.').map(Number));
  assert.equal(new Set(notes).size, notes.length);
  for (let i = 1; i < n.length; i++) {
    const [a, b] = [n[i - 1], n[i]];
    const cmp = a.findIndex((x, k) => x !== b[k]);
    assert.ok(cmp >= 0 && a[cmp] > b[cmp], `${notes[i - 1]} deve venire dopo ${notes[i]}`);
  }
});
