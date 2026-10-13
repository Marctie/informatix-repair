"""Test end-to-end del bot contro il vero gestionale locale (admin/server.mjs), senza Telegram:
gli Update/Context sono simulati. Avvia da solo il server, e al termine ripristina
content/usati/usati.json e la cartella foto.

Esecuzione (dalla cartella bot/):  .venv/Scripts/python -m unittest tests.test_e2e -v
"""
import asyncio
import base64
import shutil
import subprocess
import sys
import time
import unittest
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "content" / "usati" / "usati.json"
IMAGES = ROOT / "public" / "images" / "usati"
sys.path.insert(0, str(ROOT / "bot"))

from src import api, bot, config  # noqa: E402

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
USER = 42


def fake_update(text=None, photo=False, data=None):
    msg = MagicMock()
    msg.text = text
    msg.reply_text = AsyncMock()
    msg.photo = [SimpleNamespace(file_id="f1")] if photo else []
    q = None
    if data is not None:
        q = MagicMock()
        q.data = data
        q.answer = AsyncMock()
        q.edit_message_text = AsyncMock()
        q.message = msg
    return SimpleNamespace(
        message=msg, callback_query=q, effective_message=msg, effective_user=SimpleNamespace(id=USER)
    )


def fake_context(args=None):
    ctx = MagicMock()
    ctx.args = args or []
    ctx.user_data = {}
    f = MagicMock()
    f.download_as_bytearray = AsyncMock(return_value=bytearray(PNG))
    ctx.bot.get_file = AsyncMock(return_value=f)
    return ctx


def last_reply(update):
    return update.message.reply_text.call_args.args[0]


class E2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_backup = DATA.read_bytes()
        cls.images_before = {p.name for p in IMAGES.iterdir()}
        cls.server = subprocess.Popen(["node", str(ROOT / "admin" / "server.mjs")], cwd=ROOT, stdout=subprocess.DEVNULL)
        for _ in range(40):
            try:
                urllib.request.urlopen(config.API_BASE + "/api/items", timeout=1)
                break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("server gestionale non partito")
        config.TELEGRAM_ALLOWED_USER_IDS = {USER}

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=10)
        DATA.write_bytes(cls.data_backup)
        for p in IMAGES.iterdir():
            if p.name not in cls.images_before:
                shutil.rmtree(p, ignore_errors=True)
        subprocess.run(["node", str(ROOT / "scripts" / "build-usati.mjs")], cwd=ROOT, capture_output=True)

    def run_async(self, coro):
        return asyncio.run(coro)

    def test_full_flow(self):
        ctx = fake_context()

        async def flow():
            # utente non autorizzato
            config.TELEGRAM_ALLOWED_USER_IDS = {999}
            u = fake_update("/lista")
            await bot.cmd_lista(u, ctx)
            assert "non sei autorizzato" in last_reply(u).lower()
            config.TELEGRAM_ALLOWED_USER_IDS = {USER}

            n_before = len(await api.list_items())

            # /nuovo
            assert await bot.nuovo_start(fake_update("/nuovo"), ctx) == bot.PHOTOS
            assert await bot.nuovo_photos_done(fake_update("/fatto"), ctx) == bot.PHOTOS  # senza foto: resta
            assert await bot.nuovo_photo(fake_update(photo=True), ctx) == bot.PHOTOS
            assert await bot.nuovo_photos_done(fake_update("/fatto"), ctx) == bot.NAME
            assert await bot.nuovo_name(fake_update("Bot Test Articolo"), ctx) == bot.CATEGORY
            assert await bot.nuovo_category(fake_update(data="cat:smartphone"), ctx) == bot.CONDITION
            assert await bot.nuovo_condition(fake_update(data="cond:usato_scatola"), ctx) == bot.PRICE
            assert await bot.nuovo_price(fake_update("abc"), ctx) == bot.PRICE  # prezzo errato: ripete
            assert await bot.nuovo_price(fake_update("1.299,50"), ctx) == bot.NOTES
            assert await bot.nuovo_notes(fake_update("Prova automatica"), ctx) == bot.CONFIRM
            qu = fake_update(data="ok:yes")
            assert await bot.nuovo_confirm(qu, ctx) == bot.ConversationHandler.END
            assert "Pubblicato" in last_reply(qu)

            items = await api.list_items()
            assert len(items) == n_before + 1
            it = items[0]  # i nuovi articoli vanno in testa
            assert it["name"] == "Bot Test Articolo" and it["price"] == 1299.5 and it["photos"] == 1
            assert it["conditionLabel"] == "Usato con scatola" and it["status"] == "active"
            assert (IMAGES / it["slug"] / "1.jpg").exists()

            # /prezzo, /venduto, /riattiva
            u = fake_update("/prezzo")
            await bot.cmd_prezzo(u, fake_context(["1", "899"]))
            assert (await api.list_items())[0]["price"] == 899
            await bot.cmd_prezzo(u, fake_context(["1", "richiesta"]))
            assert (await api.list_items())[0]["price"] is None
            await bot.cmd_venduto(u, fake_context(["1"]))
            assert (await api.list_items())[0]["status"] == "sold"
            await bot.cmd_riattiva(u, fake_context(["1"]))
            assert (await api.list_items())[0]["status"] == "active"

            # numero inesistente
            u = fake_update("/venduto")
            await bot.cmd_venduto(u, fake_context(["999"]))
            assert "Non esiste" in last_reply(u)

            # /elimina con conferma
            u = fake_update("/elimina")
            await bot.cmd_elimina(u, fake_context(["1"]))
            slug = it["slug"]
            await bot.on_delete_button(fake_update(data="del:no"), ctx)
            assert len(await api.list_items()) == n_before + 1
            qd = fake_update(data=f"del:{slug}")
            await bot.on_delete_button(qd, ctx)
            assert len(await api.list_items()) == n_before
            assert not (IMAGES / slug).exists()

            # gestionale non raggiungibile -> messaggio chiaro, nessun crash
            config.API_BASE = "http://127.0.0.1:1"
            u = fake_update("/lista")
            await bot.cmd_lista(u, ctx)
            assert "non raggiungibile" in last_reply(u)

        old_base = config.API_BASE
        try:
            self.run_async(flow())
        finally:
            config.API_BASE = old_base


if __name__ == "__main__":
    unittest.main()
