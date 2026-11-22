---
title: Microsoft Edge in arrivo con una modalità blindata che disattiva WebGL e WebGPU
date: 2026-11-22
description: Microsoft sta testando su Edge una Lockdown Mode pensata per chi rischia attacchi mirati, che secondo le stime dell'azienda avrebbe bloccato circa il 60 per cento degli attacchi osservati.
---

Microsoft sta sperimentando su Edge una nuova funzione chiamata Lockdown Mode, pensata per chi ha bisogno di una protezione superiore alla media perché più esposto ad attacchi mirati, come giornalisti, dirigenti aziendali, amministratori di sistema e ricercatori di sicurezza. La notizia, riportata il 19 novembre da BleepingComputer, riguarda per ora solo la versione Canary del browser, cioè il canale sperimentale destinato a chi prova in anticipo le novità non ancora definitive.

## Cosa disattiva e perché

La funzione blocca l'accesso alle API grafiche WebGL, WebGL2 e WebGPU, usate dai siti web per gestire grafica avanzata, giochi interattivi e mappe. Sono proprio queste componenti, insieme ad altre parti complesse del motore del browser, a essere spesso il punto di ingresso usato dagli attacchi più sofisticati per uscire dall'ambiente protetto del browser e raggiungere il resto del sistema. Secondo le stime di Microsoft citate nell'articolo, disattivare queste API avrebbe impedito circa il 60 per cento degli attacchi di escalation dei privilegi osservati nel mondo reale. La funzione si ispira concettualmente alla Lockdown Mode già presente su iPhone e Mac, e si basa sulla modalità di sicurezza avanzata già esistente in Edge, che disattiva la compilazione just-in-time nel motore JavaScript.

## Un compromesso, non una soluzione per tutti

Attivare la Lockdown Mode ha un costo evidente: i siti che si basano su quelle API, dai giochi del browser alle mappe interattive, possono smettere di funzionare correttamente, e per questo motivo Microsoft la presenta come un'opzione pensata per chi accetta consapevolmente minore compatibilità in cambio di maggiore sicurezza, non come impostazione per l'utente medio. Al momento si attiva manualmente nel canale Canary tramite un flag sperimentale, e l'azienda prevede in futuro di permettere eccezioni per singoli siti ritenuti affidabili.

Chi non rientra in queste categorie a rischio elevato può comunque trarre un insegnamento pratico dalla notizia: le funzioni di sicurezza avanzata dei browser esistono già oggi, nascoste nelle impostazioni, e vale la pena controllare periodicamente cosa offre il proprio browser invece di affidarsi solo alle impostazioni di default.
