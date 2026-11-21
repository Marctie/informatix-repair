---
title: FastUnlock, il bypass di BitLocker che Microsoft non ha ancora corretto
date: 2026-11-21
description: Un ricercatore ha mostrato come aggirare la protezione BitLocker di Windows 11 in pochi minuti con accesso fisico al PC, e Microsoft non ha ancora rilasciato una correzione.
---

Chi usa la crittografia BitLocker per proteggere i dati del proprio PC Windows dovrebbe conoscere FastUnlock, la tecnica di bypass pubblicata il 19 novembre dal ricercatore noto come Chaotic Eclipse, già autore in passato di un'altra falla simile, YellowKey, corretta da Microsoft a maggio con il codice CVE-2026-45585.

## Come funziona

Secondo quanto riportato dal sito tedesco Borncity, la tecnica sfrutta Narrator, lo strumento di lettura dello schermo integrato in Windows, per aggirare la schermata di blocco. Il ricercatore sostiene che su un PC con Windows 11 26H2 aggiornato con le patch di novembre 2026 bastano circa cinque minuti, dal momento in cui si ha il computer in mano, per arrivare a leggere i dati protetti da BitLocker. Sono necessarie due condizioni: accesso fisico al dispositivo e la presenza di almeno un account Microsoft configurato sul sistema.

## Cosa manca ancora

Al momento Microsoft non ha pubblicato né un avviso di sicurezza né un aggiornamento per questa falla specifica, e non esiste ancora un codice CVE ufficiale che la identifichi. La tecnica non è stata verificata in modo indipendente da altri laboratori di sicurezza, quindi va considerata una segnalazione da monitorare e non un fatto accertato al cento per cento. Resta comunque significativo che sia la seconda tecnica di bypass di BitLocker pubblicata dallo stesso ricercatore in pochi mesi.

Per chi lascia il portatile in ufficio, in auto o comunque fuori dal proprio controllo, la lezione pratica è che la crittografia del disco protegge bene dal furto dei dati a distanza, molto meno da chi riesce a mettere le mani sul computer acceso o in stand-by. Impostare lo spegnimento automatico dopo pochi minuti di inattività e richiedere sempre il PIN all'accensione riduce la finestra di attacco, in attesa di una correzione ufficiale.
