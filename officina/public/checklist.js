// Checklist di controllo (ingresso, ritiro, collaudo): riquadri a 3 stati, compilabili da tablet, PC o telefono.
// Un tocco cambia lo stato: vuoto -> funziona -> NON funziona -> non presente -> vuoto.
import { $, $$, esc, api, safe, toast, fdt, META } from './util.js';

const NEXT = { '': 'ok', ok: 'ko', ko: 'na', na: '' };
const MARK = { '': '', ok: '✔', ko: '✖', na: '–' };
const WORD = { '': 'da controllare', ok: 'funziona', ko: 'NON funziona', na: 'non presente' };

/** Elenco di voci -> [{l, s}] (stato vuoto), oppure riusa un controllo già compilato mantenendo le sue etichette. */
export function toItems(labels, saved) {
  if (saved?.items?.length) return saved.items.map((i) => ({ l: i.l, s: i.s || '' }));
  return (labels || []).map((l) => ({ l, s: '' }));
}

export const checklistLegend = () =>
  '<p class="hint">Tocca una voce per cambiarla: <b>✔</b> funziona · <b>✖</b> non funziona · <b>–</b> non presente · vuota = non controllata.</p>';

export function checklistGrid(items, { disabled = false, id = '' } = {}) {
  if (!items.length) return '<p class="hint">Nessuna voce: aggiungile da Impostazioni → Checklist per tipo di dispositivo.</p>';
  return `<div class="ckgrid" ${id ? `id="${id}"` : ''}>${items.map((i) => `<button type="button" class="ckb" data-s="${i.s || ''}" data-l="${esc(i.l)}" ${disabled ? 'disabled' : ''} aria-label="${esc(i.l)}: ${WORD[i.s || '']}"><span class="ckm" aria-hidden="true">${MARK[i.s || '']}</span><span>${esc(i.l)}</span></button>`).join('')}</div>`;
}

/** Collega i tocchi di una griglia; onChange riceve gli stati aggiornati. */
export function bindChecklist(grid, onChange) {
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.ckb');
    if (!b || b.disabled) return;
    const s = NEXT[b.dataset.s || ''];
    b.dataset.s = s;
    $('.ckm', b).textContent = MARK[s];
    b.setAttribute('aria-label', `${b.dataset.l}: ${WORD[s]}`);
    onChange?.(readChecklist(grid));
  });
}

export const readChecklist = (grid) => $$('.ckb', grid).map((b) => ({ l: b.dataset.l, s: b.dataset.s || null }));
export const hasAny = (items) => items.some((i) => i.s);

/** Sezione completa dentro il dettaglio riparazione: tre controlli con salvataggio. */
export function checklistSections(r, templates, disabled = false) {
  const tpl = templates[r.device_type] || templates.altro || { in: [], pre: [], out: [] };
  return ['in', 'pre', 'out'].map((p) => {
    const saved = r[`checklist_${p}`];
    const items = toItems(tpl[p], saved);
    return `<section class="sec" data-ck="${p}">
      <h3 class="sec-t">${esc(META.phases?.[p] || p)}</h3>
      <p class="sec-sub">${saved ? `Salvato da ${esc(saved.by)} il ${esc(fdt(saved.at))}.` : 'Non ancora compilato. Resta salvato nella riparazione: non serve stamparlo.'}</p>
      ${checklistGrid(items, { disabled })}
      ${disabled ? '' : `<div class="row tight"><button class="btn btn-outline btn-sm" data-ck-save="${p}">Salva ${p === 'out' ? 'collaudo' : 'controllo'}</button><button class="btn btn-ghost btn-sm" data-ck-ok="${p}">Segna tutto ✔</button></div>`}
    </section>`;
  }).join('');
}

/** Da chiamare dopo ogni disegno della scheda: collega i tocchi delle griglie appena create. */
export function bindChecklistGrids(root) {
  $$('[data-ck] .ckgrid', root).forEach((g) => bindChecklist(g));
}

/** Pulsanti Salva / Segna tutto delle sezioni (da chiamare dal click della scheda). Ritorna true se il click era suo. */
export async function checklistClick(e, root, repairId, reload) {
  const ok = e.target.closest('[data-ck-ok]');
  if (ok) { $$(`[data-ck="${ok.dataset.ckOk}"] .ckb`, root).forEach((b) => { b.dataset.s = 'ok'; $('.ckm', b).textContent = MARK.ok; }); return true; }
  const sv = e.target.closest('[data-ck-save]');
  if (!sv) return false;
  const p = sv.dataset.ckSave;
  const items = readChecklist($(`[data-ck="${p}"] .ckgrid`, root));
  if (await safe(() => api('PUT', `/api/repairs/${repairId}/checklist`, { phase: p, items }))) { toast('Controllo salvato'); reload?.(); }
  return true;
}
