// Vetrina Usati dentro il gestionale: articoli nel database, foto nell'archivio (R2), pubblicazione sul sito tramite "publisher".
// Il sito pubblico legge content/usati/usati.json (+ public/images/usati/<slug>/...) e si rigenera da solo quando il file cambia.
import { db, nowLocal } from './dbref.mjs';
import { toResponse } from './errori.mjs';
import { HttpError, localDate } from './logic.mjs';
import { b64ToBytes, bytesToB64, DRAFT_MESSAGE } from './publisher.mjs';

export const JSON_PATH = 'content/usati/usati.json';
export const IMG_DIR = 'public/images/usati';
export const GRACE_DAYS = 7; // un articolo venduto resta in vetrina (barrato) per 7 giorni
export const CATEGORIES = [['smartphone', 'Smartphone'], ['computer', 'Computer e tablet'], ['audio-gaming', 'Audio e gaming']];
export const CONDITIONS = [['usato', 'Usato'], ['nuovo', 'Nuovo sigillato']];
const MAX_PHOTOS = 10;
const NOW = "datetime('now','localtime')";

const str = (v) => (v == null ? undefined : String(v).trim() || undefined);
const numOrUndef = (v) => { if (v === '' || v == null) return undefined; const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Un campo numerico dell’articolo usato non è valido (non numerico o negativo).', { code: 'NUMERO_NON_VALIDO', hint: 'Correggi prezzi e quantità con numeri uguali o maggiori di zero.' }); return n; };
const TEXT_FIELDS = ['name', 'nameEn', 'memory', 'memoryEn', 'color', 'colorEn', 'conditionLabel', 'conditionLabelEn', 'tagline', 'taglineEn', 'description', 'descriptionEn'];
// ordine dei campi nel JSON pubblicato (come in content/usati/usati.json)
const ORDER = ['slug', 'name', 'nameEn', 'memory', 'memoryEn', 'color', 'colorEn', 'condition', 'conditionLabel', 'conditionLabelEn', 'price', 'featured', 'photos', 'files', 'battery', 'cycles', 'tagline', 'taglineEn', 'description', 'descriptionEn', 'specs', 'specsEn', 'category', 'contact', 'sold', 'soldAt'];

export const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const daysSince = (date) => Math.round((Date.parse(localDate()) - Date.parse(date)) / 86400000);

/** Riga del database -> articolo completo (come nel JSON del sito + stato). */
export function rowToItem(row) {
  const d = parse(row.data, {});
  const list = parse(row.photo_list, []);
  const it = { ...d, slug: row.slug, name: row.name, price: row.price ?? null, sold: !!row.sold, soldAt: row.sold ? row.sold_at : null, photos: list.length };
  it.files = list.map((p) => p.name);
  return it;
}

/** Articolo come lo vuole il sito (senza campi interni). */
export function publicItem(row) {
  const it = rowToItem(row);
  const seq = it.files.every((f, i) => f === String(i + 1));
  if (seq) delete it.files; // foto "storiche" 1.jpg, 2.jpg...: il sito non ha bisogno dell'elenco
  const out = {};
  for (const k of ORDER) if (it[k] !== undefined && it[k] !== '' ) out[k] = it[k];
  if (out.specs === undefined) out.specs = [];
  if (!it.sold) { delete out.sold; delete out.soldAt; } // in vetrina: nessun campo di vendita
  return out;
}

export async function buildSiteJson() {
  const rows = await db.prepare('SELECT * FROM usati_items ORDER BY id DESC').all();
  const updated = rows.reduce((m, r) => (String(r.updated_at).slice(0, 10) > m ? String(r.updated_at).slice(0, 10) : m), '1970-01-01');
  return JSON.stringify({ updated: rows.length ? updated : localDate(), items: rows.map(publicItem) }, null, 2) + '\n';
}

const withStatus = (it, siteUrl) => {
  let status = 'active';
  let extra = {};
  if (it.sold) {
    const days = daysSince(it.soldAt);
    status = days >= GRACE_DAYS ? 'expired' : 'sold';
    extra = { daysSinceSold: days, daysLeft: Math.max(0, GRACE_DAYS - days) };
  }
  return { ...it, ...extra, status, photo_urls: [] , siteUrl };
};

const photoUrls = (it, list, siteUrl) => list.map((p) => ({
  name: p.name, legacy: !!p.legacy, pub: !!p.pub,
  thumb: p.legacy ? `${siteUrl}/${IMG_DIR.replace('public/', '')}/${it.slug}/${p.name}-t.jpg` : `/media/usati/${it.slug}/${p.name}-t.jpg`,
  full: p.legacy ? `${siteUrl}/${IMG_DIR.replace('public/', '')}/${it.slug}/${p.name}.jpg` : `/media/usati/${it.slug}/${p.name}.jpg`,
}));

const outItem = (row, siteUrl) => {
  const it = withStatus(rowToItem(row), siteUrl);
  it.photo_urls = photoUrls(it, parse(row.photo_list, []), siteUrl);
  delete it.siteUrl;
  return it;
};

// ---------- stato di pubblicazione ----------
const META = { dirty: 'usati_dirty', at: 'usati_published_at', error: 'usati_error' };
const setMeta = (k, v) => db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v ?? ''));
const getMeta = async (k) => (await db.prepare('SELECT value FROM settings WHERE key = ?').get(k))?.value || '';
export async function publishStatus(publisher) {
  return {
    mode: publisher.mode, enabled: !!publisher.enabled, repo: publisher.repo || null, branch: publisher.branch || null,
    dirty: (await getMeta(META.dirty)) === '1', published_at: (await getMeta(META.at)) || null, error: (await getMeta(META.error)) || null,
  };
}
const markDirty = () => setMeta(META.dirty, '1');

/** Pubblica sul sito (foto nuove, JSON, cancellazioni). Non lancia: restituisce lo stato. */
export async function publishNow({ publisher, media }) {
  if (!publisher.enabled) { await markDirty(); return { state: 'draft', message: DRAFT_MESSAGE, ...(await publishStatus(publisher)) }; }
  try {
    const rows = await db.prepare('SELECT * FROM usati_items ORDER BY id DESC').all();
    const files = [];
    const touched = [];
    for (const r of rows) {
      const list = parse(r.photo_list, []);
      for (const p of list) {
        if (p.pub || p.legacy) continue;
        for (const suffix of ['', '-t']) {
          const o = await media.get(`usati/${r.slug}/${p.name}${suffix}.jpg`);
          if (!o) throw new Error(`Foto mancante nell’archivio: ${r.slug}/${p.name}${suffix}.jpg`);
          files.push({ path: `${IMG_DIR}/${r.slug}/${p.name}${suffix}.jpg`, base64: bytesToB64(o.bytes) });
        }
        touched.push([r, p.name]);
      }
    }
    const trash = (await db.prepare('SELECT path FROM usati_trash').all()).map((t) => t.path);
    const res = await publisher.publish({ jsonPath: JSON_PATH, jsonText: await buildSiteJson(), files, deletes: trash });
    for (const [r, name] of touched) {
      const fresh = await db.prepare('SELECT photo_list FROM usati_items WHERE id = ?').get(r.id);
      const list = parse(fresh?.photo_list, []).map((p) => (p.name === name ? { ...p, pub: true } : p));
      await db.prepare('UPDATE usati_items SET photo_list = ? WHERE id = ?').run(JSON.stringify(list), r.id);
    }
    await db.prepare('DELETE FROM usati_trash').run();
    await setMeta(META.dirty, '0');
    await setMeta(META.at, nowLocal());
    await setMeta(META.error, '');
    return { state: res.changed ? 'published' : 'unchanged', message: res.changed ? 'Pubblicato: il sito si aggiorna entro un paio di minuti.' : 'Il sito era già aggiornato.', ...(await publishStatus(publisher)) };
  } catch (e) {
    console.error('Pubblicazione usati non riuscita:', e.message);
    await markDirty();
    await setMeta(META.error, e.message);
    return { state: 'error', code: 'PUBBLICAZIONE_FALLITA', hint: 'Le modifiche restano salvate nel gestionale: ripremi Pubblica tra qualche minuto; se si ripete avvisa Marco.', message: `Pubblicazione sul sito non riuscita: ${e.message}`, ...(await publishStatus(publisher)) };
  }
}

// ---------- validazione ----------
function fromBody(body, prev = {}) {
  const d = { ...prev };
  for (const k of TEXT_FIELDS) if (k in body) { const v = str(body[k]); if (v === undefined) delete d[k]; else d[k] = v; }
  if ('condition' in body) { if (!CONDITIONS.some(([v]) => v === body.condition)) throw new HttpError(400, 'La condizione indicata per l’articolo usato non è tra quelle previste.', { code: 'CONDIZIONE_NON_VALIDA', hint: 'Scegli una condizione dall’elenco (es. ottimo, buono, usurato).' }); d.condition = body.condition; }
  if ('category' in body) { if (!CATEGORIES.some(([v]) => v === body.category)) throw new HttpError(400, 'La categoria indicata per l’articolo usato non è tra quelle previste.', { code: 'CATEGORIA_NON_VALIDA', hint: 'Scegli una categoria dall’elenco.' }); d.category = body.category; }
  for (const k of ['battery', 'cycles']) if (k in body) { const n = numOrUndef(body[k]); if (n === undefined) delete d[k]; else d[k] = Math.round(n); }
  if (d.battery > 100) throw new HttpError(400, 'Lo stato batteria indicato non è valido: deve essere una percentuale tra 0 e 100.', { code: 'BATTERIA_NON_VALIDA', hint: 'Scrivi un numero da 0 a 100.' });
  for (const k of ['featured', 'contact']) if (k in body) d[k] = !!body[k];
  for (const k of ['specs', 'specsEn']) {
    if (!(k in body)) continue;
    const arr = (Array.isArray(body[k]) ? body[k] : []).map((p) => [str(p?.[0]), str(p?.[1])]).filter(([a, b]) => a && b);
    if (arr.length || k === 'specs') d[k] = arr; else delete d[k];
  }
  d.featured = !!d.featured; d.contact = !!d.contact;
  return d;
}

async function uniqueSlug(base) {
  let slug = base || 'articolo';
  for (let n = 2; await db.prepare('SELECT id FROM usati_items WHERE slug = ?').get(slug); n++) slug = `${base || 'articolo'}-${n}`;
  return slug;
}
const load = async (slug) => {
  const row = await db.prepare('SELECT * FROM usati_items WHERE slug = ?').get(slug);
  if (!row) throw new HttpError(404, 'L’articolo usato non esiste più (potrebbe essere stato venduto o eliminato).', { code: 'ARTICOLO_USATO_NON_TROVATO', hint: 'Aggiorna l’elenco degli usati.' });
  return row;
};
const photoName = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const isJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const trashPaths = (slug, p) => [`${IMG_DIR}/${slug}/${p.name}.jpg`, `${IMG_DIR}/${slug}/${p.name}-t.jpg`];

/** Articolo nel formato del sito (content/usati/usati.json) -> riga del database. Le foto gia' sul sito sono "storiche" (legacy). */
export function itemToRow(it) {
  const { slug, name, price, sold, soldAt, photos, files, ...rest } = it;
  const names = files?.length ? files : Array.from({ length: photos || 0 }, (_, i) => String(i + 1));
  return { slug, name, price: price ?? null, sold: sold ? 1 : 0, sold_at: sold ? soldAt : null, data: JSON.stringify(rest), photo_list: JSON.stringify(names.map((x) => ({ name: x, legacy: true, pub: true }))) };
}

/** Importa articoli dal formato del sito. Restituisce quanti ne ha aggiunti (quelli gia' presenti non si toccano). */
export async function importItems(items) {
  let n = 0;
  for (const it of [...items].reverse()) { // l'ultimo inserito e' il primo della lista (ORDER BY id DESC)
    const r = itemToRow(it);
    if (await db.prepare('SELECT id FROM usati_items WHERE slug = ?').get(r.slug)) continue;
    await db.prepare(`INSERT INTO usati_items (slug,name,price,sold,sold_at,data,photo_list,created_at,updated_at) VALUES (?,?,?,?,?,?,?,${NOW},${NOW})`)
      .run(r.slug, r.name, r.price, r.sold, r.sold_at, r.data, r.photo_list);
    n++;
  }
  return n;
}

/**
 * Monta le rotte /api/usati e /media/usati sull'app Hono.
 * deps: { h, adminOnly, publisher:(c)=>publisher, media:(c)=>media, siteUrl:(c)=>string }
 */
export function mountUsati(app, { h, adminOnly, publisher, media, siteUrl }) {
  const site = (c) => String((siteUrl?.(c)) || 'https://informatixrepair.com').replace(/\/$/, '');
  const autoPublish = async (c, query) => (query?.publish === '0' ? { state: 'pending', ...(await publishStatus(publisher(c))) } : publishNow({ publisher: publisher(c), media: media(c) }));

  app.get('/api/usati/meta', h(() => ({ categories: CATEGORIES, conditions: CONDITIONS, max_photos: MAX_PHOTOS, grace_days: GRACE_DAYS })));
  app.get('/api/usati', h(async ({ c }) => {
    const rows = await db.prepare('SELECT * FROM usati_items ORDER BY id DESC').all();
    return { items: rows.map((r) => outItem(r, site(c))), publish: await publishStatus(publisher(c)) };
  }));
  app.post('/api/usati/publish', h(async ({ c }) => publishNow({ publisher: publisher(c), media: media(c) })));
  app.get('/api/usati/:slug', h(async ({ c, params }) => outItem(await load(params.slug), site(c))));

  app.post('/api/usati', h(async ({ c, body, query }) => {
    const d = fromBody(body);
    if (!d.name) throw new HttpError(400, 'Articolo usato non salvato: manca il nome.', { code: 'NOME_MANCANTE', hint: 'Scrivi il nome (es. iPhone 12 128GB nero).' });
    if (!d.condition) throw new HttpError(400, 'Articolo usato non salvato: manca la condizione.', { code: 'CONDIZIONE_MANCANTE', hint: 'Scegli la condizione dall’elenco.' });
    if (!d.category) d.category = 'smartphone';
    if (!d.conditionLabel) d.conditionLabel = CONDITIONS.find(([v]) => v === d.condition)[1];
    if (!d.specs) d.specs = [];
    const price = numOrUndef(body.price) ?? null;
    const slug = await uniqueSlug(slugify([d.name, d.memory, d.color].filter(Boolean).join(' ')));
    const { name, ...rest } = d;
    await db.prepare(`INSERT INTO usati_items (slug,name,price,data,created_at,updated_at) VALUES (?,?,?,?,${NOW},${NOW})`).run(slug, name, price, JSON.stringify(rest));
    await markDirty();
    return { ...outItem(await load(slug), site(c)), publish: await autoPublish(c, query) };
  }));

  app.put('/api/usati/:slug', h(async ({ c, params, body, query }) => {
    const row = await load(params.slug);
    const d = fromBody(body, parse(row.data, {}));
    const name = 'name' in body ? str(body.name) : row.name;
    if (!name) throw new HttpError(400, 'Articolo usato non salvato: manca il nome.', { code: 'NOME_MANCANTE', hint: 'Scrivi il nome (es. iPhone 12 128GB nero).' });
    const price = 'price' in body ? (numOrUndef(body.price) ?? null) : row.price;
    delete d.name;
    await db.prepare(`UPDATE usati_items SET name=?, price=?, data=?, updated_at=${NOW} WHERE id=?`).run(name, price, JSON.stringify(d), row.id);
    await markDirty();
    return { ...outItem(await load(params.slug), site(c)), publish: await autoPublish(c, query) };
  }));

  const setSold = (sold) => h(async ({ c, params, query }) => {
    const row = await load(params.slug);
    await db.prepare(`UPDATE usati_items SET sold=?, sold_at=?, updated_at=${NOW} WHERE id=?`).run(sold ? 1 : 0, sold ? localDate() : null, row.id);
    await markDirty();
    return { ...outItem(await load(params.slug), site(c)), publish: await autoPublish(c, query) };
  });
  app.post('/api/usati/:slug/sold', setSold(true));
  app.post('/api/usati/:slug/unsold', setSold(false));

  app.delete('/api/usati/:slug', h(async ({ c, params, user, query }) => {
    adminOnly({ user });
    const row = await load(params.slug);
    const list = parse(row.photo_list, []);
    for (const p of list) {
      if (p.pub || p.legacy) for (const path of trashPaths(row.slug, p)) await db.prepare('INSERT OR IGNORE INTO usati_trash (path) VALUES (?)').run(path);
      if (!p.legacy) for (const s of ['', '-t']) await media(c).remove(`usati/${row.slug}/${p.name}${s}.jpg`).catch(() => {});
    }
    await db.prepare('DELETE FROM usati_items WHERE id = ?').run(row.id);
    await markDirty();
    return { ok: true, name: row.name, slug: row.slug, publish: await autoPublish(c, query) };
  }));

  // Foto: il browser le ridimensiona e manda JPEG in base64 (grande + miniatura). Non pubblicano da sole: si pubblica a fine modifica.
  app.post('/api/usati/:slug/photos', h(async ({ c, params, body }) => {
    const row = await load(params.slug);
    const list = parse(row.photo_list, []);
    if (list.length >= MAX_PHOTOS) throw new HttpError(400, `Foto non aggiunta: l’articolo ha già il massimo di ${MAX_PHOTOS} foto.`, { code: 'TROPPE_FOTO', hint: 'Elimina una foto prima di aggiungerne un’altra.' });
    let full; let thumb;
    try { full = b64ToBytes(String(body.image || '')); thumb = b64ToBytes(String(body.thumb || '')); } catch { throw new HttpError(400, 'La foto dell’articolo non è leggibile.', { code: 'FOTO_NON_VALIDA', hint: 'Scatta di nuovo la foto e riprova.' }); }
    if (!isJpeg(full) || !isJpeg(thumb)) throw new HttpError(400, 'La foto dell’articolo non è un file JPEG.', { code: 'FOTO_NON_JPEG', hint: 'Usa una foto in formato JPG.' });
    if (full.length > 1_500_000 || thumb.length > 300_000) throw new HttpError(413, 'La foto dell’articolo è troppo grande.', { code: 'FOTO_TROPPO_GRANDE', hint: 'Ridimensionala (di solito lo fa il browser: ricarica la pagina).' });
    const m = media(c);
    const name = photoName();
    await m.put(`usati/${row.slug}/${name}.jpg`, full);
    await m.put(`usati/${row.slug}/${name}-t.jpg`, thumb);
    list.push({ name, legacy: false, pub: false });
    await db.prepare(`UPDATE usati_items SET photo_list=?, updated_at=${NOW} WHERE id=?`).run(JSON.stringify(list), row.id);
    await markDirty();
    return outItem(await load(params.slug), site(c));
  }));
  app.put('/api/usati/:slug/photos/order', h(async ({ c, params, body }) => {
    const row = await load(params.slug);
    const list = parse(row.photo_list, []);
    const order = Array.isArray(body.order) ? body.order.map(String) : [];
    if (order.length !== list.length || !list.every((p) => order.includes(p.name))) throw new HttpError(400, 'Il nuovo ordine delle foto non corrisponde a quelle presenti.', { code: 'ORDINE_FOTO_NON_VALIDO', hint: 'Ricarica la scheda e riordina di nuovo le foto.' });
    const sorted = order.map((n) => list.find((p) => p.name === n));
    await db.prepare(`UPDATE usati_items SET photo_list=?, updated_at=${NOW} WHERE id=?`).run(JSON.stringify(sorted), row.id);
    await markDirty();
    return outItem(await load(params.slug), site(c));
  }));
  app.delete('/api/usati/:slug/photos/:name', h(async ({ c, params }) => {
    const row = await load(params.slug);
    const list = parse(row.photo_list, []);
    const p = list.find((x) => x.name === params.name);
    if (!p) throw new HttpError(404, 'La foto indicata non esiste più per questo articolo.', { code: 'FOTO_NON_TROVATA', hint: 'Ricarica la scheda dell’articolo.' });
    if (p.pub || p.legacy) for (const path of trashPaths(row.slug, p)) await db.prepare('INSERT OR IGNORE INTO usati_trash (path) VALUES (?)').run(path);
    if (!p.legacy) for (const s of ['', '-t']) await media(c).remove(`usati/${row.slug}/${p.name}${s}.jpg`).catch(() => {});
    await db.prepare(`UPDATE usati_items SET photo_list=?, updated_at=${NOW} WHERE id=?`).run(JSON.stringify(list.filter((x) => x !== p)), row.id);
    await markDirty();
    return outItem(await load(params.slug), site(c));
  }));

  // Anteprime delle foto caricate (dietro lo stesso accesso del gestionale)
  app.get('/media/usati/:slug/:file', async (c) => {
    const { slug, file } = c.req.param();
    if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9]+(-t)?\.jpg$/.test(file)) return c.text('Non trovato', 404);
    try {
      const o = await media(c).get(`usati/${slug}/${file}`);
      if (!o) return c.text('Non trovato', 404);
      return c.body(o.bytes, 200, { 'content-type': o.contentType, 'cache-control': 'private, max-age=3600' });
    } catch (e) { const r = toResponse(e, { method: 'GET', path: c.req.path }); return c.text([r.body.error, r.body.hint].filter(Boolean).join(' '), r.status); }
  });
}
