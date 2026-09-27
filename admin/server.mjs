// Gestionale locale per la Vetrina Usati. Protetto da login semplice (username/password fisse in admin/auth.local.json, escluso da git).
// Avvio: npm run admin  ->  http://localhost:4848
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ADMIN_DIR = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ADMIN_DIR, 'public');
const AUTH_PATH = join(ADMIN_DIR, 'auth.local.json');
const ROOT = join(ADMIN_DIR, '..');
const DATA_PATH = join(ROOT, 'content', 'usati', 'usati.json');
const IMAGES_DIR = join(ROOT, 'public', 'images', 'usati');
const PORT = 4848;
const GRACE_DAYS = 7;

// ---------- Credenziali locali (mai su git: vedi *.local in .gitignore) ----------
function loadOrCreateAuth() {
  if (existsSync(AUTH_PATH)) return JSON.parse(readFileSync(AUTH_PATH, 'utf8'));
  const creds = { username: 'christian', password: crypto.randomBytes(4).toString('hex') };
  writeFileSync(AUTH_PATH, JSON.stringify(creds, null, 2) + '\n');
  console.log('\n== Credenziali gestionale generate (admin/auth.local.json) ==');
  console.log(`   Utente:   ${creds.username}`);
  console.log(`   Password: ${creds.password}`);
  console.log('   Puoi cambiarle modificando quel file in qualsiasi momento.\n');
  return creds;
}
const AUTH = loadOrCreateAuth();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: 'informatix-repair-gestionale-locale',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
  })
);

function requireAuthPage(req, res, next) {
  if (req.session?.user) return next();
  res.redirect('/login.html');
}
function requireAuthApi(req, res, next) {
  if (req.session?.user) return next();
  res.status(401).json({ ok: false, error: 'Sessione scaduta, accedi di nuovo.' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === AUTH.username && password === AUTH.password) {
    req.session.user = username;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'Utente o password non corretti.' });
});
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/session', (req, res) => res.json({ loggedIn: !!req.session?.user, username: req.session?.user || null }));

app.use(express.static(PUBLIC_DIR, { index: false }));
app.use('/images/usati', requireAuthPage, express.static(IMAGES_DIR));
app.get('/', requireAuthPage, (req, res) => res.sendFile(join(PUBLIC_DIR, 'index.html')));
app.use('/api', requireAuthApi);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const readData = () => JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const writeData = (data) => {
  data.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
};

const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function uniqueSlug(data, base) {
  let slug = base || 'articolo';
  let n = 2;
  while (data.items.some((i) => i.slug === slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function daysSince(dateStr) {
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - then) / 86400000);
}

function withStatus(it) {
  if (!it.sold) return { ...it, status: 'active' };
  const days = daysSince(it.soldAt);
  return { ...it, status: days >= GRACE_DAYS ? 'expired' : 'sold', daysSinceSold: days, daysLeft: Math.max(0, GRACE_DAYS - days) };
}

function runBuild() {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-usati.mjs')], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('Build usati.html fallita:', e.message);
    return false;
  }
}

async function saveSequentialPhotos(slug, files) {
  const dir = join(IMAGES_DIR, slug);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < files.length; i++) {
    const n = i + 1;
    await sharp(files[i].buffer).rotate().resize({ width: 1400, height: 1750, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(join(dir, `${n}.jpg`));
    await sharp(files[i].buffer).rotate().resize({ width: 160, height: 160, fit: 'cover' }).jpeg({ quality: 78 }).toFile(join(dir, `${n}-t.jpg`));
  }
  return files.length;
}

function loadExistingPhotoBuffers(slug, keepNums) {
  const dir = join(IMAGES_DIR, slug);
  return keepNums.map((n) => ({ buffer: readFileSync(join(dir, `${n}.jpg`)) }));
}

const parseSpecs = (raw) => {
  if (!raw) return [];
  const arr = JSON.parse(raw);
  return arr.filter(([k, v]) => k && v);
};

// ---------- API ----------

app.get('/api/items', (req, res) => {
  const data = readData();
  res.json({ updated: data.updated, items: data.items.map(withStatus) });
});

app.post('/api/items', upload.array('photos', 10), async (req, res) => {
  try {
    const body = JSON.parse(req.body.data);
    const data = readData();
    const base = slugify([body.name, body.memory, body.color].filter(Boolean).join(' '));
    const slug = uniqueSlug(data, base);
    const photoCount = req.files?.length ? await saveSequentialPhotos(slug, req.files) : 0;

    const item = {
      slug,
      name: body.name,
      memory: body.memory || undefined,
      color: body.color || undefined,
      colorEn: body.colorEn || undefined,
      condition: body.condition,
      conditionLabel: body.conditionLabel,
      conditionLabelEn: body.conditionLabelEn || undefined,
      price: body.price === '' || body.price == null ? null : Number(body.price),
      featured: !!body.featured,
      photos: photoCount,
      battery: body.battery ? Number(body.battery) : undefined,
      cycles: body.cycles ? Number(body.cycles) : undefined,
      tagline: body.tagline || '',
      taglineEn: body.taglineEn || undefined,
      description: body.description || '',
      descriptionEn: body.descriptionEn || undefined,
      specs: parseSpecs(body.specs),
      specsEn: body.specsEn ? parseSpecs(body.specsEn) : undefined,
      category: body.category,
      contact: !!body.contact,
      sold: false,
      soldAt: null,
    };
    Object.keys(item).forEach((k) => item[k] === undefined && delete item[k]);

    data.items.unshift(item);
    writeData(data);
    runBuild();
    res.json({ ok: true, slug, built: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.put('/api/items/:slug', upload.array('photos', 10), async (req, res) => {
  try {
    const { slug } = req.params;
    const data = readData();
    const idx = data.items.findIndex((i) => i.slug === slug);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Articolo non trovato' });
    const body = JSON.parse(req.body.data);
    const keepNums = JSON.parse(req.body.keepPhotos || '[]');

    const existing = loadExistingPhotoBuffers(slug, keepNums);
    const merged = [...existing, ...(req.files || []).map((f) => ({ buffer: f.buffer }))];
    rmSync(join(IMAGES_DIR, slug), { recursive: true, force: true });
    const photoCount = merged.length ? await saveSequentialPhotos(slug, merged) : 0;

    const prev = data.items[idx];
    const item = {
      ...prev,
      name: body.name,
      memory: body.memory || undefined,
      color: body.color || undefined,
      colorEn: body.colorEn || undefined,
      condition: body.condition,
      conditionLabel: body.conditionLabel,
      conditionLabelEn: body.conditionLabelEn || undefined,
      price: body.price === '' || body.price == null ? null : Number(body.price),
      featured: !!body.featured,
      photos: photoCount,
      battery: body.battery ? Number(body.battery) : undefined,
      cycles: body.cycles ? Number(body.cycles) : undefined,
      tagline: body.tagline || '',
      taglineEn: body.taglineEn || undefined,
      description: body.description || '',
      descriptionEn: body.descriptionEn || undefined,
      specs: parseSpecs(body.specs),
      specsEn: body.specsEn ? parseSpecs(body.specsEn) : undefined,
      category: body.category,
      contact: !!body.contact,
    };
    Object.keys(item).forEach((k) => item[k] === undefined && delete item[k]);
    data.items[idx] = item;
    writeData(data);
    runBuild();
    res.json({ ok: true, built: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/items/:slug/sold', (req, res) => {
  const data = readData();
  const it = data.items.find((i) => i.slug === req.params.slug);
  if (!it) return res.status(404).json({ ok: false });
  it.sold = true;
  it.soldAt = new Date().toISOString().slice(0, 10);
  writeData(data);
  runBuild();
  res.json({ ok: true });
});

app.post('/api/items/:slug/unsold', (req, res) => {
  const data = readData();
  const it = data.items.find((i) => i.slug === req.params.slug);
  if (!it) return res.status(404).json({ ok: false });
  it.sold = false;
  it.soldAt = null;
  writeData(data);
  runBuild();
  res.json({ ok: true });
});

app.delete('/api/items/:slug', (req, res) => {
  const data = readData();
  const idx = data.items.findIndex((i) => i.slug === req.params.slug);
  if (idx === -1) return res.status(404).json({ ok: false });
  data.items.splice(idx, 1);
  writeData(data);
  rmSync(join(IMAGES_DIR, req.params.slug), { recursive: true, force: true });
  runBuild();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\nGestionale Usati Informatix Repair`);
  console.log(`--> http://localhost:${PORT}\n`);
});
