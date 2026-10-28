---
title: Google aggiorna Chrome: chiuse 353 falle e arriva l'avviso per i siti senza https
date: 2026-10-28
description: La nuova versione 156 del browser corregge sei vulnerabilità critiche e introduce un controllo in più prima di collegarsi a pagine non cifrate.
---

Google ha distribuito la versione 156 di Chrome, che secondo quanto riportato da Red Hot Cyber chiude 353 vulnerabilità, sei delle quali classificate come critiche. L'aggiornamento riguarda Windows, macOS e Linux e arriva nelle build 156.0.8078.47 e .48, anche se la distribuzione procede in modo graduale nei prossimi giorni.

## Le falle più pericolose

Tra i problemi corretti, due hanno un identificativo CVE pubblico. CVE-2026-113303 riguarda WebRTC, il modulo usato per audio e video in tempo reale, e permetterebbe potenzialmente di eseguire codice all'interno della sandbox del browser tramite una pagina web creata apposta. CVE-2026-113279 ha effetti simili e colpisce il sistema di accessibilità. Le altre quattro vulnerabilità critiche riguardano i componenti Skia, CSS, Paint e Accessibility, ma la fonte non ne indica ancora il codice CVE. Google non ha segnalato casi di sfruttamento attivo per nessuna di queste falle.

## Un avviso in più per i siti non protetti

Dal 21 ottobre Chrome mostra per tutti gli utenti un avviso quando si visita per la prima volta un sito che usa ancora il protocollo http, senza cifratura, chiedendo una conferma prima di proseguire. Il sito resta comunque raggiungibile: non si tratta di un blocco, ma di un passaggio in più pensato per far notare che i dati inviati a quella pagina potrebbero non essere protetti. Le reti locali, come quelle dei router domestici, sono escluse da questo controllo.

Chi usa Chrome su computer o smartphone dovrebbe verificare di avere la versione più recente installata, cosa che il browser fa normalmente da solo ma che vale la pena controllare a mano quando si leggono notizie come questa: basta aprire il menu, andare su Informazioni su Google Chrome e lasciare che il programma verifichi gli aggiornamenti disponibili.

Fonte: Red Hot Cyber.
