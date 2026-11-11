---
title: Windows, l'aggiornamento di novembre 2026 corregge oltre 1.200 vulnerabilità e una falla già sfruttata in Outlook
date: 2026-11-11
description: Il Patch Tuesday del 10 novembre chiude circa 1.259 vulnerabilità, incluso uno zero-day di spoofing in Microsoft Outlook già usato in attacchi reali.
---

Microsoft ha distribuito il 10 novembre l'aggiornamento mensile di sicurezza per Windows, atteso ogni secondo martedì del mese. Secondo quanto riporta TuttoTech, il rilascio corregge 1.259 vulnerabilità complessive: 1.094 segnalate direttamente da Microsoft e 165 individuate da ricercatori esterni. Tra queste compare uno zero-day già sfruttato attivamente, identificato come CVE-2026-124194, una falla di spoofing in Microsoft Outlook. BleepingComputer conferma che si tratta della vulnerabilità più critica del ciclo, anche se non sono stati diffusi i dettagli tecnici sull'attacco.

## Cosa cambia oltre alla sicurezza

L'aggiornamento arriva con le build 26100.9974 (24H2), 26200.9974 (25H2) e 26300.9974 (26H2) tramite i pacchetti KB5132061 e KB5131087, mentre Windows 10 in regime di supporto estero riceve la build 19045.7846. Oltre alle correzioni di sicurezza, Microsoft rafforza la firma dei messaggi NTLM per le connessioni non anonime, risolve un errore nella stampa di stampanti condivise via Active Directory introdotto a ottobre e corregge alcuni problemi di disconnessione del Desktop remoto legati a un certificato non corrispondente. Chi usa script PowerShell firmati dovrebbe controllarne la codifica, perché da questo mese la verifica della firma è più severa con i file che non usano UTF-8 valido.

## Il consiglio pratico

Con un numero così alto di vulnerabilità corrette e uno zero-day già in circolazione, conviene non rimandare l'installazione. Su Windows 11 l'aggiornamento si trova in Impostazioni, Windows Update, Verifica disponibilità aggiornamenti; su Windows 10 in Impostazioni, Aggiornamento e sicurezza. Prima di avviare l'installazione è buona norma salvare il lavoro in corso e, se il PC è datato o lento ad aggiornarsi, verificare che resti spazio libero sufficiente sul disco: un aggiornamento che si blocca a metà per mancanza di spazio crea più danni di quelli che dovrebbe prevenire.
