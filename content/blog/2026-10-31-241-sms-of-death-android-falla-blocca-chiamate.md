---
title: Android, un SMS invisibile può bloccare le chiamate del telefono
date: 2026-10-31
description: Una falla ribattezzata "SMS of Death" fa crashare il servizio telefonico di Android con un messaggio malformato che non compare mai nella casella.
---

Il ricercatore di sicurezza Mark Blaszczyk ha pubblicato il 29 ottobre i dettagli di una falla che riguarda il componente Android dedicato ai messaggi WAP Push, la tecnologia usata ad esempio per le notifiche MMS. Un SMS costruito in modo malformato fa andare in crash il processo che gestisce la telefonia, interrompendo le chiamate in corso comprese quelle di emergenza. Il messaggio non arriva mai nella casella e non genera alcuna notifica visibile, quindi chi lo riceve non si accorge di nulla se non per il blocco improvviso.

## Perché è più insidioso di un normale bug

Secondo quanto riportato da siti specializzati come GSMArena e CyberInsider, il problema nasce da un errore di programmazione: Android tenta di creare un array con una lunghezza negativa e il tentativo manda in crash il processo com.android.phone. Il ricercatore ha segnalato che inviare più messaggi di questo tipo può rendere il telefono quasi inutilizzabile, perché il database degli SMS resta corrotto e il crash si ripete a ogni riavvio, finché non viene corretto manualmente. La falla risulta riprodotta su versioni di Android comprese tra la 12 e la 16, su dispositivi sia Pixel che Samsung Galaxy.

## Una correzione in ritardo

Blaszczyk aveva segnalato il problema a Google già il 5 maggio, ma l'azienda lo aveva archiviato come non legato alla sicurezza, rifiutando di intervenire. Solo il 29 ottobre, insieme alla pubblicazione pubblica della falla, Google ha confermato una correzione, anche se le fonti non concordano su quando arriverà per tutti: secondo alcuni rientrerebbe già nella patch di ottobre per i dispositivi con Android 14 o successivi, secondo altri sarebbe prevista nel bollettino di sicurezza di novembre. Per Android 12 e 13, versioni non più supportate da Google, non è previsto alcun intervento ufficiale.

## Cosa controllare sul proprio telefono

Chi ha un dispositivo con Android 14 o più recente dovrebbe verificare in Impostazioni, sotto la voce sicurezza del sistema, di avere installato l'ultima patch disponibile e aggiornarla se compare una versione più recente. Chi usa ancora Android 12 o 13 non ha una soluzione definitiva da Google, quindi in caso di crash ripetuti delle chiamate senza causa apparente vale la pena far controllare il telefono, perché un ripristino o la cancellazione della cache dei messaggi può bastare a eliminare il messaggio corrotto che blocca il sistema.
