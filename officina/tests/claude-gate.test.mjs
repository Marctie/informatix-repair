// Test: accesso di Claude Code alle Segnalazioni con CLAUDE_TOKEN (solo segnalazioni, agisce come Marco, 404 senza chiave).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

const dir = mkdtempSync(join(tmpdir(), 'officina-claude-'));
process.env.OFFICINA_DB = join(dir, 'test.db');
const { closeDb } = await import('../db-node.mjs');
const { db } = await import('../dbref.mjs');
const { createAdminApp } = await import('../app.mjs');
const { claudeGate } = await import('../claude-gate.mjs');
const { memoryMedia } = await import('../media.mjs');
after(() => { closeDb(); rmSync(dir, { recursive: true, force: true }); });

const KEY = 'chiave-claude-di-prova-0123456789abcdefgh';
const media = memoryMedia();
const ENV = { CLAUDE_TOKEN: KEY, OWNER_EMAIL: 'Marco@Test.it' };
const mk = (env) => { const a = new Hono(); a.all('/api/claude/*', claudeGate({ env: () => env, makeApp: (user) => createAdminApp({ auth: async (c, n) => { c.set('user', user); await n(); }, usati: { media: () => media } }) })); return a; };
const gate = mk(ENV);
const christian = createAdminApp({ auth: async (c, n) => { c.set('user', { email: 'christian@test.it', name: 'Christian', role: 'staff' }); await n(); }, usati: { media: () => media } });
const req = async (a, method, path, body, key = KEY) => {
  const r = await a.request(path, { method, headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, data: ct.includes('json') ? await r.json() : await r.text() };
};

test('senza chiave, con chiave sbagliata o senza segreto configurato: 404', async () => {
  assert.equal((await req(gate, 'GET', '/api/claude/tickets', null, null)).status, 404);
  assert.equal((await req(gate, 'GET', '/api/claude/tickets', null, 'sbagliata-sbagliata-sbagliata-sbagliata')).status, 404);
  assert.equal((await req(mk({}), 'GET', '/api/claude/tickets')).status, 404);
  assert.equal((await req(mk({ CLAUDE_TOKEN: 'corta' }), 'GET', '/api/claude/tickets', null, 'corta')).status, 404);
});

test('solo segnalazioni: il resto del gestionale resta chiuso anche con la chiave giusta', async () => {
  for (const [m, p] of [['GET', '/api/claude/repairs'], ['GET', '/api/claude/users'], ['DELETE', '/api/claude/tickets/1'], ['POST', '/api/claude/tickets'], ['GET', '/api/claude/export/clienti.csv']]) {
    const r = await req(gate, m, p, m === 'POST' ? { title: 'x' } : undefined);
    assert.equal(r.status, 403, `${m} ${p}`); assert.equal(r.data.code, 'SOLO_SEGNALAZIONI');
  }
});

test('legge le richieste di Christian, commenta e mette «Da verificare» firmato Marco', async () => {
  const t = await christian.request('/api/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'miglioria', title: 'Colore della cover', description: 'Vorrei un campo per il colore della cover nella scheda.', priority: 'normale' }) });
  const tk = await t.json();
  const list = await req(gate, 'GET', '/api/claude/tickets/report?stato=aperte');
  assert.equal(list.status, 200); assert.match(list.data.markdown, /Colore della cover/);
  const c = await req(gate, 'POST', `/api/claude/tickets/${tk.id}/comments`, { body: 'Preso in carico: lo preparo e te lo faccio provare.' });
  assert.equal(c.status, 200);
  const u = await req(gate, 'PUT', `/api/claude/tickets/${tk.id}`, { status: 'da_verificare', note: 'Pronto: c’è il campo «Cover» nella scheda.' });
  assert.equal(u.status, 200); assert.equal(u.data.status, 'da_verificare');
  const rows = await db.prepare('SELECT author, author_name, kind FROM ticket_comments WHERE ticket_id = ? ORDER BY id').all(tk.id);
  assert.ok(rows.length >= 3);
  assert.ok(rows.every((r) => r.author === 'marco@test.it' && r.author_name === 'Marco'), JSON.stringify(rows));
});
