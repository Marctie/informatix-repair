// Inserimento retroattivo: campo "data dell'operazione" da aggiungere ai moduli (vendita, nuova riparazione, acconto, consegna).
// Vuoto = adesso. Con una data passata il server registra l'operazione in quel giorno (i report la rispettano) e la segna nel Registro.
import { $, today, canSeeCosts } from './util.js';

/** Blocco HTML ripiegabile; `id` = id dell'input data. Vuoto per il ruolo Cassa (non puo' farlo). */
export function retroField(id) {
  if (!canSeeCosts()) return '';
  return `<details class="retro" style="margin-top:.5rem"><summary class="hint" style="cursor:pointer">📅 Operazione di un giorno passato?</summary>
    <div class="field" style="margin-top:.4rem"><label class="l" for="${id}">Data dell’operazione</label><input type="date" id="${id}" max="${today()}" />
    <span class="hint">Lascia vuoto per registrarla adesso. Con una data passata finisce nei conti di quel giorno e resta scritta nel Registro.</span></div></details>`;
}

/** { entry_date } se compilato e diverso da oggi, altrimenti {}. */
export function retroVal(root, id) {
  const el = $(`#${id}`, root);
  const v = el?.value;
  return v && v < today() ? { entry_date: v } : {};
}
