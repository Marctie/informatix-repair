# Direttive di Christian (modifiche e miglioramenti al gestionale)

Raccolte da Marco il 2026-10-14, una per volta. NON implementare finche' Marco non dice che l'elenco e' completo. Ogni voce ha: testo originale, come l'ho capita, domande aperte, stato.

## 1. Bug: notifica "dati demo cancellati" aprendo le Impostazioni
**Testo**: "Quando vado nelle impostazioni mi arriva la notifica dei dati demo cancellati quando poi non l'ho nemmeno cliccato quel bottone. Correggi!"
**Causa**: aprendo le Impostazioni la pagina legge lo stato demo con `GET /api/demo`; il testo della notifica trattava ogni richiesta diversa da POST come "eliminati".
**Stato**: CORRETTO (2026-10-14). Notificano solo POST/DELETE; test su tutte le letture (`GET` non avvisa mai).

## 2. Riparazione "Annullato / non riparabile": destino del dispositivo
**Testo**: "Su annullato non riparabile bisognerebbe inserire, se il dispositivo l'ha ripreso, lo lascia da smaltire/pezzi di ricambio o sta ancora in giacenza (e dal momento del rifiuto 15 giorni di tempo prima di uno smaltimento o spostamento in deposito cauzionale a pagamento)".
**Come l'ho capita**: quando una riparazione passa a "Annullato / non riparabile" si deve registrare cosa succede al dispositivo, con tre esiti: (a) **ritirato** dal cliente; (b) **lasciato da smaltire / per pezzi di ricambio**; (c) **in giacenza** in negozio. Dal momento del rifiuto parte un conto alla rovescia di **15 giorni**; scaduto il termine il gestionale avvisa (campanella, home, Telegram) che il dispositivo va **smaltito** oppure **spostato in deposito cauzionale a pagamento**.
**Domande aperte**: 1) Il termine di 15 giorni parte dalla data in cui il cliente rifiuta o da quando si segna "non riparabile"? 2) Il "deposito cauzionale a pagamento": quanto costa e come (importo fisso, al giorno, al mese)? Va registrato come incasso con il cliente avvisato? 3) Alla scadenza basta un avviso o deve cambiare in automatico lo stato? 4) Se "per pezzi di ricambio", il dispositivo va caricato in magazzino come articolo/ricambi recuperati? 5) Si vuole un messaggio per il cliente (WhatsApp precompilato) con il termine e le condizioni? 6) Va stampato un documento firmato dal cliente (liberatoria allo smaltimento)?
**Stato**: da fare (in attesa del resto dell'elenco).

## 3. Pagamenti "non tracciato" / incassi nascosti ai controlli — PARTE NON IMPLEMENTATA
**Testo**: non usare la voce "non tracciato"; trovare un modo per gestire pagamenti "a nero" nel gestionale "tracciati ma nascosti"; l'utente info@informatixrepair.it (cassa) li puo' caricare; "in caso di controllo non appaiono in nessun punto dell'app"; solo Christian (admin) li vede, anche nell'analisi.
**Decisione**: la parte "incassi nascosti ai controlli" NON viene realizzata (serve a occultare ricavi a chi controlla): nessun flag nascosto, nessuna esclusione dai totali, nessun incasso invisibile. Il metodo gia' esistente "non tracciato" e l'impostazione `cash_show_untracked` non vanno estesi; proposta: RIMUOVERLI (database vuoto, nessun dato da migrare). In attesa di conferma di Marco.
**Parte realizzabile**: ruolo **"Cassa"** per info@informatixrepair.it: vendite, incassi, spese, riparazioni; senza Analisi, margini, Utenti, Impostazioni (permessi per ruolo, non occultamento di incassi). Christian resta admin con visibilita' completa. Da fare dopo l'elenco completo.
