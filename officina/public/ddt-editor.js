// Anteprima MODIFICABILE dei DDT / fatture in PDF: l'utente corregge fornitore, numero, data e righe prima di confermare.
// (l'abbinamento ai prodotti e il carico di magazzino sono quelli di sempre, in purchases.js)
import { $, $$, esc, api, safe, toast, confirmDelete, fdate } from './util.js';
import { extractPdfText } from './pdftext.js';

export const isPdf = (f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';

/** Legge il PDF nel browser e ne chiede l'anteprima al server. Ritorna { pdf_text, pv }. */
export async function previewPdf(file) {
  const pdf_text = await extractPdfText(file);
  const pv = await api('POST', '/api/purchases/preview', { pdf_text, filename: file.name });
  return { pdf_text, pv };
}

const CSS = `<style>
.dd-wrap{display:grid;gap:.75rem}.dd-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}
@media(min-width:768px){.dd-row.c4{grid-template-columns:repeat(4,minmax(0,1fr))}}
.dd-lines{display:grid;gap:.5rem}.dd-line{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.4rem;padding:.6rem;border:1px solid var(--line,#e5e7eb);border-radius:.6rem;background:#fff}
.dd-line.warn{border-color:#F59E0B;background:#FFFBEB}.dd-line .wide{grid-column:1/-1}.dd-line .xs{grid-column:span 3}
@media(min-width:768px){.dd-line{grid-template-columns:7rem minmax(0,1fr) 5rem 4rem 6rem 4.5rem auto;align-items:end}.dd-line .wide{grid-column:auto}.dd-line .xs{grid-column:auto}}
.dd-line label{font-size:.72rem;font-weight:600;color:var(--muted,#6b7280);display:block;margin-bottom:.15rem}
.dd-iss{grid-column:1/-1;font-size:.78rem;color:#92400E}
</style>`;

const field = (label, id, value, extra = '') => `<div class="field"><label class="l" for="${id}">${label}</label><input id="${id}" value="${esc(value ?? '')}" ${extra} /></div>`;

/** HTML dell'editor. `parsed` = { supplier, doc, lines[], meta }. */
export function editorHtml(parsed) {
  const s = parsed.supplier; const d = parsed.doc;
  const learned = parsed.meta?.learned ? `<div class="pu-box ok">✔ Formato di questo fornitore già imparato: ${parsed.meta.learned_lines} righe lette con le colonne che avevi corretto.</div>` : '';
  return `${CSS}<section class="card panel sec" id="dd-editor"><h2 class="sec-t">Documento letto dal PDF · controlla e correggi</h2>
    <p class="hint">Ho letto il testo del PDF con delle regole: <b>controlla ogni campo</b> prima di confermare. Quello che correggi viene ricordato per questo fornitore.</p>${learned}
    <div class="dd-wrap">
      <div class="dd-row c4">${field('Fornitore', 'dd-sname', s.name, 'data-dd="s.name"')}${field('Partita IVA', 'dd-svat', s.vat, 'data-dd="s.vat" inputmode="numeric"')}
        <div class="field"><label class="l" for="dd-type">Tipo</label><select id="dd-type" data-dd="d.type"><option value="DDT" ${d.type === 'DDT' ? 'selected' : ''}>DDT (documento di trasporto)</option><option value="TD01" ${d.type === 'TD01' ? 'selected' : ''}>Fattura</option><option value="TD04" ${d.type === 'TD04' ? 'selected' : ''}>Nota di credito</option></select></div>
        ${field('Numero', 'dd-num', d.number, 'data-dd="d.number"')}</div>
      <div class="dd-row c4"><div class="field"><label class="l" for="dd-date">Data</label><input id="dd-date" type="date" value="${esc(d.date || '')}" data-dd="d.date" /></div>
        ${field('Totale documento €', 'dd-tot', d.total ?? '', 'data-dd="d.total" inputmode="decimal"')}</div>
      <div class="dd-lines" id="dd-lines">${parsed.lines.map(lineHtml).join('')}</div>
      <div class="row tight"><button class="btn btn-outline btn-sm" type="button" data-dd-add>＋ Aggiungi una riga</button><button class="btn btn-dark" type="button" data-dd-recalc>↻ Applica le correzioni e ricalcola</button></div>
    </div></section>`;
}
const lineHtml = (l, i) => `<div class="dd-line ${(l.issues && l.issues.length) || (l.confidence != null && l.confidence < 0.6) ? 'warn' : ''}" data-i="${i}">
  <div><label for="dd-c${i}">Codice</label><input id="dd-c${i}" data-dl="code" value="${esc(l.code ?? '')}" /></div>
  <div class="xs"><label for="dd-d${i}">Descrizione</label><input id="dd-d${i}" data-dl="description" value="${esc(l.description ?? '')}" /></div>
  <div><label for="dd-q${i}">Quantità</label><input id="dd-q${i}" data-dl="qty" inputmode="decimal" value="${esc(l.qty ?? '')}" /></div>
  <div><label for="dd-u${i}">UM</label><input id="dd-u${i}" data-dl="unit" value="${esc(l.unit ?? '')}" /></div>
  <div><label for="dd-p${i}">Prezzo acq. €</label><input id="dd-p${i}" data-dl="unit_price" inputmode="decimal" value="${esc(l.unit_price ?? '')}" /></div>
  <div><label for="dd-v${i}">IVA %</label><input id="dd-v${i}" data-dl="vat_rate" inputmode="decimal" value="${esc(l.vat_rate ?? 22)}" /></div>
  <div><button class="btn btn-ghost btn-icon" type="button" data-dd-del="${i}" aria-label="Togli la riga ${i + 1}">✕</button></div>
  ${l.issues && l.issues.length ? `<div class="dd-iss">⚠ ${esc(l.issues.join(' · '))}</div>` : ''}</div>`;

/** Collega i campi a `parsed` (modificato sul posto). `onRecalc` si chiama quando l'utente chiede di ricalcolare. */
export function bindEditor(root, parsed, { onRecalc, onChange } = {}) {
  const ed = $('#dd-editor', root);
  if (!ed) return;
  const set = (path, v) => { const [o, k] = path.split('.'); (o === 's' ? parsed.supplier : parsed.doc)[k] = v; };
  ed.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.dd) set(t.dataset.dd, t.value);
    else if (t.dataset.dl) { const i = Number(t.closest('.dd-line').dataset.i); parsed.lines[i][t.dataset.dl] = t.value; }
    onChange?.();
  });
  ed.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-dd-del]');
    if (del) { parsed.lines.splice(Number(del.dataset.ddDel), 1); $('#dd-lines', ed).innerHTML = parsed.lines.map(lineHtml).join(''); onChange?.(); return; }
    if (e.target.closest('[data-dd-add]')) { parsed.lines.push({ code: '', description: '', qty: 1, unit: '', unit_price: 0, vat_rate: 22, raw_cells: null, raw_n: null }); $('#dd-lines', ed).innerHTML = parsed.lines.map(lineHtml).join(''); onChange?.(); return; }
    if (e.target.closest('[data-dd-recalc]')) onRecalc?.();
  });
}

/** Riquadro "Formati imparati" (uno per fornitore): si possono dimenticare se un formato impara male. */
export async function formatsBox(host) {
  const list = await safe(() => api('GET', '/api/purchases/formats'));
  if (!list || !host) return;
  host.innerHTML = list.length ? `<section class="card panel sec"><h2 class="sec-t">Formati PDF imparati (${list.length})</h2>
    <p class="hint">Per ogni fornitore ricordo quali colonne contengono codice, descrizione, quantità e prezzo, dalle tue correzioni. Se un formato sbaglia, dimenticalo: la volta dopo si riparte dalle regole generali.</p>
    <div class="plist">${list.map((f) => `<div><span>${esc(f.label || f.supplier_key)} <span class="hint">· ${f.uses} ${f.uses === 1 ? 'uso' : 'usi'} · ${f.layouts} ${f.layouts === 1 ? 'impaginazione' : 'impaginazioni'} · ${fdate(f.updated_at.slice(0, 10))}</span></span><button class="btn btn-ghost btn-sm" data-fdel="${f.id}">Dimentica</button></div>`).join('')}</div></section>` : '';
  host.onclick = async (e) => {
    const b = e.target.closest('[data-fdel]');
    if (!b || !(await confirmDelete('questo formato imparato', { verb: 'Dimenticare', detail: 'Non cambia nulla nei documenti già importati.' }))) return;
    if (await safe(() => api('DELETE', `/api/purchases/formats/${b.dataset.fdel}`))) { toast('Formato dimenticato'); formatsBox(host); }
  };
}
