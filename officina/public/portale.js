// Portale unico: pagina d'ingresso con i grandi pulsanti verso le aree del gestionale.
import { $, esc, eur, api } from './util.js';

const TILES = [
  { id: 'officina', href: '#/oggi', icon: '🛠️', title: 'Officina', hint: 'Riparazioni, clienti, magazzino' },
  { id: 'usati', href: '#/usati', icon: '🏷️', title: 'Vetrina usati', hint: 'Articoli in vendita sul sito' },
  { id: 'cassa', href: '#/cassa', icon: '💶', title: 'Cassa', hint: 'Incassi, spese, nota spese' },
  { id: 'analisi', href: '#/analisi', icon: '📊', title: 'Analisi', hint: 'I numeri del negozio', admin: true },
  { id: 'manuale', href: '/manuale.html', icon: '📖', title: 'Manuale', hint: 'La guida passo passo', external: true },
];

export async function portaleView(el, _params, ME) {
  const tiles = TILES.filter((t) => !t.admin || ME?.role === 'admin');
  const first = String(ME?.name || '').split(' ')[0];
  el.innerHTML = `
    <div class="page-head"><div class="sec" style="gap:.25rem"><h1 class="font-heading font-extrabold text-2xl">${first && first !== 'Locale' ? `Ciao ${esc(first)}` : 'Portale'}</h1>
      <p class="hint">Dove vuoi andare?</p></div>
      <button class="btn btn-primary btn-lg lg:hidden" id="p-new">＋ Nuova riparazione</button></div>
    <nav class="fgrid c3" aria-label="Aree del gestionale">
      ${tiles.map((t) => `<a class="card tile" href="${t.href}" ${t.external ? 'target="_blank" rel="noopener"' : ''} data-tile="${t.id}">
        <span class="tile-ic" aria-hidden="true">${t.icon}</span>
        <b>${t.title}${t.external ? '<span class="sr-only"> (si apre in una nuova scheda)</span>' : ''}</b>
        <span class="hint" id="hint-${t.id}">${t.hint}</span></a>`).join('')}
    </nav>`;
  $('#p-new', el).onclick = () => $('#top-new').click();
  // numeri di colpo d'occhio: arrivano dopo, la pagina e' gia' utilizzabile
  const set = (id, text) => { const h = $(`#hint-${id}`, el); if (h && text) h.textContent = text; };
  api('GET', '/api/dashboard').then((d) => {
    set('officina', `${d.open_total} ${d.open_total === 1 ? 'riparazione aperta' : 'riparazioni aperte'}`);
    set('cassa', `Incasso di oggi: ${eur(d.cash_today)}`);
  }).catch(() => {});
  api('GET', '/api/usati').then((d) => {
    const n = d.items.filter((i) => i.status === 'active').length;
    set('usati', `${n} ${n === 1 ? 'articolo in vetrina' : 'articoli in vetrina'}${d.publish.enabled ? '' : ' · solo bozza'}`);
  }).catch(() => {});
}
