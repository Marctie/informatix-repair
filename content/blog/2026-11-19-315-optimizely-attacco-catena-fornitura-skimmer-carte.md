---
title: Un attacco alla piattaforma Optimizely mette a rischio dati di carte su 178 siti
date: 2026-11-19
description: Un codice malevolo diffuso tramite Optimizely ha colpito siti di grandi aziende per quasi 19 ore, con furto di dati di pagamento e criptovalute.
---

Il 16 novembre un attacco alla catena di fornitura ha colpito Optimizely, la piattaforma che molte aziende usano per test e personalizzazione dei propri siti web. Un piccolo script malevolo è stato inserito nell'impostazione "Project JavaScript" di diversi progetti e distribuito dal CDN ufficiale di Optimizely, con un certificato valido che lo faceva sembrare legittimo. Il codice è rimasto attivo per circa diciannove ore, fino alla bonifica completata alle 23:11 UTC della stessa giornata.

Secondo la ricerca del tecnico Scott Helme di Report URI, ripresa da diverse testate di sicurezza tra cui BleepingComputer e SocRadar, sono stati individuati 188 snippet infetti su 1.611 analizzati, collegati a 178 organizzazioni; il numero reale, secondo i ricercatori, potrebbe essere più alto. Tra i siti coinvolti figurano nomi noti come Zoom, BBC, CNN, Salesforce, GitLab, IKEA, HSBC, Equifax, Air France-KLM, Ledger e Peacock. Il settore bancario e finanziario risulta il più colpito.

## Cosa rischiavano i visitatori

Il codice includeva due componenti principali: un "clipper" che sostituiva gli indirizzi dei portafogli di criptovalute, con circa 7.150 dollari finiti sui conti degli attaccanti, e uno skimmer che intercettava numero, scadenza e codice di sicurezza delle carte inserite nei moduli non protetti da un fornitore di pagamento esterno come Stripe o Adyen. Venivano raccolti anche cookie non protetti, screenshot delle pagine e gli indirizzi visitati; su alcuni iPhone e iPad sarebbero stati recapitati exploit per iOS, anche se non è confermato che qualche dispositivo sia stato effettivamente compromesso.

## La correzione e cosa fare

Optimizely ha pubblicato un avviso ufficiale il 17 novembre, segnalando la rimozione del codice e la messa in sicurezza degli account coinvolti, senza però fornire dettagli tecnici completi sulla falla. Chi ha fatto acquisti il 16 novembre su uno dei siti coinvolti dovrebbe controllare gli estratti conto della carta usata e segnalare alla banca eventuali movimenti sospetti, oltre ad aggiornare iPhone e iPad alle versioni più recenti disponibili. Comparire nell'elenco dei siti colpiti non significa automaticamente che i propri dati siano stati sottratti, ma un controllo in più, in questi casi, non costa nulla.
