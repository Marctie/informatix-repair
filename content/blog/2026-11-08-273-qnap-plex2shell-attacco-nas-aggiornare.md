---
title: QNAP avvisa, alcuni NAS violati tramite una falla di Plex, aggiornare subito
date: 2026-11-08
description: QNAP ha confermato che alcuni dei suoi NAS sono stati compromessi attraverso una catena di vulnerabilità nel Plex Media Server, già usata per minare criptovalute, e consiglia di aggiornare l'app subito.
---

QNAP ha pubblicato il 6 novembre un avviso di sicurezza in cui conferma di aver ricevuto segnalazioni di clienti con il Plex Media Server compromesso sui propri NAS, secondo quanto riportato da CyberInsider. Il problema non riguarda il sistema operativo del NAS, QTS o QuTS hero, ma l'app Plex installata sopra, colpita da una catena di quattro vulnerabilità nota come Plex2Shell e identificata con le sigle CVE-2026-96652, CVE-2026-96654, CVE-2026-96655 e CVE-2026-96656.

## Come agisce l'attacco

Secondo la descrizione tecnica ripresa da CyberInsider, un aggressore senza alcun account sul server può sfruttare le falle per accedere a funzioni interne, impossessarsi del token amministrativo del proprietario e scrivere un file nella cartella Codecs dell'app, ottenendo così l'esecuzione di codice con gli stessi permessi del processo Plex. Plex aveva segnalato attacchi diffusi già il 19 ottobre, tre giorni dopo la diffusione pubblica di un codice proof of concept, e i server compromessi sono stati usati per minare criptovalute o far transitare traffico di terzi tramite software proxy.

## Cosa fare se si usa Plex su un NAS

Chi tiene un NAS in casa per backup, foto o appunto per guardare film e serie in streaming con Plex dovrebbe aggiornare l'app alla versione 1.43.3.10861 o successiva, disponibile tramite l'App Center, verificando la build da Plex Web in Settings, General. QNAP segnala inoltre che un NAS esposto su Internet va considerato potenzialmente compromesso anche dopo l'aggiornamento, perché la patch chiude la porta d'ingresso ma non elimina da sola eventuali programmi già installati da un attaccante: tra i segnali da controllare ci sono file sconosciuti nella cartella Codecs e un uso della CPU elevato anche quando non si sta guardando nulla. Per chi usa Plex solo in casa, disattivare l'accesso remoto ed eventuali inoltri di porta riduce già da solo il rischio; per chi ha davvero bisogno di accedere al NAS da fuori, l'azienda indica una VPN come alternativa più sicura.
