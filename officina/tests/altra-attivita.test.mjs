// Test: "Pagamento appeso" / Altra attività. La Cassa inserisce e poi non rivede; gli amministratori vedono e correggono; tutto nel Registro.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'officina-altra-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
const { createApps } = await import('../server.mjs');
const { closeDb } = await import('../db-node.mjs');
const { serve } = await import('@hono/node-server');

const auth = async (c, next) => { const role = c.req.header('x-role') || 'admin'; c.set('user', { email: `${role}@test.it`, name: role, role }); await next(); };
let srv, A;
before(async () => {
  srv = await new Promise((r) => { const s = serve({ fetch: createApps({ auth }).admin.fetch, port: 0, hostname: '127.0.0.1' }, () => r(s)); });
  A = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv.close(); closeDb(); rmSync(dir, { recursive: true, force: true }); });
const a = async (method, path, body, role = 'admin') => {
  const res = await fetch(A + path, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};
const day = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const sell = (extra, role) => a('POST', '/api/sales', { items: [{ name: 'Cavo', qty: 1, unit_price: 30 }], method: 'contanti', ...extra }, role);

test('vendita appesa: la Cassa la crea, poi sparisce da liste, report, cassa; l’admin la vede', async () => {
  const normal = await sell({}, 'cassa');
  assert.equal(normal.status, 200);
  const hung = await sell({ appeso: true }, 'cassa');
  assert.equal(hung.status, 200);
  assert.equal(hung.data.entity, 'altra');
  const list = (await a('GET', '/api/sales', null, 'cassa')).data;
  assert.ok(list.some((s) => s.id === normal.data.id));
  assert.ok(!list.some((s) => s.id === hung.data.id), 'la vendita appesa non è nella lista della Cassa');
  assert.equal((await a('GET', `/api/sales/${hung.data.id}`, null, 'cassa')).status, 404);
  assert.equal((await a('GET', `/api/sales/${hung.data.id}`, null, 'admin')).status, 200);
  const rep = (await a('GET', `/api/report?from=${day()}&to=${day()}`, null, 'cassa')).data;
  assert.equal(rep.total, 30);
  assert.equal(rep.rows.length, 1);
  const dash = (await a('GET', '/api/dashboard', null, 'cassa')).data;
  assert.equal(dash.cash_today, 30);
  // la Cassa non può leggere né toccare la sezione dell’altra attività
  assert.equal((await a('GET', '/api/altra', null, 'cassa')).status, 403);
  assert.equal((await a('DELETE', `/api/altra/payments/1`, null, 'cassa')).status, 403);
  // l’admin vede tutto, in Analisi e nella sezione dedicata
  const alt = (await a('GET', `/api/altra?from=${day()}&to=${day()}`)).data;
  assert.equal(alt.total, 30);
  assert.equal(alt.rows[0].ref_code, hung.data.code);
  const an = (await a('GET', `/api/analytics?from=${day()}&to=${day()}`)).data;
  assert.equal(an.income.total, 30);
  assert.equal(an.other.total, 30);
  assert.equal(an.sales.count, 1);
});

test('chiusura cassa: il contante appeso entra nel totale atteso (niente ammanchi), senza dettaglio', async () => {
  const prev = (await a('GET', `/api/closings/preview?day=${day()}`, null, 'cassa')).data.expected;
  assert.equal(prev.exp_cash, 60);
  assert.equal(prev.by_method.reduce((t, m) => t + m.total, 0), 30);
});

test('riparazione: acconto e saldo appesi; la scheda resta e il saldo torna', async () => {
  const r = (await a('POST', '/api/repairs', { customer: { name: 'Anna Altra', phone: '3391112222' }, brand_model: 'Tab', problem: 'Batteria', quote: 100, deposit: 20, deposit_method: 'contanti', appeso: true }, 'cassa')).data;
  assert.equal(r.paid, 20);
  const dep = await a('POST', `/api/repairs/${r.id}/deposit`, { amount: 30, method: 'carta', appeso: true }, 'cassa');
  assert.equal(dep.status, 200);
  assert.equal(dep.data.paid, 50);
  const del = await a('POST', `/api/repairs/${r.id}/deliver`, { final_price: 100, method: 'contanti', appeso: true }, 'cassa');
  assert.equal(del.status, 200);
  const rep = (await a('GET', `/api/report?from=${day()}&to=${day()}`, null, 'cassa')).data;
  assert.equal(rep.total, 30, 'solo la vendita normale resta in cassa');
  const alt = (await a('GET', `/api/altra?from=${day()}&to=${day()}`)).data;
  assert.equal(alt.total, 30 + 100);
});

test('CRUD admin: modifica, sposta, elimina e nuovo incasso; ogni passo è nel Registro', async () => {
  const mk = await a('POST', '/api/altra/payments', { amount: '45,50', method: 'bonifico', label: 'Ordine Rossi' });
  assert.equal(mk.status, 200);
  const id = mk.data.id;
  assert.equal((await a('POST', '/api/altra/payments', { amount: 0 })).data.code, 'IMPORTO_NON_VALIDO');
  assert.equal((await a('PUT', `/api/altra/payments/${id}`, { amount: 50 })).status, 200);
  assert.equal((await a('POST', `/api/altra/payments/${id}/move`, { to: 'main' })).status, 200);
  assert.equal((await a('PUT', `/api/altra/payments/${id}`, { amount: 1 })).status, 404, 'non è più dell’altra attività');
  assert.equal((await a('POST', `/api/altra/payments/${id}/move`, { to: 'altra' })).status, 200);
  assert.equal((await a('DELETE', `/api/altra/payments/${id}`)).status, 200);
  const log = (await a('GET', '/api/audit?type=pagamento')).data;
  const text = JSON.stringify(log);
  assert.ok(text.includes('altra attività'));
  assert.ok(text.includes('Ordine Rossi'));
});

test('spostare un pagamento di vendita su Informatix Repair riporta anche la vendita', async () => {
  const s = (await sell({ appeso: true })).data;
  const alt = (await a('GET', `/api/altra?from=${day()}&to=${day()}`)).data;
  const pay = alt.rows.find((p) => p.kind === 'sale' && p.ref_id === s.id);
  assert.ok(pay);
  await a('POST', `/api/altra/payments/${pay.id}/move`, { to: 'main' });
  assert.equal((await a('GET', `/api/sales/${s.id}`, null, 'cassa')).status, 200);
});

test('acconti e saldo di un ordine appesi: fuori dalla cassa, nell’altra attività', async () => {
  const o = (await a('POST', '/api/orders', { kind: 'cliente', customer_id: (await a('POST', '/api/customers', { name: 'Ordine Altra', phone: '3394445555' })).data.id, items: [{ description: 'Cover', qty: 1, unit_price: 40 }], deposit: 10, deposit_method: 'contanti', appeso: true }, 'cassa'));
  assert.equal(o.status, 200, JSON.stringify(o.data));
  const dep = await a('POST', `/api/orders/${o.data.id}/deposit`, { amount: 10, method: 'carta', appeso: true }, 'cassa');
  assert.equal(dep.status, 200);
  const del = await a('POST', `/api/orders/${o.data.id}/status`, { status: 'ordinato' }, 'cassa');
  assert.equal(del.status, 200);
  await a('POST', `/api/orders/${o.data.id}/status`, { status: 'arrivato' }, 'cassa');
  const fin = await a('POST', `/api/orders/${o.data.id}/status`, { status: 'consegnato', collect: true, method: 'contanti', appeso: true }, 'cassa');
  assert.equal(fin.status, 200);
  const alt = (await a('GET', `/api/altra?from=${day()}&to=${day()}`)).data;
  assert.equal(alt.rows.filter((p) => p.kind === 'order').reduce((t, p) => t + p.amount, 0), 40);
  const rep = (await a('GET', `/api/report?from=${day()}&to=${day()}`, null, 'cassa')).data;
  assert.ok(!rep.rows.some((p) => p.kind === 'order'));
});

test('fatture: quella di una vendita appesa è dell’altra azienda; la Cassa non la vede; l’admin può cambiare azienda', async () => {
  const s = (await sell({ appeso: true, customer_id: (await a('POST', '/api/customers', { name: 'Cliente Fatt', phone: '3396667777' })).data.id })).data;
  const inv = await a('POST', `/api/invoices/from-sale/${s.id}`, { number: 'F-ALT-1' });
  assert.equal(inv.status, 200, JSON.stringify(inv.data));
  assert.equal(inv.data.entity, 'altra');
  assert.equal((await a('GET', `/api/invoices/${inv.data.id}`, null, 'cassa')).status, 404);
  assert.ok(!(await a('GET', '/api/invoices?direction=emessa', null, 'cassa')).data.rows.some((i) => i.id === inv.data.id));
  assert.ok((await a('GET', '/api/invoices?entity=altra')).data.rows.some((i) => i.id === inv.data.id));
  assert.equal((await a('PUT', `/api/invoices/${inv.data.id}`, { number: 'F-ALT-1', issue_date: inv.data.issue_date, total: inv.data.total, entity: 'main' })).data.entity, 'main');
  assert.equal((await a('GET', `/api/invoices/${inv.data.id}`, null, 'cassa')).status, 200);
});
