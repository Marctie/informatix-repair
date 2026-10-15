---
title: Windows, lo zero-day di ottobre aggira l'avviso sui file scaricati da internet
date: 2026-10-15
description: Tra le oltre mille correzioni del Patch Tuesday di ottobre c'è una falla già sfruttata che permette di aprire file pericolosi senza il consueto avviso di sicurezza.
---

Il Patch Tuesday di ottobre, rilasciato il 13 ottobre da Microsoft, è stato uno dei più pesanti dell'anno: secondo BleepingComputer corregge 1.411 vulnerabilità, di cui circa 70 classificate critiche, mentre altre fonti come CrowdStrike indicano cifre molto vicine (1.413 CVE e 75 critiche). Tra le tre vulnerabilità zero-day incluse nell'aggiornamento, una risulta già sfruttata attivamente dagli attaccanti.

## Cosa fa la falla già sfruttata

Si tratta di CVE-2026-96951, una vulnerabilità in Windows Shell con punteggio di gravità 8,8 su 10, confermata da Microsoft come già usata in attacchi reali secondo CrowdStrike e Lansweeper. Il problema permette di aggirare il "Mark of the Web", il meccanismo che normalmente fa comparire un avviso quando si tenta di aprire un file scaricato da internet, da una email o da un programma di messaggistica. Senza quell'avviso, un file malevolo mascherato da documento innocuo può essere eseguito più facilmente, a patto che la vittima lo apra o ci clicchi sopra: per questo motivo resta centrale non scaricare allegati o file da mittenti non conosciuti, anche quando l'estensione sembra familiare.

## Le altre due falle rese pubbliche

Le altre due vulnerabilità zero-day del mese non risultano sfruttate, ma sono già di pubblico dominio. Una riguarda .NET Framework (CVE-2026-108398), scoperta da un ricercatore di Google Project Zero, e può compromettere le restrizioni del controllo applicativo WDAC permettendo l'esecuzione di software non autorizzato. L'altra, di gravità moderata, è un problema di negazione del servizio nella libreria MessagePack-CSharp.

Con questo aggiornamento, Windows 11 24H2 nelle edizioni Home e Pro ha anche ricevuto l'ultima patch prevista dal proprio ciclo di supporto, come segnalato nelle settimane scorse. Chi non ha ancora installato gli aggiornamenti di ottobre, su Windows come su qualsiasi altro sistema, farebbe bene a non rimandare: una falla già attiva in rete è un rischio concreto, non teorico, specialmente per chi scarica regolarmente file da fonti diverse dai canali ufficiali.
