---
title: Windows 11, l'aggiornamento di ottobre blocca l'attivazione di Smart App Control
date: 2026-10-18
description: Microsoft confirma che l'update KB5127648 impedisce di riattivare una delle protezioni di sicurezza di Windows 11 su alcuni PC, e per ora indica solo un rimedio manuale.
---

Microsoft ha confermato un problema introdotto dall'aggiornamento KB5127648, distribuito con il Patch Tuesday di ottobre, come riporta BleepingComputer. Sui PC con Windows 11 24H2, 25H2 e 26H2 dove la funzione Smart App Control era stata disattivata, l'interruttore per riaccenderla risulta "grigio" e non più selezionabile nelle impostazioni. Chi invece l'aveva già attiva prima di installare l'aggiornamento non è toccato dal problema: la protezione resta accesa e funzionante, parola di Microsoft stessa nelle note di rilascio.

## Cos'è Smart App Control e chi rischia davvero

Smart App Control è la funzione che blocca sul nascere le applicazioni sospette o senza una firma digitale riconosciuta, pensata soprattutto per chi installa spesso software da fonti diverse. Il problema riguarda quindi in modo concreto solo chi aveva scelto di disattivarla in passato e ora vorrebbe tornare indietro: su quei PC, al momento, l'opzione resta bloccata. Non è invece un problema per chi non l'ha mai toccata o per chi gestisce un solo computer con installazioni controllate.

## Cosa fare in attesa della correzione

Microsoft non ha ancora rilasciato una soluzione definitiva, ma ha indicato un rimedio tramite due comandi da eseguire nel Prompt dei comandi aperto come amministratore, che modificano una chiave del registro di sistema e richiedono un riavvio; le aziende con più PC da gestire possono invece intervenire con policy di gruppo dedicate. Chi non si sente sicuro a modificare il registro di Windows da solo, specialmente su un PC usato per lavoro, farebbe meglio ad aspettare l'arrivo di una correzione ufficiale invece di intervenire manualmente: nessuna delle due modifiche è reversibile con un semplice clic, e un errore di digitazione in quella sezione del registro può creare più problemi di quello che si vuole risolvere.
