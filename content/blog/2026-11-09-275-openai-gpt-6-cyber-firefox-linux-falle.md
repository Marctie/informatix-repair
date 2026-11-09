---
title: OpenAI presenta GPT-6 Cyber, il modello che ha trovato 81 falle in Firefox
date: 2026-11-09
description: Il nuovo modello di intelligenza artificiale di OpenAI per la sicurezza informatica ha scoperto decine di vulnerabilità in Firefox e nel kernel Linux, con accesso limitato a clienti autorizzati.
---

OpenAI ha presentato il 5 novembre un nuovo modello dedicato alla sicurezza informatica, chiamato GPT-6 Cyber, riservato ai clienti autorizzati del programma Daybreak Red. Secondo l'azienda, il modello ha individuato 81 vulnerabilità finora sconosciute in Firefox, classificate come gravi da Mozilla, che ha già iniziato a distribuire le correzioni. Nel kernel Linux, GPT-6 Cyber ha riprodotto 1.724 vulnerabilità già note e messo a punto exploit funzionanti per 948 di queste, segnalando a chi cura il kernel 304 scoperte critiche insieme a possibili correzioni. OpenAI classifica il modello come "critico" nel proprio quadro di sicurezza interno e per questo ne limita l'accesso a un numero ristretto di aziende. Secondo test indipendenti della società Irregular, GPT-6 Cyber ha completato tutti gli undici scenari di attacco multi-fase proposti, un risultato migliore del modello precedente GPT-6 Astra, che ne aveva completati otto.

## Un uso autorizzato, non una minaccia diretta

La notizia arriva a poche settimane da un'altra ricerca, pubblicata a fine ottobre da Epoch AI, in cui un modello concorrente open-weight aveva trasformato le patch di sicurezza di Firefox in exploit funzionanti nel giro di ore dalla loro pubblicazione, caso già raccontato su questo blog. La differenza, in questo caso, è che OpenAI ha condotto la ricerca direttamente con Mozilla e con i responsabili del kernel Linux, per anticipare e correggere i problemi prima che diventino pubblici, non per sfruttarli.

## Cosa cambia per chi usa Firefox

Mozilla ha già cominciato a distribuire le correzioni delle falle segnalate da GPT-6 Cyber. Chi usa Firefox dovrebbe verificare che gli aggiornamenti automatici del browser siano attivi, perché molte di queste vulnerabilità vengono corrette prima ancora di diventare pubbliche, ma solo se il programma si aggiorna regolarmente. Lo stesso vale per i sistemi Linux, dove le correzioni del kernel richiedono comunque che la distribuzione installata venga mantenuta aggiornata nel tempo.
