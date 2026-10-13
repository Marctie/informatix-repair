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
