#!/usr/bin/env python3
"""Bot di controllo Informatix (Termux). Solo INVIO verso il proprietario su Telegram:
non riceve e non esegue nessun comando. Solo libreria standard di Python 3.

Ogni 5 minuti:
  - controlla gestionale, tracciamento clienti, sito e Vetrina Usati (giu' / lento / tornato su);
  - legge i numeri veri dal gestionale (/api/monitor, con la chiave MONITOR_TOKEN) e controlla che
    la Vetrina Usati sul sito sia allineata, che il backup notturno ci sia e che i dati siano leggibili.
    La lettura fa partire anche i promemoria scaduti del gestionale (arrivano anche a gestionale chiuso).
Ogni mattina (tutti i giorni, 8:30) manda il "Buongiorno" con le cose da fare; ogni sera alle 21:00 il riepilogo
dettagliato della giornata (incassi per metodo, vendite, riparazioni, mese, vetrina, blog, backup)."""
import json
import logging
import os
import re
import signal
import socket
import ssl
import sys
import time
import traceback
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler

HERE = os.path.dirname(os.path.abspath(__file__))
PID_FILE = os.path.join(HERE, "bot.pid")
HEARTBEAT_FILE = os.path.join(HERE, "heartbeat")
LOG_FILE = os.path.join(HERE, "logs", "bot.log")

CHECK_EVERY = 300          # secondi tra un giro di controlli e l'altro
HEARTBEAT_EVERY = 60
FAILS_BEFORE_ALERT = 2     # anti-rimbalzo: 2 controlli falliti di fila (10 minuti)
SLOW_SECONDS = 8           # risposta piu' lenta di cosi' = "lento"
SLOW_BEFORE_ALERT = 3      # 3 controlli lenti di fila (15 minuti)
SUMMARY_HOUR = 21          # riepilogo serale
MORNING = (8, 30)          # buongiorno
MORNING_DAYS = (0, 1, 2, 3, 4, 5, 6)  # tutti i giorni (scelta di Marco, 15/10); 0 = lunedi'
BACKUP_DEADLINE = 6        # dopo le 6:00 il backup della notte deve esserci
RETRY_DELAYS = (2, 6)      # Telegram: pause (secondi) tra un tentativo e l'altro in caso di errore passeggero
OUTBOX_MAX = 15            # messaggi tenuti in coda se Telegram non e' raggiungibile
VETRINA_CHECKS = 3         # vetrina disallineata per 3 controlli di fila (15 min) prima di avvisare

SITE = "https://informatixrepair.com"
USATI_URL = SITE + "/usati.json"      # riassunto della home: "count" = articoli in vetrina, "items" = solo i 3 in evidenza
SITEMAP_URL = SITE + "/sitemap.xml"   # per contare gli articoli del blog di oggi
MONITOR_URL = "https://riparazioni.informatixrepair.com/api/monitor"

# nome, url (cosa vuol dire "vivo": vedi is_up)
SERVICES = [
    ("Gestionale", "https://gestionale.informatixrepair.com/"),   # dietro Cloudflare Access: 302/200/401/403 = vivo
    ("Tracciamento clienti", "https://riparazioni.informatixrepair.com/"),  # 404 dal Worker = vivo
    ("Sito", SITE + "/"),
    ("Vetrina Usati", USATI_URL),
]
STATUS = {"received": "ricevute", "diagnosing": "in diagnosi", "quote_pending": "preventivo da approvare", "approved": "approvate",
          "waiting_parts": "attesa ricambi", "repairing": "in riparazione", "ready": "pronte"}
KIND = {"repair": "riparazioni", "sale": "vendite", "order": "ordini"}
DAYS_IT = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
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
    for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_OWNER_ID", "MONITOR_TOKEN", "MONITOR_URL"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def redact(msg):
    """Toglie da un testo token, chiavi e ID noti."""
    msg = str(msg)
    for s in Redactor.secrets:
        if s:
            msg = msg.replace(s, "[segreto]")
    return msg


class Redactor(logging.Filter):
    """Toglie dai log token, chiavi e ID, qualunque cosa succeda."""
    secrets = []

    def filter(self, record):
        record.msg, record.args = redact(record.getMessage()), ()
        if record.exc_info:  # il traceback potrebbe contenere l'URL con il token: lo ripuliamo
            record.exc_text = redact("".join(traceback.format_exception(*record.exc_info)).rstrip())
            record.exc_info = None
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


# ---------------------------------------------------------------- formati
def esc(s):
    return str("" if s is None else s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def eur(n):
    """1234.5 -> 1.234,50 €"""
    try:
        v = float(n or 0)
    except (TypeError, ValueError):
        return "—"
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €"


def dmy(s):
    """2026-10-15 -> 15/10/2026 ; 2026-10-15 04:31:04 -> 15/10 04:31"""
    m = re.match(r"(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d:\d\d))?", str(s or ""))
    if not m:
        return str(s or "")
    return f"{m[3]}/{m[2]} {m[4]}" if m[4] else f"{m[3]}/{m[2]}/{m[1]}"


def plural(n, one, many):
    return f"{n} {one if n == 1 else many}"


def fmt_duration(sec):
    sec = int(sec)
    h, r = divmod(sec, 3600)
    m, s = divmod(r, 60)
    if h:
        return f"{h} h {m} min"
    return f"{m} min" if m else f"{s} s"


# ---------------------------------------------------------------- rete
LAST_ERROR = {}   # url -> ultimo motivo di errore di rete (testo chiaro, mai segreti)
TG_STATE = {"fail_since": None, "permanent": False, "reason": None}   # stato dell'invio Telegram


def describe_error(e, timeout=None):
    """Motivo comprensibile di un errore di rete. Usa solo il TIPO dell'errore: il testo puo' contenere l'URL col token."""
    if isinstance(e, urllib.error.HTTPError):
        return f"risposta HTTP {e.code}"
    if isinstance(e, urllib.error.URLError):
        return describe_error(e.reason, timeout) if isinstance(e.reason, BaseException) else "connessione non riuscita"
    if isinstance(e, (socket.timeout, TimeoutError)):
        return f"nessuna risposta in {timeout:.0f} s" if timeout else "nessuna risposta (timeout)"
    if isinstance(e, socket.gaierror):
        return "indirizzo non trovato (DNS): la connessione internet del telefono potrebbe essere assente"
    if isinstance(e, ConnectionRefusedError):
        return "connessione rifiutata dal server"
    if isinstance(e, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
        return "connessione interrotta a meta'"
    if isinstance(e, ssl.SSLError):
        return "errore di sicurezza SSL/certificato (controlla data e ora del telefono)"
    if isinstance(e, OSError):
        return "errore di rete (" + type(e).__name__ + ")"
    return "errore imprevisto (" + type(e).__name__ + ")"


def clock(ts):
    """Ora di Roma HH:MM di un timestamp."""
    return rome_now(datetime.fromtimestamp(ts, timezone.utc)).strftime("%H:%M")


def _plain(text):
    return re.sub(r"<[^>]+>", "", text).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


def _cut(text, limit=3900):
    """Accorcia su un a-capo, cosi' non spezza un tag HTML (Telegram rifiuterebbe tutto il messaggio)."""
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit("\n", 1)[0]
    return (cut if len(cut) > limit // 2 else text[:limit]) + "\n…"


def _tg_once(req, opener):
    """Un tentativo: (ok, permanente, motivo, pausa_consigliata)."""
    try:
        with (opener or urllib.request.urlopen)(req, timeout=20) as r:
            return (200 <= r.status < 300), False, f"risposta HTTP {r.status}", 0
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8", "replace"))
        except Exception:
            body = {}
        desc = str(body.get("description") or "")[:120]
        wait = int((body.get("parameters") or {}).get("retry_after") or 0)
        if e.code in (401, 404):
            return False, True, f"Telegram rifiuta il token del bot (HTTP {e.code}): TELEGRAM_BOT_TOKEN errato o bot eliminato", 0
        if e.code == 403:
            return False, True, "Telegram non permette di scrivere al proprietario (HTTP 403): il bot e' stato bloccato o non ha mai ricevuto /start", 0
        if e.code == 400 and "parse" in desc.lower():
            return False, False, "PARSE", 0
        if e.code == 400:
            return False, True, f"Telegram rifiuta il messaggio (HTTP 400: {desc or 'richiesta non valida'}): controlla TELEGRAM_OWNER_ID", 0
        return False, False, f"Telegram risponde con errore HTTP {e.code}" + (f" ({desc})" if desc else ""), min(wait, 30)
    except Exception as e:  # solo il tipo dell'errore: il testo potrebbe contenere l'URL col token
        return False, False, "Telegram non raggiungibile: " + describe_error(e, 20), 0


def tg_send(cfg, text, chat_id=None, opener=None, silent=False, sleep=time.sleep):
    """Invia SOLO al proprietario. Qualunque altro chat_id viene rifiutato.
    Errori passeggeri: ritenta con pausa (RETRY_DELAYS). Errori veri (token errato, bot bloccato): niente ritentativi.
    Se il testo HTML viene rifiutato per un tag spezzato, lo rimanda come testo semplice."""
    token, owner = cfg.get("TELEGRAM_BOT_TOKEN"), str(cfg.get("TELEGRAM_OWNER_ID") or "")
    if not token or not owner:
        log.error("Telegram non configurato: manca TELEGRAM_BOT_TOKEN o TELEGRAM_OWNER_ID nel file .env")
        return False
    if chat_id is not None and str(chat_id) != owner:
        log.warning("Rifiutato: destinatario diverso dal proprietario")
        return False
    payload = {"chat_id": owner, "text": _cut(text), "parse_mode": "HTML", "disable_web_page_preview": True}
    if silent:
        payload["disable_notification"] = True

    def build():
        return urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=json.dumps(payload).encode(),
                                      headers={"content-type": "application/json"})
    delays = list(RETRY_DELAYS)
    attempt = 0
    while True:
        attempt += 1
        ok, permanent, reason, wait = _tg_once(build(), opener)
        if not ok and reason == "PARSE" and payload.get("parse_mode"):
            log.warning("Telegram non ha accettato la formattazione del messaggio: lo rimando come testo semplice")
            payload.pop("parse_mode")
            payload["text"] = _cut(_plain(text))
            continue
        if ok:
            if TG_STATE["fail_since"]:
                log.info("Telegram di nuovo raggiungibile (era in errore dalle %s)", clock(TG_STATE["fail_since"]))
            TG_STATE.update(fail_since=None, permanent=False, reason=None)
            return True
        if TG_STATE["fail_since"] is None:
            TG_STATE["fail_since"] = time.time()
        TG_STATE.update(permanent=permanent, reason=reason)
        if permanent or not delays:
            log.error("Invio Telegram fallito dopo %d tentativ%s: %s%s", attempt, "o" if attempt == 1 else "i", reason,
                      " - serve un intervento sul .env, non e' un problema passeggero" if permanent else
                      " - il messaggio resta in coda e riprovo al prossimo giro")
            return False
        d = max(delays.pop(0), wait)
        log.warning("Invio Telegram non riuscito (tentativo %d): %s - riprovo tra %d s", attempt, reason, d)
        sleep(d)


class Outbox:
    """Coda dei messaggi che Telegram non ha accettato per un problema passeggero: riprova al giro dopo, in ordine."""

    def __init__(self, sender=None):
        self.sender = sender or tg_send
        self.pending = []      # (timestamp originale, testo)
        self.dropped = 0
        self.failing_since = None

    def send(self, cfg, text, **kw):
        if self.pending:           # per non sorpassare i messaggi piu' vecchi
            self.flush(cfg)
        if self.sender(cfg, text, **kw):
            return True
        if not TG_STATE["permanent"]:
            if self.failing_since is None:
                self.failing_since = time.time()
            self.pending.append((time.time(), text))
            while len(self.pending) > OUTBOX_MAX:
                self.pending.pop(0)
                self.dropped += 1
        return False

    def flush(self, cfg):
        """Rimanda i messaggi in coda; il primo spiega il ritardo. Si ferma al primo insuccesso."""
        sent = 0
        while self.pending:
            ts, text = self.pending[0]
            head = f"⏳ <i>Messaggio ritardato: previsto alle {clock(ts)}, Telegram non era raggiungibile.</i>\n"
            if sent == 0 and self.dropped:
                head += f"<i>({plural(self.dropped, 'messaggio meno recente perso', 'messaggi meno recenti persi')} perché la coda era piena.)</i>\n"
            if not self.sender(cfg, head + text):
                break
            self.pending.pop(0)
            sent += 1
            self.dropped = 0
        if not self.pending and sent:
            log.info("Coda Telegram svuotata: %d messaggi recapitati in ritardo (problema iniziato alle %s)", sent, clock(self.failing_since or time.time()))
            self.failing_since = None
        return sent


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def http_check(url, timeout=20):
    """(codice HTTP senza seguire i redirect, secondi impiegati). Codice None = timeout/errore di rete
    (il motivo in chiaro resta in LAST_ERROR[url])."""
    op = urllib.request.build_opener(_NoRedirect)
    t0 = time.monotonic()
    try:
        with op.open(urllib.request.Request(url, headers={"User-Agent": "informatix-bot/2"}), timeout=timeout) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception as e:
        code = None
        LAST_ERROR[url] = describe_error(e, timeout)
    if code is not None:
        LAST_ERROR.pop(url, None)
    return code, time.monotonic() - t0


def is_up(code):
    """Giu' solo per errore di rete/timeout o 5xx. 302/401/403/404 = servizio vivo."""
    return code is not None and code < 500


def why_down(url, code):
    """Motivo in chiaro per cui un controllo e' fallito."""
    if code is None:
        return LAST_ERROR.get(url) or "nessuna risposta"
    return f"il server risponde con errore HTTP {code}"


def fetch(url, headers=None, timeout=20):
    """(codice, testo). Codice None = errore di rete (motivo in LAST_ERROR[url])."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "informatix-bot/2", **(headers or {})})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            LAST_ERROR.pop(url, None)
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        LAST_ERROR.pop(url, None)
        return e.code, ""
    except Exception as e:
        LAST_ERROR[url] = describe_error(e, timeout)
        return None, ""


def internet_ok():
    """True se il telefono esce su internet (un sito qualunque risponde, anche con errore HTTP)."""
    return any(fetch(u, timeout=8)[0] is not None for u in ("https://api.telegram.org/", "https://www.cloudflare.com/"))


class MonitorError(str):
    """Errore di lettura dei dati: testo chiaro + permanent=True se non si risolve da solo (chiave/indirizzo sbagliati)."""
    permanent = False

    def __new__(cls, text, permanent=False):
        o = str.__new__(cls, text)
        o.permanent = permanent
        return o


def fetch_monitor(cfg):
    """Numeri del gestionale: (dati, errore). Errore = MonitorError (testo chiaro, mai la chiave)."""
    key = cfg.get("MONITOR_TOKEN")
    if not key:
        return None, MonitorError("manca MONITOR_TOKEN nel file .env", True)
    url = cfg.get("MONITOR_URL") or MONITOR_URL
    code, body = fetch(url, {"Authorization": f"Bearer {key}"})
    if code is None:
        return None, MonitorError(f"gestionale non raggiungibile ({LAST_ERROR.get(url) or 'nessuna risposta'})")
    if code in (401, 403, 404):
        return None, MonitorError(f"chiave non accettata (HTTP {code}): MONITOR_TOKEN nel .env diverso da quello del Worker", True)
    if code != 200:
        return None, MonitorError(f"il gestionale risponde con errore HTTP {code}", 400 <= code < 500 and code not in (408, 429))
    try:
        data = json.loads(body)
    except ValueError:
        return None, MonitorError("risposta non valida (non e' JSON: forse una pagina di errore)")
    if not isinstance(data, dict) or not data.get("ok"):
        return None, MonitorError("risposta non valida (il gestionale non ha confermato ok)")
    return data, None


def site_usati_count(data):
    """Articoli della Vetrina sul sito. ATTENZIONE: 'items' del file della home contiene solo i 3 in evidenza,
    il totale vero e' 'count' (prima il bot contava 'items' e diceva 3 invece di 13)."""
    if isinstance(data, dict) and isinstance(data.get("count"), int):
        return data["count"]
    items = data.get("items") if isinstance(data, dict) else data
    return len(items) if isinstance(items, list) else None


def fetch_site_usati():
    code, body = fetch(USATI_URL)
    if code != 200:
        log.warning("Vetrina Usati sul sito non leggibile: %s", why_down(USATI_URL, code))
        return None
    try:
        return site_usati_count(json.loads(body))
    except ValueError:
        log.warning("Vetrina Usati sul sito non leggibile: il file usati.json non e' JSON valido")
        return None


def blog_today(sitemap, day):
    """Articoli del blog con data di oggi nella sitemap (un <lastmod> per articolo)."""
    return len(re.findall(r"<loc>[^<]*/blog/[^<]+</loc><lastmod>" + re.escape(day) + "<", sitemap or ""))


def fetch_blog_today(day):
    code, body = fetch(SITEMAP_URL)
    if code != 200:
        log.warning("Sitemap del sito non leggibile (articoli del blog non contati): %s", why_down(SITEMAP_URL, code))
        return None
    return blog_today(body, day)


# ---------------------------------------------------------------- controllo dei servizi
class Monitor:
    """Servizi su/giu' e lenti: anti-rimbalzo, avvisi solo al cambio di stato, minuti di fermo del giorno."""

    def __init__(self, names):
        self.net_down_since = None   # da quando il telefono non ha internet (controlli sospesi)
        self.state = {n: {"up": True, "fails": 0, "down_since": None, "slow": 0, "slow_alert": False,
                          "down_today": 0.0, "times": []} for n in names}

    def update(self, name, ok, now, seconds=None, reason=None):
        """Restituisce il testo da inviare (o None). reason = perche' il controllo e' fallito (testo chiaro)."""
        st = self.state[name]
        if ok:
            st["fails"] = 0
            msg = None
            if not st["up"]:
                dur = now - st["down_since"]
                st["down_today"] += dur
                st["up"], st["down_since"] = True, None
                msg = f"✅ <b>{name}</b> è tornato online.\nRipristinato dopo {fmt_duration(dur)} (era giù dalle {clock(now - dur)})."
            if seconds is not None:
                st["times"] = (st["times"] + [seconds])[-300:]
                if seconds > SLOW_SECONDS:
                    st["slow"] += 1
                    if st["slow"] >= SLOW_BEFORE_ALERT and not st["slow_alert"]:
                        st["slow_alert"] = True
                        msg = msg or f"🐢 <b>{name}</b> è lento: risponde in {seconds:.0f} secondi ({st['slow']} controlli di fila)."
                else:
                    st["slow"] = 0
                    if st["slow_alert"]:
                        st["slow_alert"] = False
                        msg = msg or f"✅ <b>{name}</b> di nuovo veloce ({seconds:.1f} s)."
            return msg
        st["fails"] += 1
        if st["up"] and st["fails"] >= FAILS_BEFORE_ALERT:
            st["up"] = False
            st["down_since"] = now - CHECK_EVERY * (FAILS_BEFORE_ALERT - 1)
            return (f"🔴 <b>{name}</b> non risponde: {esc(reason or 'nessuna risposta')}.\n"
                    f"Il problema dura da circa le {clock(st['down_since'])} ({st['fails']} controlli falliti di fila, uno ogni {CHECK_EVERY // 60} minuti).\n"
                    f"Nel frattempo continuo a controllare e ti scrivo appena torna online.")
        return None

    def new_day(self, now):
        for st in self.state.values():
            st["down_today"] = 0.0
            st["times"] = []
            if not st["up"]:
                st["down_since"] = now  # il fermo in corso si conta da mezzanotte

    def downtime(self, name, now):
        st = self.state[name]
        return st["down_today"] + (now - st["down_since"] if not st["up"] and st["down_since"] else 0)


def run_checks(monitor, cfg, now, check=http_check, send=tg_send, probe=None):
    results = []
    for name, url in SERVICES:
        code, secs = check(url)
        results.append((name, url, code, secs))
        log.info("%s -> %s (%.1f s)", name, code if code is not None else "errore: " + why_down(url, None), secs)
    # Se TUTTO tace e anche internet e' irraggiungibile, il guasto e' del telefono (Wi-Fi/dati spenti), non dei servizi:
    # niente falsi allarmi "giu'" per 4 servizi; un solo avviso quando la connessione torna.
    if all(c is None for _, _, c, _ in results) and not (probe or internet_ok)():
        if getattr(monitor, "net_down_since", None) is None:
            monitor.net_down_since = now
            log.warning("Nessuna connessione internet dal telefono: sospendo i controlli dei servizi finche' non torna")
        return
    if getattr(monitor, "net_down_since", None) is not None:
        dur = now - monitor.net_down_since
        log.info("Connessione internet del telefono ripristinata dopo %s", fmt_duration(dur))
        send(cfg, f"ℹ️ <b>Connessione del telefono ripristinata</b> dopo {fmt_duration(dur)} (da {clock(monitor.net_down_since)}).\n"
                  f"In quel periodo non ho potuto controllare i servizi né leggere i dati: non vuol dire che fossero giù.")
        monitor.net_down_since = None
    for name, url, code, secs in results:
        msg = monitor.update(name, is_up(code), now, secs if is_up(code) else None, reason=None if is_up(code) else why_down(url, code))
        if msg:
            send(cfg, msg)


# ---------------------------------------------------------------- controlli sui dati
class Alerts:
    """Avvisi 'una volta finche' dura': si manda all'inizio del problema e quando si risolve."""

    def __init__(self):
        self.count = {}
        self.active = {}
        self.first = {}

    def check(self, key, problem, on_text, off_text=None, need=1, now=None):
        """problem=True/False. Restituisce il testo da inviare (o None).
        Nei testi: {since} = ora di Roma del primo errore, {dur} = durata, {n} = tentativi falliti."""
        now = time.time() if now is None else now
        if problem:
            self.count[key] = self.count.get(key, 0) + 1
            self.first.setdefault(key, now)
            if not self.active.get(key) and self.count[key] >= need:
                self.active[key] = True
                return self._fill(on_text, key, now)
            return None
        self.count[key] = 0
        first = self.first.pop(key, now)
        if self.active.pop(key, False):
            return self._fill(off_text, key, now, first)
        return None

    def _fill(self, text, key, now, first=None):
        if not text:
            return text
        first = first if first is not None else self.first.get(key, now)
        return (text.replace("{since}", clock(first)).replace("{dur}", fmt_duration(max(0, now - first)))
                .replace("{n}", str(self.count.get(key, 0))))


def data_checks(alerts, data, err, site_count, now_rome, now_ts=None):
    """Controlli sui numeri del gestionale. Restituisce la lista dei testi da inviare."""
    out = []
    if getattr(err, "permanent", False):
        # errore vero (chiave sbagliata, indirizzo errato): non passa da solo, si avvisa subito e una volta sola
        on = (f"🔴 <b>Dati del gestionale non leggibili: serve un intervento</b>\nMotivo: {esc(err)}.\n"
              "Non si risolve da solo. Finché non lo sistemi, controlli di vetrina e backup sono sospesi e i riepiloghi escono senza numeri.\n"
              "Cosa fare: controlla MONITOR_TOKEN nel file .env del telefono (deve essere uguale al segreto del Worker).")
        need = 1
    else:
        on = (f"⚠️ <b>Dati del gestionale non leggibili</b>\nMotivo: {esc(err or 'sconosciuto')}.\n"
              "Il problema dura da {since} ({n} tentativi falliti, uno ogni " + str(CHECK_EVERY // 60) + " minuti): probabilmente è passeggero.\n"
              "Intanto riprovo da solo; controlli di vetrina e backup sono sospesi e i riepiloghi escono senza numeri. Ti scrivo quando torna tutto ok.")
        need = FAILS_BEFORE_ALERT
    t = alerts.check("monitor", data is None, on, "✅ <b>Dati del gestionale</b> di nuovo leggibili (ripristinato dopo {dur}).", need=need, now=now_ts)
    if t:
        out.append(t)
    if data is None:
        return out
    u = data.get("usati") or {}
    if u and site_count is not None:
        wrong = not u.get("dirty") and site_count != u.get("total")
        t = alerts.check("vetrina", wrong,
                         f"🏷️ <b>Vetrina Usati non allineata</b>\nSul sito risultano {site_count} articoli, nel gestionale {u.get('total')}.\nApri Vetrina usati e premi «Ripubblica sul sito» (il sito si aggiorna in 1-2 minuti).",
                         f"✅ <b>Vetrina Usati</b> di nuovo allineata: {site_count} articoli sul sito.", need=VETRINA_CHECKS)
        if t:
            out.append(t)
    if u:
        e = u.get("error") or ""
        t = alerts.check("pubblicazione:" + e[:60], bool(e), f"🔴 <b>Pubblicazione della Vetrina NON riuscita</b>\n{esc(e[:300])}", None)
        if t:
            out.append(t)
    b = data.get("backup")
    if b is not None and now_rome.hour >= BACKUP_DEADLINE:
        today = now_rome.strftime("%Y-%m-%d")
        missing = not b.get("at") or not str(b["at"]).startswith(today)
        t = alerts.check("backup:" + today, missing,
                         f"💾 <b>Backup notturno mancante</b>\nL’ultimo backup è del {esc(dmy(b.get('at')) or 'mai')}. Controlla il Worker (cron delle 4:30).", None)
        if t:
            out.append(t)
    return out


# ---------------------------------------------------------------- messaggi
def _rep(r):
    return " · ".join(esc(x) for x in (r.get("code"), r.get("model"), r.get("customer")) if x)


def build_morning(data, when):
    """Buongiorno: le cose da fare oggi. Testo pronto per Telegram."""
    head = f"☀️ <b>Buongiorno</b> · {DAYS_IT[when.weekday()]} {when.strftime('%d/%m')}"
    if data is None:
        return head + "\n⚠️ Dati del gestionale non disponibili: niente agenda stamattina."
    lines = []
    rem = (data.get("reminders") or {}).get("today") or []
    if rem:
        lines.append(f"🔔 <b>Promemoria di oggi</b> ({len(rem)})\n" + "\n".join(f"• {esc(x['time'])} {esc(x['title'])}" for x in rem[:8]))
    old = (data.get("reminders") or {}).get("overdue_before_today") or 0
    if old:
        lines.append(f"🔔 {plural(old, 'promemoria rimasto', 'promemoria rimasti')} dai giorni scorsi")
    rp = data.get("repairs") or {}
    ready = rp.get("ready") or []
    if ready:
        rows = [f"• {_rep(r)}" + (f" — da {r['days']} gg" if r.get("days") else "") for r in ready[:8]]
        lines.append(f"📦 <b>Pronte da ritirare</b> ({len(ready)})\n" + "\n".join(rows))
    late = rp.get("late") or []
    if late:
        lines.append(f"⏰ <b>In ritardo</b> ({len(late)})\n" + "\n".join(f"• {_rep(r)} (prevista {esc(dmy(r.get('eta')))})" for r in late[:8]))
    if rp.get("to_approve"):
        lines.append(f"🧾 {plural(len(rp['to_approve']), 'preventivo attende', 'preventivi attendono')} la risposta del cliente")
    if rp.get("declined"):
        lines.append(f"❌ {plural(len(rp['declined']), 'preventivo rifiutato', 'preventivi rifiutati')}: da richiamare ({', '.join(esc(r['code']) for r in rp['declined'][:5])})")
    if rp.get("storage_due"):
        lines.append("📦 <b>Giacenza scaduta</b>: " + ", ".join(f"{esc(x['code'])} {esc(x['model'])} ({x['days']} gg)" for x in rp["storage_due"][:5]))
    o = data.get("orders") or {}
    if o.get("arrived"):
        lines.append(f"🛍️ {plural(o['arrived'], 'ordine arrivato', 'ordini arrivati')}: avvisa il cliente ({', '.join(esc(x['code']) + (' ' + esc(x['customer']) if x.get('customer') else '') for x in o.get('arrived_list', [])[:5])})")
    if o.get("late"):
        lines.append(f"🛍️ {plural(len(o['late']), 'ordine in ritardo', 'ordini in ritardo')}: {', '.join(esc(x['code']) for x in o['late'][:5])}")
    if o.get("to_order"):
        lines.append(f"🛍️ {plural(o['to_order'], 'ordine da fare', 'ordini da fare')} al fornitore")
    q = data.get("quotes") or {}
    if q.get("expiring"):
        lines.append("🗒️ Preventivi in scadenza: " + ", ".join(f"{esc(x['code'])} ({esc(dmy(x['valid_until']))})" for x in q["expiring"][:5]))
    s = data.get("stock") or {}
    if s.get("out") or s.get("low"):
        items = ", ".join(f"{esc(x['name'])} {x['qty']}/{x['min']}" for x in (s.get("low_items") or [])[:5])
        lines.append(f"📉 Magazzino: {s.get('out', 0)} esauriti, {s.get('low', 0)} sotto scorta{f' ({items})' if items else ''}")
    b = data.get("backup")
    if b is not None:
        ok = b.get("at") and str(b["at"]).startswith(when.strftime("%Y-%m-%d"))
        lines.append(f"💾 Backup di stanotte: {'ok, ' + esc(dmy(b['at'])) if ok else '⚠️ MANCANTE (ultimo ' + esc(dmy(b.get('at')) or 'mai') + ')'}")
    if not [x for x in lines if not x.startswith("💾")]:
        lines.insert(0, "Niente di urgente oggi. Buon lavoro! 💪")
    return head + "\n\n" + "\n\n".join(lines)


def build_summary(monitor, data, when, site_count=None, blog=None, now=None):
    """Riepilogo serale dettagliato. Testo pronto per Telegram."""
    now = now if now is not None else time.time()
    lines = [f"📋 <b>Riepilogo Informatix</b> · {when.strftime('%d/%m/%Y %H:%M')}"]
    down = [n for n, st in monitor.state.items() if not st["up"]]
    hist = [f"{n} {fmt_duration(monitor.downtime(n, now))}" for n in monitor.state if monitor.downtime(n, now) >= 60]
    lines.append(("🔴 Giù adesso: " + ", ".join(down) if down else "🟢 Servizi tutti online") + (f" · oggi fermi: {', '.join(hist)}" if hist else ""))
    if data is None:
        lines.append("⚠️ Dati del gestionale non disponibili")
        if site_count is not None:
            lines.append(f"🏷️ Vetrina Usati sul sito: {site_count} articoli")
        return "\n".join(lines)

    c = data.get("cash") or {}
    day = c.get("today") or {}
    moves = f" ({plural(day['n'], 'movimento', 'movimenti')})" if day.get("n") else ""
    lines.append(f"\n💶 <b>Incassi oggi: {eur(day.get('total'))}</b>{moves}")
    if day.get("by_method"):
        lines.append("   " + " · ".join(f"{esc(m['method'])} {eur(m['total'])}" for m in sorted(day["by_method"], key=lambda m: -(m.get("total") or 0))))
    if day.get("by_kind"):
        lines.append("   " + " · ".join(f"{KIND.get(k['kind'], esc(k['kind']))} {eur(k['total'])}" for k in day["by_kind"]))
    v = day.get("vouchers") or {}
    if v.get("discount") or v.get("credit"):
        lines.append(f"   🎁 buoni usati: sconti {eur(v.get('discount'))} · credito {eur(v.get('credit'))}")
    ex = c.get("expenses_today") or {}
    if ex.get("total"):
        lines.append(f"🧾 Spese oggi: {eur(ex['total'])} → netto {eur((day.get('total') or 0) - ex['total'])}")

    s = (data.get("sales") or {}).get("today") or {}
    if s.get("n"):
        items = ", ".join(f"{esc(i['name'])} ×{i['qty']:g}" for i in (s.get("items") or [])[:6])
        lines.append(f"🛒 <b>Vendite oggi: {s['n']}</b> per {eur(s.get('total'))}{f' — {items}' if items else ''}")
    else:
        lines.append("🛒 Vendite oggi: nessuna")

    rp = data.get("repairs") or {}
    dt = rp.get("delivered_today") or {}
    open_parts = [f"{n} {STATUS.get(k, k)}" for k, n in (rp.get("by_status") or {}).items() if n]
    extra = [f"{len(rp['late'])} in ritardo" if rp.get("late") else "", f"{rp['urgent']} urgenti" if rp.get("urgent") else ""]
    delivered = f" ({eur(dt.get('total'))})" if dt.get("n") else ""
    lines.append(f"🛠️ <b>Riparazioni</b>: {rp.get('intake_today', 0)} entrate, {dt.get('n', 0)} consegnate{delivered}")
    lines.append(f"   aperte {rp.get('open', 0)}{': ' + ', '.join(open_parts) if open_parts else ''}{' · ' + ', '.join(x for x in extra if x) if any(extra) else ''}")
    ready_old = [r for r in rp.get("ready") or [] if rp.get("ready_days") and (r.get("days") or 0) >= rp["ready_days"]]
    if ready_old:
        lines.append(f"   📦 pronte non ritirate da oltre {rp['ready_days']} giorni: " + ", ".join(f"{esc(r['code'])} ({r['days']} gg)" for r in ready_old[:5]))

    o = data.get("orders") or {}
    if o and (o.get("to_order") or o.get("ordered") or o.get("arrived")):
        lines.append(f"🛍️ Ordini: {o.get('to_order', 0)} da ordinare, {o.get('ordered', 0)} ordinati, {o.get('arrived', 0)} arrivati da consegnare")
    m = c.get("month") or {}
    sm = (data.get("sales") or {}).get("month") or {}
    em = c.get("expenses_month") or {}
    lines.append(f"\n📅 <b>Mese</b> (dal {dmy(m.get('from'))[:5]}): incassi {eur(m.get('total'))} · vendite {sm.get('n', 0)} per {eur(sm.get('total'))} · spese {eur(em.get('total'))}")

    u = data.get("usati") or {}
    if u:
        sync = ""
        if site_count is not None:
            sync = " · sito allineato ✅" if site_count == u.get("total") else f" · ⚠️ sul sito {site_count}" + (" (modifiche da pubblicare)" if u.get("dirty") else "")
        elif u.get("dirty"):
            sync = " · modifiche da pubblicare"
        lines.append(f"🏷️ <b>Vetrina usati</b>: {u.get('in_vetrina', 0)} in vetrina, {u.get('sold', 0)} venduti{sync}")
    if blog is not None:
        lines.append(f"📰 Blog: {plural(blog, 'articolo pubblicato', 'articoli pubblicati')} oggi" + (" ⚠️" if blog == 0 else ""))
    a = data.get("activity") or {}
    seen = []
    today = when.strftime("%Y-%m-%d")
    for us in data.get("users") or []:
        if str(us.get("last_seen_at") or "").startswith(today):
            seen.append(f"{esc((us.get('name') or us.get('email') or '').split(' ')[0])} {us['last_seen_at'][11:16]}")
    lines.append(f"👥 Attività: {plural(a.get('n') or 0, 'operazione registrata', 'operazioni registrate')}" + (f" · ultimi accessi: {', '.join(seen)}" if seen else " · nessun accesso oggi"))
    b = data.get("backup")
    if b is not None:
        lines.append(f"💾 Backup: {'stanotte ' + esc(dmy(b['at'])[6:]) if b.get('at') and str(b['at']).startswith(today) else '⚠️ ultimo ' + esc(dmy(b.get('at')) or 'mai')} ({plural(b.get('copies') or 0, 'copia', 'copie')} salvate)")
    return "\n".join(lines)


# ---------------------------------------------------------------- appuntamenti del giorno
class Schedule:
    """Ricorda se buongiorno e riepilogo di oggi sono gia' partiti (niente doppioni se il bot si riavvia dopo l'ora)."""

    def __init__(self, now_rome):
        today = now_rome.date()
        self.summary_day = today if now_rome.hour >= SUMMARY_HOUR else None
        self.morning_day = today if (now_rome.hour, now_rome.minute) >= MORNING else None
        self.day = today

    def due_morning(self, now_rome):
        if now_rome.weekday() in MORNING_DAYS and (now_rome.hour, now_rome.minute) >= MORNING and now_rome.hour < 12 and self.morning_day != now_rome.date():
            self.morning_day = now_rome.date()
            return True
        return False

    def due_summary(self, now_rome):
        if now_rome.hour >= SUMMARY_HOUR and self.summary_day != now_rome.date():
            self.summary_day = now_rome.date()
            return True
        return False


def _safe_text(what, build, send, cfg):
    """Prepara e manda un messaggio fisso (buongiorno/riepilogo): se la preparazione fallisce lo dice, non lo perde in silenzio."""
    try:
        text = build()
    except Exception as e:
        log.exception("Non sono riuscito a preparare %s", what)
        text = f"⚠️ <b>Non sono riuscito a preparare {esc(what)}</b>\nErrore interno del bot: {esc(redact(type(e).__name__ + ': ' + str(e))[:150])}.\nIl dettaglio è nel log del telefono."
    send(cfg, text)


def tick(monitor, alerts, schedule, cfg, now, utc_now=None, check=http_check, get_monitor=fetch_monitor,
         get_site=fetch_site_usati, get_blog=fetch_blog_today, send=tg_send, probe=None, beat=None, outbox=None):
    """Un giro completo: servizi, dati, buongiorno e riepilogo. Restituisce i dati letti.
    beat = funzione chiamata tra un passo e l'altro (aggiorna l'heartbeat anche se la rete e' lenta)."""
    beat = beat or (lambda: None)
    rome = rome_now(utc_now)
    if outbox:
        outbox.flush(cfg)
    if rome.date() != schedule.day:
        schedule.day = rome.date()
        monitor.new_day(now)
    run_checks(monitor, cfg, now, check=check, send=send, probe=probe)
    beat()
    data, err = get_monitor(cfg)
    if err:
        log.warning("Dati del gestionale non leggibili%s: %s", " (errore permanente)" if getattr(err, "permanent", False) else " (probabilmente passeggero)", err)
    beat()
    site_count = get_site()
    beat()
    for t in data_checks(alerts, data, err, site_count, rome, now_ts=now):
        send(cfg, t)
    if schedule.due_morning(rome):
        _safe_text("il buongiorno", lambda: build_morning(data, rome), send, cfg)
    if schedule.due_summary(rome):
        _safe_text("il riepilogo serale", lambda: build_summary(monitor, data, rome, site_count, get_blog(rome.strftime("%Y-%m-%d")), now), send, cfg)
    return data


def tick_failed(alerts, cfg, e, now, send):
    """Eccezione non prevista in un giro: log completo (ripulito dai segreti), avviso al titolare dal 2o giro di fila."""
    log.error("Errore interno nel giro di controlli (%s): il bot continua e riprova tra %d minuti", type(e).__name__, CHECK_EVERY // 60, exc_info=e)
    detail = esc(redact(f"{type(e).__name__}: {e}")[:150])
    t = alerts.check("tick", True,
                     f"🛠️ <b>Il bot ha un problema interno</b>\nErrore: {detail}.\nDa {{since}} ({{n}} giri di controlli falliti di fila). Il bot resta acceso e riprova ogni {CHECK_EVERY // 60} minuti; "
                     "finché dura, controlli e riepiloghi potrebbero mancare. Il dettaglio è nel log del telefono.", None, need=2, now=now)
    if t:
        send(cfg, t)


def tick_ok(alerts, cfg, now, send):
    t = alerts.check("tick", False, None, "✅ <b>Il bot</b> è tornato a funzionare normalmente (ripristinato dopo {dur}).", now=now)
    if t:
        send(cfg, t)


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


_hb_failed = [False]


def write_heartbeat(path=None):
    """Aggiorna il file heartbeat. Se il disco e' pieno o non scrivibile lo dice nel log (una volta) ma non ferma il bot."""
    path = path or HEARTBEAT_FILE
    try:
        with open(path, "w") as f:
            f.write(rome_now().strftime("%Y-%m-%d %H:%M:%S"))
        if _hb_failed[0]:
            log.info("Heartbeat di nuovo scrivibile")
            _hb_failed[0] = False
    except OSError as e:
        if not _hb_failed[0]:
            _hb_failed[0] = True
            log.error("Non riesco a scrivere il file heartbeat (%s): il Control Center potrebbe credere il bot fermo", describe_error(e))


class Stop(Exception):
    pass


def _on_signal(signum, frame):
    raise Stop()


def preview(cfg, send_it=False):
    """--anteprima: stampa (o con --invia manda) buongiorno e riepilogo con i dati veri di adesso."""
    monitor = Monitor([n for n, _ in SERVICES])
    run_checks(monitor, cfg, time.time(), send=lambda c, t: None)
    data, err = fetch_monitor(cfg)
    rome = rome_now()
    site = fetch_site_usati()
    texts = [build_morning(data, rome), build_summary(monitor, data, rome, site, fetch_blog_today(rome.strftime("%Y-%m-%d")))]
    if err:
        print("Dati del gestionale:", err)
    for t in texts:
        if send_it:
            tg_send(cfg, "🧪 ANTEPRIMA\n" + t)
        else:
            print(re.sub(r"<[^>]+>", "", t).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&"), "\n")
    return 0 if data is not None else 1


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    cfg = load_env()
    if not cfg.get("TELEGRAM_BOT_TOKEN") or not cfg.get("TELEGRAM_OWNER_ID"):
        print("Manca TELEGRAM_BOT_TOKEN o TELEGRAM_OWNER_ID nel file .env", file=sys.stderr)
        return 2
    if "--anteprima" in argv:
        return preview(cfg, send_it="--invia" in argv)
    other = already_running()
    if other:
        print(f"Il bot è già in esecuzione (pid {other}): esco senza fare nulla.", file=sys.stderr)
        return 3
    setup_logging([cfg["TELEGRAM_BOT_TOKEN"], cfg["TELEGRAM_OWNER_ID"], cfg.get("MONITOR_TOKEN", "")])
    write_pid()
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)
    log.info("Bot avviato (versione 2: riepiloghi dettagliati)%s", "" if cfg.get("MONITOR_TOKEN") else " - ATTENZIONE: manca MONITOR_TOKEN")
    monitor = Monitor([n for n, _ in SERVICES])
    alerts = Alerts()
    schedule = Schedule(rome_now())
    if "--test" in argv:
        run_checks(monitor, cfg, time.time())
        data, err = fetch_monitor(cfg)
        ok = tg_send(cfg, "🧪 TEST bot Termux attivo" + ("\n✅ Dati del gestionale leggibili" if data else f"\n⚠️ Dati del gestionale: {esc(err)}"))
        print("Messaggio di prova:", "ok" if ok else "NON inviato", "| dati:", "ok" if data else err)
        remove_pid()
        return 0 if ok else 1
    outbox = Outbox()
    next_check = 0.0
    try:
        while True:
            now = time.time()
            write_heartbeat()
            if now >= next_check:
                try:
                    tick(monitor, alerts, schedule, cfg, now, beat=write_heartbeat, outbox=outbox, send=outbox.send)
                    tick_ok(alerts, cfg, now, outbox.send)
                except Stop:
                    raise
                except Exception as e:  # un errore in un giro non deve fermare il bot
                    try:
                        tick_failed(alerts, cfg, e, now, outbox.send)
                    except Exception:
                        log.exception("Errore anche nel gestire l'errore del giro")
                next_check = now + CHECK_EVERY
            time.sleep(HEARTBEAT_EVERY)
    except Stop:
        log.info("Arresto richiesto, chiudo")
    finally:
        remove_pid()
    return 0


if __name__ == "__main__":
    sys.exit(main())
