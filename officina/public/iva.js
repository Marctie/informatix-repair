// Campi IVA per i prezzi d'acquisto (carico merce, ricambi a mano): IVA esclusa/inclusa, aliquota, "applica IVA realmente".
// Il calcolo e' mostrato subito; il server rifa' lo stesso calcolo e salva imponibile, IVA e totale.
import { $, esc, eur, api, safe } from './util.js';

let defaultRate = 22;
let loaded = false;
export async function ensureVatDefault() {
  if (loaded) return;
  const s = await safe(() => api('GET', '/api/settings'));
  if (s && Number.isFinite(Number(s.vat_rate))) { defaultRate = Number(s.vat_rate); loaded = true; }
}

/** Stessa formula del server (officina/iva.mjs). */
export function calcVat(amount, mode, rate, apply) {
  const a = Number(String(amount).replace(',', '.'));
  if (!Number.isFinite(a) || a < 0) return null;
  const k = 1 + rate / 100;
  const net = mode === 'gross' ? a / k : a;
  const gross = mode === 'gross' ? a : a * k;
  return { net, vat: gross - net, gross, cost: apply ? gross : net };
}

/** HTML del blocco IVA; `p` = prefisso degli id. */
export function vatBlock(p) {
  return `<div class="fgrid c3" style="margin-top:.25rem">
      <div class="field"><label class="l" for="${p}-vmode">Il prezzo è</label><select id="${p}-vmode"><option value="net">IVA esclusa</option><option value="gross">IVA inclusa</option></select></div>
      <div class="field"><label class="l" for="${p}-vrate">Aliquota IVA %</label><input id="${p}-vrate" inputmode="decimal" value="${esc(String(defaultRate))}" /></div>
      <div class="field"><span class="l">IVA realmente dovuta</span><label class="check"><input type="checkbox" id="${p}-vapply" /> Aggiungi l’IVA al costo</label></div>
    </div>
    <p class="hint" id="${p}-vsum" aria-live="polite"></p>`;
}

/** Collega il blocco al campo prezzo; restituisce la funzione che legge i valori da inviare. */
export function bindVat(root, p, priceSel) {
  const upd = () => {
    const mode = $(`#${p}-vmode`, root).value, rate = Number(String($(`#${p}-vrate`, root).value).replace(',', '.')) || 0, apply = $(`#${p}-vapply`, root).checked;
    const c = calcVat($(priceSel, root).value, mode, rate, apply);
    $(`#${p}-vsum`, root).textContent = c ? `Imponibile ${eur(c.net)} + IVA ${eur(c.vat)} = ${eur(c.gross)} · costo registrato ${eur(c.cost)}${apply ? ' (IVA aggiunta)' : ' (IVA esclusa dal costo)'}` : 'Scrivi il prezzo per vedere il calcolo dell’IVA.';
  };
  for (const id of [`#${p}-vmode`, `#${p}-vrate`, `#${p}-vapply`, priceSel]) $(id, root).addEventListener('input', upd);
  upd();
  return () => ({ price_mode: $(`#${p}-vmode`, root).value, vat_rate: $(`#${p}-vrate`, root).value.replace(',', '.'), vat_apply: $(`#${p}-vapply`, root).checked });
}

// ---------- Preventivi: prezzo scritto IVA inclusa o esclusa ----------
/** Menu "il prezzo e'": con IVA esclusa l'IVA si somma al totale (il server salva sempre il totale IVA compresa). */
export const priceModeSelect = (id, mode = 'gross') => `<select id="${id}" aria-label="Il prezzo scritto è"><option value="gross" ${mode === 'gross' ? 'selected' : ''}>IVA inclusa</option><option value="net" ${mode === 'net' ? 'selected' : ''}>IVA esclusa</option></select>`;

/** Campo sconto: importo + menu euro/percentuale. `d` = { discount, pct } gia' salvati (per riaprire una scheda). */
export const discountField = (p, d = {}) => `<div class="field"><label class="l" for="${p}-disc">Sconto</label><div class="row nowrap"><input id="${p}-disc" inputmode="decimal" placeholder="0" value="${d.pct != null ? d.pct : d.discount || ''}" /><select id="${p}-dtype" style="width:auto;flex:none" aria-label="Sconto in euro o in percentuale"><option value="eur">€</option><option value="pct" ${d.pct != null ? 'selected' : ''}>%</option></select></div></div>`;

/** Valori dello sconto da inviare al server: `keys` dice come si chiamano i due campi (euro e percentuale). */
export function discountVals(root, p, keys = { eur: 'quote_discount', pct: 'quote_discount_pct' }) {
  const v = $(`#${p}-disc`, root).value.trim().replace(',', '.');
  const out = { [keys.eur]: '', [keys.pct]: '' };
  if (v) out[$(`#${p}-dtype`, root).value === 'pct' ? keys.pct : keys.eur] = v;
  return out;
}

/** Sconto in euro dai due campi (se in %, calcolato sul prezzo scritto). */
export function discountEuro(root, p, amount) {
  const v = Number($(`#${p}-disc`, root)?.value.trim().replace(',', '.')) || 0;
  const a = Number(String(amount ?? '').replace(',', '.')) || 0;
  return $(`#${p}-dtype`, root)?.value === 'pct' ? Math.round(a * v) / 100 : v;
}

/** Riga di riepilogo (prezzo, sconto, IVA): vuota se non c'e' nulla da spiegare. Stessa formula del server (officina/iva.mjs). */
export function priceNote(amount, mode, rate, disc = 0) {
  const a = Number(String(amount ?? '').replace(',', '.'));
  if (!String(amount ?? '').trim() || !Number.isFinite(a) || a < 0) return '';
  const d = Math.min(Math.max(0, Number(disc) || 0), a);
  if (mode !== 'net' && !(d > 0)) return '';
  const base = a - d;
  const r = Number(rate) || 0;
  const parts = [];
  if (d > 0) parts.push(`Prezzo ${eur(a)} − sconto ${eur(d)} = ${eur(base)}`);
  if (mode === 'net') { const gross = Math.round(base * (1 + r / 100) * 100) / 100; parts.push(`Imponibile ${eur(base)} + IVA ${r}% ${eur(gross - base)} = ${eur(gross)} IVA inclusa`); }
  return parts.join(' · ');
}

/** Collega campo importo + menu IVA (+ sconto, se c'e') a una riga di riepilogo. `disc` = prefisso id del campo sconto. */
export function bindPriceNote(root, amountSel, modeSel, noteSel, rate, disc = null) {
  const upd = () => {
    const n = $(noteSel, root);
    if (!n) return;
    const amt = $(amountSel, root).value;
    n.textContent = priceNote(amt, $(modeSel, root).value, typeof rate === 'function' ? rate() : rate, disc ? discountEuro(root, disc, amt) : 0);
  };
  const sels = [amountSel, modeSel, ...(disc ? [`#${disc}-disc`, `#${disc}-dtype`] : [])];
  for (const sel of sels) $(sel, root)?.addEventListener('input', upd);
  upd();
  return upd;
}

// ---------- Prezzo di vendita / costo: campo gemello "senza IVA" ----------
/** Aggiunge sotto il campo `sel` un campo gemello: si scrive in uno e l'altro si calcola (aliquota dalle Impostazioni).
 *  dir 'toNet' (prezzo di vendita, scritto IVA inclusa): il gemello e' "senza IVA". dir 'toGross' (costo, salvato senza IVA): il gemello e' "con IVA". */
export function bindNetTwin(root, sel, label = 'Senza IVA €', dir = 'toNet') {
  const main = $(sel, root);
  if (!main) return;
  const f = main.closest('.field');
  const id = `${main.id}-net`;
  const twin = document.createElement('div');
  twin.className = 'field';
  twin.innerHTML = `<label class="l" for="${id}">${esc(label)}</label><input id="${id}" inputmode="decimal" placeholder="${dir === 'toGross' ? 'con IVA' : 'senza IVA'}" /><span class="hint" id="${id}-h"></span>`;
  f.after(twin);
  const other = $(`#${id}`, root), hint = $(`#${id}-h`, root);
  const num = (v) => { const n = Number(String(v).replace(',', '.')); return String(v).trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null; };
  const k = () => 1 + defaultRate / 100;
  const to = dir === 'toGross' ? (v) => v * k() : (v) => v / k();
  const back = dir === 'toGross' ? (v) => v / k() : (v) => v * k();
  const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const show = () => { hint.textContent = `IVA ${defaultRate}%: scrivi uno dei due prezzi, l’altro si calcola.`; };
  let typing = false; // mentre si scrive nel gemello non si riscrive il gemello stesso
  const fromMain = () => { if (typing) return; const g = num(main.value); other.value = g == null ? '' : fmt(to(g)); };
  main.addEventListener('input', fromMain);
  other.addEventListener('input', () => { const n = num(other.value); main.value = n == null ? '' : fmt(back(n)); typing = true; main.dispatchEvent(new Event('input')); typing = false; });
  ensureVatDefault().then(() => { show(); if (num(main.value) != null) fromMain(); });
  show();
  if (num(main.value) != null) fromMain();
  return twin;
}

/** Guadagno di un articolo: costo salvato senza IVA, prezzo di vendita IVA inclusa (si toglie l'IVA prima di confrontarli). */
export function marginOf(cost, price, rate = defaultRate) {
  const c = Number(String(cost ?? '').replace(',', '.')), p = Number(String(price ?? '').replace(',', '.'));
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0 || c <= 0) return null;
  const net = p / (1 + rate / 100), gain = net - c;
  return { gain, pct: (gain / net) * 100, markup: (gain / c) * 100, net };
}

/** Riga "Guadagno" sotto il prezzo: si aggiorna mentre si scrive. */
export function bindMargin(root, costSel, priceSel, afterEl) {
  const costEl = $(costSel, root), priceEl = $(priceSel, root);
  if (!costEl || !priceEl || !afterEl) return;
  const row = document.createElement('div');
  row.className = 'field span2';
  row.innerHTML = '<span class="l">Guadagno</span><p class="hint" id="pf-margin" aria-live="polite" style="margin:0"></p>';
  afterEl.after(row);
  const out = $('#pf-margin', row);
  const upd = () => {
    const m = marginOf(costEl.value, priceEl.value);
    out.innerHTML = m ? `<b style="color:${m.gain < 0 ? '#B91C1C' : '#047857'}">${eur(m.gain)}</b> a pezzo (IVA esclusa) · margine <b>${m.pct.toFixed(1).replace('.', ',')}%</b> sul prezzo · ricarico ${m.markup.toFixed(1).replace('.', ',')}% sul costo` : 'Scrivi costo e prezzo di vendita per vedere il guadagno.';
  };
  costEl.addEventListener('input', upd); priceEl.addEventListener('input', upd);
  ensureVatDefault().then(upd);
  upd();
}
