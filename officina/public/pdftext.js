// Estrae il TESTO da un PDF digitale nel browser (pdf.js, caricato solo quando serve) e lo riordina in righe con le colonne separate da 2 spazi.
// Il server (officina/ddt.mjs) legge questo testo: cosi' il Worker non carica librerie pesanti e i PDF non lasciano mai il computer.
// Le scansioni (immagini) non hanno testo: in quel caso si avvisa e si possono scrivere le righe a mano.

const PDFJS_VERSION = '3.11.174';
const BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

/** Voci di testo {str, x, y, w} di UNA pagina -> righe (dall'alto in basso) con le colonne separate da due spazi. Pura e testabile. */
export function rowsFromItems(items) {
  const clean = items.filter((it) => String(it.str).trim()).map((it) => ({ str: String(it.str).replace(/\s+$/g, '').replace(/^\s+/g, ' '), x: it.x, y: it.y, w: it.w || String(it.str).length * 5 }));
  const rows = [];
  for (const it of clean.sort((p, q) => q.y - p.y || p.x - q.x)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 3);
    if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  return rows.sort((p, q) => q.y - p.y).map((r) => {
    let line = ''; let end = null;
    for (const it of r.items.sort((p, q) => p.x - q.x)) {
      const text = it.str.trim();
      if (end === null) line = text;
      else {
        const gap = it.x - end;
        const charW = it.w / Math.max(1, text.length);
        line += gap > Math.max(charW * 1.8, 6) ? `  ${text}` : gap > charW * 0.2 ? ` ${text}` : text;
      }
      end = it.x + it.w;
    }
    return line;
  }).join('\n');
}

let loading = null;
/** Carica pdf.js dalla rete (una volta sola). */
function loadPdfJs() {
  if (typeof window === 'undefined') throw new Error('Lettura PDF disponibile solo nel browser.');
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${BASE}/pdf.min.js`;
      s.onload = async () => {
        try {
          // il worker sta su un altro dominio: lo si scarica e lo si serve come "blob" locale
          const code = await (await fetch(`${BASE}/pdf.worker.min.js`)).text();
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
          resolve(window.pdfjsLib);
        } catch (e) { reject(new Error('Non riesco a preparare il lettore di PDF: controlla internet e riprova.')); }
      };
      s.onerror = () => reject(new Error('Non riesco a caricare il lettore di PDF: serve la connessione a internet.'));
      document.head.appendChild(s);
    }).catch((e) => { loading = null; throw e; });
  }
  return loading;
}

/** File PDF -> testo a righe e colonne. Lancia un errore chiaro se il PDF e' una scansione o e' protetto. */
export async function extractPdfText(file, { maxPages = 15 } = {}) {
  const pdfjs = await loadPdfJs();
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) { throw new Error(/password/i.test(String(e?.message)) ? 'Il PDF è protetto da password.' : 'Non riesco ad aprire il PDF: è danneggiato?'); }
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p += 1) {
    const content = await (await doc.getPage(p)).getTextContent();
    pages.push(rowsFromItems(content.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))));
  }
  const text = pages.join('\n').trim();
  if (text.replace(/\s+/g, '').length < 20) throw new Error('Questo PDF non contiene testo (è una scansione o una foto). Servono PDF digitali: oppure scrivi le righe a mano.');
  return text;
}
