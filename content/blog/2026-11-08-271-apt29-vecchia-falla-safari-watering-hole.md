---
title: Una falla Safari corretta nel 2024 torna utile a un gruppo di spionaggio russo
date: 2026-11-08
description: CISA ha inserito nel catalogo delle vulnerabilità sfruttate una falla di Safari risolta da Apple nel 2024, usata secondo Sekoia dal gruppo APT29 in una campagna di attacchi senza clic che sfrutta anche siti compromessi.
---

L'agenzia statunitense per la cybersicurezza CISA ha aggiunto il 4 novembre al proprio catalogo delle vulnerabilità sfruttate attivamente una falla di Safari identificata come CVE-2024-27834, corretta da Apple già nel 2024 con gli aggiornamenti a Safari 17.5, iOS 17.5, iPadOS 17.5, macOS Sonoma 14.5, tvOS 17.5 e watchOS 10.5 (oltre alle versioni 16.7.8 di iOS e iPadOS per i dispositivi più vecchi). Secondo CISA, le agenzie federali statunitensi devono verificare di avere la correzione entro il 18 novembre.

## Una catena di attacco costruita con pezzi vecchi

Il motivo dell'inserimento arriva da una ricerca della società di sicurezza francese Sekoia, che ha collegato lo sfruttamento di questa falla a una campagna attribuita con un livello di confidenza da moderato ad alto al gruppo APT29, legato alla Russia e già noto per attività di spionaggio informatico. Secondo Sekoia gli attaccanti distribuiscono codice dannoso attraverso siti compromessi, pagine false e la violazione della filiera di un servizio di analisi SEO (Plerdy Tracker), usando poi questa e altre falle di Safari e Chrome per installare senza alcun clic un malware che raccoglie i cookie del browser e altri dati del dispositivo. Nella catena, la CVE-2024-27834 serve ad aggirare una protezione hardware di Apple contro la corruzione della memoria, pensata proprio per rendere più difficili attacchi di questo tipo.

## Perché conta anche per chi non è un bersaglio di spionaggio

Il caso mostra che una falla risolta da anni resta comunque pericolosa per chi non ha mai installato l'aggiornamento, perché può essere riciclata in catene di attacco più recenti. Chi usa ancora un iPhone, iPad o Mac con un sistema operativo fermo da tempo, magari perché il dispositivo è vecchio e gli aggiornamenti sembrano appesantirlo, dovrebbe sapere che il rischio non riguarda solo le funzioni nuove ma anche buchi di sicurezza di questo tipo. Prima di rinunciare agli aggiornamenti per paura che il dispositivo rallenti, vale la pena far controllare le reali condizioni della batteria e delle prestazioni: spesso il problema si risolve senza dover restare esposti con un sistema datato.
