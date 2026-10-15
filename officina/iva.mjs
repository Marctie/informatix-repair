// IVA sugli acquisti e sui ricambi: dal prezzo scritto (IVA esclusa o inclusa) si ricavano sempre imponibile, IVA e totale.
// Il flag "applica" dice se l'IVA e' davvero un costo (acquisto estero, reverse charge, IVA non detraibile): in quel caso
// il costo registrato e' IVA compresa; altrimenti e' l'imponibile. Nulla e' nascosto: tutti e tre i valori restano salvati.
import { HttpError } from './logic.mjs';

const r4 = (n) => Math.round(n * 10000) / 10000;

/** Aliquota valida (0-100); vuota => predefinita. */
export function parseRate(v, def = 22) {
  if (v === '' || v == null) return def;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, 'Aliquota IVA non valida (0-100)');
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
  if (!Number.isFinite(a) || a < 0) throw new HttpError(400, 'Importo non valido');
  if (!['net', 'gross'].includes(mode)) throw new HttpError(400, 'Modalità prezzo non valida (net o gross)');
  const k = 1 + rate / 100;
  const net = mode === 'gross' ? a / k : a;
  const gross = mode === 'gross' ? a : a * k;
  const applied = !!apply;
  return { net: r4(net), vat: r4(gross - net), gross: r4(gross), rate, applied, cost: r4(applied ? gross : net), mode };
}

export const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
