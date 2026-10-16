// Catalogo marche/modelli: suggerimenti dalla terza lettera nella scheda riparazione, auto-aggiunta dei modelli nuovi,
// gestione completa (cerca, aggiungi, modifica, elimina, import/export CSV). repairs.brand_model resta testo libero.
import { db } from './dbref.mjs';
import { HttpError } from './logic.mjs';
import { MODEL_SEED } from './seed/modelli.mjs';

const NOW = "datetime('now','localtime')";
const str = (v) => (v == null ? null : String(v).trim().replace(/\s+/g, ' ') || null);
export const MODEL_KINDS = { smartphone: 'Smartphone', tablet: 'Tablet', portatile: 'Portatile', pc: 'PC fisso', console: 'Console', altro: 'Altro' };
export const MODEL_SOURCES = { catalogo: 'Catalogo', auto: 'Aggiunto da una scheda', manuale: 'Inserito a mano' };
export const SUGGEST_MIN = 3; // lettere minime per i suggerimenti

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lc = (s) => String(s ?? '').toLowerCase();

/** Testo che si scrive nella scheda: "Samsung Galaxy S21" ma "iPhone 12" (se il modello contiene gia' la marca non si ripete). */
export const modelLabel = (m) => (lc(m.brand) === 'apple' || lc(m.model).startsWith(lc(m.brand)) ? m.model : `${m.brand} ${m.model}`);
const shape = (m) => ({ ...m, kind_label: MODEL_KINDS[m.kind] || m.kind, label: modelLabel(m) });

// ---------- Catalogo di partenza ----------
let seeded = false;
/** Carica il catalogo di partenza la prima volta (e solo allora: chi cancella i modelli non se li ritrova). */
export async function ensureSeed() {
  if (seeded) return;
  const done = await db.prepare("SELECT value FROM settings WHERE key = 'models_seeded'").get();
  if (!done) {
    await insertSeed();
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('models_seeded', '1')").run();
  }
  seeded = true;
}
/** Inserisce i modelli del catalogo che mancano (non tocca quelli gia' presenti). Ritorna quanti ne ha aggiunti. */
export async function insertSeed() {
  const before = (await db.prepare('SELECT COUNT(*) AS n FROM device_models').get()).n;
  const stmts = [];
  for (const [kind, brand, keywords, models] of MODEL_SEED) {
    for (const model of models) {
      stmts.push([`INSERT OR IGNORE INTO device_models (kind, brand, model, keywords, source, created_at, updated_at) VALUES (?,?,?,?, 'catalogo', ${NOW}, ${NOW})`, [kind, brand, model, keywords || null]]);
    }
  }
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  return (await db.prepare('SELECT COUNT(*) AS n FROM device_models').get()).n - before;
}

// ---------- Ricerca ----------
/** Tutte le parole scritte devono comparire in marca, modello o parole chiave (dalla terza lettera). */
function searchWhere(q, alias = '') {
  const a = alias ? `${alias}.` : '';
  const words = lc(q).split(/[\s,;]+/).filter(Boolean).slice(0, 6);
  const where = [];
  const args = [];
  for (const w of words) {
    where.push(`(${a}brand || ' ' || ${a}model || ' ' || COALESCE(${a}keywords,'')) LIKE ?`);
    args.push(`%${w.replace(/[%_]/g, '')}%`);
  }
  return { where, args, first: words[0] || '' };
}

export async function suggest(q, kind, limit = 12) {
  q = str(q) || '';
  if (q.length < SUGGEST_MIN) return [];
  await ensureSeed();
  const s = searchWhere(q);
  const where = [...s.where];
  const args = [...s.args];
  if (kind && kind in MODEL_KINDS) { where.push('kind = ?'); args.push(kind); }
  const rows = await db.prepare(`SELECT * FROM device_models WHERE ${where.join(' AND ')} ORDER BY uses DESC, brand, model LIMIT 200`).all(...args);
  const ql = lc(q);
  // chi inizia con quello che si e' scritto sale in alto; poi i piu' usati
  const rank = (m) => { const lab = lc(modelLabel(m)); return lab.startsWith(ql) ? 0 : lc(m.model).startsWith(ql) ? 1 : lab.includes(` ${ql}`) ? 2 : 3; };
  return rows.map(shape).sort((a, b) => rank(a) - rank(b) || b.uses - a.uses || a.label.localeCompare(b.label, 'it', { numeric: true })).slice(0, limit);
}

// ---------- Auto-aggiunta dalla scheda riparazione ----------
/**
 * Chiamata alla creazione della scheda: se il modello scritto e' nel catalogo ne aumenta l'uso, altrimenti lo aggiunge.
 * Ritorna { added, model }. Non solleva errori verso la scheda (il catalogo e' un aiuto, non un obbligo).
 */
export async function ensureModel(deviceType, text) {
  try {
    const t = str(text);
    if (!t || t.length < SUGGEST_MIN || t.length > 80) return { added: false };
    await ensureSeed();
    const hit = await db.prepare("SELECT * FROM device_models WHERE lower(model) = ? OR lower(brand || ' ' || model) = ? ORDER BY uses DESC LIMIT 1").get(lc(t), lc(t));
    if (hit) { await db.prepare('UPDATE device_models SET uses = uses + 1 WHERE id = ?').run(hit.id); return { added: false, model: hit }; }
    const kind = deviceType in MODEL_KINDS ? deviceType : 'altro';
    const { brand, model } = await splitBrand(t);
    await db.prepare(`INSERT OR IGNORE INTO device_models (kind, brand, model, source, uses, created_at, updated_at) VALUES (?,?,?, 'auto', 1, ${NOW}, ${NOW})`).run(kind, brand, model);
    return { added: true, model: { kind, brand, model } };
  } catch { return { added: false }; }
}

/** Separa marca e modello da un testo libero ("Samsung Galaxy A13" -> Samsung / Galaxy A13). */
export async function splitBrand(text) {
  const t = str(text);
  const brands = await db.prepare('SELECT DISTINCT brand, keywords FROM device_models').all();
  const low = lc(t);
  // marca scritta per prima
  const byName = brands.map((b) => b.brand).sort((a, b) => b.length - a.length).find((b) => low === lc(b) || low.startsWith(`${lc(b)} `));
  if (byName) { const rest = t.slice(byName.length).trim(); return { brand: byName, model: rest || t }; }
  // parola tipica di una marca ("Galaxy" -> Samsung, "iPhone" -> Apple): il modello e' tutto il testo
  const first = low.split(' ')[0];
  const byKey = brands.find((b) => lc(b.keywords).split(/\s+/).includes(first) && first.length >= 3);
  if (byKey) return { brand: byKey.brand, model: t };
  const [w, ...rest] = t.split(' ');
  return { brand: cap(w), model: rest.join(' ') || t };
}

// ---------- CSV ----------
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function parseCsv(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const KIND_ALIAS = { telefono: 'smartphone', cellulare: 'smartphone', smartphone: 'smartphone', tablet: 'tablet', portatile: 'portatile', notebook: 'portatile', laptop: 'portatile', pc: 'pc', 'pc fisso': 'pc', desktop: 'pc', console: 'console', altro: 'altro' };
export const kindFrom = (s) => KIND_ALIAS[lc(s).trim()] || (lc(s).trim() in MODEL_KINDS ? lc(s).trim() : null);

export function registerModelRoutes(app, h) {
  const clean = (b) => {
    const brand = str(b.brand);
    const model = str(b.model);
    if (!brand) throw new HttpError(400, 'Modello non salvato: manca la marca.', { code: 'MARCA_MANCANTE', hint: 'Scrivi la marca (es. Apple).' });
    if (!model) throw new HttpError(400, 'Modello non salvato: manca il nome del modello.', { code: 'MODELLO_MANCANTE', hint: 'Scrivi il modello (es. iPhone 13).' });
    const kind = b.kind in MODEL_KINDS ? b.kind : 'smartphone';
    return { kind, brand, model, keywords: str(b.keywords) };
  };
  const dup = async (v, exceptId = 0) => {
    const d = await db.prepare('SELECT id FROM device_models WHERE kind = ? AND brand = ? AND model = ? AND id <> ?').get(v.kind, v.brand, v.model, exceptId);
    if (d) throw new HttpError(409, 'Il modello è già presente nel catalogo (stessa marca e stesso modello).', { code: 'MODELLO_DUPLICATO', hint: 'Cercalo nel catalogo e modificalo.' });
  };
  const listWhere = (query) => {
    const where = ['1=1'];
    const args = [];
    if (query.kind && query.kind in MODEL_KINDS) { where.push('kind = ?'); args.push(query.kind); }
    if (query.brand) { where.push('brand = ?'); args.push(query.brand); }
    if (query.source && query.source in MODEL_SOURCES) { where.push('source = ?'); args.push(query.source); }
    if (str(query.q)) { const s = searchWhere(query.q); where.push(...s.where); args.push(...s.args); }
    return { where, args };
  };

  app.get('/api/modelli/meta', h(async () => { await ensureSeed(); return { kinds: MODEL_KINDS, sources: MODEL_SOURCES, suggest_min: SUGGEST_MIN }; }));
  // Suggerimenti (autocomplete): dalla terza lettera
  app.get('/api/modelli/suggest', h(async (req) => ({ rows: await suggest(req.query.q, req.query.kind) })));
  app.get('/api/modelli/brands', h(async (req) => {
    await ensureSeed();
    const w = req.query.kind in MODEL_KINDS ? ' WHERE kind = ?' : '';
    return (await db.prepare(`SELECT brand, COUNT(*) AS n FROM device_models${w} GROUP BY brand ORDER BY brand`).all(...(w ? [req.query.kind] : []))).map((b) => ({ brand: b.brand, n: b.n }));
  }));
  app.get('/api/modelli', h(async (req) => {
    await ensureSeed();
    const { where, args } = listWhere(req.query);
    const rows = await db.prepare(`SELECT * FROM device_models WHERE ${where.join(' AND ')} ORDER BY CASE kind WHEN 'smartphone' THEN 0 WHEN 'tablet' THEN 1 WHEN 'portatile' THEN 2 WHEN 'pc' THEN 3 WHEN 'console' THEN 4 ELSE 5 END, brand, model LIMIT 1500`).all(...args);
    const counts = await db.prepare('SELECT kind, COUNT(*) AS n FROM device_models GROUP BY kind').all();
    const auto = (await db.prepare("SELECT COUNT(*) AS n FROM device_models WHERE source = 'auto'").get()).n;
    return { rows: rows.map(shape), counts: Object.fromEntries(counts.map((c) => [c.kind, c.n])), auto };
  }));
  app.get('/api/modelli/export.csv', async (c) => {
    try {
      await ensureSeed();
      const { where, args } = listWhere(c.req.query());
      const rows = await db.prepare(`SELECT * FROM device_models WHERE ${where.join(' AND ')} ORDER BY CASE kind WHEN 'smartphone' THEN 0 WHEN 'tablet' THEN 1 WHEN 'portatile' THEN 2 WHEN 'pc' THEN 3 WHEN 'console' THEN 4 ELSE 5 END, brand, model`).all(...args);
      const lines = [['Tipo', 'Marca', 'Modello', 'Parole chiave'].map(csvCell).join(';')];
      for (const m of rows) lines.push([m.kind, m.brand, m.model, m.keywords].map(csvCell).join(';'));
      return c.body('﻿' + lines.join('\r\n'), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="catalogo-modelli.csv"', 'cache-control': 'no-store' });
    } catch { return c.json({ ok: false, error: 'Esportazione non riuscita' }, 500); }
  });
  // Import CSV: colonne Tipo;Marca;Modello;Parole chiave (la riga di intestazione e' facoltativa). I doppioni si saltano.
  app.post('/api/modelli/import', h(async (req) => {
    await ensureSeed();
    const rows = parseCsv(req.body.csv);
    if (!rows.length) throw new HttpError(400, 'Importazione non eseguita: il file non contiene righe.', { code: 'FILE_VUOTO', hint: 'Controlla il file e riprova.' });
    if (rows.length > 5000) throw new HttpError(400, 'Importazione non eseguita: il file ha più di 5000 righe.', { code: 'TROPPE_RIGHE', hint: 'Dividi il file in più parti.' });
    let added = 0; let skipped = 0;
    const errors = [];
    const stmts = [];
    const seen = new Set();
    rows.forEach((r, i) => {
      if (i === 0 && /marca|brand/i.test(r.join(' '))) return;
      const kind = kindFrom(r[0]);
      const brand = str(r[1]);
      const model = str(r[2]);
      if (!kind || !brand || !model) { errors.push(`Riga ${i + 1}: servono tipo valido, marca e modello`); return; }
      const key = `${kind}|${lc(brand)}|${lc(model)}`;
      if (seen.has(key)) { skipped++; return; }
      seen.add(key);
      stmts.push([kind, brand, model, str(r[3])]);
    });
    for (const [kind, brand, model, kw] of stmts) {
      const r = await db.prepare(`INSERT OR IGNORE INTO device_models (kind, brand, model, keywords, source, created_at, updated_at) VALUES (?,?,?,?, 'manuale', ${NOW}, ${NOW})`).run(kind, brand, model, kw);
      if (r.changes) added++; else skipped++;
    }
    return { added, skipped, errors: errors.slice(0, 20), error_count: errors.length };
  }));
  // Rimette nel catalogo i modelli di partenza eventualmente cancellati (non tocca gli altri)
  app.post('/api/modelli/ripristina', h(async () => { await ensureSeed(); return { added: await insertSeed() }; }));
  app.get('/api/modelli/:id', h(async (req) => {
    const m = await db.prepare('SELECT * FROM device_models WHERE id = ?').get(req.params.id);
    if (!m) throw new HttpError(404, 'Modello non trovato', { code: 'MODELLO_NON_TROVATO', hint: 'Aggiorna il catalogo: potrebbe essere stato eliminato.' });
    return shape(m);
  }));
  app.post('/api/modelli', h(async (req) => {
    await ensureSeed();
    const v = clean(req.body);
    await dup(v);
    const r = await db.prepare(`INSERT INTO device_models (kind, brand, model, keywords, source, created_at, updated_at) VALUES (?,?,?,?, 'manuale', ${NOW}, ${NOW})`).run(v.kind, v.brand, v.model, v.keywords);
    return shape(await db.prepare('SELECT * FROM device_models WHERE id = ?').get(r.lastInsertRowid));
  }));
  app.put('/api/modelli/:id', h(async (req) => {
    const old = await db.prepare('SELECT * FROM device_models WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError(404, 'Modello non trovato', { code: 'MODELLO_NON_TROVATO', hint: 'Aggiorna il catalogo: potrebbe essere stato eliminato.' });
    const v = clean(req.body);
    await dup(v, old.id);
    await db.prepare(`UPDATE device_models SET kind=?, brand=?, model=?, keywords=?, updated_at=${NOW} WHERE id=?`).run(v.kind, v.brand, v.model, v.keywords, old.id);
    return shape(await db.prepare('SELECT * FROM device_models WHERE id = ?').get(old.id));
  }));
  app.delete('/api/modelli/:id', h(async (req) => {
    const r = await db.prepare('DELETE FROM device_models WHERE id = ?').run(req.params.id);
    if (!r.changes) throw new HttpError(404, 'Modello non trovato', { code: 'MODELLO_NON_TROVATO', hint: 'Aggiorna il catalogo: potrebbe essere stato eliminato.' });
    return { ok: true };
  }));
}

export const MODEL_TABLES = ['device_models'];
