import logging
from functools import wraps

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from . import api, config

logger = logging.getLogger(__name__)

BOT_COMMANDS = [
    BotCommand("nuovo", "Pubblica un nuovo articolo usato"),
    BotCommand("lista", "Elenco articoli in vetrina"),
    BotCommand("venduto", "Segna un articolo come venduto"),
    BotCommand("riattiva", "Rimetti in vetrina un articolo venduto"),
    BotCommand("prezzo", "Cambia il prezzo di un articolo"),
    BotCommand("elimina", "Elimina un articolo"),
    BotCommand("annulla", "Annulla l'operazione in corso"),
    BotCommand("help", "Mostra il manuale"),
]

MANUAL = """
👋 *Gestionale Vetrina Usati – Informatix Repair*

➕ `/nuovo` — pubblica un articolo: ti guido passo passo (foto, nome, categoria, condizione, prezzo, note).
📋 `/lista` — elenco numerato degli articoli, con stato.
✅ `/venduto <n>` — segna venduto (resta visibile 7 giorni con il bollino VENDUTO).
↩️ `/riattiva <n>` — rimette in vetrina un articolo venduto.
💶 `/prezzo <n> <importo>` — cambia prezzo (es. `/prezzo 2 899`); `/prezzo 2 richiesta` per "su richiesta".
🗑 `/elimina <n>` — elimina un articolo (chiede conferma).
✖️ `/annulla` — interrompe l'operazione in corso.

Il numero `<n>` è quello mostrato da `/lista`. Ogni modifica pubblica subito la vetrina.
"""

CATEGORIES = {"smartphone": "Smartphone", "computer": "Computer e tablet", "audio-gaming": "Audio e gaming"}
# chiave -> (condition, conditionLabel)
CONDITIONS = {
    "usato": ("usato", "Usato"),
    "usato_scatola": ("usato", "Usato con scatola"),
    "ricond": ("usato", "Ricondizionato"),
    "nuovo": ("nuovo", "Nuovo sigillato"),
}

PHOTOS, NAME, CATEGORY, CONDITION, PRICE, NOTES, CONFIRM = range(7)


def _restricted(handler):
    @wraps(handler)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.effective_user.id if update.effective_user else None
        if not config.TELEGRAM_ALLOWED_USER_IDS or user_id not in config.TELEGRAM_ALLOWED_USER_IDS:
            logger.warning("Accesso negato per user_id=%s", user_id)
            if update.effective_message:
                await update.effective_message.reply_text("⛔ Non sei autorizzato a usare questo bot.")
            return ConversationHandler.END
        return await handler(update, context)

    return wrapper


def parse_price(text: str) -> float | None:
    """'1.299,50' / '899' / '899€' -> numero. 'richiesta' / 'su richiesta' -> None.
    Solleva ValueError se non e' un prezzo valido."""
    t = text.strip().lower().replace("€", "").replace("eur", "").strip()
    if t in ("richiesta", "su richiesta", "-"):
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    elif t.count(".") == 1 and len(t.split(".")[1]) == 3:
        t = t.replace(".", "")  # 1.299 -> 1299
    value = float(t)
    if value < 0 or value != value or value == float("inf"):
        raise ValueError("prezzo non valido")
    return int(value) if value == int(value) else value


def fmt_price(price) -> str:
    if price is None:
        return "su richiesta"
    if price == int(price):
        return f"{int(price):,}".replace(",", ".") + " €"
    return f"{price:.2f}".replace(".", ",") + " €"


def fmt_item(n: int, it: dict) -> str:
    status = it.get("status")
    if status == "sold":
        tag = f"🔴 venduto ({it.get('daysLeft', 0)} g. alla scomparsa)"
    elif status == "expired":
        tag = "⚫ venduto (nascosto)"
    else:
        tag = "🟢 in vetrina"
    return f"{n}. {it['name']} — {fmt_price(it.get('price'))} — {tag}"


async def _item_by_number(update: Update, arg: str) -> dict | None:
    """Risolve il numero di /lista in un articolo; risponde da solo in caso di errore."""
    if not arg.isdigit():
        await update.message.reply_text("Indica il numero dell'articolo (lo vedi con /lista).")
        return None
    items = await api.list_items()
    n = int(arg)
    if not 1 <= n <= len(items):
        await update.message.reply_text(f"Non esiste l'articolo {n}: ce ne sono {len(items)}. Usa /lista.")
        return None
    return items[n - 1]


async def cmd_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Non protetto apposta: serve a scoprire il proprio ID da mettere nel .env."""
    uid = update.effective_user.id if update.effective_user else None
    await update.message.reply_text(f"Il tuo ID Telegram è: {uid}")


@_restricted
async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(MANUAL, parse_mode=ParseMode.MARKDOWN)


@_restricted
async def cmd_lista(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        items = await api.list_items()
    except api.ApiError as e:
        await update.message.reply_text(f"❌ {e}")
        return
    if not items:
        await update.message.reply_text("Nessun articolo in vetrina. Usa /nuovo per aggiungerne uno.")
        return
    await update.message.reply_text("\n".join(fmt_item(i + 1, it) for i, it in enumerate(items)))


@_restricted
async def cmd_venduto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _simple_action(update, context, "venduto")


@_restricted
async def cmd_riattiva(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _simple_action(update, context, "riattiva")


async def _simple_action(update: Update, context: ContextTypes.DEFAULT_TYPE, kind: str):
    arg = context.args[0] if context.args else ""
    try:
        it = await _item_by_number(update, arg)
        if not it:
            return
        if kind == "venduto":
            await api.mark_sold(it["slug"])
            await update.message.reply_text(f"✅ «{it['name']}» segnato come venduto. Resta visibile 7 giorni.")
        else:
            await api.mark_unsold(it["slug"])
            await update.message.reply_text(f"↩️ «{it['name']}» è di nuovo in vetrina.")
    except api.ApiError as e:
        await update.message.reply_text(f"❌ {e}")


@_restricted
async def cmd_prezzo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 2:
        await update.message.reply_text("Uso: /prezzo <n> <importo>   es. /prezzo 2 899   oppure   /prezzo 2 richiesta")
        return
    try:
        price = parse_price(" ".join(context.args[1:]))
    except ValueError:
        await update.message.reply_text("Prezzo non valido. Esempi: 899, 1.299, 449,50, richiesta.")
        return
    try:
        it = await _item_by_number(update, context.args[0])
        if not it:
            return
        await api.patch_item(it["slug"], {"price": price})
        await update.message.reply_text(f"💶 «{it['name']}»: nuovo prezzo {fmt_price(price)}.")
    except api.ApiError as e:
        await update.message.reply_text(f"❌ {e}")


@_restricted
async def cmd_elimina(update: Update, context: ContextTypes.DEFAULT_TYPE):
    arg = context.args[0] if context.args else ""
    try:
        it = await _item_by_number(update, arg)
    except api.ApiError as e:
        await update.message.reply_text(f"❌ {e}")
        return
    if not it:
        return
    kb = InlineKeyboardMarkup(
        [[
            InlineKeyboardButton("🗑 Sì, elimina", callback_data=f"del:{it['slug']}"),
            InlineKeyboardButton("Annulla", callback_data="del:no"),
        ]]
    )
    await update.message.reply_text(
        f"Eliminare definitivamente «{it['name']}» (foto comprese)?", reply_markup=kb
    )


@_restricted
async def on_delete_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    slug = q.data.split(":", 1)[1]
    if slug == "no":
        await q.edit_message_text("Eliminazione annullata.")
        return
    try:
        await api.delete_item(slug)
        await q.edit_message_text("🗑 Articolo eliminato e vetrina aggiornata.")
    except api.ApiError as e:
        await q.edit_message_text(f"❌ {e}")


# ---------- Conversazione /nuovo ----------

@_restricted
async def nuovo_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["new"] = {"photos": []}
    await update.message.reply_text(
        "➕ Nuovo articolo.\n\n📷 Mandami le foto (una o più, la prima sarà la copertina). "
        "Quando hai finito scrivi /fatto. /annulla per uscire."
    )
    return PHOTOS


@_restricted
async def nuovo_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message
    if msg.photo:
        file_id = msg.photo[-1].file_id  # risoluzione piu' alta
    else:  # immagine mandata come "file"
        file_id = msg.document.file_id
    photos = context.user_data["new"]["photos"]
    if len(photos) >= 10:
        await msg.reply_text("Massimo 10 foto: scrivi /fatto per continuare.")
        return PHOTOS
    photos.append(file_id)
    await msg.reply_text(f"📷 Foto {len(photos)} ricevuta. Altre foto oppure /fatto.")
    return PHOTOS


@_restricted
async def nuovo_photos_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data["new"]["photos"]:
        await update.message.reply_text("Serve almeno una foto. Mandamene una.")
        return PHOTOS
    await update.message.reply_text("Come si chiama l'articolo? (es. iPhone 15 Pro 256 GB Titanio)")
    return NAME


@_restricted
async def nuovo_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["new"]["name"] = update.message.text.strip()
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(label, callback_data=f"cat:{k}")] for k, label in CATEGORIES.items()])
    await update.message.reply_text("Categoria?", reply_markup=kb)
    return CATEGORY


@_restricted
async def nuovo_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    key = q.data.split(":", 1)[1]
    context.user_data["new"]["category"] = key
    await q.edit_message_text(f"Categoria: {CATEGORIES[key]}")
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(v[1], callback_data=f"cond:{k}")] for k, v in CONDITIONS.items()])
    await q.message.reply_text("Condizione?", reply_markup=kb)
    return CONDITION


@_restricted
async def nuovo_condition(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    key = q.data.split(":", 1)[1]
    cond, label = CONDITIONS[key]
    context.user_data["new"].update(condition=cond, conditionLabel=label)
    await q.edit_message_text(f"Condizione: {label}")
    await q.message.reply_text("Prezzo in euro? (es. 899 oppure 1.299, o scrivi «richiesta» per «su richiesta»)")
    return PRICE


@_restricted
async def nuovo_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        context.user_data["new"]["price"] = parse_price(update.message.text)
    except ValueError:
        await update.message.reply_text("Prezzo non valido. Esempi: 899, 1.299, 449,50, richiesta.")
        return PRICE
    await update.message.reply_text(
        "Note/descrizione (stato, accessori, difetti noti...). Scrivi solo fatti certi. /salta per lasciare vuoto."
    )
    return NOTES


@_restricted
async def nuovo_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["new"]["description"] = update.message.text.strip()
    return await _ask_confirm(update, context)


@_restricted
async def nuovo_skip_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["new"]["description"] = ""
    return await _ask_confirm(update, context)


async def _ask_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    d = context.user_data["new"]
    summary = (
        f"📝 Riepilogo\n"
        f"Nome: {d['name']}\n"
        f"Categoria: {CATEGORIES[d['category']]}\n"
        f"Condizione: {d['conditionLabel']}\n"
        f"Prezzo: {fmt_price(d['price'])}\n"
        f"Foto: {len(d['photos'])}\n"
        f"Note: {d['description'] or '—'}\n\nPubblico in vetrina?"
    )
    kb = InlineKeyboardMarkup(
        [[InlineKeyboardButton("✅ Pubblica", callback_data="ok:yes"), InlineKeyboardButton("✖️ Annulla", callback_data="ok:no")]]
    )
    await update.message.reply_text(summary, reply_markup=kb)
    return CONFIRM


@_restricted
async def nuovo_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    d = context.user_data.pop("new", None)
    if q.data != "ok:yes" or not d:
        await q.edit_message_text("Operazione annullata, niente è stato pubblicato.")
        return ConversationHandler.END
    await q.edit_message_text("⏳ Pubblico...")
    try:
        photos = []
        for file_id in d["photos"]:
            f = await context.bot.get_file(file_id)
            photos.append(bytes(await f.download_as_bytearray()))
        payload = {
            "name": d["name"],
            "category": d["category"],
            "condition": d["condition"],
            "conditionLabel": d["conditionLabel"],
            "price": "" if d["price"] is None else d["price"],
            "description": d["description"],
            "featured": False,
            "contact": False,
            "specs": "[]",
        }
        out = await api.create_item(payload, photos)
        await q.message.reply_text(f"✅ Pubblicato! (codice: {out.get('slug')})")
    except api.ApiError as e:
        await q.message.reply_text(f"❌ {e}")
    return ConversationHandler.END


@_restricted
async def nuovo_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.pop("new", None)
    await update.message.reply_text("Operazione annullata.")
    return ConversationHandler.END


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE):
    logger.exception("Errore non gestito", exc_info=context.error)
    if isinstance(update, Update) and update.effective_message:
        await update.effective_message.reply_text("⚠️ Si è verificato un errore imprevisto. Riprova.")


async def _post_init(app: Application):
    await app.bot.set_my_commands(BOT_COMMANDS)


def build_app() -> Application:
    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).post_init(_post_init).build()

    text = filters.TEXT & ~filters.COMMAND
    conv = ConversationHandler(
        entry_points=[CommandHandler("nuovo", nuovo_start)],
        states={
            PHOTOS: [
                MessageHandler(filters.PHOTO | filters.Document.IMAGE, nuovo_photo),
                CommandHandler("fatto", nuovo_photos_done),
            ],
            NAME: [MessageHandler(text, nuovo_name)],
            CATEGORY: [CallbackQueryHandler(nuovo_category, pattern=r"^cat:")],
            CONDITION: [CallbackQueryHandler(nuovo_condition, pattern=r"^cond:")],
            PRICE: [MessageHandler(text, nuovo_price)],
            NOTES: [MessageHandler(text, nuovo_notes), CommandHandler("salta", nuovo_skip_notes)],
            CONFIRM: [CallbackQueryHandler(nuovo_confirm, pattern=r"^ok:")],
        },
        fallbacks=[CommandHandler("annulla", nuovo_cancel)],
        allow_reentry=True,
    )
    app.add_handler(conv)
    app.add_handler(CommandHandler(["start", "help"], cmd_help))
    app.add_handler(CommandHandler("id", cmd_id))
    app.add_handler(CommandHandler("lista", cmd_lista))
    app.add_handler(CommandHandler("venduto", cmd_venduto))
    app.add_handler(CommandHandler("riattiva", cmd_riattiva))
    app.add_handler(CommandHandler("prezzo", cmd_prezzo))
    app.add_handler(CommandHandler("elimina", cmd_elimina))
    app.add_handler(CallbackQueryHandler(on_delete_button, pattern=r"^del:"))
    app.add_error_handler(on_error)
    return app
