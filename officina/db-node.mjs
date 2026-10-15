// Motore SQLite locale (node:sqlite) per sviluppo, test e uso sul PC del negozio.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDb, fixSql, ensureDefaults, ensureOwner } from './dbref.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.OFFICINA_DB || join(HERE, 'data', 'officina.db');
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });

export const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
raw.exec(readFileSync(join(HERE, 'schema.sql'), 'utf8'));
// Migrazione per database creati con versioni precedenti.
const addColumn = (table, column, ddl) => {
  const cols = raw.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
};
addColumn('repairs', 'urgent', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'last_seen_at', 'TEXT');
addColumn('repair_parts', 'supplier_code', 'TEXT');
addColumn('repair_parts', 'supplier_name', 'TEXT');
addColumn('repair_parts', 'bought_at', 'TEXT');
addColumn('repairs', 'checklist_in', 'TEXT');
addColumn('repairs', 'checklist_pre', 'TEXT');
addColumn('repairs', 'checklist_out', 'TEXT');
addColumn('repairs', 'sign_requested', 'INTEGER NOT NULL DEFAULT 0');
addColumn('repairs', 'quote_option_id', 'INTEGER');
addColumn('repairs', 'device_fate', 'TEXT');
addColumn('repairs', 'color', 'TEXT');
addColumn('quotes', 'token', 'TEXT');
addColumn('repairs', 'fate_since', 'TEXT');
addColumn('repairs', 'fate_note', 'TEXT');
addColumn('repair_parts', 'order_state', 'TEXT');
addColumn('repair_parts', 'ordered_at', 'TEXT');
addColumn('quotes', 'sent_at', 'TEXT');
addColumn('quotes', 'sent_via', 'TEXT');

let depth = 0;
setDb({
  get: async (sql, a) => raw.prepare(fixSql(sql)).get(...a),
  all: async (sql, a) => raw.prepare(fixSql(sql)).all(...a),
  run: async (sql, a) => raw.prepare(fixSql(sql)).run(...a),
  exec: async (sql) => raw.exec(sql),
  batch: async (stmts) => { for (const [sql, a] of stmts) raw.prepare(fixSql(sql)).run(...a); },
  tx: async (fn) => {
    if (depth++ > 0) { try { return await fn(); } finally { depth--; } }
    raw.exec('BEGIN');
    try { const out = await fn(); raw.exec('COMMIT'); return out; }
    catch (e) { raw.exec('ROLLBACK'); throw e; }
    finally { depth--; }
  },
});
await ensureDefaults();
export const closeDb = () => raw.close();
export { ensureOwner };
