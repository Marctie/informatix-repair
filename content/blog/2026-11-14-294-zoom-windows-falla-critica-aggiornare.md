---
title: Zoom per Windows, una falla critica permetteva di scalare i privilegi senza autenticazione
date: 2026-11-14
description: Zoom ha corretto una vulnerabilità critica nel client Windows che un attaccante in rete poteva sfruttare senza aver effettuato l'accesso.
---

Zoom ha pubblicato il bollettino di sicurezza ZSB-26023, relativo a una vulnerabilità critica in Zoom Workplace per Windows identificata come CVE-2026-108186. Il problema riguarda una validazione impropria dei dati in ingresso e ha ricevuto un punteggio di gravità di 9.6 su 10, nella fascia più alta possibile. Secondo il bollettino ufficiale dell'azienda, un attaccante poteva sfruttarla da remoto, senza bisogno di credenziali, anche se è richiesta un'interazione da parte della vittima, ad esempio apri di un link o di un file.

## Chi è coinvolto e cosa rischia

La falla colpisce le versioni di Zoom Workplace per Windows comprese tra la 7.1.0 e tutte quelle precedenti alla 7.1.8, che è la versione che risolve il problema. Riuscendo a sfruttarla, un malintenzionato potrebbe ottenere privilegi più elevati sul computer della vittima, con conseguenze potenziali sulla riservatezza, l'integrità e la disponibilità dei dati presenti sulla macchina. Zoom non ha confermato tentativi di attacco già avvenuti nel mondo reale, ma la combinazione di gravità alta e assenza di autenticazione richiesta rende la correzione una priorità per chi usa il programma ogni giorno per lavoro o per restare in contatto con la famiglia.

## Come verificare e aggiornare

Chi usa Zoom su Windows può controllare la versione installata aprendo l'app, cliccando sull'icona del proprio profilo in alto a destra e scegliendo la voce che mostra gli aggiornamenti disponibili; in alternativa si scarica l'ultima versione direttamente da zoom.us/download. Le aziende che gestiscono Zoom tramite un pacchetto centralizzato sui computer dei dipendenti dovrebbero verificare con chi si occupa dell'IT che l'aggiornamento sia già stato distribuito su tutte le postazioni, non solo su quelle usate più di frequente.

Vale la pena ricordare che molte persone installano Zoom una volta e poi non lo aprono quasi più, finché non arriva una videochiamata: in questi casi l'aggiornamento automatico spesso non è mai avvenuto, ed è proprio qui che restano le versioni più vecchie e vulnerabili.
