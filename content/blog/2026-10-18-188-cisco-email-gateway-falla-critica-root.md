---
title: Una falla critica nei sistemi email Cisco permette l'accesso come amministratore
date: 2026-10-18
description: Cisco ha confermato attacchi reali contro una vulnerabilità nei propri sistemi di sicurezza per la posta elettronica, da correggere subito dove non è ancora stato fatto.
---

Cisco ha pubblicato il 14 ottobre un avviso su una vulnerabilità critica nei propri apparati Secure Email Gateway, i sistemi che molte aziende usano per filtrare la posta elettronica in entrata. La falla, identificata come CVE-2026-76519 e valutata 9,8 su 10 nella scala CVSS, risulta già sfruttata in attacchi reali secondo quanto riportato da BleepingComputer, SecurityWeek e Security Affairs. La vulnerabilità è stata inserita nel catalogo delle falle note e attivamente sfruttate gestito dall'agenzia statunitense CISA, che impone alle amministrazioni federali americane di correggerla entro il 17 ottobre.

## Come funziona l'attacco

Il problema riguarda la funzione di analisi degli allegati basata sulla reputazione dei file: basta un'email con un allegato preparato ad arte, senza bisogno che qualcuno la apra o inserisca credenziali, per permettere a un attaccante remoto di scrivere file sul sistema e ottenere i privilegi più alti, equivalenti a quelli di un amministratore. Non esistono soluzioni temporanee: Cisco indica solo l'aggiornamento del software come rimedio, con una migrazione a una versione più recente per gli apparati più datati che non ricevono più una correzione dedicata. È la seconda volta in poche settimane che un sistema Secure Email Gateway di Cisco viene colpito da una falla simile: a settembre era stata corretta un'altra vulnerabilità che permetteva lo stesso tipo di accesso.

## Cosa conviene fare

Chi gestisce una piccola attività con un apparato di questo tipo in rete, anche affidato a un fornitore esterno, dovrebbe verificare con chi se ne occupa che l'aggiornamento sia già stato installato, perché restare indietro con le patch su un sistema esposto a internet è il modo più comune con cui le reti aziendali vengono compromesse. Per chi invece non usa apparati Cisco, la storia resta comunque un buon ricordo pratico: un allegato di posta può bastare da solo a far entrare un attaccante in un sistema, anche quando quel sistema è pensato apposta per bloccarlo. Aprire allegati solo da mittenti conosciuti, e controllare sempre l'indirizzo reale del mittente prima di cliccare, è una delle abitudini più semplici ed efficaci per limitare il rischio.
