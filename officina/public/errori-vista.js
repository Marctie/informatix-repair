// Vista admin "Errori": legge GET /api/errors (registro error_log, 90 giorni). Sola lettura, solo amministratore.
import { $, esc, api, safe, debounce, fdt } from './util.js';
import { describeErrorRow, errorsQuery, SEVERITY_LABEL } from './errori.js';

const SEV_CLS = { info: 'bg-blue-100 text-blue-700', security: 'bg-amber-100 text-amber-800', error: 'bg-red-100 text-red-700' };

export async function erroriView(el) {
  el.innerHTML = `
    <div class="page-head"><h1 class="font-heading font-extrabold text-2xl">Errori</h1></div>
    <p class="hint" style="margin-bottom:var(--s3,12px)">Cosa non ha funzionato, chi lo stava facendo e perché. Le righe uguali ravvicinate sono raggruppate (vedi “ripetuto”). Si cancellano da sole dopo 90 giorni. Cerca anche per codice (es. E-7K3QX).</p>
    <div class="fgrid c3">
      <div class="field"><label class="l" for="er-sev">Gravità</label><select id="er-sev"><option value="">Tutte</option>${Object.entries(SEVERITY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label class="l" for="er-user">Utente</label><select id="er-user"><option value="">Tutti</option></select></div>
      <div class="field"><label class="l" for="er-status">Stato (es. 400, 500)</label><input id="er-status" inputmode="numeric" maxlength="3" placeholder="Tutti" /></div>
      <div class="field"><label class="l" for="er-from">Dal</label><input id="er-from" type="date" /></div>
      <div class="field"><label class="l" for="er-to">Al</label><input id="er-to" type="date" /></div>
      <div class="field"><label class="l" for="er-q">Cerca</label><input id="er-q" placeholder="Testo o codice E-XXXXX…" /></div>
    </div>
    <div class="row tight" id="er-sum" style="margin:var(--s3,12px) 0;gap:.5rem;flex-wrap:wrap"></div>
    <div class="card overflow-hidden" id="er-list"></div>
    <div class="row" id="er-pager" style="justify-content:space-between;align-items:center;margin-top:var(--s3,12px)"></div>`;
  let page = 1;
  const list = $('#er-list', el);
  const val = (id) => $(`#${id}`, el).value;
  async function load() {
    const q = errorsQuery({ severity: val('er-sev'), user: val('er-user'), status: val('er-status'), from: val('er-from'), to: val('er-to'), q: val('er-q') }, page);
    const d = await safe(() => api('GET', `/api/errors?${q}`));
    if (!d) { list.innerHTML = '<p class="empty">Non riesco a leggere il registro in questo momento. Riprova tra poco.</p>'; return; }
    const sel = $('#er-user', el);
    if (sel.options.length <= 1) sel.insertAdjacentHTML('beforeend', (d.users || []).map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join(''));
    $('#er-sum', el).innerHTML = Object.entries(SEVERITY_LABEL).map(([k, v]) => `<span class="badge ${SEV_CLS[k]}">${v}: ${d.by_severity?.[k] || 0}</span>`).join('');
    list.innerHTML = d.rows.map((r) => {
      const x = describeErrorRow(r);
      return `<div class="px-4 py-3 border-b border-line last:border-0 text-sm">
        <div class="row tight" style="align-items:center;gap:.5rem;flex-wrap:wrap">
          <span class="badge ${SEV_CLS[x.severity]}">${x.severityLabel}</span>
          <b>${esc(x.doing)}</b>
          ${x.repeats > 1 ? `<span class="badge bg-gray-100 text-gray-700">ripetuto ${esc(x.repeatsLabel)}</span>` : ''}
          ${x.ref ? `<span class="hint" style="margin-left:auto">${esc(x.ref)}</span>` : ''}
        </div>
        <p class="hint" style="margin:.2rem 0 0">${esc(fdt(x.when))}${x.first ? ` (primo: ${esc(fdt(x.first))})` : ''} · ${esc(x.who)}${x.entity ? ` · su ${esc(x.entity)}` : ''}${x.status ? ` · stato ${x.status}` : ''}</p>
        <p style="margin:.35rem 0 0"><b>Motivo:</b> ${esc(x.reason)}</p>
        ${x.hint ? `<p style="margin:.15rem 0 0"><b>Cosa fare:</b> ${esc(x.hint)}</p>` : ''}</div>`;
    }).join('') || '<p class="empty">Nessun errore registrato con questi filtri. Va tutto bene.</p>';
    $('#er-pager', el).innerHTML = `<span class="hint">${d.total} ${d.total === 1 ? 'riga' : 'righe'} · pagina ${d.page} di ${d.pages}</span>
      <span class="row tight"><button class="btn btn-outline btn-sm" id="er-prev" ${d.page <= 1 ? 'disabled' : ''}>← Precedenti</button><button class="btn btn-outline btn-sm" id="er-next" ${d.page >= d.pages ? 'disabled' : ''}>Successive →</button></span>`;
    $('#er-prev', el).onclick = () => { page = d.page - 1; load(); };
    $('#er-next', el).onclick = () => { page = d.page + 1; load(); };
  }
  const reload = () => { page = 1; load(); };
  for (const id of ['er-sev', 'er-user', 'er-from', 'er-to']) $(`#${id}`, el).onchange = reload;
  $('#er-status', el).oninput = debounce(reload);
  $('#er-q', el).oninput = debounce(reload);
  await load();
}
