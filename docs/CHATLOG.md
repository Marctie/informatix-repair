# CHATLOG – Informatix Repair

Registro delle sessioni di lavoro: cosa è stato **aggiunto**, **modificato** e **rimosso**.

---

## Sessione 2026-09-24 – Da vetrina a sito pubblicabile

### Richiesta
- Trasformare il progetto in un sito a tutti gli effetti, da pubblicare su `informatixrepair.it`.
- Migliorare al massimo stile, eleganza, professionalità e responsività.
- Applicazione Android rimandata; in futuro link APK nel sito.
- Visione futura: auth clienti (tracking riparazioni), e-commerce usato/ricondizionato, gestionale (vedi MEMORY.md).
- Scelta hosting: proposto Cloudflare (account già esistente).

### Discussione hosting
- Consiglio: Cloudflare Pages per hosting (gratuito, CDN, HTTPS, deploy da GitHub) + DNS Cloudflare.
- Attenzione: Cloudflare Registrar probabilmente non vende domini `.it` → registrare il dominio presso un registrar `.it` (es. Aruba, Register.it, Namecheap) e delegare i nameserver a Cloudflare. Per i `.it` servono dati anagrafici di un soggetto residente in UE/Italia (CF o P.IVA).

### Modifiche (aggiornato man mano)

#### Aggiunto
- `docs/CHATLOG.md`, `docs/MEMORY.md` (questi file).
- `404.html` (pagina errore brandizzata, `noindex`).
- `public/robots.txt`, `public/sitemap.xml` (dominio `informatixrepair.it`).
- Meta SEO su tutte le pagine: canonical, Open Graph, Twitter card, theme-color; JSON-LD `ComputerStore` in home.
- Design system in `main.css`: `.container-x`, `.section`, `.btn*`, `.eyebrow`, `.card`, `.icon-box`, `.field`, `.filter-btn`, `.hero-bg`, `.grid-pattern`, animazione `.reveal` (rispetta `prefers-reduced-motion`).
- Colori Tailwind `ink`, `secondary.dark/light`, `line`; ombre `soft/lift/glow`; animazione `floaty`.
- `src/main.js`: oggetto `SITE` (config contatti), set di icone SVG inline (`<i data-icon>`), header sticky con blur/ombra allo scroll, menu mobile animato e accessibile (aria-expanded, chiusura al click), skip-link, footer a 4 colonne con social condizionali, reveal allo scroll, banner APK condizionale (`SITE.apkUrl`), form contatti che compone un `mailto:` con oggetto/corpo.
- Home: hero scuro con badge, trust list, sezione "Perché sceglierci", sezione processo in 4 passi, CTA finale. Servizi/Chi siamo/Portfolio/Contatti: header di pagina uniforme, icone, CTA finale.
- Contatti: campo telefono facoltativo e select "Di cosa hai bisogno?".

#### Modificato
- `vite.config.js`: `base` da `/informatix-repair/` a `/` (dominio proprio); aggiunto `404.html` agli input.
- Link interni resi assoluti (`/servizi.html`, ecc.); logo navbar ora locale (`/images/Informatix-logo.png`) invece dell'URL GitHub Pages.
- Font caricati con `<link preconnect>` invece di `@import` CSS (più veloci); Poppins fino al peso 800.
- Email di contatto: `info@informatix-repair.it` → `info@informatixrepair.it` (coerente col dominio; la casella va creata).
- CAP: `84019` → `84015` (CAP corretto di Nocera Superiore).
- Filtri portfolio: da classi Tailwind manipolate via JS a `aria-pressed` + attributo `hidden`.
- Mappa Google: query per nome comune invece di coordinate fisse.

#### Rimosso
- Tutti i placeholder visibili `[DA CONFERMARE]` / `[DA VERIFICARE]` e i link finti `tel:+390000000000` / `wa.me/390000000000`: telefono e WhatsApp ora compaiono solo se valorizzati in `SITE`.
- `form action="mailto:..." enctype="text/plain"` (sostituito da handler JS).
- Classi `.nav-link` / `.service-card` / `.btn-*` vecchie in `main.css` (riscritte).

#### Verifica
- `npm run build` OK (6 pagine). Screenshot desktop home controllato.

#### Da fare / aperto
- Scegliere registrar e acquistare il dominio; poi collegare Cloudflare Pages.
- Inserire telefono/WhatsApp/orari reali in `SITE`.
- Privacy/Cookie policy (mappa Google + form) prima del go-live.
- Aggiornare `capacitor.config.ts` a dominio definitivo.

### Recupero dati online (stessa sessione)
- Fonte: scheda su oraridiapertura24.it (unica fonte trovata; non verificata dal cliente).
- Inseriti: indirizzo **Via Pecorari 178, 84015 Nocera Superiore**, tel **+39 376 234 4151**, orari **Lun–Ven 9:00–13:30 e 16:00–19:30, Sab 9:00–12:30, Dom chiuso**, Facebook `facebook.com/informatixrepair`; telefono e indirizzo anche nel JSON-LD della home.
- Modificati `src/main.js` (SITE), `contatti.html`, `index.html`.
- Scoperta: `informatixrepair.it` è già registrato e fa 301 verso `informatixrepair.eu` (sito non leggibile, 403). Da chiarire con il cliente chi ne è titolare.
- Ancora mancanti: Instagram, conferma WhatsApp (il 376 potrebbe esserlo), dati legali (ragione sociale, P.IVA), foto reali.

### Dominio principale = informatixrepair.com
- Acquistato `informatixrepair.com` su Cloudflare Registrar dal proprietario.
- Sostituito `https://informatixrepair.it` → `https://informatixrepair.com` in canonical, Open Graph, JSON-LD, `robots.txt`, `sitemap.xml`, `SITE.url`.
- Email di contatto lasciata `info@informatixrepair.it` (già usata pubblicamente): da decidere se passare a `info@informatixrepair.com` con Cloudflare Email Routing.

### Deploy su Cloudflare Pages
- Login wrangler (OAuth) riuscito al secondo tentativo.
- Creato progetto Pages `informatix-repair` (con `--force`, perché la creazione automatica richiede Vite >= 6; il progetto usa Vite 5.4). Deploy manuale: `npm run build && npx wrangler pages deploy dist --project-name informatix-repair --branch main` (senza `--force`).
- Sito online su https://informatix-repair.pages.dev (HTTP 200).
- Domini `informatixrepair.com` e `www.informatixrepair.com` collegati al progetto via API, stato `pending`: mancano i record DNS CNAME (`@` e `www` → `informatix-repair.pages.dev`, proxied), il token wrangler non ha permesso di scrittura DNS.

- Workflow GitHub Pages (`.github/workflows/deploy.yml`) limitato a `workflow_dispatch`: la produzione è su Cloudflare e con `base: '/'` la copia su github.io sarebbe rotta.
- Il proprietario ha aggiunto i CNAME `@` e `www` → `informatix-repair.pages.dev` (proxied) su Cloudflare DNS.
- Collegamento automatico repo → Pages (deploy a ogni push) NON fatto: richiede l'autorizzazione dell'app GitHub dalla dashboard Cloudflare, non eseguibile da CLI. Da fare a mano (Workers & Pages → informatix-repair → Settings → Connect to Git) oppure via GitHub Action con API token.

## Riepilogo sessione 2026-09-24
1. Recuperato il contesto e creati `docs/CHATLOG.md` e `docs/MEMORY.md`.
2. Redesign completo (design system Tailwind, header/menu mobile, hero, icone, animazioni, SEO, 404, robots, sitemap).
3. Rimossi placeholder; dati reali recuperati online (indirizzo, telefono, orari, Facebook).
4. Domini: `.it` già registrato (redirect a `.eu` scaduto, ex SiteGround); acquistato `informatixrepair.com` su Cloudflare come principale.
5. Deploy su Cloudflare Pages (`informatix-repair`), custom domain collegato, DNS impostato.
6. Commit e push su GitHub `Marctie/informatix-repair`.

## Sessione 2026-09-24 (pomeriggio) – Privacy e conformità
- Il repo è collegato a Cloudflare Pages dal proprietario (deploy automatico a ogni push su `main`).
- Il `.it` lo gestirà **Christian** (il cliente): da coordinare con lui il redirect verso il `.com`.
- WhatsApp e social mancanti: rimandati, non richiesti per ora.
- **Aggiunto** `privacy.html` (informativa GDPR generica, titolare = Informatix Repair; P.IVA/telefono compaiono solo se valorizzati in `SITE`). Link nel footer, voce nella sitemap e in `vite.config.js`. È un modello: farla rivedere/validare dal cliente.
- **Modificato** font: self-hosted con `@fontsource/inter` e `@fontsource/poppins` (nessuna chiamata a Google Fonts, meglio per privacy e prestazioni). Rimossi i `<link>` a fonts.googleapis/gstatic da tutte le pagine.
- **Modificato** mappa in Contatti: ora si carica solo al click su "Carica la mappa" (nessun tracciamento Google preventivo) e punta a Via Pecorari 178.
- **Aggiunto** in `SITE`: `legalName` e `vat` (vuoti, da compilare col cliente).
- Foto reali: non generabili da me (nessuno strumento di generazione immagini; inoltre foto finte di negozio/lavori sarebbero ingannevoli). Servono foto vere del negozio e dei lavori.

## Blog
- Aggiunto sistema blog statico: `scripts/build-blog.mjs`, `content/blog/`, voce "Blog" nel menu, elenco paginato (12 per pagina), articoli con JSON-LD `BlogPosting`, copertine SVG originali, sitemap generata.
- `npm run build` e `npm run dev` ora eseguono prima lo script del blog; `vite.config.js` include le pagine generate; `tailwind.config.js` scansiona `blog/`.
- Corretto il deploy Cloudflare: la directory di output nelle impostazioni Pages era `dist/cloudflare`, portata a `dist` (le build da Git fallivano).
- Preset editoriale salvato in `docs/MEMORY.md`.
- Articoli 1-5 (2026-09-24): fine ESU Windows 10, Windows 11 26H2, crisi RAM, iPhone 18 Pro, Android 17.
- Articoli 6-10: violazione Bouygues Telecom, AI Act (trasparenza), passkey, batterie sostituibili UE 2027, Pixel 11.
- Articoli 11-15: Snap Specs, prezzo Switch 2 e memorie, Wi-Fi 7/8, robotaxi, computer quantistici.
- Articoli 16-20: Starlink e Fastweb, Galaxy Z Fold 8 e Flip 8, browser con agenti IA, prezzi SSD, NIS2 Italia.
- Articoli 21-25: iOS 27, rincari schede video e RTX 50 Super, zero-day Chrome, guasti cloud, robot umanoidi.
- Articoli 26-30: SMS falsi Agenzia delle Entrate, IT Wallet ed EUDI, portatili Core Ultra serie 3, Copilot ridimensionato, WhatsApp.
- Articoli 31-35: Apple Watch e AirPods, GPT-6 Astra, power bank in aereo, Steam Machine, Google Home Speaker.
- Articoli 36-40: Manifest V3 e blocchi pubblicitari, fibra e connessione di casa, Patch Tuesday di settembre, Mac mini M6, voci clonate con IA.
- Articoli 41-45: diritto alla riparazione (decreto italiano), Cyber Resilience Act, GTA 6, eSIM, Tesla FSD in Europa.
- Articoli 46-50: Meta Ray-Ban Display in Italia, Googlebook e Aluminium OS, Artemis II, batterie al silicio-carbonio, ransomware di agosto.
- Articoli 51-55: mercato smartphone Q2 2026, PC piu cari e rinnovo Windows 10, USB-C sui portatili, fine supporto Office 2021, Linux su Steam.
- Articoli 56-60: iPhone pieghevole, SpaceX e Starlink, difese antitruffa di Android 17, data center in Italia, gestori di password.
- Articoli 61-65: boom dei ricondizionati, EU Kids Act, batterie al litio e sicurezza, ChatGPT con pubblicita e nuovi prezzi, 6G.
- Articoli 66-70: aggiornamento Windows 11 di settembre, meno clic dai risultati Google con IA, pressione dal polso, rincaro PS5, Siri IA non in Italia (corretto anche l'articolo su iOS 27).
- Articoli 71-75: smontaggio iFixit di iPhone 18 Pro, rincari Raspberry Pi, Chat Control, Fairphone 6 Plus, IA in locale sul PC.
- Articoli 76-80: SPID e CIE, euro digitale, Amazon Leo, tracciamento ACR delle smart TV, Meta Muse.
- Articoli 81-85: certificati Secure Boot scaduti, macOS 27 senza Mac Intel, WhatsApp su vecchi telefoni, iOS 27 e batteria, One UI 9.
- Articoli 86-90: lancio dei Googlebook, Micron chiude Crucial, Black Friday 2026 e memorie, account locale in Windows 11, GPT-6 Sol e Luna.
- Articoli 91-95: stop USA ai router esteri, IFA 2026, Snapdragon 8 Elite Gen 6, Firefox 148 con interruttore IA, auto elettriche in Italia.
- Articoli 96-100: aggiornamenti estesi Windows 10, Apple a ottobre (indiscrezioni), recensioni Pixel 11 Pro Fold, riepilogo di settembre, calendario delle scadenze. Totale: 100 articoli.

### Riepilogo blog e deploy (chiusura sessione 2026-09-24/25)
- **Articoli:** 100 pubblicati (file `content/blog/2026-09-24-NNN-*.md`), categoria unica "Tecnologia", firma "Informatix Repair", stile senza emoji né simboli, circa 300 parole ciascuno (controllato con script). Tutti datati 2026-09-24.
- **Lavoro per gruppi:** 20 commit da 5 articoli, ciascuno con build di verifica e push tramite `scripts/publish-batch.sh`.
- **Fonti:** ogni argomento cercato sul web prima della scrittura; cifre attribuite alle fonti; affermazioni incerte attenuate.
- **Correzioni fatte in corsa:** articolo iOS 27 (la nuova Siri IA non è disponibile in Italia/UE al lancio); articolo browser con agenti IA (Firefox ha già rilasciato l'interruttore IA con la 148); rimosse frasi in prima persona e affermazioni non supportate dalle fonti (es. ente sanitario colpito da ransomware, rinvio IA di settore).
- **Fix deploy Cloudflare:** le build da Git fallivano perché la directory di output era `dist/cloudflare`; impostata a `dist` via API. Il deploy automatico da GitHub ora funziona.
- **Verifiche online:** privacy policy raggiungibile (308 verso l'URL senza `.html`), blog e pagina 9 dell'elenco a 200, sitemap con 115 URL.
- **Struttura generata:** `blog.html`, `blog/pagina-N.html` (12 articoli per pagina, 9 pagine), `blog/<slug>.html`, `public/sitemap.xml`; ignorati da git e rigenerati a ogni `npm run build`.

### Da fare (aperto)
- Dati legali per la privacy (ragione sociale, P.IVA) da chiedere a Christian; foto reali del negozio e dei lavori.
- Redirect di `informatixrepair.it` e `.eu` verso il `.com` (il `.it` lo gestisce Christian).
- Decidere se usare `info@informatixrepair.com` (Cloudflare Email Routing).
- Nuovi articoli: 1-2 a settimana con data reale; aggiornare quelli con scadenze future (13 ottobre, 6 ottobre, 31 ottobre, rumor Apple).
- Canonical delle pagine con `.html` mentre Cloudflare serve gli indirizzi senza estensione: valutare l'allineamento.
- Aggiornare `capacitor.config.ts` al dominio `.com` quando si lavorerà sull'app.

## Sessione 2026-09-25 – Notizie del giorno
- Nuovi articoli 101-105 (data 2026-09-25): agente OpenAI e portale Medicare australiano, Meta Connect 2026, inchiesta sui televisori LG, falle Roundcube sfruttate, iPhone Duo (prenotazioni dal 16 ottobre).
- **Correzione:** l'articolo 056 (iPhone pieghevole) riportava indiscrezioni (7,8 pollici, Touch ID, prezzo stimato). Riscritto con i dati ufficiali di Apple: iPhone Duo, schermi 5,4 e 7,6 pollici, da 1.999 dollari, prenotazioni 16 ottobre, vendita 23 ottobre.
- Articolo 100 (calendario scadenze) aggiornato con le date dell'iPhone Duo.
- Fonti: CNBC, ABC, CNN, Al Jazeera (caso Medicare); Tom's Guide, Engadget (Meta Connect); Gamers Nexus, Malwarebytes (LG); SecurityWeek, CISA (Roundcube); MacRumors, Apple (iPhone Duo).

### Routine automatica (2026-09-25)
- Creata la routine cloud per scrivere e pubblicare 2 articoli al giorno alle 9:00 e alle 18:00 (Europe/Rome), pubblicazione diretta su `main`, modello Claude Sonnet 5, notifica push finale (da verificare che arrivi).
- GitHub collegato all'account Claude dal proprietario. Prima esecuzione prevista alle 18:06 del 25 settembre.
- Promemoria: cambiare l'orario UTC della routine al passaggio all'ora solare (25 ottobre).

### Chiusura sessione (2026-09-25)
- Stato finale: sito online su informatixrepair.com, blog con 105 articoli, privacy policy, deploy automatico da GitHub su Cloudflare Pages.
- Routine di pubblicazione attiva (9:00 e 18:00), prima esecuzione alle 18:06 del 25 settembre: da controllare esito, articoli pubblicati e ricezione della notifica push.
- Da fare alla prossima sessione: verificare la prima esecuzione della routine; cambiare l'orario UTC il 25 ottobre; dati legali e foto reali da Christian; redirect di `.it` ed `.eu`; scelta email `.com`.

## Routine automatica

- **2026-09-26 21:11** – Articoli 106-107: "Falso rimborso INPS, PEC compromesse e il malware MintsLoader" (bollettino CERT-AGID 20-26 settembre); "Google porta i chip per l'intelligenza artificiale nello spazio" (progetto Suncatcher, lancio TPU su Transporter-18 di SpaceX).

## Sessione 2026-09-26 – Routine blog e Vetrina Usati
- **Routine blog:** non pubblicava perché la GitHub App di Claude non aveva accesso in scrittura al repo (push 403); l'esecuzione risultava comunque "succeeded". Dopo la riconnessione di GitHub un'esecuzione manuale ha pubblicato correttamente (commit `c4445df`, articoli 106-107). Gli articoli scritti alle 18:06 (Chat Control, Chrome 154) sono andati persi.
- **Aggiunta la Vetrina Usati** (`/usati.html`), solo vetrina: nessun carrello, il cliente è invitato a passare in negozio.
  - Dati in `content/usati/usati.json` (nome, memoria, colore, prezzo, stato, batteria, scheda tecnica, numero di foto). Foto in `public/images/usati/<slug>/N.jpg` con miniature `N-t.jpg`.
  - `scripts/build-usati.mjs` genera `usati.html` e `public/usati.json` (entrambi ignorati da git); eseguito da `npm run build` e `npm run dev`.
  - `src/usati.js`: galleria con miniature, lightbox (tastiera e swipe), filtri (Tutti / Nuovi sigillati / Usati / Fino a 500 €), indicatore "Aperto ora / Chiuso, riapre..." calcolato sugli orari in ora di Roma.
  - Pulsante "Chiedi info" verso `/contatti.html?prodotto=...&prezzo=...`: il modulo si precompila (servizio "Vetrina Usati" e messaggio); pulsante telefono da `SITE.phone`.
  - Box "Vetrina Usati" in home (3 in evidenza), voce "Vetrina Usati" nel menu, URL in sitemap, JSON-LD `ItemList`/`Product`.
- Dispositivi: iPhone 17 Pro Max 512 GB Argento (nuovo sigillato, 1.500 €), 17 Pro Max 256 GB Pacific Blue (1.150 €, senza foto), 16 Pro Max 256 GB Desert (750 €), 16 Pro 256 GB Bianco (700 €), 15 128 GB Giallo (500 €), 13 mini 128 GB Rosa (300 €), 11 Pro 256 GB Bianco (220 €).
- Dati letti dalle foto: batteria e cicli (16 Pro Max 90% / 792; 16 Pro 92% / 526; 13 mini 100%), iOS 26.5.2. Sul 13 mini iOS segnala lo schermo come "parte usata": scritto chiaramente nella scheda.
- **Privacy:** non pubblicate le foto con seriali, IMEI, indirizzi MAC e codici a barre (schermata Info del 16 Pro Max, Info del 13 mini, retro della scatola del 17 Pro Max).
- **Non pubblicati** (foto presenti ma senza prezzo nel file note): AirPods 4 con cancellazione del rumore, Redmi Note 15 Pro 5G 8/256, Galaxy Tab A11+ 5G, MacBook Air 13" (A2179), gioco PS5 EA FC27. Da aggiungere in `usati.json` se in vendita.
- Da fare: foto e stato batteria del 17 Pro Max Pacific Blue; conferma stato reale dei dispositivi; colore/nome esatti (11 Pro "Bianco", 17 Pro Max "Pacific Blue" come da note).

### Chiusura sessione (2026-09-26)
- Vetrina Usati verificata in locale (desktop, mobile, home, modulo contatti). Bug trovato dall'utente e corretto: i filtri non nascondevano le schede perché la classe `flex` sovrascriveva l'attributo `hidden`; aggiunta in `main.css` la regola `[hidden] { display: none !important; }` e verificato con test automatico (Tutti 7, Nuovi 1, Usati 6, Fino a 500 € 3).
- Commit e push su `main` con deploy automatico su Cloudflare Pages.
- Da fare alla prossima sessione: foto e stato batteria del 17 Pro Max Pacific Blue; prezzi degli altri articoli fotografati (AirPods 4, Redmi Note 15 Pro, Galaxy Tab A11+, MacBook Air 13", PS5 FC27) se in vendita; verificare le esecuzioni della routine blog (9:00 e 18:00) ora che il push funziona; cambio orario UTC della routine il 25 ottobre; dati legali e foto reali del negozio da Christian; redirect di `.it` ed `.eu`; scelta email `.com`.
- Nota tecnica: nel repo i file hanno fine riga CRLF (autocrlf); modificando file da script preservare il CRLF.
