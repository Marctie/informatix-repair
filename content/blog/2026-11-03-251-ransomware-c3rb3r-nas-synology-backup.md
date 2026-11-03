---
title: Ransomware C3RB3R colpisce i NAS Synology, cosa fare per i backup
date: 2026-11-03
description: Synology conferma attacchi ransomware contro i dispositivi con DSM non aggiornato e indica le versioni sicure da installare.
---

Synology ha confermato in un comunicato ufficiale una serie di attacchi ransomware contro i propri dispositivi NAS, identificati come C3RB3R, una variante della famiglia Cerber che da anni prende di mira gli apparecchi di archiviazione in rete. Chi viene colpito trova i file rinominati con l'estensione .L0CK3D e una richiesta di riscatto in ogni cartella.

## Due versioni sul punto di accesso

Secondo il bollettino Synology-SA-24:20, gli attacchi riguardano dispositivi con DSM non aggiornato. La società di sicurezza 360 attribuisce invece il problema a due vulnerabilità critiche che Synology aveva corretto a settembre. Le due ricostruzioni non concordano sul dettaglio tecnico, ma convergono su un punto: i NAS con il sistema operativo aggiornato alle ultime versioni non risultano coinvolti.

## Cosa consiglia il produttore

Synology indica come sicure le versioni più recenti di DSM, tra cui la 7.1.1-42962-7 per i modelli meno recenti, e consiglia di attivare gli aggiornamenti automatici per non doversene occupare manualmente. Due regole valgono per qualsiasi marca di NAS, non solo Synology: non esporre l'interfaccia di amministrazione direttamente su Internet, e tenere almeno una copia dei dati più importanti su un supporto separato, scollegato quando non serve. Un NAS, anche con i dischi in configurazione RAID, non è di per sé un backup: un ransomware che riesce a entrare può cifrare ogni volume a cui ha accesso in scrittura, comprese le copie salvate lì sopra. Al momento non esiste un decryptor pubblico per i file con estensione .L0CK3D, quindi ripristinare da una copia pulita resta la via più sicura in caso di infezione già avvenuta.

Chi ha un NAS in casa o in ufficio e non ricorda l'ultima volta che ha controllato gli aggiornamenti farebbe bene a verificarlo nei prossimi giorni, prima che il problema si presenti da solo.
