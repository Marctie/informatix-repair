import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import './styles/main.css';

/* ------------------------------------------------------------------
 * Configurazione del sito. I campi vuoti nascondono i relativi elementi.
 * ------------------------------------------------------------------ */
const SITE = {
  name: 'Informatix Repair',
  url: 'https://informatixrepair.com',
  legalName: '', // ragione sociale, es. 'Informatix Repair di Mario Rossi'
  vat: '', // P.IVA, es. '01234567890'
  email: 'info@informatixrepair.it',
  phone: '+39 376 234 4151',
  whatsapp: '', // solo cifre con prefisso, es. '393331234567'
  address: 'Via Pecorari 178, 84015 Nocera Superiore (SA)',
  hours: 'Lun–Ven 9:00–13:30 e 16:00–19:30 · Sab 9:00–12:30 · Dom chiuso',
  facebook: 'https://www.facebook.com/informatixrepair',
  instagram: '',
  apkUrl: '', // link download APK: quando valorizzato compare la sezione "Scarica l'app"
};

const NAV_LINKS = [
  { href: '/', label: 'Home', match: ['', 'index.html'] },
  { href: '/chi-siamo.html', label: 'Chi Siamo', match: ['chi-siamo.html'] },
  { href: '/servizi.html', label: 'Servizi', match: ['servizi.html'] },
  { href: '/portfolio.html', label: 'Portfolio', match: ['portfolio.html'] },
  { href: '/blog.html', label: 'Blog', match: ['blog.html'] },
  { href: '/contatti.html', label: 'Contatti', match: ['contatti.html'] },
];

/* Icone (stile outline 24x24) */
const P = {
  cpu: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z M10 10h4v4h-4z',
  laptop: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v9H4V6z M2 19h20',
  phone: 'M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z M11 18h2',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z M9 12l2 2 4-4',
  wrench: 'M14.7 6.3a4 4 0 005 5L21 13l-8 8a2.1 2.1 0 01-3-3l8-8 M14.7 6.3L12 3 8 7l3.3 2.7',
  disk: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7 M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  chat: 'M4 5h16v11H9l-5 4V5z',
  check: 'M5 13l4 4L19 7',
  clock: 'M12 7v5l3 2 M3 12a9 9 0 1018 0 9 9 0 00-18 0z',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 12a2 2 0 100-4 2 2 0 000 4z',
  mail: 'M3 6h18v12H3V6z M3 7l9 7 9-7',
  arrow: 'M5 12h14m-6-6l6 6-6 6',
  gamepad: 'M6 8h12a4 4 0 014 4l-1 4a3 3 0 01-5 1l-1-2H9l-1 2a3 3 0 01-5-1l-1-4a4 4 0 014-4z M8 11v3 M6.5 12.5h3 M15.5 11.5h.01 M17.5 13.5h.01',
  bug: 'M9 9a3 3 0 016 0v7a3 3 0 01-6 0V9z M4 8l3 2 M20 8l-3 2 M4 16l3-2 M20 16l-3-2 M12 4v2',
  download: 'M12 4v11m-5-4l5 5 5-5 M5 20h14',
  monitor: 'M3 5h18v11H3V5z M8 20h8 M12 16v4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  tag: 'M3 12V4h8l10 10-8 8L3 12z M7.5 8.5h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  whatsapp: 'M20 12a8 8 0 01-11.8 7L4 20l1.2-4A8 8 0 1120 12z M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-.8-.4-1.6-1.2-2-2l.8-1-1-2L9 9z',
  facebook: 'M14 8h3V4h-3a4 4 0 00-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8z',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4z M12 8a4 4 0 100 8 4 4 0 000-8z M17.5 6.5h.01',
  phoneCall: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
};

const icon = (name, cls = 'w-6 h-6') =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] || ''}"/></svg>`;

/** Sostituisce <i data-icon="nome" data-class="w-5 h-5"></i> con l'SVG corrispondente. */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, el.dataset.class || 'w-6 h-6');
  });
}

const telHref = (n) => 'tel:+' + n.replace(/\D/g, '').replace(/^\+?/, '');

/* ------------------------------------------------------------------ */
function renderNavbar() {
  const mount = document.getElementById('navbar');
  if (!mount) return;
  const page = window.location.pathname.split('/').pop();

  const links = (cls) =>
    NAV_LINKS.map(
      (l) =>
        `<a href="${l.href}" class="${cls}" ${l.match.includes(page) || (l.href === '/blog.html' && window.location.pathname.startsWith('/blog')) ? 'aria-current="page"' : ''}>${l.label}</a>`
    ).join('');

  mount.innerHTML = `
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lift">Vai al contenuto</a>
    <header id="site-header" class="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-transparent transition-shadow duration-300">
      <div class="container-x">
        <div class="flex items-center justify-between h-[72px]">
          <a href="/" class="flex items-center gap-2" aria-label="${SITE.name} - Home">
            <img src="/images/Informatix-logo.png" alt="${SITE.name}" width="56" height="56" class="h-12 w-auto" />
          </a>
          <nav class="hidden md:flex items-center gap-8" aria-label="Principale">
            ${links('nav-link')}
            <a href="/contatti.html" class="btn-primary !py-2.5 !px-5 text-sm">Richiedi Preventivo</a>
          </nav>
          <button id="nav-toggle" type="button" aria-label="Apri menu" aria-expanded="false" aria-controls="nav-mobile" class="md:hidden p-2 -mr-2 text-primary">
            <span data-open>${icon('menu', 'w-7 h-7')}</span>
            <span data-close class="hidden">${icon('close', 'w-7 h-7')}</span>
          </button>
        </div>
      </div>
      <div id="nav-mobile" class="md:hidden overflow-hidden max-h-0 transition-[max-height] duration-300 bg-white border-t border-line">
        <nav class="container-x py-4 flex flex-col" aria-label="Mobile">
          ${links('py-3 text-base font-medium text-primary border-b border-line aria-[current=page]:text-secondary')}
          <a href="/contatti.html" class="btn-primary mt-4">Richiedi Preventivo</a>
        </nav>
      </div>
    </header>
  `;

  const header = document.getElementById('site-header');
  const toggle = document.getElementById('nav-toggle');
  const panel = document.getElementById('nav-mobile');

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
    toggle.querySelector('[data-open]').classList.toggle('hidden', open);
    toggle.querySelector('[data-close]').classList.toggle('hidden', !open);
    panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  window.addEventListener('resize', () => window.innerWidth >= 768 && setOpen(false));

  const onScroll = () => {
    const y = window.scrollY > 8;
    header.classList.toggle('shadow-soft', y);
    header.classList.toggle('border-line', y);
    header.classList.toggle('border-transparent', !y);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function renderApkBanner() {
  const mount = document.getElementById('app-banner');
  if (!mount || !SITE.apkUrl) return;
  mount.innerHTML = `
    <section class="container-x pb-16 md:pb-24">
      <div class="rounded-3xl bg-ink text-white p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 class="text-2xl md:text-3xl font-bold mb-2">Scarica l'app Informatix Repair</h2>
          <p class="text-gray-300">Tutto il sito a portata di mano, direttamente sul tuo smartphone Android.</p>
        </div>
        <a href="${SITE.apkUrl}" class="btn-primary shrink-0" download>${icon('download', 'w-5 h-5')} Scarica APK</a>
      </div>
    </section>`;
}

function renderFooter() {
  const mount = document.getElementById('footer');
  if (!mount) return;

  const social = [
    SITE.facebook && ['facebook', SITE.facebook, 'Facebook'],
    SITE.instagram && ['instagram', SITE.instagram, 'Instagram'],
    SITE.whatsapp && ['whatsapp', `https://wa.me/${SITE.whatsapp}`, 'WhatsApp'],
  ]
    .filter(Boolean)
    .map(
      ([i, href, label]) =>
        `<a href="${href}" target="_blank" rel="noopener" aria-label="${label}" class="w-10 h-10 rounded-full bg-white/10 hover:bg-secondary flex items-center justify-center transition-colors">${icon(i, 'w-5 h-5')}</a>`
    )
    .join('');

  mount.innerHTML = `
    <footer class="bg-ink text-white">
      <div class="container-x py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div class="lg:col-span-2">
          <div class="inline-block bg-white rounded-xl p-2 mb-4"><img src="/images/Informatix-logo.png" alt="${SITE.name}" class="h-14 w-auto" loading="lazy" /></div>
          <p class="text-gray-400 text-sm max-w-sm">Riparazioni informatiche professionali a Nocera Superiore (SA). Per privati, aziende e appassionati di tecnologia.</p>
          ${social ? `<div class="flex gap-3 mt-5">${social}</div>` : ''}
        </div>
        <div>
          <h4 class="font-heading font-semibold mb-4">Navigazione</h4>
          <ul class="space-y-2.5 text-sm text-gray-400">
            ${NAV_LINKS.map((l) => `<li><a href="${l.href}" class="hover:text-white transition-colors">${l.label}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 class="font-heading font-semibold mb-4">Contatti</h4>
          <ul class="space-y-3 text-sm text-gray-400">
            <li class="flex gap-2">${icon('pin', 'w-5 h-5 shrink-0 text-secondary')}<span>${SITE.address}</span></li>
            ${SITE.phone ? `<li class="flex gap-2">${icon('phoneCall', 'w-5 h-5 shrink-0 text-secondary')}<a href="${telHref(SITE.phone)}" class="hover:text-white">${SITE.phone}</a></li>` : ''}
            <li class="flex gap-2">${icon('mail', 'w-5 h-5 shrink-0 text-secondary')}<a href="mailto:${SITE.email}" class="hover:text-white break-all">${SITE.email}</a></li>
            <li class="flex gap-2">${icon('clock', 'w-5 h-5 shrink-0 text-secondary')}<span>${SITE.hours}</span></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div class="container-x py-5 text-center sm:text-left text-xs text-gray-500">
          &copy; ${new Date().getFullYear()} ${SITE.legalName || SITE.name}. Tutti i diritti riservati.${SITE.vat ? ` P.IVA ${SITE.vat}.` : ''}
          <span class="mx-1">·</span><a href="/privacy.html" class="hover:text-white underline-offset-2 hover:underline">Privacy Policy</a>
        </div>
      </div>
    </footer>
  `;
}

/** Riempie gli elementi [data-site="campo"] e nasconde quelli con dato mancante. */
function fillSiteData() {
  document.querySelectorAll('[data-site]').forEach((el) => {
    const key = el.dataset.site;
    const val = SITE[key];
    if (!val) {
      el.remove();
      return;
    }
    if (key === 'phone' && el.tagName === 'A') el.href = telHref(val);
    else if (key === 'whatsapp' && el.tagName === 'A') el.href = `https://wa.me/${val}`;
    else if (key === 'email' && el.tagName === 'A') el.href = `mailto:${val}`;
    if (el.hasAttribute('data-text')) el.textContent = val;
  });
}

function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach((i) => i.classList.add('is-visible'));
    return;
  }
  // Ritardo a cascata per gli elementi fratelli
  items.forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 6) * 80}ms`);
  });
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  items.forEach((i) => io.observe(i));
}

function initPortfolioFilter() {
  const buttons = document.querySelectorAll('[data-filter]');
  if (!buttons.length) return;
  const items = document.querySelectorAll('[data-category]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      items.forEach((item) => {
        item.hidden = !(filter === 'all' || item.dataset.category === filter);
      });
    });
  });
}

/** Carica la mappa Google solo al click, così non parte alcun tracciamento di terze parti prima della scelta. */
function initMapConsent() {
  document.querySelectorAll('[data-map-src]').forEach((box) => {
    box.querySelector('button').addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.title = box.dataset.mapTitle || 'Mappa';
      f.src = box.dataset.mapSrc;
      f.className = 'w-full h-full border-0';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      box.replaceChildren(f);
    });
  });
}

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const subject = `Richiesta dal sito – ${d.get('servizio') || 'Informazioni'}`;
    const body = `Nome: ${d.get('nome')}\nEmail: ${d.get('email')}\nTelefono: ${d.get('telefono') || '-'}\nServizio: ${d.get('servizio') || '-'}\n\n${d.get('messaggio')}`;
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

document.documentElement.classList.add('js');
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
  renderApkBanner();
  fillSiteData();
  hydrateIcons();
  initReveal();
  initPortfolioFilter();
  initMapConsent();
  initContactForm();
});
