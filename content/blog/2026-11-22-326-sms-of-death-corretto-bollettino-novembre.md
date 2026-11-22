---
title: SMS of Death, arriva la correzione ufficiale per la falla che bloccava le chiamate su Android
date: 2026-11-22
description: La vulnerabilità che faceva crashare il servizio telefonico di Android con un SMS malformato è stata inserita nel bollettino di sicurezza di novembre con un codice CVE ufficiale.
---

A fine ottobre avevamo raccontato la vicenda della falla soprannominata "SMS of Death", capace di bloccare le chiamate di un telefono Android con un messaggio malformato che non compariva mai nella casella di posta. Allora Google aveva solo promesso una correzione, senza indicare con certezza se sarebbe arrivata nella patch di ottobre o in quella di novembre. Ora la risposta c'è: il bollettino di sicurezza Android di novembre include ufficialmente la correzione, identificata con il codice CVE-2026-58882.

## Cosa cambia rispetto a prima

Il problema riguardava il modo in cui il sistema gestisce i messaggi WAP Push, la tecnologia usata ad esempio per le notifiche MMS: un SMS creato apposta mandava in crash il processo dedicato alla telefonia, interrompendo le chiamate in corso, comprese quelle di emergenza, senza lasciare traccia visibile nella casella dei messaggi. Con l'inserimento nel bollettino di novembre, la correzione ha ora una data di riferimento precisa e un livello di patch da verificare, invece di restare una promessa generica dell'azienda.

## Come controllare se il proprio telefono è protetto

Per sapere se la correzione è già arrivata basta andare nelle impostazioni del telefono, nella sezione dedicata alla sicurezza, e controllare la data del livello di patch: deve essere il 1° novembre 2026 o successiva. Chi ha ancora una data precedente può controllare se è disponibile un aggiornamento manuale prima che arrivi quello automatico. Resta invece esclusa dalla correzione chi usa Android 12 o 13, versioni non più supportate da Google: per questi dispositivi, in caso di crash ripetuti e senza causa apparente delle chiamate, la soluzione pratica resta far controllare il telefono per svuotare la cache dei messaggi, visto che un aggiornamento software non arriverà.
