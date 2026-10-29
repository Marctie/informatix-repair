---
title: Certificati eMudhra compromessi, Windows rilascia un aggiornamento da installare a mano
date: 2026-10-29
description: Otto chiavi private deboli della società eMudhra possono creare certificati falsi ma validi; Microsoft ha pubblicato patch da scaricare manualmente dal Microsoft Update Catalog.
---

Un ricercatore di sicurezza ha individuato otto chiavi private deboli usate dall'autorità di certificazione eMudhra per generare altrettanti certificati digitali, come riportato da Punto Informatico citando Bleeping Computer. Sei di queste chiavi riguardano certificati TLS, che potrebbero servire per impersonare un sito o un servizio e intercettare le comunicazioni; le altre due sono chiavi per la firma del codice, che potrebbero far passare un software infetto come proveniente da uno sviluppatore affidabile.

## Perché riguarda anche chi non lo sa

Il problema è che un certificato creato con una di queste chiavi verrebbe comunque considerato valido da browser e sistemi operativi, anche se non è stato emesso realmente da eMudhra. Microsoft ha già aggiornato la lista dei certificati non attendibili di Windows e ha distribuito un filtro automatico per Edge e WebView2 che blocca i certificati TLS coinvolti. Il problema è che non tutti i sistemi, in particolare quelli aziendali con aggiornamenti gestiti centralmente, ricevono automaticamente questa lista aggiornata.

## Come installare la correzione

Per questo motivo Microsoft ha pubblicato aggiornamenti dedicati, da scaricare manualmente dal Microsoft Update Catalog perché non arrivano tramite Windows Update: KB5134133 per Windows 11 26H2, 25H2 e 24H2, KB5134130 per Windows 11 23H2, KB5134125 per Windows 10 22H2 e 21H2. Prima di scaricare va verificata la versione del sistema e l'architettura del processore, x64 o arm64.

Per un utente privato con gli aggiornamenti automatici attivi il rischio pratico è limitato, perché le protezioni principali arrivano già da sole tramite browser e liste di blocco. Vale comunque la pena controllare, nelle impostazioni di Windows Update, che il sistema non abbia aggiornamenti in sospeso da settimane: è un controllo che richiede un minuto e può evitare sorprese ben peggiori di un certificato scaduto.
