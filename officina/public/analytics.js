// Analisi: riparazioni, incassi e vendite del periodo scelto. Solo amministratori.
import { $, esc, eur, fdate, api, safe, META } from './util.js';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const shift = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TABS = [['riparazioni', 'Riparazioni'], ['incassi', 'Incassi'], ['vendite', 'Vendite'], ['magazzino', 'Magazzino']];
export const AN_CSS = `<style>
      [data-an]{display:grid;gap:1.6rem;margin-top:1.6rem}
      [data-an] .sec-t{margin-bottom:.4rem}
      .an-bars{list-style:none;margin:0;padding:0;display:grid;gap:.55rem}
      .an-bars li{display:grid;grid-template-columns:minmax(7rem,44%) 1fr auto;gap:.6rem;align-items:center;font-size:.9rem}
      .an-l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .an-track{height:.7rem;border-radius:99px;background:#eceff3;overflow:hidden}
      .an-track i{display:block;height:100%;border-radius:99px;background:var(--red,#dc2626)}
      .an-v{font-variant-numeric:tabular-nums;text-align:right}
      .an-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1.6rem}
      @media (max-width:520px){.an-bars li{grid-template-columns:1fr auto}.an-track{grid-column:1/-1;order:3}}
    </style>`;
const TYPES = { smartphone: 'Smartphone', tablet: 'Tablet', portatile: 'Portatile', pc: 'PC fisso', console: 'Console', altro: 'Altro' };

/** Barre orizzontali: etichetta, barra e valore scritto (leggibile anche senza colore). */
export function hbars(rows, { value = (r) => r.n, label = (r) => r.name, fmt = (v) => String(v), empty = 'Nessun dato nel periodo.' } = {}) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  const max = Math.max(1, ...rows.map(value));
  return `<ul class="an-bars">${rows.map((r) => `<li><span class="an-l">${esc(label(r))}</span>
    <span class="an-track" aria-hidden="true"><i style="width:${Math.max(3, (value(r) / max) * 100)}%"></i></span><b class="an-v">${fmt(value(r))}</b></li>`).join('')}</ul>`;
}

export const kpi = (v, l, cls = '') => `<div class="card kpi"><b class="${cls}">${v}</b><span>${l}</span></div>`;

export async function analyticsView(el, qs) {
  let from = qs.get('from') || shift(today(), -29);
  let to = qs.get('to') || today();
  let tab = qs.get('tab') || 'riparazioni';
  el.innerHTML = `
    ${AN_CSS}
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Analisi</h1></div>
    <div class="flex gap-2 items-center flex-wrap" id="an-period"><span class="chip" data-r="0">Oggi</span><span class="chip" data-r="6">7 giorni</span><span class="chip" data-r="29">30 giorni</span><span class="chip" data-r="89">90 giorni</span><span class="chip" data-r="364">Anno</span>
      <input type="date" id="an-from" class="!w-auto" value="${from}" aria-label="Dal" /><span class="text-gray-400">→</span><input type="date" id="an-to" class="!w-auto" value="${to}" aria-label="Al" /></div>
    <div class="flex gap-2 flex-wrap" id="an-tabs" role="tablist">${TABS.map(([id, l]) => `<button class="chip ${id === tab ? 'on' : ''}" role="tab" aria-selected="${id === tab}" data-tab="${id}">${l}</button>`).join('')}</div>
    <div id="an-out" data-an></div>`;
  const out = $('#an-out', el);

  async function load() {
    const d = await safe(() => api('GET', `/api/analytics?from=${from}&to=${to}`));
    if (!d || !$('#an-out', el)) return;
    if (tab === 'magazzino') {
      const [sum, al] = await Promise.all([safe(() => api('GET', '/api/stock/summary')), safe(() => api('GET', '/api/alerts'))]);
      if (!$('#an-out', el)) return;
      out.innerHTML = stockTab(d, sum || {}, al?.items || []);
      return;
    }
    out.innerHTML = { riparazioni: repairsTab, incassi: incomeTab, vendite: salesTab }[tab](d);
  }
  const setRange = (days) => { to = today(); from = shift(to, -days); $('#an-from', el).value = from; $('#an-to', el).value = to; load(); };
  $('#an-period', el).onclick = (e) => { const c = e.target.closest('[data-r]'); if (c) setRange(Number(c.dataset.r)); };
  $('#an-from', el).onchange = (e) => { from = e.target.value; if (from && to) load(); };
  $('#an-to', el).onchange = (e) => { to = e.target.value; if (from && to) load(); };
  $('#an-tabs', el).onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    el.querySelectorAll('#an-tabs [data-tab]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    load();
  };
  await load();
}

function repairsTab(d) {
  const r = d.repairs;
  const label = (s) => META.statuses?.[s]?.label || s;
  return `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${kpi(r.intake, 'Riparazioni accettate', 'text-secondary')}
      ${kpi(r.delivered, 'Consegnate nel periodo')}
      ${kpi(r.avg_days == null ? '—' : `${String(r.avg_days).replace('.', ',')} gg`, 'Tempo medio di lavorazione')}
      ${kpi(r.late_now, 'In ritardo adesso', r.late_now ? 'text-amber-600' : '')}
    </div>
    <div class="an-cols">
      <section class="card panel sec"><h3 class="sec-t">Modelli più riparati</h3>${hbars(r.models)}</section>
      <section class="card panel sec"><h3 class="sec-t">Per tipo di dispositivo</h3>${hbars(r.types, { label: (x) => TYPES[x.name] || x.name })}</section>
      <section class="card panel sec"><h3 class="sec-t">Stato delle riparazioni accettate</h3>${hbars(r.by_status, { label: (x) => label(x.status) })}
        ${r.declined ? `<p class="hint">${r.declined} ${r.declined === 1 ? 'preventivo rifiutato' : 'preventivi rifiutati'} nel periodo.</p>` : ''}</section>
    </div>`;
}

function incomeTab(d) {
  const i = d.income;
  const max = Math.max(1, ...i.by_day.map((x) => x.total));
  const chg = i.change_pct == null ? '' : `<span class="${i.change_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}">${i.change_pct >= 0 ? '▲' : '▼'} ${String(Math.abs(i.change_pct)).replace('.', ',')}%</span> rispetto ai ${d.days} giorni prima (${eur(i.prev_total)})`;
  return `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${kpi(eur(i.total), 'Incassato nel periodo', 'text-secondary')}
      ${kpi(eur(i.avg_per_day), 'Media al giorno')}
      ${kpi(eur(i.parts_cost), 'Costo ricambi e merce')}
      ${kpi(eur(i.margin), 'Margine (incasso − costi)', i.margin >= 0 ? 'text-emerald-600' : 'text-red-600')}
    </div>
    ${chg ? `<p class="hint">${chg}</p>` : ''}
    <div class="an-cols">
      <section class="card panel sec"><h3 class="sec-t">Incassi per giorno</h3>${i.by_day.length
        ? `<div class="flex items-end gap-1.5 h-40 overflow-x-auto pb-1">${i.by_day.map((x) => `<div class="flex flex-col items-center justify-end h-full min-w-[2.4rem] flex-1" title="${fdate(x.day)}: ${eur(x.total)}"><span class="text-[10px] text-gray-500 mb-1">${Math.round(x.total)}</span><div class="w-full rounded-t bg-secondary" style="height:${Math.max(4, (x.total / max) * 100)}%"></div><span class="text-[10px] text-gray-500 mt-1">${x.day.slice(8)}</span></div>`).join('')}</div>`
        : '<p class="empty">Nessun incasso nel periodo.</p>'}</section>
      <section class="card panel sec"><h3 class="sec-t">Per metodo di pagamento</h3>${hbars(i.by_method, { value: (x) => x.total, label: (x) => x.method, fmt: eur })}</section>
    </div>
    ${d.other && d.other.total > 0 ? `<section class="card panel sec"><h3 class="sec-t">Altra attività (pagamenti appesi, non inclusi sopra)</h3>
      <p><b>${eur(d.other.total)}</b> in ${d.other.n} ${d.other.n === 1 ? 'pagamento' : 'pagamenti'} da fatturare all’altra azienda. Dettaglio e correzioni in <b>Gestione → Altra attività</b>.</p>
      ${hbars(d.other.by_method, { value: (x) => x.total, label: (x) => x.method, fmt: eur })}</section>` : ''}`;
}

function salesTab(d) {
  const s = d.sales;
  return `<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      ${kpi(s.count, 'Vendite', 'text-secondary')}
      ${kpi(eur(s.revenue), 'Fatturato vendite')}
      ${kpi(eur(s.avg_ticket), 'Scontrino medio')}
    </div>
    <div class="an-cols">
      <section class="card panel sec"><h3 class="sec-t">Prodotti più venduti</h3>${hbars(s.top, { value: (x) => x.qty, fmt: (v) => `${v} pz` })}</section>
      <section class="card panel sec"><h3 class="sec-t">Prodotti meno venduti</h3>${s.bottom.length ? hbars(s.bottom, { value: (x) => x.qty, fmt: (v) => `${v} pz` }) : '<p class="empty">Servono più di 10 prodotti diversi venduti per mostrare la classifica dei meno venduti.</p>'}</section>
      <section class="card panel sec"><h3 class="sec-t">Ricambi più usati nelle riparazioni</h3>${hbars(s.parts_used, { value: (x) => x.qty, fmt: (v) => `${v} pz` })}</section>
    </div>`;
}

function stockTab(d, sum, items) {
  const by = (t) => items.filter((x) => x.type === t);
  const list = (rows, empty) => (rows.length ? `<div class="card overflow-hidden">${rows.map((x) => `<a href="${x.link}" class="block px-4 py-3 border-b border-line last:border-0 text-sm hover:bg-lightbg"><b class="block">${esc(x.title)}</b><span class="text-gray-500">${esc(x.detail)}</span></a>`).join('')}</div>` : `<p class="empty">${empty}</p>`);
  return `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${kpi(sum.items ?? '—', 'Prodotti a catalogo')}
      ${kpi(sum.units ?? '—', 'Pezzi in magazzino')}
      ${kpi(eur(sum.value_cost || 0), 'Valore a costo')}
      ${kpi(eur(sum.value_price || 0), 'Valore a prezzo di vendita', 'text-secondary')}
    </div>
    <div class="an-cols">
      <section class="card panel sec"><h3 class="sec-t">Più richiesti nel periodo</h3>${hbars(d.sales.top.slice(0, 8), { value: (x) => x.qty, fmt: (v) => `${v} pz` })}</section>
      <section class="card panel sec"><h3 class="sec-t">Meno richiesti nel periodo</h3>${d.sales.bottom.length ? hbars(d.sales.bottom, { value: (x) => x.qty, fmt: (v) => `${v} pz` }) : '<p class="empty">Servono più di 10 prodotti diversi venduti per mostrare i meno richiesti.</p>'}</section>
    </div>
    <section class="sec"><h3 class="sec-t">🛑 Esauriti e sotto scorta (${by('out_of_stock').length + by('low_stock').length})</h3>${list([...by('out_of_stock'), ...by('low_stock')], 'Tutte le scorte sono a posto.')}</section>
    <section class="sec"><h3 class="sec-t">🐌 Fermi da troppo tempo (${by('stale').length})</h3>${list(by('stale'), 'Nessun prodotto fermo. La soglia si imposta in Impostazioni → Avvisi.')}</section>`;
}
