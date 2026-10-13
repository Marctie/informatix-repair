"""Test del bot Termux con rete simulata.  Esecuzione: python -m unittest discover -s termux-bot/tests"""
import io
import logging
import os
import subprocess
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import main as bot  # noqa: E402

CFG = {"TELEGRAM_BOT_TOKEN": "123456:SECRETTOKEN_abcdefghijklmnopqrstuvwxyz", "TELEGRAM_OWNER_ID": "999"}


class Resp:
    status = 200
    def __enter__(self): return self
    def __exit__(self, *a): return False


class AntiRimbalzo(unittest.TestCase):
    def test_serve_doppio_fallimento_poi_avviso_solo_al_cambio(self):
        m = bot.Monitor(["Sito"])
        self.assertIsNone(m.update("Sito", False, 1000))        # 1 solo fallimento: niente
        self.assertIn("non risponde", m.update("Sito", False, 1300))
        self.assertIsNone(m.update("Sito", False, 1600))        # gia' giu': niente ripetizioni
        self.assertIsNone(m.update("Sito", False, 1900))

    def test_fallimento_isolato_non_avvisa(self):
        m = bot.Monitor(["Sito"])
        self.assertIsNone(m.update("Sito", False, 0))
        self.assertIsNone(m.update("Sito", True, 300))
        self.assertIsNone(m.update("Sito", False, 600))
        self.assertTrue(m.state["Sito"]["up"])

    def test_ritorno_su_con_durata(self):
        m = bot.Monitor(["Sito"])
        m.update("Sito", False, 0)
        m.update("Sito", False, 300)
        msg = m.update("Sito", True, 300 + 3600)
        self.assertIn("tornato online", msg)
        self.assertIn("1 h", msg)
        self.assertIsNone(m.update("Sito", True, 99999))

    def test_codici_http(self):
        for c in (200, 302, 401, 403, 404):
            self.assertTrue(bot.is_up(c), c)
        for c in (None, 500, 502, 503):
            self.assertFalse(bot.is_up(c), c)

    def test_run_checks_invia_al_cambio(self):
        sent = []
        m = bot.Monitor([n for n, _ in bot.SERVICES])
        down = lambda url: None
        send = lambda cfg, t: sent.append(t)
        bot.run_checks(m, CFG, 0, check=down, send=send)
        self.assertEqual(sent, [])
        bot.run_checks(m, CFG, 300, check=down, send=send)
        self.assertEqual(len(sent), len(bot.SERVICES))
        bot.run_checks(m, CFG, 600, check=lambda u: 200, send=send)
        self.assertEqual(len(sent), 2 * len(bot.SERVICES))


class Riepilogo(unittest.TestCase):
    def test_testo_con_venduti(self):
        m = bot.Monitor(["Sito", "Vetrina Usati"])
        m.state["Sito"]["up"] = False
        t = bot.build_summary(m, {"items": [{"sold": True}, {"sold": False}, {"sold": False}]}, datetime(2026, 10, 14, 21, 0))
        self.assertIn("🔴 Sito", t)
        self.assertIn("2 online, 1 venduti", t)

    def test_solo_totale_se_mancano_i_campi(self):
        m = bot.Monitor(["Sito"])
        self.assertIn("13 articoli", bot.build_summary(m, {"count": 13, "items": [{"name": "x"}] * 13}, datetime(2026, 10, 14, 21, 0)))

    def test_orario_e_una_volta_al_giorno(self):
        sent = []
        send = lambda cfg, t: sent.append(t)
        m = bot.Monitor(["Sito"])
        fetch = lambda: {"items": []}
        # 19:00 UTC = 21:00 Roma (ora legale)
        d = bot.maybe_summary(m, CFG, None, datetime(2026, 7, 1, 18, 59, tzinfo=timezone.utc), fetch, send)
        self.assertEqual(sent, [])
        d = bot.maybe_summary(m, CFG, d, datetime(2026, 7, 1, 19, 0, tzinfo=timezone.utc), fetch, send)
        self.assertEqual(len(sent), 1)
        bot.maybe_summary(m, CFG, d, datetime(2026, 7, 1, 19, 30, tzinfo=timezone.utc), fetch, send)
        self.assertEqual(len(sent), 1)
        # inverno: 20:00 UTC = 21:00 Roma
        bot.maybe_summary(m, CFG, None, datetime(2026, 12, 1, 19, 59, tzinfo=timezone.utc), fetch, send)
        self.assertEqual(len(sent), 1)
        bot.maybe_summary(m, CFG, None, datetime(2026, 12, 1, 20, 0, tzinfo=timezone.utc), fetch, send)
        self.assertEqual(len(sent), 2)


class Sicurezza(unittest.TestCase):
    def test_rifiuta_altri_id(self):
        with mock.patch("urllib.request.urlopen") as u:
            self.assertFalse(bot.tg_send(CFG, "ciao", chat_id="12345"))
            u.assert_not_called()
            self.assertTrue(bot.tg_send(CFG, "ciao", chat_id=999, opener=lambda req, timeout: Resp()))

    def test_invia_solo_al_proprietario(self):
        seen = []
        def op(req, timeout):
            seen.append(req.data)
            return Resp()
        bot.tg_send(CFG, "x", opener=op)
        self.assertIn(b'"chat_id": "999"', seen[0])

    def test_nessun_token_nei_log(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "logs", "bot.log")
            bot.setup_logging([CFG["TELEGRAM_BOT_TOKEN"], CFG["TELEGRAM_OWNER_ID"]], p)
            bot.log.info("token %s id %s", CFG["TELEGRAM_BOT_TOKEN"], CFG["TELEGRAM_OWNER_ID"])
            def boom(req, timeout): raise OSError("https://api.telegram.org/bot" + CFG["TELEGRAM_BOT_TOKEN"])
            bot.tg_send(CFG, "x", opener=boom)
            for h in bot.log.handlers: h.flush()
            txt = open(p, encoding="utf-8").read()
            self.assertNotIn("SECRETTOKEN", txt)
            self.assertNotIn("999", txt)
            self.assertIn("[segreto]", txt)
            for h in bot.log.handlers[:]:
                h.close(); bot.log.removeHandler(h)


class Processo(unittest.TestCase):
    def test_pid_scritto_e_rimosso(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "bot.pid")
            bot.write_pid(p)
            self.assertEqual(open(p).read(), str(os.getpid()))
            bot.remove_pid(p)
            self.assertFalse(os.path.exists(p))

    def test_secondo_avvio_esce_subito(self):
        sleeper = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        try:
            with tempfile.TemporaryDirectory() as d:
                p = os.path.join(d, "bot.pid")
                open(p, "w").write(str(sleeper.pid))
                self.assertEqual(bot.already_running(p), sleeper.pid)
                with mock.patch.object(bot, "PID_FILE", p), mock.patch.object(bot, "load_env", return_value=CFG), \
                        mock.patch.object(bot, "setup_logging") as sl, mock.patch("sys.stderr", new_callable=io.StringIO) as err:
                    self.assertEqual(bot.main([]), 3)
                    sl.assert_not_called()
                self.assertIn("già in esecuzione", err.getvalue())
                self.assertEqual(open(p).read(), str(sleeper.pid))  # il pid dell'altra istanza non viene toccato
        finally:
            sleeper.kill(); sleeper.wait()

    def test_pid_vecchio_non_blocca(self):
        dead = subprocess.Popen([sys.executable, "-c", "pass"])
        dead.wait()
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "bot.pid")
            open(p, "w").write(str(dead.pid))
            self.assertIsNone(bot.already_running(p))

    def test_sigterm_chiude_in_modo_ordinato(self):
        with self.assertRaises(bot.Stop):
            bot._on_signal(15, None)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "bot.pid")
            with mock.patch.object(bot, "PID_FILE", p), mock.patch.object(bot, "HEARTBEAT_FILE", os.path.join(d, "heartbeat")), \
                    mock.patch.object(bot, "load_env", return_value=CFG), mock.patch.object(bot, "setup_logging"), \
                    mock.patch.object(bot, "run_checks"), mock.patch.object(bot, "maybe_summary", return_value=None), \
                    mock.patch("signal.signal"), mock.patch("time.sleep", side_effect=bot.Stop):
                self.assertEqual(bot.main([]), 0)
            self.assertFalse(os.path.exists(p))
            self.assertTrue(os.path.exists(os.path.join(d, "heartbeat")))

    @unittest.skipIf(os.name == "nt", "SIGTERM reale solo su Linux/Android")
    def test_sigterm_reale(self):
        with tempfile.TemporaryDirectory() as d:
            code = ("import sys,time,signal; sys.path.insert(0,%r); import main as b; b.PID_FILE=%r; "
                    "b.write_pid(); signal.signal(15, b._on_signal)\n"
                    "try:\n time.sleep(30)\nexcept b.Stop:\n pass\nfinally:\n b.remove_pid()" % (os.path.join(os.path.dirname(__file__), ".."), os.path.join(d, "bot.pid")))
            pr = subprocess.Popen([sys.executable, "-c", code])
            time.sleep(1.5)
            pr.terminate()
            pr.wait(10)
            self.assertFalse(os.path.exists(os.path.join(d, "bot.pid")))


if __name__ == "__main__":
    unittest.main()
