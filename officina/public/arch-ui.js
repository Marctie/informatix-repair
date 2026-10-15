// Pezzi di interfaccia condivisi da Chiusure di cassa, Archivio fatture e Dare/avere (stesso aspetto, stessa spaziatura).
import { esc, eur, today } from './util.js';

/** Numero scritto all'italiana ("12,50") -> 12.5 ; vuoto -> 0. */
export const n2 = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Valore per un campo di testo: 12.5 -> "12,50". */
export const inVal = (n) => (n == null || n === '' ? '' : String(Number(n).toFixed(2)).replace('.', ','));
export const sgn = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${eur(Math.abs(n))}`;
export const monthName = (ym) => { const [y, m] = ym.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); };
export const METHODS = ['contanti', 'carta', 'bonifico', 'assegno'];
export const methodOptions = (cur = 'contanti') => METHODS.map((m) => `<option ${m === cur ? 'selected' : ''}>${m}</option>`).join('');

let cssDone = false;
/** Stili solo di queste tre sezioni (usano le variabili e la spaziatura del resto del gestionale). */
export function archCss() {
  if (cssDone || document.getElementById('arch-css')) return;
  cssDone = true;
  const s = document.createElement('style');
  s.id = 'arch-css';
  s.textContent = `
  .ar-kpis{display:grid;gap:.75rem;grid-template-columns:repeat(2,minmax(0,1fr))}
  @media (min-width:720px){.ar-kpis{grid-template-columns:repeat(4,minmax(0,1fr))} .ar-kpis.k5{grid-template-columns:repeat(5,minmax(0,1fr))}}
  .ar-kpis .kpi b{font-size:1.35rem;overflow-wrap:anywhere}
  .ar-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem 1rem;align-items:center;padding:.8rem 1rem;border-bottom:1px solid var(--line);cursor:pointer}
  .ar-row:last-child{border-bottom:0}
  .ar-row .main{min-width:0;display:flex;flex-direction:column;gap:.2rem}
  .ar-row .main .t{font-weight:700;font-size:.92rem;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
  .ar-row .main .s{font-size:.78rem;color:var(--muted);overflow-wrap:anywhere}
  .ar-row .side{text-align:right;display:flex;flex-direction:column;gap:.2rem;align-items:flex-end}
  .ar-row .side b{font-size:.95rem}
  @media (max-width:559px){.ar-row{grid-template-columns:minmax(0,1fr)}.ar-row .side{flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center;text-align:left;gap:.4rem .6rem}}
  .ar-box .btn{white-space:normal;text-align:left;height:auto}
  .ar-alert{border-radius:.85rem;padding:.75rem 1rem;font-size:.86rem;line-height:1.45;border:1px solid}
  .ar-alert.bad{background:#FEF2F2;border-color:#FECACA;color:#991B1B}
  .ar-alert.warn{background:#FFFBEB;border-color:#FDE68A;color:#92400E}
  .ar-alert.ok{background:#ECFDF5;border-color:#A7F3D0;color:#047857}
  .ar-alert b{font-weight:700}
  .ar-diff{font-family:Poppins,system-ui,sans-serif;font-weight:800;font-size:1.5rem;line-height:1.15}
  .ar-diff.ok{color:#047857} .ar-diff.bad{color:#B91C1C} .ar-diff.warn{color:#B45309}
  .ar-box{background:var(--bg);border-radius:.85rem;padding:.9rem 1rem;display:flex;flex-direction:column;gap:.5rem}
  .ar-box .ln{display:flex;justify-content:space-between;gap:1rem;font-size:.88rem;align-items:baseline}
  .ar-box .ln span:first-child{color:var(--muted)}
  .ar-box .ln.tot{border-top:1px solid var(--line);padding-top:.5rem;font-weight:700}
  .ar-photo{max-width:100%;max-height:22rem;border-radius:.75rem;border:1px solid var(--line);object-fit:contain;background:#fff}
  .ar-mrow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:.25rem 1rem;padding:.55rem 0;border-bottom:1px solid var(--line);font-size:.88rem;align-items:baseline}
  .ar-mrow:last-child{border-bottom:0}
  .ar-mrow .h{text-transform:capitalize;font-weight:600}
  @media (max-width:479px){.ar-mrow{grid-template-columns:minmax(0,1fr) auto}.ar-mrow .n{display:none}}
  .ar-lock{display:inline-flex;gap:.25rem;align-items:center}
  `;
  document.head.appendChild(s);
}

export const kpiTile = (value, label, cls = '') => `<div class="card kpi"><b class="${cls}">${value}</b><span>${esc(label)}</span></div>`;

/** Scarica un CSV (l'indirizzo e' protetto dallo stesso accesso del gestionale). */
export const csvLink = (href) => { const a = document.createElement('a'); a.href = href; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); };

/** Intervalli rapidi: [chiave, etichetta, da, a]. */
export function periods() {
  const t = today();
  const d = new Date();
  const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const first = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  const pf = ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const pl = ymd(new Date(d.getFullYear(), d.getMonth(), 0));
  const d90 = new Date(d); d90.setDate(d90.getDate() - 90);
  return [['mese', 'Questo mese', first, t], ['scorso', 'Mese scorso', pf, pl], ['90', '90 giorni', ymd(d90), t], ['anno', 'Quest’anno', `${d.getFullYear()}-01-01`, t], ['tutto', 'Tutto', '', '']];
}
