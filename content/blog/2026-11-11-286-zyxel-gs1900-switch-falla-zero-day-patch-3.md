---
title: Switch Zyxel GS1900, una falla zero-day colpisce quasi mille dispositivi nonostante la patch di giugno
date: 2026-11-11
description: Una vulnerabilità non risolta dall'aggiornamento di giugno ha permesso di compromettere centinaia di switch Zyxel GS1900: serve il firmware Patch 3.
---

Una nuova vulnerabilità negli switch di rete Zyxel della serie GS1900, diffusi anche in piccoli uffici e negozi, è stata usata per compromettere quasi mille dispositivi nel mondo. Secondo BleepingComputer e The Hacker News, la falla, identificata come CVE-2026-107441, permette di eseguire comandi di sistema senza bisogno di autenticarsi, e resta efficace anche sugli switch già aggiornati con la patch distribuita da Zyxel a giugno per un problema precedente.

## Perché la patch di giugno non è bastata

I ricercatori di sicurezza spiegano che l'aggiornamento di giugno copriva solo una parte del problema: la correzione completa arriva con il firmware che Zyxel indica come Patch 3, disponibile dalla fine di ottobre, con avviso ufficiale pubblicato il 3 novembre. Chi è fermo alla Patch 2 o a versioni precedenti resta esposto, anche credendo di avere già installato l'ultimo aggiornamento disponibile.

## Molti dispositivi avevano ancora le credenziali di fabbrica

Un dato segnalato dai ricercatori e ripreso da più testate è che, tra i circa 996 switch compromessi individuati, più della metà usava ancora nome utente e password predefiniti, mai cambiati dopo l'installazione. Dai dispositivi violati sono stati sottratti file di configurazione e credenziali di accesso, un problema serio per chi affida a questi switch la rete di un negozio o di un piccolo studio professionale.

Chi ha in uso uno switch Zyxel GS1900 dovrebbe controllare la versione del firmware dal pannello di gestione e installare la build Patch 3 specifica per il proprio modello, scaricabile dal sito di supporto Zyxel. È il momento buono anche per cambiare la password amministrativa predefinita e per limitare l'accesso all'interfaccia di gestione alla sola rete interna, senza lasciarla raggiungibile direttamente da internet.
