# Bot Telegram – Gestionale Vetrina Usati

Bot (python-telegram-bot 21.4) che pilota il gestionale locale `admin/server.mjs` tramite le sue API HTTP: nessuna logica duplicata.

## Stato
Codice scritto e testato con Update simulati contro il vero server (`tests/test_e2e.py`). **Mai provato su Telegram reale** e non installato sul telefono (da fare quando l'utente lo chiede, via ADB/Termux).

## Comandi
`/nuovo` (foto → nome → categoria → condizione → prezzo → note → conferma), `/lista`, `/venduto n`, `/riattiva n`, `/prezzo n importo`, `/elimina n`, `/annulla`, `/help`, `/id`.

## Avvio
```
cd bot
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # su Termux: pip install -r requirements.txt
copy .env.example .env                              # compilare TELEGRAM_BOT_TOKEN (da @BotFather) e TELEGRAM_ALLOWED_USER_IDS
npm run admin                                       # dalla radice, in un altro terminale
.venv/Scripts/python main.py
```
Il proprio ID Telegram si scopre scrivendo `/id` al bot (funziona anche prima di essere autorizzati).

## Test
`.venv/Scripts/python -m unittest tests.test_e2e -v` (avvia da solo il server e ripristina `usati.json` e le foto).

## Limiti noti
- `API_BASE` punta a `127.0.0.1:4848`: il bot funziona solo sulla stessa macchina del gestionale finché non esisterà il backend online.
- Gli articoli creati dal bot non hanno traduzioni EN (il sito mostra il testo italiano) né scheda tecnica/batteria: si completano dal pannello web.
