// Test delle etichette prodotto e dei codici a barre: EAN-13, template, anteprima/stampa, ricerca dal codice letto e vendita con scarico.
// Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-etich-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { createAdminApp } = await import('../app.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const B = await import('../barcode.mjs');
const E = await import('../etichette.mjs');

let admin, A, cassa;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
  cassa = createAdminApp({ auth: async (c, next) => { c.set('user', { email: 'cassa@test.it', name: 'Cassa', role: 'cassa' }); await next(); } });
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text(), headers: res.headers };
};
const asCassa = async (method, path, body) => {
  const res = await cassa.request(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const product = async (extra = {}) => (await a('POST', '/api/products', { name: 'Articolo di prova', qty: 10, cost: 2, price: 9.9, ...extra })).data;

test('EAN-13: cifra di controllo, moduli e codice interno', () => {
  assert.equal(B.eanCheckDigit('400638133393'), 1);
  assert.equal(B.eanCheckDigit('590123412345'), 7);
  assert.ok(B.isEan13('4006381333931'));
  assert.ok(!B.isEan13('4006381333930'));
  assert.ok(!B.isEan13('12345'));
  const bits = B.ean13Modules('4006381333931');
  assert.equal(bits.length, 95);
  assert.ok(bits.startsWith('101') && bits.endsWith('101') && bits.slice(45, 50) === '01010');
  assert.throws(() => B.ean13Modules('4006381333930'));
  const code = B.internalEan(123);
  assert.equal(code, '2000000001234');
  assert.ok(B.isEan13(code));
  assert.equal(B.idFromInternalEan(code), 123);
  assert.equal(B.idFromInternalEan('4006381333931'), null, 'un EAN di un produttore non e\' un codice interno');
  assert.equal(B.barcodeKind('4006381333931'), 'ean13');
  assert.equal(B.barcodeKind('ABC-1'), 'code128');
  const svg = B.barcodeBoxSvg('ABC-123');
  assert.ok(svg.svg.startsWith('<svg') && svg.modules > 50 && svg.kind === 'code128');
});

test('template: il primo viene creato da solo e ha logo, nome, prezzo e codice a barre', async () => {
  const r = await a('GET', '/api/labels/templates');
  assert.equal(r.status, 200);
  assert.equal(r.data.templates.length, 1);
  const t = r.data.templates[0];
  assert.equal(t.is_default, true);
  assert.equal(t.width, 62);
  assert.equal(t.height, 30);
  const on = t.elements.filter((e) => e.on).map((e) => e.type);
  for (const k of ['logo', 'name', 'price', 'barcode', 'code']) assert.ok(on.includes(k), `manca ${k}`);
  assert.ok(r.data.presets.length >= 10);
  assert.equal((await a('GET', '/api/labels/templates')).data.templates.length, 1, 'non si ricrea a ogni apertura');
});

test('template: crea, modifica, predefinito, elimina; errori chiari', async () => {
  const base = (await a('GET', '/api/labels/templates')).data.templates[0];
  const mk = (over = {}) => ({ name: 'Cavi 50 × 30', width: 50, height: 30, layout: 'roll', elements: base.elements, ...over });
  const c = await a('POST', '/api/labels/templates', mk());
  assert.equal(c.status, 200);
  assert.equal(c.data.width, 50);
  assert.equal(c.data.is_default, false);
  assert.equal((await a('POST', '/api/labels/templates', mk({ name: '' }))).data.code, 'ETICHETTA_NOME_MANCANTE');
  assert.equal((await a('POST', '/api/labels/templates', mk({ width: 5 }))).data.code, 'ETICHETTA_MISURE_NON_VALIDE');
  assert.equal((await a('POST', '/api/labels/templates', mk({ elements: base.elements.map((e) => ({ ...e, on: false })) }))).data.code, 'ETICHETTA_VUOTA');
  assert.equal((await a('POST', '/api/labels/templates', mk({ elements: [{ type: 'pippo', on: true }] }))).data.code, 'ETICHETTA_ELEMENTO_NON_VALIDO');
  const up = await a('PUT', `/api/labels/templates/${c.data.id}`, mk({ name: 'Cavi rinominato', height: 25 }));
  assert.equal(up.data.name, 'Cavi rinominato');
  assert.equal(up.data.height, 25);
  assert.equal((await a('PUT', '/api/labels/templates/9999', mk())).status, 404);
  const def = await a('POST', `/api/labels/templates/${c.data.id}/default`);
  assert.equal(def.data.is_default, true);
  const list = (await a('GET', '/api/labels/templates')).data.templates;
  assert.equal(list.filter((t) => t.is_default).length, 1);
  // eliminando il predefinito ne passa il ruolo a un altro
  assert.equal((await a('DELETE', `/api/labels/templates/${c.data.id}`)).status, 200);
  const after2 = (await a('GET', '/api/labels/templates')).data.templates;
  assert.equal(after2.length, 1);
  assert.equal(after2[0].is_default, true);
  // l'ultimo template non si elimina
  assert.equal((await a('DELETE', `/api/labels/templates/${after2[0].id}`)).data.code, 'ETICHETTA_ULTIMA');
});

test('template: foglio A4 controlla che le etichette ci stiano', async () => {
  const base = (await a('GET', '/api/labels/templates')).data.templates[0];
  const sheet = (over) => ({ name: 'Foglio 70×37', width: 70, height: 37, layout: 'sheet', sheet: { cols: 3, rows: 8, top: 0, left: 0, gap_x: 0, gap_y: 0 }, elements: base.elements, ...over });
  const ok = await a('POST', '/api/labels/templates', sheet());
  assert.equal(ok.status, 200);
  assert.equal(ok.data.layout, 'sheet');
  assert.equal((await a('POST', '/api/labels/templates', sheet({ sheet: { cols: 4, rows: 8, top: 0, left: 0, gap_x: 0, gap_y: 0 } }))).data.code, 'ETICHETTA_FOGLIO_NON_VALIDO');
  await a('DELETE', `/api/labels/templates/${ok.data.id}`);
});

test('anteprima: disegna nome, prezzo, codice a barre e avvisa se il codice e\' troppo stretto', async () => {
  const base = (await a('GET', '/api/labels/templates')).data.templates[0];
  const p = await product({ name: 'Vetro temperato iPhone 15', price: 12.9 });
  const r = await a('POST', '/api/labels/preview', { template: base, product_id: p.id });
  assert.equal(r.status, 200);
  assert.ok(r.data.html.includes('Vetro temperato iPhone 15'));
  assert.ok(r.data.html.includes('€ 12,90'));
  assert.ok(r.data.html.includes('<svg'));
  assert.ok(r.data.html.includes(B.internalEan(p.id)), 'senza codice assegnato usa quello interno');
  assert.deepEqual(r.data.warnings, []);
  assert.ok(r.data.css.includes('.lab'));
  // codice a barre stretto: 20 mm per 113 moduli = 0,18 mm
  const narrow = { ...base, elements: base.elements.map((e) => (e.type === 'barcode' ? { ...e, w: 20 } : e)) };
  const w = (await a('POST', '/api/labels/preview', { template: narrow })).data.warnings;
  assert.ok(w.some((x) => /troppo stretto/.test(x)), 'avviso mancante');
  // l'html e' sempre sicuro: il nome non puo' iniettare tag
  const evil = await product({ name: '<img src=x onerror=alert(1)>' });
  const ev = (await a('POST', '/api/labels/preview', { template: base, product_id: evil.id })).data.html;
  assert.ok(!ev.includes('<img src=x') && ev.includes('&lt;img'));
});

test('testi lunghi: il corpo si riduce, poi si avvisa', async () => {
  const base = (await a('GET', '/api/labels/templates')).data.templates[0];
  const longName = 'Cavo di ricarica rapida intrecciato USB-C a Lightning certificato MFi 2 metri nero opaco';
  const p = await product({ name: longName });
  const r = (await a('POST', '/api/labels/preview', { template: base, product_id: p.id })).data;
  const size = Number(r.html.match(/data-el="name"[^>]*><span style="font-size:([\d.]+)pt/)[1]);
  assert.ok(size < 9, `corpo non ridotto (${size})`);
});

test('codice a barre dell\'articolo: unico, salvato, cercabile', async () => {
  const p = await product({ name: 'Custodia con EAN', barcode: ' 4006381333931 ' });
  assert.equal(p.barcode, '4006381333931');
  const dup = await a('POST', '/api/products', { name: 'Altro articolo', qty: 1, price: 1, barcode: '4006381333931' });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.code, 'CODICE_GIA_USATO');
  assert.ok(dup.data.error.includes('Custodia con EAN'));
  assert.equal((await a('POST', '/api/products', { name: 'Codice sporco', qty: 1, price: 1, barcode: 'ciao\u0001' })).data.code, 'CODICE_NON_VALIDO');
  // la modifica senza il campo non lo cancella; con il campo vuoto lo toglie
  const keep = await a('PUT', `/api/products/${p.id}`, { name: 'Custodia con EAN', price: 5 });
  assert.equal(keep.data.barcode, '4006381333931');
  // un articolo puo' tenere il proprio codice quando lo si salva di nuovo
  assert.equal((await a('PUT', `/api/products/${p.id}`, { name: 'Custodia con EAN', price: 5, barcode: '4006381333931' })).status, 200);
  assert.ok((await a('GET', '/api/products?q=4006381333')).data.some((x) => x.id === p.id), 'la ricerca testuale trova anche il codice');
  const t = await a('PUT', `/api/products/${p.id}`, { name: 'Custodia con EAN', price: 5, barcode: '' });
  assert.equal(t.data.barcode, null);
  await a('PUT', `/api/products/${p.id}`, { name: 'Custodia con EAN', price: 5, barcode: '4006381333931' });
});

test('lettura del codice: barcode, UPC-A, SKU, codice interno, fornitore, archiviato, sconosciuto', async () => {
  const p = (await a('GET', '/api/products?q=Custodia con EAN')).data[0];
  const f = async (code) => a('GET', `/api/products/by-code/${encodeURIComponent(code)}`);
  const byBarcode = await f('4006381333931');
  assert.equal(byBarcode.data.id, p.id);
  assert.equal(byBarcode.data.via, 'barcode');
  // un UPC-A (12 cifre) letto come EAN-13 ha uno 0 davanti: lo si trova lo stesso
  const upc = await product({ name: 'Articolo UPC', barcode: '012345678905' });
  assert.equal((await f('0012345678905')).data.id, upc.id);
  assert.equal((await f('012345678905')).data.id, upc.id);
  // SKU (senza distinguere maiuscole)
  const sku = await product({ name: 'Articolo con SKU', sku: 'CAV-USBC-1' });
  const bySku = await f('cav-usbc-1');
  assert.equal(bySku.data.id, sku.id);
  assert.equal(bySku.data.via, 'sku');
  // codice interno: vale anche senza averlo salvato
  const internal = await product({ name: 'Articolo interno' });
  const byInternal = await f(B.internalEan(internal.id));
  assert.equal(byInternal.data.id, internal.id);
  assert.equal(byInternal.data.via, 'interno');
  // codice del fornitore (tabella dei codici letti dalle fatture)
  const sup = (await a('POST', '/api/suppliers', { name: 'Fornitore codici' })).data;
  const { db } = await import('../dbref.mjs');
  await db.prepare('INSERT INTO supplier_codes (supplier_id, supplier_code, product_id) VALUES (?,?,?)').run(sup.id, 'FORN-778', internal.id);
  assert.equal((await f('FORN-778')).data.id, internal.id);
  // sconosciuto e archiviato
  const none = await f('9999999999999');
  assert.equal(none.status, 404);
  assert.equal(none.data.code, 'CODICE_NON_TROVATO');
  const old = await product({ name: 'Articolo vecchio', barcode: 'OLD-1' });
  await a('DELETE', `/api/products/${old.id}`);
  const arch = await f('OLD-1');
  assert.equal(arch.status, 409);
  assert.equal(arch.data.code, 'ARTICOLO_ARCHIVIATO');
  // doppioni segnalati
  const d1 = await product({ name: 'Doppione 1', sku: 'DUP-1' });
  await product({ name: 'Doppione 2', sku: 'DUP-1' });
  const dd = await f('DUP-1');
  assert.equal(dd.data.id, d1.id);
  assert.equal(dd.data.duplicates, 1);
});

test('cassa: la vendita con l\'articolo letto scarica la giacenza', async () => {
  const p = await product({ name: 'Cavo venduto da scanner', qty: 5, price: 9.9 });
  const found = (await a('GET', `/api/products/by-code/${B.internalEan(p.id)}`)).data;
  assert.equal(found.id, p.id);
  assert.equal(found.price, 9.9);
  const sale = await a('POST', '/api/sales', { items: [{ product_id: found.id, qty: 2 }], method: 'contanti' });
  assert.equal(sale.status, 200);
  assert.equal(sale.data.total, 19.8);
  assert.equal((await a('GET', `/api/products?q=Cavo venduto`)).data[0].qty, 3);
});

test('stampa: prepara i codici, apre la pagina con le etichette giuste', async () => {
  const p1 = await product({ name: 'Stampa uno', price: 3 });
  const p2 = await product({ name: 'Stampa due', price: 4.5, barcode: 'MIO-CODICE-2' });
  const prep = await a('POST', '/api/labels/prepare', { items: [{ product_id: p1.id, qty: 3 }, { product_id: p2.id, qty: 2 }] });
  assert.equal(prep.status, 200);
  assert.equal(prep.data.count, 5);
  assert.equal(prep.data.articles, 2);
  assert.equal(prep.data.assigned, 1, 'solo l\'articolo senza codice riceve quello interno');
  assert.equal((await a('GET', `/api/products?q=Stampa uno`)).data[0].barcode, B.internalEan(p1.id));
  const html = (await a('GET', prep.data.url)).data;
  assert.equal((html.match(/class="lab/g) || []).length, 5);
  assert.ok(html.includes('Stampa uno') && html.includes('Stampa due'));
  assert.ok(html.includes('@page{size:62mm 30mm;margin:0}'));
  assert.ok(html.includes('window.print()'));
  assert.ok(!(await a('GET', prep.data.url + '&noprint=1')).data.includes('addEventListener("load"'), 'noprint = niente stampa automatica');
  // errori parlanti
  assert.equal((await a('GET', '/print/labels?items=abc')).status, 400);
  assert.equal((await a('GET', '/print/labels')).status, 400);
  assert.equal((await a('GET', '/print/labels?items=999999:1')).status, 404);
  assert.equal((await a('POST', '/api/labels/prepare', { items: [] })).status, 400);
  assert.equal((await a('GET', '/print/labels?items=1:9999')).status, 400);
});

test('stampa su foglio A4: salta le posizioni gia\' usate', async () => {
  const base = (await a('GET', '/api/labels/templates')).data.templates[0];
  const t = (await a('POST', '/api/labels/templates', { name: 'Foglio', width: 70, height: 37, layout: 'sheet', sheet: { cols: 3, rows: 8, top: 0, left: 0, gap_x: 0, gap_y: 0 }, elements: base.elements })).data;
  const p = await product({ name: 'Su foglio' });
  const prep = await a('POST', '/api/labels/prepare', { items: [{ product_id: p.id, qty: 2 }], template_id: t.id, skip: 4 });
  const html = (await a('GET', prep.data.url)).data;
  assert.ok(html.includes('@page{size:A4;margin:0}'));
  assert.equal((html.match(/class="lab"/g) || []).length, 4 + 2, '4 posizioni vuote saltate + 2 etichette');
  assert.equal((html.match(/data-el="name"/g) || []).length, 2, 'solo 2 etichette hanno il nome: le altre 4 sono posizioni vuote');
  await a('DELETE', `/api/labels/templates/${t.id}`);
});

test('assegna i codici a tutti gli articoli che non ce l\'hanno', async () => {
  const x = await product({ name: 'Senza codice A' });
  await product({ name: 'Senza codice B' });
  const r = await a('POST', '/api/labels/assign-missing');
  assert.equal(r.status, 200);
  assert.ok(r.data.assigned >= 2);
  assert.equal((await a('GET', '/api/products?q=Senza codice A')).data[0].barcode, B.internalEan(x.id));
  assert.equal((await a('POST', '/api/labels/assign-missing')).data.assigned, 0, 'la seconda volta non c\'e\' piu\' nulla da fare');
});

test('logo personalizzato: solo PNG, si carica, si legge, si toglie', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  assert.equal((await a('PUT', '/api/labels/logo', { data_url: 'data:image/jpeg;base64,AAAA' })).data.code, 'LOGO_NON_VALIDO');
  assert.equal((await a('PUT', '/api/labels/logo', { data_url: 'data:image/png;base64,' + Buffer.from('non sono un png, solo testo lungo abbastanza da passare il controllo di lunghezza minima').toString('base64') })).data.code, 'LOGO_NON_VALIDO');
  const ok = await a('PUT', '/api/labels/logo', { data_url: 'data:image/png;base64,' + png });
  assert.equal(ok.status, 200);
  const img = await fetch(`${A}/api/labels/logo/custom`);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await img.arrayBuffer()).slice(1, 4).toString(), 'PNG');
  assert.equal((await a('GET', '/api/labels/templates')).data.logo.custom, true);
  assert.equal((await a('DELETE', '/api/labels/logo')).status, 200);
  assert.equal((await a('GET', '/api/labels/templates')).data.logo.custom, false);
  for (const w of ['word', 'full']) assert.equal((await fetch(`${A}/api/labels/logo/${w}`)).status, 200);
});

test('ruolo Cassa: puo\' stampare e cercare per codice ma non cambiare i template', async () => {
  const base = (await a('GET', '/api/labels/templates')).data.templates[0];
  assert.equal((await asCassa('GET', '/api/labels/templates')).status, 200);
  assert.equal((await asCassa('POST', '/api/labels/templates', { ...base, name: 'Hack' })).status, 403);
  assert.equal((await asCassa('PUT', `/api/labels/templates/${base.id}`, base)).status, 403);
  assert.equal((await asCassa('DELETE', `/api/labels/templates/${base.id}`)).status, 403);
  assert.equal((await asCassa('PUT', '/api/labels/logo', { data_url: 'x' })).status, 403);
  assert.equal((await asCassa('POST', '/api/labels/assign-missing')).status, 403);
  const p = await product({ name: 'Visto da cassa', cost: 3 });
  const found = await asCassa('GET', `/api/products/by-code/${B.internalEan(p.id)}`);
  assert.equal(found.status, 200);
  assert.equal(found.data.id, p.id);
  assert.ok(!('cost' in found.data), 'la Cassa non deve ricevere il costo d\'acquisto');
  const prep = await asCassa('POST', '/api/labels/prepare', { items: [{ product_id: p.id, qty: 1 }] });
  assert.equal(prep.status, 200);
});

test('codici lettura: le varianti del codice', () => {
  assert.deepEqual(E.codeVariants('0012345678905').sort(), ['0012345678905', '012345678905'].sort());
  assert.deepEqual(E.codeVariants('012345678905').sort(), ['0012345678905', '012345678905'].sort());
  assert.deepEqual(E.codeVariants('ABC'), ['ABC']);
});
