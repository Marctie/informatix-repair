// Ricava dal logo del sito le due versioni "solo nero" per le etichette (la stampante termica non stampa i colori)
// e le scrive in officina/etichette-logo.mjs come PNG in base64: cosi' funzionano uguali su PC e sul Worker.
//   node officina/tools/make-label-logo.mjs [soglia 0-255, default 150]
// Regola: pixel scuro o colorato (il rosso del logo diventa nero) = nero; pixel chiaro = trasparente.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'public', 'images', 'Informatix-logo.png');
const OUT = join(ROOT, 'officina', 'etichette-logo.mjs');
const threshold = Number(process.argv[2]) || 150;

async function mono(input, width) {
  const base = sharp(input).flatten({ background: '#ffffff' }).resize({ width, kernel: 'lanczos3' }).greyscale();
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    const dark = data[i] < threshold;
    rgba[i * 4 + 3] = dark ? 255 : 0; // R,G,B restano 0 = nero
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png({ palette: true, colours: 2, compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
}

// Logo completo (omino con i dispositivi + scritta)
const full = await mono(SRC, 520);
// Solo scritta INFORMATIX REPAIR (parte bassa del logo)
const meta = await sharp(SRC).metadata();
const cropTop = Math.round(meta.height * 0.72);
const wordSrc = await sharp(SRC).extract({ left: 0, top: cropTop, width: meta.width, height: meta.height - cropTop }).toBuffer();
const word = await mono(wordSrc, 700);

const mod = `// GENERATO da officina/tools/make-label-logo.mjs (soglia ${threshold}): non modificare a mano.
// Logo Informatix in solo nero (sfondo trasparente) per le etichette prodotto: versione completa e versione "solo scritta".
export const LOGO_FULL = { w: ${full.info.width}, h: ${full.info.height}, b64: '${full.data.toString('base64')}' };
export const LOGO_WORD = { w: ${word.info.width}, h: ${word.info.height}, b64: '${word.data.toString('base64')}' };
`;
writeFileSync(OUT, mod);
const dbg = process.env.LOGO_DEBUG_DIR;
if (dbg) {
  const flat = (b) => sharp(b).flatten({ background: '#ffffff' }).png().toBuffer();
  writeFileSync(join(dbg, 'logo-full.png'), await flat(full.data));
  writeFileSync(join(dbg, 'logo-word.png'), await flat(word.data));
}
console.log(`logo completo ${full.info.width}x${full.info.height} (${full.data.length} byte), scritta ${word.info.width}x${word.info.height} (${word.data.length} byte)`);
