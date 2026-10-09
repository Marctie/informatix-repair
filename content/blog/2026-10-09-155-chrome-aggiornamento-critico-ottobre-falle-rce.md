---
title: Chrome, aggiornamento critico a inizio ottobre
date: 2026-10-09
description: Google ha corretto 247 falle di sicurezza, quattro critiche, che permettevano di eseguire codice tramite una pagina web creata ad arte.
---

Il 6 ottobre Google ha distribuito un nuovo aggiornamento del canale stabile di Chrome, portando il browser alla versione 155.0.8059.39 su Linux e alla 154.0.8037.39/.40 su Windows e Mac. Come riportato da Malwarebytes, il pacchetto corregge 247 problemi di sicurezza, quattro dei quali classificati come critici.

## Le falle più gravi

Tra le vulnerabilità corrette ci sono due use-after-free giudicate critiche, identificate come CVE-2026-106197 e CVE-2026-106358: la prima riguarda il modulo Browser, la seconda il sistema di navigazione. Entrambe, se sfruttate tramite una pagina web costruita ad arte, permetterebbero l'esecuzione di codice al di fuori della sandbox che normalmente isola le pagine aperte nel browser dal resto del sistema. È stata corretta anche una vulnerabilità ad alta gravità nel motore JavaScript V8, catalogata come CVE-2026-106240, che consentirebbe l'esecuzione di codice all'interno della sandbox dopo un primo exploit riuscito.

## Come verificare l'aggiornamento

Chrome si aggiorna da solo in background nella maggior parte dei casi, ma conviene controllare manualmente: dal menu con i tre puntini in alto a destra si entra in Impostazioni, poi Informazioni su Google Chrome. Se è disponibile una versione più recente di quella installata, la pagina lo segnala e basta riavviare il browser per completare l'installazione. La stessa attenzione vale per Android, dove l'aggiornamento arriva tramite il Play Store, e per ChromeOS, che richiede una connessione a internet per scaricare la patch e un riavvio del dispositivo.

Vale la pena controllare anche gli altri browser basati su Chromium installati sullo stesso computer: se un dispositivo resta inutilizzato per settimane, l'aggiornamento potrebbe non essere mai arrivato, lasciando aperte falle già note e quindi più facili da individuare e sfruttare da chi le conosce.
