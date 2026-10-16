// Errori parlanti: logica pura (senza DOM) cosi' si puo' provare con node --test.
// Il backend manda { error, code?, hint? }: se c'e' `hint` lo mostriamo, altrimenti ne ricaviamo uno noi dallo stato HTTP.

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', hint = '', kind = 'server', method = '', path = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; this.code = code; this.hint = hint; this.kind = kind; this.method = method; this.path = path;
  }
}

/** Cosa fare, per tipo di problema. `retry` = ha senso riprovare subito. */
const HINTS = {
  network: { msg: 'Nessuna connessione con il gestionale.', hint: 'I dati che hai scritto sono ancora qui: controlla internet e premi Riprova.', retry: true },
  timeout: { msg: 'Il gestionale non ha risposto in tempo.', hint: 'Prima di riprovare controlla nell’elenco se l’operazione è stata registrata, per non farla due volte.', retry: true },
  session: { msg: 'La sessione è scaduta.', hint: 'Ricarica la pagina e accedi di nuovo: quello che hai scritto qui va ricopiato.', reload: true },
  forbidden: { msg: 'Non hai il permesso per questa operazione.', hint: 'Chiedi a un amministratore, oppure accedi con l’utente giusto.' },
  notfound: { msg: 'Non trovo più questo elemento.', hint: 'Forse è stato eliminato da un’altra postazione: chiudi e riapri l’elenco.' },
  conflict: { msg: 'Qualcun altro ha appena cambiato questo elemento.', hint: 'Ricarica la scheda e riprova.' },
  rate: { msg: 'Troppe richieste ravvicinate.', hint: 'Aspetta qualche secondo e riprova.', retry: true },
  server: { msg: 'Il gestionale ha avuto un problema.', hint: 'Riprova tra poco; se si ripete, scrivi a Marco indicando cosa stavi facendo.', retry: true },
};

/** Costruisce l'errore a partire da una risposta HTTP già letta. */
export function buildApiError({ status, data, contentType = '', redirected = false, method = '', path = '' }) {
  const isJson = !!data && typeof data === 'object';
  const html = /html/i.test(contentType) || (!isJson && status === 200);
  let kind = 'server';
  if (status === 401 || (html && (redirected || status === 200 || status === 403))) kind = 'session';
  else if (status === 403) kind = 'forbidden';
  else if (status === 404) kind = 'notfound';
  else if (status === 409) kind = 'conflict';
  else if (status === 429) kind = 'rate';
  else if (status >= 400 && status < 500) kind = 'input';
  const text = isJson ? data.error : '';
  const base = HINTS[kind];
  const message = kind === 'input' ? (text || `Operazione non riuscita (${status})`)
    : (text && ['forbidden', 'notfound', 'conflict', 'rate'].includes(kind) ? text : base?.msg || text || `Errore ${status}`);
  const hint = (isJson && data.hint) || (kind === 'input' ? '' : base?.hint || '');
  return new ApiError(message, { status, code: isJson ? data.code || '' : '', hint, kind, method, path });
}

export const networkError = (method, path, timedOut) => new ApiError(timedOut ? HINTS.timeout.msg : HINTS.network.msg, { kind: timedOut ? 'timeout' : 'network', hint: (timedOut ? HINTS.timeout : HINTS.network).hint, method, path });

/** { message, hint, retry, reload } da mostrare all'utente per qualunque eccezione. */
export function friendly(e) {
  if (e instanceof ApiError) {
    const h = HINTS[e.kind] || {};
    return { message: e.message, hint: e.hint, retry: !!h.retry, reload: !!h.reload, kind: e.kind };
  }
  const msg = String(e?.message || e || '');
  if (/Cannot (set|read) propert|is not a function|is null|undefined/.test(msg)) {
    return { message: 'Qualcosa non ha funzionato in questa schermata.', hint: 'Chiudi e riapri la scheda; se si ripete, ricarica la pagina (i dati già salvati non si perdono).', retry: false, reload: true, kind: 'js' };
  }
  return { message: msg || 'Errore imprevisto.', hint: '', retry: false, reload: false, kind: 'js' };
}

/** Testo unico (messaggio + suggerimento) per i punti che mostrano una sola stringa. */
export const errorText = (e) => { const f = friendly(e); return f.hint ? `${f.message} ${f.hint}` : f.message; };

/**
 * Prerequisiti di un cambio di stato, controllati PRIMA di chiamare il server.
 * r = scheda riparazione (con quote e quote_options). Ritorna null se si può procedere,
 * altrimenti { message, hint, fix, fixLabel }.
 */
export function statusPrereq(r, target) {
  if (!r || !target) return null;
  if (target === 'quote_pending' && (r.quote == null || r.quote === '') && !(r.quote_options || []).length) {
    return { message: 'Manca il preventivo.', hint: 'Per chiedere l’approvazione al cliente serve un importo (o almeno una soluzione).', fix: 'quote', fixLabel: 'Inserisci ora' };
  }
  return null;
}
