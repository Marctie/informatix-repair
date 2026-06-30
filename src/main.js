import './styles/main.css';

const NAV_LINKS = [
  { href: 'index.html', label: 'Home' },
  { href: 'chi-siamo.html', label: 'Chi Siamo' },
  { href: 'servizi.html', label: 'Servizi' },
  { href: 'portfolio.html', label: 'Portfolio' },
  { href: 'contatti.html', label: 'Contatti' },
];

function currentPage() {
  const path = window.location.pathname.split('/').pop();
  return path === '' ? 'index.html' : path;
}

function renderNavbar() {
  const mount = document.getElementById('navbar');
  if (!mount) return;
  const current = currentPage();

  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="nav-link ${current === l.href ? 'text-secondary' : ''}">${l.label}</a>`
  ).join('');

  mount.innerHTML = `
    <nav class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-20">
          <a href="index.html" class="flex items-center gap-2">
            <img src="/images/logo.svg" alt="Informatix Repair" class="h-10 md:h-12" />
          </a>
          <div class="hidden md:flex items-center gap-8">${links}
            <a href="contatti.html" class="btn-primary !py-2 !px-5">Richiedi Preventivo</a>
          </div>
          <button id="nav-toggle" aria-label="Apri menu" class="md:hidden p-2 text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div id="nav-mobile" class="hidden md:hidden pb-4 flex flex-col gap-4">${links}
          <a href="contatti.html" class="btn-primary text-center">Richiedi Preventivo</a>
        </div>
      </div>
    </nav>
  `;

  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.getElementById('nav-mobile').classList.toggle('hidden');
  });
}

function renderFooter() {
  const mount = document.getElementById('footer');
  if (!mount) return;
  mount.innerHTML = `
    <footer class="bg-primary text-white mt-20">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div>
          <h3 class="font-heading text-xl font-bold mb-3">Informatix Repair</h3>
          <p class="text-gray-300 text-sm">Riparazioni informatiche professionali a Nocera Superiore (SA). Privati, aziende e appassionati tech.</p>
        </div>
        <div>
          <h4 class="font-heading font-semibold mb-3">Link Utili</h4>
          <ul class="space-y-2 text-sm text-gray-300">
            <li><a href="servizi.html" class="hover:text-secondary">Servizi</a></li>
            <li><a href="portfolio.html" class="hover:text-secondary">Portfolio</a></li>
            <li><a href="chi-siamo.html" class="hover:text-secondary">Chi Siamo</a></li>
            <li><a href="contatti.html" class="hover:text-secondary">Contatti</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-heading font-semibold mb-3">Contatti</h4>
          <ul class="space-y-2 text-sm text-gray-300">
            <li>Nocera Superiore (SA), 84019</li>
            <li>Tel: [DA CONFERMARE]</li>
            <li>Email: info@informatix-repair.it</li>
            <li>Lun-Sab 9:00-19:00 [DA VERIFICARE]</li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 py-4 text-center text-xs text-gray-400">
        &copy; ${new Date().getFullYear()} Informatix Repair. Tutti i diritti riservati.
      </div>
    </footer>
  `;
}

function initPortfolioFilter() {
  const buttons = document.querySelectorAll('[data-filter]');
  if (!buttons.length) return;
  const items = document.querySelectorAll('[data-category]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => b.classList.remove('bg-secondary', 'text-white'));
      buttons.forEach((b) => b.classList.add('bg-lightbg', 'text-primary'));
      btn.classList.add('bg-secondary', 'text-white');
      btn.classList.remove('bg-lightbg', 'text-primary');

      items.forEach((item) => {
        item.style.display = filter === 'all' || item.dataset.category === filter ? '' : 'none';
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
  initPortfolioFilter();
});
