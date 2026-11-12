---
title: Windows, scoperta una falla non ancora corretta che può garantire il controllo completo del sistema
date: 2026-11-12
description: Un ricercatore pubblica il codice di SignDrop, una tecnica che sfrutta il componente CLFS di Windows per ottenere i privilegi massimi del sistema. Non esiste ancora una patch, ma l'uso richiede che l'attaccante abbia già accesso al computer.
---

Un ricercatore che si firma Chaotic Eclipse (conosciuto anche come Nightmare-Eclipse) ha pubblicato martedì 10 novembre su GitHub il codice di una tecnica che permette di ottenere i privilegi più alti su un computer Windows, quelli del sistema stesso. La tecnica, chiamata SignDrop, è stata diffusa senza preavviso a Microsoft e non ha ancora un codice CVE né una correzione ufficiale, come riportato da BleepingComputer e da Cyber Kendra l'11 novembre.

## Cosa sfrutta esattamente

SignDrop punta al componente CLFS (Common Log File System) di Windows, già protagonista in passato di diverse falle di sicurezza. Da fine ottobre 2025 Microsoft ha introdotto su Windows 11 25H2 e Windows Server 2025 una protezione che firma digitalmente i file di log per impedire manomissioni. Secondo il ricercatore, però, quando un utente con pochi privilegi crea un log e in seguito un processo di sistema lo apre, come può fare Microsoft Defender, il meccanismo di firma viene creato per il processo di sistema invece che per l'utente originale: un difetto nella logica della protezione stessa, non un suo aggiramento diretto. Il risultato, secondo chi ha pubblicato il codice, è una shell con i privilegi di sistema. Il test è stato condotto su Windows 11 26H2 e su build di Windows Server 2025; la cifra, circolata online, secondo cui l'80% delle installazioni Windows sarebbe vulnerabile non è accompagnata da dati verificabili.

## Chi deve preoccuparsi e cosa fare

Va chiarito un punto importante: SignDrop non permette di entrare in un computer da remoto. Serve che un attaccante abbia già un modo per eseguire codice sulla macchina, ad esempio tramite un programma malevolo installato in precedenza. Per questo il rischio reale per chi usa il computer con prudenza, senza installare software da fonti sconosciute, resta limitato, anche se la tecnica potrebbe rendere più gravi altre infezioni già in corso. Al momento non risultano attacchi reali che la utilizzino. In attesa di una correzione da parte di Microsoft, la protezione più efficace è quella di sempre: usare un account Windows senza diritti di amministratore per le attività quotidiane, mantenere aggiornato l'antivirus e installare programmi solo da fonti verificate. Chi gestisce più computer, ad esempio in un piccolo ufficio, farebbe bene a verificare periodicamente gli aggiornamenti di sicurezza Windows non appena Microsoft rilascerà una patch per questa falla.
