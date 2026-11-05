---
title: WordPress, una falla già sfruttata nel nucleo del software: aggiornare entro il 6 novembre
date: 2026-11-05
description: CISA ha inserito nel suo catalogo delle vulnerabilità attivamente sfruttate una falla critica del core di WordPress, corretta dalla versione 7.1.4.
---

L'agenzia statunitense per la cybersicurezza CISA ha aggiunto il 3 novembre al proprio catalogo delle vulnerabilità sfruttate attivamente (KEV) una falla del nucleo di WordPress, identificata come CVE-2026-119977, con un punteggio di gravità CVSS di 8,1. Il problema riguarda il meccanismo di aggiornamento del software: una condizione di race tra il controllo e l'uso effettivo dei file durante l'installazione di un pacchetto completo, che in teoria permette a un attaccante di manipolare l'aggiornamento stesso.

## Chi è a rischio e come correggere

La falla è corretta nella versione 7.1.4, rilasciata il 28 ottobre, mentre le versioni dalla 4.7.0 alla 7.1.3 risultano interessate secondo le schede pubbliche della vulnerabilità; alcune correzioni sono state distribuite anche su rami meno recenti. Chi gestisce un sito o un blog WordPress, situazione comune per molte piccole attività commerciali, dovrebbe controllare la versione installata dal pannello di amministrazione e aggiornare quanto prima, anche quando gli aggiornamenti automatici sembrano già attivi. CISA ha fissato al 6 novembre la scadenza per le agenzie federali statunitensi, ma ha invitato a correggere il prima possibile anche tutti gli altri gestori di siti.

## Quanto è diffuso lo sfruttamento

Secondo un bollettino del servizio di sicurezza Wordfence, segnalato da chi ha analizzato la vulnerabilità, nel fine settimana sono stati bloccati oltre 13.000 tentativi di attacco in 24 ore, e la media si manteneva sopra i 12.600 tentativi al giorno ancora il 4 novembre. Non risultano al momento compromissioni confermate legate specificamente a questa falla, ma il volume dei tentativi mostra che gli aggressori la stanno già cercando attivamente in rete. Rimandare l'aggiornamento di un sito, anche piccolo, significa lasciare una porta aperta che qualcuno sta già provando a spingere.
