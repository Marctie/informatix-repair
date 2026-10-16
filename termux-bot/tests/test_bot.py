"""Test del bot Termux con rete simulata.  Esecuzione: python -m unittest discover -s termux-bot/tests"""
import io
import os
import subprocess
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone, timedelta
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import main as bot  # noqa: E402

CFG = {"TELEGRAM_BOT_TOKEN": "123456:SECRETTOKEN_abcdefghijklmnopqrstuvwxyz", "TELEGRAM_OWNER_ID": "999", "MONITOR_TOKEN": "CHIAVE-MONITOR-segretissima-0123456789"}
ROME = timezone(timedelta(hours=2))

# Dati come li restituisce /api/monitor
DATA = {
    "ok": True, "today": "2026-10-15",
    "repairs": {"open": 5, "by_status": {"received": 2, "ready": 2, "quote_pending": 1}, "urgent": 1, "intake_today": 3,
                "delivered_today": {"n": 2, "total": 245.0},
                "ready": [{"code": "R-2026-0007", "model": "iPhone 13", "customer": "Anna", "days": 9}, {"code": "R-2026-0009", "model": "Galaxy S22", "customer": "Luca", "days": 1}],
                "ready_days": 7, "late": [{"code": "R-2026-0003", "model": "MacBook", "customer": "Paolo", "eta": "2026-10-12"}],
                "to_approve": [{"code": "R-2026-0005"}], "declined": [], "waiting_parts": 0, "storage_due": []},
    "cash": {"today": {"total": 300.5, "n": 4, "by_method": [{"method": "contanti", "total": 120.5}, {"method": "carta", "total": 180}],
                       "by_kind": [{"kind": "repair", "total": 245}, {"kind": "sale", "total": 55.5}], "vouchers": {"discount": 0, "credit": 0}},
             "month": {"total": 2345.0, "from": "2026-10-01"}, "expenses_today": {"n": 1, "total": 12.5}, "expenses_month": {"n": 3, "total": 80}},
    "sales": {"today": {"n": 13, "total": 55.5, "items": [{"name": "Cavo USB-C", "qty": 2, "revenue": 18}]}, "month": {"n": 40, "total": 900}},
    "orders": {"to_order": 1, "ordered": 2, "arrived": 1, "arrived_list": [{"code": "O-2026-0004", "customer": "Mario"}], "late": []},
    "quotes": {"open": 2, "expiring": [{"code": "P-2026-0002", "valid_until": "2026-10-17"}], "expired": 0},
    "reminders": {"today": [{"time": "09:30", "title": "Richiama Marta", "overdue": False}], "overdue_before_today": 0},
    "stock": {"items": 40, "units": 300, "out": 1, "low": 2, "low_items": [{"name": "Display X", "qty": 1, "min": 2}]},
    "usati": {"total": 13, "in_vetrina": 13, "sold": 0, "dirty": False, "published_at": "2026-10-14 14:41:28", "error": None},
    "users": [{"email": "djchri.cp@gmail.com", "name": "Christian Pecoraro", "role": "admin", "last_seen_at": "2026-10-15 18:40:00"}],
    "activity": {"n": 15, "last_at": "2026-10-15 19:00:00"},
    "backup": {"last": "officina-2026-10-15_04-31-04.json", "at": "2026-10-15 04:31:04", "copies": 3},
}


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

    def test_fallimento_isolato_non_avvisa(self):
        m = bot.Monitor(["Sito"])
        self.assertIsNone(m.update("Sito", False, 0))
        self.assertIsNone(m.update("Sito", True, 300))
        self.assertIsNone(m.update("Sito", False, 600))
        self.assertTrue(m.state["Sito"]["up"])

    def test_ritorno_su_con_durata_e_minuti_di_fermo_del_giorno(self):
        m = bot.Monitor(["Sito"])
        m.update("Sito", False, 0)
        m.update("Sito", False, 300)
        msg = m.update("Sito", True, 300 + 3600)
        self.assertIn("tornato online", msg)
        self.assertIn("1 h", msg)
        self.assertEqual(int(m.downtime("Sito", 99999)), 3900)
        m.new_day(100000)
        self.assertEqual(m.downtime("Sito", 100000), 0)

    def test_lento_dopo_tre_controlli_poi_di_nuovo_veloce(self):
        m = bot.Monitor(["Sito"])
        self.assertIsNone(m.update("Sito", True, 0, 12))
        self.assertIsNone(m.update("Sito", True, 300, 12))
        self.assertIn("lento", m.update("Sito", True, 600, 12))
        self.assertIsNone(m.update("Sito", True, 900, 15))      # niente ripetizioni
        self.assertIn("di nuovo veloce", m.update("Sito", True, 1200, 0.4))

    def test_codici_http(self):
        for c in (200, 302, 401, 403, 404):
            self.assertTrue(bot.is_up(c), c)
        for c in (None, 500, 502, 503):
            self.assertFalse(bot.is_up(c), c)

    def test_run_checks_invia_al_cambio(self):
        sent = []
        m = bot.Monitor([n for n, _ in bot.SERVICES])
        down = lambda url: (None, 20.0)
        send = lambda cfg, t: sent.append(t)
        bot.run_checks(m, CFG, 0, check=down, send=send, probe=lambda: True)
        self.assertEqual(sent, [])
        bot.run_checks(m, CFG, 300, check=down, send=send, probe=lambda: True)
        self.assertEqual(len(sent), len(bot.SERVICES))
        bot.run_checks(m, CFG, 600, check=lambda u: (200, 0.3), send=send)
        self.assertEqual(len(sent), 2 * len(bot.SERVICES))


class VetrinaUsati(unittest.TestCase):
    def test_conta_il_totale_vero_non_i_tre_in_evidenza(self):
        # il file della home: count = 13, items = solo 3 in evidenza (il vecchio bot diceva 3)
        home = {"count": 13, "items": [{"slug": "a"}, {"slug": "b"}, {"slug": "c"}]}
        self.assertEqual(bot.site_usati_count(home), 13)
        self.assertEqual(bot.site_usati_count({"items": [1, 2]}), 2)
        self.assertIsNone(bot.site_usati_count("rotto"))

    def test_avviso_disallineamento_dopo_15_minuti_e_rientro(self):
        a = bot.Alerts()
        now = datetime(2026, 10, 15, 10, 0, tzinfo=ROME)
        self.assertEqual(bot.data_checks(a, DATA, None, 12, now), [])
        self.assertEqual(bot.data_checks(a, DATA, None, 12, now), [])
        out = bot.data_checks(a, DATA, None, 12, now)
        self.assertEqual(len(out), 1)
        self.assertIn("Sul sito risultano 12 articoli, nel gestionale 13", out[0])
        self.assertEqual(bot.data_checks(a, DATA, None, 12, now), [])  # niente ripetizioni
        self.assertIn("di nuovo allineata", bot.data_checks(a, DATA, None, 13, now)[0])

    def test_modifiche_in_sospeso_non_sono_un_errore(self):
        a = bot.Alerts()
        d = {**DATA, "usati": {**DATA["usati"], "dirty": True}}
        now = datetime(2026, 10, 15, 10, 0, tzinfo=ROME)
        for _ in range(5):
            self.assertEqual(bot.data_checks(a, d, None, 12, now), [])


class ControlliDati(unittest.TestCase):
    def test_backup_mancante_solo_dopo_le_6_e_una_volta(self):
        a = bot.Alerts()
        old = {**DATA, "backup": {"at": "2026-10-14 04:31:04", "copies": 3}}
        self.assertEqual(bot.data_checks(a, old, None, 13, datetime(2026, 10, 15, 5, 0, tzinfo=ROME)), [])
        out = bot.data_checks(a, old, None, 13, datetime(2026, 10, 15, 6, 5, tzinfo=ROME))
        self.assertIn("Backup notturno mancante", out[0])
        self.assertEqual(bot.data_checks(a, old, None, 13, datetime(2026, 10, 15, 7, 0, tzinfo=ROME)), [])
        self.assertEqual(bot.data_checks(bot.Alerts(), DATA, None, 13, datetime(2026, 10, 15, 7, 0, tzinfo=ROME)), [])

    def test_dati_non_leggibili_dopo_due_tentativi(self):
        a = bot.Alerts()
        now = datetime(2026, 10, 15, 10, 0, tzinfo=ROME)
        self.assertEqual(bot.data_checks(a, None, "chiave non accettata (404)", 13, now), [])
        out = bot.data_checks(a, None, "chiave non accettata (404)", 13, now)
        self.assertIn("non leggibili", out[0])
        self.assertIn("chiave non accettata", out[0])
        self.assertIn("di nuovo leggibili", bot.data_checks(a, DATA, None, 13, now)[0])

    def test_chiave_mancante(self):
        self.assertEqual(bot.fetch_monitor({"TELEGRAM_BOT_TOKEN": "x"}), (None, "manca MONITOR_TOKEN nel file .env"))

    def test_blog_conta_gli_articoli_di_oggi(self):
        sm = ("<url><loc>https://x/blog/pagina-2.html</loc></url>"
              "<url><loc>https://x/blog/a.html</loc><lastmod>2026-10-15</lastmod></url>"
              "<url><loc>https://x/blog/b.html</loc><lastmod>2026-10-15</lastmod></url>"
              "<url><loc>https://x/blog/c.html</loc><lastmod>2026-10-14</lastmod></url>")
        self.assertEqual(bot.blog_today(sm, "2026-10-15"), 2)
        self.assertEqual(bot.blog_today(sm, "2026-10-16"), 0)


class Messaggi(unittest.TestCase):
    def test_riepilogo_serale_con_i_numeri_veri(self):
        m = bot.Monitor(["Sito", "Gestionale"])
        t = bot.build_summary(m, DATA, datetime(2026, 10, 15, 21, 0, tzinfo=ROME), 13, 4, now=0)
        for s in ("Incassi oggi: 300,50 €", "(4 movimenti)", "carta 180,00 € · contanti 120,50 €", "riparazioni 245,00 €",
                  "Spese oggi: 12,50 € → netto 288,00 €", "Vendite oggi: 13</b> per 55,50 €", "Cavo USB-C ×2",
                  "3 entrate, 2 consegnate (245,00 €)", "aperte 5", "1 in ritardo", "1 urgenti", "R-2026-0007 (9 gg)",
                  "incassi 2.345,00 €", "13 in vetrina, 0 venduti · sito allineato ✅", "4 articoli pubblicati oggi",
                  "15 operazioni registrate", "Christian 18:40", "stanotte 04:31", "3 copie"):
            self.assertIn(s, t, s)
        self.assertNotIn("R-2026-0009 (1 gg)", t)  # pronta da poco: non e' un problema

    def test_riepilogo_vetrina_disallineata_e_dati_mancanti(self):
        m = bot.Monitor(["Sito"])
        m.state["Sito"]["up"] = False
        t = bot.build_summary(m, DATA, datetime(2026, 10, 15, 21, 0, tzinfo=ROME), 12, 0, now=0)
        self.assertIn("🔴 Giù adesso: Sito", t)
        self.assertIn("⚠️ sul sito 12", t)
        self.assertIn("0 articoli pubblicati oggi ⚠️", t)
        self.assertIn("Dati del gestionale non disponibili", bot.build_summary(m, None, datetime(2026, 10, 15, 21, 0, tzinfo=ROME), 13))

    def test_buongiorno_con_le_cose_da_fare(self):
        t = bot.build_morning(DATA, datetime(2026, 10, 15, 8, 30, tzinfo=ROME))
        for s in ("giovedì 15/10", "09:30 Richiama Marta", "Pronte da ritirare</b> (2)", "R-2026-0007 · iPhone 13 · Anna — da 9 gg",
                  "In ritardo</b> (1)", "prevista 12/10/2026", "1 preventivo attende", "O-2026-0004 Mario", "P-2026-0002 (17/10/2026)",
                  "1 esauriti, 2 sotto scorta", "Backup di stanotte: ok"):
            self.assertIn(s, t, s)
        empty = {**DATA, "repairs": {"ready": [], "late": []}, "orders": {}, "quotes": {}, "reminders": {}, "stock": {}}
        self.assertIn("Niente di urgente", bot.build_morning(empty, datetime(2026, 10, 15, 8, 30, tzinfo=ROME)))

    def test_testi_con_caratteri_html_protetti(self):
        d = {**DATA, "reminders": {"today": [{"time": "10:00", "title": "Cavo <HDMI> & co"}]}}
        self.assertIn("Cavo &lt;HDMI&gt; &amp; co", bot.build_morning(d, datetime(2026, 10, 15, 8, 30, tzinfo=ROME)))

    def test_euro_italiano(self):
        self.assertEqual(bot.eur(1234.5), "1.234,50 €")
        self.assertEqual(bot.eur(0), "0,00 €")


class Orari(unittest.TestCase):
    def test_buongiorno_e_riepilogo_una_volta_al_giorno(self):
        sent = []
        send = lambda cfg, t: sent.append(t)
        m, a = bot.Monitor([n for n, _ in bot.SERVICES]), bot.Alerts()
        sched = bot.Schedule(datetime(2026, 10, 15, 7, 0, tzinfo=ROME))
        go = lambda utc: bot.tick(m, a, sched, CFG, 0, utc_now=utc, check=lambda u: (200, 0.2), get_monitor=lambda c: (DATA, None),
                                  get_site=lambda: 13, get_blog=lambda d: 4, send=send)
        go(datetime(2026, 10, 15, 6, 29, tzinfo=timezone.utc))   # 8:29 Roma
        self.assertEqual(sent, [])
        go(datetime(2026, 10, 15, 6, 30, tzinfo=timezone.utc))   # 8:30
        self.assertEqual(len(sent), 1)
        self.assertIn("Buongiorno", sent[0])
        go(datetime(2026, 10, 15, 6, 35, tzinfo=timezone.utc))
        self.assertEqual(len(sent), 1)
        go(datetime(2026, 10, 15, 19, 0, tzinfo=timezone.utc))   # 21:00
        self.assertEqual(len(sent), 2)
        self.assertIn("Riepilogo Informatix", sent[1])
        go(datetime(2026, 10, 15, 19, 30, tzinfo=timezone.utc))
        self.assertEqual(len(sent), 2)

    def test_buongiorno_anche_la_domenica_e_ora_solare(self):
        sched = bot.Schedule(datetime(2026, 10, 18, 7, 0, tzinfo=ROME))
        self.assertTrue(sched.due_morning(bot.rome_now(datetime(2026, 10, 18, 6, 30, tzinfo=timezone.utc))))  # domenica 8:30
        # dopo il cambio d'ora (25/10) le 8:30 di Roma sono le 7:30 UTC
        s3 = bot.Schedule(datetime(2026, 11, 2, 7, 0, tzinfo=timezone(timedelta(hours=1))))
        self.assertFalse(s3.due_morning(bot.rome_now(datetime(2026, 11, 2, 7, 29, tzinfo=timezone.utc))))
        self.assertTrue(s3.due_morning(bot.rome_now(datetime(2026, 11, 2, 7, 30, tzinfo=timezone.utc))))
        # inverno: 20:00 UTC = 21:00 Roma
        s2 = bot.Schedule(bot.rome_now(datetime(2026, 12, 1, 12, 0, tzinfo=timezone.utc)))
        self.assertFalse(s2.due_summary(bot.rome_now(datetime(2026, 12, 1, 19, 59, tzinfo=timezone.utc))))
        self.assertTrue(s2.due_summary(bot.rome_now(datetime(2026, 12, 1, 20, 0, tzinfo=timezone.utc))))

    def test_riavvio_dopo_le_21_non_ripete_il_riepilogo(self):
        sched = bot.Schedule(datetime(2026, 10, 15, 21, 30, tzinfo=ROME))
        self.assertFalse(sched.due_summary(datetime(2026, 10, 15, 21, 35, tzinfo=ROME)))
        self.assertFalse(sched.due_morning(datetime(2026, 10, 15, 21, 35, tzinfo=ROME)))


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

    def test_chiave_monitor_solo_nell_intestazione(self):
        seen = []
        def fake(req, timeout):
            seen.append(req)
            raise OSError("rete giu")
        with mock.patch("urllib.request.urlopen", side_effect=fake):
            data, err = bot.fetch_monitor(CFG)
        self.assertIsNone(data)
        self.assertIn("non raggiungibile", err)
        self.assertNotIn(CFG["MONITOR_TOKEN"], seen[0].full_url)
        self.assertEqual(seen[0].get_header("Authorization"), f"Bearer {CFG['MONITOR_TOKEN']}")

    def test_nessun_segreto_nei_log(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "logs", "bot.log")
            bot.setup_logging([CFG["TELEGRAM_BOT_TOKEN"], CFG["TELEGRAM_OWNER_ID"], CFG["MONITOR_TOKEN"]], p)
            bot.log.info("token %s id %s chiave %s", CFG["TELEGRAM_BOT_TOKEN"], CFG["TELEGRAM_OWNER_ID"], CFG["MONITOR_TOKEN"])
            def boom(req, timeout): raise OSError("https://api.telegram.org/bot" + CFG["TELEGRAM_BOT_TOKEN"])
            bot.tg_send(CFG, "x", opener=boom, sleep=lambda s: None)
            for h in bot.log.handlers: h.flush()
            txt = open(p, encoding="utf-8").read()
            self.assertNotIn("SECRETTOKEN", txt)
            self.assertNotIn("999", txt)
            self.assertNotIn("segretissima", txt)
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
                    mock.patch.object(bot, "tick"), mock.patch("signal.signal"), mock.patch("time.sleep", side_effect=bot.Stop):
                self.assertEqual(bot.main([]), 0)
            self.assertFalse(os.path.exists(p))
            self.assertTrue(os.path.exists(os.path.join(d, "heartbeat")))

    def test_un_errore_nel_giro_non_ferma_il_bot(self):
        calls = []
        def boom(*a, **k):
            calls.append(1)
            raise ValueError("dati strani")
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.object(bot, "PID_FILE", os.path.join(d, "bot.pid")), mock.patch.object(bot, "HEARTBEAT_FILE", os.path.join(d, "hb")), \
                    mock.patch.object(bot, "load_env", return_value=CFG), mock.patch.object(bot, "setup_logging"), \
                    mock.patch.object(bot, "tick", side_effect=boom), mock.patch("signal.signal"), mock.patch.object(bot, "tg_send", return_value=True), \
                    mock.patch("time.sleep", side_effect=[None, bot.Stop]), mock.patch.object(bot, "CHECK_EVERY", 0):
                self.assertEqual(bot.main([]), 0)
        self.assertEqual(len(calls), 2)

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
