---
title: Falla in Microsoft Authenticator per Android, corretta ma da aggiornare subito
date: 2026-11-01
description: Un difetto scoperto dai ricercatori di Enclave permetteva a un'app malevola di impersonare Teams e rubare token di accesso; Microsoft ha già rilasciato la correzione.
---

I ricercatori della società di sicurezza Enclave hanno scoperto un difetto in Microsoft Authenticator per Android che permetteva a un'applicazione malevola installata sul telefono di spacciarsi per un'app Microsoft legittima, come Teams, e ottenere così token di accesso alla posta, ai file e al calendario dell'account di lavoro collegato. Lo riporta The Hacker News, con conferma di WinBuzzer. La vulnerabilità, identificata come CVE-2026-80097, ha ottenuto un punteggio di gravità 8,6 su 10.

## Come funzionava il problema

Il componente di Authenticator che gestisce la scelta dell'account poteva essere avviato da qualsiasi app sul dispositivo. Il controllo che doveva verificare l'identità del chiamante confrontava solo la firma dell'app che si dichiarava Teams, firma presente perché Teams era davvero installata sul telefono, ma non accertava che la richiesta arrivasse realmente da quell'app. Un'app creata apposta per imitarla poteva quindi ottenere permessi non suoi. In un test separato, impersonando Authenticator stesso, i ricercatori sono riusciti a toccare anche le impostazioni delle passkey.

## Cosa serve sapere per restare protetti

Microsoft ha corretto il difetto nella versione 6.2606.4246 di Authenticator per Android e dichiara di non aver trovato prove di uno sfruttamento reale prima della patch, definendo l'attacco poco probabile nelle condizioni normali d'uso. Resta un punto di disaccordo tra l'azienda e i ricercatori su quanta interazione dell'utente fosse davvero necessaria per riuscire nell'attacco, ma la correzione è già disponibile per tutti. Chi usa Authenticator su Android per accedere alla posta aziendale o ai sistemi di lavoro può controllare in pochi secondi, dal Play Store, se l'app è aggiornata alla versione più recente: è il tipo di aggiornamento che vale la pena non rimandare, perché riguarda proprio il meccanismo che dovrebbe proteggere gli accessi, non una funzione secondaria.
