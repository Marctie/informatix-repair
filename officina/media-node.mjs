// Archivio foto su disco per il PC del negozio (cartella officina/data/media). Non usato sul Worker.
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export function fsMedia(root) {
  const base = resolve(root);
  const path = (key) => {
    const p = resolve(join(base, key));
    if (!p.startsWith(base + sep)) throw new Error('Percorso non valido');
    return p;
  };
  return {
    mode: 'disk',
    put: async (key, bytes) => { const p = path(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, bytes); },
    get: async (key) => { try { return { bytes: new Uint8Array(await readFile(path(key))), contentType: 'image/jpeg' }; } catch { return null; } },
    remove: async (key) => { await rm(path(key), { force: true }); },
  };
}
