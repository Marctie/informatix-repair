---
title: Hirudo, il trojan Android che sostituisce le app delle banche con copie modificate
date: 2026-10-18
description: La società di sicurezza ThreatFabric descrive un nuovo malware che non si limita a imitare le app bancarie, ma le rimpiazza davvero sul telefono con versioni alterate.
---

Un nuovo malware per Android, battezzato Hirudo, usa una tecnica diversa dal solito finto schermo di accesso con cui di solito i truffatori rubano le credenziali bancarie. Secondo l'analisi della società di sicurezza ThreatFabric, ripresa il 14 ottobre da testate come BleepingComputer, The Hacker News e SecurityWeek, Hirudo disinstalla l'app bancaria originale e la rimpiazza con una copia modificata che sembra identica, ma al suo interno disattiva i controlli di sicurezza della banca stessa.

## Come agisce sul telefono

Il malware arriva tramite applicazioni civetta mascherate da negozi online, video o serie brevi, con nomi come Shopora o ZoyaTV. Una volta installato, controlla se sul dispositivo è presente un'app bancaria tra quelle che sa imitare: in quel caso mostra un falso avviso di aggiornamento per convincere l'utente a installare la versione contraffatta al posto di quella vera. Le copie modificate riescono ad aggirare i controlli di integrità di Android perché si basano su strumenti di hooking già noti nel settore della sicurezza, capaci di falsificare le verifiche sul certificato dell'app. Oltre al furto delle credenziali, ThreatFabric segnala la possibilità di controllo remoto del telefono, lettura degli SMS e accesso alla fotocamera.

## Dove si è diffuso finora

Al momento le copie di app bancarie già pronte riguardano principalmente istituti indonesiani, mentre le funzioni di furto di credenziali più generiche risultano attive anche in Cina, India, Messico, Marocco e Thailandia. Le fonti consultate non segnalano casi in Italia, quindi non c'è motivo di allarmarsi per chi usa le app della propria banca scaricate dal Play Store. Resta comunque una conferma di quanto sia importante installare applicazioni solo dai canali ufficiali e diffidare di qualsiasi avviso di aggiornamento che compare dentro un'altra app invece che nello store: un aggiornamento vero non si installa mai in quel modo. Chi nota che l'app della propria banca è scomparsa dal telefono, o si comporta in modo diverso dal solito dopo averla "aggiornata" da fonti non ufficiali, dovrebbe disinstallarla subito e contattare la banca prima di accedere di nuovo al conto.
