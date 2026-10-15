// Testi di consenso e conferma (scheda di ingresso, preventivo a distanza, avviso di giacenza).
// SONO BOZZE da docs/TESTI-LEGALI-BOZZE.md: non sono consulenza legale e vanno riletti da Christian e da un professionista.
// Finche' l'impostazione legal_verified non e' "1" ogni schermata e stampa li segna come "bozza da far verificare".
// Si possono modificare da Impostazioni (chiavi consent_*, quote_*, storage_*): i segnaposto tra graffe vengono sostituiti.
//   {negozio} {garanzia} {codice} {importo} {dispositivo} {consegna} {giorni} {tariffa}
export const LEGAL_DEFAULTS = {
  legal_verified: '0',
  storage_days: '15',
  storage_fee: '',
  consent_intake:
    'Affido a {negozio} il dispositivo descritto in scheda per diagnosi e riparazione. Dichiaro di avere letto le condizioni riportate (preventivo indicativo fino all’approvazione, termini di ritiro, garanzia di {garanzia} giorni sulla riparazione, responsabilità sui dati: ho effettuato o rinuncio al backup) e di essere informato sul trattamento dei miei dati come da informativa privacy disponibile in negozio e sul sito. Autorizzo il laboratorio ad accedere al dispositivo per i soli controlli necessari alla riparazione.',
  quote_accept_title: 'Confermi il preventivo?',
  quote_accept_text:
    'Stai accettando il preventivo n. {codice} di {importo} per la riparazione di {dispositivo}{consegna}. Con la conferma autorizzi il laboratorio a eseguire i lavori descritti. Se non vengono eseguiti, o se vengono eseguiti solo in parte, hai diritto al ritiro del dispositivo. Una volta iniziati i lavori non è possibile annullare l’incarico senza il pagamento delle attività già svolte e dei ricambi già acquistati o montati (condizioni da definire).',
  quote_decline_title: 'Rifiuti il preventivo?',
  quote_decline_text: 'Stai rifiutando il preventivo n. {codice}. Il dispositivo non verrà riparato. Scegli cosa fare:',
  quote_decline_pickup:
    'Passerò a ritirarlo. Il dispositivo resta in negozio {giorni} giorni dalla data di questa scelta. Dopo tale termine potrà essere custodito in deposito a pagamento ({tariffa}) oppure, previo avviso, essere trattato come indicato nelle condizioni di servizio.',
  quote_decline_cede:
    'Cedo il dispositivo al negozio. Dichiaro di essere il proprietario del dispositivo e cedo la proprietà al laboratorio, che potrà smaltirlo oppure recuperarne e riutilizzarne i componenti, senza nulla dovere al cliente. Ho già effettuato o rinuncio al backup dei miei dati e ho rimosso o autorizzo la rimozione di codici di sblocco e account.',
  quote_sign_text: 'Firmando confermo di avere letto e compreso quanto sopra e che la scelta è mia.',
  storage_notice:
    'Ciao {nome}, il tuo {dispositivo} (rif. {codice}) non è stato riparato e ti aspetta in negozio dal {data}. Dal {scadenza} sarà custodito in deposito a pagamento ({tariffa}) oppure potrà essere smaltito/ceduto secondo le condizioni che hai firmato. Passa a ritirarlo o scrivici per accordarci: {telefono}.',
};

/** Sostituisce i segnaposto {nome}; quelli sconosciuti restano com'erano. */
export const fillText = (tpl, vars = {}) => String(tpl ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));

const eurIt = (n) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dateIt = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('it-IT') : '');

/** Variabili dei testi per una riparazione (importo e' un numero: si passa a parte quando cambia con l'opzione scelta). */
export function quoteVars(s, r, amount = r.quote) {
  return {
    negozio: s.shop_name, garanzia: r.warranty_days, codice: r.code, dispositivo: r.brand_model,
    importo: amount != null ? eurIt(amount) : '',
    consegna: r.eta_date ? `, con consegna stimata il ${dateIt(r.eta_date)}` : '',
    giorni: storageDays(s), tariffa: storageFee(s),
  };
}

/** Testi della conferma/rifiuto del preventivo mostrati al cliente (l'importo resta {importo}: dipende dall'opzione scelta). */
export function buildQuoteFlow(s, r, options = []) {
  const v = { ...quoteVars(s, r), importo: '{importo}' };
  return {
    options: options.map((o) => ({ id: o.id, label: o.label, amount: o.amount, description: o.description || '' })),
    accept: { title: s.quote_accept_title, text: fillText(s.quote_accept_text, v) },
    decline: { title: s.quote_decline_title, text: fillText(s.quote_decline_text, v), pickup: fillText(s.quote_decline_pickup, v), cede: fillText(s.quote_decline_cede, v) },
    sign_text: s.quote_sign_text,
    storage_days: storageDays(s),
    draft: !isVerified(s),
  };
}

export const LEGAL_NOTE = 'Bozza da far verificare (non consulenza legale)';
export const isVerified = (s) => String(s?.legal_verified) === '1';
export const storageDays = (s) => Math.max(1, Number(s?.storage_days) || 15);
export const storageFee = (s) => (String(s?.storage_fee || '').trim() || 'tariffa da definire');
