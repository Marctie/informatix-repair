# Bot di controllo Informatix (Termux)

Controlla i servizi di Informatix e scrive **solo al proprietario** su Telegram. Non riceve e non esegue nessun comando.

- Ogni 5 minuti controlla: gestionale (302/200/401/403 = vivo), tracciamento clienti (404 = vivo), sito e Vetrina Usati. Giù = timeout, errore di rete o 5xx.
- Avvisa **solo al cambio di stato** (su → giù, giù → su con durata), dopo 2 controlli consecutivi falliti.
- Ogni giorno alle 21:00 (Europe/Rome) manda il riepilogo con lo stato dei servizi e gli articoli della Vetrina Usati.
- Solo libreria standard di Python 3: nessuna dipendenza (`requirements.txt` è vuoto di pacchetti).

## Installazione su Termux (passo passo)

1. `pkg update && pkg install python`
2. `mkdir -p ~/informatix-bot` e copia qui i file di questa cartella (`main.py`, `*.sh`, `requirements.txt`).
3. Crea il file `.env` (mai nel repository) partendo da `.env.example`:
   ```
   cp .env.example .env && nano .env
   ```
   e compila `TELEGRAM_BOT_TOKEN` e `TELEGRAM_OWNER_ID`.
4. Prova: `cd ~/informatix-bot && python main.py --test` (fa un controllo e manda "TEST bot Termux attivo").
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
- Log: `~/informatix-bot/logs/bot.log` (1 MB × 3 file, ora Europe/Rome, livello); mai token o ID.
- `heartbeat`: aggiornato con l'ora ogni minuto.
- Nessun file fuori da `~/informatix-bot`.
- `status.sh`: `RUNNING pid=<n> uptime=<hh:mm:ss> ultimo_log="..."` (exit 0) oppure `STOPPED` (exit 1).

## Test
`python -m unittest discover -s tests` (rete simulata).
