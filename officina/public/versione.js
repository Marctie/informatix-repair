// Versione del gestionale: maggiore.minore.funzione.correzione (0.0.0.0).
// Quando esce una funzione nuova si alza "funzione" e "correzione" torna a 0; una correzione alza solo l'ultimo numero.
// Maggiore/minore cambiano per scelte grosse (nuova area, riscrittura). Aggiungi la nuova voce IN CIMA a NOTES e aggiorna VERSION.
import { esc, openModal } from './util.js';

export const VERSION = '1.0.5.0';

export const NOTES = [
  { v: '1.0.5.0', date: '2026-11-04', type: 'funzione', items: [
    'Tecnico assegnato e fase della riparazione (es. «Inviato al centro Samsung»), visibile anche al cliente. Stati rinominabili e nascondibili da Impostazioni → Stati e fasi. Statistiche per tecnico in Analisi.',
    'Usato a margine: registro dei beni usati comprati da privati, vendita dalla cassa con la dicitura del regime del margine, cartellino da stampare e riepilogo dell’IVA sul margine.',
    'Ritiro in permuta in cassa: il valore si scala dal totale e il bene entra nel registro dell’usato.',
    'Estensioni di garanzia a pagamento con certificato da mandare al cliente; ricevuta di vendita su WhatsApp; nel link della riparazione il cliente scarica ricevuta e certificato.',
    'Proposta d’ordine calcolata dalle scorte e dai consumi (un ordine per fornitore) e arrivo merce con controllo delle differenze e carico automatico.',
    'Listino pubblico delle riparazioni, esportazioni per Excel, permessi per singolo utente, previsioni di fine mese e Agenda delle scadenze.',
  ] },
  { v: '1.0.4.0', date: '2026-11-03', type: 'funzione', items: [
    'Assistente: risposte istantanee (senza aspettare il modello) per le richieste ricorrenti: articoli sotto scorta, ordini sotto scorta, com’è andata oggi, riparazioni in ritardo o pronte, preventivi da approvare, controllo dati, articoli fermi. I suggerimenti «Per te adesso» e gli esempi completi partono con un clic.',
    'Assistente: nuove funzioni. Dettatura a voce (🎤), suggerimenti «Per te adesso» calcolati dai dati (articoli sotto scorta, riparazioni pronte o in ritardo…) e il pannello «Cosa posso fare per te» con esempi cliccabili per ogni funzione, compreso l’inserimento dei dati.',
    'Messaggi pronti per il cliente (riparazione pronta, ritardo, preventivo) con il pulsante «Apri su WhatsApp».',
    'Promemoria, nuovo fornitore, nuova spesa, ordini al fornitore (anche in automatico per gli articoli sotto scorta, uno per fornitore) e preventivi scritti a frase.',
    'Carico da documento del fornitore con costo, storico prezzi e avvisi sugli aumenti (come il carico a mano di Magazzino).',
    'Controllo dei dati (clienti doppi, articoli senza prezzo, vetrina senza foto) e «Com’è andata oggi?».',
    'Preferenze: «d’ora in poi arrotonda i prezzi a 9» e l’assistente le rispetta sempre (le toglie l’amministratore dalla pagina). L’assistente usa anche il ricarico abituale per categoria, calcolato dai dati veri, per consigliare i prezzi.',
  ] },
  { v: '1.0.3.0', date: '2026-11-03', type: 'funzione', items: [
    'Assistente (menu Portale › Assistente): scrivi in italiano normale cosa ti serve — caricare pezzi a magazzino, cambiare lo stato di una riparazione, aggiungere un articolo in vetrina, creare una scheda di riparazione — oppure chiedi consigli e informazioni (scorte basse, riparazioni ferme, che prezzo mettere).',
    'Puoi allegare l’ordine di un fornitore (foto, PDF o CSV): l’assistente prepara i carichi di magazzino e gli articoli nuovi.',
    'Prima di ogni operazione c’è sempre un riepilogo con quello che cambia (prima → dopo) e non parte niente finché non premi «Conferma». Il prezzo si può correggere nel riepilogo.',
    'L’assistente non incassa, non consegna e non elimina. Ogni operazione confermata finisce nel Registro e negli avvisi Telegram come se l’avessi fatta a mano.',
    'Cronologia delle richieste conservata 30 giorni. Se il PC con l’LLM è spento, le richieste restano in coda e partono appena si riaccende (te lo segnala il gestionale e Telegram).',
  ] },
  { v: '1.0.2.1', date: '2026-10-27', type: 'correzione', items: ['Segnalazioni: grafica rifatta. Schede in elenco con il colore dello stato, dettaglio a riquadri, cronologia come una conversazione, pannello di gestione più compatto e invio del commento con Ctrl+Invio.'] },
  { v: '1.0.2.0', date: '2026-10-26', type: 'funzione', items: [
    'Magazzino: colonna «Margine» e riga «Guadagno» nel modulo articolo (prezzo senza IVA meno costo).',
    'Listini: prezzo amico e prezzo rivenditore per articolo, con il menu «Listino prezzi» in Vendite.',
    'Vendite: tasto «Stampa riepilogo» per dare al cliente (anche rivenditore) gli articoli e il totale prima di incassare, su foglio A4, scontrino 80 mm o PDF.',
    'Nuovo articolo: tasto «Salva e stampa etichetta», senza dover salvare e riaprire.',
    'Numero di versione e note di rilascio (questa finestra).',
    'Il costo d’acquisto è senza IVA e il campo gemello mostra quello con IVA; il prezzo di vendita è con IVA e il gemello mostra quello senza.',
  ] },
  { v: '1.0.1.2', date: '2026-10-26', type: 'correzione', items: ['Ogni stampa di etichette viene registrata nel Registro (utile per capire gli errori della stampante).'] },
  { v: '1.0.1.1', date: '2026-10-26', type: 'correzione', items: ['Etichette Brother QL-800 e QL-1100: niente più etichetta bianca dopo ogni stampa; elenco con le misure reali dei rotoli.'] },
  { v: '1.0.1.0', date: '2026-10-26', type: 'funzione', items: ['Prezzi senza IVA: in Nuovo articolo e nel Carico merce si scrive il prezzo con o senza IVA e l’altro si calcola.'] },
  { v: '1.0.0.0', date: '2026-10-25', type: 'base', items: ['Versione di partenza: tutto il gestionale fino a questa data.'] },
];

export function openReleaseNotes() {
  openModal(
    `<section class="sec"><p class="hint">Numero di versione: <b>maggiore.minore.funzione.correzione</b>. Una funzione nuova azzera le correzioni.</p>
    ${NOTES.map((n) => `<div class="sec" style="gap:.2rem;margin-top:.7rem"><h3 class="sec-t">v${esc(n.v)} <span class="hint" style="font-weight:500">· ${esc(n.date.split('-').reverse().join('/'))} · ${esc(n.type)}</span></h3><ul style="margin:0;padding-left:1.1rem">${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</section>`,
    { title: `Versione ${VERSION}`, wide: true, footer: '<button class="btn btn-outline" data-close>Chiudi</button>' }
  );
}
