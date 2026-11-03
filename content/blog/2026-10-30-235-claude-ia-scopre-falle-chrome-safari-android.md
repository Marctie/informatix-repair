---
title: Un modello Claude non ancora pubblico ha trovato falle gravi in Chrome, Safari e Android
date: 2026-10-30
description: Uno studio di Anthropic racconta come un modello sperimentale abbia scritto exploit funzionanti contro browser e sistemi operativi, tutti già corretti dai produttori.
---

Anthropic, l'azienda che sviluppa l'assistente Claude, ha pubblicato il 27 ottobre una ricerca in cui un modello ancora in fase di sviluppo ha scritto exploit completi contro alcuni dei software più usati al mondo. Non si tratta di un attacco reale: i test sono stati condotti in laboratorio e ogni falla è stata segnalata ai produttori prima della pubblicazione dello studio.

## Cosa ha scoperto il modello

Secondo Anthropic, il modello ha messo insieme più bug distinti in catene di attacco complete. Su Chrome ha unito quattro difetti, a partire da una corruzione di memoria nel motore JavaScript V8, riuscendo a uscire dalla sandbox del browser con un solo clic della vittima. Su Safari ha sfruttato una falla in JavaScriptCore per leggere cronologia, cookie e sessioni aperte, senza bisogno di eseguire codice. Su un Google Pixel bloccato, con accesso fisico al telefono tramite USB, ha estratto foto e dati personali combinando tre difetti separati nella gestione del collegamento. Google ha assegnato 62 identificativi CVE legati al solo lavoro su Chrome, classificati come alti o critici.

## Le correzioni sono già arrivate

Google ha corretto le falle di Chrome a partire dalla versione 156, rilasciata il 20 ottobre, le cui note di rilascio citano un ricercatore di Anthropic assistito da Claude. Anche Apple e Google hanno confermato le segnalazioni e distribuito le rispettive correzioni per Safari e Android.

La notizia non significa che i dispositivi in uso siano a rischio immediato: significa che chi non aggiorna resta esposto più a lungo a problemi già risolti altrove. Aggiornare subito browser e sistema operativo, anche sui dispositivi più vecchi, resta il modo più semplice per non lasciare margini a chi conta proprio sui ritardi negli aggiornamenti.
