// Cassaforte: cifratura a riposo (AES-GCM 256, WebCrypto) per documenti d'identita' e password dei fornitori.
// La chiave NON sta nel repository: arriva dal segreto del Worker `VAULT_KEY` (wrangler secret put VAULT_KEY)
// oppure, sul PC, dalla variabile d'ambiente VAULT_KEY (o dal file officina/data/vault.key creato all'avvio da server.mjs).
// Se la chiave si perde i dati cifrati NON sono recuperabili: va conservata a parte.
import { HttpError } from './logic.mjs';

const enc = new TextEncoder();
const dec = new TextDecoder();
const keyCache = new Map();

const toB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Legge il segreto dal Worker (c.env) o dall'ambiente Node. Mai dal codice. */
export function vaultSecret(c) {
  const s = c?.env?.VAULT_KEY || (typeof process !== 'undefined' ? process.env?.VAULT_KEY : '') || '';
  return String(s);
}
export const vaultReady = (c) => vaultSecret(c).length >= 16;

async function cryptoKey(secret) {
  if (!keyCache.has(secret)) {
    const raw = await crypto.subtle.digest('SHA-256', enc.encode(`informatix-vault-v1:${secret}`));
    keyCache.set(secret, await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
  }
  return keyCache.get(secret);
}
async function keyFor(c) {
  const secret = vaultSecret(c);
  if (secret.length < 16) throw new HttpError(503, 'La cassaforte dei dati sensibili non è utilizzabile: manca la chiave di sicurezza del server (VAULT_KEY, almeno 16 caratteri).', { code: 'CASSAFORTE_NON_CONFIGURATA', hint: 'Avvisa l’amministratore: la chiave va impostata sul server (vedi manuale, sezione Documenti e credenziali).' });
  return cryptoKey(secret);
}

/** Cifra un testo (o byte). Risultato: "v1.<iv>.<dati>" in base64. */
export async function encryptText(c, plain) {
  const key = await keyFor(c);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = typeof plain === 'string' ? enc.encode(plain) : plain;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}
/** Decifra; con una chiave sbagliata o dati alterati lancia un errore chiaro. */
export async function decryptText(c, token, { bytes = false } = {}) {
  const key = await keyFor(c);
  const [v, iv, ct] = String(token || '').split('.');
  if (v !== 'v1' || !iv || !ct) throw new HttpError(500, 'Dato cifrato non valido');
  try {
    const out = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct)));
    return bytes ? out : dec.decode(out);
  } catch {
    throw new HttpError(409, 'Il dato cifrato non si può leggere: la chiave VAULT_KEY del server non corrisponde a quella usata per salvarlo.', { code: 'CASSAFORTE_CHIAVE_DIVERSA', hint: 'Avvisa l’amministratore: la chiave VAULT_KEY è stata cambiata e va ripristinata quella originale.' });
  }
}
export const encryptJson = (c, obj) => encryptText(c, JSON.stringify(obj ?? {}));
export const decryptJson = async (c, token) => JSON.parse(await decryptText(c, token));

/** Registro degli accessi ai dati sensibili (mai il contenuto: solo chi, quando, cosa). */
export async function logAccess(db, user, area, action, targetId, detail) {
  await db.prepare("INSERT INTO sensitive_access_log (area, action, target_id, detail, by_user, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))")
    .run(area, action, targetId ?? null, detail ? String(detail).slice(0, 200) : null, user?.email || 'locale');
}
