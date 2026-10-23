// IVA sugli acquisti e sui ricambi: dal prezzo scritto (IVA esclusa o inclusa) si ricavano sempre imponibile, IVA e totale.
// Il flag "applica" dice se l'IVA e' davvero un costo (acquisto estero, reverse charge, IVA non detraibile): in quel caso
// il costo registrato e' IVA compresa; altrimenti e' l'imponibile. Nulla e' nascosto: tutti e tre i valori restano salvati.
import { HttpError } from './logic.mjs';

const r4 = (n) => Math.round(n * 10000) / 10000;

/** Aliquota valida (0-100); vuota => predefinita. */
export function parseRate(v, def = 22) {
  if (v === '' || v == null) return def;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, 'L’aliquota IVA indicata non è valida: deve essere un numero tra 0 e 100.', { code: 'IVA_NON_VALIDA', hint: 'Scrivi l’aliquota in percentuale (es. 22).' });
  return n;
}

/**
 * @param amount prezzo unitario scritto dall'utente
 * @param mode   'net' (IVA esclusa, predefinito) | 'gross' (IVA inclusa)
 * @param rate   aliquota percentuale
 * @param apply  true = l'IVA e' un costo reale e va aggiunta al costo
 * @returns {{net, vat, gross, rate, applied, cost, mode}}  tutti per unita'; `cost` = quanto si registra come costo
 */
export function computeVat({ amount, mode = 'net', rate = 22, apply = false }) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a < 0) throw new HttpError(400, 'Calcolo IVA non eseguito: l’importo non è valido (non numerico o negativo).', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi un importo in euro (es. 100,00).' });
  if (!['net', 'gross'].includes(mode)) throw new HttpError(400, 'Calcolo IVA non eseguito: la modalità del prezzo non è valida.', { code: 'MODALITA_PREZZO_NON_VALIDA', hint: 'Scegli “IVA esclusa” oppure “IVA inclusa”.' });
  const k = 1 + rate / 100;
  const net = mode === 'gross' ? a / k : a;
  const gross = mode === 'gross' ? a : a * k;
  const applied = !!apply;
  return { net: r4(net), vat: r4(gross - net), gross: r4(gross), rate, applied, cost: r4(applied ? gross : net), mode };
}

export const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';

// ---------- Preventivi: prezzi scritti IVA inclusa ('gross', come sempre) o IVA esclusa ('net') ----------
// Quanto paga il cliente resta SEMPRE un importo IVA compresa (quote / amount / total): incassi, acconti e saldi non cambiano.
// Con 'net' Christian scrive l'imponibile e l'IVA si somma nel totale; l'imponibile scritto si conserva per mostrarlo uguale.
const r2 = (n) => Math.round(n * 100) / 100;

export function parseMode(v, def = 'gross') {
  if (v === undefined || v === null || v === '') return def;
  if (v !== 'gross' && v !== 'net') throw new HttpError(400, 'Modalità del prezzo non valida: scegli “IVA esclusa” oppure “IVA inclusa”.', { code: 'MODALITA_PREZZO_NON_VALIDA', hint: 'Scegli “IVA esclusa” oppure “IVA inclusa”.' });
  return v;
}

/** Totali di un preventivo con più voci: `subtotal` e `discount` sono nella modalita' scelta (lo sconto si toglie prima dell'IVA). */
export function quoteTotals({ subtotal, discount = 0, mode = 'gross', rate = 22 }) {
  const base = Math.max(0, subtotal - discount);
  if (mode === 'net') {
    const net = r2(base);
    const vat = r2(net * rate / 100);
    return { mode, rate, net, vat, total: r2(net + vat) };
  }
  const total = r2(base);
  const net = r2(total / (1 + rate / 100));
  return { mode, rate, net, vat: r2(total - net), total };
}

/** Importo singolo (preventivo della riparazione, soluzione alternativa): da cio' che e' scritto ricava il totale da pagare. */
export function priceFrom({ amount, mode = 'gross', rate = 22 }) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a < 0) throw new HttpError(400, 'Importo non valido: scrivi un numero uguale o maggiore di zero.', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi l’importo in euro (es. 100,00).' });
  if (mode === 'net') { const net = r2(a); const gross = r2(net * (1 + rate / 100)); return { mode, rate, gross, net, vat: r2(gross - net) }; }
  const gross = r2(a);
  const net = r2(gross / (1 + rate / 100));
  return { mode, rate, gross, net: null, vat: r2(gross - net) };
}

/** Per mostrare: imponibile, IVA e totale di un importo salvato (net = imponibile scritto, se c'e'). */
export function showPrice(gross, net, rate, mode) {
  if (gross == null) return null;
  const n = mode === 'net' && net != null ? net : r2(gross / (1 + rate / 100));
  return { mode, rate, net: n, vat: r2(gross - n), total: gross };
}

/** Soluzione alternativa del preventivo con imponibile, IVA e totale (amount e' sempre IVA compresa). */
export function optionView(o) {
  const rate = o.vat_rate ?? 22;
  const mode = o.amount_net != null ? 'net' : 'gross';
  const v = showPrice(o.amount, o.amount_net, rate, mode);
  return { ...o, mode, vat_rate: rate, net: v.net, vat: v.vat };
}
