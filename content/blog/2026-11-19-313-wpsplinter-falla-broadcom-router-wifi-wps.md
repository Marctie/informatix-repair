---
title: Una falla vecchia sedici anni nei chip Wi-Fi Broadcom resta senza correzione completa
date: 2026-11-19
description: Un ricercatore ha reso pubblica una vulnerabilità nel codice WPS di Broadcom, presente da almeno il 2010, che riguarda router di più marche e per ora non ha una patch definitiva.
---

Il ricercatore di sicurezza Quentin Kaiser ha presentato alla conferenza Hexacon di Parigi, lo scorso ottobre, una vulnerabilità nel software Broadcom per il Wi-Fi Protected Setup, chiamata WPSplinter. Secondo quanto riportano PCWorld, Techzine e AllAboutCookies, il difetto si trova nella gestione della memoria del WPS Monitor ed è presente da almeno sedici anni. Chi si trova nel raggio radio di un router vulnerabile potrebbe eseguire codice sul dispositivo senza conoscere la password Wi-Fi e senza completare alcun abbinamento WPS.

## Quali router sono coinvolti

Le fonti citano chip Broadcom usati su router Asus, TP-Link, Netgear, Cisco e Linksys, sia modelli per privati che per aziende, ma non esiste un elenco completo dei prodotti interessati. In Belgio, Kaiser ha stimato circa 1,5 milioni di dispositivi vulnerabili tra i modem forniti da Proximus, Orange Belgium e VOO. Alcune testate estendono la stima a centinaia di milioni di router nel mondo, dato che gli stessi chip sono usati ovunque, ma si tratta di una proiezione e non di una misurazione diretta. PCWorld riporta inoltre segnalazioni di sfruttamento della falla in attacchi reali, mentre altre fonti consultate non confermano questo punto: è una circostanza da trattare con cautela finché non arrivano conferme più ampie.

## Perché disattivare il WPS non basta sempre

Broadcom aveva già rilasciato una correzione parziale nel 2018, ma secondo Kaiser risulta incompleta. Quando il ricercatore ha segnalato di nuovo il problema a luglio 2026, l'azienda ha rimandato a quella vecchia patch e ha rifiutato di registrare un codice CVE, definendo il codice fuori supporto. Anche i produttori dei singoli router non hanno ancora distribuito una soluzione definitiva. Spegnere il WPS dalle impostazioni del router è comunque consigliabile, ma secondo Kaiser potrebbe non eliminare del tutto il rischio, perché il codice difettoso può restare attivo lo stesso. Cambiare la password del Wi-Fi, invece, non serve a nulla: l'attacco avviene prima di qualsiasi autenticazione.

Chi ha un router di qualche anno, specialmente se fornito dall'operatore e mai aggiornato manualmente, farebbe bene a controllare modello e anno di produzione sul sito del produttore e a verificare se esiste un firmware più recente. Per i dispositivi molto vecchi, ormai fuori supporto, la sostituzione resta spesso la scelta più sicura.
