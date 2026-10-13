#!/usr/bin/env python3
"""Bot di controllo Informatix (Termux). Solo INVIO verso il proprietario su Telegram:
non riceve e non esegue nessun comando. Controlla i servizi, avvisa al cambio di stato
e manda un riepilogo ogni giorno alle 21:00 (Europe/Rome). Solo libreria standard."""
import json
import logging
import os
import signal
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler

HERE = os.path.dirname(os.path.abspath(__file__))
PID_FILE = os.path.join(HERE, "bot.pid")
HEARTBEAT_FILE = os.path.join(HERE, "heartbeat")
LOG_FILE = os.path.join(HERE, "logs", "bot.log")

CHECK_EVERY = 300          # secondi tra un controllo e l'altro
HEARTBEAT_EVERY = 60
FAILS_BEFORE_ALERT = 2     # anti-rimbalzo
SUMMARY_HOUR = 21
USATI_URL = "https://informatixrepair.com/usati.json"

# nome, url, descrizione di cosa e' "vivo"
SERVICES = [
    ("Gestionale", "https://gestionale.informatixrepair.com/"),   # dietro Cloudflare Access: 302/200/401/403 = vivo
    ("Tracciamento clienti", "https://riparazioni.informatixrepair.com/"),  # 404 dal Worker = vivo
    ("Sito", "https://informatixrepair.com/"),
    ("Vetrina Usati", USATI_URL),
]
log = logging.getLogger("informatix-bot")


# ---------------------------------------------------------------- tempo (Europe/Rome)
def _last_sunday(year, month):
    d = datetime(year, month, 31 if month in (3, 10) else 30)
    while d.weekday() != 6:
        d -= timedelta(days=1)
    return d


def rome_now(utc_now=None):
    """Ora di Roma. Usa zoneinfo se c'e', altrimenti calcola l'ora legale UE."""
    utc_now = utc_now or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return utc_now.astimezone(ZoneInfo("Europe/Rome"))
    except Exception:
        y = utc_now.year
        start = _last_sunday(y, 3).replace(hour=1, tzinfo=timezone.utc)
        end = _last_sunday(y, 10).replace(hour=1, tzinfo=timezone.utc)
        off = 2 if start <= utc_now < end else 1
        return utc_now.astimezone(timezone(timedelta(hours=off)))


# ---------------------------------------------------------------- configurazione
def load_env(path=None):
    """Legge .env (CHIAVE=valore); le variabili d'ambiente hanno la precedenza."""
    cfg = {}
    path = path or os.path.join(HERE, ".env")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_OWNER_ID"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


class Redactor(logging.Filter):
    """Toglie dai log token e ID, qualunque cosa succeda."""
    secrets = []

    def filter(self, record):
        msg = record.getMessage()
        for s in self.secrets:
            if s:
                msg = msg.replace(s, "[segreto]")
        record.msg, record.args = msg, ()
        return True


def setup_logging(secrets=(), path=LOG_FILE):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Redactor.secrets = list(secrets)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S")
    fmt.converter = lambda ts: rome_now(datetime.fromtimestamp(ts, timezone.utc)).timetuple()
    h = RotatingFileHandler(path, maxBytes=1_000_000, backupCount=2, encoding="utf-8")
    h.setFormatter(fmt)
    h.addFilter(Redactor())
    log.handlers[:] = [h]
    log.setLevel(logging.INFO)
    if sys.stdout and sys.stdout.isatty():
        s = logging.StreamHandler()
        s.setFormatter(fmt)
        s.addFilter(Redactor())
        log.addHandler(s)


# ---------------------------------------------------------------- rete
def tg_send(cfg, text, chat_id=None, opener=None):
    """Invia SOLO al proprietario. Qualunque altro chat_id viene rifiutato."""
    token, owner = cfg.get("TELEGRAM_BOT_TOKEN"), str(cfg.get("TELEGRAM_OWNER_ID") or "")
    if not token or not owner:
        log.error("Telegram non configurato")
        return False
    if chat_id is not None and str(chat_id) != owner:
        log.warning("Rifiutato: destinatario diverso dal proprietario")
        return False
    data = json.dumps({"chat_id": owner, "text": text[:3900], "parse_mode": "HTML",
                       "disable_web_page_preview": True}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data,
                                 headers={"content-type": "application/json"})
    try:
        with (opener or urllib.request.urlopen)(req, timeout=20) as r:
            ok = 200 <= r.status < 300
    except Exception as e:  # il messaggio d'errore puo' contenere l'URL col token: lo togliamo dal log
        log.error("Invio Telegram fallito: %s", type(e).__name__)
        return False
    if not ok:
        log.error("Invio Telegram fallito")
    return ok


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def http_status(url, timeout=15):
    """Codice HTTP senza seguire i redirect; None se timeout/errore di rete."""
    op = urllib.request.build_opener(_NoRedirect)
    try:
        with op.open(urllib.request.Request(url, headers={"User-Agent": "informatix-bot/1"}), timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def is_up(code):
    """Giu' solo per errore di rete/timeout o 5xx. 302/401/403/404 = servizio vivo."""
    return code is not None and code < 500


def fetch_usati(timeout=15):
    try:
        with urllib.request.urlopen(urllib.request.Request(USATI_URL, headers={"User-Agent": "informatix-bot/1"}), timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def usati_counts(data):
    """(totale, online, venduti). Se il JSON non distingue, online/venduti = None."""
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return None, None, None
    total = len(items)
    flagged = [i for i in items if isinstance(i, dict) and any(k in i for k in ("sold", "venduto", "status"))]
    if not flagged:
        return total, None, None
    sold = sum(1 for i in items if isinstance(i, dict) and (i.get("sold") is True or i.get("venduto") is True or str(i.get("status", "")).lower() in ("sold", "venduto")))
    return total, total - sold, sold


# ---------------------------------------------------------------- logica
def fmt_duration(sec):
    sec = int(sec)
    h, r = divmod(sec, 3600)
    m, s = divmod(r, 60)
    if h:
        return f"{h} h {m} min"
    return f"{m} min" if m else f"{s} s"


class Monitor:
    """Anti-rimbalzo e avvisi solo al cambio di stato."""

    def __init__(self, names):
        self.state = {n: {"up": True, "fails": 0, "down_since": None} for n in names}

    def update(self, name, ok, now):
        """Restituisce il testo da inviare (o None)."""
        st = self.state[name]
        if ok:
            st["fails"] = 0
            if not st["up"]:
                dur = fmt_duration(now - st["down_since"])
                st["up"], st["down_since"] = True, None
                return f"✅ <b>{name}</b> è tornato online.\nEra giù da {dur}."
            return None
        st["fails"] += 1
        if st["up"] and st["fails"] >= FAILS_BEFORE_ALERT:
            st["up"] = False
            st["down_since"] = now - CHECK_EVERY * (FAILS_BEFORE_ALERT - 1)
            return f"🔴 <b>{name}</b> non risponde.\nControllo fallito {st['fails']} volte di fila."
        return None


def build_summary(monitor, usati, when):
    lines = [f"📋 <b>Riepilogo Informatix</b> · {when.strftime('%d/%m/%Y %H:%M')}"]
    for name, st in monitor.state.items():
        lines.append(f"{'🟢' if st['up'] else '🔴'} {name}")
    total, online, sold = usati_counts(usati) if usati is not None else (None, None, None)
    if total is None:
        lines.append("🛍️ Vetrina Usati: dati non disponibili")
    elif online is None:
        lines.append(f"🛍️ Vetrina Usati: {total} articoli")
    else:
        lines.append(f"🛍️ Vetrina Usati: {online} online, {sold} venduti")
    return "\n".join(lines)


def run_checks(monitor, cfg, now, check=http_status, send=tg_send):
    for name, url in SERVICES:
        code = check(url)
        log.info("%s -> %s", name, code if code is not None else "errore di rete")
        msg = monitor.update(name, is_up(code), now)
        if msg:
            send(cfg, msg)


def maybe_summary(monitor, cfg, last_day, utc_now=None, fetch=fetch_usati, send=tg_send):
    """Invia il riepilogo se sono le 21 (o dopo) di Roma e oggi non e' ancora partito. Restituisce il giorno."""
    now = rome_now(utc_now)
    if now.hour >= SUMMARY_HOUR and last_day != now.date():
        send(cfg, build_summary(monitor, fetch(), now))
        return now.date()
    return last_day


# ---------------------------------------------------------------- processo
def already_running(path=None):
    path = path or PID_FILE
    """PID di un'altra istanza davvero viva, altrimenti None (un bot.pid vecchio non conta)."""
    try:
        pid = int(open(path).read().strip())
    except (OSError, ValueError):
        return None
    if pid == os.getpid():
        return None
    return pid if _pid_alive(pid) else None


def _pid_alive(pid):
    if os.name == "nt":  # solo per i test su PC: os.kill(pid, 0) su Windows terminerebbe il processo
        import ctypes
        h = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not h:
            return False
        code = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(h, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(h)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except OSError:
        pass  # esiste ma non e' nostro
    return True


def write_pid(path=None):
    path = path or PID_FILE
    with open(path, "w") as f:
        f.write(str(os.getpid()))


def remove_pid(path=None):
    path = path or PID_FILE
    try:
        if open(path).read().strip() == str(os.getpid()):
            os.remove(path)
    except OSError:
        pass


def write_heartbeat(path=None):
    path = path or HEARTBEAT_FILE
    with open(path, "w") as f:
        f.write(rome_now().strftime("%Y-%m-%d %H:%M:%S"))


class Stop(Exception):
    pass


def _on_signal(signum, frame):
    raise Stop()


def main(argv=None):
    argv = argv or sys.argv[1:]
    cfg = load_env()
    if not cfg.get("TELEGRAM_BOT_TOKEN") or not cfg.get("TELEGRAM_OWNER_ID"):
        print("Manca TELEGRAM_BOT_TOKEN o TELEGRAM_OWNER_ID nel file .env", file=sys.stderr)
        return 2
    other = already_running()
    if other:
        print(f"Il bot è già in esecuzione (pid {other}): esco senza fare nulla.", file=sys.stderr)
        return 3
    setup_logging([cfg["TELEGRAM_BOT_TOKEN"], cfg["TELEGRAM_OWNER_ID"]])
    write_pid()
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)
    log.info("Bot avviato")
    monitor = Monitor([n for n, _ in SERVICES])
    last_day = rome_now().date() if rome_now().hour >= SUMMARY_HOUR else None  # niente riepilogo doppio se riavviato dopo le 21
    if "--test" in argv:
        run_checks(monitor, cfg, time.time())
        ok = tg_send(cfg, "🧪 TEST bot Termux attivo")
        print("Messaggio di prova:", "ok" if ok else "NON inviato")
        remove_pid()
        return 0 if ok else 1
    next_check = 0.0
    try:
        while True:
            now = time.time()
            write_heartbeat()
            if now >= next_check:
                run_checks(monitor, cfg, now)
                next_check = now + CHECK_EVERY
            last_day = maybe_summary(monitor, cfg, last_day)
            time.sleep(HEARTBEAT_EVERY)
    except Stop:
        log.info("Arresto richiesto, chiudo")
    finally:
        remove_pid()
    return 0


if __name__ == "__main__":
    sys.exit(main())
