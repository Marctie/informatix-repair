// Motore Cloudflare D1 (database del Worker).
import { setDb, fixSql } from './dbref.mjs';

export function useD1(d1) {
  // D1 rifiuta i pattern LIKE oltre 50 byte ("LIKE or GLOB pattern too complex"): una ricerca lunga (codice incollato...) li accorcia.
  const enc = new TextEncoder();
  const clampLike = (v) => {
    if (typeof v !== 'string' || v.length < 3 || v[0] !== '%' || v[v.length - 1] !== '%' || enc.encode(v).length <= 48) return v;
    let core = v.slice(1, -1);
    while (enc.encode(core).length > 46) core = core.slice(0, -1);
    return `%${core}%`;
  };
  const st = (sql, a) => d1.prepare(fixSql(sql)).bind(...(/LIKE/i.test(sql) ? a.map(clampLike) : a));
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
