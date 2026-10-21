---
title: Una falla nei chip Wi-Fi Broadcom lascia aperti milioni di router
date: 2026-10-21
description: Un ricercatore ha mostrato come alcuni chip Broadcom usati in molti router permettano l'accesso da remoto senza conoscere la password Wi-Fi.
---

Al talk Hexacon di Parigi, il 16 ottobre, il ricercatore Quentin Kaiser ha presentato una vulnerabilità nell'implementazione proprietaria Wi-Fi/WPS di Broadcom, presente nel software dei chip almeno dal 2010. Secondo quanto riportato da Security Affairs il 19 ottobre, un attaccante che si trovi semplicemente nel raggio del segnale Wi-Fi può ottenere l'esecuzione di codice sul router senza conoscere la password e senza alcuna azione da parte di chi lo usa.

Broadcom aveva distribuito una correzione parziale nel 2018, senza comunicarlo pubblicamente, e secondo Security Affairs ha rifiutato di assegnare un identificativo CVE ufficiale al problema. Kaiser ha segnalato il bug all'azienda a luglio 2026 e, al 15 ottobre, nessun dispositivo controllato in Belgio risultava corretto.

## Quanti dispositivi sono coinvolti

Le cifre circolate finora riguardano soprattutto il Belgio, dove Kaiser stima oltre 1,5 milioni di gateway potenzialmente esposti tra i clienti di diversi operatori. Non esiste al momento una stima globale verificata, quindi va considerata un'indicazione parziale e non un conteggio mondiale. Alcuni modelli di chip, basati su un sistema operativo più datato, difficilmente riceveranno mai una patch completa; altri, basati su Linux, potrebbero essere corretti se i produttori aggiornano il software di gestione del Wi-Fi.

## Cosa cambia per chi usa un router di casa

Non ci sono segnalazioni di attacchi già avvenuti nel mondo reale, ma il rischio esiste soprattutto dove molti router sono vicini tra loro, come condomini o uffici. I chip Broadcom sono diffusi tra diversi produttori di modem anche in Italia, quindi non è possibile escludere a priori che alcuni modelli in uso localmente condividano lo stesso problema. Un controllo utile e alla portata di tutti è verificare la data dell'ultimo aggiornamento firmware del proprio router dal pannello di gestione o tramite l'app dell'operatore: se risulta molto vecchio, o il modem ha più di qualche anno, vale la pena chiedere un controllo o valutare la sostituzione con un modello più recente e ancora supportato.
