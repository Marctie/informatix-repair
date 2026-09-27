---
title: ShieldCrash, la falla di Windows Defender che elude anche l'ultima patch
date: 2026-09-27
description: Un ricercatore ha pubblicato ShieldCrash, un modo per bypassare la protezione di Windows Defender anche su sistemi completamente aggiornati.
---
Un ricercatore che si firma Nightmare Eclipse ha diffuso a metà settembre un exploit chiamato ShieldCrash, capace di ottenere privilegi di sistema su Windows 10, Windows 11 e Windows Server anche dopo l'installazione degli ultimi aggiornamenti. Secondo BleepingComputer e The Hacker News, si tratta del terzo capitolo di una stessa vicenda: prima la falla RoguePlanet, corretta a luglio, poi il bypass ShieldBreak, corretto con il Patch Tuesday di settembre, e ora ShieldCrash, che elude anche questa correzione.

## Cosa permette di fare

ShieldCrash sfrutta un componente di Windows Defender per far leggere al sistema, con privilegi elevati, file che normalmente sarebbero protetti. Chi lo sfrutta non riesce a scrivere o modificare i file di sistema, ma può leggere informazioni riservate, comprese quelle usate per muoversi ulteriormente all'interno di una rete aziendale. Microsoft non aveva rilasciato, al momento della pubblicazione dell'exploit, una correzione dedicata a questo bypass specifico.

## Perché riguarda anche chi usa un PC in casa

La proof of concept richiede già un accesso al sistema per essere avviata, quindi non è un rischio che arriva da solo tramite un semplice link o un allegato. Diventa pericolosa quando è combinata con altri malware o con un accesso ottenuto in altro modo, ad esempio da un programma scaricato da una fonte non ufficiale. Per questo motivo i tecnici di sicurezza continuano a raccomandare le stesse buone abitudini di sempre: scaricare software solo da siti ufficiali, non disattivare mai Windows Defender o l'antivirus installato, e mantenere aggiornato non solo Windows ma anche i programmi che si usano di più.

## In attesa della correzione

Microsoft segue da mesi questa catena di bypass e ha confermato di essere al lavoro su una revisione più ampia del componente coinvolto, non solo su patch mirate. Nel frattempo, chi gestisce PC per lavoro o in ambito familiare può ridurre il rischio limitando gli account con diritti di amministratore all'uso quotidiano e riservandoli solo a quando servono davvero. Un computer con un account standard, aggiornamenti regolari e un solo antivirus attivo resta comunque protetto dalla stragrande maggioranza delle minacce reali in circolazione.
