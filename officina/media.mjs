// Archivio delle foto della Vetrina Usati.
//  - Cloudflare: bucket R2 con binding MEDIA (consigliato un bucket dedicato "officina-media", diverso da quello dei backup).
//  - PC (Node): cartella officina/data/media.
//  - Senza archivio le foto non si possono caricare: errore chiaro, il resto della vetrina funziona.
// Interfaccia: put(key, bytes, contentType) / get(key) -> {bytes, contentType} | null / remove(key).
export class MediaMissing extends Error {
  constructor() {
    super('Archivio foto non collegato: serve il bucket R2 "officina-media" con binding MEDIA (vedi wrangler.jsonc).');
    this.status = 503;
  }
}

export const missingMedia = () => ({
  mode: 'missing',
  put: async () => { throw new MediaMissing(); },
  get: async () => { throw new MediaMissing(); },
  remove: async () => {},
});

export function r2Media(bucket) {
  if (!bucket) return missingMedia();
  return {
    mode: 'r2',
    put: (key, bytes, contentType = 'image/jpeg') => bucket.put(key, bytes, { httpMetadata: { contentType } }),
    get: async (key) => {
      const o = await bucket.get(key);
      return o ? { bytes: new Uint8Array(await o.arrayBuffer()), contentType: o.httpMetadata?.contentType || 'image/jpeg' } : null;
    },
    remove: async (key) => { await bucket.delete(key); },
  };
}

/** Archivio in memoria (test). */
export function memoryMedia() {
  const m = new Map();
  return {
    mode: 'memory', store: m,
    put: async (key, bytes, contentType = 'image/jpeg') => { m.set(key, { bytes, contentType }); },
    get: async (key) => m.get(key) || null,
    remove: async (key) => { m.delete(key); },
  };
}
