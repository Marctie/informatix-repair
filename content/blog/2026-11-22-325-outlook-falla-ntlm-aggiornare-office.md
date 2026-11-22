---
title: Falla in Outlook sfruttata per rubare credenziali, Microsoft corregge e CISA fissa una scadenza
date: 2026-11-22
description: Una vulnerabilità di Outlook già usata in attacchi reali permette di sottrarre le credenziali di accesso con un semplice file aperto, e va corretta aggiornando Office.
---

Chi usa Outlook come client di posta su Windows dovrebbe controllare di avere installato gli ultimi aggiornamenti di Office. Microsoft ha corretto, con gli aggiornamenti di sicurezza dell'11 novembre, una falla identificata come CVE-2026-124194 che risultava già sfruttata da attaccanti reali, non solo teorica. L'agenzia statunitense per la cybersicurezza CISA l'ha inserita nel proprio catalogo delle vulnerabilità sfruttate attivamente e ha fissato al 24 novembre la scadenza per l'aggiornamento obbligatorio delle agenzie federali americane, un segnale della gravità della situazione anche se la scadenza non riguarda direttamente gli utenti italiani.

## Cosa rischia chi non aggiorna

Il problema riguarda il modo in cui Outlook gestisce alcuni file: aprendone uno costruito ad arte, il programma contatta un server controllato dall'attaccante senza mostrare i normali avvisi di sicurezza, e in quel passaggio può finire ceduta una versione cifrata della password di accesso al proprio account Windows. Chi la intercetta può provare a decifrarla oppure usarla per impersonare la vittima su altri servizi della rete aziendale, una tecnica nota come relay NTLM. Microsoft classifica la gravità come media, ma la conferma di uno sfruttamento reale prima ancora della divulgazione pubblica la rende tutt'altro che trascurabile.

## Chi è coinvolto e cosa fare

La falla interessa Microsoft 365 Apps for Enterprise e le versioni Office LTSC 2021 e 2024. Chi usa ancora Office 2016 o 2019, non più supportati, non riceverà una patch dedicata. La procedura più semplice resta lasciare Office aggiornarsi da solo tramite Windows Update o il centro aggiornamenti dell'app, verificando poi dal menu "Account" di un qualsiasi programma Office la build installata. Nei PC aziendali condivisi da più persone vale la pena controllare anche le macchine meno usate, spesso le ultime a ricevere gli aggiornamenti.
