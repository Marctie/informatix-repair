# Bot di controllo Informatix (Termux)

Controlla i servizi e i numeri di Informatix e scrive **solo al proprietario** su Telegram. Non riceve e non esegue nessun comando.
Solo libreria standard di Python 3: nessuna dipendenza.

**Ogni 5 minuti**
- Servizi: gestionale (302/200/401/403 = vivo), tracciamento clienti (404 = vivo), sito e Vetrina Usati. Giù = timeout, errore di rete o 5xx.
  Avvisa **solo al cambio di stato** (dopo 2 controlli falliti di fila) e se un servizio è **lento** (oltre 8 s per 3 controlli di fila).
- Numeri del gestionale da `https://riparazioni.informatixrepair.com/api/monitor` con la chiave `MONITOR_TOKEN` (stessa chiave nei segreti del Worker e nel `.env`). Senza chiave giusta l'indirizzo risponde 404.
  Controlli: **Vetrina Usati allineata** (articoli sul sito = articoli nel gestionale, salvo modifiche ancora da pubblicare; avviso dopo 15 minuti), **errore di pubblicazione**, **backup notturno** presente dopo le 6:00, **dati leggibili**. Ogni lettura fa partire anche i **promemoria scaduti** del gestionale (arrivano anche a gestionale chiuso).

**Buongiorno** (lun-sab alle 8:30): promemoria di oggi, riparazioni pronte da ritirare (da quanti giorni), in ritardo, preventivi in attesa o rifiutati, giacenze scadute, ordini arrivati da avvisare / in ritardo / da fare, preventivi in scadenza, magazzino esaurito o sotto scorta, backup della notte.

**Riepilogo** (ogni sera alle 21:00): servizi e minuti di fermo del giorno; incassi di oggi per metodo e per tipo, buoni usati, spese e netto; vendite (numero, totale, articoli); riparazioni entrate, consegnate, aperte per stato, in ritardo, urgenti, pronte non ritirate; ordini; totali del mese; Vetrina Usati (in vetrina, venduti, sito allineato); articoli del blog pubblicati oggi; attività e ultimi accessi; backup.

> Nota (2026-10-15): la versione 1 contava gli articoli della Vetrina leggendo `items` di `/usati.json`, che contiene solo i 3 in evidenza della home: per questo diceva 3 invece di 13. Ora usa il totale (`count`) e i numeri del gestionale.

**Prove senza aspettare**: `python main.py --anteprima` stampa buongiorno e riepilogo con i dati di adesso; `python main.py --anteprima --invia` li manda su Telegram (con la scritta ANTEPRIMA).

## Installazione su Termux (passo passo)

1. `pkg update && pkg install python`
2. `mkdir -p ~/informatix-bot` e copia qui i file di questa cartella (`main.py`, `*.sh`, `requirements.txt`).
3. Crea il file `.env` (mai nel repository) partendo da `.env.example`:
   ```
   cp .env.example .env && nano .env
   ```
   e compila `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID` e `MONITOR_TOKEN` (la stessa chiave caricata nel Worker con `npx wrangler secret put MONITOR_TOKEN --config officina/wrangler.jsonc`; mai in chat né nel repository).
4. Prova: `cd ~/informatix-bot && python main.py --test` (fa un controllo e manda "TEST bot Termux attivo", dicendo anche se i dati del gestionale sono leggibili).
5. Avvio: `python main.py` (in primo piano) oppure `sh start.sh` (in background).

### Avvio automatico con Termux:Boot
```
mkdir -p ~/.termux/boot
cp ~/informatix-bot/boot-informatix-bot.sh ~/.termux/boot/informatix-bot.sh
chmod +x ~/.termux/boot/informatix-bot.sh
```
Lo script usa `termux-wake-lock` e lancia il bot in background con `nohup`. Installa l'app Termux:Boot e aprila una volta.

## Script (SOLO installazione standalone, senza Control Center)
`start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `logs.sh [righe]`.
**Non usarli insieme al Termux Control Center**: ci sarebbero due istanze. (Il bot comunque rifiuta un secondo avvio se `bot.pid` punta a un processo vivo.)

## Contratto per il Control Center
- Cartella: `~/informatix-bot`; avvio in primo piano: `python main.py` (dalla cartella); entry point `main.py`.
- `bot.pid`: scritto all'avvio, rimosso all'uscita pulita. SIGTERM/SIGINT chiudono in modo ordinato. Secondo avvio con pid vivo: esce subito (codice 3) con messaggio chiaro.
- Log: `~/informatix-bot/logs/bot.log` (1 MB × 3 file, ora Europe/Rome, livello); mai token, chiavi o ID.
- Un errore in un giro di controlli viene scritto nel log e il bot continua.
- `heartbeat`: aggiornato con l'ora ogni minuto.
- Nessun file fuori da `~/informatix-bot`.
- `status.sh`: `RUNNING pid=<n> uptime=<hh:mm:ss> ultimo_log="..."` (exit 0) oppure `STOPPED` (exit 1).

## Test
`python -m unittest discover -s tests` (rete simulata).
