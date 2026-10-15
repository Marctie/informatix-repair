#!/data/data/com.termux/files/usr/bin/sh
# Da copiare in ~/.termux/boot/informatix-bot.sh (Termux:Boot). Solo se non esiste gia' uno script con quel nome.
termux-wake-lock
cd "$HOME/informatix-bot" || exit 1
sh ./start.sh
