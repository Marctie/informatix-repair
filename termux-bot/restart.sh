#!/data/data/com.termux/files/usr/bin/sh
cd "$(dirname "$0")" || exit 1
sh ./stop.sh
sh ./start.sh
