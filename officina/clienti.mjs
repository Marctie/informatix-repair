// Anagrafica clienti: privati e aziende, con validazione formale dei dati fiscali italiani.
import { HttpError } from './logic.mjs';

const str = (v) => (v == null ? null : String(v).trim() || null);
const bad = (m, code, hint) => { throw new HttpError(400, m, { code, hint }); };

/** Partita IVA italiana: 11 cifre + cifra di controllo (algoritmo di Luhn dell'Agenzia delle Entrate). */
export function validVat(v) {
  if (!/^\d{11}$/.test(v)) return false;
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(v[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    s += d;
  }
  return (10 - (s % 10)) % 10 === Number(v[10]);
}

const ODD = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
/** Codice fiscale: persone fisiche (16 caratteri con carattere di controllo) o numerico di 11 cifre (societa'). */
export function validFiscalCode(v) {
  if (/^\d{11}$/.test(v)) return validVat(v);
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(v)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const c = v[i];
    const n = /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
    s += i % 2 === 0 ? ODD[n] : n;
  }
  return String.fromCharCode(65 + (s % 26)) === v[15];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalizza e valida i campi anagrafici. `partial` = aggiornamento: considera solo le chiavi presenti.
 * Restituisce un oggetto con le sole colonne da scrivere.
 */
export function cleanCustomer(b, current = null) {
  const m = { ...(current || {}), ...b };
  const out = {};
  const kind = str(m.kind) || 'privato';
  if (!['privato', 'azienda'].includes(kind)) bad('Cliente non salvato: il tipo scelto non è valido.', 'CLIENTE_TIPO_NON_VALIDO', 'Scegli privato oppure azienda.');
  out.kind = kind;
  out.company_name = str(m.company_name);
  if (kind === 'azienda' && !out.company_name && !str(m.name)) bad('Azienda non salvata: manca la ragione sociale.', 'RAGIONE_SOCIALE_MANCANTE', 'Scrivi la ragione sociale dell’azienda.');
  // nome visualizzato: per le aziende e' la ragione sociale se non indicato altro
  out.name = str(m.name) || (kind === 'azienda' ? out.company_name : null);
  if (!out.name) bad('Cliente non salvato: manca il nome.', 'NOME_MANCANTE', 'Compila il campo Nome e salva di nuovo.');

  const vat = str(m.vat_number)?.replace(/[\s.]/g, '').replace(/^IT/i, '') || null;
  if (vat && !validVat(vat)) bad('Cliente non salvato: Partita IVA non valida (servono 11 cifre con cifra di controllo corretta).', 'PARTITA_IVA_NON_VALIDA', 'Ricontrolla le 11 cifre sul documento del cliente.');
  out.vat_number = vat;
  const cf = str(m.fiscal_code)?.replace(/\s/g, '').toUpperCase() || null;
  if (cf && !validFiscalCode(cf)) bad('Cliente non salvato: il codice fiscale non è valido.', 'CODICE_FISCALE_NON_VALIDO', 'Ricontrolla il codice sul tesserino del cliente.');
  out.fiscal_code = cf;

  out.address = str(m.address);
  const zip = str(m.zip);
  if (zip && !/^\d{5}$/.test(zip)) bad('Cliente non salvato: il CAP non è valido (servono 5 cifre).', 'CAP_NON_VALIDO', 'Scrivi il CAP di 5 cifre (es. 20100).');
  out.zip = zip;
  out.city = str(m.city);
  const prov = str(m.province)?.toUpperCase() || null;
  if (prov && !/^[A-Z]{2}$/.test(prov)) bad('Cliente non salvato: la provincia non è valida (sigla di 2 lettere).', 'PROVINCIA_NON_VALIDA', 'Scrivi la sigla, es. MI.');
  out.province = prov;
  const sdi = str(m.sdi_code)?.toUpperCase() || null;
  if (sdi && !/^[A-Z0-9]{6,7}$/.test(sdi)) bad('Cliente non salvato: il codice SDI non è valido (7 caratteri).', 'CODICE_SDI_NON_VALIDO', 'Scrivi il codice destinatario di 7 caratteri, oppure lascia vuoto.');
  out.sdi_code = sdi;
  const pec = str(m.pec)?.toLowerCase() || null;
  if (pec && !EMAIL.test(pec)) bad('Cliente non salvato: l’indirizzo PEC non è valido.', 'PEC_NON_VALIDA', 'Controlla l’indirizzo (es. nome@pec.it).');
  out.pec = pec;
  const email = str(m.email);
  if (email && !EMAIL.test(email) && email !== current?.email) bad('Cliente non salvato: l’indirizzo email non è valido.', 'EMAIL_NON_VALIDA', 'Controlla l’indirizzo (es. nome@esempio.it).');
  out.phone = str(m.phone);
  out.email = email;
  out.notes = str(m.notes);
  return out;
}

export const CUSTOMER_COLS = ['name', 'kind', 'company_name', 'vat_number', 'fiscal_code', 'address', 'zip', 'city', 'province', 'sdi_code', 'pec', 'phone', 'email', 'notes'];

/** Riga di testo con i dati fiscali, per stampe e ricevute (vuota per i privati senza dati). */
export function fiscalLines(c) {
  const out = [];
  if (c.customer_kind === 'azienda' || c.kind === 'azienda') {
    const rs = c.customer_company || c.company_name;
    if (rs && rs !== (c.customer_name || c.name)) out.push(rs);
  }
  const vat = c.customer_vat || c.vat_number, cf = c.customer_cf || c.fiscal_code;
  const ids = [vat && `P.IVA ${vat}`, cf && cf !== vat && `C.F. ${cf}`].filter(Boolean).join(' · ');
  if (ids) out.push(ids);
  const addr = [c.customer_address || c.address, [c.customer_zip || c.zip, c.customer_city || c.city].filter(Boolean).join(' '), (c.customer_province || c.province) && `(${c.customer_province || c.province})`].filter(Boolean).join(', ');
  if (addr) out.push(addr);
  const sdi = c.customer_sdi || c.sdi_code, pec = c.customer_pec || c.pec;
  const e = [sdi && `SDI ${sdi}`, pec && `PEC ${pec}`].filter(Boolean).join(' · ');
  if (e) out.push(e);
  return out;
}
