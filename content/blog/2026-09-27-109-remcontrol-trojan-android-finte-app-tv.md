---
title: RemControl, il trojan Android che finge di essere un'app TV e punta l'Italia
date: 2026-09-27
description: I ricercatori di Group-IB hanno scoperto RemControl, un malware bancario per Android diffuso con pagine false del Play Store che colpisce in modo specifico gli utenti italiani.
---
I ricercatori di Group-IB hanno individuato un nuovo trojan bancario per Android, chiamato RemControl, diffuso attraverso pagine che imitano il Google Play Store. L'esca è TVTap, un'app di streaming IPTV non disponibile sullo store ufficiale: proprio per questo molti utenti sono già abituati a cercarla altrove, e finiscono su siti clone promossi con annunci a pagamento su Meta.

## Come funziona la trappola

Secondo Group-IB, le pagine false vengono mostrate soltanto a chi naviga da uno smartphone con indirizzo IP italiano, mentre altri visitatori vedono contenuti innocui: una tecnica pensata apposta per colpire un pubblico specifico. Chi scarica l'app finta installa in realtà il malware, che chiede subito i permessi di Accessibilità, uno strumento pensato per chi ha difficoltà a usare lo schermo ma che, se concesso a un'app sbagliata, dà accesso quasi totale al dispositivo.

## Cosa succede dopo l'installazione

Una volta attivo, RemControl usa una VPN locale per ostacolare i controlli di Google Play Protect, mostra schermate finte sopra le vere app bancarie per rubare le credenziali e permette a chi lo controlla di vedere lo schermo e i tocchi della vittima in tempo reale. Group-IB ha contato oltre trenta schermate di phishing personalizzate per banche di Italia, Spagna, Francia, Portogallo, Polonia, Canada e Medio Oriente.

## Come proteggersi

La difesa più efficace resta installare app solo dal Play Store ufficiale, evitando di scaricare file APK da siti esterni anche quando l'app cercata non è disponibile in modo legale. Vale la pena diffidare di qualsiasi app, anche apparentemente innocua, che al primo avvio chiede i permessi di Accessibilità: pochissimi programmi ne hanno davvero bisogno. Se il telefono inizia a comportarsi in modo strano dopo un'installazione recente, come rallentamenti improvvisi o richieste di permessi insistenti, conviene disinstallare l'app sospetta e cambiare al più presto le password dei servizi bancari usati sul dispositivo.
