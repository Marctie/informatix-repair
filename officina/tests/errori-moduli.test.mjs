// Errori "parlanti" dei moduli secondari: per ogni modulo il codice stabile e il suggerimento dei casi principali,
// piu' i bug trovati (doppio incasso, id mancanti che davano 500).  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-errmod-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');

let apps;
before(() => { apps = createApps(); });
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body, rawBody) => {
  const res = await apps.admin.request(path, { method, headers: { 'content-type': 'application/json' }, body: rawBody ?? (body ? JSON.stringify(body) : undefined) });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const today = new Date().toISOString().slice(0, 10);

// [descrizione, metodo, percorso, corpo, status atteso, code atteso, pezzo del messaggio]
const CASES = [
  ['ordini: senza articoli', 'POST', '/api/orders', { kind: 'fornitore', items: [] }, 400, 'ORDINE_SENZA_ARTICOLI', /senza articoli/],
  ['ordini: non trovato', 'GET', '/api/orders/99999', null, 404, 'ORDINE_NON_TROVATO', /Ordine non trovato/],
  ['ordini: cliente mancante', 'POST', '/api/orders', { kind: 'cliente', items: [{ description: 'Cavo', qty: 1, unit_price: 5 }] }, 400, 'ORDINE_CLIENTE_MANCANTE', /nessun cliente/],
  ['ordini: acconto al fornitore', 'POST', '/api/orders', { kind: 'fornitore', deposit: 5, items: [{ description: 'Cavo', qty: 1, unit_price: 10 }] }, 400, 'ACCONTO_SOLO_CLIENTI', /solo gli ordini presi per i clienti/],
  ['preventivi: senza voci', 'POST', '/api/quotes', { customer_name: 'Mario', items: [] }, 400, 'PREVENTIVO_SENZA_VOCI', /senza voci/],
  ['preventivi: non trovato', 'GET', '/api/quotes/99999', null, 404, 'PREVENTIVO_NON_TROVATO', /Preventivo non trovato/],
  ['preventivi: senza intestatario', 'POST', '/api/quotes', { items: [{ description: 'Lavoro', qty: 1, unit_price: 5 }] }, 400, 'PREVENTIVO_CLIENTE_MANCANTE', /senza intestatario/],
  ['preventivo online: riparazione inesistente', 'POST', '/api/repairs/99999/online-quote', {}, 404, 'RIPARAZIONE_NON_TROVATA', /Riparazione non trovata/],
  ['acquisti: file vuoto', 'POST', '/api/purchases/preview', { xml: '   ', filename: 'a.xml' }, 400, 'FILE_VUOTO', /vuoto/],
  ['acquisti: acquisto inesistente', 'GET', '/api/purchases/99999', null, 404, 'ACQUISTO_NON_TROVATO', /Acquisto non trovato/],
  ['ddt: formato inesistente', 'DELETE', '/api/purchases/formats/99999', null, 404, 'FORMATO_NON_TROVATO', /formato fornitore/],
  ['fatture: non trovata', 'GET', '/api/invoices/99999', null, 404, 'FATTURA_NON_TROVATA', /Fattura non trovata/],
  ['fatture: direzione mancante', 'POST', '/api/invoices', {}, 400, 'FATTURA_DIREZIONE_MANCANTE', /emessa o ricevuta/],
  ['fatture: numero mancante', 'POST', '/api/invoices', { direction: 'emessa' }, 400, 'FATTURA_NUMERO_MANCANTE', /manca il numero/],
  ['chiusure: non trovata', 'GET', '/api/closings/99999', null, 404, 'CHIUSURA_NON_TROVATA', /Chiusura non trovata/],
  ['chiusure: data futura', 'POST', '/api/closings', { day: '2999-01-01' }, 400, 'DATA_FUTURA', /nel futuro/],
  ['dare/avere: cliente mancante', 'POST', '/api/ledger', {}, 400, 'CLIENTE_MANCANTE', /manca il cliente/],
  ['dare/avere: movimento inesistente', 'DELETE', '/api/ledger/99999', null, 404, 'MOVIMENTO_NON_TROVATO', /Movimento non trovato/],
  ['carte: cliente mancante per accrediti', 'GET', '/api/carte/creditable', null, 400, 'CLIENTE_MANCANTE', /manca il cliente/],
  ['carte: cliente inesistente', 'POST', '/api/carte/issue', { customer_id: 99999, uid: '04A1B2C3' }, 404, 'CLIENTE_NON_TROVATO', /non esiste più/],
  ['carte: carta inesistente', 'GET', '/api/carte/99999', null, 404, 'CARTA_NON_TROVATA', /Carta non trovata/],
  ['buoni: non trovato', 'GET', '/api/buoni/99999', null, 404, 'BUONO_NON_TROVATO', /Buono non trovato/],
  ['buoni: valore non valido', 'POST', '/api/buoni', { kind: 'importo', value: 0 }, 400, 'IMPORTO_NON_VALIDO', /Buono non creato/],
  ['buoni: percentuale oltre 100', 'POST', '/api/buoni', { kind: 'sconto_percentuale', value: 150 }, 400, 'PERCENTUALE_NON_VALIDA', /supera 100/],
  ['dispositivi: modello mancante', 'POST', '/api/dispositivi', {}, 400, 'DISPOSITIVO_MODELLO_MANCANTE', /mancano marca e modello/],
  ['dispositivi: non trovato', 'GET', '/api/dispositivi/99999', null, 404, 'DISPOSITIVO_NON_TROVATO', /Dispositivo non trovato/],
  ['dispositivi: cliente inesistente (era FK 409)', 'POST', '/api/dispositivi', { brand_model: 'Apple iPhone 13', customer_id: 99999 }, 404, 'CLIENTE_NON_TROVATO', /cliente collegato non esiste/],
  ['documenti: cliente mancante (era 500)', 'POST', '/api/documenti', {}, 400, 'CLIENTE_MANCANTE', /a quale cliente/],
  ['documenti: cliente inesistente', 'POST', '/api/documenti', { customer_id: 99999 }, 404, 'CLIENTE_NON_TROVATO', /non esiste più/],
  ['documenti: documento inesistente', 'GET', '/api/documenti/99999', null, 404, 'DOCUMENTO_NON_TROVATO', /Documento non trovato/],
  ['credenziali: indirizzo non ammesso', 'POST', '/api/credenziali', { supplier_id: 1, url: 'javascript:alert(1)' }, 400, 'URL_NON_VALIDO', /solo http e https/],
  ['credenziali: non trovata', 'PUT', '/api/credenziali/99999', {}, 404, 'CREDENZIALE_NON_TROVATA', /Credenziale non trovata/],
  ['usati: nome mancante', 'POST', '/api/usati', {}, 400, 'NOME_MANCANTE', /manca il nome/],
  ['usati: non trovato', 'GET', '/api/usati/non-esiste', null, 404, 'ARTICOLO_USATO_NON_TROVATO', /non esiste più/],
  ['spese: descrizione mancante', 'POST', '/api/expenses', {}, 400, 'DESCRIZIONE_MANCANTE', /manca la descrizione/],
  ['spese: importo negativo', 'POST', '/api/expenses', { description: 'Luce', amount: -5 }, 400, 'IMPORTO_NON_VALIDO', /Spesa non salvata/],
  ['spese: non trovata', 'PUT', '/api/expenses/99999', { description: 'Luce', amount: 5, spent_on: today }, 404, 'SPESA_NON_TROVATA', /Spesa non trovata/],
  ['checklist: tipo non valido', 'PUT', '/api/checklists/zzz', { lists: { ingresso: ['a'] } }, 400, 'TIPO_DISPOSITIVO_NON_VALIDO', /tipo di dispositivo/],
  ['esterne: riparazione mancante', 'POST', '/api/esterne', {}, 400, 'RIPARAZIONE_NON_TROVATA', /riparazione collegata/],
  ['esterne: non trovata', 'GET', '/api/esterne/99999', null, 404, 'ESTERNA_NON_TROVATA', /Riparazione esterna non trovata/],
  ['prestiti: dispositivo mancante', 'POST', '/api/prestiti', {}, 400, 'PRESTITO_DISPOSITIVO_MANCANTE', /quale dispositivo/],
  ['prestiti: cliente inesistente (era FK 409)', 'POST', '/api/prestiti', { label: 'Mulo', customer_id: 99999 }, 400, 'CLIENTE_NON_TROVATO', /non esiste più/],
  ['prestiti: non trovato', 'GET', '/api/prestiti/99999', null, 404, 'PRESTITO_NON_TROVATO', /Prestito non trovato/],
  ['modelli: marca mancante', 'POST', '/api/modelli', {}, 400, 'MARCA_MANCANTE', /manca la marca/],
  ['modelli: non trovato', 'GET', '/api/modelli/99999', null, 404, 'MODELLO_NON_TROVATO', /Modello non trovato/],
  ['note: nota vuota', 'POST', '/api/note', {}, 400, 'NOTA_VUOTA', /non ha titolo/],
  ['note: non trovata', 'GET', '/api/note/99999', null, 404, 'NOTA_NON_TROVATA', /Nota non trovata/],
  ['storico: riparazione inesistente', 'GET', '/api/storico/99999', null, 404, 'RIPARAZIONE_NON_TROVATA', /Riparazione non trovata/],
  ['segnalati: motivo mancante', 'POST', '/api/blacklist', { name: 'Tizio' }, 400, 'MOTIVO_MANCANTE', /manca il motivo/],
  ['segnalati: non trovata', 'PUT', '/api/blacklist/99999', {}, 404, 'SEGNALAZIONE_NON_TROVATA', /Segnalazione non trovata/],
  ['clienti: email non valida', 'POST', '/api/customers', { name: 'Zeta Rossi', phone: '3401112233', email: 'non-una-email' }, 400, 'EMAIL_NON_VALIDA', /indirizzo email non è valido/],
  ['clienti: partita IVA non valida', 'POST', '/api/customers', { name: 'Azienda Srl', kind: 'azienda', company_name: 'Azienda Srl', vat_number: '123' }, 400, 'PARTITA_IVA_NON_VALIDA', /Partita IVA non valida/],
  ['materiali: nessuna selezione', 'POST', '/api/materiali/mark-ordered', {}, 400, 'NESSUNA_SELEZIONE', /nessun ordine né ricambio/],
  ['promemoria: testo mancante', 'POST', '/api/reminders', {}, 400, 'TESTO_MANCANTE', /manca il testo/],
  ['promemoria: non trovato', 'GET', '/api/reminders/99999', null, 404, 'PROMEMORIA_NON_TROVATO', /Promemoria non trovato/],
  ['retro: tipo non valido', 'POST', '/api/retro/date', { type: 'zzz', id: 1, date: '2026-01-01' }, 400, 'TIPO_REGISTRAZIONE_NON_VALIDO', /non è valido/],
  ['firme: riparazione inesistente', 'POST', '/api/repairs/99999/signature', { kind: 'intake', image: 'x' }, null, null, null],
  ['opzioni preventivo: riparazione inesistente', 'POST', '/api/repairs/99999/quote-options', { label: 'Base', amount: 10 }, 404, 'RIPARAZIONE_NON_TROVATA', /Riparazione non trovata/],
  ['destino dispositivo: riparazione inesistente', 'POST', '/api/repairs/99999/fate', { fate: 'pickup' }, null, null, null],
];

for (const [name, method, path, body, status, code, msg] of CASES) {
  test(`codici errore - ${name}`, async () => {
    const r = await a(method, path, body);
    if (status == null) { assert.ok(r.status >= 400 && r.status < 500, `${method} ${path} -> ${r.status}`); assert.ok(r.data.code && r.data.hint, 'code e hint presenti'); return; }
    assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(r.data)}`);
    assert.equal(r.data.ok, false);
    assert.equal(r.data.code, code, JSON.stringify(r.data));
    assert.match(r.data.error, msg);
    assert.ok(r.data.hint && r.data.hint.length > 8, 'hint presente');
  });
}

test('moduli secondari: nessun messaggio sensibile e nessun errore tecnico grezzo', async () => {
  for (const [, method, path, body] of CASES) {
    const r = await a(method, path, body);
    const txt = JSON.stringify(r.data);
    assert.doesNotMatch(txt, /constraint failed|SQLITE|TypeError|at async|Provided value/i, `${method} ${path}`);
  }
});

test('BUG corretto: due pagamenti simultanei sulla stessa fattura non incassano due volte', async () => {
  const inv = (await a('POST', '/api/invoices', { direction: 'emessa', number: 'RACE-1', issue_date: today, party_name: 'Rossi', total: 100, vat: 18 })).data;
  const res = await Promise.all([1, 2, 3].map(() => a('POST', `/api/invoices/${inv.id}/payments`, { amount: 100, method: 'contanti' })));
  const ok = res.filter((r) => r.status === 200).length;
  assert.equal(ok, 1, 'un solo pagamento passa');
  for (const r of res.filter((x) => x.status !== 200)) assert.ok(['PAGAMENTO_DOPPIO', 'PAGAMENTO_SUPERA_RESIDUO'].includes(r.data.code), JSON.stringify(r.data));
  const cur = (await a('GET', `/api/invoices/${inv.id}`)).data;
  assert.equal(Number(cur.paid), 100, 'incassati 100, non 300');
  assert.equal(cur.payments.length, 1);
  assert.equal(cur.status, 'pagata');
});

test('BUG corretto: due acconti simultanei sullo stesso ordine non superano il totale', async () => {
  const c = (await a('POST', '/api/customers', { name: 'Anna Verdi', phone: '3331112222' })).data;
  const o = (await a('POST', '/api/orders', { kind: 'cliente', customer_id: c.id, items: [{ description: 'Display', qty: 1, unit_price: 100 }] })).data;
  const res = await Promise.all([1, 2, 3].map(() => a('POST', `/api/orders/${o.id}/deposit`, { amount: 100, method: 'contanti' })));
  assert.equal(res.filter((r) => r.status === 200).length, 1);
  for (const r of res.filter((x) => x.status !== 200)) assert.ok(['ACCONTO_DOPPIO', 'ACCONTO_SUPERA_RESIDUO'].includes(r.data.code), JSON.stringify(r.data));
  const cur = (await a('GET', `/api/orders/${o.id}`)).data;
  assert.equal(Number(cur.paid), 100);
  assert.equal(Number(cur.deposit), 100);
});

test('nessuna rotta risponde 500 con id inesistenti, corpi vuoti, null o array (e ogni 500 ha il riferimento)', async () => {
  const routes = apps.admin.routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api'));
  const seen = new Set();
  const bodies = [undefined, '{}', '[1,2]', 'null', '{"name":"Z","label":"Z","title":"Z","description":"Z","brand_model":"Z","number":"Z1","amount":5,"total":5,"qty":1,"unit_price":5,"method":"contanti","customer_id":99999,"repair_id":99999,"supplier_id":99999,"device_id":99999,"purchase_id":99999,"sale_id":99999,"items":[{"description":"Z","name":"Z","qty":1,"unit_price":5}]}'];
  const SKIP = /publish|backup|restore|shutdown|reset|wipe|import-demo|seed|\/(products|sales)$/i; // products/sales (logic.mjs/app.mjs): FK generica con fornitore/cliente inesistente, fuori da questo giro
  const bad = [];
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key) || SKIP.test(r.path)) continue;
    seen.add(key);
    const url = r.path.replace(/:[A-Za-z_]+(\{[^}]*\})?\??/g, '99999');
    for (const b of (['GET', 'DELETE'].includes(r.method) ? [undefined] : bodies)) {
      const res = await apps.admin.request(url, { method: r.method, headers: { 'content-type': 'application/json' }, body: b });
      if (res.status >= 500) bad.push(`${res.status} ${r.method} ${url} body=${b ?? '-'}`);
      else if (res.status === 409 && (await res.clone().text()).includes('DATI_COLLEGATI')) bad.push(`FK generica ${r.method} ${url} body=${b ?? '-'}`);
    }
  }
  assert.deepEqual(bad, []);
});
