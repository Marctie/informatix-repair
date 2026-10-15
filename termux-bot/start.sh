#!/data/data/com.termux/files/usr/bin/sh
# Avvia il bot in background (nohup + wake-lock). Rifiuta se e' gia' in esecuzione.
cd "$(dirname "$0")" || exit 1
if [ -f bot.pid ] && kill -0 "$(cat bot.pid)" 2>/dev/null; then
  echo "Gia' in esecuzione (pid $(cat bot.pid))"
  exit 1
fi
rm -f bot.pid
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
mkdir -p logs
nohup python main.py >> logs/nohup.out 2>&1 &
sleep 2
if [ -f bot.pid ] && kill -0 "$(cat bot.pid)" 2>/dev/null; then
  echo "Avviato (pid $(cat bot.pid))"
else
  echo "Avvio fallito: vedi logs/nohup.out"
  exit 1
fi
