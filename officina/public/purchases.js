// Acquisti dai fornitori: import della fattura elettronica XML, elenco acquisti, variazioni di prezzo e grafico a punti per prodotto.
import { $, $$, esc, eur, fdate, api, toast, safe, debounce, openModal } from './util.js';

const CSS = `<style>
  .pu-tabs{display:flex;gap:.5rem;flex-wrap:wrap}
  .pu-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .pu-drop{display:flex;flex-direction:column;align-items:center;gap:.4rem;text-align:center;padding:2.2rem 1rem;border:2px dashed var(--bd);border-radius:1rem;background:#fff;cursor:pointer;transition:.15s}
  .pu-drop:hover,.pu-drop.over,.pu-drop:focus-within{border-color:var(--red);background:#FEF2F2}
  .pu-drop b{font-size:1rem} .pu-drop .big{font-size:2rem;line-height:1}
  .pu-box{border-radius:.85rem;padding:.8rem 1rem;font-size:.88rem;line-height:1.5}
  .pu-box.warn{background:#FFFBEB;border:1px solid #FDE68A;color:#78350F}
  .pu-box.err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;font-weight:600}
  .pu-box.ok{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46}
  .pu-box ul{margin:0;padding-left:1.1rem}
  .pu-up{background:#FEE2E2;color:#991B1B} .pu-down{background:#D1FAE5;color:#065F46} .pu-same{background:#F3F4F6;color:#374151}
  .pu-lines{display:flex;flex-direction:column}
  .pu-line{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1.5fr) 6rem minmax(0,1.1fr);gap:.4rem 1rem;padding:1rem 1.25rem;border-bottom:1px solid var(--line);align-items:start}
  .pu-line:last-child{border-bottom:0}
  .pu-line.skip{background:#FAFAFB} .pu-line.skip .pu-desc{color:var(--muted)}
  .pu-line .pu-new{grid-column:1 / -1}
  .pu-lh{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1.5fr) 6rem minmax(0,1.1fr);gap:1rem;padding:.7rem 1.25rem;border-bottom:1px solid var(--line);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  .pu-desc{font-weight:600;line-height:1.35;overflow-wrap:anywhere}
  .pu-cell{display:flex;flex-direction:column;gap:.35rem;min-width:0;font-size:.9rem}
  .pu-cell > .l{display:none;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  @media (max-width:759px){
    .pu-lh{display:none}
    .pu-line{grid-template-columns:minmax(0,1fr) 6rem;padding:1rem}
    .pu-line > .pu-cell:first-child{grid-column:1 / -1}
    .pu-line > .pu-cell:nth-child(2){grid-column:1 / -1}
    .pu-line > .pu-cell:nth-child(4){grid-column:1 / -1}
    .pu-cell > .l{display:block}
  }
  .pu-actions{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end;align-items:center}
  .pu-actions .grow{flex:1 1 14rem;font-size:.88rem}
  @media (max-width:559px){ .pu-actions .btn{flex:1 1 100%} .pu-actions .btn-primary{order:-1} }
  .pu-chg{display:flex;gap:.6rem .8rem;align-items:center;flex-wrap:wrap;width:100%;text-align:left;padding:.7rem 0;border-bottom:1px solid var(--line);font-size:.9rem;cursor:pointer;background:none}
  .pu-chg:last-child{border-bottom:0}
  .pu-chg:hover .t{text-decoration:underline}
  .pu-chg .t{flex:1 1 16rem;min-width:0;overflow-wrap:anywhere}
  .pu-chg time{font-size:.78rem;color:var(--muted)}
  .pu-pick{display:flex;flex-direction:column;max-height:13rem;overflow-y:auto;border:1px solid var(--line);border-radius:.8rem}
  .pu-pick button{display:flex;justify-content:space-between;gap:.75rem;padding:.6rem .9rem;text-align:left;border-bottom:1px solid var(--line);font-size:.9rem;background:#fff}
  .pu-pick button:last-child{border-bottom:0}
  .pu-pick button:hover{background:var(--bg)}
  .pu-pick button[aria-pressed=true]{background:#FEF2F2;font-weight:700}
  .pu-pick small{color:var(--muted);white-space:nowrap}
  .pu-chart{width:100%;min-width:0}
  .pu-chart svg{display:block;width:100%;height:auto;overflow:visible}
  .pu-chart .pu-pt{outline:none;cursor:pointer}
  .pu-chart .pu-pt:focus .ring,.pu-chart .pu-pt:hover .ring{stroke:var(--ink);stroke-width:2}
  .pu-chart .ring{fill:none;stroke:transparent;stroke-width:2}
  .pu-chart .halo{paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round}
  .pu-tip{min-height:2.6rem;display:flex;align-items:center;font-size:.9rem;padding:.55rem .85rem;background:var(--bg);border-radius:.7rem}
  .pu-leg{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem 1.4rem;font-size:.88rem}
  .pu-leg li{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .pu-leg svg{flex:none}
  .pu-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
  .pu-hist li{display:flex;flex-wrap:wrap;gap:.25rem .9rem;padding:.55rem 0;border-bottom:1px solid var(--line);font-size:.88rem;align-items:center}
  .pu-hist li:last-child{border-bottom:0}
  .pu-hist time{color:var(--muted);min-width:5.5rem}
  .pu-hist .p{margin-left:auto;font-weight:700}
  .pu-row{display:grid;grid-template-columns:5.5rem minmax(0,1fr) 4.5rem 6rem;gap:.5rem 1rem;padding:.8rem 1.25rem;border-bottom:1px solid var(--line);align-items:center;cursor:pointer;font-size:.9rem}
  .pu-row:last-child{border-bottom:0} .pu-row:hover{background:#FAFAFB}
  .pu-row .r{text-align:right;font-variant-numeric:tabular-nums}
  @media (max-width:559px){ .pu-row{grid-template-columns:minmax(0,1fr) auto;padding:.8rem 1rem} .pu-row > :nth-child(3){display:none} }
</style>`;

// ---------- utilità ----------
const num2 = (n) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Prezzo unitario: 2 decimali, di più solo se servono (es. 0,0125). */
const eurp = (n) => (Math.abs(n * 100 - Math.round(n * 100)) > 0.0001 ? `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €` : eur(n));
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');
const pct = (n) => `${sgn(n)}${Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const absT = (n) => `${sgn(n)}${eur(Math.abs(n))}`;
const dirBadge = (d) => (d === 'up' ? '<span class="badge pu-up">▲ più caro</span>' : d === 'down' ? '<span class="badge pu-down">▼ più economico</span>' : '<span class="badge pu-same">= invariato</span>');
const changeText = (c) => `${esc(c.product_name)} · ${esc(c.supplier_name)}: ${eur(c.prev_price)} → ${eur(c.price)} (${absT(c.abs)}, ${pct(c.pct)})`;
const shortName = (s, n = 16) => { const t = String(s || '').replace(/\s*\((demo)\)\s*/i, '').replace(/\s+(s\.?r\.?l\.?|s\.?p\.?a\.?|snc|sas)\.?$/i, '').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Legge il file scelto nel browser rispettando la codifica dichiarata nell'XML (UTF-8 o ISO-8859-1). */
async function readFileText(file) {
  const buf = await file.arrayBuffer();
  const head = new TextDecoder('latin1').decode(buf.slice(0, 200));
  const enc = (head.match(/encoding\s*=\s*["']([\w-]+)["']/i) || [])[1] || 'utf-8';
  try { return new TextDecoder(enc).decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}
const P7M = 'Questo è un file firmato (.p7m): non posso leggerlo. Chiedi al fornitore o al commercialista il file XML “normale” (senza firma), oppure scaricalo dal cassetto fiscale dell’Agenzia delle Entrate.';

// ---------- pagina ----------
let TAB = 'prezzi';
const STATE = { pid: null };

export async function purchasesView(el, params) {
  const startProduct = Number(params.get('product')) || null;
  if (startProduct) { STATE.pid = startProduct; TAB = 'prezzi'; }
  if (params.get('tab')) TAB = params.get('tab');
  el.innerHTML = `${CSS}
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Acquisti e prezzi dei fornitori</h1>
      <button class="btn btn-primary" id="pu-import">📥 Importa fattura</button></div>
    <div class="pu-tabs" role="tablist" aria-label="Sezioni degli acquisti">
      ${[['prezzi', '📈 Prezzi e variazioni'], ['elenco', '🧾 Acquisti importati'], ['importa', '📥 Importa']].map(([id, l]) => `<button class="chip" role="tab" data-t="${id}">${l}</button>`).join('')}
    </div>
    <div id="pu-body" class="flex flex-col" style="gap:1.25rem"></div>`;
  const body = $('#pu-body', el);
  const show = async (t) => {
    TAB = t;
    $$('[data-t]', el).forEach((c) => { const on = c.dataset.t === t; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); });
    body.innerHTML = '<p class="text-gray-400 text-sm">Caricamento…</p>';
    await safe(() => ({ prezzi: pricesTab, elenco: listTab, importa: importTab }[t](body, show)));
  };
  $('#pu-import', el).onclick = () => show('importa');
  $('.pu-tabs', el).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };
  await show(TAB);
}

// ---------- scheda "Prezzi e variazioni" ----------
async function pricesTab(body) {
  const [changes, products] = await Promise.all([api('GET', '/api/purchases/price-changes'), api('GET', '/api/purchases/products')]);
  if (!products.length) {
    body.innerHTML = `<div class="card empty">Nessun acquisto registrato.<br><span class="text-xs">Importa la prima fattura elettronica (XML) con “Importa fattura”: da lì in poi vedrai l'andamento dei prezzi e gli avvisi.</span></div>`;
    return;
  }
  if (!STATE.pid || !products.some((p) => p.id === STATE.pid)) STATE.pid = (changes[0] && products.find((p) => p.id === changes[0].product_id)?.id) || products[0].id;
  body.innerHTML = `
    <section class="card panel sec" aria-labelledby="pu-ch-t">
      <h2 class="sec-t" id="pu-ch-t">Variazioni di prezzo dell'ultimo ordine (${changes.length})</h2>
      <p class="sec-sub">Confronto, per ogni prodotto e fornitore, tra l'ultimo acquisto e quello prima. Tocca una riga per vedere il grafico.</p>
      <div id="pu-changes">${changes.length ? changes.map((c) => `<button class="pu-chg" data-pid="${c.product_id}">${dirBadge(c.direction)}<span class="t">${changeText(c)}</span><time datetime="${c.date}">${fdate(c.date)}</time></button>`).join('') : '<p class="empty" style="padding:1rem">Nessuna variazione: i prezzi sono uguali all\'ordine precedente (o c\'è un solo ordine per prodotto).</p>'}</div>
    </section>
    <section class="card panel sec" aria-labelledby="pu-gr-t">
      <h2 class="sec-t" id="pu-gr-t">Andamento del prezzo di acquisto</h2>
      <div class="fgrid c2">
        <div class="field"><label class="l" for="pu-q">Cerca il prodotto</label><input id="pu-q" type="search" placeholder="Nome o codice…" autocomplete="off" /></div>
        <div class="field"><span class="l" id="pu-pick-l">Prodotto (${products.length})</span><div class="pu-pick" id="pu-pick" role="group" aria-labelledby="pu-pick-l"></div></div>
      </div>
      <div id="pu-graph" class="sec"></div>
    </section>`;
  const pick = $('#pu-pick', body);
  const drawPick = () => {
    const q = $('#pu-q', body).value.trim().toLowerCase();
    const list = products.filter((p) => !q || `${p.name} ${p.sku || ''}`.toLowerCase().includes(q));
    pick.innerHTML = list.map((p) => `<button type="button" data-pid="${p.id}" aria-pressed="${p.id === STATE.pid}"><span>${esc(p.name)}</span><small>${p.points} acquisti · ${p.suppliers} forn.</small></button>`).join('') || '<p class="empty" style="padding:1rem">Nessun prodotto trovato.</p>';
  };
  const choose = async (id) => { STATE.pid = id; drawPick(); await graph(body, id); };
  $('#pu-q', body).oninput = debounce(drawPick, 150);
  body.onclick = (e) => {
    const b = e.target.closest('[data-pid]');
    if (!b) return;
    choose(Number(b.dataset.pid));
    if (b.classList.contains('pu-chg')) $('#pu-gr-t', body).scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  drawPick();
  await graph(body, STATE.pid);
}

// ---------- grafico a punti ----------
const PALETTE = ['#1D4ED8', '#C2410C', '#047857', '#A21CAF', '#854D0E', '#334155']; // contrasto >= 4,5:1 su bianco
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'plus', 'hexagon'];
const DASH = ['', '7 4', '2 4', '10 4 2 4', '', '7 4'];

function shape(kind, x, y, r, attrs) {
  const f = (n) => Math.round(n * 10) / 10;
  const poly = (pts) => `<polygon points="${pts.map(([a, b]) => `${f(x + a)},${f(y + b)}`).join(' ')}" ${attrs}/>`;
  switch (kind) {
    case 'square': return `<rect x="${f(x - r * 0.9)}" y="${f(y - r * 0.9)}" width="${f(r * 1.8)}" height="${f(r * 1.8)}" ${attrs}/>`;
    case 'triangle': return poly([[0, -r * 1.2], [r * 1.1, r * 0.85], [-r * 1.1, r * 0.85]]);
    case 'diamond': return poly([[0, -r * 1.3], [r * 1.3, 0], [0, r * 1.3], [-r * 1.3, 0]]);
    case 'plus': { const t = r * 0.42; return poly([[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]]); }
    case 'hexagon': return poly([0, 1, 2, 3, 4, 5].map((i) => [Math.cos((Math.PI / 3) * i) * r * 1.1, Math.sin((Math.PI / 3) * i) * r * 1.1]));
    default: return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${attrs}/>`;
  }
}
const legendSwatch = (i) => `<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><line x1="0" y1="8" x2="22" y2="8" stroke="${PALETTE[i % 6]}" stroke-width="2" ${DASH[i % 6] ? `stroke-dasharray="${DASH[i % 6]}"` : ''}/>${shape(SHAPES[i % 6], 11, 8, 5, `fill="${PALETTE[i % 6]}" stroke="#fff" stroke-width="1.2"`)}</svg>`;
const day = (s) => Date.parse(`${s}T00:00:00Z`);
const dmy = (s, short) => { const [y, m, d] = s.split('-'); return short ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`; };

function niceStep(range, target) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Disegna il grafico (SVG inline) per i dati di /api/purchases/prices. */
export function drawChart(host, data) {
  const W = Math.max(300, Math.floor(host.clientWidth || 640));
  const narrow = W < 520;
  const H = narrow ? 330 : 380;
  const M = { l: narrow ? 46 : 56, r: 14, t: 16, b: 44 };
  const pts = data.series;
  const sups = data.suppliers.map((s) => s.supplier_id);
  const idx = (id) => sups.indexOf(id);
  const t0 = Math.min(...pts.map((p) => day(p.date)));
  const t1 = Math.max(...pts.map((p) => day(p.date)));
  const span = t1 - t0 || 30 * 86400000;
  const xa = t0 - (t1 === t0 ? span / 2 : span * 0.05);
  const xb = t1 + (t1 === t0 ? span / 2 : span * 0.05);
  const lo = Math.min(...pts.map((p) => p.price));
  const hi = Math.max(...pts.map((p) => p.price));
  const pad = (hi - lo || hi * 0.1 || 1) * 0.28;
  const step = niceStep(hi + pad - (lo - pad), 4);
  const ya = Math.max(0, Math.floor((lo - pad) / step) * step);
  const yb = Math.ceil((hi + pad) / step) * step;
  const X = (t) => M.l + ((t - xa) / (xb - xa)) * (W - M.l - M.r);
  const Y = (v) => H - M.b - ((v - ya) / (yb - ya)) * (H - M.t - M.b);
  const yt = [];
  for (let v = ya; v <= yb + 1e-9; v += step) yt.push(v);
  const nx = narrow ? 3 : 5;
  const xt = Array.from({ length: nx }, (_, i) => t0 + (span * i) / (nx - 1));
  const fmtT = (t) => dmy(new Date(t).toISOString().slice(0, 10), narrow);

  const lowId = data.lowest && pts.find((p) => p.price === data.lowest.price && p.supplier_id === data.lowest.supplier_id && p.date === data.lowest.date)?.id;
  let g = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-labelledby="pu-ct pu-cd" font-family="Inter,system-ui,sans-serif">
    <title id="pu-ct">Prezzi di acquisto di ${esc(data.product.name)} nel tempo</title>
    <desc id="pu-cd">Grafico a punti: asse orizzontale le date degli ordini, asse verticale il prezzo di acquisto. ${pts.length} acquisti da ${sups.length} fornitori. Il prezzo più basso è ${num2(data.lowest.price)} euro da ${esc(data.lowest.supplier_name)}. Lo stesso elenco è scritto sotto il grafico.</desc>`;
  for (const v of yt) g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E5E7EB"/><text x="${M.l - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#4B5563">${num2(v)} €</text>`;
  g += `<line x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}" stroke="#9CA3AF"/><line x1="${M.l}" x2="${M.l}" y1="${M.t}" y2="${H - M.b}" stroke="#9CA3AF"/>`;
  for (const t of xt) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${H - M.b}" y2="${H - M.b + 5}" stroke="#9CA3AF"/><text x="${X(t)}" y="${H - M.b + 20}" text-anchor="middle" font-size="11" fill="#4B5563">${fmtT(t)}</text>`;
  g += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#6B7280">Data dell'ordine</text>`;

  // linee dello stesso fornitore
  for (const s of data.suppliers) {
    const i = idx(s.supplier_id);
    const mine = pts.filter((p) => p.supplier_id === s.supplier_id);
    if (mine.length > 1) g += `<polyline points="${mine.map((p) => `${X(day(p.date)).toFixed(1)},${Y(p.price).toFixed(1)}`).join(' ')}" fill="none" stroke="${PALETTE[i % 6]}" stroke-width="2" ${DASH[i % 6] ? `stroke-dasharray="${DASH[i % 6]}"` : ''} opacity=".85"/>`;
  }
  // etichette senza sovrapposizioni
  const placed = [];
  const marks = pts.map((p) => ({ x: X(day(p.date)), y: Y(p.price) }));
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const labels = pts.map((p, k) => {
    const text = `${shortName(p.supplier_name, narrow ? 10 : 18)} · ${num2(p.price)} €`;
    const w = text.length * 6 + 6;
    const { x, y } = marks[k];
    const tries = [['middle', 0, -13], ['middle', 0, 22], ['start', 11, -4], ['end', -11, -4], ['start', 11, 17], ['end', -11, 17], ['middle', 0, -30], ['middle', 0, 38]];
    let best = null;
    for (const [anchor, dx, dy] of tries) {
      const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x + dx : x + dx - w;
      const r = { x0, x1: x0 + w, y0: y + dy - 11, y1: y + dy + 3, anchor, tx: anchor === 'middle' ? x : x + dx, ty: y + dy };
      const inside = r.x0 >= 0 && r.x1 <= W && r.y0 >= 0 && r.y1 <= H - M.b + 2;
      const clash = placed.some((q) => overlap(r, q)) || marks.some((m, j) => j !== k && overlap(r, { x0: m.x - 9, x1: m.x + 9, y0: m.y - 9, y1: m.y + 9 }));
      if (inside && !clash) { best = r; break; }
      if (!best && inside) best = r;
    }
    best = best || { anchor: 'middle', tx: x, ty: y - 13, x0: x - w / 2, x1: x + w / 2, y0: y - 24, y1: y - 10 };
    placed.push(best);
    return { text, ...best };
  });

  // punti (forma + colore per fornitore), il più basso evidenziato
  const sorted = [...pts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  pts.forEach((p, k) => {
    const i = idx(p.supplier_id);
    const isLow = p.id === lowId;
    const { x, y } = marks[k];
    const L = labels[k];
    const aria = `${p.supplier_name}, ${fdate(p.date)}, ${num2(p.price)} euro, quantità ${p.qty}${isLow ? ', prezzo più basso' : ''}`;
    g += `<g class="pu-pt" tabindex="0" role="img" aria-label="${esc(aria)}" data-i="${sorted.indexOf(p)}" data-k="${k}"><title>${esc(aria)}</title>
      ${isLow ? `<circle cx="${x}" cy="${y}" r="13" fill="#FEF3C7" stroke="#B45309" stroke-width="2"/>` : ''}
      <circle class="ring" cx="${x}" cy="${y}" r="${isLow ? 16 : 12}"/>
      ${shape(SHAPES[i % 6], x, y, 6.5, `fill="${PALETTE[i % 6]}" stroke="#fff" stroke-width="1.5"`)}
      <text class="halo" x="${L.tx}" y="${L.ty}" text-anchor="${L.anchor}" font-size="11" font-weight="${isLow ? 700 : 500}" fill="${isLow ? '#92400E' : '#111827'}">${esc(isLow ? `★ ${L.text}` : L.text)}</text></g>`;
  });
  g += '</svg>';

  const legend = data.suppliers.map((s) => {
    const i = idx(s.supplier_id);
    const v = s.direction ? `<span class="badge ${s.direction === 'up' ? 'pu-up' : s.direction === 'down' ? 'pu-down' : 'pu-same'}">${s.direction === 'up' ? '▲' : s.direction === 'down' ? '▼' : '='} ${pct(s.pct)}</span>` : '<span class="hint">un solo acquisto</span>';
    return `<li>${legendSwatch(i)}<b>${esc(s.supplier_name)}</b><span>ultimo ${eur(s.last_price)}</span>${v}</li>`;
  }).join('');
  const hist = [...sorted].reverse().map((p) => {
    const same = sorted.filter((q) => q.supplier_id === p.supplier_id && q.purchase_id !== p.purchase_id && (q.date < p.date || (q.date === p.date && q.id < p.id)));
    const prev = same[same.length - 1];
    const d = prev ? ((p.price - prev.price) / prev.price) * 100 : null;
    return `<li><time datetime="${p.date}">${fdate(p.date)}</time><span>${legendSwatch(idx(p.supplier_id))} ${esc(p.supplier_name)}</span><span class="hint">${p.qty} pz</span>${d != null && Math.abs(d) >= 0.05 ? `<span class="badge ${d > 0 ? 'pu-up' : 'pu-down'}">${d > 0 ? '▲' : '▼'} ${pct(d)}</span>` : ''}${p.id === lowId ? '<span class="badge" style="background:#FEF3C7;color:#92400E">★ più basso</span>' : ''}<span class="p">${eur(p.price)}</span></li>`;
  }).join('');
  host.innerHTML = `<div class="pu-chart">${g}</div>
    <div class="pu-tip" id="pu-tip" aria-live="polite">Tocca o seleziona un punto (con le frecce della tastiera) per i dettagli.</div>
    <ul class="pu-leg" aria-label="Legenda dei fornitori">${legend}</ul>
    <div class="sec"><h3 class="sec-t">Elenco degli acquisti (stessi dati del grafico)</h3><ul class="pu-hist">${hist}</ul></div>`;

  const tip = $('#pu-tip', host);
  const showTip = (el) => {
    const p = pts[Number(el.dataset.k)];
    if (!p) return;
    tip.innerHTML = `<span><b>${esc(p.supplier_name)}</b> · ${num2(p.price)} € · ${fdate(p.date)} · ${p.qty} pz${p.id === lowId ? ' · ★ prezzo più basso' : ''}</span>`;
  };
  const nodes = $$('.pu-pt', host).sort((a, b) => Number(a.dataset.i) - Number(b.dataset.i));
  host.addEventListener('focusin', (e) => { const n = e.target.closest('.pu-pt'); if (n) showTip(n); });
  host.addEventListener('mouseover', (e) => { const n = e.target.closest('.pu-pt'); if (n) showTip(n); });
  host.addEventListener('click', (e) => { const n = e.target.closest('.pu-pt'); if (n) { n.focus(); showTip(n); } });
  host.addEventListener('keydown', (e) => {
    const n = e.target.closest?.('.pu-pt');
    if (!n || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = nodes.indexOf(n);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? nodes.length - 1 : Math.min(nodes.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)));
    nodes[j].focus();
  });
}

async function graph(root, pid) {
  const host = $('#pu-graph', root);
  if (!host) return;
  const d = await safe(() => api('GET', `/api/purchases/prices?product_id=${pid}`));
  if (!d || !$('#pu-graph', root)) return;
  host.innerHTML = `<h3 class="font-heading font-bold text-lg">${esc(d.product.name)}</h3>
    <div class="row"><span class="badge" style="background:#FEF3C7;color:#92400E;white-space:normal;border-radius:.9rem">★ Prezzo più basso: ${eur(d.lowest.price)} · ${esc(d.lowest.supplier_name)} (${fdate(d.lowest.date)})</span>
    ${d.cheapest_now ? `<span class="badge pu-same" style="white-space:normal;border-radius:.9rem">Oggi il più conveniente: ${esc(d.cheapest_now.supplier_name)} ${eur(d.cheapest_now.price)}</span>` : ''}</div>
    <div id="pu-chart-host"></div>`;
  const chartHost = $('#pu-chart-host', host);
  drawChart(chartHost, d);
  let w = chartHost.clientWidth;
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(debounce(() => { if (!chartHost.isConnected) return ro.disconnect(); if (Math.abs(chartHost.clientWidth - w) > 20) { w = chartHost.clientWidth; drawChart(chartHost, d); } }, 200));
    ro.observe(chartHost);
  }
}

// ---------- scheda "Acquisti importati" ----------
async function listTab(body) {
  const list = await api('GET', '/api/purchases');
  if (!list.length) { body.innerHTML = '<div class="card empty">Nessun acquisto importato. Usa “Importa fattura”.</div>'; return; }
  body.innerHTML = `<div class="card overflow-hidden" role="list">${list.map((p) => `<div class="pu-row" role="listitem" tabindex="0" data-id="${p.id}"><time datetime="${p.doc_date}">${fdate(p.doc_date)}</time>
    <span style="min-width:0"><b>${esc(p.supplier_name)}</b><span class="hint block">Doc. ${esc(p.doc_number)}${p.id < 0 ? ' · demo' : ''}</span></span><span class="r hint">${p.lines_count} righe</span><b class="r">${eur(p.total)}</b></div>`).join('')}</div>`;
  const open = async (id) => {
    const p = await safe(() => api('GET', `/api/purchases/${id}`));
    if (!p) return;
    openModal(`<div class="sec"><dl class="kv"><dt>Fornitore</dt><dd>${esc(p.supplier_name)}</dd><dt>Documento</dt><dd>${esc(p.doc_number)} del ${fdate(p.doc_date)}</dd><dt>Totale</dt><dd><b>${eur(p.total)}</b> (IVA inclusa)</dd><dt>Importato il</dt><dd>${fdate(p.imported_at)}</dd></dl>
      <ul class="pu-hist">${p.lines.map((l) => `<li><span style="flex:1 1 14rem;min-width:0;overflow-wrap:anywhere"><b>${esc(l.description)}</b>${l.supplier_code ? `<span class="hint block">codice ${esc(l.supplier_code)}</span>` : ''}</span><span class="hint">${l.qty} ${esc(l.unit || 'pz')} × ${eurp(l.unit_price)}${l.discount ? ` (sconto ${num2(l.discount)}%)` : ''}</span><span class="badge ${l.loaded ? 'pu-down' : 'pu-same'}">${l.loaded ? `caricato: ${esc(l.product_name || '')}` : 'non caricato'}</span><span class="p">${eur(l.line_total)}</span></li>`).join('')}</ul></div>`, { title: `Acquisto ${p.doc_number}`, wide: true });
  };
  body.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) open(r.dataset.id); };
  body.onkeydown = (e) => { const r = e.target.closest('[data-id]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(r.dataset.id); } };
}

// ---------- scheda "Importa": 1) scegli il file 2) controlla 3) conferma ----------
async function importTab(body, show) {
  const draw = () => {
    body.innerHTML = `<section class="card panel sec"><h2 class="sec-t">1 · Scegli la fattura</h2>
      <label class="pu-drop" id="pu-drop"><span class="big" aria-hidden="true">📄</span><b>Trascina qui la fattura elettronica (XML)</b><span class="hint">oppure tocca per scegliere il file dal computer o dal telefono</span>
        <input class="pu-sr" type="file" id="pu-file" accept=".xml,.p7m,.pdf,text/xml,application/xml,application/pdf" /></label>
      <div id="pu-msg" role="alert"></div>
      <p class="hint">Serve il file <b>.xml</b> (non quello firmato .p7m). Non viene scritto nulla finché non confermi al passo 3. DDT e PDF: formato non ancora supportato.</p></section><div id="pu-review"></div>`;
    const drop = $('#pu-drop', body);
    const input = $('#pu-file', body);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) load(f); });
    input.onchange = () => { if (input.files[0]) load(input.files[0]); };
  };
  const msg = (html, kind = 'err') => { $('#pu-msg', body).innerHTML = html ? `<div class="pu-box ${kind}">${html}</div>` : ''; };
  const load = async (file) => {
    msg('');
    $('#pu-review', body).innerHTML = '';
    if (/\.p7m$/i.test(file.name)) return msg(esc(P7M));
    if (file.size > 6 * 1024 * 1024) return msg('File troppo grande (massimo 6 MB).');
    const text = await readFileText(file);
    msg(`Leggo ${esc(file.name)}…`, 'ok');
    try {
      const pv = await api('POST', '/api/purchases/preview', { xml: text, filename: file.name });
      msg('');
      review(body, { text, filename: file.name, pv }, show);
    } catch (e) { msg(esc(e.message)); }
  };
  draw();
}

const optVal = (v) => (v === 'new' || v === 'skip' ? v : `p:${v}`);

async function review(body, ctx, show) {
  const host = $('#pu-review', body);
  const { text, filename } = ctx;
  let { pv } = ctx;
  const allProducts = (await safe(() => api('GET', '/api/products'))) || [];
  const suppliers = (await safe(() => api('GET', '/api/suppliers'))) || [];
  const draw = () => {
    const m = pv.supplier.match;
    const supOpts = `${m ? `<option value="auto" ${!ctx.supChoice || ctx.supChoice === 'auto' ? 'selected' : ''}>${esc(m.name)} (riconosciuto${m.by === 'vat' ? ' dalla partita IVA' : ' dal nome'})</option>` : ''}
      <option value="new" ${ctx.supChoice === 'new' || (!m && !ctx.supChoice) ? 'selected' : ''}>➕ Crea nuovo fornitore: ${esc(pv.supplier.parsed.name)}</option>
      ${suppliers.filter((s) => !m || s.id !== m.id).map((s) => `<option value="${s.id}" ${String(ctx.supChoice) === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`;
    const dup = pv.duplicate;
    host.innerHTML = `<section class="card panel sec"><h2 class="sec-t">2 · Controlla e correggi</h2>
      <dl class="kv"><dt>Documento</dt><dd><b>${esc(pv.doc.type_label || 'Fattura')} ${esc(pv.doc.number)}</b> del ${fdate(pv.doc.date)}</dd>
        <dt>Totale</dt><dd><b>${eur(pv.doc.total)}</b> (IVA inclusa)</dd>
        <dt>Dati fornitore</dt><dd>${esc(pv.supplier.parsed.name)}${pv.supplier.parsed.vat ? ` · P.IVA ${esc(pv.supplier.parsed.vat)}` : ''}${pv.supplier.parsed.address ? ` · ${esc(pv.supplier.parsed.address)}` : ''}</dd></dl>
      <div class="field"><label class="l" for="pu-sup">Fornitore</label><select id="pu-sup">${supOpts}</select></div>
      ${dup ? `<div class="pu-box err">Questo documento è già stato importato il ${fdate(dup.imported_at)}: non si può importare due volte.</div>` : ''}
      ${pv.warnings.filter((w) => !/già stato importato/.test(w)).length ? `<div class="pu-box warn"><ul>${pv.warnings.filter((w) => !/già stato importato/.test(w)).map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
    </section>
    <section class="card overflow-hidden" aria-label="Righe della fattura"><div class="pu-lh" aria-hidden="true"><span>Riga della fattura</span><span>Prodotto in magazzino</span><span>Quantità</span><span>Prezzo di acquisto</span></div>
      <div class="pu-lines" id="pu-lines">${pv.lines.map(lineHtml).join('')}</div></section>
    <section class="card panel sec"><div class="pu-actions"><span class="grow" id="pu-sum" aria-live="polite"></span>
      <button class="btn btn-outline" id="pu-cancel">Annulla</button><button class="btn btn-primary btn-lg" id="pu-ok" ${dup ? 'disabled' : ''}>✔ Conferma e carica il magazzino</button></div></section>`;
    bind();
    summary();
  };
  const lineHtml = (l) => {
    const sug = l.suggested;
    const cur = sug.action === 'match' ? optVal(sug.product_id) : sug.action;
    const cand = l.candidates.map((c) => `<option value="p:${c.id}" ${cur === `p:${c.id}` ? 'selected' : ''}>${esc(c.name)} · ${c.qty} pz${c.score < 1 ? ` · somiglianza ${Math.round(c.score * 100)}%` : ''}</option>`).join('');
    const rest = allProducts.filter((p) => !l.candidates.some((c) => c.id === p.id)).map((p) => `<option value="p:${p.id}">${esc(p.name)} · ${p.qty} pz</option>`).join('');
    return `<div class="pu-line ${cur === 'skip' ? 'skip' : ''}" data-n="${l.n}">
      <div class="pu-cell"><span class="l">Riga della fattura</span><span class="pu-desc">${esc(l.description)}</span>
        <span class="hint">${l.code ? `codice ${esc(l.code)} · ` : ''}IVA ${num2(l.vat_rate)}%${l.discount > 0 ? ` · sconto ${num2(l.discount)}% sul listino ${eurp(l.list_price)}` : ''}${sug.by ? ` · abbinato per ${esc(sug.by)}` : ''}${sug.reason ? ` · ${esc(sug.reason)}` : ''}</span></div>
      <div class="pu-cell"><span class="l">Prodotto in magazzino</span><select data-f="act" aria-label="Prodotto per: ${esc(l.description)}">
        ${cand ? `<optgroup label="Suggeriti">${cand}</optgroup>` : ''}
        <optgroup label="Altro"><option value="new" ${cur === 'new' ? 'selected' : ''}>➕ Nuovo prodotto</option><option value="skip" ${cur === 'skip' ? 'selected' : ''}>⏭ Non caricare questa riga</option></optgroup>
        ${rest ? `<optgroup label="Tutti i prodotti">${rest}</optgroup>` : ''}</select></div>
      <div class="pu-cell"><label class="l" for="pq${l.n}">Quantità</label><input id="pq${l.n}" data-f="qty" type="number" min="0" step="any" inputmode="decimal" value="${l.qty}" aria-label="Quantità: ${esc(l.description)}" /><span class="hint">${esc(l.unit || '')}</span></div>
      <div class="pu-cell" data-f="price">${priceHtml(l, l.prev, l.elsewhere)}</div>
      <div class="pu-new fgrid c2 hidden" data-f="newbox"><div class="field"><label class="l" for="pn${l.n}">Nome del nuovo prodotto</label><input id="pn${l.n}" data-f="name" value="${esc(l.description.slice(0, 120))}" /></div>
        <div class="field"><label class="l" for="pp${l.n}">Prezzo di vendita (facoltativo)</label><input id="pp${l.n}" data-f="sale" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" /></div></div>
    </div>`;
  };
  const priceHtml = (l, prev, elsewhere) => `<span class="l">Prezzo di acquisto (netto)</span><b>${eurp(l.unit_price)}</b><span class="hint">× ${l.qty} = ${eur(l.line_total)}</span>
    ${prev ? (prev.direction === 'same' ? `<span><span class="badge pu-same">= invariato</span> <span class="hint">come il ${fdate(prev.doc_date)}</span></span>` : `<span>${dirBadge(prev.direction)} <b>${absT(prev.abs)} (${pct(prev.pct)})</b></span><span class="hint">prima ${eurp(prev.unit_price)} il ${fdate(prev.doc_date)}</span>`) : '<span class="hint">primo acquisto da questo fornitore</span>'}
    ${elsewhere ? `<span class="hint">⚠ Altrove costa meno: ${esc(elsewhere.supplier_name)} ${eurp(elsewhere.unit_price)}</span>` : ''}`;

  const choices = () => $$('.pu-line', host).map((row) => {
    const n = Number($('[data-f=act]', row) && row.dataset.n);
    const v = $('[data-f=act]', row).value;
    const base = { n, qty: $('[data-f=qty]', row).value };
    if (v === 'skip') return { ...base, action: 'skip' };
    if (v === 'new') return { ...base, action: 'new', name: $('[data-f=name]', row).value.trim(), price: $('[data-f=sale]', row).value };
    return { ...base, action: 'match', product_id: Number(v.slice(2)) };
  });
  const body2 = () => ({ xml: text, filename, lines: choices(), ...(ctx.supChoice === 'new' ? { new_supplier: true } : ctx.supChoice && ctx.supChoice !== 'auto' ? { supplier_id: Number(ctx.supChoice) } : {}) });
  const summary = () => {
    const c = choices();
    const load = c.filter((x) => x.action !== 'skip' && Number(String(x.qty).replace(',', '.')) > 0);
    const fresh = load.filter((x) => x.action === 'new').length;
    $('#pu-sum', host).innerHTML = `<b>${load.length}</b> righe da caricare${fresh ? ` (<b>${fresh}</b> prodotti nuovi)` : ''}, ${c.length - load.length} ignorate · totale documento <b>${eur(pv.doc.total)}</b>`;
    $('#pu-ok', host).disabled = !!pv.duplicate || !load.length;
  };
  const refreshRow = async (row) => {
    const l = pv.lines.find((x) => x.n === Number(row.dataset.n));
    const v = $('[data-f=act]', row).value;
    row.classList.toggle('skip', v === 'skip');
    $('[data-f=newbox]', row).classList.toggle('hidden', v !== 'new');
    let prev = null;
    const supId = pv.supplier.match?.id;
    if (v.startsWith('p:') && supId) prev = (await safe(() => api('GET', `/api/purchases/last-price?product_id=${v.slice(2)}&supplier_id=${supId}`)))?.last || null;
    if (prev) { const abs = Math.round((l.unit_price - prev.unit_price) * 100) / 100; prev = { ...prev, abs, pct: prev.unit_price > 0 ? Math.round((abs / prev.unit_price) * 1000) / 10 : 0, direction: Math.abs(abs) < 0.005 ? 'same' : abs > 0 ? 'up' : 'down' }; }
    $('[data-f=price]', row).innerHTML = priceHtml(l, v.startsWith('p:') ? prev : null, v === optVal(l.suggested.product_id) ? l.elsewhere : null);
    summary();
  };
  const bind = () => {
    $$('.pu-line', host).forEach((row) => { $('[data-f=newbox]', row).classList.toggle('hidden', $('[data-f=act]', row).value !== 'new'); });
    $('#pu-lines', host).onchange = (e) => { const row = e.target.closest('.pu-line'); if (row) (e.target.dataset.f === 'act' ? refreshRow(row) : summary()); };
    $('#pu-lines', host).oninput = (e) => { if (e.target.dataset.f === 'qty') summary(); };
    $('#pu-sup', host).onchange = async (e) => {
      ctx.supChoice = e.target.value;
      const b = { xml: text, filename, ...(ctx.supChoice === 'new' ? { new_supplier: true } : ctx.supChoice !== 'auto' ? { supplier_id: Number(ctx.supChoice) } : {}) };
      const np = await safe(() => api('POST', '/api/purchases/preview', b));
      if (np) { pv = np; draw(); }
    };
    $('#pu-cancel', host).onclick = () => show('importa');
    $('#pu-ok', host).onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Importo…';
      const r = await safe(() => api('POST', '/api/purchases/confirm', body2()));
      if (!r) { btn.disabled = false; btn.textContent = '✔ Conferma e carica il magazzino'; return; }
      done(r);
    };
  };
  const done = (r) => {
    toast('Acquisto importato e magazzino aggiornato');
    host.innerHTML = `<section class="card panel sec"><h2 class="sec-t">Fatto</h2>
      <div class="pu-box ok"><b>Fattura ${esc(r.doc_number)} di ${esc(r.supplier_name)} importata.</b><br>${r.lines_count} righe caricate in magazzino${r.new_products ? `, ${r.new_products} prodotti nuovi creati` : ''}${r.supplier_created ? ', fornitore nuovo creato' : ''}${r.lines_skipped ? `, ${r.lines_skipped} righe ignorate` : ''}.</div>
      ${r.warnings?.length ? `<div class="pu-box warn"><ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      ${r.changes?.length ? `<div><h3 class="sec-t">Variazioni di prezzo rispetto all'ordine precedente</h3>${r.changes.map((c) => `<button class="pu-chg" data-go="${c.product_id}">${dirBadge(c.direction)}<span class="t">${changeText(c)}</span></button>`).join('')}</div>` : '<p class="hint">Nessuna variazione di prezzo rispetto agli ordini precedenti.</p>'}
      <div class="row"><button class="btn btn-primary" id="pu-another">📥 Importa un'altra fattura</button><button class="btn btn-outline" id="pu-see">📈 Vedi prezzi e grafico</button></div></section>`;
    host.onclick = (e) => { const g = e.target.closest('[data-go]'); if (g) { STATE.pid = Number(g.dataset.go); show('prezzi'); } };
    $('#pu-another', host).onclick = () => show('importa');
    $('#pu-see', host).onclick = () => show('prezzi');
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  draw();
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
