---
title: BlackX, un bootkit bypassa il Secure Boot anche su Windows aggiornato
date: 2026-10-24
description: Un rapporto di Kaspersky descrive BlackX, un bootkit UEFI usato contro organizzazioni diplomatiche in Asia centrale, che sfrutta una vecchia falla mai chiusa del tutto per superare il Secure Boot.
---

I ricercatori di Kaspersky hanno pubblicato su Securelist un'analisi di BlackX, un bootkit UEFI che riesce a bypassare il Secure Boot anche su computer Windows con tutte le patch Microsoft installate. Il problema sfruttato, noto come Baton Drop (CVE-2022-21894), è stato corretto da Microsoft anni fa, ma resta efficace perché il certificato vulnerabile non è mai stato inserito nella lista di revoca che blocca i file firmati non più fidati, nonostante quel certificato specifico sia scaduto il 19 ottobre 2026.

## Come funziona l'attacco

Secondo Kaspersky, BlackX installa chiavi proprie (Machine Owner Keys) per caricare componenti EFI prima ancora che si avvii il sistema operativo, ottenendo così persistenza e capacità di eludere gli strumenti di sicurezza. Il bootkit richiede però che l'attaccante abbia già accesso privilegiato o fisico al dispositivo: non è un virus che si diffonde da solo, ma uno strumento usato dopo aver già violato una rete. Il payload include un driver kernel malevolo e un malware di controllo remoto che comunica tramite servizi cloud comuni come Google Drive, OneDrive e Yandex Disk.

## Chi è stato colpito

La campagna osservata nei primi mesi del 2026 ha preso di mira organizzazioni diplomatiche in Tagikistan, Uzbekistan e Turkmenistan. Kaspersky collega l'operazione, con un livello di confidenza basso, al gruppo APT41, legato alla Cina, sulla base di somiglianze nel codice con un'altra campagna documentata da ESET.

## Cosa significa per gli utenti comuni

Per la maggior parte delle persone il rischio concreto è basso, perché l'attacco richiede un accesso già avvenuto al computer. Resta comunque una conferma utile: tenere Windows sempre aggiornato, evitare di installare software da fonti non verificate e non collegare al PC chiavette o dispositivi di provenienza incerta riduce in modo concreto le occasioni che un malintenzionato può sfruttare per arrivare a questo tipo di attacco.
