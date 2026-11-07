---
title: Una falla Android manda il telefono in un loop di riavvii continui
date: 2026-11-07
description: Bitdefender ha scoperto una vulnerabilità, chiamata GhostMap, che permette a un'app senza permessi di bloccare un telefono Android in un ciclo di riavvii; Google non ha ancora rilasciato una correzione.
---

Bitdefender ha reso pubblica il 6 novembre una vulnerabilità di Android ribattezzata GhostMap, scoperta mentre i ricercatori analizzavano un trojan bancario che andava in crash negli emulatori durante l'installazione. La falla permette a un'app, anche priva di permessi e senza codice da eseguire, di mandare il telefono in un ciclo di riavvii continui non appena viene installata.

## Come si attiva il blocco

Secondo Bitdefender il problema nasce da due librerie Android che interpretano in modo diverso i metodi di compressione dei file ZIP. Un APK costruito in modo anomalo riesce così a far leggere al sistema una porzione di memoria che va oltre il contenuto reale del file, provocando un errore che blocca il processo di sistema `system_server`. Nei test riportati da BleepingComputer il primo riavvio è arrivato circa un secondo dopo l'installazione e si è ripetuto decine di volte, anche in modalità provvisoria, impedendo di usare quella via per rimuovere l'app incriminata.

## Nessuna correzione ancora disponibile

I ricercatori hanno segnalato la falla a Google il 20 agosto, ma l'azienda l'ha classificata come non riproducibile e fuori dagli aggiornamenti di sicurezza già in programma. Al momento della pubblicazione della notizia da parte di BleepingComputer, Google non aveva ancora chiarito se e quando arriverà una patch. L'unico modo verificato per uscire dal blocco resta il ripristino di fabbrica, che però cancella tutti i dati, oppure la rimozione del file incriminato tramite ADB, operazione che richiede il debug USB già attivo e competenze tecniche specifiche.

Dato che la falla si attiva all'installazione e non quando l'app viene avviata, la prevenzione conta più della cura: meglio scaricare applicazioni solo dagli store ufficiali ed evitare file APK proposti da siti o messaggi non verificati, in particolare quando promettono funzioni insolite o contenuti altrove a pagamento gratis.
