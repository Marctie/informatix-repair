---
title: 319 estensioni Chrome dirottano le ricerche di 13 milioni di utenti
date: 2026-10-31
description: Un report della società di sicurezza Socket ha individuato centinaia di estensioni che sostituiscono il motore di ricerca per generare commissioni pubblicitarie.
---

Un report pubblicato il 29 ottobre dalla società di sicurezza Socket ha individuato 319 estensioni per Chrome che modificano le ricerche degli utenti per generare commissioni di affiliazione. Il ricercatore John Tuckner, autore dell'analisi chiamata "searchjacked", spiega che 57 di queste estensioni erano già state segnalate da Socket nell'aprile 2025: le altre 264 sono emerse solo ora.

## Come funziona il dirottamento

Le estensioni si presentano come convertitori PDF, strumenti di ricerca sicura o assistenti basati sull'intelligenza artificiale. In realtà sfruttano l'impostazione "chrome_settings_overrides" di Chrome per sostituire il motore di ricerca predefinito e reindirizzare le query attraverso server proxy controllati dagli stessi autori, prima di farle arrivare a Bing o Yahoo con un identificativo di affiliazione che genera guadagni pubblicitari.

Secondo Socket, due gruppi coprono la maggior parte delle installazioni: il cluster "Bing-Search", con 37 estensioni e circa 2,2 milioni di utenti pubblicizzati tramite la rete Bidbrain, e "SecuryBrowse", 58 estensioni e circa 4,9 milioni di utenti, con nomi che richiamano la sicurezza come Fire Shield, Securify e WatchTower. In totale il report parla di circa 13 milioni di installazioni.

## Il rischio per chi le ha installate

La destinazione finale di una ricerca può cambiare in qualsiasi momento senza che l'estensione venga aggiornata. Nel test condotto da Socket su Predator Search, sei ricerche identiche sono finite in quattro pagine diverse, compresa una schermata di errore Cloudflare: un comportamento che in futuro potrebbe portare anche verso siti di phishing. Al momento della pubblicazione del report Google aveva già rimosso gran parte delle estensioni segnalate dal Chrome Web Store, ma secondo Socket ne continuano a comparire di nuove.

Chi usa Chrome può controllare dal menu delle estensioni quali sono installate e da chi sono state pubblicate, disinstallando subito quelle non riconosciute o scaricate da editori sconosciuti, e far seguire una scansione antivirus completa del computer.
