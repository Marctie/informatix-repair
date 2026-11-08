---
title: Chrome 157 arriva con 213 correzioni di sicurezza, sette classificate critiche
date: 2026-11-08
description: Google ha distribuito Chrome 157 su Windows, Mac, Linux e Android con 213 correzioni di sicurezza, tra cui tre falle critiche in componenti legati a grafica e WebGPU.
---

Google ha portato Chrome 157 sul canale stabile il 3 novembre, come riportato da Malwarebytes, distribuendolo nei giorni successivi su Windows, Mac e Linux e, a breve, anche su Android tramite Google Play. L'aggiornamento porta con sé 213 correzioni di sicurezza, sette delle quali classificate come critiche dall'azienda.

## Dove si trovano i problemi più seri

Tra le falle critiche descritte da Malwarebytes, una riguarda ANGLE, il livello che traduce le istruzioni grafiche del browser per il sistema operativo: un problema di corruzione della memoria in questo componente colpisce Chrome per Android e, sfruttato con una pagina web creata apposta, potrebbe permettere di eseguire codice al di fuori dell'ambiente protetto del browser. Un'altra falla riguarda Prerender, la funzione che carica in anticipo le pagine che il browser prevede si apriranno, dove un errore di gestione della memoria può causare un blocco dell'app o, in alcuni casi, l'esecuzione di codice arbitrario. La terza coinvolge Dawn, il motore che gestisce WebGPU per la grafica avanzata nel browser, anche qui con un rischio di blocco o esecuzione di codice non autorizzato. Al momento non ci sono indicazioni che una di queste vulnerabilità sia già stata usata in attacchi reali.

## Come verificare di avere la versione corretta

Chrome si aggiorna da solo, ma il processo può restare bloccato se il browser non viene mai chiuso del tutto o se un'estensione interferisce con l'aggiornamento. Per controllare la versione installata basta aprire il menu con i tre puntini, andare su Guida e poi su Informazioni su Google Chrome: la pagina mostra automaticamente se è disponibile un aggiornamento e, una volta scaricato, chiede di riavviare il browser per completarlo. Senza quel riavvio le correzioni restano scaricate ma non attive, quindi il passaggio non va saltato soprattutto su computer condivisi o usati per operazioni delicate come pagamenti online.
