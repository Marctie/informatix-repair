#!/data/data/com.termux/files/usr/bin/sh
# Aggiorna il bot sul telefono (da eseguire IN Termux). Uso: sh aggiorna-telefono.sh [file-nuovo-main.py]
# Passi: backup datato di main.py -> copia del nuovo -> controllo sintassi -> riavvio con bot_ctl ->
#        verifica (log "Bot avviato" + heartbeat + --anteprima) -> se qualcosa fallisce RIPRISTINA il backup e riavvia.
# Non legge ne' stampa mai il file .env.
DIR="$HOME/informatix-bot"
NEW="${1:-$DIR/main.py.new}"
CTL="$HOME/bots/Termux-Launcher/bot_ctl.sh"
LOG="$DIR/logs/bot.log"
cd "$DIR" || { echo "ERRORE: cartella $DIR non trovata"; exit 1; }
[ -f "$NEW" ] || { echo "ERRORE: manca il file nuovo ($NEW). Copialo sul telefono e rilancia."; exit 1; }
[ -f main.py ] || { echo "ERRORE: main.py attuale non trovato"; exit 1; }

BK="main.py.bak-$(date +%Y%m%d-%H%M%S)"
cp main.py "$BK" || { echo "ERRORE: backup non riuscito"; exit 1; }
echo "1/5 Backup: $BK"

restart() { if [ -x "$CTL" ] || [ -f "$CTL" ]; then sh "$CTL" informatix_repair restart; else sh ./restart.sh; fi; }
rollback() {
    echo "!!! $1 -> RIPRISTINO il backup $BK"
    cp "$BK" main.py && restart
    sleep 5
    tail -n 5 "$LOG" 2>/dev/null
    echo "Ripristinato il vecchio main.py. Il nuovo NON e' attivo."
    exit 1
}

cp "$NEW" main.py || rollback "copia non riuscita"
echo "2/5 Copiato il nuovo main.py"
python -m py_compile main.py || rollback "il nuovo main.py ha errori di sintassi"
echo "3/5 Sintassi ok"

restart || rollback "riavvio non riuscito"
echo "4/5 Riavviato, attendo 8 secondi..."
sleep 8
tail -n 40 "$LOG" 2>/dev/null | grep -q "Bot avviato" || rollback "nel log non c'e' 'Bot avviato'"
tail -n 15 "$LOG" 2>/dev/null | grep -q "Traceback" && rollback "nel log c'e' un errore (Traceback)"
[ -f heartbeat ] || rollback "manca il file heartbeat"

echo "5/5 Verifica con --anteprima (solo stampa, non invia nulla)..."
python main.py --anteprima > "$HOME/anteprima.tmp" 2>&1
RC=$?
head -n 8 "$HOME/anteprima.tmp"; rm -f "$HOME/anteprima.tmp"
[ "$RC" -le 1 ] || rollback "--anteprima e' andato in errore (codice $RC)"
# codice 1 = dati del gestionale non leggibili (rete/chiave): il bot nuovo funziona, lo segnaliamo soltanto
[ "$RC" -eq 1 ] && echo "ATTENZIONE: dati del gestionale non leggibili ora (vedi riga sopra): controlla rete o MONITOR_TOKEN."
echo "FATTO: bot aggiornato. Ultime righe del log:"
tail -n 5 "$LOG"
echo "Per tornare indietro: cp $BK main.py && sh $CTL informatix_repair restart"
