---
title: Secure Boot, i certificati del 2011 sono scaduti e il computer va aggiornato
date: 2026-09-24
description: A giugno è scaduta la prima generazione dei certificati Microsoft usati all'avvio dei PC. Il computer parte lo stesso, ma senza gli aggiornamenti giusti resta meno protetto.
---
C'è una scadenza tecnica di cui si è parlato poco fuori dagli ambienti specializzati, e che riguarda quasi ogni computer Windows costruito negli ultimi quindici anni. I certificati che Microsoft aveva emesso nel 2011 per il sistema Secure Boot hanno cominciato a scadere a giugno 2026. In particolare, il 27 giugno è scaduto il certificato chiamato Microsoft Corporation KEK CA 2011.

## Cos'è Secure Boot

Secure Boot è la funzione del firmware, il BIOS o UEFI, che controlla che ciò che si avvia all'accensione sia firmato da un'autorità attendibile. Serve a impedire che programmi malevoli si installino prima ancora che parta Windows. Per farlo, il computer usa un elenco di certificati memorizzati nella scheda madre.

## Cosa succede dopo la scadenza

Secondo la documentazione di Microsoft, i computer con Secure Boot attivo continuano ad avviarsi, aggiornati o no. Il problema è un altro: un sistema con certificati scaduti non può più ricevere gli aggiornamenti futuri del gestore di avvio e dei componenti di Secure Boot tramite Windows Update, e resta quindi in uno stato di sicurezza meno buono nel tempo.

## La sostituzione

Microsoft ha preparato una nuova catena di certificati del 2023 e gestisce l'aggiornamento su una larga parte dei dispositivi. In alcuni casi però serve anche un aggiornamento del BIOS del produttore, e sui computer aziendali o più datati la procedura può richiedere attenzione.

## Cosa fare

Installa tutti gli aggiornamenti di Windows e controlla se il produttore del computer ha pubblicato un aggiornamento del firmware. Non disattivare Secure Boot per risolvere altri problemi. Se hai un computer con qualche anno, un doppio avvio con Linux o programmi di sicurezza particolari, chiedi supporto prima di modificare le impostazioni: un errore in questa fase può impedire l'avvio.

In negozio controlliamo lo stato del firmware e dei certificati, e se serve aggiorniamo il BIOS con la procedura corretta.
