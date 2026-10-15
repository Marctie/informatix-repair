// Test: import di DDT / fatture PDF (testo estratto) con documenti SINTETICI di piu' impaginazioni, anteprima corretta a mano e apprendimento del formato.
// Nessun modello reale e' ancora disponibile: i testi qui sotto imitano le impaginazioni piu' comuni (colonne separate da 2+ spazi, come le produce pdftext.js).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-ddt-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const D = await import('../ddt.mjs');
const { rowsFromItems } = await import('../public/pdftext.js');

let admin, A;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });
const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};

/** Partita IVA valida a partire dalle prime 10 cifre. */
const mkVat = (d10) => { let sum = 0; for (let i = 0; i < 10; i += 1) { let d = Number(d10[i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; } return d10 + String((10 - (sum % 10)) % 10); };
const VAT_A = mkVat('0123456789');
const VAT_B = mkVat('0987654321');
const OWN = mkVat('0555555555');

// Impaginazione A: DDT con prezzi, tabella con intestazione, colonne a 2+ spazi
const DOC_A = `TECNOFORNITURE SRL
Via Roma 12
84014 Nocera Inferiore (SA)
P.IVA ${VAT_A}   Tel. 081 123 4567
DOCUMENTO DI TRASPORTO (D.D.T.)
Numero         Data
123/A          12/10/2026
Destinatario
INFORMATIX REPAIR
Via Pecorari 178 Nocera Superiore
P.IVA ${OWN}
Codice      Descrizione                      UM    Q.tà    Prezzo      Importo
DSP-IP12    Display iPhone 12 OLED           PZ    2       45,00       90,00
BAT-S21     Batteria Samsung S21             PZ    5       12,50       62,50
            compatibile originale
CVR-001     Cover silicone universale        PZ    10      1,20        12,00
Totale merce  164,50
Trasporto a cura del mittente
`;

// Impaginazione B: DDT NON valorizzato (senza prezzi), numero e data sulla stessa riga, colonne diverse
const DOC_B = `RICAMBI SUD DISTRIBUZIONE S.p.A.
Z.I. Contrada Pagliarone 5 - 80100 Napoli
Partita IVA: IT${VAT_B}
BOLLA DI CONSEGNA N. 4567 del 03/10/2026
Spett.le INFORMATIX REPAIR
Cod. Art.    Descrizione                   Q.tà  UM
5901234      Flat display Xiaomi Redmi 9   3     NR
FPC-USB-C    Connettore ricarica USB-C     8     NR
`;

// Impaginazione C: fattura con sconto e IVA, colonne in ordine diverso
const DOC_C = `GRUPPO ELETTRONICA ITALIA SRL
Via dei Mille 3, 00100 Roma
P.IVA ${mkVat('0246813579')}
FATTURA N. FT-2026-88  del 15/10/2026
Spett.le Informatix Repair
Articolo      Descrizione                  Q.tà   Prezzo    Sc.%   IVA    Importo
LCD-A52       Schermo LCD Samsung A52      2      60,00     10     22     108,00
CHG-30W       Caricatore rapido 30W        4      9,90      0      22     39,60
Imponibile 147,60
Totale documento 180,07
`;

// Impaginazione D: tutto con spazi singoli (nessuna colonna riconoscibile)
const DOC_D = `FORNITURE TELEFONIA SNC
P.IVA ${mkVat('0192837465')}
D.D.T. n. 77 del 02/10/26
Codice Descrizione Q.ta Prezzo Importo
LNS-33 Lente fotocamera iPhone 13 4 3,50 14,00
GLS-15 Vetro temperato iPhone 15 10 0,80 8,00
Totale 22,00
`;

test('numeri, date e partita IVA', () => {
  assert.equal(D.parseNum('1.234,56'), 1234.56);
  assert.equal(D.parseNum('12,50'), 12.5);
  assert.equal(D.parseNum('12.50'), 12.5);
  assert.equal(D.parseNum('€ 3,00'), 3);
  assert.equal(D.parseNum('22%'), 22);
  assert.equal(D.parseNum('1.000'), 1000);
  assert.equal(D.parseNum('1,234.50'), 1234.5);
  assert.equal(D.parseNum('abc'), null);
  assert.equal(D.parseNum('12,'), null);
  assert.equal(D.parseDate('12/10/2026'), '2026-10-12');
  assert.equal(D.parseDate('02.10.26'), '2026-10-02');
  assert.equal(D.parseDate('31/02/2026'), null);
  assert.equal(D.vatValid(VAT_A), true);
  assert.equal(D.vatValid(VAT_A.slice(0, 10) + (VAT_A[10] === '0' ? '1' : '0')), false);
  assert.equal(D.vatValid(`IT${VAT_B}`), true);
});

test('impaginazione A: DDT con prezzi e intestazione di colonna', () => {
  const p = D.parseDdtText(DOC_A);
  assert.equal(p.supplier.name, 'TECNOFORNITURE SRL');
  assert.equal(p.supplier.vat, VAT_A, 'la P.IVA del destinatario non va scambiata col fornitore');
  assert.match(p.supplier.address, /Via Roma 12/);
  assert.equal(p.supplier.phone, '081 123 4567');
  assert.equal(p.doc.type, 'DDT');
  assert.equal(p.doc.number, '123/A');
  assert.equal(p.doc.date, '2026-10-12');
  assert.equal(p.lines.length, 3);
  assert.deepEqual(p.lines.map((l) => [l.code, l.qty, l.unit_price, l.line_total]), [['DSP-IP12', 2, 45, 90], ['BAT-S21', 5, 12.5, 62.5], ['CVR-001', 10, 1.2, 12]]);
  assert.equal(p.lines[1].description, 'Batteria Samsung S21 compatibile originale', 'riga di continuazione unita');
  assert.equal(p.lines[0].source, 'header');
  assert.equal(p.doc.total, 164.5);
  assert.deepEqual(p.warnings, []);
});

test('impaginazione B: DDT non valorizzato (senza prezzi), numero e data in riga, codice numerico', () => {
  const p = D.parseDdtText(DOC_B);
  assert.equal(p.supplier.name, 'RICAMBI SUD DISTRIBUZIONE S.p.A.');
  assert.equal(p.supplier.vat, VAT_B);
  assert.equal(p.doc.number, '4567');
  assert.equal(p.doc.date, '2026-10-03');
  assert.deepEqual(p.lines.map((l) => [l.code, l.description, l.qty, l.unit]), [['5901234', 'Flat display Xiaomi Redmi 9', 3, 'NR'], ['FPC-USB-C', 'Connettore ricarica USB-C', 8, 'NR']]);
  assert.ok(p.lines.every((l) => l.unit_price === 0 && l.issues.some((i) => /prezzo mancante/.test(i))));
  assert.ok(p.warnings.some((w) => /non ci sono prezzi/.test(w)));
});

test('impaginazione C: fattura con sconto e IVA', () => {
  const p = D.parseDdtText(DOC_C);
  assert.equal(p.doc.type, 'TD01');
  assert.equal(p.doc.number, 'FT-2026-88');
  assert.equal(p.doc.date, '2026-10-15');
  assert.equal(p.lines.length, 2);
  const l = p.lines[0];
  assert.deepEqual([l.code, l.qty, l.unit_price, l.vat_rate, l.line_total], ['LCD-A52', 2, 60, 22, 108]);
  assert.equal(p.doc.total, 180.07);
});

test('impaginazione D: spazi singoli, righe lette parola per parola, data a due cifre', () => {
  const p = D.parseDdtText(DOC_D);
  assert.equal(p.doc.number, '77');
  assert.equal(p.doc.date, '2026-10-02');
  assert.deepEqual(p.lines.map((l) => [l.code, l.qty, l.unit_price, l.line_total]), [['LNS-33', 4, 3.5, 14], ['GLS-15', 10, 0.8, 8]]);
  assert.equal(p.lines[0].description, 'Lente fotocamera iPhone 13');
});

test('testo vuoto o senza righe: messaggi chiari, nessun crash', () => {
  assert.throws(() => D.parseDdtText('   '), /scansione/);
  const p = D.parseDdtText('Documento qualunque\nniente di utile qui');
  assert.equal(p.lines.length, 0);
  assert.ok(p.warnings.some((w) => /righe di articoli/.test(w)));
  assert.throws(() => D.normalizeParsed({ supplier: { name: 'X' }, doc: { number: '1', date: '2026-10-01' }, lines: [] }), /almeno una riga/);
});

test('estrazione lato browser: voci di testo -> righe con colonne (pdftext.js)', () => {
  const items = [
    { str: 'Codice', x: 40, y: 700, w: 40 }, { str: 'Descrizione', x: 120, y: 700, w: 70 }, { str: 'Q.tà', x: 320, y: 700, w: 25 },
    { str: 'ABC-1', x: 40, y: 680, w: 35 }, { str: 'Cavo', x: 120, y: 680, w: 25 }, { str: 'HDMI', x: 147, y: 680, w: 30 }, { str: '3', x: 322, y: 680, w: 6 },
  ];
  const text = rowsFromItems(items);
  assert.deepEqual(text.split('\n'), ['Codice  Descrizione  Q.tà', 'ABC-1  Cavo HDMI  3']);
});

// ---------- API: anteprima, correzione a mano, conferma, apprendimento ----------
test('API: anteprima PDF, correzione a mano e conferma; il formato viene imparato e riusato', async () => {
  await a('POST', '/api/suppliers', { name: 'Tecnoforniture' });
  const prod = (await a('POST', '/api/products', { name: 'Display iPhone 12 OLED', sku: 'DSP-IP12', qty: 1, price: 99 })).data;

  const pv = (await a('POST', '/api/purchases/preview', { pdf_text: DOC_A, filename: 'ddt-123.pdf' })).data;
  assert.equal(pv.source, 'ddt_pdf');
  assert.equal(pv.supplier.parsed.vat, VAT_A);
  assert.equal(pv.supplier.match?.name, 'Tecnoforniture', 'fornitore riconosciuto dal nome');
  assert.equal(pv.editable.lines.length, 3);
  assert.equal(pv.lines[0].suggested.product_id, prod.id, 'abbinato per codice articolo');

  // senza correzioni a mano: errori chiari
  const bad = JSON.parse(JSON.stringify(pv.editable));
  bad.doc.number = '';
  assert.equal((await a('POST', '/api/purchases/preview', { parsed: bad })).status, 400);
  bad.doc.number = '123/A'; bad.lines[0].qty = 'abc';
  assert.equal((await a('POST', '/api/purchases/preview', { parsed: bad })).status, 400);

  // l'utente corregge: quantita' della prima riga e prezzo della terza
  const fixed = JSON.parse(JSON.stringify(pv.editable));
  fixed.lines[0].qty = 3; fixed.lines[2].unit_price = 1.5;
  const pv2 = (await a('POST', '/api/purchases/preview', { parsed: fixed })).data;
  assert.equal(pv2.lines[0].qty, 3);
  assert.equal(pv2.lines[2].line_total, 15);

  const res = (await a('POST', '/api/purchases/confirm', { parsed: fixed, lines: pv2.lines.map((l) => ({ n: l.n, action: l.suggested.action === 'match' ? 'match' : 'new', product_id: l.suggested.product_id, name: l.description, qty: l.qty })) })).data;
  assert.equal(res.ok, true);
  assert.equal(res.learned, true, 'il formato del fornitore è stato salvato');
  assert.equal(res.lines_count, 3);
  assert.equal((await a('GET', `/api/products/${prod.id}/moves`)).data[0].delta, 3);
  // stesso documento due volte: rifiutato
  assert.equal((await a('POST', '/api/purchases/confirm', { parsed: fixed })).status, 409);

  const formats = (await a('GET', '/api/purchases/formats')).data;
  assert.equal(formats.length, 1);
  assert.equal(formats[0].supplier_key, `vat:${VAT_A}`);
  assert.ok(formats[0].layouts >= 1);

  // un secondo documento dello stesso fornitore usa il formato imparato
  const DOC_A2 = DOC_A.replace('123/A', '124/A').replace('DSP-IP12', 'DSP-IP13').replace('Display iPhone 12 OLED', 'Display iPhone 13 OLED');
  const again = (await a('POST', '/api/purchases/preview', { pdf_text: DOC_A2 })).data;
  assert.equal(again.editable.meta.learned, true);
  assert.ok(again.editable.lines.some((l) => l.source === 'learned'));
  assert.equal(again.editable.lines[0].code, 'DSP-IP13');

  // dimenticare il formato
  assert.equal((await a('DELETE', `/api/purchases/formats/${formats[0].id}`)).status, 200);
  assert.equal((await a('GET', '/api/purchases/formats')).data.length, 0);
  assert.equal((await a('DELETE', '/api/purchases/formats/999')).status, 404);
});

test('apprendimento: una colonna in posizione insolita, corretta dall\'utente, viene capita la volta dopo', async () => {
  // layout senza intestazione con prezzo PRIMA della quantita' (le euristiche sbagliano), corretto a mano
  const vat = mkVat('0314159265');
  const mk = (num, code) => `OFFICINA RICAMBI ZETA SRL\nP.IVA ${vat}\nD.D.T. n. ${num} del 05/10/2026\n${code}    Pellicola vetro  2,50    8    PZ\n${code}B    Cover trasparente  1,10    20    PZ\n`;
  const first = (await a('POST', '/api/purchases/preview', { pdf_text: mk(10, 'PLV-1') })).data;
  const ed = first.editable;
  // il lettore a euristiche ha letto qty/prezzo scambiati: l'utente li corregge
  ed.lines[0].qty = 8; ed.lines[0].unit_price = 2.5; ed.lines[1].qty = 20; ed.lines[1].unit_price = 1.1;
  const pv = (await a('POST', '/api/purchases/preview', { parsed: ed })).data;
  const ok = (await a('POST', '/api/purchases/confirm', { parsed: ed, lines: pv.lines.map((l) => ({ n: l.n, action: 'new', name: l.description, qty: l.qty })) })).data;
  assert.equal(ok.learned, true);
  const second = (await a('POST', '/api/purchases/preview', { pdf_text: mk(11, 'PLV-2') })).data;
  assert.deepEqual(second.editable.lines.map((l) => [l.qty, l.unit_price, l.source]), [[8, 2.5, 'learned'], [20, 1.1, 'learned']]);
});

test('XML delle fatture elettroniche: il flusso esistente non cambia', async () => {
  const r = await a('POST', '/api/purchases/preview', { xml: '<non xml', filename: 'x.xml' });
  assert.equal(r.status, 400);
  assert.equal((await a('GET', '/api/purchases/parsers')).data.find((p) => p.id === 'ddt_pdf').supported, true);
});
