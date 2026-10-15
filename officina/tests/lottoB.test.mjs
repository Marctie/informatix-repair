// Test lotto B: catalogo modelli, storico riparazioni, riparazioni esterne, prestiti (muletto), note stile Keep.  Esecuzione: npm run test:officina
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-lottob-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { closeDb, raw } = await import('../db-node.mjs');
const { createAdminApp } = await import('../app.mjs');
const { MODEL_SEED_COUNT } = await import('../seed/modelli.mjs');
const { parseCsv } = await import('../modelli.mjs');
const { memoryMedia } = await import('../media.mjs');
const { draftPublisher } = await import('../publisher.mjs');

const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => memoryMedia() },
  auth: async (c, next) => { const role = c.req.header('x-role'); if (role) c.set('user', { email: `${role}@test.it`, role }); await next(); },
});
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (method, path, body, role) => {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...(role ? { 'x-role': role } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text(), res };
};
const day = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const newRepair = async (extra = {}) => (await call('POST', '/api/repairs', { customer: { name: 'Mario Rossi', phone: `33311${Math.floor(10000 + Math.random() * 89999)}` }, brand_model: 'iPhone 12', problem: 'Display rotto', ...extra })).data;

// ---------- Catalogo modelli ----------
test('catalogo: popolato dall analisi di mercato, suggerimenti dalla terza lettera', async () => {
  assert.ok(MODEL_SEED_COUNT > 700, 'catalogo di partenza ampio');
  assert.deepEqual((await call('GET', '/api/modelli/suggest?q=ip')).data.rows, [], 'sotto le 3 lettere nessun suggerimento');
  const ip = (await call('GET', '/api/modelli/suggest?q=iph')).data.rows;
  assert.ok(ip.length > 10 && ip.every((m) => /iphone/i.test(m.label)));
  const s21 = (await call('GET', '/api/modelli/suggest?q=samsung s21')).data.rows;
  assert.ok(s21.length && s21.every((m) => m.brand === 'Samsung' && /S21/.test(m.model)), 'piu parole: marca + modello');
  assert.equal(s21[0].label.startsWith('Samsung Galaxy'), true, 'testo da inserire con la marca');
  const mac = (await call('GET', '/api/modelli/suggest?q=macbook&kind=portatile')).data.rows;
  assert.ok(mac.length && mac.every((m) => m.kind === 'portatile'));
  assert.ok((await call('GET', '/api/modelli/suggest?q=thinkpad')).data.rows.some((m) => m.brand === 'Lenovo'));
  assert.ok((await call('GET', '/api/modelli/suggest?q=galaxy tab')).data.rows.some((m) => m.kind === 'tablet'));
  const meta = (await call('GET', '/api/modelli/meta')).data;
  assert.equal(meta.suggest_min, 3);
  const brands = (await call('GET', '/api/modelli/brands')).data.map((b) => b.brand);
  for (const b of ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Motorola', 'OnePlus', 'Google', 'Honor', 'Nokia', 'Sony', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'MSI']) assert.ok(brands.includes(b), b);
});

test('catalogo: scheda riparazione con modello nuovo lo aggiunge; modello noto aumenta l uso', async () => {
  const before = (await call('GET', '/api/modelli')).data.rows.length;
  const known = await newRepair({ brand_model: 'iPhone 12' });
  assert.equal(known.model_added, null);
  assert.equal((await call('GET', '/api/modelli')).data.rows.length, before, 'iPhone 12 e gia nel catalogo');
  assert.equal(raw.prepare("SELECT uses FROM device_models WHERE model = 'iPhone 12'").get().uses, 1);
  const fresh = await newRepair({ brand_model: 'Samsung Galaxy S99 Prova', device_type: 'smartphone' });
  assert.equal(fresh.model_added.brand, 'Samsung');
  assert.equal(fresh.model_added.model, 'Galaxy S99 Prova');
  assert.equal(fresh.brand_model, 'Samsung Galaxy S99 Prova', 'repairs.brand_model resta il testo scritto');
  const viaKeyword = await newRepair({ brand_model: 'Galaxy Z Prova 7', device_type: 'smartphone' });
  assert.equal(viaKeyword.model_added.brand, 'Samsung', 'Galaxy -> Samsung dalle parole chiave');
  const newBrand = await newRepair({ brand_model: 'Zorbatron Z1 Pro', device_type: 'tablet' });
  assert.equal(newBrand.model_added.brand, 'Zorbatron');
  assert.equal(newBrand.model_added.kind, 'tablet');
  assert.ok((await call('GET', '/api/modelli/suggest?q=zorbatron')).data.rows.length === 1);
  // la seconda scheda con lo stesso modello non lo duplica
  assert.equal((await newRepair({ brand_model: 'zorbatron z1 pro', device_type: 'tablet' })).model_added, null);
  assert.equal((await call('GET', '/api/modelli')).data.rows.length, before + 3);
  assert.equal((await call('GET', '/api/modelli?source=auto')).data.rows.length, 3);
});

test('catalogo: CRUD completo, doppioni, import ed export CSV', async () => {
  const bad = await call('POST', '/api/modelli', { brand: '', model: 'X' });
  assert.equal(bad.status, 400);
  const m = (await call('POST', '/api/modelli', { kind: 'smartphone', brand: 'Marca Prova', model: 'Modello 1', keywords: 'pippo' })).data;
  assert.ok(m.id);
  assert.equal(m.source, 'manuale');
  assert.equal((await call('POST', '/api/modelli', { kind: 'smartphone', brand: 'marca prova', model: 'MODELLO 1' })).status, 409, 'doppione senza badare alle maiuscole');
  assert.equal((await call('GET', '/api/modelli/suggest?q=pippo')).data.rows.length, 1, 'ricerca anche per parola chiave');
  const up = (await call('PUT', `/api/modelli/${m.id}`, { kind: 'tablet', brand: 'Marca Prova', model: 'Modello 2', keywords: '' })).data;
  assert.equal(up.kind, 'tablet');
  assert.equal(up.model, 'Modello 2');
  assert.equal((await call('GET', '/api/modelli?q=marca prova&kind=tablet')).data.rows.length, 1);
  assert.equal((await call('PUT', '/api/modelli/99999', { brand: 'A', model: 'B' })).status, 404);

  // CSV: intestazione facoltativa, separatore ; o , e virgolette
  const csv = 'Tipo;Marca;Modello;Parole chiave\r\nTelefono;Marca Prova;"Modello ""Pro"" 3";x y\r\nportatile;Marca Prova;Book 1;\r\nnonvalido;Marca Prova;Boh;\r\ntablet;Marca Prova;Modello 2;\r\n';
  const imp = (await call('POST', '/api/modelli/import', { csv })).data;
  assert.equal(imp.added, 2);
  assert.equal(imp.skipped, 1, 'Modello 2 esiste gia');
  assert.equal(imp.error_count, 1);
  assert.equal(parseCsv('a,b\n1,"x,y"').length, 2);
  const exp = await call('GET', '/api/modelli/export.csv?brand=Marca%20Prova');
  assert.match(exp.res.headers.get('content-disposition'), /catalogo-modelli\.csv/);
  assert.match(exp.data, /Modello ""Pro"" 3/);
  assert.equal(exp.data.trim().split(/\r?\n/).length, 4, 'intestazione + 3 modelli');
  // elimina
  assert.equal((await call('DELETE', `/api/modelli/${m.id}`)).status, 200);
  assert.equal((await call('DELETE', `/api/modelli/${m.id}`)).status, 404);
  // ripristino del catalogo di partenza: rimette solo quelli cancellati
  const del = raw.prepare("SELECT id FROM device_models WHERE source = 'catalogo' AND model = 'iPhone 13'").get();
  await call('DELETE', `/api/modelli/${del.id}`);
  assert.equal((await call('POST', '/api/modelli/ripristina')).data.added, 1);
});

// ---------- Storico ----------
test('storico: elenco con dettagli, filtri, totali, CSV e scheda; il ruolo cassa non vede i costi', async () => {
  const a = await newRepair({ customer: { name: 'Anna Verdi', phone: '3335550001' }, brand_model: 'Samsung Galaxy A54', serial: 'SN-STO-1', problem: 'Batteria', quote: 80 });
  const b = await newRepair({ customer: { name: 'Bruno Neri', phone: '3335550002' }, brand_model: 'HP Pavilion 15', device_type: 'portatile', problem: 'Non si accende' });
  await call('POST', `/api/repairs/${a.id}/parts`, { name: 'Batteria A54', qty: 1, unit_price: 40, unit_cost: 15 });
  await call('POST', '/api/esterne', { repair_id: a.id, lab_name: 'Lab Esterno', work: 'Micro-saldatura', cost: 10, status: 'rientrata' });
  assert.equal((await call('POST', `/api/repairs/${a.id}/deliver`, { final_price: 90, method: 'contanti' })).status, 200);
  const all = (await call('GET', '/api/storico')).data;
  assert.ok(all.rows.length >= 2);
  const ra = all.rows.find((r) => r.id === a.id);
  assert.equal(ra.customer_name, 'Anna Verdi');
  assert.equal(ra.outcome, 'Riparato e consegnato');
  assert.equal(ra.amount, 90);
  assert.equal(ra.parts_cost, 15);
  assert.equal(ra.external_cost, 10);
  assert.equal(ra.margin, 65);
  assert.equal(ra.external_count, 1);
  assert.equal((await call('GET', '/api/storico?customer=verdi')).data.rows.length, 1);
  assert.equal((await call('GET', '/api/storico?brand=samsung&status=chiuse')).data.rows.length, 1);
  assert.equal((await call('GET', '/api/storico?model=pavilion')).data.rows[0].id, b.id);
  assert.equal((await call('GET', '/api/storico?q=SN-STO-1')).data.rows.length, 1);
  assert.equal((await call('GET', '/api/storico?status=aperte&device_type=portatile')).data.rows.length, 1);
  assert.equal((await call('GET', `/api/storico?from=${day(1)}`)).data.rows.length, 0, 'periodo');
  assert.equal((await call('GET', `/api/storico?from=${day(-1)}&to=${day(1)}`)).data.rows.length, all.rows.length);
  assert.equal((await call('GET', '/api/storico?status=chiuse')).data.totals.margin, 65);
  const det = (await call('GET', `/api/storico/${a.id}`)).data;
  assert.equal(det.parts.length, 1);
  assert.equal(det.externals[0].lab, 'Lab Esterno');
  const csv = await call('GET', '/api/storico/export.csv?brand=samsung');
  assert.match(csv.res.headers.get('content-disposition'), /storico-riparazioni\.csv/);
  assert.match(csv.data, /Anna Verdi/);
  assert.match(csv.data, /Costo ricambi/);
  // ruolo cassa: niente costi ne margini, ne in elenco, ne in CSV
  const cas = (await call('GET', '/api/storico', null, 'cassa')).data;
  assert.equal(JSON.stringify(cas).includes('parts_cost'), false);
  assert.equal(JSON.stringify(cas).includes('margin'), false);
  assert.equal('external_cost' in cas.rows[0], false);
  const casCsv = (await call('GET', '/api/storico/export.csv', null, 'cassa')).data;
  assert.equal(/Costo ricambi|Margine/.test(casCsv), false);
});

// ---------- Riparazioni esterne ----------
test('riparazioni esterne: invio, rientro, costo, ritardo e avviso', async () => {
  const r = await newRepair({ brand_model: 'Xiaomi Redmi Note 12' });
  assert.equal((await call('POST', '/api/esterne', { repair_id: r.id, work: 'Chip' })).status, 400, 'serve il laboratorio');
  const sup = (await call('POST', '/api/suppliers', { name: 'Lab Napoli' })).data;
  const e = (await call('POST', '/api/esterne', { repair_id: r.id, supplier_id: sup.id, work: 'Ricostruzione scheda madre', expected_back: day(-2), notes: 'Urgente' })).data;
  assert.equal(e.lab, 'Lab Napoli');
  assert.equal(e.status, 'da_inviare');
  const sent = (await call('POST', `/api/esterne/${e.id}/invia`, { date: day(-5) })).data;
  assert.equal(sent.status, 'inviata');
  assert.equal(sent.sent_at, day(-5));
  assert.equal(sent.late, true);
  assert.equal(sent.days_out, 5);
  const alerts = (await call('GET', '/api/alerts')).data.items;
  assert.ok(alerts.some((a) => a.type === 'external_late' && a.ref === e.id), 'avviso in campanella');
  const list = (await call('GET', '/api/esterne?stato=in_ritardo')).data;
  assert.equal(list.rows.length, 1);
  assert.equal(list.late, 1);
  assert.equal((await call('POST', `/api/esterne/${e.id}/rientro`, { cost: '35,50', date: day(-1) })).data.cost, 35.5);
  assert.equal((await call('GET', '/api/esterne?stato=aperte')).data.rows.length, 0);
  assert.equal((await call('GET', `/api/esterne?repair_id=${r.id}&stato=rientrata`)).data.rows.length, 1);
  assert.equal((await call('GET', '/api/alerts')).data.items.some((a) => a.type === 'external_late'), false, 'rientrata: niente piu avviso');
  const bad = await call('PUT', `/api/esterne/${e.id}`, { returned_at: day(-9), sent_at: day(-5) });
  assert.equal(bad.status, 400, 'rientro prima dell invio');
  const ev = (await call('GET', `/api/repairs/${r.id}`)).data.events.map((x) => x.note).join('|');
  assert.match(ev, /Lab Napoli/);
  assert.equal((await call('POST', '/api/esterne', { repair_id: 99999, lab_name: 'X' })).status, 400);
  assert.equal((await call('DELETE', `/api/esterne/${e.id}`)).status, 200);
  assert.equal((await call('GET', `/api/esterne/${e.id}`)).status, 404);
  // cancellando la riparazione se ne va anche l'esterna (collegamento ON DELETE CASCADE)
  const x = (await call('POST', '/api/esterne', { repair_id: r.id, lab_name: 'Lab B', cost: 5 })).data;
  raw.prepare('DELETE FROM repairs WHERE id = ?').run(r.id);
  assert.equal((await call('GET', `/api/esterne/${x.id}`)).status, 404);
});

// ---------- Prestiti / muletto ----------
test('prestiti: muletto legato alla riparazione, scadenza, avviso se non rientra', async () => {
  const r = await newRepair({ brand_model: 'Samsung Galaxy S21', eta_date: day(-3) });
  const dev = (await call('POST', '/api/dispositivi', { brand_model: 'Samsung A13 muletto', category: 'nuovo', serial: 'MULETTO-0001' })).data;
  assert.equal((await call('POST', '/api/prestiti', { label: 'X' })).status, 400, 'serve riparazione o cliente');
  const l = (await call('POST', '/api/prestiti', { device_id: dev.id, repair_id: r.id, lent_at: day(-4) })).data;
  assert.equal(l.label, 'Samsung A13 muletto', 'nome dal registro dispositivi');
  assert.equal(l.due_at, day(-3), 'scadenza = consegna stimata della riparazione');
  assert.equal(l.customer_name, 'Mario Rossi');
  assert.equal(l.late, true);
  assert.equal(l.late_days, 3);
  assert.equal((await call('POST', '/api/prestiti', { device_id: dev.id, repair_id: r.id })).status, 409, 'lo stesso muletto non si presta due volte');
  assert.equal((await call('GET', `/api/prestiti/disponibili?q=muletto`)).data.length, 0, 'fuori: non disponibile');
  const al = (await call('GET', '/api/alerts')).data.items.find((a) => a.type === 'loan_late');
  assert.ok(al, 'avviso di prestito scaduto');
  assert.equal((await call('GET', '/api/prestiti?stato=scaduti')).data.rows.length, 1);
  assert.equal((await call('GET', `/api/prestiti?repair_id=${r.id}`)).data.rows.length, 1);
  // la riparazione viene consegnata ma il muletto e' ancora fuori: avviso diverso e piu' forte
  await call('POST', `/api/repairs/${r.id}/deliver`, { final_price: 50, method: 'contanti' });
  assert.ok((await call('GET', '/api/alerts')).data.items.some((a) => a.type === 'loan_repair_done'));
  assert.equal((await call('POST', `/api/prestiti/${l.id}/rientro`, { returned_at: day(-10) })).status, 400, 'rientro prima della consegna');
  const back = (await call('POST', `/api/prestiti/${l.id}/rientro`, { condition_back: 'Graffio sul retro' })).data;
  assert.equal(back.status, 'rientrato');
  assert.equal(back.returned_at, day(0));
  assert.equal((await call('POST', `/api/prestiti/${l.id}/rientro`, {})).status, 409);
  assert.equal((await call('GET', '/api/alerts')).data.items.some((a) => /^loan_/.test(a.type)), false);
  assert.equal((await call('GET', '/api/prestiti/disponibili?q=muletto')).data.length, 1, 'rientrato: di nuovo disponibile');
  const lib = (await call('POST', '/api/prestiti', { label: 'Portatile vecchio', customer_id: r.customer_id, lent_at: day(0), due_at: day(7) })).data;
  assert.equal(lib.late, false);
  assert.equal((await call('POST', '/api/prestiti', { label: 'Y', customer_id: r.customer_id, lent_at: day(0), due_at: day(-1) })).status, 400, 'scadenza prima della consegna');
  assert.equal((await call('GET', '/api/prestiti')).data.out, 1);
  assert.equal((await call('DELETE', `/api/prestiti/${lib.id}`)).status, 200);
});

// ---------- Note ----------
test('note stile Keep: colore, fissate in alto, elenco con caselle, archivio, ricerca', async () => {
  assert.equal((await call('POST', '/api/note', { title: '', body: '' })).status, 400, 'nota vuota');
  const n1 = (await call('POST', '/api/note', { title: 'Ordinare cavi', body: 'USB-C da 1 metro', color: 'rosa' })).data;
  const n2 = (await call('POST', '/api/note', { title: 'Spesa negozio', items: [{ t: 'Carta', d: 0 }, { t: 'Caffe', d: 1 }, { t: '  ', d: 0 }], color: 'inventato' })).data;
  assert.equal(n2.color, 'giallo', 'colore sconosciuto -> giallo');
  assert.equal(n2.items.length, 2, 'voci vuote scartate');
  assert.equal(n2.items[1].d, 1);
  const pin = (await call('PUT', `/api/note/${n1.id}`, { pinned: true })).data;
  assert.equal(pin.pinned, true);
  assert.equal(pin.color, 'rosa', 'modifica parziale: il resto resta');
  assert.equal((await call('GET', '/api/note')).data.rows[0].id, n1.id, 'le fissate stanno in cima');
  const done = (await call('PUT', `/api/note/${n2.id}`, { items: [{ t: 'Carta', d: 1 }, { t: 'Caffe', d: 1 }] })).data;
  assert.ok(done.items.every((i) => i.d === 1));
  assert.equal((await call('GET', '/api/note?q=caffe')).data.rows.length, 1, 'ricerca anche dentro le caselle');
  assert.equal((await call('GET', '/api/note?q=usb')).data.rows.length, 1);
  assert.equal((await call('GET', '/api/note?color=rosa')).data.rows.length, 1);
  const arc = (await call('PUT', `/api/note/${n1.id}`, { archived: true })).data;
  assert.equal(arc.archived, true);
  assert.equal(arc.pinned, false, 'archiviando si toglie il fissato');
  assert.equal((await call('GET', '/api/note')).data.rows.some((n) => n.id === n1.id), false);
  const ar = (await call('GET', '/api/note?archivio=1')).data;
  assert.equal(ar.rows.length, 1);
  assert.equal((await call('DELETE', `/api/note/${n1.id}`)).status, 200);
  assert.equal((await call('GET', `/api/note/${n1.id}`)).status, 404);
});

test('backup: le tabelle del lotto B sono nella copia', async () => {
  const { dumpAll } = await import('../app.mjs');
  const d = await dumpAll();
  for (const t of ['device_models', 'external_repairs', 'loans', 'notes']) assert.ok(Array.isArray(d.tables[t]), t);
});
