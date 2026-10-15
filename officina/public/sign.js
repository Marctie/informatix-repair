// Finestra per far firmare un cliente (tablet, touch o mouse) e salvarne la firma.
import { $, esc, api, safe, toast, openModal } from './util.js';

/**
 * Apre la finestra di firma. `text` = il testo che il cliente sta accettando (resta salvato insieme alla firma).
 * onSign riceve { image, signer_name } e deve salvare; se riesce la finestra si chiude e ritorna true.
 */
export function signDialog({ title, intro = '', text = '', terms = '', draft = false, name = '', confirm = 'Conferma e firma', onSign }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal(
      `<section class="sec">
        ${intro ? `<p>${intro}</p>` : ''}
        <div class="legalbox">
          <div>${esc(text)}</div>
          ${terms ? `<div class="hint"><b>Condizioni:</b> ${esc(terms)}</div>` : ''}
          ${draft ? '<div class="hint draft">Testo in bozza, da far verificare prima dell’uso definitivo.</div>' : ''}
        </div>
        <div class="field"><label class="l" for="sg-name">Nome di chi firma</label><input id="sg-name" value="${esc(name)}" autocomplete="off" /></div>
        <div class="sigpad"><label class="l">Firma qui sotto (con il dito, la penna o il mouse)</label><canvas id="sg-canvas" aria-label="Riquadro della firma"></canvas>
          <div class="row tight"><button type="button" class="btn btn-ghost btn-sm" id="sg-clear">Cancella e rifai</button><span class="hint" id="sg-hint">Firma non ancora disegnata.</span></div></div>
      </section>`,
      { title, wide: true, full: true, footer: `<button class="btn btn-outline" data-close>Annulla</button><button class="btn btn-primary btn-lg" id="sg-ok" disabled>${esc(confirm)}</button>` }
    );
    const close0 = m.close;
    m.close = () => { pad.destroy(); close0(); resolve(done); };
    const canvas = $('#sg-canvas', m.el);
    const ok = $('#sg-ok', m.el);
    const pad = window.SigPad.create(canvas, { onChange: (empty) => { ok.disabled = empty; $('#sg-hint', m.el).textContent = empty ? 'Firma non ancora disegnata.' : 'Firma acquisita.'; } });
    setTimeout(() => pad.refit(), 60);
    $('#sg-clear', m.el).onclick = () => pad.clear();
    ok.onclick = async () => {
      if (pad.isEmpty()) return toast('Serve la firma del cliente', false);
      ok.disabled = true;
      const out = await safe(() => onSign({ image: pad.toDataURL(), signer_name: $('#sg-name', m.el).value }));
      if (out === undefined) { ok.disabled = false; return; }
      done = true;
      m.close();
    };
  });
}

/** Firma della scheda di ingresso al banco: testo di consenso e condizioni arrivano dal server. */
export async function signIntakeAtDesk(repairId, onDone) {
  const r = await safe(() => api('GET', `/api/repairs/${repairId}`));
  const s = await safe(() => api('GET', '/api/settings'));
  if (!r || !s) return false;
  const vars = { negozio: s.shop_name, garanzia: r.warranty_days, codice: r.code, dispositivo: r.brand_model };
  const text = String(s.consent_intake || '').replace(/\{(\w+)\}/g, (x, k) => (vars[k] != null ? vars[k] : x));
  const ok = await signDialog({
    title: `Firma scheda ${r.code}`,
    intro: `<b>${esc(r.customer_name)}</b> · ${esc(r.brand_model)}. Dai il tablet al cliente: legge e firma.`,
    text, terms: s.terms, draft: String(s.legal_verified) !== '1', name: r.customer_name,
    onSign: (b) => api('POST', `/api/repairs/${repairId}/signature`, b),
  });
  if (ok) { toast('Firma salvata: comparirà sulla scheda stampata'); onDone?.(); }
  return ok;
}
