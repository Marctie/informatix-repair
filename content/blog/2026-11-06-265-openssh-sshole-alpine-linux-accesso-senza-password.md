---
title: Una falla in OpenSSH apre un accesso senza password su Alpine Linux e dispositivi simili
date: 2026-11-06
description: Una vulnerabilità scoperta nei sistemi basati sulla libreria musl permette di entrare via SSH su account che non dovrebbero accettare password, con possibili rischi per NAS, router e dispositivi domestici meno comuni.
---

Il 5 novembre BleepingComputer ha riportato una vulnerabilità ribattezzata "*sshole", che riguarda OpenSSH sui sistemi Linux basati sulla libreria musl, come Alpine Linux, OpenWrt, Buildroot e Yocto. A scoprirla è stato il ricercatore Ozgun Kultekin, che ha pubblicato i dettagli dopo circa 17.600 tentativi di autenticazione automatizzati su configurazioni diverse. Alcune aziende di sicurezza la indicano come CVE-2026-123158 con un punteggio di gravità alto, anche se BleepingComputer segnala che un codice CVE ufficiale non era ancora assegnato al momento della pubblicazione.

## Come funziona il problema

La causa è una combinazione tra una vecchia correzione OpenSSH del 2016, pensata per evitare che un attaccante capisca se un nome utente esiste, e il comportamento della funzione di hashing di musl, che restituisce il simbolo asterisco sia quando un account non ha password valida sia quando l'hashing fallisce per un motivo tecnico, ad esempio una password più lunga di 256 caratteri. Inviando una password troppo lunga, in certe condizioni è possibile ottenere un accesso che dovrebbe essere bloccato. Non è comunque possibile aggirare le password di account configurati correttamente: la falla riguarda solo gli account pensati per restare senza password utilizzabile. Debian, Ubuntu e Fedora, che usano una libreria diversa, non sono coinvolti, e nemmeno i sistemi che usano PAM per gestire l'autenticazione.

## Chi deve preoccuparsene

Il caso più concreto riguarda le immagini cloud ufficiali di Alpine, che includono di default un account con privilegi elevati senza password. Per la maggior parte dei clienti con PC Windows o Mac il rischio è marginale, ma chi gestisce un NAS, un router con firmware personalizzato o un piccolo server basato su queste distribuzioni dovrebbe verificare la versione di OpenSSH installata e aggiornarla alla 10.6p2, oppure disattivare temporaneamente l'accesso SSH tramite password finché l'aggiornamento non è stato applicato. In caso di dubbi su come controllare un dispositivo di questo tipo, meglio farsi aiutare da chi se ne occupa professionalmente piuttosto che lasciarlo esposto.
