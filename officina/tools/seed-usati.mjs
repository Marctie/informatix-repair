// Genera officina/seed/usati.sql: importa nel database gli articoli gia' presenti in content/usati/usati.json.
// Uso:  node officina/tools/seed-usati.mjs
// Poi:  npx wrangler d1 execute officina --remote --file officina/seed/usati.sql --config officina/wrangler.jsonc   (dopo la migrazione 0004)
// E' ripetibile: gli articoli gia' presenti (stesso slug) non vengono toccati. Le foto restano nel repository del sito.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemToRow } from '../usati.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = join(HERE, '..', '..', 'content', 'usati', 'usati.json');
const items = JSON.parse(readFileSync(src, 'utf8')).items;
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const lines = ['-- Generato da officina/tools/seed-usati.mjs: articoli di content/usati/usati.json (ripetibile)'];
for (const it of [...items].reverse()) { // id crescenti in ordine inverso: la lista mostra prima l'ultimo inserito (= primo del file)
  const r = itemToRow(it);
  lines.push(`INSERT OR IGNORE INTO usati_items (slug,name,price,sold,sold_at,data,photo_list) VALUES (${[r.slug, r.name, r.price, r.sold, r.sold_at, r.data, r.photo_list].map(q).join(',')});`);
}
mkdirSync(join(HERE, '..', 'seed'), { recursive: true });
writeFileSync(join(HERE, '..', 'seed', 'usati.sql'), lines.join('\n') + '\n');
console.log(`Scritto officina/seed/usati.sql con ${items.length} articoli.`);
