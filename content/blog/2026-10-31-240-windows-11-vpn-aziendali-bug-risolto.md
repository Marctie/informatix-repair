---
title: Windows 11, Microsoft risolve il bug che bloccava le VPN aziendali
date: 2026-10-31
description: Dopo settimane di disagi, un aggiornamento di anteprima corregge le connessioni VPN Always On rimaste bloccate dagli aggiornamenti di settembre.
---

Gli aggiornamenti di sicurezza di settembre 2026 per Windows 11 avevano introdotto un problema alle connessioni VPN aziendali di tipo Always On, quando il profilo è configurato con selezione automatica del protocollo tra IKEv2 e SSTP. Mercoledì 28 ottobre, secondo quanto riportato da BleepingComputer, Microsoft ha confermato che il problema è risolto per chi installa l'aggiornamento di anteprima KB5127936.

## Cosa succedeva prima della correzione

Le connessioni rimanevano bloccate nello stato "in collegamento" oppure non si stabilivano al primo tentativo: nei tentativi successivi compariva l'errore "La porta specificata è già in uso". Microsoft aveva segnalato per errore la correzione come già inclusa negli aggiornamenti cumulativi di ottobre, per poi tornare a indicarla come soltanto mitigata, come riportato il 26 ottobre a proposito delle patch del mese.

## Cosa fare ora

Chi lavora da remoto tramite VPN aziendale e ha notato blocchi di connessione può installare il KB5127936 dalle impostazioni di Windows Update, nella sezione degli aggiornamenti facoltativi. Chi preferisce non installare un aggiornamento di anteprima può applicare la soluzione temporanea indicata da Microsoft: impostare nel profilo VPN un solo protocollo, SSTP oppure IKEv2, invece della selezione automatica, almeno fino al rilascio della correzione nei prossimi aggiornamenti cumulativi di sicurezza.

Per chi gestisce più postazioni in un piccolo ufficio, conviene annotare su quali computer la VPN ha iniziato a dare problemi dopo settembre, così da verificare uno per uno quali hanno già ricevuto la patch corretta prima di contattare chi fornisce assistenza.
