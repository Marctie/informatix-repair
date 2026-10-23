# MEMORY – Informatix Repair

Memoria di progetto: decisioni, vincoli e visione. Va aggiornata a ogni sessione.
Il registro cronologico delle modifiche è in [CHATLOG.md](CHATLOG.md).

## Progetto
- Sito vetrina per **Informatix Repair**, negozio di riparazioni informatiche a **Nocera Superiore (SA)**.
- Dominio principale: **informatixrepair.com** (acquistato su Cloudflare). Il `.it` e il `.eu` (scaduto, ex SiteGround) sono secondari/da recuperare e reindirizzare al `.com`.
- Nota sul `.it`: ATTENZIONE: risulta già registrato e reindirizza (301) a informatixrepair.eu: verificare se è del cliente prima di acquistare.
- Stack: Vite (multi-pagina) + Tailwind 3 + JS vanilla. App Android = wrapper Capacitor (`android/`).
- Brand dal logo: nero/inchiostro, rosso `#DC2626`, bianco.

## Roadmap voluta dal proprietario
1. **Ora**: sito web pubblicabile, elegante, professionale, responsive.
2. **Poi (dopo feedback del cliente finale)**: autenticazione clienti per **tracciare lo stato di riparazioni/ordini**.
3. **Poi**: trasformare il sito in **e-commerce di usato/ricondizionato**.
4. **Poi**: usare il sito come **gestionale** (ordini, contabilità, ecc.).
5. **App Android**: rimandata. Quando sarà pronta, mettere nel sito il **link di download dell'APK** con interfaccia migliorata.
   - Nel codice è già previsto: `SITE.apkUrl` in `src/main.js`. Se vuoto la sezione "Scarica l'app" non appare; basta valorizzarlo.

## Decisioni architetturali
- Contenuti/contatti configurabili in un unico oggetto `SITE` in `src/main.js` (telefono, WhatsApp, email, orari, social, apkUrl). I campi vuoti nascondono i relativi elementi, così non compaiono mai placeholder sul sito live.
- `base` di Vite = `/` (dominio proprio, non più sottocartella GitHub Pages).
- Quando arriverà auth/e-commerce serve un backend (valutare Cloudflare Workers + D1/Supabase); il sito statico attuale non lo richiede.

## Sito bilingue IT/EN (switch lato client, stessa URL)
- Motore in `src/i18n.js`: dizionario `it`/`en` per chiave, lingua salvata in `localStorage` (`ir-lang`, default `it`), nessun cambio di URL/dominio.
- Convenzioni negli HTML: `data-i18n` (textContent), `data-i18n-html` (innerHTML, per markup inline tipo `<span class="text-secondary">`), `data-i18n-content` (attributo `content` dei meta tag), `data-i18n-attr="attr:chiave"` (attributi arbitrari come aria-label).
- Selettore lingua (bottone EN/IT) nella navbar, gestito in `src/main.js` (`setLang`/`getLang`); al cambio lingua si ri-eseguono navbar/footer/banner APK/teaser usati e si applica `applyI18n()` a tutto il documento (evento `i18n:change`).
- Per contenuto generato a build-time con variabili per-elemento (Vetrina Usati, card blog) si usa invece la coppia di attributi `data-lang-it` / `data-lang-en` con toggle via CSS (`html[lang="it"|"en"] [data-lang-en|it] { display:none }`, regola in `src/styles/main.css`). Se manca la traduzione EN, il build script fa fallback al testo IT (mai vuoto).
- **Vetrina Usati**: `content/usati/usati.json` ha ora campi `*En` opzionali per ogni articolo (`taglineEn`, `descriptionEn`, `conditionLabelEn`, `specsEn`, `colorEn`, `memoryEn`, `nameEn`). `scripts/build-usati.mjs` li usa per generare le coppie IT/EN; se un nuovo articolo non ha i campi `*En`, l'EN mostra automaticamente il testo italiano (nessun vuoto, ma va tradotto appena possibile).
- **Blog**: la "cornice" (elenco, paginazione, card, header articolo, CTA finali) è bilingue tramite `scripts/build-blog.mjs`. Il **corpo dei singoli articoli resta solo in italiano**: tradurre i 100+ articoli esistenti (e i 2/giorno che arrivano dalla routine automatica) non è stato fatto in questa sessione per ragioni di scala/qualità. Quando un utente EN apre un articolo vede un avviso "This article is currently only available in Italian." (`blog.itOnly`). Da valutare in futuro: aggiungere un secondo file markdown (`slug.en.md`) o un secondo blocco nel `.md` esistente con la traduzione, letto da `build-blog.mjs` con fallback IT se assente; oppure un job separato che traduce gli articoli passati a gruppi.
- Pagine fisse (home, chi-siamo, servizi, portfolio, contatti, privacy, 404) sono interamente tradotte (testi, meta tag, og:title/description) tramite le chiavi in `src/i18n.js`.
- Limite noto: il messaggio precompilato del form contatti (in `initContactForm`, `src/main.js`) resta in italiano indipendentemente dalla lingua attiva, perché va all'email del negozio in Italia.

## Hosting / dominio
- Il proprietario ha già un account **Cloudflare**.
- Piano: dominio `.it` acquistato presso registrar accreditato (Cloudflare Registrar potrebbe non supportare `.it`, da verificare), DNS su Cloudflare, hosting su **Cloudflare Pages**.
- Email `info@informatixrepair.it`: creare inoltrando con Cloudflare Email Routing (gratuito).

## Cose da confermare col cliente (TODO)
- Confermare col cliente i dati trovati online (tel +39 376 234 4151, Via Pecorari 178, orari, Facebook). Mancano: WhatsApp (da confermare), Instagram.
- Foto reali di negozio/team/lavori (ora foto stock Unsplash nel portfolio).
- Dati legali per Privacy/Cookie (ragione sociale, P.IVA, titolare trattamento): necessari prima del go-live per form e mappa Google.
- Servizio invio form reale (ora `mailto:`).
- L'URL di `capacitor.config.ts` punta ancora a GitHub Pages: aggiornarlo a `https://informatixrepair.com` quando il dominio è attivo.

## Blog (preset editoriale, valido anche per articoli futuri)
- File sorgente: `content/blog/AAAA-MM-GG-NNN-slug.md` (front matter: title, date, description). Lo script `scripts/build-blog.mjs` genera `blog.html`, `blog/*.html` e la sitemap a ogni `npm run build` (file generati ignorati da git).
- Argomenti: solo attualità e novità tecnologiche, verificate con ricerche web prima di scrivere.
- Categoria unica: **Tecnologia**.
- Stile: italiano naturale, nessuna emoji né simboli decorativi, niente formule da IA, articoli brevi ma completi (250-350 parole, 2-3 sottotitoli). Firma "Informatix Repair", nessun autore inventato.
- Immagini: copertine SVG originali generate dallo script (nessun copyright).
- Dati sempre attribuiti alle fonti; niente numeri non verificati.
- Workflow: commit e push ogni 5 articoli (Cloudflare Pages ripubblica).
- Obiettivo iniziale: almeno 100 articoli.
- Stato: primi 100 articoli pubblicati il 2026-09-24 (tutti con la stessa data di scrittura; per i prossimi conviene 1-2 a settimana con data reale).
- Da verificare periodicamente: articoli con date/prezzi futuri (scadenze ottobre-dicembre 2026, rumor Apple) da aggiornare quando diventano fatti.

## Routine automatica del blog
- Routine cloud di Claude Code "Informatix Repair - 2 articoli blog al giorno (9:00 e 18:00)", id `trig_01D7E1mHzN4P3ZL2JGVxrUmx`, gestibile da https://claude.ai/code/routines.
- Cron `0 7,16 * * *` (UTC) = 9:00 e 18:00 ora italiana con ora legale. **Dal 25 ottobre 2026 (ora solare) va cambiato in `0 8,17 * * *`**; a marzo 2027 tornare a `0 7,16 * * *`.
- Ogni esecuzione: cerca notizie, scrive 2 articoli con le regole del preset, fa la build, commit e push su `main` (pubblicazione diretta, senza revisione), poi tenta una notifica push. Se non trova notizie affidabili scrive meno articoli.
- Se gli articoli automatici calano di qualità, controllare le esecuzioni con list_runs/get_run_log o dalla pagina delle routine.
- **Ramo di lavoro (obbligatorio per la routine).** La sessione automatica può partire su un ramo `claude/...`, ma Cloudflare Pages pubblica **solo da `main`**: tra il 29 settembre e il 5 ottobre 4 esecuzioni (8 articoli) sono rimaste su rami mostrati come riusciti ma mai online, recuperate il 5 ottobre come articoli 136-142. Regole: (1) prima di scrivere `git fetch origin main && git checkout -B main origin/main` e lavorare su `main`, calcolando il numero NNN sui file di `main`; (2) pubblicare con `git push origin HEAD:main` (se rifiutato: `git pull --rebase origin main`, ricontrollare i numeri, rifare la build e riprovare); (3) verifica finale: dopo `git fetch origin main`, `git rev-parse HEAD` deve essere uguale a `git rev-parse origin/main`, altrimenti gli articoli non sono online e va segnalato come ERRORE nella notifica e nel messaggio finale; (4) non creare né pushare altri rami; (5) data e ora nel commit e nel CHATLOG sempre con `TZ=Europe/Rome`.

## Vetrina Usati
- Pagina `/usati.html`, solo vetrina (no e-commerce, no pagamenti online): CTA "Chiedi info" e telefono. Si aggiorna modificando `content/usati/usati.json` e aggiungendo le foto in `public/images/usati/<slug>/` (poi `npm run build`).
- Regole: non inventare dati (batteria, garanzia, stato) non ricavabili da foto o note; dichiarare i difetti noti (es. schermo sostituito); non pubblicare foto con seriali/IMEI/codici a barre.
- Foto originali in `C:\Mega.nz Sync\Lavoro\Dev\Sito Informatix.it\Foto vendite usati` (con "note per la vendita.txt").
- Flusso "venduto": un articolo marcato venduto resta in vetrina con ribbon "VENDUTO" e CTA disattivata, poi **scompare da solo dopo 7 giorni**. Nessun cron: `src/usati.js` calcola lato client a ogni caricamento pagina i giorni trascorsi da `soldAt` e rimuove la card dal DOM se ≥7. Lo stato vive nei campi `sold`/`soldAt` di ogni articolo in `usati.json`.

## ONLINE: decisioni e piano VALIDI (aggiornato 2026-10-13, sera) — ha la precedenza su tutto quanto scritto altrove
**Obiettivo**: gestionale officina raggiungibile ovunque, senza che il PC del negozio resti acceso, con tracciamento pubblico per i clienti e una sezione dedicata nel sito.
- **Autenticazione**: **Cloudflare Access** (scelta dell'utente; Firebase e login "fatto in casa" scartati). Nessuna password: codice via email (One-time PIN) o login Google. Accesso iniziale: `marcopeluso99@gmail.com`; l'email di **Christian si aggiunge per ultima** (l'utente la comunicherà).
- **Hosting**: migrazione su **Cloudflare Workers + D1 (database) + R2 (backup)**; il PC non serve più. **Piano B** se non si chiude in serata: Cloudflare Tunnel verso il PC (che deve restare acceso) + Access.
- **Indirizzi** (se Cloudflare lo consente, il dominio e' su Cloudflare): `gestionale.informatixrepair.com` (dietro Access) e `riparazioni.informatixrepair.com` (pubblico: solo tracciamento e ricerca per codice).
- **Sito principale** (su un ramo a parte, `main` solo a fine lavori): voce discreta **"Area riservata"** nel piede di pagina verso il gestionale + **sezione "Segui la tua riparazione"** in home, nel menu e in una pagina dedicata: facile anche per clienti anziani (QR con la fotocamera, oppure numero ricevuta + ultime 4 cifre del telefono, oppure chiama/WhatsApp), endpoint `POST /api/lookup`, bilingue IT/EN.
- **Regole di lavoro per la serata**: test + commit + push a ogni funzionalita; prove con hardware (pistola, stampante, etichette, fotocamera del telefono) le fa Christian; extra utili/veloci per Christian si possono aggiungere di iniziativa (registrandoli in CHATLOG/MEMORY/manuale); Cypress mai in `main`; **via libera dell'utente a toccare `main` a lavoro finito e testato**.
- **Stima (90%)**: 14-21 ore di lavoro mio, circa 17 ore attese. Suddivisione: Cloudflare/Access 0,75 h; Worker+D1 (schema, logica asincrona, QR, file statici) 4,5 h; Access nel programma + limiti tentativi + backup R2 2 h; test API e Cypress sulla nuova base 3 h; deploy e prove da telefono 1 h; sito (sezione clienti, lookup, Area riservata, test) 4 h; manuale/guide/appunti 1,5 h. Tappe proposte: stasera ~8 h (online con login + tracciamento), domani 6-8 h (sito, manuale, merge in main), poi 1-2 h (account di Christian e prove con hardware vero).
- **PUNTI ESSENZIALI (richiesti dall'utente, non saltare)**: (1) **Portale unico** dopo il login ("Area riservata"): Christian vede Officina + Vetrina usati + Manuale, azioni rapide e contatori; veloce, responsive (320-1536 px) e **accessibile** (44 px, contrasto AA, tastiera, focus, cypress-axe); la Vetrina Usati va portata nello stesso design system e sullo stesso Worker/Access. (2) **4 utenti** predisposti: tabella `users` (email, nome, ruolo admin/operatore, attivo): admin `marcopeluso99@gmail.com`, Christian, + 2 da definire; le email le manda Christian, configurazione dei login a fine serata. Aggiungere un utente in Access richiede il pannello Cloudflare (solo l'utente); Christian per entrare non ha bisogno di un account Cloudflare. Dettagli: CHATLOG "Punti ESSENZIALI aggiunti".
- **UTENTI DECISI (2026-10-13)**: Christian = amministratore e **unico** a poter fare le CRUD degli utenti; altri 3 utenti = postazioni **Cassa, Laboratorio, Vendite** (ruolo `staff`, nessuna restrizione sui moduli, ma niente pagina/API Utenti). Controllo lato Worker (403), Access su "chiunque con codice email" e il Worker decide chi entra dalla tabella `users` (middleware su tutte le rotte, file statici inclusi). Registrare l'utente su eventi/vendite/incassi ("chi ha fatto cosa"). Aperto: ruolo del proprietario `marcopeluso99@gmail.com` (admin protetto?) e email delle postazioni (alias con Cloudflare Email Routing consigliati). Dettagli: CHATLOG "Utenti decisi".
- **Utenti: creazione per fasi (2026-10-13)**: le email di Christian e delle postazioni NON sono ancora disponibili. Stasera si crea **solo il profilo del proprietario** `marcopeluso99@gmail.com` (admin, `protected=1`) per poter accedere a lavori finiti. Quando l'utente manda le email, si creano Christian (admin) e Cassa/Laboratorio/Vendite (staff): da seed o dalla pagina Utenti (in tal caso la crea Christian stesso). Nessun utente va inventato o inserito con email segnaposto.
- **Stima aggiornata**: con Portale unico, Vetrina Usati integrata e accessibilita' il totale sale a ~24-28 h (20-30 h). Priorita': 1) Access + Worker/D1 + tracciamento, 2) Portale + utenti, 3) sito (Segui la riparazione + Area riservata), 4) Vetrina Usati integrata.
- **Vetrina Usati**: corretto il difetto dei campi (padding 0 da reset Tailwind) e aggiunti i collegamenti reciproci Officina <-> Vetrina usati (soluzione ponte).
- **Questioni aperte**: email di Christian; esito delle prove hardware (pistola/stampante/etichette/fotocamera); **destino del gestionale Vetrina Usati e del bot Telegram** (oggi solo locale, senza login: portarlo sullo stesso Worker dietro Access, oppure lasciarlo com'e'); eventuale pulizia dei 19 rami remoti `claude/upbeat-fermi-*` (residui della routine blog); cambio orario UTC della routine blog il 25 ottobre.
- Dettagli tecnici e passi in ordine: CHATLOG, sezioni "piano della serata" e "Appunti: migrazione su Cloudflare".
- **Monitoraggio (2026-10-15)**: il bot Termux sul Samsung (v2, `termux-bot/`) legge `GET https://riparazioni.informatixrepair.com/api/monitor` con il segreto `MONITOR_TOKEN` (Worker + `.env` del bot; senza chiave giusta = 404) e manda: avvisi (servizi giu'/lenti, Vetrina non allineata col sito, backup mancante, dati non leggibili), Buongiorno ogni giorno 8:30, riepilogo 21:00. La Vetrina sul sito si conta con `count` di `/usati.json` (gli `items` sono solo i 3 in evidenza della home). Le notifiche del Worker (`notify.mjs`) usano i dati veri (letture dal DB prima e dopo l'azione) e arrivano senza suono per le operazioni minori. I codici R-/V- si calcolano dal numero piu' alto (mai dal conteggio: le eliminazioni lo rompono).

## Direttive di lavoro (utente, 2026-10-13)
- Commit + push dopo ogni funzionalità completata e testata; tracciare su CHATLOG e MEMORY ogni aggiunta/modifica/eliminazione.
- **Regola ferma (2026-10-18)**: ogni correzione o aggiunta al gestionale va riportata anche negli avvisi Telegram (`notify.mjs` + test), nel bot di controllo Termux se rilevante e nella documentazione (manuale, CHATLOG, MEMORY, PARTI-DA-QUI). Fatto per: categorie del magazzino (schermata + `/api/categories`, migrazione 0037), anagrafica fornitore estesa con agenti (0036), carico merce con categoria e fornitore facoltativo, fix D1 «LIKE pattern too complex» (`db-d1.mjs`).
- Cypress (se serve) su branch dedicato sempre vivo, solo per i test; merge in main solo del codice testato.
- Gestionale: per ora locale e **senza autenticazione** (login rimosso il 2026-10-13). ~~poi auth con il Firebase dell'utente~~ **SUPERATO**: l'autenticazione sarà Cloudflare Access (vedi sezione ONLINE sopra).
- Bot Telegram: scrivere il codice ma non installarlo/testarlo finché l'utente non ha il telefono e lo chiede. Bot di esempio: `C:\1Marco Peluso\Lavoro da eliminare\Bot Telegram`.

## Gestionale Officina (branch `gestionale-officina`, richiesto il 2026-10-13)
- Cartella `officina/` (README dentro): riparazioni, clienti, magazzino, vendite, fornitori, cassa + tracciamento cliente via QR/link. Express 5 + `node:sqlite`, DB in `officina/data/officina.db` (non in git). Gestionale su 127.0.0.1:4950 (nessun login per ora), tracciamento su 0.0.0.0:4951 (`/t/<token>`).
- Regola guida: **Christian ha poco tempo, quindi tutto a pochi click** (scelte rapide, pulsante "prossimo stato", WhatsApp precompilato, QR subito all'accettazione).
- Privacy: PIN di sblocco e note interne mai nella vista cliente; telefono ed email mascherati. Il cliente può approvare o rifiutare il preventivo dal link.
- Documenti non fiscali. Messa online e autenticazione: **Cloudflare Access + Workers/D1** (vedi sezione ONLINE). Test: `npm run test:officina` (API) e `npm run test:e2e` (Cypress, solo branch `cypress-tests`, mai su main).
- Dettagli e cronologia: CHATLOG, sessione 2026-10-13 (2).
- **Aggiornamento 2026-10-13 (sera)**: revisione completa fatta (date locali, validazioni, telefono normalizzato, backup, KPI), interfaccia responsive per telefono/tablet/desktop, ricerca globale e scorciatoie, manuale per Christian in `officina/public/manuale.html` (con schermate generate da Cypress), avvio con `AVVIA-OFFICINA.bat`. **Nessun merge in main finché l'utente non lo dice.** Cypress: 53 test verdi su `cypress-tests` (un DB nuovo per file).
- **Stampa rapida (2026-10-13 sera)**: "🖨️ Salva e stampa" produce scheda cliente (QR, senza PIN) + scheda laboratorio (PIN, checklist ingresso/collaudo, diagnosi, ricambi). Nuovo campo `urgent` e note del tecnico. Autenticazione e messa online: da discutere con l'utente.
- **Lettore codici a barre (2026-10-13 sera)**: pistola USB = tastiera veloce + Invio, riconosciuta lato client (`isScanEnter`); seriale/IMEI con controllo Luhn e avviso "già in archivio"; Code128 su etichetta e scheda lab; scansione a pagina libera apre la riparazione. Fotocamera (`scan.js`) solo dopo messa online in https (non testata con camera reale).
- **Regola grafica (2026-10-13 sera)**: CSS pulito e responsive. Usare solo il sistema di spaziatura di `officina/public/index.html` (`sec`, `fgrid`, `field`, `kv`, `cols`, `row`, `plist`, `tl`…), mai margini a caso. Prima di consegnare una schermata: guardare gli screenshot a telefono/tablet/desktop e far girare `cypress/e2e/ui-review.cy.js` (controllo automatico di sovrapposizioni, overflow, campi troppo piccoli). Su telefono magazzino e cassa sono elenchi a schede, non tabelle.
- **[SUPERATO dalla sezione ONLINE] PIANO SERA (2026-10-13): Access + Tunnel** — il Tunnel e' ora solo il piano B; il piano principale e' la migrazione su Workers+D1 (PC non necessario). Piano completo, domande da chiarire e rischi nel CHATLOG, sezione "Riepilogo generale e piano della serata". Nessun merge in main senza via libera dell'utente (il link per Christian nel sito pubblico tocca `main`).
- **Regole confermate per la serata (2026-10-13)**: test + commit + push a ogni funzionalita; prove con hardware (pistola, stampante, etichette, fotocamera) le fa Christian; extra utili e veloci per Christian si possono aggiungere di iniziativa (da registrare in CHATLOG/MEMORY/manuale); link "Area riservata" nel piede di pagina del sito; partenza dal punto 1 (Cloudflare/Access) con email `marcopeluso99@gmail.com`, Christian per ultimo; `main` solo a lavoro finito e testato (Cypress mai in main).
- **AGGIORNAMENTO piano sera**: l'utente vuole applicare stasera la **migrazione su Cloudflare Workers + D1 + Access** (PC non piu' necessario; Tunnel = piano B) e una **sezione nel sito principale "Segui la tua riparazione"** facile anche per clienti anziani (QR, oppure numero ricevuta + ultime 4 cifre del telefono, chiama/WhatsApp; endpoint `/api/lookup`; ramo a parte, `main` solo con via libera). Host: `gestionale.informatixrepair.com` (Access) e `riparazioni.informatixrepair.com` (pubblico). Dettagli nel CHATLOG, sezione "Appunti: migrazione su Cloudflare".
- **Causa dei campi "attaccati" (2026-10-13)**: il reset di Tailwind CDN (iniettato dopo il nostro CSS) azzerava padding/font dei campi; i controlli di input/select/textarea in `index.html` usano `html body input…` per vincere sempre. Non togliere quel prefisso. Icone: emoji sostituite da SVG in automatico (`icons.js`). Su telefono il pulsante Nuova sta al centro della barra inferiore (`#nav-new`).

## Gestionale Usati (pannello admin) — in evoluzione, vedi CHATLOG 2026-09-27 (sera)
- **Stato 2026-10-13**: pannello locale senza login (127.0.0.1:4848) funzionante; bot Telegram scritto in `bot/` (vedi `bot/README.md`) e testato solo con Update simulati, non su Telegram reale né installato. API del gestionale: GET/POST `/api/items`, PUT/PATCH/DELETE `/api/items/:slug`, POST `/api/items/:slug/sold|unsold`.
- **Prototipo locale (esistente, funzionante)**: cartella `admin/` (Express + Multer + Sharp, `npm run admin` → porta 4848). Fa CRUD su `usati.json` + foto, rigenera `usati.html` a ogni salvataggio, login email/password locale (`express-session`, credenziali in `admin/auth.local.json`, generato al primo avvio, **escluso da git** — riga esplicita `/admin/auth.local.json` in `.gitignore`, il pattern generico `*.local` NON basta perché non matcha `nome.local.json`). Commit locali `77c9b79` e `861568d` su `main`, **non pushati** (l'utente ha chiesto di non pubblicarli finché non si decide l'architettura definitiva).
- **Stile approvato dall'utente ("mi piace un sacco", 2026-09-27)**: form a sezioni con titolo+icona, header/footer della modale fissi con corpo scrollabile, modale a schermo intero su mobile, checkbox come "pillole" cliccabili, card con badge di stato sovrapposto alla foto, tab stile segmented-control. **Prendere questo stile come riferimento per qualsiasi futura pagina interna del sito**, non solo per gli usati.
- **[SUPERATA il 2026-10-13 dalla sezione ONLINE: ora Cloudflare Access, non piu' login custom; storage su D1/R2 per il gestionale officina; per la Vetrina Usati la decisione e' ancora da prendere]** Decisione architetturale per la versione online (2026-09-27 sera, dopo discussione sul rischio di esporre un URL admin non protetto a "smanettoni"):
  1. **Repo dedicato nuovo**, separato dal repo del sito pubblico (che resta statico, senza segreti/backend).
  2. **Backend su Cloudflare Worker** (non più Express locale), raggiungibile online.
  3. **Login: email+password custom** verificato dal Worker (scelta esplicita dell'utente, alternativa Cloudflare Access scartata).
  4. **Storage: il Worker scrive direttamente su GitHub** (Contents API) nel repo del sito pubblico — ogni salvataggio è un commit vero, Cloudflare Pages ripubblica da sola. Scartato un database nuovo (D1/R2) per non introdurre infrastruttura aggiuntiva ora.
  5. Conseguenza tecnica: i Worker non eseguono `sharp` (codice nativo) → ridimensionare le foto **lato client (browser)** prima dell'upload, sia da web che dal bot.
  6. **Bot Telegram** per CRUD rapide (Christian scrive/manda foto in chat), stesso backend/API del Worker — non una logica duplicata.
- **Bot Telegram — ricognizione sull'ecosistema esistente** (`C:\Mega.nz Sync\Lavoro\Dev\Bot Telegram`): i bot usano **python-telegram-bot v21.x** (non aiogram). I bot "Vinted" esistenti (`Vinted-Bot-Telegram`, `Bot Vinted multiaccount`) NON pubblicano annunci con foto: sono bot di **monitoraggio/scraping** (stato venduto/riservato) che inviano foto solo in uscita (estratte da email via IMAP). La parte "ricevi foto da un utente" va scritta da zero (standard PTB: `filters.PHOTO`, `get_file`/`download_to_drive`, nessun rischio tecnico). Pattern da riusare: `ConversationHandler` multi-step in `Vinted-MultiMail-Bot/src/bot.py` (righe 646-676) come calco per il flusso guidato foto→nome→prezzo→note→conferma; `SabbaGambaBot-Telegram` (bot.py+db.py) per comandi semplici + SQLite + autorizzazione per singola chat (`CHAT_ID_AUTORIZZATE`), utile per limitare il bot alla sola chat di Christian. Deploy: si aggiunge alla flotta con una riga in `Termux-Launcher/bots.conf` (nessuna modifica agli script), gira su un Samsung via Termux con doppio watchdog e boot automatico. `Dashboard-Windows` è solo per Windows, nessuna API esterna riusabile.
- **Piano per la prossima sessione (dettato dall'utente il 2026-09-27 sera)**: ripassare insieme questa decisione, poi procedere con lo sviluppo vero (nuovo repo, Worker, login, bot compreso). **Non installare il bot sul telefono Samsung finché l'utente non lo chiede esplicitamente** (il giorno dopo non avrà il telefono con sé) — l'installazione avverrà quando sarà a casa col Samsung collegato via **ADB**.

## Etichette prodotto e codici a barre (2026-10-19)
- Template di etichetta gestiti da **Impostazioni → Etichette prodotto** (misura, elementi trascinabili, logo in solo nero, rotolo o foglio A4); stampa da Magazzino → Etichette, scheda articolo, carico merce. Codice a barre dell'articolo in `products.barcode` (EAN del produttore, altrimenti codice interno EAN-13 `2`+id+controllo assegnato alla prima stampa). In cassa la pistola trova l'articolo da barcode/SKU/codice fornitore/codice interno (`GET /api/products/by-code/:code`); lo scarico resta all'incasso. Migrazione 0038. Dettagli: CHATLOG 2026-10-19; manuale sez. 45.
- Prove hardware di Christian ancora da fare (stampante etichette, pistola): TEST-DI-CHRISTIAN sez. H.

## Confronto con altri gestionali (2026-10-19)
- Report in `docs/CONFRONTO-GESTIONALI.md`: Fix-Book (mattina) ed e-Share (www.e-share.me, e-Pol SRL Piacenza, sera). Da consultare quando Christian chiede modifiche, per prendere spunto. Idee non ancora decise: IVA a margine + permuta usato, proposta d'ordine calcolata, invio ricevuta/OTP via WhatsApp, differenze ordine/arrivo, tecnico assegnato, multi-negozio. Fonte solo sito pubblico (testo in gran parte immagini, niente prezzi).
- Confronto Fixh IT (fixh.it, 19/10 sera): in `docs/CONFRONTO-GESTIONALI.md` sez. 3, con piani e prezzi (9,99 / 24,99 / 59,99 EUR al mese, fattura SdI 0,15 EUR). Nuove idee: estensione garanzia/assicurazione, listino pubblico riparazioni, pagamento online, scarico documenti dal portale, stampa diretta, API/SdI per versione vendibile.
- PDF riassuntivo dei 3 confronti: docs/CONFRONTO-GESTIONALI.pdf (matrice funzioni + differenze).

## Sicurezza del sito (2026-10-23)
- Il log Cloudflare mostra solo scansioni automatiche respinte (404/403). Aggiunto `public/_headers` in `main` (nosniff, frame, referrer, permissions, HSTS, COOP). Restano da fare: WAF/Bot Fight Mode e regola di blocco percorsi nel pannello Cloudflare (Marco), eventuale CSP e controllo header del Worker (Claude). Dettagli: CHATLOG 2026-10-23.

## Preventivi: IVA inclusa/esclusa e permuta (2026-10-23)
- Christian puo' scrivere i prezzi dei preventivi IVA inclusa (come sempre) o IVA esclusa (l'IVA si somma al totale); la **permuta** (descrizione + valore) si scala dal totale IVA compresa ("da pagare"). Il totale che paga il cliente e' sempre IVA compresa: incassi/fatture invariati. Dati in `quotes` (`vat_mode`, `vat_rate`, `tradein_*`), `repairs` (`quote_vat_mode`, `quote_vat_rate`, `quote_net`), `quote_options` (`amount_net`, `vat_rate`): migrazione 0039. Non incluso: ricambi/vendite/fatture, aliquota per voce. Dettagli: CHATLOG 2026-10-23, manuale sez. 46.
