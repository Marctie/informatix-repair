---
title: Falsi inviti a eventi di OpenAI e SpaceX usati per rubare account Google e Microsoft
date: 2026-11-08
description: Una campagna di phishing analizzata da Push Security sfrutta inviti a falsi eventi di OpenAI, SpaceX e Anthropic per intercettare password e sessioni di accesso, superando anche la verifica in due passaggi.
---

La società di sicurezza Push Security ha pubblicato il 5 novembre l'analisi di una campagna di phishing che si presenta sotto forma di inviti a eventi legati a note aziende di intelligenza artificiale, come un presunto incontro dell'OpenAI Academy del 4 novembre dedicato al marketing, oppure un finto briefing di SpaceX sull'intelligenza artificiale previsto per il 12 novembre, con in regalo mesi gratuiti di abbonamenti come ChatGPT Pro o Grok Heavy. Una terza esca, legata ad Anthropic e a un evento AWS re:Invent, non risultava più attiva al momento dell'analisi.

## Come funziona il furto dell'account

I link delle email, riporta Push Security, passano prima per servizi affidabili come accorciatori di URL o redirect su piattaforme note, in modo da superare i controlli automatici sulla reputazione dei link, e portano a una pagina di registrazione con i pulsanti "Continua con Microsoft" o "Continua con Google". Chi sceglie Microsoft viene guidato verso un codice da inserire sulla vera pagina di accesso Microsoft, un meccanismo noto come device code phishing: approvando quel codice, chi ha organizzato l'attacco ottiene i token di accesso. Chi sceglie Google passa invece attraverso un proxy che inoltra in tempo reale il vero processo di accesso, intercettando password, risposta alla verifica in due passaggi e cookie di sessione, e riuscendo così a entrare nell'account anche con l'MFA attiva.

## Come difendersi

Un invito a un evento che promette abbonamenti gratuiti a servizi di intelligenza artificiale molto richiesti merita diffidenza, soprattutto se arriva da un mittente o da un dominio che non si riconosce con certezza. Prima di inserire un codice di accesso su richiesta di una pagina esterna, o di confermare un accesso con Google o Microsoft partito da un link ricevuto per email, vale la pena controllare l'indirizzo reale della pagina e chiedersi se quell'evento sia davvero atteso. Dove possibile, passare a metodi di verifica in due passaggi resistenti al phishing, come le chiavi di sicurezza fisiche o le passkey, riduce il rischio anche quando un link sospetto viene aperto per errore.
