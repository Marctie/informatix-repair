---
title: Plex2Shell, le falle nel server multimediale già sfruttate dagli hacker
date: 2026-10-23
description: CISA segnala attacchi attivi contro quattro vulnerabilità di Plex Media Server, il software usato da molti utenti per gestire film e serie in casa.
---

L'agenzia statunitense per la cybersicurezza CISA ha segnalato attacchi in corso contro quattro vulnerabilità di Plex Media Server, il popolare software per organizzare e guardare in streaming film, serie e musica dal proprio PC o NAS di casa, secondo quanto riportato il 21 ottobre da BleepingComputer. L'insieme delle falle è stato battezzato Plex2Shell.

## Come funziona la catena di attacco

Le quattro vulnerabilità, individuate dal ricercatore Zach Main, riguardano una falsificazione di richieste lato server senza bisogno di autenticazione, un'iniezione nella funzione di ricerca che può richiamare altri plugin, una seconda falsificazione di richieste che richiede invece un account autenticato, e una scrittura di file arbitraria nelle impostazioni del transcoder che permette di caricare librerie malevole eseguite poi dal software. Concatenate tra loro, le falle permettono di ottenere il token di amministratore del proprietario e di eseguire codice con privilegi elevati: il punteggio di gravità dell'intera catena è 9,8 su 10, il livello più alto.

## Sfruttamento già in corso e cosa fare

I dettagli tecnici sono stati pubblicati il 16 ottobre, seguiti tre giorni dopo da un codice di exploit pubblico; le prime segnalazioni di attacchi reali, inizialmente contro sistemi-trappola usati per installare un software di mining di criptovalute, sono arrivate il 17 ottobre. CISA ha chiesto alle agenzie federali statunitensi di applicare la correzione o le misure di mitigazione entro il 23 ottobre, segno della serietà del problema anche per chi non lavora in ambito governativo.

Sono vulnerabili le versioni di Plex Media Server precedenti alla 1.43.3.10861, rilasciata il 4 agosto. Chi ha installato Plex su un PC, un NAS o un piccolo server domestico dovrebbe controllare subito la versione in uso dal pannello di amministrazione e aggiornare a quella più recente disponibile. Un consiglio aggiuntivo per chi gestisce un server multimediale in casa: evitare di esporre l'interfaccia di amministrazione direttamente su internet senza una reale necessità, perché riduce di molto la superficie raggiungibile da un attacco di questo tipo.
