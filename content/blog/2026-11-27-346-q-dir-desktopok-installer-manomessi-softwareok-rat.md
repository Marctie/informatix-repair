---
title: Installer di Q-Dir e DesktopOK manomessi sul sito ufficiale, cosa sapere prima di scaricare o aggiornare
date: 2026-11-27
description: Secondo un'analisi di AhnLab, alcune versioni dei programmi gratuiti Q-Dir e DesktopOK distribuite dal sito ufficiale SoftwareOK contenevano un trojan di accesso remoto nascosto nell'installer.
---

Il 27 novembre The Hacker News ha riportato un'analisi della società AhnLab su un attacco alla catena di distribuzione di due programmi gratuiti molto diffusi su Windows: Q-Dir, un gestore di file con pannelli multipli, e DesktopOK, un'utility che salva e ripristina la posizione delle icone sul desktop. Entrambi sono pubblicati da SoftwareOK, uno sviluppatore tedesco con una base di utenti ampia anche in Italia tra chi cerca piccoli strumenti gratuiti per Windows.

## Il problema non era un sito falso, ma quello vero

A differenza delle truffe più comuni, qui non serviva cliccare su un link sospetto o finire su un sito clone: secondo AhnLab, i file di installazione manomessi provenivano dal sito ufficiale di SoftwareOK, sia per chi scaricava il programma per la prima volta sia per chi riceveva un aggiornamento di una versione già installata. Le versioni coinvolte sono la 12.83, la 12.84 e la 12.85 di Q-Dir e la 12.82 e la 12.85 di DesktopOK. L'installer avviava normalmente il programma originale, per non destare sospetti, mentre in background scaricava un trojan di accesso remoto scritto in Python, capace di eseguire comandi, trasferire file, fare screenshot e controllare quali antivirus fossero installati sul computer. Non è stato chiarito come i file originali siano stati sostituiti su un sito che, va detto, resta comunque quello legittimo dello sviluppatore.

## Cosa conviene fare

AhnLab consiglia di verificare l'impronta digitale (hash SHA-256) dei file scaricati prima di eseguirli, un controllo che richiede qualche minuto ma permette di confrontare il file con quello dichiarato ufficiale. Chi ha installato o aggiornato Q-Dir o DesktopOK in queste versioni dovrebbe eseguire una scansione completa con un antivirus aggiornato, ricordando che disinstallare il programma non basta a rimuovere il trojan se questo è già attivo. Nei casi dubbi, soprattutto su computer usati per operazioni bancarie o lavoro, una verifica più approfondita del sistema evita sorprese più costose in seguito.
