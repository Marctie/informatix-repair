// Errori "parlanti": un solo tipo di errore, un mapper per gli errori del database e il formato JSON uniforme.
// Contratto della risposta d'errore (retrocompatibile: `ok` ed `error` restano come prima):
//   { ok:false, error:"frase italiana: cosa e' successo + perche'", code:"CODICE_STABILE", hint:"cosa fare ora", ref:"E-XXXX" (solo 500) }
// Mai dati sensibili (codici di sblocco, token, segreti) nei messaggi.

export class HttpError extends Error {
  /** @param {number} status @param {string} message @param {{code?:string,hint?:string}|string} [opts] (una stringa = code) */
  constructor(status, message, opts = {}) {
    super(message);
    this.status = status;
    if (typeof opts === 'string') opts = { code: opts };
    if (opts.code) this.code = opts.code;
    if (opts.hint) this.hint = opts.hint;
  }
}

const DEFAULT_CODE = { 400: 'RICHIESTA_NON_VALIDA', 401: 'NON_AUTENTICATO', 403: 'NON_AUTORIZZATO', 404: 'NON_TROVATO', 409: 'CONFLITTO', 413: 'TROPPO_GRANDE', 423: 'BLOCCATO', 429: 'TROPPI_TENTATIVI', 500: 'ERRORE_INTERNO', 503: 'NON_DISPONIBILE' };
const DEFAULT_HINT = {
  400: 'Controlla i dati inseriti e riprova.',
  401: 'Accedi di nuovo e riprova.',
  403: 'Serve un utente con più permessi: chiedi all’amministratore.',
  404: 'Aggiorna l’elenco: il dato potrebbe essere stato eliminato o spostato.',
  409: 'Aggiorna la pagina per vedere lo stato attuale e riprova.',
  429: 'Attendi qualche minuto prima di riprovare.',
  503: 'Il servizio non è configurato o non risponde: avvisa l’amministratore.',
};

// Messaggi storici brevi -> codice stabile e suggerimento (così i vecchi throw diventano parlanti senza riscriverli tutti).
const KNOWN = [
  [/^Riparazione non trovata/i, 'RIPARAZIONE_NON_TROVATA', 'Riapri l’elenco delle riparazioni: la scheda potrebbe essere stata eliminata.'],
  [/^Cliente non trovato/i, 'CLIENTE_NON_TROVATO', 'Riapri l’anagrafica clienti e cercalo di nuovo: potrebbe essere stato eliminato.'],
  [/^Prodotto non trovato|^Articolo non trovato/i, 'ARTICOLO_NON_TROVATO', 'Riapri il magazzino e cerca di nuovo l’articolo.'],
  [/^Vendita non trovata/i, 'VENDITA_NON_TROVATA', 'Riapri l’elenco delle vendite e riprova.'],
  [/^Fornitore non trovato/i, 'FORNITORE_NON_TROVATO', 'Riapri l’elenco dei fornitori e riprova.'],
  [/^Nome obbligatorio/i, 'NOME_MANCANTE', 'Compila il campo Nome e salva di nuovo.'],
  [/^Importo non valido/i, 'IMPORTO_NON_VALIDO', 'Scrivi un importo numerico maggiore di zero (es. 49,90).'],
  [/^Gli importi non possono essere negativi/i, 'IMPORTO_NEGATIVO', 'Inserisci un importo uguale o maggiore di zero.'],
  [/^Data non valida|data non valida$/i, 'DATA_NON_VALIDA', 'Usa il formato GG/MM/AAAA (o AAAA-MM-GG) con una data che esiste.'],
  [/^La data non può essere nel futuro/i, 'DATA_FUTURA', 'Scegli la data di oggi o una precedente.'],
  [/^Stato non valido/i, 'STATO_NON_VALIDO', 'Scegli uno degli stati proposti dall’elenco.'],
  [/^Quantità non valida/i, 'QUANTITA_NON_VALIDA', 'Scrivi un numero diverso da zero (negativo per scaricare).'],
  [/^Solo l’amministratore/i, 'SOLO_ADMIN', 'Accedi come amministratore, oppure chiedi a Christian/Marco di farlo.'],
  [/metodo di pagamento/i, 'METODO_PAGAMENTO_MANCANTE', 'Scegli come ha pagato il cliente (contanti, carta, bonifico…): ogni incasso va registrato.'],
  [/^Il preventivo è scaduto/i, 'PREVENTIVO_SCADUTO', 'Apri il preventivo, prolunga la data di validità e rinvialo al cliente.'],
  [/^Troppi tentativi/i, 'TROPPI_TENTATIVI', 'Attendi qualche minuto prima di riprovare.'],
];

/** Completa un errore con code/hint di default (senza sovrascrivere quelli espliciti). */
export function enrich(e) {
  const status = e.status || 500;
  let code = e.code, hint = e.hint;
  if (!code || !hint) {
    const k = KNOWN.find(([re]) => re.test(e.message || ''));
    if (k) { code ||= k[1]; hint ||= k[2]; }
  }
  code ||= DEFAULT_CODE[status] || 'ERRORE';
  hint ||= DEFAULT_HINT[status] || null;
  return { code, hint };
}

const TABLE_IT = {
  customers: 'cliente', repairs: 'riparazione', products: 'articolo di magazzino', sales: 'vendita', sale_items: 'riga di vendita',
  suppliers: 'fornitore', purchases: 'acquisto', users: 'utente', devices: 'dispositivo', services: 'servizio', repair_parts: 'ricambio',
  vouchers: 'buono', orders: 'ordine', quotes: 'preventivo', invoices: 'fattura', device_models: 'modello',
  closings: 'chiusura di cassa', notes: 'nota', reminders: 'promemoria', credentials: 'credenziale', loyalty_cards: 'carta punti',
};
const COL_IT = { phone: 'telefono', email: 'email', name: 'nome', code: 'codice', token: 'codice di tracciamento', number: 'numero', serial: 'seriale', barcode: 'codice a barre', day: 'giorno', vat_number: 'partita IVA', card_no: 'numero carta', chip_uid: 'chip' };
const tIt = (t) => TABLE_IT[t] || '';
const cIt = (c) => COL_IT[c] || c || 'valore';

/** Traduce un errore SQLite/D1 in HttpError parlante; null se non è un errore di vincolo noto. */
export function mapDbError(e) {
  const m = String(e?.message || e || '');
  let x;
  if ((x = /UNIQUE constraint failed:\s*([\w.,\s]+)/i.exec(m))) {
    const [t, c] = x[1].split(',')[0].trim().split('.');
    const what = tIt(t) || 'record';
    return new HttpError(409, `Esiste già un ${what} con lo stesso ${cIt(c)}: non posso salvarne un secondo uguale.`, { code: 'DUPLICATO', hint: `Cerca il ${what} già presente e modificalo, oppure cambia il ${cIt(c)}.` });
  }
  if ((x = /NOT NULL constraint failed:\s*(\w+)\.(\w+)/i.exec(m))) {
    return new HttpError(400, `Manca un dato obbligatorio (${cIt(x[2])}) per salvare ${tIt(x[1]) ? `il ${tIt(x[1])}` : 'il record'}.`, { code: 'CAMPO_OBBLIGATORIO', hint: `Compila il campo “${cIt(x[2])}” e salva di nuovo.` });
  }
  if (/FOREIGN KEY constraint failed/i.test(m)) {
    return new HttpError(409, 'L’operazione collega o elimina un record che ha ancora altri dati collegati (o che non esiste più).', { code: 'DATI_COLLEGATI', hint: 'Aggiorna la pagina; se stavi eliminando, rimuovi prima i dati collegati (riparazioni, vendite, acquisti).' });
  }
  if (/CHECK constraint failed/i.test(m)) {
    return new HttpError(400, 'Uno dei valori inseriti non è ammesso (fuori dai limiti consentiti).', { code: 'VALORE_NON_AMMESSO', hint: 'Ricontrolla importi, quantità e stati inseriti.' });
  }
  if (/database is locked|SQLITE_BUSY/i.test(m)) {
    return new HttpError(503, 'Il database è occupato in questo momento: l’operazione non è stata salvata.', { code: 'DB_OCCUPATO', hint: 'Riprova tra qualche secondo.' });
  }
  return null;
}

/** Codice di riferimento breve da dettare a Marco (compare anche nel log). */
export const newRef = () => `E-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Da un errore qualsiasi a { status, body, ref? }. `ctx` = { method, path, user, id }: serve al log dei 500. */
export function toResponse(e, ctx = {}) {
  let err = e;
  if (!(err && err.status)) { const mapped = mapDbError(err); if (mapped) err = mapped; }
  const status = err?.status || 500;
  if (!err?.status || (status === 500 && !err.hint)) {
    const ref = newRef();
    console.error(`[${ref}] ${ctx.method || ''} ${ctx.path || ''} utente=${ctx.user || '-'} id=${ctx.id || '-'}`, e);
    return { status: 500, ref, body: { ok: false, error: `Si è verificato un errore interno: l’operazione NON è stata completata. Codice riferimento ${ref}.`, code: 'ERRORE_INTERNO', hint: `Riprova tra poco; se si ripete comunica a Marco il codice ${ref}.`, ref } };
  }
  const { code, hint } = enrich(err);
  let message = err.message || 'Errore';
  // 404 generici: aggiunge il riferimento al record cercato (id della richiesta), mai dati personali
  if (status === 404 && ctx.id && /non trovat[oa]$/i.test(message)) message += ` (n. ${ctx.id})`;
  return { status, body: { ok: false, error: message, code, ...(hint ? { hint } : {}) } };
}
