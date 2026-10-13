#!/data/data/com.termux/files/usr/bin/sh
# Ultime N righe del log (default 50).
cd "$(dirname "$0")" || exit 1
tail -n "${1:-50}" logs/bot.log 2>/dev/null || echo "Nessun log"
