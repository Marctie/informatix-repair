---
title: Chrome rafforza la protezione contro le truffe e riconosce i comandi ClickFix
date: 2026-10-22
description: Google ha ampliato la modalità Enhanced Protection di Chrome con un controllo più accurato dei siti sospetti e il blocco dei comandi dannosi copiati dagli schemi ClickFix.
---

Google ha annunciato un ampliamento della modalità Enhanced Protection di Chrome, la protezione avanzata che fa parte di Safe Browsing, secondo quanto riportato il 21 ottobre da BleepingComputer. L'azienda sostiene che questa modalità renda gli utenti fino a dieci volte più protetti da phishing e social engineering rispetto alla protezione standard, anche se si tratta di una stima diffusa direttamente da Google.

## Un modello più potente per i siti sospetti

In precedenza Chrome si appoggiava a un modello Gemini eseguito sul dispositivo per individuare le pagine di falso supporto tecnico. Per chi ha attivato Enhanced Protection, l'analisi passa ora a un modello più avanzato lato server, che valuta il marchio imitato dalla pagina, l'intento del contenuto e la probabilità che si tratti di un raggiro, incrociando il tutto con la reputazione del dominio. Il testo della pagina viene inviato ai server di Google solo quando compaiono segnali di truffa ad alta probabilità, e secondo l'azienda non viene conservato né usato per addestrare altri modelli.

## Il blocco dei comandi ClickFix

La novità più utile riguarda gli schemi ClickFix, le truffe che convincono la vittima a copiare e incollare manualmente un comando nel Prompt dei comandi o in PowerShell, presentandolo come la soluzione a un problema inventato del computer. Quando Chrome sospetta che il testo copiato appartenga a uno di questi schemi, rimuove le informazioni personali dal contenuto e lo invia a Safe Browsing per un controllo, mostrando un avviso prima che il comando possa essere eseguito.

Chi vuole verificare se la protezione è attiva può controllare da Impostazioni di Chrome, alla voce Privacy e sicurezza, sezione Sicurezza, che sia selezionata l'opzione Protezione avanzata. In ogni caso, nessun sito legittimo chiede di aprire un terminale e digitare comandi per risolvere un problema: è un segnale d'allarme da riconoscere a prima vista, prima ancora che intervenga qualsiasi software.
