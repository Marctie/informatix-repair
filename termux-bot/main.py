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
import sys
import time
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


class Redactor(logging.Filter):
    """Toglie dai log token, chiavi e ID, qualunque cosa succeda."""
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
def tg_send(cfg, text, chat_id=None, opener=None, silent=False):
    """Invia SOLO al proprietario. Qualunque altro chat_id viene rifiutato."""
    token, owner = cfg.get("TELEGRAM_BOT_TOKEN"), str(cfg.get("TELEGRAM_OWNER_ID") or "")
    if not token or not owner:
        log.error("Telegram non configurato")
        return False
    if chat_id is not None and str(chat_id) != owner:
        log.warning("Rifiutato: destinatario diverso dal proprietario")
        return False
    payload = {"chat_id": owner, "text": text[:3900], "parse_mode": "HTML", "disable_web_page_preview": True}
    if silent:
        payload["disable_notification"] = True
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=json.dumps(payload).encode(),
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


def http_check(url, timeout=20):
    """(codice HTTP senza seguire i redirect, secondi impiegati). Codice None = timeout/errore di rete."""
    op = urllib.request.build_opener(_NoRedirect)
    t0 = time.monotonic()
    try:
        with op.open(urllib.request.Request(url, headers={"User-Agent": "informatix-bot/2"}), timeout=timeout) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        code = None
    return code, time.monotonic() - t0


def is_up(code):
    """Giu' solo per errore di rete/timeout o 5xx. 302/401/403/404 = servizio vivo."""
    return code is not None and code < 500


def fetch(url, headers=None, timeout=20):
    """(codice, testo). Codice None = errore di rete."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "informatix-bot/2", **(headers or {})})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return None, ""


def fetch_monitor(cfg):
    """Numeri del gestionale: (dati, errore). Errore = testo breve, mai la chiave."""
    key = cfg.get("MONITOR_TOKEN")
    if not key:
        return None, "manca MONITOR_TOKEN nel file .env"
    code, body = fetch(cfg.get("MONITOR_URL") or MONITOR_URL, {"Authorization": f"Bearer {key}"})
    if code != 200:
        return None, "rete non raggiungibile" if code is None else ("chiave non accettata (404)" if code == 404 else f"risposta HTTP {code}")
    try:
        data = json.loads(body)
        return (data, None) if data.get("ok") else (None, "risposta non valida")
    except ValueError:
        return None, "risposta non valida"


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
        return None
    try:
        return site_usati_count(json.loads(body))
    except ValueError:
        return None


def blog_today(sitemap, day):
    """Articoli del blog con data di oggi nella sitemap (un <lastmod> per articolo)."""
    return len(re.findall(r"<loc>[^<]*/blog/[^<]+</loc><lastmod>" + re.escape(day) + "<", sitemap or ""))


def fetch_blog_today(day):
    code, body = fetch(SITEMAP_URL)
    return blog_today(body, day) if code == 200 else None


# ---------------------------------------------------------------- controllo dei servizi
class Monitor:
    """Servizi su/giu' e lenti: anti-rimbalzo, avvisi solo al cambio di stato, minuti di fermo del giorno."""

    def __init__(self, names):
        self.state = {n: {"up": True, "fails": 0, "down_since": None, "slow": 0, "slow_alert": False,
                          "down_today": 0.0, "times": []} for n in names}

    def update(self, name, ok, now, seconds=None):
        """Restituisce il testo da inviare (o None)."""
        st = self.state[name]
        if ok:
            st["fails"] = 0
            msg = None
            if not st["up"]:
                dur = now - st["down_since"]
                st["down_today"] += dur
                st["up"], st["down_since"] = True, None
                msg = f"✅ <b>{name}</b> è tornato online.\nEra giù da {fmt_duration(dur)}."
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
            return f"🔴 <b>{name}</b> non risponde.\nControllo fallito {st['fails']} volte di fila."
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


def run_checks(monitor, cfg, now, check=http_check, send=tg_send):
    for name, url in SERVICES:
        code, secs = check(url)
        log.info("%s -> %s (%.1f s)", name, code if code is not None else "errore di rete", secs)
        msg = monitor.update(name, is_up(code), now, secs if is_up(code) else None)
        if msg:
            send(cfg, msg)


# ---------------------------------------------------------------- controlli sui dati
class Alerts:
    """Avvisi 'una volta finche' dura': si manda all'inizio del problema e quando si risolve."""

    def __init__(self):
        self.count = {}
        self.active = {}

    def check(self, key, problem, on_text, off_text=None, need=1):
        """problem=True/False. Restituisce il testo da inviare (o None)."""
        if problem:
            self.count[key] = self.count.get(key, 0) + 1
            if not self.active.get(key) and self.count[key] >= need:
                self.active[key] = True
                return on_text
            return None
        self.count[key] = 0
        if self.active.pop(key, False):
            return off_text
        return None


def data_checks(alerts, data, err, site_count, now_rome):
    """Controlli sui numeri del gestionale. Restituisce la lista dei testi da inviare."""
    out = []
    t = alerts.check("monitor", data is None,
                     f"⚠️ <b>Dati del gestionale non leggibili</b>\nIl bot non riesce a leggere i numeri ({esc(err)}).\nI controlli di vetrina e backup e i riepiloghi restano senza dati finché non torna.",
                     "✅ <b>Dati del gestionale</b> di nuovo leggibili.", need=FAILS_BEFORE_ALERT)
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


def tick(monitor, alerts, schedule, cfg, now, utc_now=None, check=http_check, get_monitor=fetch_monitor,
         get_site=fetch_site_usati, get_blog=fetch_blog_today, send=tg_send):
    """Un giro completo: servizi, dati, buongiorno e riepilogo. Restituisce i dati letti."""
    rome = rome_now(utc_now)
    if rome.date() != schedule.day:
        schedule.day = rome.date()
        monitor.new_day(now)
    run_checks(monitor, cfg, now, check=check, send=send)
    data, err = get_monitor(cfg)
    if err:
        log.warning("Dati del gestionale: %s", err)
    site_count = get_site()
    for t in data_checks(alerts, data, err, site_count, rome):
        send(cfg, t)
    if schedule.due_morning(rome):
        send(cfg, build_morning(data, rome))
    if schedule.due_summary(rome):
        send(cfg, build_summary(monitor, data, rome, site_count, get_blog(rome.strftime("%Y-%m-%d")), now))
    return data


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
    next_check = 0.0
    try:
        while True:
            now = time.time()
            write_heartbeat()
            if now >= next_check:
                try:
                    tick(monitor, alerts, schedule, cfg, now)
                except Stop:
                    raise
                except Exception as e:  # un errore in un giro non deve fermare il bot
                    log.error("Errore nel giro di controlli: %s", type(e).__name__)
                next_check = now + CHECK_EVERY
            time.sleep(HEARTBEAT_EVERY)
    except Stop:
        log.info("Arresto richiesto, chiudo")
    finally:
        remove_pid()
    return 0


if __name__ == "__main__":
    sys.exit(main())
