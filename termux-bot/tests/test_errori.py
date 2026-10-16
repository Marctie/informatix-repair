"""Test degli errori parlanti del bot Termux (rete simulata).  Esecuzione: python -m unittest discover -s termux-bot/tests"""
import io
import json
import os
import socket
import sys
import tempfile
import unittest
import urllib.error
from datetime import datetime, timezone, timedelta
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import main as bot  # noqa: E402
from test_bot import CFG, DATA, Resp, ROME  # noqa: E402


def http_err(code, body=None):
    return urllib.error.HTTPError("https://x", code, "err", {}, io.BytesIO(json.dumps(body or {}).encode()))


class ErroriParlanti(unittest.TestCase):
    def setUp(self):
        bot.TG_STATE.update(fail_since=None, permanent=False, reason=None)

    def test_descrizioni_errori_senza_segreti(self):
        self.assertIn("nessuna risposta in 10 s", bot.describe_error(socket.timeout("x"), 10))
        self.assertIn("nessuna risposta in 10 s", bot.describe_error(urllib.error.URLError(socket.timeout()), 10))
        self.assertIn("DNS", bot.describe_error(urllib.error.URLError(socket.gaierror(-2, "boh"))))
        self.assertIn("rifiutata", bot.describe_error(ConnectionRefusedError()))
        self.assertNotIn("SECRET", bot.describe_error(OSError("https://api/bot" + CFG["TELEGRAM_BOT_TOKEN"])))

    def test_telegram_ritenta_su_errore_passeggero(self):
        n = []
        def op(req, timeout):
            n.append(1)
            if len(n) < 3:
                raise urllib.error.URLError(socket.timeout())
            return Resp()
        self.assertTrue(bot.tg_send(CFG, "ciao", opener=op, sleep=lambda s: None))
        self.assertEqual(len(n), 3)
        self.assertIsNone(bot.TG_STATE["fail_since"])

    def test_telegram_token_errato_non_ritenta_e_lo_dice(self):
        n = []
        def op(req, timeout):
            n.append(1)
            raise http_err(401)
        with self.assertLogs("informatix-bot", "ERROR") as lg:
            self.assertFalse(bot.tg_send(CFG, "ciao", opener=op, sleep=lambda s: None))
        self.assertEqual(len(n), 1)
        self.assertTrue(bot.TG_STATE["permanent"])
        self.assertIn("TELEGRAM_BOT_TOKEN errato", lg.output[0])
        self.assertNotIn("SECRET", lg.output[0])

    def test_telegram_html_rifiutato_rimanda_testo_semplice(self):
        seen = []
        def op(req, timeout):
            seen.append(json.loads(req.data))
            if len(seen) == 1:
                raise http_err(400, {"description": "Bad Request: can't parse entities"})
            return Resp()
        self.assertTrue(bot.tg_send(CFG, "<b>ciao</b> &amp; via", opener=op, sleep=lambda s: None))
        self.assertNotIn("parse_mode", seen[1])
        self.assertEqual(seen[1]["text"], "ciao & via")

    def test_taglio_non_spezza_i_tag(self):
        c = bot._cut("<b>riga</b>\n" * 600)
        self.assertLessEqual(len(c), 3910)
        self.assertEqual(c.count("<b>"), c.count("</b>"))

    def test_coda_messaggi_rimanda_in_ordine_con_nota(self):
        ok = [False]
        got = []
        def sender(cfg, text, **k):
            if ok[0]:
                got.append(text)
            return ok[0]
        o = bot.Outbox(sender)
        self.assertFalse(o.send(CFG, "uno"))
        self.assertFalse(o.send(CFG, "due"))
        self.assertEqual(len(o.pending), 2)
        ok[0] = True
        o.flush(CFG)
        self.assertEqual(len(got), 2)
        self.assertIn("ritardato", got[0])
        self.assertTrue(got[0].endswith("uno") and got[1].endswith("due"))
        self.assertEqual(o.pending, [])

    def test_coda_non_trattiene_errori_permanenti(self):
        def sender(cfg, text, **k):
            bot.TG_STATE["permanent"] = True
            return False
        o = bot.Outbox(sender)
        o.send(CFG, "x")
        self.assertEqual(o.pending, [])

    def test_giu_dice_il_motivo_e_da_quando(self):
        m = bot.Monitor(["Sito"])
        m.update("Sito", False, 1_000_000, reason="nessuna risposta in 20 s")
        t = m.update("Sito", False, 1_000_300, reason="nessuna risposta in 20 s")
        self.assertIn("nessuna risposta in 20 s", t)
        self.assertIn("da circa le", t)
        self.assertIn("torna online", t)
        self.assertIn("Ripristinato dopo 15 min", m.update("Sito", True, 1_000_900))

    def test_telefono_senza_internet_niente_falsi_allarmi(self):
        sent = []
        send = lambda c, t: sent.append(t)
        m = bot.Monitor([n for n, _ in bot.SERVICES])
        down = lambda u: (None, 1.0)
        for i in range(4):
            bot.run_checks(m, CFG, i * 300, check=down, send=send, probe=lambda: False)
        self.assertEqual(sent, [])
        self.assertTrue(all(st["up"] for st in m.state.values()))
        bot.run_checks(m, CFG, 1500, check=lambda u: (200, 0.2), send=send, probe=lambda: True)
        self.assertEqual(len(sent), 1)
        self.assertIn("Connessione del telefono ripristinata", sent[0])

    def test_dati_errore_passeggero_un_solo_avviso_poi_ripristinato(self):
        a = bot.Alerts()
        now = datetime(2026, 10, 16, 8, 40, tzinfo=ROME)
        err = bot.MonitorError("gestionale non raggiungibile (nessuna risposta in 20 s)")
        self.assertEqual(bot.data_checks(a, None, err, 13, now, now_ts=1_000_000), [])
        out = bot.data_checks(a, None, err, 13, now, now_ts=1_000_300)
        self.assertEqual(len(out), 1)
        self.assertIn("nessuna risposta in 20 s", out[0])
        self.assertIn("probabilmente è passeggero", out[0])
        self.assertNotIn("{", out[0])
        for k in range(5):  # nessuno spam
            self.assertEqual(bot.data_checks(a, None, err, 13, now, now_ts=1_000_600 + k * 300), [])
        back = bot.data_checks(a, DATA, None, 13, now, now_ts=1_002_100)
        self.assertIn("ripristinato dopo 35 min", back[0])

    def test_dati_errore_permanente_avviso_subito(self):
        a = bot.Alerts()
        now = datetime(2026, 10, 16, 8, 40, tzinfo=ROME)
        with mock.patch.object(bot, "fetch", return_value=(401, "")):
            data, err = bot.fetch_monitor(CFG)
        self.assertTrue(err.permanent)
        out = bot.data_checks(a, data, err, 13, now, now_ts=1)
        self.assertEqual(len(out), 1)
        self.assertIn("serve un intervento", out[0])
        self.assertIn("MONITOR_TOKEN", out[0])
        self.assertNotIn(CFG["MONITOR_TOKEN"], out[0])

    def test_risposta_monitor_non_dizionario_non_manda_in_crash(self):
        for body in ("[]", "null", "<html>", '{"ok": false}'):
            with mock.patch.object(bot, "fetch", return_value=(200, body)):
                data, err = bot.fetch_monitor(CFG)
            self.assertIsNone(data)
            self.assertIn("risposta non valida", err)
            self.assertFalse(err.permanent)

    def test_errori_http_monitor(self):
        for code, perm in ((500, False), (502, False), (429, False), (404, True), (403, True)):
            with mock.patch.object(bot, "fetch", return_value=(code, "")):
                data, err = bot.fetch_monitor(CFG)
            self.assertEqual(bool(err.permanent), perm, code)
            self.assertIn(str(code), err)

    def test_eccezione_nel_giro_avviso_dal_secondo_e_ripristino(self):
        a = bot.Alerts()
        sent = []
        send = lambda c, t: sent.append(t)
        bot.tick_failed(a, CFG, ValueError("x"), 1_000_000, send)
        self.assertEqual(sent, [])
        bot.tick_failed(a, CFG, ValueError("x"), 1_000_300, send)
        self.assertEqual(len(sent), 1)
        self.assertIn("problema interno", sent[0])
        self.assertNotIn("{", sent[0])
        bot.tick_failed(a, CFG, ValueError("x"), 1_000_600, send)
        self.assertEqual(len(sent), 1)
        bot.tick_ok(a, CFG, 1_001_000, send)
        self.assertIn("tornato a funzionare", sent[1])

    def test_buongiorno_che_non_si_costruisce_lo_dice(self):
        sent = []
        def boom():
            raise KeyError("x")
        bot._safe_text("il buongiorno", boom, lambda c, t: sent.append(t), CFG)
        self.assertIn("Non sono riuscito a preparare il buongiorno", sent[0])

    def test_traceback_nel_log_senza_segreti(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "logs", "bot.log")
            bot.setup_logging([CFG["TELEGRAM_BOT_TOKEN"], CFG["MONITOR_TOKEN"]], p)
            try:
                raise ValueError("chiave " + CFG["MONITOR_TOKEN"])
            except ValueError as e:
                bot.tick_failed(bot.Alerts(), CFG, e, 1, lambda c, t: None)
            for h in bot.log.handlers:
                h.flush()
            with open(p, encoding="utf-8") as f:
                txt = f.read()
            self.assertIn("Errore interno nel giro", txt)
            self.assertIn("Traceback", txt)
            self.assertNotIn("segretissima", txt)
            for h in bot.log.handlers[:]:
                h.close()
                bot.log.removeHandler(h)

    def test_heartbeat_non_scrivibile_non_ferma_il_bot(self):
        bot._hb_failed[0] = False
        bot.write_heartbeat(os.path.join(tempfile.gettempdir(), "nonexistent-dir-xyz", "hb"))
        self.assertTrue(bot._hb_failed[0])
        bot._hb_failed[0] = False

    def test_tick_aggiorna_heartbeat_tra_i_passi(self):
        beats = []
        m, a = bot.Monitor([n for n, _ in bot.SERVICES]), bot.Alerts()
        bot.tick(m, a, bot.Schedule(datetime(2026, 10, 15, 12, 0, tzinfo=ROME)), CFG, 0, utc_now=datetime(2026, 10, 15, 10, 0, tzinfo=timezone.utc),
                 check=lambda u: (200, 0.2), get_monitor=lambda c: (DATA, None), get_site=lambda: 13, get_blog=lambda d: 1,
                 send=lambda c, t: None, beat=lambda: beats.append(1))
        self.assertGreaterEqual(len(beats), 3)


if __name__ == "__main__":
    unittest.main()
