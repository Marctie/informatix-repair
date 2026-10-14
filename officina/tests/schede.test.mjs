// Test di checklist, schede stampabili, firme, preventivo a distanza e "non riparabile".  Esecuzione: npm run test:officina
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-schede-'));
process.env.OFFICINA_DB = join(dir, 'test.db');

const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

let admin, pub, A, P;
const listen = (app) => new Promise((r) => { const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
before(async () => {
  const apps = createApps();
  admin = await listen(apps.admin);
  pub = await listen(apps.pub);
  A = `http://127.0.0.1:${admin.address().port}`;
  P = `http://127.0.0.1:${pub.address().port}`;
});
after(() => { admin.close(); pub.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (base, method, path, body, headers = {}) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const a = (m, p, b) => call(A, m, p, b);
const newRepair = async (extra = {}) => (await a('POST', '/api/repairs', { customer: { name: 'Anna Verdi', phone: '3470001122' }, brand_model: 'HP 250 G8', device_type: 'portatile', problem: 'Non si accende', ...extra })).data;

// ---------- Punto 15: checklist per tipo ----------
test('checklist: elenchi diversi per tipo, modificabili e ripristinabili', async () => {
  const all = (await a('GET', '/api/checklists')).data;
  assert.ok(all.smartphone.in.includes('Face ID / impronta'));
  assert.ok(!all.pc.in.includes('Face ID / impronta'), 'il PC non ha i controlli da smartphone');
  assert.ok(all.pc.in.includes('Ventole e temperature'));
  assert.ok(all.console.in.includes('Lettore dischi'));
  assert.equal(all.pc.custom, false);

  const saved = (await a('PUT', '/api/checklists/pc', { in: ['Si accende', ' Si accende ', 'Scheda video', ''], out: ['Collaudo 1h'] })).data;
  assert.deepEqual(saved.in, ['Si accende', 'Scheda video'], 'spazi tolti e doppioni eliminati');
  assert.deepEqual(saved.out, ['Collaudo 1h']);
  assert.ok(saved.pre.length, 'gli elenchi non toccati restano quelli predefiniti');
  assert.equal(saved.custom, true);
  assert.equal((await a('GET', '/api/checklists')).data.smartphone.custom, false, 'gli altri tipi non cambiano');

  assert.equal((await a('PUT', '/api/checklists/inesistente', { in: ['x'] })).status, 400);
  assert.equal((await a('PUT', '/api/checklists/pc', { in: 'non un elenco' })).status, 400);
  assert.equal((await a('PUT', '/api/checklists/pc', {})).status, 400);

  const reset = (await a('DELETE', '/api/checklists/pc')).data;
  assert.equal(reset.custom, false);
  assert.ok(reset.in.includes('POST / video'));
});

test('meta: etichette dipendenti dal tipo (IMEI solo per telefoni e tablet)', async () => {
  const m = (await a('GET', '/api/meta')).data;
  assert.match(m.device_types.smartphone.serial, /IMEI/);
  assert.doesNotMatch(m.device_types.pc.serial, /IMEI/);
  assert.match(m.device_types.pc.passcode, /Password/);
});

test('controlli compilati: si salvano nella riparazione con utente e data', async () => {
  const r = await newRepair();
  assert.equal(r.checklist_in, null);
  const items = [{ l: 'Si accende', s: 'ko' }, { l: 'Tastiera', s: 'ok' }, { l: 'Webcam e microfono', s: 'na' }, { l: 'Audio', s: null }, { l: 'Voce strana', s: 'boh' }];
  const out = (await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'in', items })).data;
  assert.equal(out.ok, true);
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.checklist_in.items.length, 5);
  assert.deepEqual(got.checklist_in.items.map((i) => i.s), ['ko', 'ok', 'na', null, null], 'stati non validi diventano vuoti');
  assert.ok(got.checklist_in.by && got.checklist_in.at);
  assert.equal(got.checklist_out, null);
  assert.ok(got.events.some((e) => /Controllo all’ingresso compilato/.test(e.note) && !e.is_public), 'resta in cronologia, solo interna');
  assert.equal((await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'zzz', items })).status, 400);
  assert.equal((await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'out', items: 'x' })).status, 400);
  assert.equal((await a('PUT', '/api/repairs/99999/checklist', { phase: 'in', items })).status, 404);
  // nell'elenco delle riparazioni non viaggia il JSON dei controlli
  const list = (await a('GET', '/api/repairs?q=HP')).data;
  assert.equal(list[0].checklist_in, undefined);
  // il tracciamento pubblico non li espone
  assert.ok(!JSON.stringify((await call(P, 'GET', `/api/track/${r.token}`)).data).includes('Tastiera'));
});

test('stampa scheda laboratorio: voci del tipo, etichette corrette', async () => {
  const r = await newRepair({ device_type: 'pc', brand_model: 'PC fisso Asus', serial: 'SN-123' });
  const html = (await a('GET', `/print/lab/${r.id}?noprint=1`)).data;
  assert.match(html, /Ventole e temperature/);
  assert.doesNotMatch(html, /Face ID/);
  assert.doesNotMatch(html, /IMEI/);
  assert.match(html, /Numero di serie/);
});

// ---------- Punto 14: scheda laboratorio in una pagina ----------
test('scheda laboratorio: una sola pagina anche con testi lunghi, controlli compilati stampati con i segni', async () => {
  const long = 'Non si accende dopo una caduta con schermo incrinato. '.repeat(60);
  const r = await newRepair({ device_type: 'smartphone', brand_model: 'iPhone 13', problem: long, passcode: '4821' });
  await a('PATCH', `/api/repairs/${r.id}`, { tech_notes: long });
  for (let i = 1; i <= 12; i++) await a('POST', `/api/repairs/${r.id}/parts`, { name: `Ricambio ${i}`, qty: 1, unit_cost: 5, unit_price: 9 });
  await a('PUT', `/api/repairs/${r.id}/checklist`, { phase: 'in', items: [{ l: 'Si accende', s: 'ok' }, { l: 'Display / touch', s: 'ko' }, { l: 'Fotocamere', s: 'na' }] });
  const html = (await a('GET', `/print/lab/${r.id}?noprint=1`)).data;
  assert.equal((html.match(/class="page lab"/g) || []).length, 1, 'un solo foglio');
  assert.match(html, /\.lab\{height:268mm;overflow:hidden\}/, 'altezza bloccata: non puo\' uscire una seconda pagina');
  assert.match(html, /continua sul gestionale/, 'testo lungo troncato con rimando');
  assert.match(html, /altri 7 ricambi/, 'ricambi oltre il limite riassunti');
  assert.match(html, /<span class="s-ok">Si accende<\/span>/);
  assert.match(html, /<span class="s-ko">Display \/ touch<\/span>/);
  assert.match(html, /<span class="s-na">Fotocamere<\/span>/);
  assert.match(html, /Compilato da/);
  // stampa unica "tutto": una pagina per scheda
  const both = (await a('GET', `/print/both/${r.id}?noprint=1`)).data;
  assert.equal((both.match(/class="page lab"/g) || []).length, 1);
});

// ---------- Punto 13: scheda cliente doppia copia + firma digitale ----------
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('scheda cliente: un foglio A4 con due copie (negozio e cliente) e testi bozza marcati', async () => {
  const r = await newRepair({ problem: 'x'.repeat(3000), accessories: 'y'.repeat(500) });
  const html = (await a('GET', `/print/customer/${r.id}?noprint=1`)).data;
  assert.equal((html.match(/class="page sheet"/g) || []).length, 1, 'un solo foglio');
  assert.equal((html.match(/class="half"/g) || []).length, 2, 'due copie identiche');
  assert.match(html, /COPIA NEGOZIO/);
  assert.match(html, /COPIA CLIENTE/);
  assert.match(html, /\.sheet\{height:268mm;overflow:hidden\}/);
  assert.match(html, /Affido a Informatix Repair il dispositivo/, 'consenso della bozza D');
  assert.equal((html.match(/Bozza da far verificare/g) || []).length, 2, 'ogni copia segna che il testo e\' una bozza');
  assert.match(html, /continua sul gestionale/, 'testo lungo troncato');
  assert.doesNotMatch(html, /4821|passcode/i);
  // verificato dal proprietario: la dicitura sparisce
  await a('PUT', '/api/settings', { legal_verified: '1' });
  assert.doesNotMatch((await a('GET', `/print/customer/${r.id}?noprint=1`)).data, /Bozza da far verificare/);
  await a('PUT', '/api/settings', { legal_verified: '0' });
  // anche la stampa "tutto": scheda cliente (foglio) + laboratorio
  const both = (await a('GET', `/print/both/${r.id}?noprint=1`)).data;
  assert.equal((both.match(/class="page sheet"/g) || []).length, 1);
});

test('firma al banco: salvata come immagine e mostrata su entrambe le copie stampate', async () => {
  const r = await newRepair();
  assert.equal((await a('POST', `/api/repairs/${r.id}/signature`, { image: 'non e un png' })).status, 400);
  assert.equal((await a('POST', `/api/repairs/${r.id}/signature`, { image: 'data:image/png;base64,AAAAAAAAAAAAAAAA' })).status, 400, 'non e\' un PNG vero');
  assert.equal((await a('POST', '/api/repairs/99999/signature', { image: SIG })).status, 404);
  const ok = await a('POST', `/api/repairs/${r.id}/signature`, { image: SIG, signer_name: 'Anna Verdi' });
  assert.equal(ok.status, 200);
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.signatures.length, 1);
  assert.equal(got.signatures[0].kind, 'intake');
  assert.equal(got.signatures[0].via, 'banco');
  assert.equal(got.signatures[0].signer_name, 'Anna Verdi');
  assert.ok(!JSON.stringify(got.signatures).includes('base64'), 'l\'immagine non viaggia nel dettaglio');
  const img = await fetch(`${A}/api/repairs/${r.id}/signatures/${got.signatures[0].id}/image`);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal((await img.arrayBuffer()).byteLength, 70);
  assert.equal((await fetch(`${A}/api/repairs/${r.id}/signatures/9999/image`)).status, 404);
  const html = (await a('GET', `/print/customer/${r.id}?noprint=1`)).data;
  assert.equal((html.match(/class="sigprint"/g) || []).length, 2, 'firma su entrambe le copie');
  assert.match(html, /firmato digitalmente da Anna Verdi/);
  // il tracciamento pubblico non mostra ne' l'immagine ne' l'IP
  const pubJson = JSON.stringify((await call(P, 'GET', `/api/track/${r.token}`)).data);
  assert.ok(!pubJson.includes('base64'));
});

test('firma a distanza dal link: richiesta, consenso, IP e data registrati, una sola volta', async () => {
  const r = await newRepair();
  // senza richiesta del negozio non si firma
  assert.equal((await call(P, 'POST', `/api/track/${r.token}/sign`, { accept: true, image: SIG })).status, 409);
  assert.equal((await call(P, 'GET', `/api/track/${r.token}`)).data.intake_sign, null);
  assert.equal((await a('POST', `/api/repairs/${r.id}/request-signature`)).status, 200);
  const v = (await call(P, 'GET', `/api/track/${r.token}`)).data;
  assert.match(v.intake_sign.text, /Affido a Informatix Repair/);
  assert.equal(v.intake_sign.draft, true);
  assert.equal(v.intake_signed_at, null);
  // serve l'accettazione e la firma
  assert.equal((await call(P, 'POST', `/api/track/${r.token}/sign`, { image: SIG })).status, 400);
  assert.equal((await call(P, 'POST', `/api/track/${r.token}/sign`, { accept: true })).status, 400);
  const ok = await call(P, 'POST', `/api/track/${r.token}/sign`, { accept: true, image: SIG, signer_name: 'Anna V.' }, { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
  assert.equal(ok.status, 200);
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  const sg = got.signatures.find((x) => x.kind === 'intake');
  assert.equal(sg.via, 'link');
  assert.equal(sg.ip, '203.0.113.7', 'IP registrato (primo del proxy)');
  assert.match(sg.signed_at, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  assert.equal(got.sign_requested, 0);
  assert.ok(got.events.some((e) => /firmata dal cliente da link \(IP 203\.0\.113\.7\)/.test(e.note)));
  assert.equal((await call(P, 'GET', `/api/track/${r.token}`)).data.intake_sign, null);
  assert.ok((await call(P, 'GET', `/api/track/${r.token}`)).data.intake_signed_at);
  // gia' firmata: ne' nuova richiesta ne' seconda firma
  assert.equal((await a('POST', `/api/repairs/${r.id}/request-signature`)).status, 409);
  assert.equal((await call(P, 'POST', `/api/track/${r.token}/sign`, { accept: true, image: SIG })).status, 409);
});

// ---------- Punto 16: preventivo a distanza ----------
const toPending = async (extra = {}) => {
  const r = await newRepair({ quote: 120, deposit: 0, eta_date: '2030-02-01', ...extra });
  await a('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' });
  return r;
};
const decide = (r, body, headers) => call(P, 'POST', `/api/track/${r.token}/decision`, body, headers);

test('preventivo a distanza: la pagina pubblica offre i testi, conferma solo con firma, IP registrato', async () => {
  const r = await toPending();
  const v = (await call(P, 'GET', `/api/track/${r.token}`)).data;
  assert.equal(v.awaiting_decision, true);
  assert.match(v.quote_flow.accept.text, /Stai accettando il preventivo n\. R-\d{4}-\d{4}/);
  assert.match(v.quote_flow.accept.text, /\{importo\}/, 'l\'importo lo inserisce la pagina');
  assert.match(v.quote_flow.accept.text, /consegna stimata il 01\/02\/2030/);
  assert.match(v.quote_flow.decline.pickup, /15 giorni/);
  assert.match(v.quote_flow.decline.cede, /cedo la proprietà al laboratorio/i);
  assert.equal(v.quote_flow.draft, true);
  // nessuna firma: rifiutato; azione sbagliata: rifiutata
  assert.equal((await decide(r, { action: 'accept' })).status, 400);
  assert.equal((await decide(r, { action: 'boh', image: SIG })).status, 400);
  assert.equal((await decide(r, { accept: true })).status, 400, 'il vecchio formato senza firma non vale piu\'');
  const ok = await decide(r, { action: 'accept', image: SIG, signer_name: 'Anna Verdi' }, { 'x-forwarded-for': '198.51.100.9' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.status, 'approved');
  assert.equal(ok.data.quote_decision, 'accepted');
  assert.equal(ok.data.my_decision.action, 'accept');
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  const sg = got.signatures.find((x) => x.kind === 'quote_accept');
  assert.equal(sg.ip, '198.51.100.9');
  assert.equal(sg.via, 'link');
  assert.ok(got.events.some((e) => /Conferma del preventivo firmata da link: IP 198\.51\.100\.9/.test(e.note) && !e.is_public));
  assert.equal((await decide(r, { action: 'accept', image: SIG })).status, 409, 'una sola risposta');
});

test('preventivo a distanza: scelta fra opzioni, importo e opzione registrati', async () => {
  const r = await newRepair({ quote: null });
  assert.equal((await a('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' })).status, 400, 'senza preventivo né opzioni non si può chiedere');
  assert.equal((await a('POST', `/api/repairs/${r.id}/quote-options`, { label: '', amount: 10 })).status, 400);
  assert.equal((await a('POST', `/api/repairs/${r.id}/quote-options`, { label: 'x', amount: -1 })).status, 400);
  const first = (await a('POST', `/api/repairs/${r.id}/quote-options`, { label: 'Display compatibile', amount: 89, description: 'Garanzia 6 mesi' })).data;
  const both = (await a('POST', `/api/repairs/${r.id}/quote-options`, { label: 'Display originale', amount: '149,50' })).data;
  assert.equal(both.length, 2);
  assert.equal((await a('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' })).status, 200, 'con le opzioni si può chiedere anche senza importo unico');
  const v =(await call(P, 'GET', `/api/track/${r.token}`)).data;
  assert.equal(v.quote_flow.options.length, 2);
  assert.equal(v.awaiting_decision, true);
  assert.equal((await decide(r, { action: 'accept', image: SIG })).status, 400, 'con le opzioni bisogna sceglierne una');
  assert.equal((await decide(r, { action: 'option', option_id: 99999, image: SIG })).status, 400);
  const chosen = both[1];
  const ok = await decide(r, { action: 'option', option_id: chosen.id, image: SIG });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.quote, 149.5);
  assert.equal(ok.data.my_decision.option_label, 'Display originale');
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.quote, 149.5);
  assert.equal(got.quote_option_id, chosen.id);
  assert.equal(got.status, 'approved');
  void first;
});

test('preventivo a distanza: rifiuto con "ritiro io" apre la giacenza di 15 giorni', async () => {
  const r = await toPending();
  assert.equal((await decide(r, { action: 'decline', image: SIG })).status, 400, 'serve la scelta sul dispositivo');
  assert.equal((await decide(r, { action: 'decline', device_choice: 'forse', image: SIG })).status, 400);
  const ok = await decide(r, { action: 'decline', device_choice: 'pickup', image: SIG });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.status, 'cancelled');
  assert.equal(ok.data.my_decision.action, 'decline');
  assert.equal(ok.data.my_decision.choice, 'pickup');
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.device_fate, 'giacenza');
  assert.ok(got.fate_since);
  assert.equal(got.quote_decision, 'declined');
  assert.ok(got.signatures.some((x) => x.kind === 'quote_decline' && x.choice === 'pickup'));
  assert.ok((await a('GET', '/api/storage')).data.some((x) => x.id === r.id && x.days_left === 15 && !x.due));
});

test('preventivo a distanza: rifiuto con cessione al negozio non apre la giacenza', async () => {
  const r = await toPending();
  const ok = await decide(r, { action: 'decline', device_choice: 'cede', image: SIG });
  assert.equal(ok.status, 200);
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.device_fate, 'ceduto');
  assert.ok(!(await a('GET', '/api/storage')).data.some((x) => x.id === r.id), 'ceduto: nessun conto alla rovescia');
  assert.ok(got.events.some((e) => /ceduto il dispositivo al negozio/.test(e.note) && e.is_public));
});

test('notifiche Telegram: risposta firmata del cliente, firme, destino del dispositivo', async () => {
  const { describeEvent } = await import('../notify.mjs');
  const ev = (method, path, result, body = {}, status = 200) => describeEvent({ method, path, status, user: null, body, result, ip: '203.0.113.7' });
  const view = { code: 'R-2026-0007', device: { model: 'iPhone 13' }, customer: { name: 'Anna' }, quote: 149.5, my_decision: { option_label: 'Display originale' } };
  assert.match(ev('POST', '/api/track/abc/decision', view, { action: 'option' }), /APPROVATO.*firmato.*Display originale.*IP 203\.0\.113\.7/s);
  assert.match(ev('POST', '/api/track/abc/decision', view, { action: 'decline', device_choice: 'cede' }), /RIFIUTATO.*CEDUTO/s);
  assert.match(ev('POST', '/api/track/abc/decision', view, { action: 'decline', device_choice: 'pickup' }), /RIFIUTATO.*giacenza di 15 giorni/s);
  assert.match(ev('POST', '/api/track/abc/sign', { ok: true }), /FIRMATA dal cliente/);
  assert.doesNotMatch(ev('POST', '/api/track/abc/decision', view, { action: 'accept', image: SIG }), /base64/);
});

// ---------- Punto 2: non riparabile, giacenza, deposito ----------
test('non riparabile: destino del dispositivo, 15 giorni di giacenza, avvisi, deposito', async () => {
  const r = await newRepair({ brand_model: 'Samsung A12' });
  // il destino si registra solo per le annullate
  assert.equal((await a('POST', `/api/repairs/${r.id}/fate`, { fate: 'ritirato' })).status, 409);
  const c = await a('POST', `/api/repairs/${r.id}/status`, { status: 'cancelled', device_fate: 'giacenza', fate_note: 'scheda madre bruciata' });
  assert.equal(c.status, 200);
  assert.equal(c.data.device_fate, 'giacenza');
  assert.equal(c.data.fate_note, 'scheda madre bruciata');
  assert.ok(c.data.fate_since);
  // appena registrata: in giacenza, ma ancora niente avviso di scadenza
  let al = (await a('GET', '/api/alerts')).data.items;
  assert.ok(!al.some((x) => x.ref === r.id && x.type === 'storage_due'));
  const dash = (await a('GET', '/api/dashboard')).data;
  assert.ok(dash.storage.some((x) => x.id === r.id && x.days_left === 15));
  // passano 16 giorni: giacenza scaduta, avviso rosso con le due strade (smaltire o deposito a pagamento)
  const { raw } = await import('../db-node.mjs');
  raw.prepare("UPDATE repairs SET fate_since = datetime('now','-16 days') WHERE id = ?").run(r.id);
  al = (await a('GET', '/api/alerts')).data.items;
  const due = al.find((x) => x.ref === r.id && x.type === 'storage_due');
  assert.ok(due, 'avviso di giacenza scaduta');
  assert.equal(due.severity, 'high');
  assert.match(due.detail, /deposito a pagamento/);
  const { storageDigest } = await import('../remote.mjs');
  assert.match(await storageDigest(), /Samsung A12/);
  // 13 giorni: avviso "in scadenza" (restano 2 giorni)
  raw.prepare("UPDATE repairs SET fate_since = datetime('now','-13 days') WHERE id = ?").run(r.id);
  al = (await a('GET', '/api/alerts')).data.items;
  assert.ok(al.some((x) => x.ref === r.id && x.type === 'storage_soon'));
  assert.ok(!al.some((x) => x.ref === r.id && x.type === 'storage_due'));
  // spostato in deposito a pagamento: resta elencato, ma niente piu' avvisi di scadenza
  const dep = (await a('POST', `/api/repairs/${r.id}/fate`, { fate: 'deposito', note: '5 euro al mese' })).data;
  assert.equal(dep.device_fate, 'deposito');
  al = (await a('GET', '/api/alerts')).data.items;
  assert.ok(!al.some((x) => x.ref === r.id && /storage/.test(x.type)));
  assert.ok((await a('GET', '/api/storage')).data.some((x) => x.id === r.id && x.device_fate === 'deposito'));
  // ritirato dal cliente: esce dall'elenco
  assert.equal((await a('POST', `/api/repairs/${r.id}/fate`, { fate: 'ritirato' })).data.device_fate, 'ritirato');
  assert.ok(!(await a('GET', '/api/storage')).data.some((x) => x.id === r.id));
  assert.equal((await a('POST', `/api/repairs/${r.id}/fate`, { fate: 'a caso' })).status, 400);
  assert.equal((await a('POST', '/api/repairs/99999/fate', { fate: 'ritirato' })).status, 404);
});

test('non riparabile: predefinito in giacenza; cessione firmata al banco; vecchie annullate senza destino', async () => {
  const r = await newRepair({ brand_model: 'Nokia 3310' });
  const c = (await a('POST', `/api/repairs/${r.id}/status`, { status: 'cancelled' })).data;
  assert.equal(c.device_fate, 'giacenza', 'senza scelta: in giacenza');
  // cessione firmata al banco (liberatoria allo smaltimento / pezzi di ricambio)
  assert.equal((await a('POST', `/api/repairs/${r.id}/signature`, { kind: 'disposal', image: SIG })).status, 200);
  const got = (await a('GET', `/api/repairs/${r.id}`)).data;
  assert.equal(got.device_fate, 'ceduto');
  assert.ok(got.signatures.some((x) => x.kind === 'disposal' && x.choice === 'cede'));
  // la cessione non si firma su una riparazione ancora aperta
  const open = await newRepair();
  assert.equal((await a('POST', `/api/repairs/${open.id}/signature`, { kind: 'disposal', image: SIG })).status, 409);
  // annullata "alla vecchia maniera" (senza destino): promemoria leggero a registrare dov'e'
  const { raw } = await import('../db-node.mjs');
  const old = await newRepair({ brand_model: 'Vecchio Lumia' });
  raw.prepare("UPDATE repairs SET status = 'cancelled' WHERE id = ?").run(old.id);
  const al = (await a('GET', '/api/alerts')).data.items;
  assert.ok(al.some((x) => x.ref === old.id && x.type === 'fate_unknown' && x.severity === 'low'));
});

test('giorni di giacenza configurabili da Impostazioni', async () => {
  await a('PUT', '/api/settings', { storage_days: '30', storage_fee: '3 euro a settimana' });
  const r = await newRepair({ brand_model: 'Huawei P20' });
  await a('POST', `/api/repairs/${r.id}/status`, { status: 'cancelled' });
  assert.ok((await a('GET', '/api/storage')).data.some((x) => x.id === r.id && x.days_left === 30));
  const v = (await call(P, 'GET', `/api/track/${r.token}`)).data;
  assert.equal(v.status, 'cancelled');
  await a('PUT', '/api/settings', { storage_days: '15', storage_fee: '' });
});
