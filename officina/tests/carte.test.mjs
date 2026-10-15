// Test: carta punti NFC protetta (UID + codice firmato HMAC a contatore, PIN, replay/clonazione, limiti, accredito solo da documenti veri).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-nfc-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.NFC_SECRET = 'segreto-di-prova-solo-per-i-test-0123456789';

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');
const K = await import('../carte.mjs');

let admin, A;
before(async () => {
  const apps = createApps();
  admin = await new Promise((r) => { const s = serve({ fetch: apps.admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${admin.address().port}`;
  K.LIMITS.opsPerMinute = 100000; K.LIMITS.failsPer10Min = 100000; // i limiti di velocita' si provano a parte
});
after(() => { admin.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const a = async (method, path, body) => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};

let cust, other, card, token, pin;
const UID = '04:A1:B2:C3:D4:E5:F6';

test('UID e codice: formati', async () => {
  assert.equal(K.normalizeUid('04:a1:b2:c3'), '04A1B2C3');
  assert.equal(K.normalizeUid(' 04 A1 B2 C3 D4 E5 F6 '), '04A1B2C3D4E5F6');
  assert.throws(() => K.normalizeUid('xyz'), /UID non valido/);
  assert.throws(() => K.normalizeUid('04A1B2'), /UID non valido/);
  assert.equal(K.parseToken('IXC1.C-000001.3.AAAAAAAAAAAAAAAAAAAAAA').counter, 3);
  assert.equal(K.parseToken('qualunque cosa'), null);
});

test('emissione: UID duplicato rifiutato, codice firmato e PIN mostrato una volta', async () => {
  cust = (await a('POST', '/api/customers', { name: 'Giulia Neri', phone: '3331112222' })).data;
  other = (await a('POST', '/api/customers', { name: 'Paolo Gialli', phone: '3334445555' })).data;
  assert.equal((await a('POST', '/api/carte/issue', { customer_id: cust.id, uid: 'zz' })).status, 400);
  assert.equal((await a('POST', '/api/carte/issue', { customer_id: 9999, uid: UID })).status, 404);
  const r = (await a('POST', '/api/carte/issue', { customer_id: cust.id, uid: UID })).data;
  card = r.card; token = r.token; pin = r.pin;
  assert.equal(card.card_no, 'C-000001');
  assert.equal(card.points, 0);
  assert.equal(card.uid, '04A1B2C3D4E5F6');
  assert.match(token, /^IXC1\.C-000001\.1\.[A-Za-z0-9_-]{22}$/);
  assert.match(pin, /^\d{4}$/);
  assert.equal((await a('POST', '/api/carte/issue', { customer_id: other.id, uid: UID })).status, 409, 'stesso chip su due carte');
  // il PIN non e' mai riletto e il segreto non esce da nessuna parte
  const dump = JSON.stringify([(await a('GET', '/api/carte')).data, (await a('GET', `/api/carte/${card.id}`)).data, (await a('GET', '/api/settings')).data, (await a('GET', '/api/carte/meta')).data]);
  assert.ok(!dump.includes(process.env.NFC_SECRET), 'segreto mai esposto');
  assert.ok(!dump.includes('pin_hash'), 'hash del PIN mai esposto');
  assert.equal((await a('GET', '/api/carte/meta')).data.configured, true);
});

test('scansione: solo UID, codice falso, codice di un altro chip, codice valido con rotazione', async () => {
  const uidOnly = (await a('POST', '/api/carte/scan', { uid: UID })).data;
  assert.equal(uidOnly.level, 'uid');
  assert.equal(uidOnly.next_token, null);
  assert.equal((await a('POST', '/api/carte/scan', { uid: '04FFFFFF' })).status, 404, 'chip sconosciuto');

  // firma inventata
  const forged = token.replace(/\.[^.]+$/, '.' + 'A'.repeat(22));
  assert.equal((await a('POST', '/api/carte/scan', { uid: UID, token: forged })).status, 403);
  // contatore ritoccato (firma non piu' valida)
  assert.equal((await a('POST', '/api/carte/scan', { uid: UID, token: token.replace('.1.', '.9.') })).status, 403);
  // codice copiato su un chip con UID diverso
  assert.equal((await a('POST', '/api/carte/scan', { uid: '04AABBCCDD', token })).status, 403);

  const ok = (await a('POST', '/api/carte/scan', { uid: UID, token })).data;
  assert.equal(ok.level, 'token');
  assert.match(ok.next_token, /^IXC1\.C-000001\.2\./);
  assert.ok(ok.session.includes('.'));
  card.session = ok.session;
  card.next = ok.next_token;
  // i tentativi falliti sono nel registro, senza bloccare la carta (meno di 5 di fila e poi un successo azzera)
  const h = (await a('GET', `/api/carte/${card.id}`)).data;
  assert.equal(h.card.status, 'attiva');
  assert.ok(h.events.filter((e) => e.kind === 'tentativo_fallito').length >= 3);
});

test('replay del vecchio codice (chip copiato): carta bloccata e registrato', async () => {
  const replay = await a('POST', '/api/carte/scan', { uid: UID, token });
  assert.equal(replay.status, 423);
  assert.match(replay.data.error, /BLOCCATA/);
  const h = (await a('GET', `/api/carte/${card.id}`)).data;
  assert.equal(h.card.status, 'bloccata');
  assert.match(h.card.locked_reason, /clonazione/i);
  assert.ok(h.events.some((e) => e.kind === 'sospetta_clonazione'));
  // bloccata: nemmeno il codice giusto passa
  assert.equal((await a('POST', '/api/carte/scan', { uid: UID, token: card.next })).status, 423);
  // sblocco (amministratore), poi il codice nuovo funziona
  assert.equal((await a('POST', `/api/carte/${card.id}/unblock`, { reason: 'verificato in negozio' })).data.card.status, 'attiva');
  const again = (await a('POST', '/api/carte/scan', { uid: UID, token: card.next })).data;
  assert.equal(again.level, 'token');
  assert.match(again.next_token, /\.3\./);
  card.session = again.session;
  card.next = again.next_token;
});

test('accredito: solo da vendite/riparazioni vere, una volta sola, importo deciso dal server', async () => {
  const sale = (await a('POST', '/api/sales', { customer_id: cust.id, method: 'contanti', items: [{ name: 'Cover', qty: 1, unit_price: 50.9 }] })).data;
  const body = { ref_kind: 'sale', ref_id: sale.id, session: card.session };
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { ...body, session: undefined })).status, 401, 'senza verifica niente punti');
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { ...body, session: card.session.slice(0, -3) + 'xyz' })).status, 401, 'sessione manomessa');
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { ref_kind: 'sale', ref_id: 99999, session: card.session })).status, 404);
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { points: 5000, ref_kind: 'sale', ref_id: sale.id, session: card.session })).data.added, 50, 'il client non sceglie i punti');
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, body)).status, 409, 'stessa vendita due volte');
  // la vendita di un altro cliente non vale
  const sale2 = (await a('POST', '/api/sales', { customer_id: other.id, method: 'contanti', items: [{ name: 'X', qty: 1, unit_price: 10 }] })).data;
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { ref_kind: 'sale', ref_id: sale2.id, session: card.session })).status, 409);
  // riparazione: solo se consegnata
  const rep = (await a('POST', '/api/repairs', { customer: { id: cust.id }, brand_model: 'iPhone 11', problem: 'display', quote: 100 })).data;
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { ref_kind: 'repair', ref_id: rep.id, session: card.session })).status, 409);
  const cr = (await a('GET', `/api/carte/creditable?customer_id=${cust.id}`)).data;
  assert.ok(!cr.some((x) => x.ref_kind === 'sale' && x.ref_id === sale.id), "già premiata: non più in elenco");
  // sessione di un'altra carta
  const c2 = (await a('POST', '/api/carte/issue', { customer_id: other.id, uid: '04112233' })).data;
  const s2 = (await a('POST', '/api/carte/scan', { uid: '04112233', token: c2.token })).data;
  assert.equal((await a('POST', `/api/carte/${card.id}/accrue`, { ref_kind: 'sale', ref_id: sale2.id, session: s2.session })).status, 401);
  assert.equal((await a('GET', `/api/carte/${card.id}`)).data.card.points, 50);
  card.rep = rep;
});

test('riscatto: serve il codice firmato o il PIN; genera un buono regalo; multipli e limite giornaliero', async () => {
  // portiamo il saldo a 500 con una rettifica motivata
  assert.equal((await a('POST', `/api/carte/${card.id}/adjust`, { points: 450 })).status, 400, 'motivo obbligatorio');
  assert.equal((await a('POST', `/api/carte/${card.id}/adjust`, { points: 450, reason: 'bonus di benvenuto' })).data.card.points, 500);
  assert.equal((await a('POST', `/api/carte/${card.id}/adjust`, { points: -9999, reason: 'prova' })).status, 409, 'saldo mai negativo');

  // sessione "solo UID": serve il PIN
  const uidSession = (await a('POST', '/api/carte/scan', { uid: UID })).data.session;
  assert.equal((await a('POST', `/api/carte/${card.id}/redeem`, { points: 100, session: uidSession })).status, 403, 'UID da solo non basta');
  assert.equal((await a('POST', `/api/carte/${card.id}/redeem`, { points: 100, session: uidSession, pin: '0000' === pin ? '1111' : '0000' })).status, 403);
  assert.equal((await a('POST', `/api/carte/${card.id}/redeem`, { points: 150, session: uidSession, pin })).status, 400, 'solo multipli di 100');
  const r = (await a('POST', `/api/carte/${card.id}/redeem`, { points: 200, session: uidSession, pin })).data;
  assert.equal(r.card.points, 300);
  assert.equal(r.voucher.value, 10);
  const vouchers = (await a('GET', '/api/buoni')).data;
  const v = vouchers.find((x) => x.code === r.voucher.code);
  assert.ok(v && v.kind === 'regalo' && v.balance === 10 && v.customer_id === cust.id, 'buono regalo vero, in cassa come gli altri');

  // con la carta scrivibile (codice firmato) il PIN non serve
  const tk = (await a('POST', '/api/carte/scan', { uid: UID, token: card.next })).data;
  assert.equal((await a('POST', `/api/carte/${card.id}/redeem`, { points: 100, session: tk.session })).data.card.points, 200);
  // limite giornaliero (1000 punti): 300 gia' riscattati oggi, altri 800 superano
  await a('POST', `/api/carte/${card.id}/adjust`, { points: 5000, reason: 'prova limite giornaliero' });
  assert.equal((await a('POST', `/api/carte/${card.id}/redeem`, { points: 800, session: tk.session })).status, 409);
  assert.equal((await a('POST', `/api/carte/${card.id}/redeem`, { points: 100000, session: tk.session })).status, 409);
  card.next = tk.next_token;
  const h = (await a('GET', `/api/carte/${card.id}`)).data;
  assert.ok(h.events.some((e) => e.kind === 'riscatto' && e.points === -200 && e.voucher_code === r.voucher.code));
});

test('PIN sbagliato ripetuto: la carta si blocca; riemissione del codice solo col PIN', async () => {
  const c = (await a('POST', '/api/carte/issue', { customer_id: other.id, uid: '04DEADBEEF', pin: '4321' })).data;
  const sess = (await a('POST', '/api/carte/scan', { uid: '04DEADBEEF' })).data.session;
  for (let i = 0; i < 4; i += 1) assert.equal((await a('POST', `/api/carte/${c.card.id}/redeem`, { points: 100, session: sess, pin: '9999' })).status, 403);
  const last = await a('POST', `/api/carte/${c.card.id}/redeem`, { points: 100, session: sess, pin: '9999' });
  assert.equal(last.status, 423);
  assert.equal((await a('GET', `/api/carte/${c.card.id}`)).data.card.status, 'bloccata');
  assert.equal((await a('POST', `/api/carte/${c.card.id}/unblock`, { reason: 'cliente identificato' })).data.card.status, 'attiva');
  // riemissione: il nuovo codice vale, il vecchio (quello emesso) no
  const re = (await a('POST', `/api/carte/${c.card.id}/reissue`, {})).data;
  assert.match(re.token, /^IXC1\.C-\d{6}\.2\./);
  assert.equal((await a('POST', '/api/carte/scan', { uid: '04DEADBEEF', token: c.token })).status, 423, "il vecchio codice è un replay");
});

test('sostituzione: carta persa, i punti passano alla nuova (solo amministratore, nuovo chip)', async () => {
  await a('POST', `/api/carte/${card.id}/unblock`, { reason: 'ok' });
  const before = (await a('GET', `/api/carte/${card.id}`)).data.card.points;
  assert.equal((await a('POST', `/api/carte/${card.id}/replace`, { uid: UID })).status, 409, 'serve un chip diverso');
  const r = (await a('POST', `/api/carte/${card.id}/replace`, { uid: '04CAFE0102' })).data;
  assert.equal(r.card.points, before);
  assert.equal((await a('GET', `/api/carte/${card.id}`)).data.card.status, 'persa');
  assert.equal((await a('GET', `/api/carte/${card.id}`)).data.card.points, 0);
  assert.equal((await a('POST', '/api/carte/scan', { uid: UID })).status, 404, "il vecchio chip non è più di nessuna carta");
  // il vecchio chip si puo' ora riusare per un'altra carta
  assert.equal((await a('POST', '/api/carte/issue', { customer_id: other.id, uid: UID })).status, 200);
});

test('regole punti da Impostazioni: validate; limiti di velocità e di tentativi falliti', async () => {
  assert.equal((await a('PUT', '/api/settings', { loyalty_points_per_euro: '-3' })).status, 400);
  assert.equal((await a('PUT', '/api/settings', { loyalty_points_per_euro: 'abc' })).status, 400);
  assert.equal((await a('PUT', '/api/settings', { loyalty_redeem_step: '50', loyalty_euro_per_step: '2' })).status, 200);
  assert.equal((await a('GET', '/api/carte/meta')).data.rules.redeem_step, 50);

  K.LIMITS.failsPer10Min = 3;
  let hit = 0;
  for (let i = 0; i < 6; i += 1) if ((await a('POST', '/api/carte/scan', { uid: '04000000' + String(i).padStart(2, '0') })).status === 429) hit += 1;
  assert.ok(hit > 0, 'dopo troppi tentativi falliti si viene fermati');
  K.LIMITS.failsPer10Min = 100000;
  K.LIMITS.opsPerMinute = 5;
  const codes = [];
  for (let i = 0; i < 4; i += 1) codes.push((await a('POST', '/api/carte/scan', { uid: UID })).status);
  assert.ok(codes.includes(429), 'troppe operazioni al minuto');
});
