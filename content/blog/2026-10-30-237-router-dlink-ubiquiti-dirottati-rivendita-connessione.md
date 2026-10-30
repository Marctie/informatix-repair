---
title: Router e NAS dirottati per rivendere la tua connessione a tua insaputa
date: 2026-10-30
description: Una ricerca di GreyNoise ha scoperto decine di dispositivi D-Link e Ubiquiti compromessi e trasformati in nodi di una rete di proxy residenziali.
---

I ricercatori di sicurezza di GreyNoise hanno individuato una campagna che sfrutta falle note in dispositivi di rete molto diffusi per trasformarli in nodi di una rete di proxy residenziali, rivendendo la connessione a Internet delle vittime senza che queste se ne accorgano. La scoperta, pubblicata a metà ottobre e ripresa nei giorni scorsi da Red Hot Cyber oltre che da BleepingComputer e TechRadar, riguarda almeno 143 dispositivi compromessi in 34 paesi.

## Come avviene l'attacco

Secondo GreyNoise, gli attaccanti entrano sfruttando vulnerabilità già note da tempo nei NAS D-Link ShareCenter, identificate come CVE-2024-3272 e CVE-2024-3273, e la falla Log4Shell nei videoregistratori di rete Ubiquiti UniFi Video, oltre ad alcuni registratori Hikvision e Dahua. Una volta ottenuto l'accesso, installano senza consenso Pawns.app, un'applicazione legittima che normalmente permette di guadagnare qualcosa condividendo la propria connessione: in questo modo la banda della vittima finisce rivenduta a terzi attraverso una rete di proxy residenziali. In alcuni casi i ricercatori hanno trovato anche una chiave SSH aggiunta dagli attaccanti, pensata per mantenere l'accesso anche dopo la rimozione dell'app.

## Cosa conviene controllare

I modelli NAS D-Link ShareCenter coinvolti sono ormai fuori supporto, e il produttore stesso consiglia la sostituzione, non più soltanto l'aggiornamento del firmware. Vale lo stesso principio per qualunque router, NAS o videoregistratore di rete lasciato per anni con il firmware di fabbrica e senza controlli. Chi ha in casa o in ufficio uno di questi dispositivi dovrebbe verificare la versione del firmware installata, cambiare le password di amministrazione predefinite e disattivare l'accesso da remoto quando non è davvero necessario. Sono passaggi semplici, ma riducono di molto il rischio di ritrovarsi, senza saperlo, a lavorare per la rete di qualcun altro.
