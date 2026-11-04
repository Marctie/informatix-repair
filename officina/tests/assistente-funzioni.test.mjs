// Test: funzioni aggiuntive dell'assistente (fornitori, spese, promemoria, ordini, preventivi, carico da documento, messaggi WhatsApp,
// controllo dati, preferenze, idee a schermo) e prompt a pezzi. L'LLM e' finto: si prova tutto il resto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-assist2-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
process.env.VAULT_KEY = 'chiave-di-prova-solo-per-i-test-0123456789';
process.env.TELEGRAM_BOT_TOKEN = '123456:TOKEN-FINTO-SOLO-PER-I-TEST-000000000';
process.env.TELEGRAM_OWNER_ID = '1';
const TOKEN = 'token-assistente-di-prova-0123456789abcdef';
process.env.ASSISTANT_TOKEN = TOKEN;
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(opts.body)); return new Response('{"ok":true}'); }
  return realFetch(url, opts);
};
const { closeDb } = await import('../db-node.mjs');
const { db } = await import('../dbref.mjs');
const { createAdminApp, createPublicApp } = await import('../app.mjs');
const { memoryMedia } = await import('../media.mjs');
const { draftPublisher } = await import('../publisher.mjs');
const { describeEvent } = await import('../notify.mjs');
const media = memoryMedia();
const USERS = {
  admin: { email: 'christian@test.it', name: 'Christian', role: 'admin' },
  staff: { email: 'staff@test.it', name: 'Staff', role: 'staff' },
  cassa: { email: 'cassa@test.it', name: 'Cassa', role: 'cassa' },
};
const app = createAdminApp({
  usati: { publisher: () => draftPublisher(), media: () => media },
  auth: async (c, next) => { c.set('user', USERS[c.req.header('x-role') || 'admin']); await next(); },
});
const pub = createPublicApp({ media: () => media });
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const call = async (method, path, body, role = 'admin') => {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  await new Promise((r) => setTimeout(r, 15));
  return { status: res.status, data };
};
const agent = async (method, path, body) => {
  const res = await pub.request(path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
};
const llm = async (reply, actions = []) => {
  const claim = await agent('POST', '/api/assistant-agent/claim', { ollama: true, models: [] });
  assert.equal(claim.status, 200, 'una richiesta in coda doveva essere assegnata');
  const out = await agent('POST', `/api/assistant-agent/${claim.data.id}/result`, { content: JSON.stringify({ reply, suggestions: [], actions }), model: 'finto' });
  assert.equal(out.status, 200);
  return claim.data;
};
const ask = async (text, role = 'admin') => {
  const r = await call('POST', '/api/assistant/message', { text }, role);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.id;
};
const get = async (id, role = 'admin') => (await call('GET', '/api/assistant/requests', null, role)).data.requests.find((x) => x.id === id);
const confirm = (id, body = {}, role = 'admin') => call('POST', `/api/assistant/requests/${id}/confirm`, body, role);
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrow = localIso(new Date(Date.now() + 86400000));

let sup; let disp; let repair;
test('preparazione: fornitore, articoli, riparazione', async () => {
  sup = (await call('POST', '/api/suppliers', { name: 'TechWholesale' })).data;
  assert.ok(sup.id);
  disp = (await call('POST', '/api/products', { name: 'Display iPhone 12', category: 'Ricambi', qty: 1, min_qty: 3, cost: 40, price: 99, supplier_id: sup.id })).data;
  await call('POST', '/api/products', { name: 'Cavo Lightning 1m', category: 'Accessori', qty: 0, min_qty: 5, cost: 2, price: 9 });
  for (const [n, c, p] of [['Batteria A', 100, 140], ['Batteria B', 50, 70], ['Batteria C', 20, 28]]) await call('POST', '/api/products', { name: n, category: 'Batterie', qty: 9, min_qty: 1, cost: c, price: p });
  repair = (await call('POST', '/api/repairs', { customer: { name: 'Mario Rossi', phone: '333 1234567' }, brand_model: 'iPhone 11', problem: 'Schermo rotto' })).data;
  assert.match(repair.code, /^R-/);
});

test('prompt a pezzi: le istruzioni delle funzioni meno usate compaiono solo quando servono; OGGI e riepilogo sempre', async () => {
  await ask('quanti display ho?');
  const c1 = await llm('Hai 1 display.');
  assert.doesNotMatch(c1.system, / - new_reminder:/);
  assert.doesNotMatch(c1.system, / - new_quote:/);
  assert.match(c1.system, /OGGI: \d{4}-\d{2}-\d{2} \((lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\), ore \d{2}:\d{2}/);
  assert.match(c1.system, /OGGI: riparazioni aperte 1; pronte da ritirare 0/);
  await ask('ricordami di chiamare Rossi domani e fammi un preventivo');
  const c2 = await llm('ok');
  assert.match(c2.system, / - new_reminder:/);
  assert.match(c2.system, / - new_quote:/);
  assert.match(c2.system, /Altre operazioni disponibili: .*remember/);
  await ask('che prezzo metto a una batteria nuova?');
  const c3 = await llm('ok');
  assert.match(c3.system, /RICARICO ABITUALE .*Batterie 40% \(3 articoli\)/, 'ricarico mediano per categoria calcolato dai dati veri');
});

test('nuovo fornitore e nuova spesa: inserimento dai dati, doppioni e dati assurdi rifiutati', async () => {
  const id = await ask('nuovo fornitore Mobilax e spesa bolletta luce');
  await llm('ok', [
    { type: 'new_supplier', fields: { name: 'Mobilax', phone: '0212345678', vat_number: 'IT01234567890' } },
    { type: 'new_supplier', fields: { name: 'techwholesale' } },
    { type: 'new_expense', fields: { description: 'Bolletta luce ottobre', amount: 182.5, vat: 32.9, category: 'utenze', doc_type: 'fattura', vendor: 'Enel' } },
    { type: 'new_expense', fields: { description: 'Spesa assurda', amount: -5 } },
    { type: 'new_expense', fields: { description: 'Spesa futura', amount: 10, spent_on: '2999-01-01' } },
  ]);
  const r = await get(id);
  assert.deepEqual(r.actions.map((a) => a.valid), [true, false, true, false, false]);
  assert.match(r.actions[1].errors.join(' '), /esiste già in anagrafica/);
  const c = await confirm(id);
  assert.equal(c.data.done, 2, JSON.stringify(c.data.results));
  assert.ok((await call('GET', '/api/suppliers')).data.some((s) => s.name === 'Mobilax' && s.vat_number === 'IT01234567890'));
  const exp = (await call('GET', '/api/expenses')).data;
  assert.ok((exp.rows || exp).some((e) => e.description === 'Bolletta luce ottobre' && e.amount === 182.5 && e.category === 'utenze'));
});

test('promemoria: data futura ok (anche collegato a una riparazione), data passata rifiutata', async () => {
  const id = await ask('ricordami di chiamare Rossi');
  await llm('ok', [
    { type: 'new_reminder', repair: repair.code, fields: { title: 'Chiamare Rossi per il preventivo', due: `${tomorrow} 10:30` } },
    { type: 'new_reminder', fields: { title: 'Ieri', due: '2020-01-01 10:00' } },
    { type: 'new_reminder', fields: { title: 'Senza data' } },
    { type: 'new_reminder', fields: { title: 'Solo la data', due: tomorrow } },
  ]);
  const r = await get(id);
  assert.deepEqual(r.actions.map((a) => a.valid), [true, false, false, true]);
  assert.match(r.actions[3].warnings.join(' '), /09:00/);
  const c = await confirm(id);
  assert.equal(c.data.done, 2, JSON.stringify(c.data.results));
  const list = (await call('GET', '/api/reminders')).data;
  const rows = list.rows || list.items || list;
  assert.ok(rows.some((x) => x.title === 'Chiamare Rossi per il preventivo' && x.due_at === `${tomorrow} 10:30` && x.repair_id === repair.id));
});

test('ordini: ordine al fornitore a mano e ordini automatici per gli articoli sotto scorta (uno per fornitore, senza ripetere quelli gia\' ordinati)', async () => {
  const id1 = await ask('ordina 4 display iPhone 12 a TechWholesale');
  await llm('ok', [{ type: 'new_order', fields: { supplier: 'TechWholesale', items: [{ description: 'Display iPhone 12', qty: 4 }] } }, { type: 'new_order', fields: { supplier: 'Nessuno SRL', items: [{ description: 'x', qty: 1 }] } }]);
  const r1 = await get(id1);
  assert.deepEqual(r1.actions.map((a) => a.valid), [true, false]);
  assert.equal((await confirm(id1)).data.done, 1);
  const orders = (await call('GET', '/api/orders')).data;
  assert.ok((orders.rows || orders).some((o) => o.kind === 'fornitore' && o.supplier_id === sup.id));

  const id2 = await ask('prepara gli ordini per gli articoli sotto scorta'); // richiesta ricorrente: risposta immediata, senza modello
  const r2 = await get(id2);
  assert.equal(r2.actions.length, 1, 'il display e\' gia\' in un ordine aperto: resta solo il cavo (senza fornitore)');
  assert.match(r2.actions[0].lines.join(' '), /Cavo Lightning 1m/);
  assert.doesNotMatch(r2.actions[0].lines.join(' '), /Display iPhone 12/);
  assert.match(r2.actions[0].lines.join(' '), /10 × Cavo Lightning 1m/, 'fino al doppio della scorta minima: 10 - 0');
  assert.equal((await confirm(id2)).data.done, 1);
  const id3 = await ask('di nuovo gli ordini sotto scorta');
  await llm('ok', [{ type: 'reorder_low', fields: {} }]);
  const r3 = await get(id3);
  assert.equal(r3.status, 'done', 'tutto e\' gia\' in ordine: nessuna operazione');
  assert.match(r3.actions[0].errors.join(' '), /già in un ordine aperto/);
});

test('preventivo da una frase: cliente nuovo, voci, validita\'; prezzo mancante rifiutato', async () => {
  const id = await ask('preventivo per Luca Bianchi');
  await llm('ok', [
    { type: 'new_quote', fields: { customer_name: 'Luca Bianchi', customer_phone: '347 9876543', items: [{ description: 'Sostituzione schermo iPhone 12', qty: 1, price: 120 }, { description: 'Pellicola', qty: 2, price: 10 }], valid_days: 7, discount_pct: 10 } },
    { type: 'new_quote', fields: { customer_name: 'Luca Bianchi', items: [{ description: 'Voce senza prezzo', qty: 1 }] } },
  ]);
  const r = await get(id);
  assert.deepEqual(r.actions.map((a) => a.valid), [true, false]);
  assert.match(r.actions[0].lines.join(' '), /Cliente NUOVO: Luca Bianchi/);
  assert.match(r.actions[0].lines.join(' '), /Totale voci: 140,00 €/);
  assert.equal((await confirm(id)).data.done, 1);
  const q = (await call('GET', '/api/quotes')).data;
  const row = (q.rows || q).find((x) => /Bianchi/.test(x.customer_name));
  assert.ok(row, 'preventivo creato');
  assert.equal(row.discount_pct, 10);
});

test('carico da fornitore (documento): costo, storico prezzi e giacenza; articolo nuovo; la Cassa non puo\'; doppione rifiutato', async () => {
  const id = await ask('carico da TechWholesale: 4 display a 38,50 e 2 cavi nuovi usb-c a 1,2 (ddt 4411)');
  await llm('ok', [
    { type: 'purchase_load', product: String(disp.id), fields: { qty: 4, unit_price: 38.5, supplier: 'TechWholesale', doc_number: 'DDT-4411', doc_date: '2026-11-03' } },
    { type: 'purchase_load', fields: { name: 'Cavo USB-C 1m', qty: 2, unit_price: 1.2, supplier: 'TechWholesale', doc_number: 'DDT-4411', category: 'Accessori' } },
    { type: 'purchase_load', fields: { name: 'display iphone 12', qty: 1, unit_price: 40, supplier: 'TechWholesale' } },
    { type: 'purchase_load', product: String(disp.id), fields: { qty: 1, unit_price: 40, supplier: 'Fornitore Inesistente' } },
  ]);
  const r = await get(id);
  assert.deepEqual(r.actions.map((a) => a.valid), [true, true, false, false]);
  assert.match(r.actions[0].lines.join(' '), /Giacenza: 1 → 5 pz/);
  assert.equal(r.actions[1].editablePrice, true, 'il prezzo di vendita del nuovo articolo si scrive nel riepilogo');
  const c = await confirm(id, { overrides: { 1: { price: '4,90' } } });
  assert.equal(c.data.done, 2, JSON.stringify(c.data.results));
  const p = (await call('GET', '/api/products?q=Display')).data[0];
  assert.equal(p.qty, 5);
  const n = (await call('GET', '/api/products?q=Cavo USB-C')).data[0];
  assert.equal(n.qty, 2);
  assert.equal(n.price, 4.9);
  assert.equal(n.cost, 1.2);
  const hist = await db.prepare('SELECT unit_price, qty FROM price_history WHERE product_id = ?').all(disp.id);
  assert.deepEqual(hist.map((h) => [h.unit_price, h.qty]), [[38.5, 4]], 'storico prezzi del fornitore aggiornato');
  // Cassa: mai i costi
  const idc = await ask('carico display', 'cassa');
  await llm('ok', [{ type: 'purchase_load', product: String(disp.id), fields: { qty: 1, unit_price: 40, supplier: 'TechWholesale' } }]);
  assert.match((await get(idc, 'cassa')).actions[0].errors.join(' '), /non è consentito al ruolo Cassa/);
});

test('messaggio per il cliente: testo + link WhatsApp col prefisso italiano, nessuna conferma necessaria (non invia nulla)', async () => {
  const id = await ask(`scrivi al cliente della ${repair.code}`);
  await llm('Ecco il messaggio.', [
    { type: 'draft_message', repair: repair.code, fields: { message: `Buongiorno Mario, la riparazione ${repair.code} è pronta: può passare a ritirarla. Informatix Repair` } },
    { type: 'draft_message', repair: repair.code, fields: {} },
  ]);
  const r = await get(id);
  assert.equal(r.status, 'done', 'solo letture: niente da confermare');
  assert.match(r.actions[0].link, /^https:\/\/wa\.me\/393331234567\?text=/);
  assert.ok(decodeURIComponent(r.actions[0].link).includes('è pronta'));
  assert.equal(r.actions[1].valid, false);
});

test('controllo dei dati: doppioni, articoli senza prezzo, vetrina senza foto', async () => {
  await call('POST', '/api/customers', { name: 'Mario R.', phone: '0039 3331234567' }); // stesso telefono di Mario Rossi (il gestionale lo riconosce: nessun doppione creato)
  await db.prepare("INSERT INTO customers (name, phone, created_at) VALUES ('Mario Doppio', '+39 333 123 4567', datetime('now'))").run();
  await call('POST', '/api/products', { name: 'Articolo senza prezzo', qty: 1 });
  await call('POST', '/api/usati?publish=0', { name: 'iPad senza foto', condition: 'usato', category: 'computer', price: 200 });
  const id = await ask('verifica che i dati siano a posto');
  await llm('Ecco il controllo.', [{ type: 'data_check' }]);
  const r = await get(id);
  assert.equal(r.status, 'done');
  const txt = r.actions[0].lines.join('\n');
  assert.match(txt, /Clienti con lo stesso telefono \(1\)/);
  assert.match(txt, /Articolo senza prezzo/);
  assert.match(txt, /senza foto \(1\): iPad senza foto/);
});

test('preferenze: solo l\'amministratore le salva (con conferma), l\'assistente le rispetta nei prompt, si tolgono dalla pagina', async () => {
  const id = await ask('d\'ora in poi arrotonda i prezzi di vendita a 9');
  await llm('Salvo la preferenza.', [{ type: 'remember', fields: { note: 'Arrotonda i prezzi di vendita a 9' } }]);
  assert.equal((await get(id)).actions[0].valid, true);
  assert.equal((await confirm(id)).data.done, 1);
  const prefs = (await call('GET', '/api/assistant/prefs')).data.prefs;
  assert.equal(prefs.length, 1);
  await ask('quanto costa un display?');
  const claim = await llm('ok');
  assert.match(claim.system, /PREFERENZE DI CHRISTIAN \(rispettale sempre\): 1\) Arrotonda i prezzi di vendita a 9/);
  // doppione e ruolo
  const id2 = await ask('d\'ora in poi arrotonda i prezzi di vendita a 9');
  await llm('ok', [{ type: 'remember', fields: { note: 'arrotonda i prezzi di vendita a 9' } }]);
  assert.match((await get(id2)).actions[0].errors.join(' '), /già salvata/);
  const id3 = await ask('ricorda che sempre IVA inclusa', 'staff');
  await llm('ok', [{ type: 'remember', fields: { note: 'Usa sempre IVA inclusa' } }]);
  assert.match((await get(id3, 'staff')).actions[0].errors.join(' '), /Solo l’amministratore/);
  assert.equal((await call('POST', '/api/assistant/prefs', { note: 'x' }, 'staff')).status, 403);
  assert.equal((await call('DELETE', `/api/assistant/prefs/${prefs[0].id}`, null, 'staff')).status, 403);
  assert.equal((await call('DELETE', `/api/assistant/prefs/${prefs[0].id}`)).status, 200);
  assert.equal((await call('GET', '/api/assistant/prefs')).data.prefs.length, 0);
  const audit = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE object_type = 'assistente'").get();
  assert.ok(audit.n >= 3, 'ogni preferenza salvata/tolta e\' nel Registro');
});

test('idee a schermo: suggerimenti calcolati dai dati veri (e senza ordini per la Cassa)', async () => {
  const ideas = (await call('GET', '/api/assistant/ideas')).data.ideas;
  assert.ok(ideas.some((i) => /sotto scorta/.test(i.label) && /ordini/.test(i.prompt)));
  assert.ok(ideas.some((i) => /senza foto/.test(i.label)));
  assert.ok(ideas.every((i) => i.icon && i.label && i.prompt));
  const cassa = (await call('GET', '/api/assistant/ideas', null, 'cassa')).data.ideas;
  assert.ok(!cassa.some((i) => /sotto scorta/.test(i.label)));
});

test('avvisi Telegram delle preferenze', () => {
  assert.match(describeEvent({ method: 'POST', path: '/api/assistant/prefs', status: 200, user: USERS.admin, body: { note: 'Arrotonda a 9' }, result: { ok: true } }), /nuova preferenza salvata[\s\S]*Arrotonda a 9/);
  assert.match(describeEvent({ method: 'DELETE', path: '/api/assistant/prefs/3', status: 200, user: USERS.admin, result: { ok: true } }), /preferenza tolta/);
});

test('difetti visti con Ollama vero: ordine senza voci e fornitore "da definire" = ordini sotto scorta; categoria della spesa dedotta dalla descrizione', async () => {
  const id = await ask('ordina quello che manca ai fornitori');
  await llm('ok', [{ type: 'new_order', fields: { supplier: 'da definire' } }]);
  const r = await get(id);
  assert.equal(r.actions.length >= 1, true);
  assert.ok(r.actions.every((a) => a.type === 'new_order'));
  assert.ok(r.actions.some((a) => a.valid) || r.actions.some((a) => /già in un ordine aperto|Nessun articolo sotto scorta/.test(a.errors.join(' '))), 'non deve dare l\'errore del fornitore "da definire"');
  assert.ok(!r.actions.some((a) => /non è in anagrafica/.test(a.errors.join(' '))));
  await call('POST', `/api/assistant/requests/${id}/cancel`, {});
  const id2 = await ask('spesa bolletta luce e carburante');
  await llm('ok', [
    { type: 'new_expense', fields: { description: 'Bolletta luce novembre', amount: 90 } },
    { type: 'new_expense', fields: { description: 'Benzina furgone', amount: 40 } },
    { type: 'new_expense', fields: { description: 'Cosa strana', amount: 5 } },
  ]);
  const c = await confirm(id2);
  assert.equal(c.data.done, 3, JSON.stringify(c.data.results));
  const exp = (await call('GET', '/api/expenses')).data;
  const rows = exp.rows || exp;
  assert.equal(rows.find((e) => e.description === 'Bolletta luce novembre').category, 'utenze');
  assert.equal(rows.find((e) => e.description === 'Benzina furgone').category, 'trasporti e carburante');
  assert.equal(rows.find((e) => e.description === 'Cosa strana').category, 'altro');
});

test('risposte istantanee: le richieste ricorrenti si risolvono subito, senza modello e senza PC; con una parola in piu\' si passa al modello', async () => {
  const { instantIntent } = await import('../assistente.mjs');
  for (const t of ['Quali articoli sono sotto scorta?', 'prepara gli ordini sotto scorta', 'Com\'è andata oggi?', 'quali riparazioni sono in ritardo', 'riparazioni pronte da ritirare', 'preventivi da approvare', 'fai un controllo dei dati', 'quali articoli sono fermi da tempo']) assert.ok(instantIntent(t), `doveva essere istantanea: ${t}`);
  for (const t of ['quali riparazioni sono in ritardo per Rossi', 'sotto scorta 3 display', 'carica 3 display', 'la R-2026-0001 è in ritardo', 'preparami un preventivo', 'quanti display sono sotto scorta e a che prezzo li vendo di solito?']) assert.equal(instantIntent(t), null, `doveva andare al modello: ${t}`);
  // il PC e' "spento": le istantanee rispondono lo stesso
  await db.prepare("UPDATE assistant_state SET value = ? WHERE key = 'agent_seen'").run(String(Date.now() - 3600_000));
  const q = await call('POST', '/api/assistant/message', { text: 'Quali articoli sono sotto scorta?' });
  assert.equal(q.data.instant, true);
  const low = await get(q.data.id);
  assert.equal(low.status, 'done');
  assert.equal(low.model, 'istantanea');
  assert.match(low.actions[0].lines.join('\n'), /Cavo Lightning 1m — 0 pz \(minimo 5\)/);
  assert.match(low.reply, /sotto scorta/);
  assert.ok(low.suggestions.length >= 1);
  const t = await call('POST', '/api/assistant/message', { text: 'Com\'è andata oggi?' });
  assert.match((await get(t.data.id)).actions[0].lines.join('\n'), /Incassato oggi: .*\n?.*Riparazioni entrate oggi: \d+/s);
  const late = await call('POST', '/api/assistant/message', { text: 'quali riparazioni sono in ritardo' });
  assert.equal((await get(late.data.id)).status, 'done');
  // un ordine: istantaneo ma con conferma
  const o = await call('POST', '/api/assistant/message', { text: 'prepara gli ordini sotto scorta' });
  const ord = await get(o.data.id);
  assert.equal(ord.model, 'istantanea');
  assert.ok(['awaiting_confirm', 'done'].includes(ord.status));
  if (ord.status === 'awaiting_confirm') assert.equal((await call('GET', '/api/orders')).data.length >= 0, true);
  // con un allegato si passa sempre dal modello
  const csv = Buffer.from('a;b\n1;2').toString('base64');
  const f = await call('POST', '/api/assistant/message', { text: 'Quali articoli sono sotto scorta?', file: { name: 'x.csv', type: 'text/csv', data: csv } });
  assert.equal(f.data.instant, undefined);
  assert.equal((await get(f.data.id)).status, 'queued');
  await call('POST', `/api/assistant/requests/${f.data.id}/cancel`, {});
  // idee: partono con un clic
  const ideas = (await call('GET', '/api/assistant/ideas')).data.ideas;
  assert.ok(ideas.every((i) => i.instant === true && instantIntent(i.prompt)), 'ogni idea a schermo e\' una richiesta istantanea');
});

test('richiesta di modifica al gestionale: diventa una Segnalazione di Christian, con riepilogo e conferma; troppo vaga = rifiutata', async () => {
  const id = await ask('vorrei che nella scheda riparazione ci fosse anche il colore della cover');
  await llm('Ho preparato la richiesta per Marco.', [
    { type: 'app_request', fields: { kind: 'miglioria', title: 'Colore della cover nella scheda', description: 'Nella scheda riparazione vorrei un campo per il colore della cover che porta il cliente, così non la confondiamo.', expected: 'Un campo «Cover» vicino al colore, stampato sulla scheda', page: 'Riparazioni', priority: 'normale' } },
    { type: 'app_request', fields: { title: 'Boh', description: 'cambia' } },
  ]);
  const r = await get(id);
  assert.deepEqual(r.actions.map((a) => a.valid), [true, false]);
  assert.match(r.actions[0].lines.join(' '), /Marco/);
  const c = await confirm(id);
  assert.equal(c.data.done, 1, JSON.stringify(c.data.results));
  const t = await db.prepare("SELECT * FROM tickets WHERE title = 'Colore della cover nella scheda'").get();
  assert.ok(t, 'segnalazione creata');
  assert.equal(t.kind, 'miglioria'); assert.equal(t.created_by, 'christian@test.it'); assert.equal(t.page, 'Riparazioni');
  assert.match(t.expected, /Cover/);
});

test('prompt: le istruzioni di app_request compaiono quando si chiede di cambiare il gestionale', async () => {
  const { systemPrompt } = await import('../assistente.mjs');
  assert.match(systemPrompt('', [], 'admin', { text: 'si potrebbe aggiungere un pulsante per stampare due etichette?' }), /app_request: richiesta di MODIFICA/);
  assert.doesNotMatch(systemPrompt('', [], 'admin', { text: 'carica 3 display iPhone 12' }), /app_request: richiesta di MODIFICA/);
});
