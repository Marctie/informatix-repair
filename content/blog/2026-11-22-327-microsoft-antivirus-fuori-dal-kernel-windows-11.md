---
title: Windows 11, gli antivirus iniziano a uscire dal kernel per evitare crash come quello di CrowdStrike
date: 2026-11-22
description: Microsoft ha reso disponibile la Windows Endpoint Security Platform, che permette agli antivirus di funzionare senza un proprio driver nel kernel di Windows 11.
---

Il 17 novembre, durante l'evento Microsoft Ignite, l'azienda ha annunciato la disponibilità generale della Windows Endpoint Security Platform, una piattaforma pensata per ridurre il rischio che un antivirus o un software di sicurezza aziendale blocchi completamente un PC Windows 11. La notizia è stata riportata, tra gli altri, dal sito tedesco Borncity, che cita il post ufficiale della vicepresidente Dana Huang.

## Cosa cambia rispetto a oggi

Oggi la maggior parte degli antivirus, per poter controllare in profondità cosa succede sul computer, installa un proprio componente che gira nel kernel, cioè nel nucleo più delicato del sistema operativo. Un errore in quel componente può bloccare Windows con la classica schermata blu, come accadde nel 2024 con un aggiornamento difettoso di CrowdStrike che mandò in crash milioni di PC in tutto il mondo. Con la nuova piattaforma, i produttori di sicurezza potranno invece appoggiarsi a un driver scritto e mantenuto da Microsoft stesso, chiamato wesp.sys, dialogando con esso tramite un componente in modalità utente (espclient.dll) invece di scrivere ed eseguire codice proprio direttamente nel kernel.

## Quando arriverà sugli antivirus che si usano già

L'adozione sarà graduale e dipende da ogni singolo produttore. Secondo Borncity, Bitdefender Antivirus Free e Sophos Endpoint puntano a integrarla entro la fine del 2026, ESET Endpoint Protection a febbraio 2027, mentre CrowdStrike Falcon e una versione sperimentale di Microsoft Defender sono previsti per il primo trimestre 2027. Altri nomi noti, come SentinelOne e Trellix, arriveranno nella prima metà del 2027. Microsoft non ha fissato una scadenza obbligatoria per il passaggio di tutte le soluzioni esistenti, quindi per diversi mesi ancora molti PC continueranno a usare driver antivirus nel kernel come prima.

Per chi gestisce un PC in ufficio o in negozio, la cosa più utile da fare resta quella di sempre: mantenere Windows e l'antivirus aggiornati, perché le correzioni di sicurezza e le nuove piattaforme come questa arrivano proprio tramite gli aggiornamenti regolari, e un sistema rimasto indietro con le versioni non riceve questi miglioramenti.
