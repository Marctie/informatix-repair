#!/data/data/com.termux/files/usr/bin/sh
# Una riga: RUNNING pid=<n> uptime=<hh:mm:ss> ultimo_log="..."  oppure STOPPED (exit 0 / 1)
cd "$(dirname "$0")" || exit 1
if [ -f bot.pid ] && kill -0 "$(cat bot.pid)" 2>/dev/null; then
  PID=$(cat bot.pid)
  S=$(ps -o etimes= -p "$PID" 2>/dev/null | tr -d ' ')
  if [ -z "$S" ]; then
    NOW=$(date +%s); T=$(stat -c %Y bot.pid 2>/dev/null || echo "$NOW"); S=$((NOW-T))
  fi
  LAST=$(tail -n 1 logs/bot.log 2>/dev/null | tr -d '"')
  printf 'RUNNING pid=%s uptime=%02d:%02d:%02d ultimo_log="%s"\n' "$PID" $((S/3600)) $((S%3600/60)) $((S%60)) "$LAST"
  exit 0
fi
echo "STOPPED"
exit 1
