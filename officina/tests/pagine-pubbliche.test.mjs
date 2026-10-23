// Le pagine del cliente (/t/ e /p/) girano sul dominio pubblico, che serve SOLO i file elencati in public-assets.mjs.
// Un file mancante dall'elenco = 404 = pagina bloccata in "caricamento" (successo il 16/10 con cliente-errori.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PUBLIC_PAGES, PUBLIC_ASSETS } from '../public-assets.mjs';

const dir = new URL('../public/', import.meta.url);

test('ogni script e foglio di stile delle pagine pubbliche e\' servito dal dominio pubblico', () => {
  for (const page of PUBLIC_PAGES) {
    const html = readFileSync(new URL(page, dir), 'utf8');
    const refs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
      .concat([...html.matchAll(/<link[^>]+href="(\/[^"]+\.(?:css|js))"/g)].map((m) => m[1]));
    assert.ok(refs.length > 0, `${page}: nessuno script trovato`);
    for (const ref of refs) {
      assert.ok(ref.startsWith('/'), `${page}: ${ref} deve essere un percorso assoluto`);
      assert.ok(PUBLIC_ASSETS.has(ref), `${page} carica ${ref} ma il dominio pubblico non lo serve (aggiungilo a public-assets.mjs)`);
    }
  }
});

test('ogni file dell\'elenco pubblico esiste davvero', () => {
  for (const p of PUBLIC_ASSETS) assert.ok(existsSync(new URL('.' + p, dir)), `${p} non esiste in officina/public`);
});
