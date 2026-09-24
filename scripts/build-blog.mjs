// Genera le pagine statiche del blog a partire da content/blog/*.md
// Output (ignorato da git): blog.html, blog/pagina-N.html, blog/<slug>.html, public/sitemap.xml
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'content', 'blog');
const OUT = join(ROOT, 'blog');
const BASE = 'https://informatixrepair.com';
const PER_PAGE = 12;
const CATEGORY = 'Tecnologia';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- lettura articoli ---------- */
function parse(file) {
  const raw = readFileSync(join(SRC, file), 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Front matter mancante in ${file}`);
  const meta = {};
  m[1].split('\n').forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
  for (const k of ['title', 'date', 'description']) if (!meta[k]) throw new Error(`Campo "${k}" mancante in ${file}`);
  const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-(\d+-)?/, '');
  const body = m[2].trim();
  const words = body.split(/\s+/).length;
  return { ...meta, file, slug, body, minutes: Math.max(1, Math.round(words / 200)) };
}

const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

function render(body) {
  return body
    .split(/\n{2,}/)
    .map((b) => {
      b = b.trim();
      if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
      if (/^- /.test(b)) return `<ul>${b.split('\n').map((l) => `<li>${inline(l.replace(/^- /, ''))}</li>`).join('')}</ul>`;
      return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
    })
    .join('\n');
}

const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- copertina SVG originale (nessun copyright) ---------- */
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function cover(slug) {
  let h = hash(slug);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const v = hash(slug) % 4;
  let g = '';
  if (v === 0) {
    for (let i = 0; i < 6; i++) g += `<circle cx="${560 + rnd() * 120}" cy="${180 + rnd() * 80}" r="${40 + i * 38}" fill="none" stroke="${i % 3 ? '#ffffff' : '#DC2626'}" stroke-opacity="${i % 3 ? 0.10 : 0.6}" stroke-width="${i % 3 ? 1.5 : 2.5}"/>`;
  } else if (v === 1) {
    for (let i = 0; i < 9; i++) g += `<rect x="${60 + i * 78}" y="${300 - (40 + rnd() * 200)}" width="34" height="${40 + rnd() * 200}" rx="4" fill="${i % 4 === 1 ? '#DC2626' : '#ffffff'}" fill-opacity="${i % 4 === 1 ? 0.85 : 0.08}"/>`;
  } else if (v === 2) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) g += `<circle cx="${70 + c * 58}" cy="${55 + r * 50}" r="${rnd() > 0.85 ? 6 : 3}" fill="${rnd() > 0.9 ? '#DC2626' : '#ffffff'}" fill-opacity="${rnd() > 0.9 ? 0.9 : 0.18}"/>`;
  } else {
    let x = 40, y = 240;
    let d = `M${x} ${y}`;
    for (let i = 0; i < 9; i++) {
      x += 70 + rnd() * 40;
      d += ` H${x}`;
      y += (rnd() - 0.5) * 140;
      y = Math.max(60, Math.min(290, y));
      d += ` V${y}`;
    }
    g += `<path d="${d}" fill="none" stroke="#DC2626" stroke-width="3" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="10" stroke-linejoin="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 340" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B0F19"/><stop offset="1" stop-color="#1F2937"/></linearGradient></defs><rect width="800" height="340" fill="url(#g)"/>${g}</svg>`;
}

/* ---------- template ---------- */
const head = ({ title, desc, path, extra = '' }) => `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="theme-color" content="#0B0F19" />
  <link rel="canonical" href="${BASE}${path}" />
  <link rel="icon" type="image/png" href="/images/Informatix-logo.png" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="it_IT" />
  <meta property="og:site_name" content="Informatix Repair" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${BASE}${path}" />
  <meta property="og:image" content="${BASE}/images/Informatix-logo.png" />
  <meta name="twitter:card" content="summary" />
${extra}  <script type="module" src="/src/main.js"></script>
</head>
<body>
  <div id="navbar"></div>

  <main id="main">
`;
const tail = `  </main>

  <div id="footer"></div>
</body>
</html>
`;

const pageHeader = (eyebrow, h1, lead) => `    <section class="hero-bg relative overflow-hidden text-white">
      <div class="grid-pattern absolute inset-0" aria-hidden="true"></div>
      <div class="container-x relative py-14 md:py-20 text-center">
        <span class="eyebrow !text-red-400">${eyebrow}</span>
        <h1 class="text-3xl md:text-5xl font-extrabold mb-4">${h1}</h1>
        ${lead ? `<p class="text-gray-300 text-lg max-w-2xl mx-auto">${lead}</p>` : ''}
      </div>
    </section>
`;

const card = (a) => `        <a href="/blog/${a.slug}.html" class="card card-hover !p-0 overflow-hidden group flex flex-col reveal">
          <div class="aspect-[800/340] overflow-hidden">${cover(a.slug)}</div>
          <div class="p-6 flex flex-col grow">
            <div class="flex items-center gap-3 text-xs text-gray-500 mb-3"><span class="font-semibold uppercase tracking-wider text-secondary">${CATEGORY}</span><span>${fmtDate(a.date)}</span></div>
            <h2 class="text-lg font-semibold mb-2 group-hover:text-secondary transition-colors">${esc(a.title)}</h2>
            <p class="text-sm text-gray-600 leading-relaxed mb-4">${esc(a.description)}</p>
            <span class="mt-auto text-sm font-semibold text-secondary">Leggi l'articolo &rarr;</span>
          </div>
        </a>
`;

/* ---------- build ---------- */
const articles = readdirSync(SRC)
  .filter((f) => f.endsWith('.md'))
  .map(parse)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.file.localeCompare(a.file)));

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

const pages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
const listPath = (n) => (n === 1 ? '/blog.html' : `/blog/pagina-${n}.html`);

for (let n = 1; n <= pages; n++) {
  const slice = articles.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const nav =
    pages > 1
      ? `      <nav class="flex justify-center flex-wrap gap-2 mt-12" aria-label="Pagine del blog">${Array.from({ length: pages }, (_, i) => i + 1)
          .map((i) => `<a href="${listPath(i)}" ${i === n ? 'aria-current="page"' : ''} class="w-10 h-10 inline-flex items-center justify-center rounded-full text-sm font-medium ${i === n ? 'bg-secondary text-white' : 'bg-lightbg text-primary hover:bg-secondary-light'}">${i}</a>`)
          .join('')}</nav>\n`
      : '';
  const html =
    head({ title: `Blog${n > 1 ? ` - Pagina ${n}` : ''} | Informatix Repair`, desc: 'Notizie, novità e approfondimenti dal mondo della tecnologia, a cura di Informatix Repair.', path: listPath(n) }) +
    pageHeader('Blog', 'Tecnologia, in parole semplici', 'Novità, guide e approfondimenti dal mondo della tecnologia.') +
    `    <section class="section container-x">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
${slice.map(card).join('')}      </div>
${nav}    </section>
` +
    tail;
  writeFileSync(n === 1 ? join(ROOT, 'blog.html') : join(OUT, `pagina-${n}.html`), html);
}

articles.forEach((a, i) => {
  const related = articles.filter((x) => x.slug !== a.slug).slice(i % Math.max(1, articles.length - 3), (i % Math.max(1, articles.length - 3)) + 3);
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    inLanguage: 'it',
    articleSection: CATEGORY,
    author: { '@type': 'Organization', name: 'Informatix Repair' },
    publisher: { '@type': 'Organization', name: 'Informatix Repair', logo: { '@type': 'ImageObject', url: `${BASE}/images/Informatix-logo.png` } },
    mainEntityOfPage: `${BASE}/blog/${a.slug}.html`,
  });
  const html =
    head({ title: `${a.title} | Informatix Repair`, desc: a.description, path: `/blog/${a.slug}.html`, extra: `  <script type="application/ld+json">${ld}</script>\n` }) +
    `    <section class="hero-bg relative overflow-hidden text-white">
      <div class="grid-pattern absolute inset-0" aria-hidden="true"></div>
      <div class="container-x relative py-12 md:py-16 max-w-3xl">
        <a href="/blog.html" class="text-sm text-gray-300 hover:text-white">&larr; Tutti gli articoli</a>
        <div class="flex items-center gap-3 text-xs mt-6 mb-4"><span class="font-semibold uppercase tracking-wider text-red-400">${CATEGORY}</span><span class="text-gray-400">${fmtDate(a.date)} &middot; ${a.minutes} min di lettura</span></div>
        <h1 class="text-3xl md:text-5xl font-extrabold leading-tight">${esc(a.title)}</h1>
      </div>
    </section>

    <section class="container-x max-w-3xl py-12 md:py-16">
      <div class="rounded-2xl overflow-hidden mb-10 aspect-[800/340]">${cover(a.slug)}</div>
      <article class="text-gray-700 text-[1.05rem] leading-8 [&_p]:mb-5 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-10 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ul]:space-y-2 [&_a]:text-secondary [&_a]:underline">
${render(a.body)}
      </article>
    </section>

    <section class="bg-lightbg">
      <div class="container-x py-14">
        <h2 class="text-2xl font-bold mb-8">Altri articoli</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
${related.map(card).join('')}        </div>
      </div>
    </section>

    <section class="container-x py-14 md:py-20">
      <div class="rounded-3xl bg-ink text-white px-6 py-12 text-center">
        <h2 class="text-2xl md:text-3xl font-bold mb-3">Hai un dispositivo che non funziona?</h2>
        <p class="text-gray-300 mb-7 max-w-xl mx-auto">Diagnosi gratuita e preventivo prima di ogni intervento.</p>
        <a href="/contatti.html" class="btn-primary">Richiedi Preventivo</a>
      </div>
    </section>
` +
    tail;
  writeFileSync(join(OUT, `${a.slug}.html`), html);
});

/* ---------- sitemap ---------- */
const fixed = ['', 'chi-siamo.html', 'servizi.html', 'portfolio.html', 'blog.html', 'contatti.html', 'privacy.html'];
const urls = [
  ...fixed.map((p) => `  <url><loc>${BASE}/${p}</loc></url>`),
  ...Array.from({ length: pages - 1 }, (_, i) => `  <url><loc>${BASE}/blog/pagina-${i + 2}.html</loc></url>`),
  ...articles.map((a) => `  <url><loc>${BASE}/blog/${a.slug}.html</loc><lastmod>${a.date}</lastmod></url>`),
];
writeFileSync(join(ROOT, 'public', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

console.log(`Blog: ${articles.length} articoli, ${pages} pagine di elenco.`);
