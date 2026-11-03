---
title: iOS 27.2, Apple corregge una falla che accendeva la fotocamera senza permesso
date: 2026-10-27
description: Il nuovo aggiornamento per iPhone e iPad risolve oltre 150 vulnerabilità, compresa una che permetteva a un'app di usare la fotocamera senza il consenso dell'utente.
---

Apple ha rilasciato il 26 ottobre iOS 27.2 e iPadOS 27.2, insieme agli aggiornamenti gemelli per le versioni precedenti ancora supportate (iOS e iPadOS 26.7.2, iOS e iPadOS 18.7.11) e per macOS, watchOS, tvOS, visionOS e Safari. Lo riporta la pagina ufficiale dei contenuti di sicurezza di Apple, che elenca oltre 150 correzioni solo per iOS e iPadOS.

## La falla della fotocamera

Tra le voci più rilevanti compare CVE-2026-86990, una vulnerabilità nel componente CoreMedia che, secondo la descrizione di Apple, permetteva a un'app dannosa di accedere alla fotocamera senza il permesso dell'utente. La correzione ha aggiunto controlli di accesso più stretti. Nello stesso aggiornamento sono state chiuse anche altre falle legate ai permessi: una in AccessorySetupKit riguardava l'accesso al Bluetooth senza consenso, mentre altre in Kernel, Spotlight e nell'app Foto permettevano ad alcune applicazioni di aggirare le preferenze sulla privacy o di leggere la libreria fotografica senza le autorizzazioni previste.

## Perché conviene installarlo subito

Nessuna delle falle risulta, al momento, sfruttata attivamente secondo quanto pubblicato da Apple, ma il numero e la natura delle correzioni (molte legate a permessi e dati personali) rendono l'aggiornamento una priorità per chi usa l'iPhone o l'iPad anche per foto, documenti o app di lavoro. L'installazione si avvia da Impostazioni, Generali, Aggiornamento Software, ed è gratuita per tutti i dispositivi compatibili con iOS 27 o con le versioni precedenti ancora aggiornate.

Chi possiede un iPhone o un iPad più datato, e teme che un aggiornamento importante come iOS 27 rallenti il dispositivo, può comunque installare queste patch di sicurezza senza preoccupazioni: a differenza del salto a un nuovo sistema operativo, le correzioni di questo tipo non richiedono risorse hardware aggiuntive e si limitano a chiudere le falle già individuate.
