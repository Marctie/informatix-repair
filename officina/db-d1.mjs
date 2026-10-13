// Motore Cloudflare D1 (database del Worker).
import { setDb, fixSql } from './dbref.mjs';

export function useD1(d1) {
  const st = (sql, a) => d1.prepare(fixSql(sql)).bind(...a);
  setDb({
    get: async (sql, a) => (await st(sql, a).first()) ?? undefined,
    all: async (sql, a) => (await st(sql, a).all()).results,
    run: async (sql, a) => {
      const r = await st(sql, a).run();
      return { changes: r.meta.changes, lastInsertRowid: r.meta.last_row_id };
    },
    exec: async (sql) => { await d1.exec(sql.replace(/\s*\n\s*/g, ' ')); },
    batch: async (stmts) => { await d1.batch(stmts.map(([sql, a]) => st(sql, a))); },
    // D1 non ha transazioni interattive: le operazioni validano prima e scrivono poi, in sequenza.
    tx: async (fn) => fn(),
  });
}
