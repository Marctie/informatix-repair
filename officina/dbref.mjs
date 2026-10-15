// Accesso al database indipendente dal motore: SQLite locale (Node) oppure Cloudflare D1 (Worker).
// Il resto del codice usa sempre db.prepare(sql).get/all/run(...) con await.
let impl = null;
export const setDb = (d) => { impl = d; };
export const getImpl = () => impl;

export const db = {
  prepare: (sql) => ({
    get: (...a) => impl.get(sql, a),
    all: (...a) => impl.all(sql, a),
    run: (...a) => impl.run(sql, a),
  }),
  exec: (sql) => impl.exec(sql),
  batch: (stmts) => impl.batch(stmts),
};

/** Esegue fn come unità: su SQLite locale è una transazione; su D1 (senza transazioni interattive) gira in sequenza dopo aver validato. */
export const tx = (fn) => impl.tx(fn);

// Data/ora "da negozio" (Europe/Rome), anche quando il Worker gira in UTC.
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const nowLocal = (d = new Date()) => fmt.format(d).replace(',', '');
/** Sostituisce l'espressione "ora locale" con il valore reale in fuso di Roma. */
export const fixSql = (sql) => sql.includes("datetime('now','localtime')") ? sql.replaceAll("datetime('now','localtime')", `'${nowLocal()}'`) : sql;

import { LEGAL_DEFAULTS } from './legal.mjs';
export const DEFAULT_SETTINGS = {
  ...LEGAL_DEFAULTS,
  shop_name: 'Informatix Repair',
  shop_address: 'Via Pecorari 178, Nocera Superiore (SA)',
  shop_phone: '+39 376 234 4151',
  public_base_url: '',
  default_warranty_days: '90',
  low_stock_default: '0',
  stale_days: '90',
  ready_days: '7',
  terms:
    'Il preventivo è indicativo fino all’approvazione. I dispositivi non ritirati entro 60 giorni dalla comunicazione di fine lavori possono essere trattenuti a copertura delle spese. Il negozio non risponde dei dati presenti sul dispositivo: si consiglia di effettuare un backup prima della consegna. Garanzia sulla riparazione secondo quanto indicato in ricevuta.',
};

export async function ensureDefaults() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }
}

export const getSettings = async () =>
  Object.fromEntries((await db.prepare('SELECT key, value FROM settings').all()).map((r) => [r.key, r.value]));

/** Utenti: crea il proprietario se manca (admin protetto). */
export async function ensureOwner(email) {
  if (!email) return;
  await db.prepare("INSERT OR IGNORE INTO users (email, name, role, protected, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(email.toLowerCase(), 'Proprietario', 'admin', 1);
}
