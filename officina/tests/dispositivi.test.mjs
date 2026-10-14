// Test di dispositivi, buoni/pagamento diviso, documenti d'identita' e credenziali fornitori.  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-disp-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.VAULT_KEY = 'chiave-di-prova-solo-per-i-test-0123456789'; // chiave finta: la vera sta nei segreti del Worker

const { closeDb, raw } = await import('../db-node.mjs');
const { createAdminApp } = await import('../app.mjs');
const { encryptText, decryptText } = await import('../vault.mjs');
const { imeiValid } = await import('../dispositivi.mjs');
const { memoryMedia } = await import('../media.mjs');
const { draftPublisher } = await import('../publisher.mjs');

// Postazione con ruolo scelto dal test (intestazione x-role): serve a provare i permessi
const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => memoryMedia() },
  auth: async (c, next) => { const role = c.req.header('x-role'); if (role) c.set('user', { email: `${role}@test.it`, role }); await next(); },
});
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (method, path, body, role) => {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...(role ? { 'x-role': role } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : ct.includes('image') ? new Uint8Array(await res.arrayBuffer()) : await res.text(), res };
};
const GOOD_IMEI = '490154203237518'; // IMEI di esempio con cifra di controllo corretta

test('IMEI: cifra di controllo (Luhn)', () => {
  assert.equal(imeiValid(GOOD_IMEI), true);
  assert.equal(imeiValid('490154203237519'), false);
  assert.equal(imeiValid('ABC12345'), null); // non e' un IMEI: puo' essere un seriale
});

test('dispositivi: registro, doppioni, IMEI errato, storico e segnalazione "rubato" con avviso', async () => {
  assert.equal((await call('POST', '/api/dispositivi', { brand_model: 'iPhone 12', serial: '490154203237519' })).status, 400); // IMEI non valido
  const d = (await call('POST', '/api/dispositivi', { brand_model: 'iPhone 12', serial: GOOD_IMEI, category: 'usato', cost: 250, price: 349 })).data;
  assert.ok(d.id);
  const dup = await call('POST', '/api/dispositivi', { brand_model: 'Altro', serial: GOOD_IMEI.replace(/(\d{3})(\d{3})/, '$1 $2') });
  assert.equal(dup.status, 409, "lo stesso seriale scritto con spazi è un doppione");
  // segnalazione: serve il motivo
  assert.equal((await call('POST', `/api/dispositivi/${d.id}/segnala`, { flag: 'stolen' })).status, 400);
  const f = (await call('POST', `/api/dispositivi/${d.id}/segnala`, { flag: 'stolen', note: 'Denunciato dal proprietario', report_no: 'D-123' })).data;
  assert.equal(f.flag, 'stolen');
  assert.equal((await call('GET', `/api/dispositivi/check?serial=${GOOD_IMEI}`)).data.alert, true);
  assert.equal((await call('GET', '/api/dispositivi/check?serial=999999999999')).data.alert, false);
  // il seriale segnalato entra in riparazione: avviso nella risposta e nella scheda
  const rep = (await call('POST', '/api/repairs', { customer: { name: 'Mario Rossi', phone: '3331112222' }, brand_model: 'iPhone 12', serial: GOOD_IMEI, problem: 'Display rotto' })).data;
  assert.equal(rep.device_alerts.length, 1);
  assert.match(rep.device_alerts[0].flag_note, /Denunciato/);
  assert.ok(rep.events.some((e) => /ATTENZIONE/.test(e.note)), 'avviso scritto nella scheda (nota interna)');
  // ... e in vendita
  const sale = (await call('POST', '/api/sales', { items: [{ name: 'iPhone 12 usato', unit_price: 300, qty: 1, serial: GOOD_IMEI }], method: 'contanti' })).data;
  assert.equal(sale.device_alerts.length, 1);
  // storico per dispositivo: creato, segnalazione, riparazione, vendita + riparazione con lo stesso seriale
  const det = (await call('GET', `/api/dispositivi/${d.id}`)).data;
  const kinds = det.events.map((e) => e.kind);
  for (const k of ['creato', 'segnalazione', 'riparazione', 'vendita']) assert.ok(kinds.includes(k), `storico: ${k}`);
  assert.equal(det.repairs.length, 1);
  // togliere la segnalazione e' dell'amministratore
  assert.equal((await call('POST', `/api/dispositivi/${d.id}/segnala`, { flag: 'ok' }, 'staff')).status, 403);
  assert.equal((await call('POST', `/api/dispositivi/${d.id}/segnala`, { flag: 'ok' }, 'admin')).status, 200);
  // elenchi e CSV
  const list = (await call('GET', '/api/dispositivi?category=usato&q=iphone')).data;
  assert.equal(list.rows.length, 1);
  assert.equal(list.counts.usato, 1);
  const csv = (await call('GET', '/api/dispositivi/export.csv')).data;
  assert.match(csv, /iPhone 12/);
  assert.match(csv, new RegExp(GOOD_IMEI));
});

test('buoni: regalo con uso parziale, saldo, esaurito, scaduto, annullato', async () => {
  const v = (await call('POST', '/api/buoni', { kind: 'regalo', value: 50, code: 'regalo-50' })).data;
  assert.equal(v.code, 'REGALO-50');
  assert.equal((await call('POST', '/api/buoni', { kind: 'regalo', value: 10, code: 'REGALO-50' })).status, 409);
  // 1a vendita da 30: il buono ne copre 30 (pagamento "buono" visibile in cassa)
  const s1 = (await call('POST', '/api/sales', { items: [{ name: 'Cover', unit_price: 30 }], voucher_code: 'regalo-50' })).data;
  assert.equal(s1.total, 30);
  assert.equal(s1.method, 'buono');
  assert.deepEqual(s1.payments.map((p) => [p.method, p.amount]), [['buono', 30]]);
  assert.equal((await call('GET', `/api/buoni/${v.id}`)).data.balance, 20);
  // 2a vendita da 45: 20 col buono + 25 contanti
  const s2 = (await call('POST', '/api/sales', { items: [{ name: 'Caricatore', unit_price: 45 }], voucher_code: 'REGALO-50', method: 'contanti' })).data;
  assert.deepEqual(s2.payments.map((p) => [p.method, p.amount]), [['buono', 20], ['contanti', 25]]);
  const after = (await call('GET', `/api/buoni/${v.id}`)).data;
  assert.equal(after.balance, 0);
  assert.equal(after.state, 'esaurito');
  assert.equal(after.uses.length, 2);
  // esaurito: la vendita NON viene registrata
  const before = (await call('GET', '/api/sales')).data.length;
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'X', unit_price: 10 }], voucher_code: 'REGALO-50' })).status, 409);
  assert.equal((await call('GET', '/api/sales')).data.length, before);
  // scaduto e annullato
  await call('POST', '/api/buoni', { kind: 'regalo', value: 20, code: 'VECCHIO', expires_at: '2020-01-01' });
  assert.match((await call('GET', '/api/buoni/check?code=VECCHIO')).data.error, /scaduto/);
  const a = (await call('POST', '/api/buoni', { kind: 'regalo', value: 20, code: 'ANNULLA' })).data;
  assert.equal((await call('POST', `/api/buoni/${a.id}/annulla`, {}, 'staff')).status, 403);
  await call('POST', `/api/buoni/${a.id}/annulla`, {}, 'admin');
  assert.match((await call('GET', '/api/buoni/check?code=ANNULLA')).data.error, /annullato/);
  assert.equal((await call('GET', '/api/buoni/check?code=NONESISTE')).status, 404);
  // un buono usato non si elimina
  assert.equal((await call('DELETE', `/api/buoni/${v.id}`, undefined, 'admin')).status, 409);
});

test('buoni sconto: in euro e in percentuale riducono il totale, uso unico', async () => {
  await call('POST', '/api/buoni', { kind: 'sconto_percentuale', value: 10, code: 'DIECI' });
  await call('POST', '/api/buoni', { kind: 'sconto_importo', value: 15, code: 'QUINDICI' });
  const s1 = (await call('POST', '/api/sales', { items: [{ name: 'Cavo', unit_price: 50 }], voucher_code: 'dieci', method: 'carta' })).data;
  assert.equal(s1.total, 45);
  assert.equal(s1.discount, 5);
  assert.deepEqual(s1.payments.map((p) => [p.method, p.amount]), [['carta', 45]]);
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'Cavo', unit_price: 50 }], voucher_code: 'dieci' })).status, 409); // gia' usato
  const s2 = (await call('POST', '/api/sales', { items: [{ name: 'Cavo', unit_price: 10 }], voucher_code: 'QUINDICI' })).data;
  assert.equal(s2.total, 0); // lo sconto non puo' superare il totale
  assert.equal((await call('GET', '/api/buoni/check?code=QUINDICI')).data.balance, 5, 'il resto dello sconto resta sul buono');
  // i buoni usati compaiono nei totali di cassa
  const rep = (await call('GET', '/api/report')).data;
  assert.ok(rep.vouchers.discount >= 15 && rep.vouchers.credit >= 50 && rep.vouchers.n >= 4);
});

test('conto diviso: ogni quota registrata e visibile nei totali di cassa', async () => {
  const day = (await call('GET', '/api/report')).data;
  const t0 = day.total;
  const card0 = day.by_method.find((m) => m.method === 'carta')?.total || 0;
  const s = (await call('POST', '/api/sales', { items: [{ name: 'Tablet', unit_price: 30 }], payments: [{ method: 'carta', amount: 10, payer: 'Anna' }, { method: 'contanti', amount: '20,00', payer: 'Luca' }] })).data;
  assert.equal(s.method, 'diviso');
  assert.equal(s.payments.length, 2);
  assert.match(s.payments[0].label, /quota 1\/2 \(Anna\)/);
  const rep = (await call('GET', '/api/report')).data;
  assert.equal(Math.round((rep.total - t0) * 100), 3000, 'la somma delle quote entra nel totale di cassa');
  assert.equal(Math.round((rep.by_method.find((m) => m.method === 'carta').total - card0) * 100), 1000);
  // quote che non tornano / metodi nascosti: rifiutati, e la vendita non si registra
  const n = (await call('GET', '/api/sales')).data.length;
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'T', unit_price: 30 }], payments: [{ method: 'carta', amount: 10 }, { method: 'contanti', amount: 10 }] })).status, 400);
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'T', unit_price: 30 }], payments: [{ method: 'carta', amount: 10 }, { method: 'non tracciato', amount: 20 }] })).status, 400);
  assert.equal((await call('POST', '/api/sales', { items: [{ name: 'T', unit_price: 30 }], payments: [{ method: 'buono', amount: 30 }] })).status, 400);
  assert.equal((await call('GET', '/api/sales')).data.length, n);
  // diviso + buono insieme: buono 10 + carta 5 + contanti 5 su 20
  await call('POST', '/api/buoni', { kind: 'regalo', value: 10, code: 'DIECI-EURO' });
  const m = (await call('POST', '/api/sales', { items: [{ name: 'Mouse', unit_price: 20 }], voucher_code: 'DIECI-EURO', payments: [{ method: 'carta', amount: 5 }, { method: 'contanti', amount: 5 }] })).data;
  assert.deepEqual(m.payments.map((p) => p.amount), [10, 5, 5]);
  assert.equal(m.payments.reduce((a, p) => a + p.amount, 0), 20);
});

test('riparazione: saldo diviso su piu\' metodi con buono', async () => {
  const rep = (await call('POST', '/api/repairs', { customer: { name: 'Cliente Saldo', phone: '3339998888' }, brand_model: 'Portatile', problem: 'Non si accende', quote: 100, deposit: 20, deposit_method: 'contanti' })).data;
  await call('POST', '/api/buoni', { kind: 'regalo', value: 30, code: 'SALDO-30' });
  // saldo = 80: buono 30 + carta 30 + contanti 20
  const out = (await call('POST', `/api/repairs/${rep.id}/deliver`, { final_price: 100, voucher_code: 'SALDO-30', payments: [{ method: 'carta', amount: 30 }, { method: 'contanti', amount: 20 }] })).data;
  assert.equal(out.status, 'delivered');
  assert.equal(out.paid, 100);
  assert.equal(out.collected, 50);
  // quote sbagliate: non si consegna
  const rep2 = (await call('POST', '/api/repairs', { customer: { name: 'Cliente Due', phone: '3330001111' }, brand_model: 'Telefono', problem: 'Batteria', quote: 50 })).data;
  assert.equal((await call('POST', `/api/repairs/${rep2.id}/deliver`, { final_price: 50, payments: [{ method: 'carta', amount: 10 }] })).status, 400);
  assert.equal((await call('GET', `/api/repairs/${rep2.id}`)).data.status, 'received');
});

test('cassaforte: cifra e decifra, chiave sbagliata o mancante = errore chiaro', async () => {
  const c = { env: {} };
  const tok = await encryptText(c, 'segreto');
  assert.ok(tok.startsWith('v1.') && !tok.includes('segreto'));
  assert.equal(await decryptText(c, tok), 'segreto');
  assert.notEqual(await encryptText(c, 'segreto'), tok, 'IV diverso a ogni cifratura');
  await assert.rejects(() => decryptText({ env: { VAULT_KEY: 'un-altra-chiave-lunga-abbastanza' } }, tok), /VAULT_KEY/);
  const saved = process.env.VAULT_KEY;
  delete process.env.VAULT_KEY;
  try { await assert.rejects(() => encryptText(c, 'x'), /VAULT_KEY/); } finally { process.env.VAULT_KEY = saved; }
});

const B64_FAKE_PHOTO = Buffer.from('FOTO-FINTA-DEL-DOCUMENTO').toString('base64');
test('documenti d\'identita\': cifrati a riposo, accesso registrato, permessi e cancellazione confermata', async () => {
  const cust = (await call('POST', '/api/customers', { name: 'Giulia Verdi', phone: '3335550000' })).data;
  const body = { customer_id: cust.id, doc_type: 'carta_identita', purpose: 'acquisto_usato', data: { holder: 'Giulia Verdi', number: 'CA12345XY', expiry: '2031-05-01' }, consent: true, files: [{ side: 'fronte', mime: 'image/jpeg', data_b64: B64_FAKE_PHOTO }] };
  assert.equal((await call('POST', '/api/documenti', { ...body, consent: false })).status, 400, 'senza presa visione non si salva');
  assert.equal((await call('POST', '/api/documenti', { ...body, files: [{ side: 'fronte', mime: 'text/html', data_b64: B64_FAKE_PHOTO }] })).status, 400);
  // ruolo senza permesso (impostazione prudente: solo admin)
  assert.equal((await call('POST', '/api/documenti', body, 'cassa')).status, 403);
  const doc = (await call('POST', '/api/documenti', body, 'admin')).data;
  assert.ok(doc.id);
  // a riposo: nel database non c'e' nulla in chiaro
  const stored = JSON.stringify(raw.prepare('SELECT * FROM id_documents').all()) + JSON.stringify(raw.prepare('SELECT * FROM id_document_files').all());
  assert.ok(!stored.includes('CA12345XY') && !stored.includes('Giulia Verdi') && !stored.includes(B64_FAKE_PHOTO) && !stored.includes('2031-05-01'));
  // lettura: decifrata e registrata
  const got = (await call('GET', `/api/documenti/${doc.id}`, undefined, 'admin')).data;
  assert.equal(got.data.number, 'CA12345XY');
  const img = await call('GET', `/api/documenti/files/${got.files[0].id}`, undefined, 'admin');
  assert.equal(new TextDecoder().decode(img.data), 'FOTO-FINTA-DEL-DOCUMENTO');
  assert.equal(img.res.headers.get('cache-control'), 'no-store');
  assert.equal((await call('GET', `/api/documenti/${doc.id}`, undefined, 'staff')).status, 403);
  assert.equal((await call('GET', `/api/clienti/${cust.id}/documenti`, undefined, 'cassa')).status, 403);
  const list = (await call('GET', `/api/clienti/${cust.id}/documenti`, undefined, 'admin')).data;
  assert.equal(list.length, 1);
  assert.ok(!JSON.stringify(list).includes('CA12345XY'), 'l\'elenco non mostra dati in chiaro');
  const log = (await call('GET', '/api/accessi?area=documenti', undefined, 'admin')).data;
  for (const a of ['creato', 'visione', 'file', 'elenco']) assert.ok(log.some((l) => l.action === a), `registro: ${a}`);
  assert.ok(log.every((l) => !JSON.stringify(l).includes('CA12345XY')), 'il registro non contiene i dati');
  assert.equal((await call('GET', '/api/accessi', undefined, 'staff')).status, 403);
  // l'admin puo' abilitare la Cassa
  assert.equal((await call('PUT', '/api/documenti/config', { roles: ['cassa'] }, 'staff')).status, 403);
  await call('PUT', '/api/documenti/config', { roles: ['cassa', 'admin', 'x'] }, 'admin');
  assert.equal((await call('GET', `/api/documenti/${doc.id}`, undefined, 'cassa')).status, 200);
  assert.equal((await call('GET', `/api/documenti/${doc.id}`, undefined, 'staff')).status, 403);
  assert.equal((await call('DELETE', `/api/documenti/${doc.id}`, undefined, 'cassa')).status, 403, 'solo l\'admin cancella');
  // cancellazione: serve la conferma esplicita
  assert.equal((await call('DELETE', `/api/documenti/${doc.id}`, undefined, 'admin')).status, 400);
  assert.equal((await call('DELETE', `/api/documenti/${doc.id}?confirm=ELIMINA`, undefined, 'admin')).status, 200);
  assert.equal((await call('GET', `/api/documenti/${doc.id}`, undefined, 'admin')).status, 404);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM id_document_files').get().n, 0);
});

test('credenziali fornitori: password cifrata, solo admin, Mostra/Copia registrati', async () => {
  const sup = (await call('POST', '/api/suppliers', { name: 'Ricambi Sud' })).data;
  const body = { supplier_id: sup.id, label: 'Portale ordini', url: 'ricambisud.example.it/login', username: 'christian', password: 'P@ss-Segretissima-42', agent_name: 'Paolo', agent_phone: '3331234567' };
  assert.equal((await call('POST', '/api/credenziali', body, 'staff')).status, 403);
  assert.equal((await call('POST', '/api/credenziali', { ...body, url: 'javascript:alert(1)' }, 'admin')).status, 400);
  const c = (await call('POST', '/api/credenziali', body, 'admin')).data;
  assert.equal(c.has_password, true);
  assert.equal(c.url, 'https://ricambisud.example.it/login');
  assert.ok(!JSON.stringify(c).includes('Segretissima'));
  assert.ok(!JSON.stringify(raw.prepare('SELECT * FROM supplier_credentials').all()).includes('Segretissima'), 'cifrata a riposo');
  const list = (await call('GET', '/api/credenziali', undefined, 'admin')).data;
  assert.ok(!JSON.stringify(list).includes('Segretissima'));
  assert.equal(list.rows[0].supplier_name, 'Ricambi Sud');
  assert.equal((await call('GET', '/api/credenziali', undefined, 'cassa')).status, 403);
  assert.equal((await call('POST', `/api/credenziali/${c.id}/rivela`, {}, 'staff')).status, 403);
  assert.equal((await call('POST', `/api/credenziali/${c.id}/rivela`, { action: 'copia' }, 'admin')).data.password, 'P@ss-Segretissima-42');
  await call('POST', `/api/credenziali/${c.id}/rivela`, { action: 'mostra' }, 'admin');
  const log = (await call('GET', '/api/accessi?area=credenziali', undefined, 'admin')).data;
  assert.ok(log.some((l) => l.action === 'copia') && log.some((l) => l.action === 'mostra'));
  assert.ok(!JSON.stringify(log).includes('Segretissima'));
  // modifica senza cambiare la password: resta la stessa; con nuova password: cambia
  await call('PUT', `/api/credenziali/${c.id}`, { ...body, password: '', username: 'christian2' }, 'admin');
  assert.equal((await call('POST', `/api/credenziali/${c.id}/rivela`, {}, 'admin')).data.password, 'P@ss-Segretissima-42');
  await call('PUT', `/api/credenziali/${c.id}`, { ...body, password: 'Nuova-Pass-77' }, 'admin');
  assert.equal((await call('POST', `/api/credenziali/${c.id}/rivela`, {}, 'admin')).data.password, 'Nuova-Pass-77');
  assert.equal((await call('DELETE', `/api/credenziali/${c.id}`, undefined, 'admin')).status, 200);
});

test('backup: contiene le nuove tabelle, ma solo cifrate', async () => {
  const bk = (await call('GET', '/api/backup')).data;
  const dump = typeof bk === 'string' ? JSON.parse(bk) : bk;
  for (const t of ['devices', 'vouchers', 'voucher_uses', 'id_documents', 'sensitive_access_log', 'supplier_credentials']) assert.ok(Array.isArray(dump.tables[t]), t);
  assert.ok(!JSON.stringify(dump).includes('Nuova-Pass-77'));
});
