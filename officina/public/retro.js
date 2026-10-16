// Inserimento retroattivo: campo "data dell'operazione" da aggiungere ai moduli (vendita, nuova riparazione, acconto, consegna).
// Vuoto = adesso. Con una data passata il server registra l'operazione in quel giorno (i report la rispettano) e la segna nel Registro.
import { $, $$, today, canSeeCosts } from './util.js';

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

// ---- Data di inserimento della riparazione: sempre visibile, automatica (adesso) oppure manuale (data + ora) ----
const pad = (n) => String(n).padStart(2, '0');
const fmtInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const nowInput = () => fmtInput(new Date());
/** Il ruolo Cassa puo' risalire al massimo a questi giorni (coerente con CASSA_MAX_DAYS del server). */
const CASSA_DAYS = 7;

/** Campo "Data di inserimento": predefinito "Automatica (adesso)"; togliendo la spunta compare data+ora (mai nel futuro). */
export function entryDateField(id) {
  const cassa = !canSeeCosts();
  const min = cassa ? ` min="${fmtInput(new Date(new Date().setHours(0, 0, 0, 0) - CASSA_DAYS * 86400000))}"` : '';
  return `<div class="field entry-date">
    <label class="l" for="${id}-auto">Data di inserimento</label>
    <div class="row" style="align-items:center">
      <label class="check box"><input type="checkbox" id="${id}-auto" checked /> Automatica (adesso)</label>
      <input type="datetime-local" id="${id}" max="${nowInput()}"${min} style="width:auto;display:none" aria-label="Data e ora di inserimento" />
    </div>
    <span class="hint">Predefinita: data e ora di adesso. Togli la spunta per indicare un altro momento${cassa ? ` (fino a ${CASSA_DAYS} giorni indietro)` : ''}: finisce nei conti di quel giorno e resta scritta nel Registro.</span>
  </div>`;
}

/** Collega l'interruttore automatico/manuale (da chiamare dopo aver messo il campo nel DOM). */
export function entryDateInit(root, id) {
  const auto = $(`#${id}-auto`, root), inp = $(`#${id}`, root);
  if (!auto || !inp) return;
  auto.onchange = () => {
    inp.style.display = auto.checked ? 'none' : '';
    if (auto.checked) inp.value = '';
    else { inp.max = nowInput(); if (!inp.value) inp.value = nowInput(); }
  };
}

/** { entry_date: 'AAAA-MM-GG HH:MM' } se manuale, altrimenti {}. Lancia un Error parlante se manca o e' nel futuro. */
export function entryDateVal(root, id) {
  const auto = $(`#${id}-auto`, root), inp = $(`#${id}`, root);
  if (!inp || !auto || auto.checked) return {};
  const v = inp.value;
  if (!v) throw new Error('Data di inserimento manuale: scegli giorno e ora, oppure rimetti «Automatica (adesso)».');
  if (v > nowInput()) throw new Error('La data di inserimento non può essere nel futuro: scegli adesso o un momento già passato.');
  return { entry_date: v.replace('T', ' ') };
}
/**
 * Prima di ridisegnare un contenitore: salva la data (e se il riquadro era aperto) di ogni campo "giorno passato".
 * Ritorna la funzione che le rimette a posto dopo il ridisegno (se il campo non c'e' piu' non fa nulla).
 */
export function keepRetro(root) {
  const saved = $$('details.retro', root).map((d) => ({ id: d.querySelector('input[type=date]')?.id, value: d.querySelector('input[type=date]')?.value || '', open: d.open }));
  return () => {
    for (const s of saved) {
      if (!s.id || (!s.value && !s.open)) continue;
      const input = $(`#${s.id}`, root);
      if (!input) continue;
      if (s.value) input.value = s.value;
      input.closest('details')?.setAttribute('open', '');
    }
  };
}
