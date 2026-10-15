// Documenti d'identita' del cliente (dati sensibili cifrati, accesso solo admin o ruoli abilitati, ogni accesso registrato).
import { $, esc, fdate, fdt, api, toast, safe, openModal, confirmDelete } from './util.js';

const MAX_SIDE = 1600; // lato massimo della foto: resta ben leggibile e sotto 1 MB
const MAX_BYTES = 1_000_000;

/** Foto ridimensionata nel browser (JPEG) oppure PDF cosi' com'e': ritorna { mime, data_b64 }. */
async function prepareFile(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('PDF troppo grande (massimo 1 MB): usa una foto.');
    return { mime: file.type, data_b64: await toB64(file) };
  }
  if (!file.type.startsWith('image/')) throw new Error('Scegli una foto o un PDF.');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.85;
  let blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
  while (blob.size > MAX_BYTES && q > 0.4) { q -= 0.15; blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q)); }
  if (blob.size > MAX_BYTES) throw new Error('Foto troppo grande: riprova più vicino o con meno risoluzione.');
  return { mime: 'image/jpeg', data_b64: await toB64(blob) };
}
const toB64 = (blob) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.onerror = rej; f.readAsDataURL(blob); });

// Bozza dell'informativa (docs/TESTI-LEGALI-BOZZE.md, testo E): DA FAR VERIFICARE prima dell'uso reale
const PRIVACY_DRAFT = `Informatix Repair, titolare del trattamento, conserva copia del tuo documento d’identità per [finalità: identificazione di chi cede o vende dispositivi usati, adempimenti di legge, tutela in caso di denuncia o querela]. Il documento è conservato in archivio riservato e cifrato, accessibile solo al titolare, per [periodo di conservazione], e non viene ceduto a terzi se non per obbligo di legge o su richiesta dell’autorità. Hai diritto di accesso, rettifica e cancellazione nei limiti di legge, scrivendo a [contatto].`;

export async function openDocuments(customer, done) {
  const cfg = await safe(() => api('GET', '/api/documenti/config'));
  if (!cfg) return;
  if (!cfg.allowed) { openModal('<p class="sec">Non hai il permesso di vedere i documenti d’identità. Chiedi all’amministratore.</p>', { title: 'Documenti d’identità' }); return; }
  const m = openModal('<div id="dc-body" class="sec"></div>', { title: `Documenti · ${customer.name}`, wide: true });
  const body = $('#dc-body', m.el);

  async function load() {
    const rows = await safe(() => api('GET', `/api/clienti/${customer.id}/documenti`));
    if (!rows || !body.isConnected) return;
    body.innerHTML = `
      ${cfg.vault_ready ? '' : '<div class="total-box" style="background:#FEF2F2;border:1px solid #FECACA"><span>⚠ La cassaforte non è configurata (manca la chiave VAULT_KEY): non si possono salvare documenti. Vedi il manuale.</span></div>'}
      <p class="hint">Dati e foto sono conservati <b>cifrati</b>; ogni apertura viene registrata (chi e quando). Chiedi il documento solo quando serve (acquisto di usati, ritiro): non per una semplice riparazione.</p>
      <div class="plist">${rows.map((d) => `<div class="row-h" style="cursor:pointer" data-id="${d.id}"><span><b>${esc(d.type_label)}</b><span class="hint" style="display:block">${esc(d.purpose_label || 'Finalità non indicata')} · ${d.files} ${d.files === 1 ? 'file' : 'file'}</span></span><span class="hint">${fdt(d.created_at)}<br>${esc(d.captured_by || '')}</span></div>`).join('') || '<p class="hint">Nessun documento archiviato per questo cliente.</p>'}</div>
      <div class="row tight"><button class="btn btn-primary" id="dc-new" ${cfg.vault_ready ? '' : 'disabled'}>＋ Aggiungi documento</button>${cfg.is_admin ? '<button class="btn btn-outline" id="dc-adm">Permessi e registro accessi</button>' : ''}</div>`;
    $('#dc-new', body).onclick = () => documentForm(customer, cfg, load);
    if (cfg.is_admin) $('#dc-adm', body).onclick = () => adminDialog(cfg);
  }
  body.onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) openDocument(Number(r.dataset.id), cfg, load); };
  await load();
}

async function openDocument(id, cfg, done) {
  const d = await safe(() => api('GET', `/api/documenti/${id}`));
  if (!d) return;
  const x = d.data || {};
  const m = openModal(
    `<section class="sec"><dl class="kv"><dt>Tipo</dt><dd>${esc(d.type_label)}</dd><dt>Intestatario</dt><dd>${esc(x.holder || '—')}</dd><dt>Numero</dt><dd style="font-family:monospace">${esc(x.number || '—')}</dd>
      ${x.birth_date ? `<dt>Nato il</dt><dd>${fdate(x.birth_date)}</dd>` : ''}${x.issuer ? `<dt>Rilasciato da</dt><dd>${esc(x.issuer)}</dd>` : ''}${x.expiry ? `<dt>Scadenza</dt><dd>${fdate(x.expiry)}</dd>` : ''}
      <dt>Finalità</dt><dd>${esc(d.purpose_label || '—')}</dd><dt>Acquisito il</dt><dd>${fdt(d.created_at)} da ${esc(d.captured_by || '')}</dd><dt>Presa visione</dt><dd>${d.consent ? `sì, il ${fdt(d.consent_at)}` : 'no'}</dd>${x.notes ? `<dt>Note</dt><dd>${esc(x.notes)}</dd>` : ''}</dl></section>
    ${d.files.length ? `<section class="sec"><h3 class="sec-t">Immagini</h3><div class="fgrid c2">${d.files.map((f) => `<div class="field"><span class="l">${esc(f.side)}</span>${f.mime === 'application/pdf'
      ? `<a class="btn btn-outline" target="_blank" rel="noopener" href="/api/documenti/files/${f.id}">Apri il PDF</a>`
      : `<a target="_blank" rel="noopener" href="/api/documenti/files/${f.id}"><img src="/api/documenti/files/${f.id}" alt="Documento ${esc(f.side)}" style="max-width:100%;border-radius:.6rem;border:1px solid var(--bd)" /></a>`}</div>`).join('')}</div></section>` : ''}
    ${cfg.is_admin ? '<div class="row tight"><button class="btn btn-ghost btn-sm" id="dd-del">Elimina definitivamente</button></div>' : ''}`,
    { title: d.type_label, wide: true }
  );
  const del = $('#dd-del', m.el);
  if (del) del.onclick = async () => {
    if (!(await confirmDelete(`il documento di ${d.customer_name}`, { typed: 'ELIMINA', detail: 'Dati e immagini vengono cancellati in modo definitivo.' }))) return;
    if (await safe(() => api('DELETE', `/api/documenti/${d.id}?confirm=ELIMINA`))) { m.close(); toast('Documento eliminato'); done?.(); }
  };
}

function documentForm(customer, cfg, done) {
  const opt = (o, cur) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const files = {};
  const m = openModal(
    `<div class="sec">
      <div class="fgrid c2">
        <div class="field"><label class="l" for="dn-type">Tipo di documento</label><select id="dn-type">${opt(cfg.doc_types)}</select></div>
        <div class="field"><label class="l" for="dn-purpose">Perché lo conserviamo</label><select id="dn-purpose"><option value="">—</option>${opt(cfg.purposes, 'acquisto_usato')}</select></div>
        <div class="field"><label class="l" for="dn-holder">Intestatario</label><input id="dn-holder" value="${esc(customer.name)}" /></div>
        <div class="field"><label class="l" for="dn-number">Numero documento</label><input id="dn-number" autocomplete="off" /></div>
        <div class="field"><label class="l" for="dn-expiry">Scadenza</label><input id="dn-expiry" type="date" /></div>
        <div class="field"><label class="l" for="dn-birth">Data di nascita</label><input id="dn-birth" type="date" /></div>
      </div>
      <div class="fgrid c2">
        ${['fronte', 'retro'].map((s) => `<div class="field"><label class="l" for="dn-f-${s}">Foto o PDF · ${s}</label><input id="dn-f-${s}" type="file" accept="image/*,application/pdf" ${s === 'fronte' ? 'capture="environment"' : ''} /><div class="hint" id="dn-p-${s}"></div></div>`).join('')}
      </div>
      <details><summary class="hint" style="cursor:pointer">Più opzioni (ente di rilascio, note)</summary><div class="fgrid c2" style="margin-top:.85rem">
        <div class="field"><label class="l" for="dn-issuer">Rilasciato da</label><input id="dn-issuer" /></div><div class="field"><label class="l" for="dn-notes">Note</label><input id="dn-notes" /></div></div></details>
      <details><summary class="hint" style="cursor:pointer">Informativa privacy (bozza da far verificare)</summary><p class="hint" style="margin-top:.6rem">${esc(PRIVACY_DRAFT)}<br><i>(testo da formalizzare con Christian)</i></p></details>
      <label style="cursor:pointer;display:flex;gap:.6rem;align-items:flex-start"><input type="checkbox" id="dn-consent" style="flex:none;margin-top:.2rem" /> <span>Il cliente ha preso visione dell’informativa e acconsente alla conservazione della copia del documento.</span></label>
    </div>`,
    { title: 'Nuovo documento', footer: '<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary" id="dn-ok">Salva cifrato</button>' }
  );
  for (const s of ['fronte', 'retro']) {
    $(`#dn-f-${s}`, m.el).onchange = async (e) => {
      const f = e.target.files[0];
      const hint = $(`#dn-p-${s}`, m.el);
      delete files[s];
      hint.textContent = '';
      if (!f) return;
      try { files[s] = { side: s, ...(await prepareFile(f)) }; hint.textContent = `✔ ${f.type === 'application/pdf' ? 'PDF' : 'Foto'} pronta (${Math.round(files[s].data_b64.length * 0.75 / 1024)} KB)`; } catch (err) { toast(err.message, false); e.target.value = ''; }
    };
  }
  $('#dn-ok', m.el).onclick = async (ev) => {
    ev.target.disabled = true;
    const out = await safe(() => api('POST', '/api/documenti', {
      customer_id: customer.id, doc_type: $('#dn-type', m.el).value, purpose: $('#dn-purpose', m.el).value, consent: $('#dn-consent', m.el).checked,
      data: { holder: $('#dn-holder', m.el).value, number: $('#dn-number', m.el).value, expiry: $('#dn-expiry', m.el).value, birth_date: $('#dn-birth', m.el).value, issuer: $('#dn-issuer', m.el).value, notes: $('#dn-notes', m.el).value },
      files: Object.values(files),
    }));
    ev.target.disabled = false;
    if (out) { m.close(); toast('Documento salvato (cifrato)'); done?.(); }
  };
}

async function adminDialog(cfg) {
  const log = (await safe(() => api('GET', '/api/accessi?area=documenti'))) || [];
  const m = openModal(
    `<section class="sec"><h3 class="sec-t">Chi può vedere i documenti</h3>
      <p class="hint">Sempre l’amministratore. Per impostazione predefinita nessun altro: puoi abilitare i ruoli qui sotto (solo per chi ne ha davvero bisogno).</p>
      <label class="row tight" style="cursor:pointer"><input type="checkbox" id="da-cassa" ${cfg.roles.includes('cassa') ? 'checked' : ''} /> Cassa</label>
      <label class="row tight" style="cursor:pointer"><input type="checkbox" id="da-staff" ${cfg.roles.includes('staff') ? 'checked' : ''} /> Postazioni / collaboratori</label>
      <div class="row tight"><button class="btn btn-primary btn-sm" id="da-save">Salva i permessi</button></div></section>
    <section class="sec"><h3 class="sec-t">Registro degli accessi (ultimi ${log.length})</h3>
      <div class="plist">${log.map((l) => `<div><span>${esc(l.action)} <span class="hint">· ${esc(l.detail || '')}</span><span class="hint" style="display:block">${esc(l.by_user || '')}</span></span><span class="hint">${fdt(l.created_at)}</span></div>`).join('') || '<p class="hint">Ancora nessun accesso.</p>'}</div></section>`,
    { title: 'Permessi e registro accessi', wide: true }
  );
  $('#da-save', m.el).onclick = async () => {
    const roles = [['cassa', '#da-cassa'], ['staff', '#da-staff']].filter(([, sel]) => $(sel, m.el).checked).map(([r]) => r);
    if (await safe(() => api('PUT', '/api/documenti/config', { roles }))) { cfg.roles = roles; toast('Permessi salvati'); }
  };
}
