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
    'Affido a {negozio} il dispositivo descritto in scheda per diagnosi e riparazione. Dichiaro di avere letto le condizioni riportate (preventivo indicativo fino all’approvazione, termini di ritiro, garanzia di {garanzia} giorni sulla riparazione, che non limita i miei diritti previsti dalla legge; responsabilità sui dati: ho effettuato o rinuncio al backup, e il laboratorio non risponde dei dati presenti sul dispositivo) e di avere ricevuto l’informativa sul trattamento dei miei dati personali (art. 13 Regolamento UE 2016/679, GDPR) disponibile in negozio e sul sito: i dati servono a eseguire la riparazione e gli obblighi di legge e non sono ceduti a terzi, se non per obbligo di legge. Autorizzo il laboratorio ad accedere al dispositivo per i soli controlli necessari alla riparazione, senza copiare o consultare dati personali non necessari.',
  quote_accept_title: 'Confermi il preventivo?',
  quote_accept_text:
    'Stai accettando il preventivo n. {codice} di {importo} per la riparazione di {dispositivo}{consegna}. Con la conferma autorizzi il laboratorio a eseguire i lavori descritti. Se non vengono eseguiti, o se vengono eseguiti solo in parte, hai diritto al ritiro del dispositivo. Se rinunci dopo l’inizio dei lavori, dovrai pagare solo le attività già svolte e i ricambi già acquistati o montati. L’importo può cambiare solo se ti avvisiamo e tu confermi di nuovo.',
  quote_decline_title: 'Rifiuti il preventivo?',
  quote_decline_text: 'Stai rifiutando il preventivo n. {codice}. Il dispositivo non verrà riparato. Scegli cosa fare:',
  quote_decline_pickup:
    'Passerò a ritirarlo. Il dispositivo resta in negozio {giorni} giorni dalla data di questa scelta. Dopo tale termine potrà essere custodito in deposito a pagamento ({tariffa}); potrò sempre ritirarlo pagando quanto dovuto. Prima di qualsiasi altra decisione sul dispositivo riceverò un ulteriore avviso scritto.',
  quote_decline_cede:
    'Cedo il dispositivo al negozio. Dichiaro di essere il proprietario del dispositivo e cedo la proprietà al laboratorio, che potrà smaltirlo oppure recuperarne e riutilizzarne i componenti, senza nulla dovere al cliente. Ho già effettuato o rinuncio al backup dei miei dati e ho rimosso o autorizzo la rimozione di codici di sblocco e account.',
  quote_sign_text: 'Firmando confermo di avere letto e compreso quanto sopra e che la scelta è mia.',
  storage_notice:
    'Ciao {nome}, il tuo {dispositivo} (rif. {codice}) non è stato riparato e ti aspetta in negozio dal {data}. Dal {scadenza} sarà custodito in deposito a pagamento ({tariffa}) oppure, dopo un ulteriore avviso scritto, potrà essere smaltito/ceduto secondo le condizioni che hai firmato. Puoi sempre ritirarlo pagando quanto dovuto. Passa a ritirarlo o scrivici per accordarci: {telefono}.',
};

/** Sostituisce i segnaposto {nome}; quelli sconosciuti restano com'erano. */
export const fillText = (tpl, vars = {}) => String(tpl ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));

const eurIt = (n) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
/** Importo come lo vede il cliente: IVA inclusa = solo il totale (come sempre); IVA esclusa = totale con imponibile e IVA. */
export const priceText = (gross, net, rate, mode) => (gross == null ? '' : mode === 'net' && net != null ? `${eurIt(gross)} IVA inclusa (imponibile ${eurIt(net)} + IVA ${rate ?? 22}% ${eurIt(Math.round((gross - net) * 100) / 100)})` : eurIt(gross));
const dateIt = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('it-IT') : '');

/** Variabili dei testi per una riparazione (importo e' un numero: si passa a parte quando cambia con l'opzione scelta). */
export function quoteVars(s, r, amount = r.quote, text = null) {
  return {
    negozio: s.shop_name, garanzia: r.warranty_days, codice: r.code, dispositivo: r.brand_model,
    importo: text ?? (amount != null && amount === r.quote ? priceText(r.quote, r.quote_net, r.quote_vat_rate, r.quote_vat_mode) : amount != null ? eurIt(amount) : ''),
    consegna: r.eta_date ? `, con consegna stimata il ${dateIt(r.eta_date)}` : '',
    giorni: storageDays(s), tariffa: storageFee(s),
  };
}

/** Testi della conferma/rifiuto del preventivo mostrati al cliente (l'importo resta {importo}: dipende dall'opzione scelta). */
export function buildQuoteFlow(s, r, options = []) {
  const v = { ...quoteVars(s, r), importo: '{importo}' };
  return {
    options: options.map((o) => ({ id: o.id, label: o.label, amount: o.amount, description: o.description || '', mode: o.mode || 'gross', list_amount: o.list_amount ?? null, discount: o.discount || 0, discount_pct: o.discount_pct ?? null, net: o.net ?? null, vat: o.vat ?? null, vat_rate: o.vat_rate ?? 22, amount_text: priceText(o.amount, o.amount_net, o.vat_rate, o.mode) })),
    quote_text: priceText(r.quote, r.quote_net, r.quote_vat_rate, r.quote_vat_mode),
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
