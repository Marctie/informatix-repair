import asyncio
import logging

from src import config
from src.bot import build_app

logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)


def main():
    if not config.TELEGRAM_BOT_TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN non impostato. Copia .env.example in .env e compilalo.")
    if not config.TELEGRAM_ALLOWED_USER_IDS:
        logging.warning("TELEGRAM_ALLOWED_USER_IDS vuoto: nessuno potra' usare i comandi (solo /id).")
    app = build_app()
    # Python 3.14 non crea piu' un event loop nel thread principale (PTB 21.x lo assume).
    asyncio.set_event_loop(asyncio.new_event_loop())
    app.run_polling(close_loop=False)


if __name__ == "__main__":
    main()
