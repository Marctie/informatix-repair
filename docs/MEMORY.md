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

## Vetrina Usati
- Pagina `/usati.html`, solo vetrina (no e-commerce, no pagamenti online): CTA "Chiedi info" e telefono. Si aggiorna modificando `content/usati/usati.json` e aggiungendo le foto in `public/images/usati/<slug>/` (poi `npm run build`).
- Regole: non inventare dati (batteria, garanzia, stato) non ricavabili da foto o note; dichiarare i difetti noti (es. schermo sostituito); non pubblicare foto con seriali/IMEI/codici a barre.
- Foto originali in `C:\Mega.nz Sync\Lavoro\Dev\Sito Informatix.it\Foto vendite usati` (con "note per la vendita.txt").
