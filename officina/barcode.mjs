// Codice a barre Code 128 (set B) in SVG, senza dipendenze. Serve a stampare il codice della riparazione
// (es. R-2026-0001) su etichetta e scheda: una pistola per codici a barre lo legge e il gestionale apre la riparazione.

// Larghezze (barra, spazio, barra, spazio, barra, spazio) dei simboli 0..105 + stop (106, 7 elementi).
const PATTERNS = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
  '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 ' +
  '232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 ' +
  '313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 ' +
  '111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 ' +
  '114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'
).split(' ');

const START_B = 104;
const STOP = 106;

/** Sequenza di moduli: stringa di '1' (barra) e '0' (spazio). */
export function code128bModules(text) {
  const chars = [...String(text)].map((c) => {
    const n = c.charCodeAt(0);
    return n >= 32 && n <= 126 ? n - 32 : 31; // fuori intervallo => '?'
  });
  let sum = START_B;
  chars.forEach((v, i) => { sum += v * (i + 1); });
  const symbols = [START_B, ...chars, sum % 103, STOP];
  let bits = '';
  for (const s of symbols) {
    [...PATTERNS[s]].forEach((w, i) => { bits += (i % 2 === 0 ? '1' : '0').repeat(Number(w)); });
  }
  return bits;
}

// ---------- EAN-13 (codici dei prodotti e codici interni del negozio) ----------
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Cifra di controllo EAN/UPC dei primi N-1 numeri (12 per l'EAN-13). */
export function eanCheckDigit(body) {
  const d = String(body).split('').map(Number);
  let sum = 0;
  for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += d[i] * w;
  return (10 - (sum % 10)) % 10;
}
/** Vero se e' un EAN-13 valido (13 cifre con la cifra di controllo giusta). */
export const isEan13 = (s) => /^\d{13}$/.test(String(s)) && eanCheckDigit(String(s).slice(0, 12)) === Number(String(s)[12]);

/** Moduli (barra/spazio) di un EAN-13: 95 moduli. */
export function ean13Modules(code) {
  const s = String(code);
  if (!isEan13(s)) throw new Error('EAN-13 non valido');
  const parity = EAN_PARITY[Number(s[0])];
  let bits = '101';
  for (let i = 0; i < 6; i++) bits += (parity[i] === 'L' ? EAN_L : EAN_G)[Number(s[i + 1])];
  bits += '01010';
  for (let i = 0; i < 6; i++) bits += EAN_R[Number(s[i + 7])];
  return bits + '101';
}

/**
 * Codice interno del negozio per un articolo: EAN-13 che inizia per 2 (fascia riservata dal GS1 all'uso interno, non puo' mai
 * coincidere con il codice di un produttore) + id a 11 cifre + cifra di controllo. Dipende solo dall'id: le etichette gia' stampate
 * restano valide anche se in seguito si assegna all'articolo un altro codice.
 */
export function internalEan(id) {
  const body = '2' + String(Math.trunc(Number(id))).padStart(11, '0');
  return body + eanCheckDigit(body);
}
/** Inverso di internalEan: id dell'articolo se il codice e' un codice interno valido, altrimenti null. */
export function idFromInternalEan(code) {
  const s = String(code ?? '');
  return isEan13(s) && s[0] === '2' ? Number(s.slice(1, 12)) : null;
}

/** Tipo di codice usato per stampare: EAN-13 se il testo lo e', altrimenti Code 128. */
export const barcodeKind = (text) => (isEan13(text) ? 'ean13' : 'code128');

/**
 * Codice a barre che riempie un riquadro (preserveAspectRatio="none": larghezza e altezza seguono il riquadro).
 * Ritorna { svg, modules, kind }: `modules` serve a calcolare la larghezza della barra piu' stretta (in mm) per avvisare
 * quando un lettore faticherebbe a leggerlo.
 */
export function barcodeBoxSvg(text, kind = barcodeKind(text)) {
  const useEan = kind === 'ean13' && isEan13(text);
  const bits = useEan ? ean13Modules(text) : code128bModules(text);
  const qL = useEan ? 11 : 10;
  const qR = useEan ? 7 : 10;
  const total = bits.length + qL + qR;
  let rects = '';
  for (let i = 0; i < bits.length;) {
    if (bits[i] !== '1') { i++; continue; }
    let j = i;
    while (bits[j] === '1') j++;
    rects += `<rect x="${qL + i}" y="0" width="${j - i}" height="1"/>`;
    i = j;
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 1" width="100%" height="100%" preserveAspectRatio="none" shape-rendering="crispEdges"><g fill="#000">${rects}</g></svg>`, modules: total, kind: useEan ? 'ean13' : 'code128' };
}

export function barcodeSvg(text, { height = 46, module = 2, quiet = 10 } = {}) {
  const bits = code128bModules(text);
  const width = (bits.length + quiet * 2) * module;
  let rects = '';
  for (let i = 0; i < bits.length;) {
    if (bits[i] !== '1') { i++; continue; }
    let j = i;
    while (bits[j] === '1') j++;
    rects += `<rect x="${(quiet + i) * module}" y="0" width="${(j - i) * module}" height="${height}"/>`;
    i = j;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
