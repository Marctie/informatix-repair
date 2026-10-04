---
title: Mezzo milione di credenziali ancora attive trovate nel codice pubblico usato per addestrare l'IA
date: 2026-10-04
description: Una ricerca di Truffle Security, segnalata da CERT-AGID, ha trovato oltre 543mila credenziali ancora funzionanti in un grande archivio di codice pubblico di GitHub usato per addestrare modelli di intelligenza artificiale.
---
La società di sicurezza Truffle Security ha analizzato The Stack v3, un archivio pubblico di codice usato per addestrare modelli di intelligenza artificiale, composto da quasi 16 terabyte di dati raccolti da circa 224 milioni di repository di GitHub. Il risultato, segnalato il primo ottobre da CERT-AGID, è preoccupante: 543.699 credenziali trovate nel codice erano ancora valide e funzionanti al momento del controllo, non semplici esempi o dati di test.

## Che tipo di credenziali sono state trovate

Tra i dati individuati ci sono chiavi di accesso a servizi cloud, token per API, credenziali di database e account di servizio, lasciati per errore dagli sviluppatori direttamente dentro il codice invece che in sistemi protetti. Secondo la ricerca, l'età media di queste credenziali ancora attive era di 784 giorni: in molti casi erano online da anni senza che nessuno le avesse mai revocate, nonostante fossero visibili a chiunque consultasse quei repository pubblici.

## Perché riguarda anche le piccole attività

Chi gestisce un sito, un gestionale o anche solo una pagina con integrazioni esterne può commettere lo stesso errore: incollare una password o una chiave di accesso in un file di codice condiviso online, magari per fare prima, e dimenticarla lì per sempre. Una volta pubblicata, anche se il file viene poi corretto o cancellato, la credenziale può restare copiata in altre versioni del progetto o finire comunque in archivi come quello analizzato da Truffle Security. CERT-AGID raccomanda di considerare compromessa qualunque credenziale finita per errore in un repository pubblico e di revocarla immediatamente, sostituendola con una nuova.

## Un'abitudine utile per chi gestisce account e password

Per chi non scrive codice il rischio è diverso ma simile nella sostanza: password riusate su più servizi, salvate in file di testo o appunti condivisi, restano esposte molto più a lungo di quanto si pensi. Un gestore di password con generazione automatica e l'autenticazione a due fattori attiva ovunque possibile riducono di molto i danni quando, prima o poi, una credenziale finisce dove non dovrebbe.
