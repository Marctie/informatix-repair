// Test di import fatture, storico prezzi e avvisi.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'officina-acq-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const { parseFattura, parseXml } = await import('../fatturapa.mjs');
const { parsers } = await import('../purchases.mjs');
const { describeEvent } = await import('../notify.mjs');

const fx = (name) => readFileSync(join(HERE, 'fixtures', name), 'utf8');
const TECH = fx('fattura-techparts.xml');
const NAPOLI = fx('fattura-napoli.xml');

let admin, A;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};
// versione della fattura con data/numero diversi (per simulare ordini successivi)
const variant = (xml, { number, date, prices = {} }) => {
  let x = xml.replace(/<Numero>[^<]*<\/Numero>/, `<Numero>${number}</Numero>`).replace(/<Data>[^<]*<\/Data>/, `<Data>${date}</Data>`);
  for (const [from, to] of Object.entries(prices)) x = x.replaceAll(from, to);
  return x;
};

// ---------- Parser ----------
test('parser: fattura con prefisso, sconto, due aliquote, codici e caratteri speciali', () => {
  const f = parseFattura(TECH, 'IT01234567890_00001.xml');
  assert.equal(f.supplier.name, 'TechParts Italia S.r.l.');
  assert.equal(f.supplier.vat, '01234567890');
  assert.match(f.supplier.address, /Via Roma 12.*Milano/);
  assert.deepEqual([f.doc.number, f.doc.date, f.doc.total, f.doc.type], ['FT/2026/118', '2026-09-10', 284.67, 'TD01']);
  assert.equal(f.doc.notes, 'Ordine del 05/09 & consegna express');
  assert.equal(f.lines.length, 4);
  const [d, b, c, m] = f.lines;
  assert.equal(d.code, 'DSP-IP13-TP');
  assert.equal(d.qty, 2);
  assert.equal(d.list_price, 62);
  assert.equal(d.unit_price, 58.9, 'prezzo netto dopo lo sconto del 5%');
  assert.equal(d.discount, 5);
  assert.equal(b.description, 'Batteria 3110 mAh per iPhone 11 & compatibili');
  assert.equal(c.code, 'CAV-1M');
  assert.equal(c.ean, '8051234567890');
  assert.match(c.description, /«premium» è robusto/);
  assert.equal(m.code, null);
  assert.equal(m.vat_rate, 10);
  assert.equal(f.vat_summary.length, 2);
  assert.deepEqual(f.warnings, []);
});

test('parser: fattura senza prefisso, senza codici né sconti, con CDATA e DDT', () => {
  const f = parseFattura(NAPOLI);
  assert.equal(f.supplier.name, 'Ricambi Napoli Srl');
  assert.equal(f.lines.length, 4);
  assert.ok(f.lines.every((l) => l.code === null && l.discount === 0));
  assert.equal(f.lines[0].description, 'Display iPhone 13 qualità originale');
  assert.equal(f.lines[3].description, 'Cavo "Lightning" <MFi> 1 m');
  assert.deepEqual(f.ddt, [{ number: 'DDT-5521', date: '2026-09-21' }]);
  assert.deepEqual(f.warnings, []);
});

test('parser: importi incoerenti segnalati, file .p7m e non XML rifiutati', () => {
  const bad = NAPOLI.replace('<ImportoTotaleDocumento>145.91<', '<ImportoTotaleDocumento>199.00<');
  assert.ok(parseFattura(bad).warnings.some((w) => /incoerenti/i.test(w)));
  assert.throws(() => parseFattura(NAPOLI, 'IT123.xml.p7m'), /p7m/i);
  assert.throws(() => parseFattura('0\u0082\u0001\u0002\u0006\u0009binario'), /p7m|firmato/i);
  assert.throws(() => parseFattura('questo non è xml'), /non è un XML/);
  assert.throws(() => parseFattura('<Altro><x/></Altro>'), /non è una fattura/);
  assert.throws(() => parseFattura('<FatturaElettronica><a></FatturaElettronica>'), /XML non valido/);
});

test('parser XML: entità definite nel file non vengono espanse (nessun rischio di esplosione)', () => {
  const x = '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY b "BOOM"><!ENTITY c "&b;&b;&b;">]><a>&c; &#232; &amp; <![CDATA[<x>]]></a>';
  const n = parseXml(x);
  assert.equal(n.text.trim(), '&c; è & <x>');
});

test('lettori: DDT/PDF è un segnaposto che dice "formato non ancora supportato"', async () => {
  assert.equal(parsers.fatturapa.supported, true);
  assert.equal(parsers.ddt_pdf.supported, false);
  const r = await a('POST', '/api/purchases/preview', { xml: '%PDF-1.4 ...', filename: 'ddt.pdf' });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /non ancora supportato/i);
  const p7 = await a('POST', '/api/purchases/preview', { xml: 'x', filename: 'fattura.xml.p7m' });
  assert.equal(p7.status, 400);
  assert.match(p7.data.error, /\.p7m/);
  assert.equal((await a('POST', '/api/purchases/preview', {})).status, 400);
});

// ---------- Flusso di import ----------
test('preview non scrive nulla; fornitore e prodotti nuovi', async () => {
  const before = (await a('GET', '/api/products')).data.length;
  const r = await a('POST', '/api/purchases/preview', { xml: TECH, filename: 'f.xml' });
  assert.equal(r.status, 200);
  assert.equal(r.data.supplier.match, null);
  assert.equal(r.data.supplier.will_create, true);
  assert.equal(r.data.lines.length, 4);
  assert.ok(r.data.lines.every((l) => l.suggested.action === 'new'));
  assert.equal((await a('GET', '/api/purchases')).data.length, 0);
  assert.equal((await a('GET', '/api/suppliers')).data.length, 0);
  assert.equal((await a('GET', '/api/products')).data.length, before);
});

test('conferma: crea fornitore e prodotti, carica il magazzino, salva lo storico, non si importa due volte', async () => {
  const r = await a('POST', '/api/purchases/confirm', { xml: TECH });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.supplier_created, true);
  assert.equal(r.data.lines_count, 4);
  assert.equal(r.data.new_products, 4);
  const sups = (await a('GET', '/api/suppliers')).data;
  assert.equal(sups.length, 1);
  const prods = (await a('GET', '/api/products?q=Display iPhone 13')).data;
  assert.equal(prods.length, 1);
  assert.equal(prods[0].qty, 2);
  assert.equal(prods[0].cost, 58.9);
  const moves = (await a('GET', `/api/products/${prods[0].id}/moves`)).data;
  assert.equal(moves[0].reason, 'carico fattura FT/2026/118');
  assert.equal(moves[0].delta, 2);
  const list = (await a('GET', '/api/purchases')).data;
  assert.equal(list.length, 1);
  assert.equal(list[0].total, 284.67);
  assert.equal(list[0].lines_count, 4);
  const det = (await a('GET', `/api/purchases/${list[0].id}`)).data;
  assert.equal(det.lines[0].unit_price, 58.9);
  // doppione: bloccato, magazzino invariato
  const dup = await a('POST', '/api/purchases/confirm', { xml: TECH });
  assert.equal(dup.status, 409);
  assert.match(dup.data.error, /già importato/i);
  assert.equal((await a('GET', '/api/products?q=Display iPhone 13')).data[0].qty, 2);
  const pv = await a('POST', '/api/purchases/preview', { xml: TECH });
  assert.ok(pv.data.duplicate);
  assert.ok(pv.data.warnings.some((w) => /già stato importato/.test(w)));
});

test('secondo fornitore: abbinamento per nome simile, scelte dell\'utente, spese accessorie ignorate', async () => {
  const pv = (await a('POST', '/api/purchases/preview', { xml: NAPOLI })).data;
  assert.equal(pv.supplier.match, null, 'è un fornitore diverso');
  const byDesc = (re) => pv.lines.find((l) => re.test(l.description));
  const disp = byDesc(/^Display/);
  assert.equal(disp.suggested.action, 'match');
  assert.equal(disp.suggested.by, 'nome simile');
  assert.equal(disp.prev, null, 'con questo fornitore non ci sono acquisti precedenti');
  assert.equal(byDesc(/trasporto/).suggested.action, 'skip');
  const prodId = disp.suggested.product_id;
  const battId = byDesc(/^Batteria/).suggested.product_id;
  const r = await a('POST', '/api/purchases/confirm', {
    xml: NAPOLI,
    lines: [{ n: 1, action: 'match', product_id: prodId, qty: 1 }, { n: 2, action: 'match', product_id: battId, qty: 2 }, { n: 4, action: 'new', name: 'Cavo Lightning 1 m', price: 9.9, qty: 1 }],
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.lines_count, 3);
  assert.equal(r.data.new_products, 1);
  assert.equal((await a('GET', '/api/suppliers')).data.length, 2);
  assert.equal((await a('GET', '/api/products?q=Display iPhone 13')).data[0].qty, 3);
  assert.equal((await a('GET', '/api/products?q=Batteria 3110')).data[0].qty, 5 + 2);
  const lig = (await a('GET', '/api/products?q=Lightning')).data[0];
  assert.equal(lig.price, 9.9);
  assert.equal(lig.cost, 5);
});

test('ordini successivi: codice fornitore, variazione di prezzo, storico e minimo', async () => {
  // TechParts di nuovo, un mese dopo, display da 62 a 66 (lordo) e batteria da 13,50 a 12,00
  const x2 = variant(TECH, { number: 'FT/2026/150', date: '2026-10-08', prices: { '<PrezzoUnitario>62.00000000': '<PrezzoUnitario>66.00000000', '117.80000000': '125.40000000', '<PrezzoUnitario>13.50000000</PrezzoUnitario><PrezzoTotale>67.50000000': '<PrezzoUnitario>12.00000000</PrezzoUnitario><PrezzoTotale>60.00000000' } });
  const pv = (await a('POST', '/api/purchases/preview', { xml: x2 })).data;
  assert.equal(pv.supplier.match.by, 'vat');
  const disp = pv.lines[0];
  assert.equal(disp.suggested.by, 'codice fornitore');
  assert.equal(disp.prev.unit_price, 58.9);
  assert.equal(disp.unit_price, 62.7);
  assert.equal(disp.prev.direction, 'up');
  assert.equal(disp.prev.abs, 3.8);
  assert.equal(disp.prev.pct, 6.5);
  assert.equal(pv.lines[1].prev.direction, 'down');
  const r = await a('POST', '/api/purchases/confirm', { xml: x2 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.new_products, 0);
  assert.equal(r.data.changes.length, 2);
  const prod = (await a('GET', '/api/products?q=Display iPhone 13')).data[0];
  assert.equal(prod.qty, 5);
  assert.equal(prod.cost, 62.7);

  const prices = (await a('GET', `/api/purchases/prices?product_id=${prod.id}`)).data;
  assert.equal(prices.series.length, 3);
  assert.deepEqual(prices.series.map((p) => p.price), [58.9, 64, 62.7]);
  assert.equal(prices.suppliers.length, 2);
  assert.equal(prices.lowest.price, 58.9);
  assert.equal(prices.lowest.supplier_name, 'TechParts Italia S.r.l.');
  assert.equal(prices.cheapest_now.supplier_name, 'TechParts Italia S.r.l.');
  const tp = prices.suppliers.find((s) => /TechParts/.test(s.supplier_name));
  assert.deepEqual([tp.prev_price, tp.last_price, tp.direction], [58.9, 62.7, 'up']);
  const napoli = prices.suppliers.find((s) => /Napoli/.test(s.supplier_name));
  assert.equal(napoli.direction, null, 'un solo acquisto: nessuna variazione');

  const ch = (await a('GET', '/api/purchases/price-changes')).data;
  assert.equal(ch.length, 2);
  const up = ch.find((c) => c.direction === 'up');
  assert.equal(up.product_name, 'Display iPhone 13 OLED');
  assert.equal(up.supplier_name, 'TechParts Italia S.r.l.');
  assert.ok(ch.some((c) => c.direction === 'down' && c.pct === -11.1));
  const prodList = (await a('GET', '/api/purchases/products?q=display')).data;
  assert.equal(prodList.length, 1);
  assert.equal((await a('GET', '/api/purchases/prices?product_id=99999')).status, 404);
});

test('avvisi con ordine recente: ▲ più caro e ▼ più economico anche in /api/alerts', async () => {
  const d = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const mk = (n, p) => variant(NAPOLI, { number: n, date: d, prices: { '<PrezzoUnitario>64.00</PrezzoUnitario><PrezzoTotale>64.00': `<PrezzoUnitario>${p}</PrezzoUnitario><PrezzoTotale>${p}` } });
  const old = variant(NAPOLI, { number: 'N-OLD', date: '2026-01-15', prices: { '<PrezzoUnitario>64.00</PrezzoUnitario><PrezzoTotale>64.00': '<PrezzoUnitario>60.00</PrezzoUnitario><PrezzoTotale>60.00' } });
  assert.equal((await a('POST', '/api/purchases/confirm', { xml: old, lines: [{ n: 1, action: 'match', product_id: (await a('GET', '/api/products?q=Display iPhone 13')).data[0].id }] })).status, 200);
  const r = await a('POST', '/api/purchases/confirm', { xml: mk('N-NEW', '66.00'), lines: [{ n: 1, action: 'match', product_id: (await a('GET', '/api/products?q=Display iPhone 13')).data[0].id }] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  // la data "old" è precedente a quella dell'ordine di settembre: la serie resta ordinata per data
  const own = (await a('GET', '/api/purchases/alerts')).data;
  const hit = own.items.find((i) => i.type === 'price_up' && /Napoli/.test(i.title));
  assert.ok(hit, JSON.stringify(own));
  assert.match(hit.detail, /64,00 € → 66,00 €/);
  assert.match(hit.detail, /\+2,00 €, \+3,1%/);
  assert.match(hit.title, /▲ più caro/);
  assert.match(hit.link, /#\/acquisti\?product=\d+/);
  const bell = (await a('GET', '/api/alerts')).data;
  assert.ok(bell.items.some((i) => i.type === 'price_up'));
});

test('notifica Telegram: acquisto importato con totale, righe e variazioni oltre il 5%', () => {
  const t = describeEvent({
    method: 'POST', path: '/api/purchases/confirm', status: 200, user: { email: 'x@y.it' },
    result: { supplier_name: 'TechParts', doc_number: 'FT/1', total: 284.67, lines_count: 4, new_products: 1, changes: [
      { product_name: 'Display iPhone 13', supplier_name: 'TechParts', direction: 'up', prev_price: 58, price: 62, pct: 6.9 },
      { product_name: 'Cavo', supplier_name: 'TechParts', direction: 'up', prev_price: 1.5, price: 1.55, pct: 3.3 }] },
  });
  assert.match(t, /Acquisto importato/);
  assert.match(t, /284,67/);
  assert.match(t, /4 righe/);
  assert.match(t, /Display iPhone 13/);
  assert.doesNotMatch(t, /Cavo/);
});

test('demo: acquisti con id negativi e prezzi variabili; eliminazione demo li cancella', async () => {
  assert.equal((await a('POST', '/api/demo')).status, 200);
  const list = (await a('GET', '/api/purchases')).data;
  assert.ok(list.filter((p) => p.id < 0).length >= 5);
  const disp = (await a('GET', '/api/products?q=Display iPhone 13 (DEMO)')).data[0];
  const pr = (await a('GET', `/api/purchases/prices?product_id=${disp.id}`)).data;
  assert.ok(pr.suppliers.length >= 2 && pr.series.length >= 5);
  assert.ok(pr.suppliers.some((s) => s.direction === 'up' && s.pct > 5));
  const al = (await a('GET', '/api/purchases/alerts')).data;
  assert.ok(al.items.some((i) => /DEMO/.test(i.title)));
  // un nuovo import verso un fornitore demo si abbina per partita IVA
  const demoSup = variant(NAPOLI, { number: 'X-1', date: '2026-10-01' }).replace('05678901234', '00000000011').replace('Ricambi Napoli Srl', 'Altro nome');
  const pv = (await a('POST', '/api/purchases/preview', { xml: demoSup })).data;
  assert.equal(pv.supplier.match.by, 'vat');
  assert.ok(pv.supplier.match.id < 0);
  assert.equal((await a('DELETE', '/api/demo')).status, 200);
  const after = (await a('GET', '/api/purchases')).data;
  assert.ok(after.every((p) => p.id > 0));
  assert.ok(after.length >= 4, 'gli acquisti veri restano');
  // il fornitore con acquisti non si elimina
  const sup = (await a('GET', '/api/suppliers')).data[0];
  assert.equal((await a('DELETE', `/api/suppliers/${sup.id}`)).status, 409);
});

test('backup JSON include le tabelle degli acquisti', async () => {
  const { dumpAll } = await import('../app.mjs');
  const b = await dumpAll();
  for (const t of ['purchases', 'purchase_lines', 'price_history', 'supplier_codes', 'supplier_info']) assert.ok(Array.isArray(b.tables[t]), t);
});
