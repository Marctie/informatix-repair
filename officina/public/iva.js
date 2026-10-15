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
