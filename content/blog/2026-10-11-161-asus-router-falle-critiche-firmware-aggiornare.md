---
title: Due falle critiche nei router ASUS, perché conviene aggiornare il firmware subito
date: 2026-10-11
description: ASUS ha pubblicato il 1° ottobre due avvisi di sicurezza per vulnerabilità gravi nell'interfaccia di gestione di alcuni router di fascia alta.
---

ASUS ha pubblicato il 1° ottobre due bollettini di sicurezza che riguardano alcuni dei suoi router più diffusi. La falla più grave, identificata come CVE-2026-14157, riceve un punteggio di gravità di 9,4 su 10 ed è stata segnalata da diverse fonti specializzate come cybernews.com e secnews.gr. Si trova nell'interfaccia web di gestione dei modelli con firmware della serie 3.0.0.6_102: un attaccante già autenticato può caricare un file di configurazione VPN appositamente creato e fare eseguire comandi al router. Un secondo problema, CVE-2026-13313, valutato 8,9, riguarda anche le serie di firmware 3.0.0.4_386 e 3.0.0.4_388 e permette a chi ha già accesso da remoto di eseguire comandi con privilegi più alti del previsto.

## Serve già una password per sfruttarla, ma il rischio resta

Le fonti consultate precisano che entrambe le falle richiedono privilegi elevati o un accesso già autenticato: non si tratta quindi di un attacco che chiunque può lanciare dall'esterno senza credenziali. Il problema è che molte reti domestiche e di piccoli uffici usano ancora la password di amministrazione di fabbrica, oppure la condividono con più persone, rendendo più facile per un malintenzionato arrivare a quel primo accesso. Al momento non risultano exploit pubblici né segnalazioni di attacchi già in corso.

## Cosa fare sul proprio router

ASUS non ha indicato un unico firmware correttivo per tutti i modelli coinvolti: la pagina di supporto del proprio router indica se e quale aggiornamento installare. Nel frattempo è buona norma cambiare la password amministrativa con una lunga e univoca, importare file di configurazione VPN solo da fonti verificate e disattivare l'accesso da remoto all'interfaccia di gestione se non è strettamente necessario. Chi non ha mai controllato il firmware del proprio router da quando lo ha installato è probabilmente il caso che lo faccia proprio in questi giorni.
