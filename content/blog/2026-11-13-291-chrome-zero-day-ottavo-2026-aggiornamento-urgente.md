---
title: Chrome corregge un nuovo zero-day sfruttato attivamente, è l'ottavo del 2026
date: 2026-11-13
description: Google ha rilasciato un aggiornamento urgente di Chrome per correggere una falla già usata in attacchi reali, la ottava di quest'anno.
---

Google ha distribuito il 10 novembre un aggiornamento di emergenza per Chrome su Windows, Mac e Linux, portando il browser alla versione 157.0.8103.50 (157.0.8103.51 su Windows e Mac). La correzione riguarda una vulnerabilità identificata come CVE-2026-125350, con un punteggio di gravità alta di 8.8 su 10, e secondo l'azienda esiste già un exploit che la sfrutta in attacchi reali, anche se Google non ha diffuso dettagli su chi lo stia usando né contro chi.

## Un difetto nella gestione dell'XML

Il problema è un cosiddetto use-after-free nel componente che gestisce i documenti XML all'interno del browser: in pratica Chrome continua a usare una porzione di memoria già liberata, e questo può permettere a chi costruisce una pagina web appositamente malevola di eseguire codice all'interno della sandbox del browser. La falla è stata segnalata il 6 novembre da un ricercatore di sicurezza che ha preferito restare anonimo, e Google ha pubblicato la correzione quattro giorni dopo. Si tratta dell'ottavo zero-day di Chrome sfruttato attivamente nel corso del 2026, un numero che conferma quanto il browser resti uno dei bersagli preferiti di chi cerca falle da monetizzare o da usare in campagne di spionaggio.

## Come controllare di essere protetti

Chrome si aggiorna da solo in background, ma la correzione diventa effettiva solo dopo aver riavviato il browser. Per verificare la versione installata basta aprire il menu con i tre puntini in alto a destra, scegliere Guida e poi Informazioni su Google Chrome: se è disponibile un aggiornamento, la pagina lo scarica automaticamente e mostra un pulsante per riavviare. Lo stesso vale per i browser basati su Chromium come Edge o Brave, che però in genere ricevono la correzione con qualche giorno di ritardo rispetto a Chrome.

Chi usa il computer anche per home banking o per gestire documenti di lavoro dovrebbe evitare di rimandare il riavvio del browser oltre la giornata in cui compare la notifica di aggiornamento: è il momento in cui la finestra di rischio resta più aperta.
