---
title: Due falle critiche in Citrix NetScaler sfruttate attivamente, aggiornare subito
date: 2026-09-28
description: Citrix ha confermato che due vulnerabilità gravi nei suoi apparati NetScaler vengono già usate per attacchi in corso, con patch disponibile.
---
Chi gestisce reti aziendali con apparati Citrix NetScaler ADC o NetScaler Gateway ha ricevuto in questi giorni un avviso da prendere sul serio. Citrix ha confermato due vulnerabilità critiche, indicate come CVE-2026-88771 e CVE-2026-88772, entrambe con un punteggio di gravità di 9,5 su 10. Secondo BleepingComputer e watchTowr, la società ha scoperto i problemi indagando su incidenti reali segnalati da alcuni clienti, dopo una prima notifica arrivata dal centro nazionale di sicurezza informatica olandese.

## Cosa permettono le due falle

La prima consente l'esecuzione di codice da remoto per una gestione scorretta dei dati in ingresso, senza che l'aggressore debba autenticarsi. La seconda riguarda un overflow di memoria che può portare sia all'esecuzione di codice sia al blocco del dispositivo. Sono colpite le versioni NetScaler 14.1 precedenti alla 14.1-73.37 e 13.1 precedenti alla 13.1-64.23, comprese le varianti FIPS e Secure Private Access Hybrid.

## Attacchi già in corso

Citrix stessa ha dichiarato di aver osservato tentativi di sfruttamento su installazioni non ancora protette. Non si tratta quindi di un rischio teorico: la falla viene già usata contro apparati esposti su internet, che in molte aziende fanno da porta d'ingresso per l'accesso remoto dei dipendenti.

## Cosa fare

La patch è disponibile nel bollettino CTX697096 e risolve otto vulnerabilità in totale. Chi amministra uno di questi dispositivi dovrebbe installarla il prima possibile, senza aspettare la finestra di manutenzione successiva. Se l'aggiornamento immediato non è possibile, conviene almeno limitare l'esposizione diretta a internet del pannello di gestione. Per chi non ha personale IT interno dedicato, episodi come questo ricordano perché vale la pena affidare il controllo periodico di router, firewall e apparati di accesso remoto a chi se ne occupa di mestiere, prima che il problema si presenti da solo.
