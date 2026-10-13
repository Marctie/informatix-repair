#!/data/data/com.termux/files/usr/bin/sh
# Ferma il bot: SIGTERM, attesa fino a 10 s, poi SIGKILL.
cd "$(dirname "$0")" || exit 1
if [ ! -f bot.pid ]; then echo "Gia' fermo"; exit 0; fi
PID=$(cat bot.pid)
if kill -0 "$PID" 2>/dev/null; then
  kill -TERM "$PID"
  i=0
  while kill -0 "$PID" 2>/dev/null && [ $i -lt 10 ]; do sleep 1; i=$((i+1)); done
  kill -0 "$PID" 2>/dev/null && kill -KILL "$PID"
fi
rm -f bot.pid
echo "Fermato"
