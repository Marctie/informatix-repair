// Registro dispositivi: seriale/IMEI, sottoclassi (nuovo/usato/...), storico per dispositivo e segnalazione "rubato / da verificare".
// NON include la parte "blacklist/Blacks" (punto 12b): in sospeso per decisione di Marco, vedi docs/DOMANDE-APERTE.md.
import { db } from './dbref.mjs';
import { HttpError, money } from './logic.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim() || null);
const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Il valore indicato per il dispositivo non è valido (serve un numero uguale o maggiore di zero).', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi l’importo in euro (es. 150,00).' });
  return money(n);
};

export const CATEGORIES = { nuovo: 'Nuovi', usato: 'Usati', ricondizionato: 'Ricondizionati', da_smaltire: 'Da smaltire', in_arrivo: 'In arrivo' };
export const KINDS = { smartphone: 'Smartphone', tablet: 'Tablet', portatile: 'Portatile', pc: 'PC fisso', console: 'Console', smartwatch: 'Smartwatch', altro: 'Altro' };
export const FLAGS = { ok: 'Regolare', stolen: 'Rubato / smarrito', check: 'Da verificare' };

/** Chiave di confronto: minuscole e solo lettere/cifre (cosi' "ab-12 34" e "AB1234" sono lo stesso seriale). */
export const serialKey = (s) => {
  const k = String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return k.length >= 4 ? k : null;
};

/** IMEI: 15 cifre con cifra di controllo (Luhn). null = non e' un IMEI (puo' essere un seriale). */
export function imeiValid(s) {
  const v = String(s || '').trim();
  if (!/^\d{15}$/.test(v)) return null;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(v[14 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Dispositivi gia' registrati con quel seriale/IMEI (anche IMEI 2). */
export async function findBySerial(serial, excludeId = 0) {
  const k = serialKey(serial);
  if (!k) return [];
  return db.prepare('SELECT * FROM devices WHERE (serial_key = ? OR imei2_key = ?) AND id <> ? ORDER BY id').all(k, k, excludeId);
}

/**
 * Aggancio per riparazioni e vendite: annota nello storico dei dispositivi che il seriale e' entrato
 * e restituisce gli eventuali dispositivi SEGNALATI (rubato / da verificare) per mostrare l'avviso.
 */
export async function deviceHook(serial, kind, note, by) {
  const found = await findBySerial(serial);
  for (const d of found) {
    await db.prepare(`INSERT INTO device_events (device_id, kind, note, by_user, created_at) VALUES (?,?,?,?,${NOW})`).run(d.id, kind, note, by || null);
  }
  return found.filter((d) => d.flag !== 'ok').map((d) => ({ id: d.id, brand_model: d.brand_model, serial: d.serial, flag: d.flag, flag_label: FLAGS[d.flag], flag_note: d.flag_note, flag_report_no: d.flag_report_no }));
}

export const alertText = (a) => `ATTENZIONE: il seriale ${a.serial} (${a.brand_model}) e' segnalato come "${a.flag_label}"${a.flag_note ? ` — ${a.flag_note}` : ''}${a.flag_report_no ? ` (denuncia ${a.flag_report_no})` : ''}. Non procedere senza verificare.`;

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function registerDeviceRoutes(app, h) {
  const adminOnly = (req) => { if (req.user && req.user.role !== 'admin') throw new HttpError(403, 'Operazione riservata all’amministratore: il tuo utente non ha il permesso.', { code: 'SOLO_ADMIN', hint: 'Accedi come amministratore, oppure chiedi a Christian/Marco di farlo.' }); };
  const who = (req) => req.user?.email || 'locale';
  const event = (id, kind, note, req) => db.prepare(`INSERT INTO device_events (device_id, kind, note, by_user, created_at) VALUES (?,?,?,?,${NOW})`).run(id, kind, note, who(req));

  const clean = async (b, id = 0) => {
    const brand = str(b.brand_model);
    if (!brand) throw new HttpError(400, 'Dispositivo non registrato: mancano marca e modello.', { code: 'DISPOSITIVO_MODELLO_MANCANTE', hint: 'Scrivi marca e modello (es. Apple iPhone 13).' });
    const category = b.category in CATEGORIES ? b.category : 'usato';
    const kind = b.kind in KINDS ? b.kind : 'smartphone';
    const serial = str(b.serial);
    const imei2 = str(b.imei2);
    for (const [label, v] of [['Seriale / IMEI', serial], ['IMEI 2', imei2]]) {
      if (imeiValid(v) === false && !b.imei_ok) throw new HttpError(400, `${label}: l’IMEI non è valido (la cifra di controllo non torna), quindi il dispositivo non è stato registrato.`, { code: 'IMEI_NON_VALIDO', hint: 'Rileggi l’IMEI (digita *#06#), oppure conferma che è corretto per forzare il salvataggio.' });
    }
    for (const v of [serial, imei2]) {
      if (!v) continue;
      const same = await findBySerial(v, id);
      if (same.length && !b.duplicate_ok) throw new HttpError(409, `Questo seriale è già registrato sul dispositivo ${same[0].brand_model} (n. ${same[0].id}): non lo duplico.`, { code: 'SERIALE_DUPLICATO', hint: 'Apri il dispositivo già presente, oppure conferma di volerlo registrare lo stesso.' });
    }
    for (const [col, table, what, code] of [['customer_id', 'customers', 'cliente', 'CLIENTE_NON_TROVATO'], ['supplier_id', 'suppliers', 'fornitore', 'FORNITORE_NON_TROVATO']]) {
      if (b[col] && !(await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(b[col]))) throw new HttpError(404, `Dispositivo non registrato: il ${what} collegato non esiste più in anagrafica.`, { code, hint: `Cerca di nuovo il ${what} o lascia il campo vuoto.` });
    }
    return {
      category, kind, brand_model: brand, serial, imei2, serial_key: serialKey(serial), imei2_key: serialKey(imei2),
      condition_notes: str(b.condition_notes), source: str(b.source), customer_id: b.customer_id || null, supplier_id: b.supplier_id || null,
      purchase_date: str(b.purchase_date), cost: numOrNull(b.cost), price: numOrNull(b.price), notes: str(b.notes),
    };
  };

  app.get('/api/dispositivi/meta', h(() => ({ categories: CATEGORIES, kinds: KINDS, flags: FLAGS })));

  app.get('/api/dispositivi', h(async (req) => {
    const where = ['1=1'];
    const args = [];
    const { category, flag, q } = req.query;
    if (category && category in CATEGORIES) { where.push('d.category = ?'); args.push(category); }
    if (flag === 'segnalati') where.push("d.flag <> 'ok'");
    else if (flag && flag in FLAGS) { where.push('d.flag = ?'); args.push(flag); }
    if (str(q)) {
      const like = `%${str(q)}%`;
      const k = serialKey(q);
      where.push('(d.brand_model LIKE ? OR d.serial LIKE ? OR d.imei2 LIKE ? OR d.notes LIKE ?' + (k ? ' OR d.serial_key = ? OR d.imei2_key = ?' : '') + ')');
      args.push(like, like, like, like);
      if (k) args.push(k, k);
    }
    const rows = await db.prepare(`SELECT d.*, c.name AS customer_name, s.name AS supplier_name FROM devices d LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN suppliers s ON s.id=d.supplier_id WHERE ${where.join(' AND ')} ORDER BY d.id DESC LIMIT 500`).all(...args);
    const counts = await db.prepare('SELECT category, COUNT(*) AS n FROM devices GROUP BY category').all();
    const flagged = (await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE flag <> 'ok'").get()).n;
    return { rows, counts: Object.fromEntries(counts.map((x) => [x.category, x.n])), flagged };
  }));

  // Controllo veloce di un seriale (usato dai moduli di riparazione e vendita)
  app.get('/api/dispositivi/check', h(async (req) => {
    const serial = str(req.query.serial);
    const found = await findBySerial(serial);
    return {
      imei: imeiValid(serial),
      known: found.map((d) => ({ id: d.id, brand_model: d.brand_model, category: d.category, flag: d.flag, flag_label: FLAGS[d.flag], flag_note: d.flag_note, flag_report_no: d.flag_report_no })),
      alert: found.some((d) => d.flag !== 'ok'),
    };
  }));

  // Elenco per la denuncia (CSV, si apre con Excel)
  app.get('/api/dispositivi/export.csv', async (c) => {
    try {
      const flag = c.req.query('flag');
      const cat = c.req.query('category');
      const where = ['1=1'];
      const args = [];
      if (flag === 'segnalati') where.push("d.flag <> 'ok'"); else if (flag in FLAGS) { where.push('d.flag = ?'); args.push(flag); }
      if (cat in CATEGORIES) { where.push('d.category = ?'); args.push(cat); }
      const ids = str(c.req.query('ids'))?.split(',').map(Number).filter(Number.isInteger);
      if (ids?.length) where.push(`d.id IN (${ids.map(() => '?').join(',')})`), args.push(...ids);
      const rows = await db.prepare(`SELECT d.*, cu.name AS customer_name, su.name AS supplier_name FROM devices d LEFT JOIN customers cu ON cu.id=d.customer_id LEFT JOIN suppliers su ON su.id=d.supplier_id WHERE ${where.join(' AND ')} ORDER BY d.id`).all(...args);
      const head = ['N.', 'Tipo', 'Sottoclasse', 'Marca e modello', 'Seriale / IMEI', 'IMEI 2', 'Stato', 'Data acquisto', 'Provenienza', 'Cliente', 'Fornitore', 'N. denuncia', 'Segnalato il', 'Note'];
      const lines = [head.map(csvCell).join(';')];
      for (const d of rows) lines.push([d.id, KINDS[d.kind] || d.kind, CATEGORIES[d.category], d.brand_model, d.serial, d.imei2, FLAGS[d.flag], d.purchase_date, d.source, d.customer_name, d.supplier_name, d.flag_report_no, d.flag_at, [d.flag_note, d.notes].filter(Boolean).join(' | ')].map(csvCell).join(';'));
      return c.body('﻿' + lines.join('\r\n'), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="dispositivi-seriali.csv"', 'cache-control': 'no-store' });
    } catch (e) { return c.json({ ok: false, error: 'Esportazione non riuscita' }, 500); }
  });

  app.get('/api/dispositivi/:id', h(async (req) => {
    const d = await db.prepare('SELECT d.*, c.name AS customer_name, s.name AS supplier_name FROM devices d LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN suppliers s ON s.id=d.supplier_id WHERE d.id = ?').get(req.params.id);
    if (!d) throw new HttpError(404, 'Dispositivo non trovato', { code: 'DISPOSITIVO_NON_TROVATO', hint: 'Riapri il registro dispositivi: potrebbe essere stato eliminato.' });
    const events = await db.prepare('SELECT * FROM device_events WHERE device_id = ? ORDER BY id DESC').all(d.id);
    // riparazioni con lo stesso seriale (anche scritto in modo diverso)
    const all = await db.prepare('SELECT r.id, r.code, r.serial, r.brand_model, r.status, r.created_at, c.name AS customer_name FROM repairs r JOIN customers c ON c.id=r.customer_id WHERE r.serial IS NOT NULL').all();
    const keys = [d.serial_key, d.imei2_key].filter(Boolean);
    const repairs = all.filter((r) => keys.includes(serialKey(r.serial)));
    return { ...d, events, repairs, flag_label: FLAGS[d.flag], category_label: CATEGORIES[d.category] };
  }));

  app.post('/api/dispositivi', h(async (req) => {
    const v = await clean(req.body);
    const r = await db.prepare(`INSERT INTO devices (category, kind, brand_model, serial, imei2, serial_key, imei2_key, condition_notes, source, customer_id, supplier_id, purchase_date, cost, price, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${NOW},${NOW})`).run(v.category, v.kind, v.brand_model, v.serial, v.imei2, v.serial_key, v.imei2_key, v.condition_notes, v.source, v.customer_id, v.supplier_id, v.purchase_date, v.cost, v.price, v.notes);
    const id = Number(r.lastInsertRowid);
    await event(id, 'creato', `Registrato come ${CATEGORIES[v.category]}.`, req);
    return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  }));

  app.put('/api/dispositivi/:id', h(async (req) => {
    const old = await db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Dispositivo non trovato', { code: 'DISPOSITIVO_NON_TROVATO', hint: 'Riapri il registro dispositivi: potrebbe essere stato eliminato.' });
    const v = await clean(req.body, old.id);
    await db.prepare(`UPDATE devices SET category=?, kind=?, brand_model=?, serial=?, imei2=?, serial_key=?, imei2_key=?, condition_notes=?, source=?, customer_id=?, supplier_id=?, purchase_date=?, cost=?, price=?, notes=?, updated_at=${NOW} WHERE id=?`)
      .run(v.category, v.kind, v.brand_model, v.serial, v.imei2, v.serial_key, v.imei2_key, v.condition_notes, v.source, v.customer_id, v.supplier_id, v.purchase_date, v.cost, v.price, v.notes, old.id);
    if (old.category !== v.category) await event(old.id, 'sottoclasse', `Da ${CATEGORIES[old.category]} a ${CATEGORIES[v.category]}.`, req);
    else await event(old.id, 'modificato', 'Dati modificati.', req);
    return db.prepare('SELECT * FROM devices WHERE id = ?').get(old.id);
  }));

  // Segnalazione rubato / da verificare. Togliere la segnalazione (tornare "regolare") e' riservato all'amministratore.
  app.post('/api/dispositivi/:id/segnala', h(async (req) => {
    const d = await db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!d) throw new HttpError(404, 'Dispositivo non trovato', { code: 'DISPOSITIVO_NON_TROVATO', hint: 'Riapri il registro dispositivi: potrebbe essere stato eliminato.' });
    const flag = req.body.flag;
    if (!(flag in FLAGS)) throw new HttpError(400, 'Segnalazione non salvata: lo stato scelto non esiste.', { code: 'STATO_DISPOSITIVO_NON_VALIDO', hint: 'Scegli uno degli stati proposti (ok, sospetto, bloccato…).' });
    if (flag === 'ok' && d.flag !== 'ok') adminOnly(req);
    const note = str(req.body.note);
    if (flag !== 'ok' && !note) throw new HttpError(400, `Dispositivo n. ${d.id}: la segnalazione richiede un motivo e non è stato scritto.`, { code: 'MOTIVO_MANCANTE', hint: 'Scrivi perché lo stai segnalando: resta nello storico.' });
    await db.prepare(`UPDATE devices SET flag=?, flag_note=?, flag_report_no=?, flag_at=${NOW}, updated_at=${NOW} WHERE id=?`).run(flag, flag === 'ok' ? null : note, flag === 'ok' ? null : str(req.body.report_no), d.id);
    await event(d.id, 'segnalazione', `${FLAGS[flag]}${note ? `: ${note}` : ''}${flag !== 'ok' && str(req.body.report_no) ? ` (denuncia ${str(req.body.report_no)})` : ''}`, req);
    return db.prepare('SELECT * FROM devices WHERE id = ?').get(d.id);
  }));

  app.delete('/api/dispositivi/:id', h(async (req) => {
    adminOnly(req);
    await db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
    return { ok: true };
  }));
}

export const DEVICE_TABLES = ['devices', 'device_events'];
