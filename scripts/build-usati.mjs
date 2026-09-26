// Genera la Vetrina Usati a partire da content/usati/usati.json
// Output (ignorato da git): usati.html e public/usati.json (usato dal box in home)
// Le foto stanno in public/images/usati/<slug>/N.jpg (con miniatura N-t.jpg).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://informatixrepair.com';
const data = JSON.parse(readFileSync(join(ROOT, 'content', 'usati', 'usati.json'), 'utf8'));
const items = data.items;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const euro = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const img = (it, n, thumb = false) => `/images/usati/${it.slug}/${n}${thumb ? '-t' : ''}.jpg`;
const title = (it) => [it.name, it.memory, it.color].filter(Boolean).join(' ');

/* Colori dell'illustrazione per gli articoli senza foto */
const TINT = { 'Pacific Blue': ['#5B8DC9', '#1E3A5F'] };

const placeholder = (it) => {
  const [a, b] = TINT[it.color] || ['#9CA3AF', '#374151'];
  return `<svg viewBox="0 0 400 500" class="absolute inset-0 w-full h-full" role="img" aria-label="Foto in arrivo per ${esc(title(it))}"><defs><linearGradient id="ph-${it.slug}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="500" fill="#0B0F19"/><rect x="118" y="70" width="164" height="340" rx="30" fill="url(#ph-${it.slug})"/><rect x="128" y="80" width="144" height="320" rx="22" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/><rect x="150" y="98" width="100" height="18" rx="9" fill="#0B0F19" fill-opacity=".55"/><rect x="138" y="128" width="60" height="60" rx="16" fill="#0B0F19" fill-opacity=".3"/><circle cx="154" cy="144" r="9" fill="#0B0F19" fill-opacity=".7"/><circle cx="182" cy="144" r="9" fill="#0B0F19" fill-opacity=".7"/><circle cx="168" cy="172" r="9" fill="#0B0F19" fill-opacity=".7"/><text x="200" y="450" text-anchor="middle" fill="#fff" fill-opacity=".8" font-family="Poppins,sans-serif" font-size="20" font-weight="600">Foto in arrivo</text></svg>`;
};

const battery = (it) => {
  if (!it.battery) return '';
  const col = it.battery >= 90 ? 'bg-emerald-500' : it.battery >= 80 ? 'bg-amber-500' : 'bg-secondary';
  return `<div class="mt-4">
            <div class="flex items-center justify-between text-xs text-gray-600 mb-1.5"><span class="inline-flex items-center gap-1.5 font-medium text-primary"><i data-icon="battery" data-class="w-4 h-4 text-gray-500"></i> Salute batteria</span><span><strong class="text-primary">${it.battery}%</strong>${it.cycles ? ` · ${it.cycles} cicli` : ''}</span></div>
            <div class="h-1.5 rounded-full bg-line overflow-hidden" role="img" aria-label="Capacità massima batteria ${it.battery}%"><div class="h-full rounded-full ${col}" style="width:${it.battery}%"></div></div>
          </div>`;
};

const card = (it) => {
  const has = it.photos > 0;
  const nums = Array.from({ length: it.photos }, (_, i) => i + 1);
  const isNew = it.condition === 'nuovo';
  const query = new URLSearchParams({ prodotto: title(it), ...(it.price != null ? { prezzo: euro(it.price) } : {}) }).toString();
  const gallery = has
    ? `<button type="button" class="usato-open group/img relative block w-full aspect-[4/5] overflow-hidden bg-ink" aria-label="Ingrandisci le foto di ${esc(title(it))}">
            <img src="${img(it, 1)}" alt="" aria-hidden="true" class="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60" loading="lazy" />
            <img src="${img(it, 1)}" alt="${esc(title(it))}, foto 1" class="usato-main relative w-full h-full object-contain transition-transform duration-500 group-hover/img:scale-[1.04]" loading="lazy" width="880" height="1100" />
            <span class="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-3 py-1.5 text-xs font-medium text-white"><i data-icon="expand" data-class="w-3.5 h-3.5"></i> ${it.photos > 1 ? `${it.photos} foto` : 'Ingrandisci'}</span>
          </button>
          ${
            it.photos > 1
              ? `<div class="flex gap-2 px-3 py-3 bg-ink overflow-x-auto" role="group" aria-label="Foto di ${esc(title(it))}">${nums
                  .map((n) => `<button type="button" class="usato-thumb shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${n === 1 ? 'border-secondary' : 'border-transparent opacity-70'} hover:opacity-100 transition" data-full="${img(it, n)}" data-n="${n}" aria-label="Mostra foto ${n}" aria-pressed="${n === 1}"><img src="${img(it, n, true)}" alt="" class="w-full h-full object-cover" loading="lazy" width="56" height="56" /></button>`)
                  .join('')}</div>`
              : ''
          }`
    : `<div class="relative w-full aspect-[4/5] overflow-hidden bg-ink">${placeholder(it)}</div>`;

  return `        <article id="${it.slug}" class="usato card !p-0 overflow-hidden flex flex-col reveal" data-kind="${it.condition}" data-cat="${it.category}"${it.price != null ? ` data-price="${it.price}"` : ''}>
          <div class="relative" data-photos='${JSON.stringify(nums.map((n) => img(it, n)))}' data-title="${esc(title(it))}">
            ${gallery}
            <span class="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold shadow-soft ${isNew ? 'bg-secondary text-white' : 'bg-white text-primary'}">${esc(it.conditionLabel)}</span>
          </div>
          <div class="p-6 flex flex-col grow">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">${[it.memory, it.color].filter(Boolean).map(esc).join(' &middot; ')}</p>
            <h2 class="text-xl font-semibold leading-snug">${esc(it.name)}</h2>
            <p class="text-sm font-medium text-secondary mt-1">${esc(it.tagline)}</p>
            <p class="text-sm text-gray-600 leading-relaxed mt-3">${esc(it.description)}</p>
            ${battery(it)}
            <details class="mt-4 group/d">
              <summary class="cursor-pointer select-none text-sm font-semibold text-primary hover:text-secondary list-none flex items-center gap-1.5"><span class="transition-transform group-open/d:rotate-90">${'&rsaquo;'}</span> Scheda tecnica</summary>
              <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">${it.specs.map(([k, v]) => `<dt class="text-gray-500">${esc(k)}</dt><dd class="font-medium text-primary text-right">${esc(v)}</dd>`).join('')}</dl>
            </details>
            <div class="mt-auto pt-6">
              <div class="flex items-end justify-between gap-3 mb-4">
                ${it.price != null ? `<div><span class="block text-xs text-gray-500">Prezzo in negozio</span><span class="font-heading text-3xl font-extrabold text-primary">${euro(it.price)}</span></div>` : `<div><span class="block text-xs text-gray-500">Prezzo</span><span class="font-heading text-2xl font-bold text-primary">Su richiesta</span></div>`}
              </div>
              <div class="grid grid-cols-[1fr_auto] gap-2">
                <a href="/contatti.html?${query}" class="btn-primary !py-3 text-sm">${it.price != null ? 'Chiedi info' : 'Chiedi il prezzo'} <i data-icon="arrow" data-class="w-4 h-4"></i></a>
                <a data-site="phone" href="#" class="btn-outline !py-3 !px-4 text-sm" aria-label="Chiama per ${esc(title(it))}"><i data-icon="phoneCall" data-class="w-4 h-4"></i></a>
              </div>
            </div>
          </div>
        </article>
`;
};

const count = (f) => items.filter(f).length;
const filters = [
  ['all', 'Tutti', items.length],
  ['nuovo', 'Nuovi sigillati', count((i) => i.condition === 'nuovo')],
  ['usato', 'Usati', count((i) => i.condition === 'usato')],
  ['smartphone', 'Smartphone', count((i) => i.category === 'smartphone')],
  ['computer', 'Computer e tablet', count((i) => i.category === 'computer')],
  ['audio-gaming', 'Audio e gaming', count((i) => i.category === 'audio-gaming')],
  ['500', 'Fino a 500 €', count((i) => i.price != null && i.price <= 500)],
];

const ld = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Vetrina Usati Informatix Repair',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Product',
      name: title(it),
      description: it.description,
      ...(it.photos ? { image: `${BASE}${img(it, 1)}` } : {}),
      itemCondition: it.condition === 'nuovo' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      ...(it.price != null ? { offers: { '@type': 'Offer', price: it.price, priceCurrency: 'EUR', availability: 'https://schema.org/LimitedAvailability', url: `${BASE}/usati.html#${it.slug}` } } : {}),
    },
  })),
});

const ogItem = items.find((i) => i.featured && i.photos) || items.find((i) => i.photos);
const ogImage = ogItem ? img(ogItem, 1) : '/images/Informatix-logo.png';

const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vetrina Usati | Smartphone, computer e accessori a Nocera Superiore | Informatix Repair</title>
  <meta name="description" content="Vetrina Usati di Informatix Repair a Nocera Superiore: smartphone, computer, tablet e accessori usati o nuovi sigillati, con foto e prezzi. Vieni a vederli e provarli in negozio." />
  <meta name="theme-color" content="#0B0F19" />
  <link rel="canonical" href="${BASE}/usati.html" />
  <link rel="icon" type="image/png" href="/images/Informatix-logo.png" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="it_IT" />
  <meta property="og:site_name" content="Informatix Repair" />
  <meta property="og:title" content="Vetrina Usati | Informatix Repair" />
  <meta property="og:description" content="Smartphone, computer, tablet e accessori con foto e prezzi. Vieni a vederli in negozio a Nocera Superiore." />
  <meta property="og:url" content="${BASE}/usati.html" />
  <meta property="og:image" content="${BASE}${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${ld}</script>
  <script type="module" src="/src/usati.js"></script>
</head>
<body>
  <div id="navbar"></div>

  <main id="main">
    <section class="hero-bg relative overflow-hidden text-white">
      <div class="grid-pattern absolute inset-0" aria-hidden="true"></div>
      <div class="container-x relative py-14 md:py-20 text-center">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-xs font-medium text-gray-200 mb-6"><span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> Pezzi unici &middot; aggiornata al ${fmtDate(data.updated)}</span>
        <h1 class="text-4xl md:text-6xl font-extrabold leading-[1.08] mb-5">Vetrina <span class="text-secondary">Usati</span></h1>
        <p class="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">Smartphone, computer, tablet e accessori selezionati. Guarda le foto, controlla le caratteristiche e vieni a provarli con mano in negozio.</p>
        <div class="mt-8 inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-5 rounded-2xl bg-white/10 border border-white/15 px-6 py-4 text-sm">
          <span class="inline-flex items-center gap-2"><i data-icon="pin" data-class="w-5 h-5 text-secondary"></i> Via Pecorari 178, Nocera Superiore</span>
          <span class="hidden sm:block w-px h-5 bg-white/20" aria-hidden="true"></span>
          <span id="shop-status" class="inline-flex items-center gap-2 text-gray-200" aria-live="polite"><i data-icon="clock" data-class="w-5 h-5 text-secondary"></i> <span data-status-text>Lun–Ven 9:00–13:30 e 16:00–19:30 · Sab 9:00–12:30</span></span>
        </div>
      </div>
    </section>

    <section class="section container-x !pt-12">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-10">
        <p class="text-gray-600"><strong class="text-primary font-semibold" id="usati-count">${items.length}</strong> dispositivi in negozio</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filtra la vetrina">
${filters.map(([k, l, n], i) => `          <button type="button" class="filter-btn" data-usati-filter="${k}" aria-pressed="${i === 0}">${l} <span class="opacity-60">${n}</span></button>`).join('\n')}
        </div>
      </div>

      <div id="usati-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
${items.map(card).join('')}      </div>
      <p id="usati-empty" class="hidden text-center text-gray-600 py-16">Nessun dispositivo per questo filtro. Prova con un altro o <a href="/contatti.html" class="text-secondary font-semibold underline">scrivici cosa cerchi</a>.</p>
    </section>

    <section class="bg-lightbg">
      <div class="section container-x">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <span class="eyebrow">Come funziona</span>
          <h2 class="section-title">Dal telefono al tuo palmo, in tre passi</h2>
          <p class="text-gray-600">Non è un negozio online: ogni dispositivo si sceglie guardandolo negli occhi.</p>
        </div>
        <ol class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <li class="card reveal text-center"><div class="mx-auto w-14 h-14 rounded-full bg-secondary text-white font-heading text-xl font-bold flex items-center justify-center shadow-glow mb-4">1</div><h3 class="font-semibold mb-1.5">Scegli</h3><p class="text-sm text-gray-600">Sfoglia la vetrina e guarda foto, stato della batteria e prezzo di ogni dispositivo.</p></li>
          <li class="card reveal text-center"><div class="mx-auto w-14 h-14 rounded-full bg-secondary text-white font-heading text-xl font-bold flex items-center justify-center shadow-glow mb-4">2</div><h3 class="font-semibold mb-1.5">Chiedi info</h3><p class="text-sm text-gray-600">Scrivici o chiamaci per confermare che sia ancora disponibile: sono pezzi unici.</p></li>
          <li class="card reveal text-center"><div class="mx-auto w-14 h-14 rounded-full bg-secondary text-white font-heading text-xl font-bold flex items-center justify-center shadow-glow mb-4">3</div><h3 class="font-semibold mb-1.5">Vieni a provarlo</h3><p class="text-sm text-gray-600">Passa in negozio a Nocera Superiore: lo vedi dal vivo, lo provi e ti togli ogni dubbio.</p></li>
        </ol>
      </div>
    </section>

    <section class="container-x py-14 md:py-20">
      <div class="hero-bg relative overflow-hidden rounded-3xl text-white px-6 py-12 md:py-16 text-center">
        <div class="grid-pattern absolute inset-0" aria-hidden="true"></div>
        <div class="relative">
          <h2 class="text-2xl md:text-4xl font-bold mb-3">Non vedi quello che cerchi?</h2>
          <p class="text-gray-300 mb-8 max-w-xl mx-auto">La vetrina cambia spesso. Dicci che modello ti serve: se arriva in negozio, ti avvisiamo per primo.</p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/contatti.html?prodotto=${encodeURIComponent('Ricerca modello')}" class="btn-primary">Scrivici cosa cerchi <i data-icon="arrow" data-class="w-5 h-5"></i></a>
            <a data-site="phone" href="#" class="btn-ghost"><i data-icon="phoneCall" data-class="w-5 h-5"></i> Chiama il negozio</a>
          </div>
        </div>
      </div>
      <p class="text-xs text-gray-500 text-center max-w-2xl mx-auto mt-8">Le informazioni sulle condizioni dei dispositivi derivano dalle foto e dalle schermate del dispositivo e possono non riportare ogni dettaglio: lo stato reale si verifica di persona in negozio. Prezzi e disponibilità sono soggetti a variazione e i pezzi sono unici. Confermali prima di passare. Non è possibile acquistare online.</p>
    </section>
  </main>

  <div id="lightbox" class="fixed inset-0 z-[90] hidden bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Foto ingrandita">
    <button type="button" class="lb-close absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Chiudi"><i data-icon="close" data-class="w-6 h-6"></i></button>
    <button type="button" class="lb-prev absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Foto precedente"><i data-icon="chevL" data-class="w-6 h-6"></i></button>
    <button type="button" class="lb-next absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Foto successiva"><i data-icon="chevR" data-class="w-6 h-6"></i></button>
    <figure class="h-full flex flex-col items-center justify-center px-16 py-14">
      <img class="lb-img max-h-full max-w-full object-contain rounded-lg" alt="" />
      <figcaption class="lb-cap mt-4 text-sm text-gray-300"></figcaption>
    </figure>
  </div>

  <div id="footer"></div>
</body>
</html>
`;
writeFileSync(join(ROOT, 'usati.html'), html);

/* Riassunto per il box in home */
const teaser = items
  .filter((i) => i.featured && i.photos && i.price != null)
  .map((i) => ({ slug: i.slug, name: i.name, memory: i.memory, color: i.color, label: i.conditionLabel, price: euro(i.price), image: img(i, 1) }));
writeFileSync(join(ROOT, 'public', 'usati.json'), JSON.stringify({ count: items.length, items: teaser }));

console.log(`Vetrina Usati: ${items.length} dispositivi.`);
