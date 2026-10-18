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
- 2026-09-29 07:04 – pubblicati 2 articoli: "\"Memflation\": Gartner stima PC più cari del 17% e smartphone del 13%" e "Italia terza al mondo per account rubati dai malware infostealer".
- 2026-09-29 – pubblicati 2 articoli: "Il bollettino di sicurezza Android di settembre chiude circa 200 falle" e "Dal 27 settembre negozi ed e-commerce devono segnalare la garanzia legale".
- 2026-10-04 18:06 – pubblicati 2 articoli: "Una falla in iOS sfruttata per attacchi mirati, perché conviene aggiornare l'iPhone" (CVE-2026-86950 in CoreGraphics, scoperta da Meta, corretta da Apple con iOS/iPadOS 26.7.1 e macOS 26.7.1/15.8.1, patch del 29 settembre) e "Dal 2 dicembre le app che creano foto intime finte saranno fuori legge in tutta l'Unione Europea" (divieto "nudifier" nell'AI Act, approvato dal Parlamento europeo il 16 giugno con 423 voti favorevoli, in vigore dal 2 dicembre 2026, sanzioni fino a 35 milioni di euro o il 7% del fatturato globale).
- 2026-10-05 07:20 – pubblicati 2 articoli: "Europol smantella la gang ransomware KillSec, al comando un sedicenne" (Operation KillSwitch, arresto del 30 settembre ad Alicante di un cittadino romeno di 16 anni più altri due sospetti, circa mille attacchi in due anni secondo Europol) e "L'account X di Microsoft hackerato per una truffa in criptovalute" (violazione del 1° ottobre durata circa trenta minuti, profilo cambiato con l'immagine di Clippy per promuovere un token non autorizzato, riportata da WindowsBlogItalia e RedHotCyber).
- 2026-10-05 18:25 – recuperati 7 articoli (numeri 136-142) rimasti su rami claude/* per un push mai arrivato su main; scartato il doppione sul bollettino Android di settembre (già uscito il 30/09).
- 2026-10-08 18:04 – pubblicati 2 articoli: "Pixel di tracciamento nelle email, le aziende hanno tempo fino al 28 ottobre per adeguarsi" (linee guida del Garante Privacy, provvedimento n. 284 del 17 aprile, pubblicato in Gazzetta Ufficiale il 29 aprile, obbligo di consenso preventivo per i tracking pixel nelle email) e "SynthID Detector di Google diventa accessibile a tutti per riconoscere i contenuti fatti con l'IA" (apertura al pubblico annunciata il 7 ottobre, verifica di immagini, video e audio tramite la filigrana SynthID su synthid.com, fonte Ansa).

- **2026-09-26 21:11** – Articoli 106-107: "Falso rimborso INPS, PEC compromesse e il malware MintsLoader" (bollettino CERT-AGID 20-26 settembre); "Google porta i chip per l'intelligenza artificiale nello spazio" (progetto Suncatcher, lancio TPU su Transporter-18 di SpaceX).
- **2026-09-27 09:03** – Articoli 108-109: "Chrome 154 corregge 108 falle di sicurezza, meglio aggiornare subito" (108 correzioni, 11 critiche, rilascio Chrome 154); "RemControl, il trojan Android che finge di essere un'app TV e punta l'Italia" (malware bancario Group-IB diffuso con finte pagine Play Store di TVTap, mirato su IP italiani).
- **2026-09-27 (pomeriggio)** – Articoli 110-111: "ShieldCrash, la falla di Windows Defender che elude anche l'ultima patch" (bypass della correzione ShieldBreak di settembre, privilegi SYSTEM su Windows 10/11/Server, ancora senza patch dedicata); "Falso avviso ACI per tasse auto arretrate, la nuova truffa segnalata da CERT-AGID" (campagna phishing del 23 settembre con domini acitalia.info/acitalia.click).
- **2026-09-28 (mattina)** – Articoli 112-113: "Due falle critiche in Citrix NetScaler sfruttate attivamente, aggiornare subito" (CVE-2026-88771 e CVE-2026-88772, CVSS 9,5, attacchi in corso confermati da Citrix, patch nel bollettino CTX697096); "RAM e SSD, il rincaro previsto è ormai un fatto compiuto" (rilevazione ComputerBase: RAM +345%, SSD +126%, HDD +129% da settembre 2025 a metà 2026, dati confermati anche da TrendForce).

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

## Sessione 2026-09-26 (sera) – Altri prodotti in Vetrina Usati
- Aggiunti 6 prodotti dalle foto rimaste (ora 13 in vetrina): MacBook Air 13" (A2179, 2020, i7 quad-core 1,2 GHz, 8 GB, 256 GB, tastiera italiana), Samsung Galaxy Tab A11+ 5G, Xiaomi Redmi Note 15 Pro 5G 8+256 GB nero, AirPods 4 con cancellazione del rumore, AirPods 4, EA SPORTS FC 27 per PS5 (sigillato).
- Specifiche ricavate dal modello riconosciuto in foto e dalle etichette delle scatole (l'utente non le conosce ancora). Da confermare quando disponibili: MacBook (processore dedotto da "1.2GHz quad-core", stato reale, se funziona), Tab (memoria, colore), Redmi, AirPods.
- Prezzi non forniti: mostrato "Su richiesta" con pulsante "Chiedi il prezzo". Per inserirli basta valorizzare `price` in `content/usati/usati.json`.
- Aggiunta `category` (smartphone, computer, audio-gaming) e nuovi filtri "Smartphone", "Computer e tablet", "Audio e gaming"; verificati con test automatico. Nel box in home compaiono solo prodotti con prezzo.
- Escluse le foto con etichette/codici (seriali, IMEI, AirPort/Bluetooth ID). Scelta la coppia fronte/retro delle AirPods in base all'ordine degli scatti e alle etichette.
- **Schede ridotte ai soli dati certi** (richiesta utente): per MacBook Air, Galaxy Tab, Redmi Note 15 Pro e i due AirPods restano solo le informazioni leggibili su scatole ed etichette (rimossi processore "Core i7", "Retina", "11 pollici", chip H2, giudizi sull'aspetto). Aggiunto il flag `contact: true` in `usati.json`: la scheda mostra "Stato e dettagli si concordano direttamente con il negozio" e il pulsante "Contatta il negozio" (modulo precompilato + telefono). Per togliere l'avviso da un prodotto, rimuovere `contact`.

### Riepilogo finale sessione 2026-09-26
1. **Routine blog riparata:** la GitHub App di Claude non aveva accesso in scrittura (push 403). Dopo la riconnessione una esecuzione manuale ha pubblicato (articoli 106-107). Restano da controllare le esecuzioni delle 9:00 e 18:00.
2. **Vetrina Usati online** su `/usati.html`: 13 prodotti (8 smartphone, MacBook Air, Galaxy Tab, AirPods 4 x2, PS5 FC 27), galleria con lightbox, filtri per categoria, stato batteria, indicatore aperto/chiuso, richiesta info precompilata, box in home, menu, sitemap, JSON-LD.
3. **Bug filtri corretto** (`[hidden]` sovrascritto da `.flex`) e verificato.
4. **Schede prudenti:** dati non certi rimossi; per i prodotti senza prezzo o specifiche compaiono "Su richiesta" e "Contatta il negozio" (`contact: true`).
5. **Indirizzi del sito:** informatixrepair.com, www e `informatix-repair.pages.dev` (indirizzo tecnico gratuito di Cloudflare Pages, stessa copia del sito; il canonical punta al `.com`). Tutti aggiornati all'ultimo commit su `main`.

### Da fare alla prossima sessione
- Prezzi e specifiche dei prodotti "su richiesta" (in `content/usati/usati.json`); foto e stato batteria del 17 Pro Max Pacific Blue.
- Controllare che la routine blog pubblichi ogni giorno; cambiare l'orario UTC il 25 ottobre (`0 8,17 * * *`).
- Dati legali e foto reali del negozio da Christian; redirect di `.it` ed `.eu` verso il `.com`; scelta email `.com`.
- Opzionale: disattivare o reindirizzare `pages.dev`; anteprime su ramo di prova prima di pubblicare.

### Note per la prossima sessione (2026-09-27)
- **Pannello admin per Christian (il cliente):** trovare il modo di dargli un pannello collegato al sito per gestire da solo le pubblicazioni dell'usato (aggiungere, modificare, togliere prodotti, prezzi e foto) e, in prospettiva, altri contenuti. Punto di partenza: oggi i prodotti stanno in `content/usati/usati.json` con foto in `public/images/usati/<slug>/`, il sito è statico su Cloudflare Pages con deploy automatico da GitHub. Da valutare le opzioni (es. CMS su Git come Decap/Sveltia, oppure backend leggero su Cloudflare con database e archivio foto e login protetto) tenendo conto che Christian non è tecnico.
- Poi: raccolta di nuove idee per il sito.

## Sessione 2026-09-27 – Sito bilingue IT/EN
- Richiesta utente: rendere il sito internazionale, italiano/inglese.
- Scelte confermate con l'utente: bilingue su tutto il sito (pagine fisse, Vetrina Usati, blog), switch lato client via bottone in navbar (stessa URL, nessun redirect/sottodominio), lingua di default italiano.
- **Motore i18n** nuovo file `src/i18n.js`: dizionario `it`/`en` per chiave, lingua salvata in `localStorage` (`ir-lang`). Attributi HTML: `data-i18n` (testo), `data-i18n-html` (markup inline), `data-i18n-content` (meta tag), `data-i18n-attr="attr:chiave"` (attributi come aria-label). Bottone EN/IT aggiunto in `renderNavbar()` (`src/main.js`), desktop e mobile; al click si ri-renderizzano navbar/footer/banner APK/teaser usati e si applica `applyI18n()` a tutto il documento (evento `i18n:change`).
- **Pagine fisse tradotte integralmente**: home, chi-siamo, servizi, portfolio, contatti, privacy, 404 (testi, meta tag, Open Graph).
- **Vetrina Usati**: aggiunti campi `*En` opzionali a tutti i 13 articoli in `content/usati/usati.json` (tagline, descrizione, specifiche, condizione, colore); `scripts/build-usati.mjs` genera coppie di elementi IT/EN mostrate/nascoste via CSS (`data-lang-it`/`data-lang-en`, regola in `src/styles/main.css`); se un futuro articolo non ha i campi `*En`, l'EN mostra il testo italiano di fallback (mai vuoto, ma da tradurre appena possibile). Stato negozio aperto/chiuso (`src/usati.js`) tradotto anch'esso.
- **Blog**: tradotta la cornice (elenco, paginazione, card, header articolo, CTA finali) in `scripts/build-blog.mjs`. **Il corpo dei 107 articoli esistenti resta solo in italiano** (tradurli tutti non era fattibile in una sessione senza rischi di qualità); in EN compare l'avviso "This article is currently only available in Italian". Decisione dell'utente: lasciare così per ora, non tradurre in batch né aggiornare subito la routine automatica.
- Limite noto: il messaggio precompilato del form contatti resta in italiano in ogni lingua (va all'email del negozio in Italia).
- Verificato `npm run build` senza errori; commit `8814d1c` e poi merge con l'articolo pubblicato nel frattempo dalla routine automatica (`dc495a0`) e push (`e90e9d4`) su `main` → pubblicato su Cloudflare Pages (informatixrepair.com).

### Da fare alla prossima sessione
- Valutare se/quando tradurre gli articoli del blog passati (107) e se aggiornare la routine automatica perché scriva anche la versione EN dei nuovi articoli.
- Prezzi e specifiche dei prodotti "su richiesta" in Vetrina Usati; foto e stato batteria del 17 Pro Max Pacific Blue.
- Pannello admin per Christian (vedi nota sopra); dati legali e foto reali del negozio; redirect `.it`/`.eu`; email `.com`.
- Controllare esecuzioni quotidiane della routine blog; cambiare l'orario UTC il 25 ottobre (`0 8,17 * * *`).

## Sessione 2026-09-27 (sera) – Gestionale Usati: prototipo locale, poi decisione di architettura online

### Prototipo locale del pannello admin
- Costruito `admin/` (Express + Multer + Sharp, `npm run admin` → `http://localhost:4848`): CRUD sugli articoli di `usati.json`, upload foto con ridimensionamento e miniature automatiche, form a sezioni (Foto, Dati, Prezzo e stato, Testi, Scheda tecnica) in stile sito, bottone "Segna venduto"/"Rimetti in vetrina", rigenerazione automatica di `usati.html` a ogni salvataggio.
- **Flusso "venduto → sparisce dopo 7 giorni"**: l'articolo resta visibile con ribbon "VENDUTO" e CTA disattivata; `src/usati.js` calcola lato client i giorni trascorsi da `soldAt` a ogni caricamento pagina e rimuove la card dal DOM se ≥7 giorni. Nessun cron/rebuild necessario.
- Bug Windows risolto: `execFileSync('npm.cmd', ...)` dava `EINVAL` per rilanciare la build dal server → sostituito con `execFileSync(process.execPath, [percorso allo script .mjs])`.
- **Stile approvato dall'utente** ("mi piace un sacco"): modale con header/footer fissi e corpo scrollabile, schermo intero su mobile, checkbox come pillole cliccabili, card con badge di stato sovrapposto, tab segmented-control. Da riprendere come riferimento per altre pagine interne future.
- Aggiunto login locale: pagina `login.html` in stile sito, sessione via `express-session`, credenziali in `admin/auth.local.json` (generate al primo avvio, mai su git — corretto anche un buco nel `.gitignore`: il pattern `*.local` non copriva `auth.local.json`, serviva la riga esplicita `/admin/auth.local.json`).
- Commit locali `77c9b79` (gestionale) e `861568d` (login + stile) su `main`, **non pushati**: l'utente ha chiesto di aspettare la decisione sull'architettura definitiva prima di pubblicarli.

### Discussione: come deve arrivare online e chi lo usa
- Punto di partenza dell'utente: **non vuole esporre un URL admin non protetto** sul sito pubblico — rischio che uno "smanettone" lo trovi e causi danni. Sicurezza tramite vera autenticazione, non tramite URL segreto.
- Proposta dell'utente, poi confermata: repo dedicato nuovo (separato dal sito pubblico), login vero per Christian, e un bot Telegram in aggiunta per fare le CRUD più rapide (Christian scrive/manda foto in chat).
- **Decisioni prese** (vedi anche `docs/MEMORY.md` → "Gestionale Usati"):
  1. Repo dedicato nuovo per il gestionale, separato dal repo del sito pubblico.
  2. Backend su **Cloudflare Worker** invece del server Express locale.
  3. Login: **email+password custom**, verificato dal Worker (Cloudflare Access valutato e scartato dall'utente).
  4. Storage: **il Worker scrive direttamente su GitHub** (Contents API) nel repo del sito pubblico — ogni salvataggio è un commit vero, Cloudflare Pages ripubblica da sola (scartato un database nuovo tipo D1/R2 per ora).
  5. Conseguenza tecnica: i Worker non eseguono `sharp` (nativo) → ridimensionamento foto lato client (browser) prima dell'upload.
  6. Bot Telegram per le CRUD rapide, stesso backend/API del Worker (nessuna logica duplicata).
- **Ricognizione sui bot Telegram esistenti** (cartella `C:\Mega.nz Sync\Lavoro\Dev\Bot Telegram`, fatta da un subagente): tutti i bot usano **python-telegram-bot v21.x**. Equivoco chiarito: i bot "Vinted" (`Vinted-Bot-Telegram`, `Bot Vinted multiaccount`) sono bot di **monitoraggio/scraping** (stato venduto/riservato via IMAP), non pubblicano annunci con foto — inviano foto solo in uscita. La parte "ricevi foto da Telegram" per il nuovo bot va scritta da zero (standard PTB, nessun rischio). Pattern riusabili: `ConversationHandler` multi-step di `Vinted-MultiMail-Bot/src/bot.py` (righe 646-676) per il flusso guidato foto→nome→prezzo→note→conferma; `SabbaGambaBot-Telegram` (bot.py+db.py) per comandi semplici + SQLite + autorizzazione per singola chat. Deploy: una riga in `Termux-Launcher/bots.conf` (flotta su un Samsung via Termux, doppio watchdog, boot automatico); `Dashboard-Windows` è solo per Windows, nessuna API riusabile esternamente.

### Chiusura sessione (2026-09-27 sera)
- L'utente doveva andare a dormire: **niente sviluppo del nuovo backend/repo/bot in questa sessione**, solo aggiornamento della documentazione (questo file + `docs/MEMORY.md`), poi commit e push (Mega Sync non stava sincronizzando bene stasera, quindi git è il canale di continuità più affidabile verso il PC aziendale usato domani).
- **Piano dettato dall'utente per la prossima sessione**: primo passo, ripassare insieme questa conversazione/decisione sul gestionale; poi via libera per sviluppare davvero (nuovo repo, Worker, login, bot compreso). **Importante**: non installare il bot sul telefono Samsung finché l'utente non lo chiede esplicitamente — il giorno dopo non avrà il telefono con sé; l'installazione avverrà quando sarà a casa con il Samsung collegato via **ADB**, su sua richiesta esplicita.

### Da fare alla prossima sessione
- Ripassare con l'utente le decisioni di architettura qui sopra prima di scrivere codice.
- Creare il nuovo repo dedicato al gestionale; impostare il Worker Cloudflare (login email+password, scrittura su GitHub via Contents API); spostare il ridimensionamento foto lato client (via lo farà sia il frontend web sia il bot).
- Scrivere il bot Telegram (nuovo, non riuso diretto dei bot Vinted) seguendo i pattern individuati; **non installarlo/avviarlo sul Samsung finché l'utente non lo chiede esplicitamente** (serve ADB con il telefono collegato).
- Valutare se/come recuperare o abbandonare il prototipo locale in `admin/` (stile già approvato, da riprendere come riferimento visuale anche se il backend cambia).
- Restano aperti anche i TODO delle sessioni precedenti: prezzi/specifiche prodotti "su richiesta", foto 17 Pro Max Pacific Blue, dati legali e foto reali del negozio, redirect `.it`/`.eu`, email `.com`, cambio orario UTC routine blog il 25 ottobre.

## Sessione 2026-10-13 – Ripresa gestionale Usati (locale, senza login)

### Direttive dell'utente (valide da ora)
- Dopo ogni funzionalità completata e testata: commit + push.
- Tracciare su CHATLOG e MEMORY tutto ciò che si fa, si aggiunge o si elimina.
- Se serve, Cypress va su un branch dedicato (test scritti ed eseguiti da Claude); a test verdi si fa merge in `main`, ma il branch Cypress resta sempre vivo e serve solo per i test.
- Gestionale: per ora **niente autenticazione**, sviluppo solo in locale (poi si valuterà l'auth con il suo Firebase). Worker Cloudflare/repo dedicato rimandati.
- Bot Telegram: scrivere il codice ma **non testarlo né installarlo** (l'utente non ha il telefono). Bot di esempio in `C:\1Marco Peluso\Lavoro da eliminare\Bot Telegram` (pattern: `Promemoria-Bot-Telegram`).

### Modifiche
- **Eliminato il login** del gestionale: rimossi da `admin/server.mjs` sessioni, `/api/login`, `/api/logout`, `/api/session`, guardie auth e generazione di `auth.local.json`; eliminata `admin/public/login.html`; tolto il bottone "Esci" da `admin/public/index.html` e relativa logica in `admin/public/app.js`; rimossa la dipendenza `express-session`; tolta da `.gitignore` la riga `/admin/auth.local.json`.
- Il server ora ascolta solo su `127.0.0.1:4848` (non raggiungibile dalla rete locale, dato che non c'è più il login).
- Test: avvio server, `GET /api/items` e `GET /` rispondono correttamente.

### Funzionalità 1 – Gestionale locale senza login (committata e pushata, `a6ccf64`)
Vedi sopra: login rimosso, server solo su 127.0.0.1.

### Funzionalità 2 – Bot Telegram `bot/` + endpoint `PATCH /api/items/:slug`
- Nuova API `PATCH /api/items/:slug` in `admin/server.mjs`: modifica parziale (price, name, conditionLabel, description, tagline, featured, contact), foto invariate, rigenera `usati.html`.
- Nuova cartella `bot/` (Python, python-telegram-bot 21.4, pattern ricavato da `Promemoria-Bot-Telegram`): `main.py`, `src/{config,api,bot}.py`, `requirements.txt`, `.env.example`, `README.md`, `tests/test_e2e.py`. Il bot chiama le API HTTP del gestionale (nessuna logica duplicata; `API_BASE` configurabile).
- Comandi: `/nuovo` (conversazione: foto → nome → categoria → condizione → prezzo → note → conferma), `/lista`, `/venduto n`, `/riattiva n`, `/prezzo n importo`, `/elimina n` (con conferma), `/annulla`, `/help`, `/id`. Accesso limitato agli ID in `TELEGRAM_ALLOWED_USER_IDS` (se vuoto nessuno può usarlo, tranne `/id`).
- Test: `bot/tests/test_e2e.py` avvia il vero server e simula gli Update: crea articolo (con foto e prezzo "1.299,50"), prezzo errato, `/prezzo`, venduto/riattiva, numero inesistente, elimina con annulla/conferma, utente non autorizzato, server spento. Risultato: OK; `usati.json` e foto ripristinati a fine test.
- **Non testato su Telegram reale** (nessun token creato, telefono non disponibile) e **non installato** su alcun dispositivo.
- `.gitignore`: aggiunti `/bot/.venv`, `/bot/.env`, `__pycache__/`.
- Per usarlo servirà: creare il bot con @BotFather (token nel `bot/.env`) e inserire il proprio ID (comando `/id`).

## Sessione 2026-10-13 (2) – Gestionale Officina (branch `gestionale-officina`)

### Richiesta dell'utente
Secondo gestionale per Christian, su branch separato: Magazzino, Clienti, Riparazioni, Vendite, Fornitori (+ extra a scelta), con scheda di lavoro veloce in ingresso, tracciamento riparazione per il cliente (progress bar, riepilogo dispositivo, dati personali, tempi stimati, preventivo) mostrato all'accettazione. Regola: **veloce e pratico**, Christian ha poco tempo. Carta bianca.

### Analisi online (sintesi)
RepairDesk, RepairShopr, Vollstart Repair Desk, RepairWorkshop: ticket con stato e barra di avanzamento, portale cliente senza registrazione, QR per ogni riparazione + etichetta, checklist/accessori in ingresso, approvazione preventivo online, magazzino con scorta minima e ordini fornitore, strumenti GDPR. Sono stati ripresi, semplificati, e aggiunto quel che manca ai software generici (WhatsApp precompilato, cassa giornaliera, garanzia).

### Scelte di progetto
- Cartella `officina/` (Express 5 + `node:sqlite` incluso in Node 22, nessuna dipendenza nativa; unica nuova dipendenza `qrcode`). Dati in `officina/data/officina.db` (ignorata da git).
- **Due server**: gestionale su `127.0.0.1:4950` (solo questo PC, nessun login per ora, come da direttiva) e tracciamento cliente su `0.0.0.0:4951` (solo `/t/<token>` e `/api/track/*`, raggiungibile da telefono in rete). Il token del link è casuale (12 caratteri) e il QR lo contiene.
- Pagina cliente: mai il codice di sblocco, mai note interne; telefono ed email mascherati; il cliente può **approvare/rifiutare il preventivo** dal link.
- Stati: Ricevuto → In diagnosi → Preventivo da approvare → Approvato / In attesa ricambi → In riparazione → Pronto per il ritiro → Consegnato (+ Annullato). Barra del cliente in 6 passi. Pulsante rapido "Avanza".
- Se il preventivo cambia a lavori iniziati si torna a "Preventivo da approvare" (nuova approvazione tracciata).
- Ricambio assegnato a una riparazione scala il magazzino (e lo ripristina se rimosso). Vendite scalano il magazzino. Incassi (acconti, saldi, vendite) in tabella `payments` → cassa giornaliera/report. Documenti non fiscali (nessuno scontrino/fattura: da integrare col registratore telematico/commercialista).

### Funzionalità 1 – Backend (API + DB + stampe + QR)
- File: `officina/{db,logic,api,print,server}.mjs`. API per clienti, fornitori, prodotti (+movimenti, "da ordinare"), riparazioni (stati, note pubbliche/interne, ricambi, acconti, consegna), vendite, report, impostazioni, QR SVG, stampe (scheda con QR, etichetta 62×30 mm, ricevuta vendita).
- Test: `npm run test:officina` (7 test su DB temporaneo, tutti OK): magazzino, ingresso riparazione e deduplica cliente per telefono, privacy della vista pubblica (verificato che PIN/telefono/email completi non compaiano), isolamento del server pubblico dal gestionale, flusso stati + approvazione online + consegna e incasso (saldo = preventivo - acconto), nuova approvazione dopo cambio preventivo, vendite e cassa, stampe, protezione eliminazione clienti.
- Da fare: interfaccia web (dashboard, scheda ingresso veloce, ecc.), pagina cliente, test Cypress su branch dedicato.

### Funzionalità 2 – Interfaccia web + pagina di tracciamento cliente (testata con Cypress)
- Interfaccia in `officina/public/` (JS a moduli, stile del sito rosso/inchiostro): Oggi, Riparazioni, Clienti, Magazzino (+ Da ordinare), Vendite, Fornitori, Cassa, Impostazioni. Su mobile la navigazione sta in basso.
- **Accettazione veloce** (`repair.js`): scelte a tocco per tipo dispositivo, problema, accessori, condizioni, consegna stimata; cliente esistente ritrovato da nome/telefono; al salvataggio schermata con QR grande, stampa scheda, etichetta, WhatsApp, copia link.
- **Pagina cliente** (`track.html`/`track.js`): barra di avanzamento a 6 passi, riepilogo dispositivo e dati, consegna stimata, preventivo/versato/da saldare, cronologia, approvazione preventivo, garanzia; si aggiorna da sola ogni 8 secondi; nessun dato riservato.
- Dashboard: sezioni "In lavorazione", "Pronte: avvisa il cliente" (WhatsApp precompilato), "In ritardo", "Preventivo da approvare", "In attesa ricambi", "Da riordinare". Il pulsante sulla riga porta al prossimo stato; "Consegnato" apre direttamente l'incasso.
- Corretto `lanIp()`: sceglie la scheda Wi-Fi/Ethernet reale ed esclude quelle virtuali (VirtualBox 192.168.56.x), così il link nel QR funziona dai telefoni.
- Bug trovati dai test e risolti: la dashboard non mostrava le riparazioni appena ricevute (aggiunta "In lavorazione"); dalla lista "Consegnato" si apriva il dettaglio invece dell'incasso.
- Aggiunto `officina/README.md` con le istruzioni d'uso.

### Cypress (branch `cypress-tests`, sempre vivo, solo per i test)
- Il branch `cypress-tests` parte da `gestionale-officina` e contiene Cypress 13 (devDependencies), `cypress.config.js`, `cypress/run.mjs` (avvia un'istanza isolata con DB temporaneo e porte 4960/4961, lancia Cypress e poi la spegne) e `cypress/e2e/officina.cy.js`.
- 13 test E2E, **tutti verdi** (circa 15 secondi): dashboard, fornitore e articolo, accettazione con QR, validazione, vista cliente senza dati riservati, approvazione preventivo dal link, ricambio che scala la giacenza + nota pubblica + lista ordini, consegna e incasso + cassa + garanzia, vendita con sconto e stampa, clienti, impostazioni, isolamento del server pubblico, vista mobile senza scorrimento orizzontale.
- Nota ambiente: l'estensione VS Code imposta `ELECTRON_RUN_AS_NODE=1` e impedisce a Cypress di partire ("bad option: --smoke-test"); `cypress/run.mjs` la rimuove. Per lanciare Cypress a mano: `env -u ELECTRON_RUN_AS_NODE npx cypress ...`.
- Il codice applicativo si sviluppa su `gestionale-officina` e poi si fa merge in `cypress-tests`; Cypress non va mai portato su `main`.
- `.gitignore` corretto (le righe aggiunte avevano fine linea CRLF e git non le applicava): ora ignorati `/officina/data/`, `/cypress/screenshots`, `/cypress/videos`.

### Da fare / decisioni aperte
- Autenticazione (Firebase) e messa online del tracciamento (oggi solo rete locale).
- Decidere se fare il merge di `gestionale-officina` in `main` (la richiesta era "su un altro branch": per ora non fatto).
- Provare il QR e il link da un telefono reale nella rete del negozio.
- Idee future: notifiche automatiche al cambio stato (SMS/WhatsApp), foto del dispositivo all'ingresso, firma digitale del cliente, backup automatico del DB.

## Sessione 2026-10-13 (3) – Revisione, responsive, manuale per Christian (branch `gestionale-officina`)

### Direttive nuove dell'utente
- **Nessun merge in main finché non lo dice lui** (salvato in memoria). Tutto resta sui branch `gestionale-officina` e `cypress-tests`.
- Richiesta: revisione di tutto il codice, correzione errori, schermate potenziate, responsive su ogni dispositivo, CSS/testi/stile sistemati, e un **manuale per Christian** (veloce, pratico, completo, con i flussi).

### Revisione backend (`officina/*.mjs`)
- Date: tutte le date "di oggi" ora sono **locali** (`localDate()`), prima `toISOString()` usava l'UTC e vicino a mezzanotte sbagliava giorno (ritardi, incasso di oggi, report).
- Validazioni: importi negativi rifiutati (preventivo, acconto, totale finale, costo/prezzo/scorta minima); quantità non valide.
- Cliente: lo stesso telefono scritto in modi diversi (+39 340 111 2222 / 3401112222) ora è riconosciuto come stesso cliente (`phoneKey`).
- Stato: una riparazione consegnata non si può più riaprire (409); impostare lo stato già attivo è rifiutato (niente doppie righe in cronologia).
- Nuovi endpoint: `GET /api/backup` (copia coerente del DB via `VACUUM INTO`), `GET /api/stock/summary` (KPI magazzino), `by_day` in `/api/report` (grafico cassa).
- Test API: 9 test OK (aggiunti controlli, backup, riepiloghi). Un bug mio (regex `/D/` al posto di `/\D/`) è stato scoperto dal test appena scritto.

### Interfaccia (`officina/public/`)
- Layout responsive completo: sidebar su desktop; su telefono/tablet barra in basso con 4 voci + "Altro", pulsante rosso fisso "＋" per la nuova riparazione, modali a schermata intera, campi a 16px (niente zoom su iPhone), area sicura iOS, tabelle scorrevoli.
- **Ricerca globale** in alto (riparazioni e clienti) e scorciatoie: `N` nuova riparazione, `/` ricerca, `Esc` chiude.
- Dashboard: riepilogo a parole sotto la data, KPI, sezioni per urgenza; filtri della lista riparazioni con contatori ("Aperte" di default).
- Scheda riparazione: **Modifica dati** (cliente, modello, seriale, accessori, problema, PIN, garanzia); layout a due colonne con spaziatura corretta su mobile.
- Magazzino: KPI (articoli, pezzi, valore a costo, sotto scorta). Vendite: scelta cliente facoltativa (compare nello storico cliente), carrello più leggibile su mobile. Cassa: grafico incassi per giorno. Impostazioni: **backup scaricabile**. Clienti: WhatsApp e chiamata.
- Pagina cliente: passi della barra con pallini colorati (verde fatti, rosso attuale), etichette più corte ("Lavori", "Ritirato") e font fluido per non andare a capo su telefoni stretti.
- Protezioni contro risposte che arrivano dopo un cambio pagina (errori "Cannot set properties of null" trovati da Cypress in modo intermittente).
- `AVVIA-OFFICINA.bat` nella radice: doppio click, installa le dipendenze se mancano, apre il browser.

### Manuale per Christian
- `officina/public/manuale.html` (apribile dal menu "Manuale" o da http://localhost:4950/manuale.html; stampabile in A4/PDF dal pulsante). Contenuti: foglio rapido di una pagina, avvio, i 4 flussi (arriva un cliente → diagnosi e preventivo → si ripara → pronto e consegna), cosa vede il cliente, magazzino e ordini, vendite, clienti/fornitori/cassa, backup, casi particolari (rifiuto, preventivo cambiato, non riparabile, ritardo, ricambio mancante, ricevuta persa…), tabella degli stati, domande frequenti, scorciatoie.
- Schermate reali in `officina/public/manuale/` generate da Cypress con dati di esempio: `npm run test:e2e -- --spec cypress/tools/manuale-screens.cy.js` (solo sul branch `cypress-tests`), poi copiare i PNG da `cypress/screenshots/manuale-screens.cy.js/`.
- Il manuale dichiara onestamente il limite attuale: il link/QR del cliente funziona **solo dal Wi-Fi del negozio** finché non si mette online.

### Cypress (branch `cypress-tests`)
- `cypress/run.mjs` ora avvia **un database nuovo per ogni file di test** (nessuna dipendenza tra file); accetta `--spec` e `--open`.
- Suite: `officina.cy.js` (13 flussi) + `responsive.cy.js` (40 test: 8 pagine × 3 schermi senza scorrimento orizzontale con screenshot, navigazione per dispositivo, accettazione, dettaglio e pagina cliente, ricerca globale, scorciatoie, modifica dati, sezioni dashboard, backup, vendita con cliente, manuale con immagini). **53 test, tutti verdi** in 4 esecuzioni consecutive.
- Il generatore delle schermate del manuale sta in `cypress/tools/` (non gira nella suite normale).

### Da fare / decisioni aperte
- Messa online del tracciamento + autenticazione Firebase; poi aggiornare l'indirizzo pubblico in Impostazioni.
- Merge in main: solo quando lo dice l'utente.
- Prova reale su telefono (QR/link) e stampa su stampante etichette 62×30.

## Sessione 2026-10-13 (4) – Stampa rapida: scheda cliente + scheda laboratorio (branch `gestionale-officina`)

### Richiesta dell'utente
Pulsante rapido per stampare, all'arrivo di un cliente, due documenti distinti: **scheda cliente** (dettagli cliente + QR per tracciare la riparazione) e **scheda laboratorio** (quella che tiene Christian: dati della riparazione + dati del cliente + altri dettagli a scelta mia). Autenticazione e messa online del tracciamento: se ne parlerà dopo (nessuna modifica fatta).

### Cosa è stato fatto
- **Pulsante "🖨️ Salva e stampa"** nel modulo di nuova riparazione (primario, rosso): salva e apre subito `/print/both/:id` (cliente = pagina 1, laboratorio = pagina 2). La finestra di stampa viene aperta durante il click per non essere bloccata dal browser; se viene bloccata compare un avviso e restano i pulsanti nella schermata finale. "Salva" semplice resta disponibile.
- **Schermata finale** e **dettaglio riparazione**: pulsanti Stampa tutto / Scheda cliente / Scheda laboratorio / Etichetta.
- **Scheda cliente** (`print.mjs`): dati cliente e dispositivo, accessori, problema, preventivo/acconto/saldo previsto/consegna stimata/garanzia, **QR + link di tracciamento** con spiegazione, "come funziona", condizioni e firme. **Mai il PIN** né note tecniche (verificato da test).
- **Scheda laboratorio** (uso interno): codice e data, bollino URGENTE, cliente, **PIN/schema in riquadro**, QR del link cliente, dispositivo, problema, economico; **controllo all'ingresso** (15 voci), **"al ritiro"** (backup proposto, reset autorizzato, blocco account iCloud/Google, SIM/SD restituite, accessori contati, foto), **diagnosi** (precompilata con le note del tecnico), **lavori eseguiti**, **ricambi** (precompilati dal gestionale con costo e prezzo), tempo impiegato, tecnico, data fine lavori, **collaudo finale** (15 voci), "cliente avvisato il…", "consegnato il…".
- **Nuovi campi/funzioni a supporto**: `urgent` (colonna aggiunta con migrazione automatica `addColumn`; checkbox "🔥 Urgente" nel modulo e chip nel dettaglio; le urgenti vanno in cima agli elenchi e hanno il bollino) e **note del tecnico** modificabili nel dettaglio (campo `tech_notes` già esistente) che finiscono sulla scheda laboratorio.
- Percorsi: `/print/customer/:id`, `/print/lab/:id`, `/print/both/:id`, `/print/label/:id`; `/print/repair/:id` resta come alias della scheda cliente. `?noprint=1` disattiva la stampa automatica (anteprime/test).
- Stampa A4 più compatta (font 11px, margini 12 mm) perché la scheda laboratorio stia in una pagina.
- **Manuale** aggiornato (foglio rapido, sezione "I due fogli che escono" con le schermate delle due schede, urgente, casi particolari) e schermate rigenerate (`12-scheda-cliente`, `13-scheda-laboratorio`, `05`, `06`).

### Test
- API: 10 test OK (nuovo: PIN assente sulla scheda cliente e presente sul laboratorio, note tecniche solo in laboratorio, `noprint`, urgenti per prime).
- Cypress (`cypress-tests`): 56 test verdi (13 officina + 43 responsive/comodità), compresi "Salva e stampa" (verifica che si apra `/print/both/…`), schede cliente/laboratorio, note del tecnico, priorità.
- `cypress.config.js` ora include anche `cypress/tools/` nello `specPattern` (serve per lanciare il generatore di schermate con `--spec`).

### Da fare
- Discussione con l'utente su **autenticazione** (Firebase) e **messa online del tracciamento**.
- Prova di stampa su stampante reale (A4 e etichette 62×30).
- Possibili ritocchi alla scheda laboratorio dopo il parere di Christian (voci della checklist, spazio per le firme).

## Sessione 2026-10-13 (5) – Lettore di codici a barre (pistola) e fotocamera (branch `gestionale-officina`)

### Richiesta dell'utente
Che Christian possa scansionare il seriale/IMEI con una **pistola per codici a barre**; poi, a seguire: e dal telefono, con la **fotocamera**?

### Come funziona la pistola (nessun driver)
Le pistole USB sono una "tastiera velocissima" che scrive il codice e preme Invio. Il gestionale riconosce la raffica (≥4 caratteri con meno di 50 ms tra uno e l'altro, poi Invio):
- **Modulo nuova riparazione**: il campo *Seriale / IMEI* gestisce l'Invio finale (non invia nulla, passa al problema). Se la lettura arriva in un'altra casella (tipicamente la ricerca cliente, che è selezionata all'apertura) viene **spostata nel seriale**.
- Il seriale viene controllato: IMEI di 15 cifre → algoritmo di **Luhn** ("✔ IMEI valido" / "⚠ non valido"); se quel seriale è **già in archivio** compare l'avviso con il pulsante per aprire la riparazione precedente (cliente che torna, garanzia).
- **Pagina libera** (nessun campo selezionato): la lettura apre la riparazione che ha quel seriale o quel codice (R-AAAA-NNNN); più risultati → ricerca; nessun risultato → propone una nuova riparazione con quel seriale precompilato. Le scorciatoie `N` e `/` funzionano ancora (un tasto solo ≠ lettura: attesa di 130 ms).
- **Ricerca in alto**: Invio con un solo risultato apre la scheda.
- **Codice a barre Code 128** del numero riparazione stampato su **etichetta** (62×30 mm) e **scheda laboratorio**: la pistola lo legge e si apre la riparazione. Encoder scritto a mano (`officina/barcode.mjs`, nessuna dipendenza) e **verificato identico** alla libreria di riferimento JsBarcode su 5 stringhe (confronto fatto in una cartella temporanea, non nel repo); endpoint `GET /api/barcode?text=`.

### Fotocamera (telefono/tablet)
- Pulsante 📷 accanto al seriale e nella barra in alto sui dispositivi piccoli (`officina/public/scan.js`): usa `BarcodeDetector` del browser (Chrome/Android) e, dove manca (Safari iPhone), la libreria ZXing caricata al bisogno da jsDelivr.
- **Limiti onesti**: (1) il browser consente la fotocamera solo in contesto sicuro (**https** o localhost); (2) oggi il gestionale gira solo sul PC (127.0.0.1) e non è raggiungibile dal telefono. Quindi la fotocamera **funzionerà solo dopo la messa online con https e l'autenticazione** (punto in discussione con l'utente). Senza contesto sicuro il pulsante spiega cosa fare (usare la pistola). **Non testata con una fotocamera vera** (Cypress verifica solo pulsante e messaggio); il ramo ZXing è anch'esso non provato.

### Test
- API: 11 test OK (nuovo: struttura Code128, endpoint, barcode in etichetta e scheda lab, ricerca per seriale/codice).
- Cypress (`cypress-tests`, nuovo `scanner.cy.js`, 10 test, lettura simulata con `type({delay:0})`): IMEI valido/non valido, Invio che non perde il modulo, seriale già in archivio, lettura nella casella cliente → seriale, lettura a pagina libera per seriale e per codice, codice sconosciuto → nuova riparazione, ricerca con Invio, scorciatoie intatte, barcode in etichetta/scheda, pulsante fotocamera e messaggio. Totale suite: **66 test verdi** (13 + 43 + 10).
- Manuale aggiornato: capitolo sulla pistola (uso, impostazione "tastiera + Invio finale", problemi comuni), nota sulla fotocamera, scorciatoie.

### Da fare
- Provare con una pistola vera (modello? impostazione tastiera italiana e suffisso Invio).
- Fotocamera: provare dopo la messa online https; valutare l'ingresso da telefono con autenticazione.

## Sessione 2026-10-13 (6) – Revisione grafica completa (CSS pulito e responsive)

### Segnalazione dell'utente
Dagli screenshot inviati: nella scheda riparazione i pulsanti toccavano il titolo "CLIENTE", testi uno addosso all'altro, caselle senza respiro. Richiesta: non solo quelle schermate, **tutto**; "non voglio più vedere errori elementari".

### Causa
Margini "a caso" sparsi nei template (`sec-t:first-child{margin-top:0}` azzerava lo spazio proprio dove serviva, griglie tailwind improvvisate, doppi badge "Preventivo approvato", righe di testo senza struttura).

### Cosa è cambiato
- **Sistema di spaziatura unico** in `officina/public/index.html`: `.sec` (blocco con titolo e spazio fisso), `.sec-t`/`.sec-sub`, `.cols`/`.col` (2 colonne da 700 px), `.fgrid c2/c3/c4/m2` + `.field` (etichetta+campo), `.row`, `.kv` (etichetta: valore), `.plist` (elenchi), `.tl` (cronologia), `.total-box`, `.badges`, `.check`, `.suggest` (tendine), `.hint`. Etichette più leggibili (0,78 rem, #374151), textarea con altezza minima e padding.
- **Tutte le finestre ridisegnate** con il sistema: nuova riparazione, dettaglio riparazione (intestazione con badge/progresso/azioni separata dal resto; colonne Cliente/Dispositivo/Stampe e Preventivo/Ricambi; note, messaggio, cronologia), modifica dati, consegna e incasso, cliente (nuovo e dettaglio), articolo, fornitore.
- **Telefono**: magazzino e cassa diventano **elenchi a schede** (nome, prezzi, badge, −1/+1) al posto di tabelle tagliate; i filtri di stato scorrono in orizzontale su una riga sola; il piede delle finestre diventa una griglia (azione principale a tutta larghezza, poi Salva/Annulla); pulsanti con testo lungo vanno a capo; campi alti almeno 40 px.
- Badge duplicato "Preventivo approvato" tolto; toast mostrato **dopo** il ridisegno (evitava click su elementi che sparivano); placeholder accorciati.

### Controllo automatico anti-errori (Cypress, `cypress/e2e/ui-review.cy.js`, nella suite normale)
Apre ogni pagina e ogni finestra a **telefono 390×844, tablet 768×1024, desktop 1280×860** con dati realistici e verifica via geometria: niente fuori schermo, niente sovrapposizioni tra elementi fratelli, niente contenuti che escono dal contenitore, campi non più stretti di 70 px né più bassi di 38 px su telefono. Salva anche gli screenshot (cypress/screenshots) per la revisione a occhio: eseguita su tutte le schermate. **62 test.** Al primo giro ha trovato 4 problemi veri (riga pulsanti "Da ordinare" che usciva dallo schermo su telefono, campi prezzo del carrello troppo bassi, filtri e tabelle da sistemare), tutti corretti.
- Suite completa ora: officina 13 + responsive 43 + scanner 10 + ui-review 62 = **128 test verdi**; API 11 test verdi.
- Manuale: schermate rigenerate con la nuova grafica.

### Regola per il futuro (anche in memoria)
Usare solo il sistema di spaziatura; per ogni schermata nuova o modificata guardare gli screenshot a 3 formati e far girare `ui-review` prima di consegnare.

## Sessione 2026-10-13 (7) – Seconda revisione grafica (causa vera dei campi "attaccati")

### Segnalazione dell'utente
Screenshot della finestra "Nuova riparazione": "il CSS è rimasto uguale"; richiesta di una revisione di tutto il CSS **almeno 10 volte**, stile perfetto.

### Causa vera trovata
Il CDN di Tailwind inietta il suo reset (preflight) **dopo** il nostro `<style>` e azzerava `padding` e `font` di input/select/textarea: per questo il testo nei campi era attaccato al bordo (visibile anche nelle prime schermate dell'utente) e i campi sembravano "rimasti uguali". I controlli automatici precedenti non misuravano il padding. Corretto con selettori più specifici (`html body input…`) che vincono in qualsiasi ordine di caricamento.

### Passate di revisione (ognuna con screenshot guardati a occhio su telefono/tablet/desktop)
1. **Fondamenta**: controlli con altezza unica 44 px (`--ctl`), bordi più visibili, font 15 px, freccia dei select disegnata, chip più grandi, etichette più leggibili, sezioni delle finestre separate da una linea sottile, spazi interni regolari.
2. **Icone**: le emoji colorate sono sostituite in automatico da **icone a linea coerenti** (`officina/public/icons.js`, MutationObserver: nessun template da modificare); icona fotocamera e pulsanti allineati ai campi.
3. **Distanze**: etichetta→campo regolare (prima 0 px per un errore mio), suggerimenti vuoti senza spazio riservato, plurali corretti ("1 riparazione"), segnaposto brevi su telefono, filtri senza barra di scorrimento, percentuale e ultimo passo in verde a lavoro completato.
4. **Schermi piccoli (320 px)**: pulsanti di avanzamento che vanno a capo, riga "voce libera" delle vendite a due righe, tabelle del manuale scorrevoli.
5. **Barra inferiore su telefono**: il tasto fluttuante (che copriva i pulsanti delle righe) è sostituito da un pulsante rosso **Nuova** al centro della barra.
6. **Piede delle finestre su telefono**: azione principale a tutta larghezza, gli altri pulsanti in una riga equilibrata.
7. **Pagina cliente e stampe**: icone SVG al posto delle emoji, nota con icona allineata, controllo di etichetta e schede a occhio.
8. **Gruppi di scelte rapide** con etichetta (tipo di dispositivo, accessori lasciati, stato estetico).
9. Campi nascosti che restavano visibili per colpa della nuova regola (`.hidden`) corretti; ricerca senza la "X" nativa.
10. Manuale e schermate del manuale rigenerate con la grafica nuova; cache dei file statici disabilitata (`Cache-Control: no-cache`) così le modifiche si vedono subito.

### Controlli automatici (`cypress/e2e/ui-review.cy.js`) — ora 5 formati: 320, 390, 768, 1280, 1536 px
Oltre a fuori-schermo/sovrapposizioni/campi piccoli, misura: **padding dei campi (≥10 px)**, font ≥14 px nei campi, bordo presente, altezza campi, **stessa altezza** in una riga campo+pulsante, **distanza etichetta-campo (3-12 px)**, **spazio tra sezioni (20-70 px)**, gruppi di chip/pulsanti non appiccicati all'elemento successivo, carattere minimo 10 px. Fotografa anche i documenti di stampa (scheda cliente, laboratorio, etichetta), la pagina cliente consegnata e il manuale.
- Suite completa: officina 13 + responsive 43 + scanner 10 + ui-review 109 = **175 test verdi**; API 11 test verdi.

### Nota
Il pulsante "Modifica dati" si chiama ora "Modifica"; il tasto fluttuante `#fab` non esiste più (c'è `#nav-new` nella barra).

## Sessione 2026-10-13 (8) – Riepilogo generale e piano della serata (messa online con Cloudflare)

### Decisione presa
Autenticazione con **Cloudflare Access** (scelta dall'utente tra le alternative: login proprio, Supabase, Auth0/Clerk, passkey). Il gestionale resta sul **PC del negozio** e viene raggiunto tramite **Cloudflare Tunnel** (`cloudflared`).

### Cosa è stato fatto (tutto su branch `gestionale-officina` e `cypress-tests`, nessun merge in main)
- **Gestionale Vetrina Usati** (su `main`): login rimosso, solo localhost (127.0.0.1:4848); API PATCH; **bot Telegram** in `bot/` scritto e testato con messaggi simulati (non su Telegram reale, non installato).
- **Gestionale Officina** (`officina/`, Express + node:sqlite): clienti, riparazioni, magazzino, vendite, fornitori, cassa, impostazioni, backup; tracciamento cliente con QR/link (pagina pubblica separata, porta 4951) e approvazione del preventivo online; stati e barra di avanzamento; WhatsApp precompilato; lista "Da ordinare" per fornitore.
- **Stampa rapida**: "Salva e stampa" → scheda cliente (QR, senza PIN) + scheda laboratorio (PIN, checklist ingresso/collaudo, diagnosi, ricambi), etichetta 62×30 con codice a barre; campo "Urgente" e note del tecnico.
- **Lettore codici a barre**: pistola USB (tastiera + Invio) per seriale/IMEI con controllo Luhn e avviso "già in archivio"; scansione a pagina libera apre la riparazione; Code 128 su etichetta e scheda; fotocamera del telefono (`scan.js`, richiede https).
- **Grafica**: sistema di spaziatura unico, icone SVG, responsive 320–1536 px; causa dei campi "attaccati" = reset di Tailwind (corretto con `html body input…`). Controllo automatico `ui-review`.
- **Manuale per Christian** (`officina/public/manuale.html`) con schermate reali; avvio con `AVVIA-OFFICINA.bat`.
- **Test**: API 11; Cypress (solo branch `cypress-tests`) 175 verdi (officina 13, responsive 43, scanner 10, ui-review 109). Cypress non va mai in `main`.

### PIANO DELLA SERATA – messa online
**Domande da chiarire all'inizio (l'utente deve rispondere)**
1. Nomi dei due indirizzi (proposta: `gestionale.informatixrepair.com` protetto, `riparazioni.informatixrepair.com` pubblico).
2. Email autorizzate al gestionale (Christian + utente).
3. Dove mettere il link "nascosto" nel sito pubblico (piè di pagina o logo) e **via libera a toccare `main`** (il sito pubblico è su `main`; finora: nessun merge senza suo avviso). Alternativa: preparare la modifica in un ramo a parte.
4. Il PC del negozio resta acceso tutto il giorno? (vedi sotto: perché serve)

**Io (codice, ~2-4 h)**
1. Verifica del JWT di Cloudflare Access (`Cf-Access-Jwt-Assertion`, claim `aud`/`iss`, chiavi pubbliche del team) nel server del gestionale: seconda barriera oltre ad Access; abilitabile da variabili d'ambiente (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`), spenta in locale.
2. Separare chiaramente i due host: server admin (127.0.0.1:4950) solo dietro Access; server pubblico (4951) solo `/t/:token` e `/api/track/*` + limite di richieste per IP/token (protezione da tentativi sui codici).
3. `public_base_url` = indirizzo pubblico del tracciamento; QR e link nelle schede usano quello. Controllo del messaggio "localhost" nei QR.
4. Contesto sicuro (https) → abilitare la fotocamera del telefono: prova reale su telefono (BarcodeDetector / ZXing).
5. Link discreto per Christian nel sito pubblico (ramo a parte, merge solo con via libera).
6. Test: unit test del controllo JWT (token valido/scaduto/audience errata), Cypress sul server pubblico (nessuna rotta admin raggiungibile), `ui-review` invariato.
7. Guida passo passo per la parte Cloudflare nel manuale/README (`docs/ONLINE.md`) + aggiornamento CHATLOG/MEMORY, commit e push.

**Lui/lei (Cloudflare, ~20-30 min, guidato)**
1. Attivare **Zero Trust** (piano gratuito, fino a 50 utenti; da verificare se chiede una carta).
2. Installare **cloudflared** sul PC del negozio come servizio Windows (parte con il PC).
3. Creare il **Tunnel** con due hostname: gestionale → `http://localhost:4950`, riparazioni → `http://localhost:4951`.
4. Creare l'**applicazione Access** sul solo host del gestionale: regola "Allow" con le email autorizzate; metodo: codice via email (One-time PIN) e/o Google. Copiare `Application Audience (AUD)` e il team domain.
5. Impostare in Windows: **non sospendere mai** il PC (alimentazione) e riavvio automatico dei servizi.

**Verifiche finali della serata**
- Dal telefono su rete dati: il QR di una riparazione di prova apre la pagina cliente; il gestionale chiede il login e rifiuta email non autorizzate.
- La pagina pubblica non espone nessuna rotta admin (verificato anche da Cypress sul server pubblico).
- Fotocamera: lettura di un codice a barre dal telefono.
- Backup del DB scaricato prima di cambiare configurazione.

### Rischi / punti aperti
- **PC acceso**: se si spegne, gestionale e QR non rispondono (i dati e il programma stanno sul PC; Cloudflare fa solo da portiere). Alternativa futura: spostare tutto su Cloudflare (Workers + D1) per non dipendere dal PC, oppure un mini-PC sempre acceso.
- Fotocamera mai provata con hardware vero; pistola mai provata; stampa mai provata su carta/etichette reali.
- Bot Telegram: serve token da BotFather e ID utente; installazione sul telefono solo su richiesta dell'utente (via ADB/Termux).
- Vetrina Usati online: ha ancora login assente, solo locale → decidere se metterla dietro lo stesso Access.
- Cambio orario UTC della routine blog il 25 ottobre (`0 8,17 * * *`), ripristino a marzo 2027.
- Altri TODO storici: dati legali privacy/cookie, foto reali del negozio, redirect `.it`/`.eu`, email del `.com`, icone dell'app Android.

## Sessione 2026-10-13 (9) – Appunti: migrazione su Cloudflare (Workers + D1) e sezione "Segui la riparazione" nel sito

### Decisioni dell'utente (aggiornano il "piano della serata" qui sopra)
- **Si applica stasera, insieme a tutto il resto, la migrazione su Cloudflare** (Workers + D1 + Access) invece del solo Tunnel: il PC del negozio non dovrà più restare acceso. Il Tunnel resta come **piano B** se la migrazione non si chiude in serata.
- Nomi degli indirizzi: **`gestionale.informatixrepair.com`** (protetto da Access) e **`riparazioni.informatixrepair.com`** (pubblico, tracciamento), "se Cloudflare lo permette" (il dominio è su Cloudflare, quindi i sottodomini si possono creare liberamente).
- Nuova richiesta per il **sito principale**: sezione per il cliente per **scansionare il QR e accedere al tracciamento live**, pensata in modo che anche un **cliente anziano** ci arrivi facilmente.

### A) Migrazione del gestionale officina su Cloudflare (Workers + D1)
**Architettura obiettivo**
- Worker (consigliato framework **Hono**) al posto di Express: route admin (host `gestionale.…`, dietro Access) e route pubbliche (`riparazioni.…`: `/t/:token`, `/api/track/*`, ricerca per codice) nello stesso Worker, distinte per hostname/percorso. Pagine statiche (`officina/public`) servite con **Workers Static Assets**.
- Database **D1** (SQLite gestito) al posto di `node:sqlite`; schema da `officina/db.mjs`. Backup: export D1 + **Cron Trigger** giornaliero che salva una copia su **R2** (e il pulsante "Scarica backup" resta, via export).
- Login: **Cloudflare Access** davanti all'host del gestionale; il Worker verifica anche il JWT `Cf-Access-Jwt-Assertion` (claim `aud`/`iss`, chiavi del team) come seconda barriera. Segreti (`ACCESS_AUD`, team domain) con `wrangler secret`/variabili.
- Rate limiting sulla parte pubblica (regola di rate limiting Cloudflare + limite nel Worker).
- QR: libreria compatibile con i Worker (es. `uqr`/`qrcode` build browser) al posto del `qrcode` Node; barcode Code128 già senza dipendenze (`barcode.mjs`).

**Cosa va riscritto / attenzione**
- `db.mjs`/`logic.mjs`/`api.mjs`: da sincrono a **async**; D1 **non ha transazioni interattive** → operazioni multi-passo (ricambi che scalano il magazzino, vendite, consegna + incasso, numerazione R-AAAA-NNNN) vanno riprogettate con `db.batch([...])` atomici e contatori sicuri (tabella contatori con `UPDATE … RETURNING`) per evitare doppioni.
- `print.mjs`, `barcode.mjs`, `icons`/UI statica: invariati (sono stringhe/JS puro). Lo stile e il manuale non cambiano.
- `server.mjs` (due porte) sparisce: due hostname invece di due porte; `public_base_url` = `https://riparazioni.informatixrepair.com`.
- Test: API test da rifare su **wrangler dev / Miniflare** (o vitest-pool-workers); Cypress (`cypress-tests`) punta a `wrangler dev` con D1 locale temporaneo invece del server Node (`cypress/run.mjs` da adattare). Obiettivo: ritrovare gli stessi 175 test verdi.
- Dati attuali: solo dati di prova → nessuna migrazione dati reali; se serve, export SQL del vecchio DB → import su D1.
- Costi: piano gratuito (Workers 100.000 richieste/giorno, D1 5 GB e 100.000 scritture/giorno, R2 10 GB): abbondante per il negozio.

**Passi in serata (ordine proposto)**
1. Account/Zero Trust: attivare Access, creare l'applicazione sull'host del gestionale (email autorizzate), annotare AUD e team domain. (Utente, guidato)
2. Creare progetto Worker + D1 + R2 con `wrangler` (login già eseguito sul PC: verificare gli scope OAuth mancanti `k2.read/k2.write` ed eventualmente rifare `wrangler login`).
3. Portare schema e logica su D1 (Hono), partendo da `logic.mjs` come specifica; far passare i test API.
4. Adattare Cypress e far passare la suite; `ui-review` invariato.
5. Deploy, collegare i due hostname (`gestionale.…` con Access, `riparazioni.…` pubblico), impostare `public_base_url`, backup giornaliero su R2.
6. Prove reali dal telefono su rete dati: QR, approvazione preventivo, fotocamera (ora in https), lettura codice con la pistola, stampa.
7. Documentazione (`docs/ONLINE.md`), CHATLOG/MEMORY, commit e push.
- **Piano B** (se non si chiude): Cloudflare Tunnel verso il PC + Access; la migrazione prosegue il giorno dopo.

### B) Sito principale: sezione "Segui la tua riparazione" (da fare su un ramo a parte, merge solo con via libera)
**Obiettivo**: il cliente (anche anziano) arriva alla pagina di tracciamento in pochi tocchi, senza account né password.
- **Posizione**: blocco molto visibile in alto nella home ("Hai lasciato un dispositivo da noi? Guarda a che punto è la riparazione") + voce fissa nel menu "Segui la riparazione" + pagina dedicata (`/segui-riparazione.html`).
- **Tre modi, in ordine di semplicità**, con pulsanti grandi e testo ≥ 20 px, alto contrasto, poche parole:
  1. **Inquadra il QR** della ricevuta con la fotocamera del telefono (istruzioni illustrate in 3 passi: "1 Apri la fotocamera, 2 Punta il QR sul foglio, 3 Tocca il link"); e un pulsante "Apri la fotocamera qui" che scansiona il QR direttamente dalla pagina (BarcodeDetector/ZXing, funziona in https).
  2. **Scrivi il numero della ricevuta** (es. R-2026-0001) **e le ultime 4 cifre del tuo telefono** → pulsante grande "Mostra la mia riparazione" (la sola numerazione è indovinabile: la seconda informazione evita che altri possano curiosare; con limite ai tentativi).
  3. **Chiamaci / WhatsApp**: numero e pulsanti "Chiama" e "Scrivi su WhatsApp" sempre in vista per chi preferisce non usare il telefono.
- Dettagli di accessibilità: font grande, pulsanti ≥ 56 px, nessun gergo, messaggi d'errore gentili ("Non troviamo la riparazione: controlla il numero o chiamaci"), funziona senza JavaScript pesante, bilingue IT/EN come il resto del sito (`src/i18n.js`).
- **Backend**: endpoint pubblico del Worker `POST /api/lookup {code, phone_last4}` (con CORS verso il sito e rate limiting) che risponde con l'indirizzo `/t/<token>` oppure errore; la pagina del sito reindirizza.
- Dove: repo del sito (`index.html`, nuova pagina, `src/main.js`/`i18n.js`, build Vite); coerente con lo stile del sito (nero/rosso). **Tocca `main` → serve il via libera**; fino ad allora branch dedicato (es. `sito-segui-riparazione`).
- Test: Cypress sul branch dei test (sezione visibile in home, ricerca con codice+4 cifre corretta/sbagliata, limite tentativi, accessibilità di base).

### Domande ancora aperte per la serata
- Email autorizzate in Access (Christian + utente).
- Posizione del link per Christian nel sito pubblico (e se il link "Area riservata" va nel piè di pagina o sul logo).
- Via libera a toccare `main` per il sito (sezione "Segui la riparazione" + link di accesso).

## Sessione 2026-10-13 (10) – Conferme finali dell'utente, stima dei tempi, audit degli appunti

### Conferme dell'utente
- Autenticazione: **Cloudflare Access**; per ora solo `marcopeluso99@gmail.com` ("password a tuo piacimento": Access non usa password, codice via email o Google); **Christian per ultimo**.
- Link nel sito: **"Area riservata" nel piede di pagina**, verso `gestionale.informatixrepair.com`.
- Nomi degli indirizzi come proposti, se Cloudflare li permette: `gestionale.informatixrepair.com`, `riparazioni.informatixrepair.com`.
- Si parte **stasera dal punto 1 (Cloudflare/Access)** quando l'utente torna a casa; **test, commit e push a ogni funzionalita**; le **prove con l'hardware** (pistola, stampante, etichette, fotocamera) le fa **Christian**; **extra utili** possono essere aggiunti di iniziativa se **utili, veloci ed efficaci** per Christian.
- **Via libera a toccare `main`** quando tutto sara finito e testato (Cypress sempre escluso da `main`).

### Stima del tempo (90% di precisione)
Circa **17 ore** di lavoro mio (intervallo **14-21 h**): Cloudflare/Access 0,75; Worker+D1 4,5; Access nel programma, limiti, backup R2 2; test API+Cypress 3; deploy e prove da telefono 1; sito (sezione clienti, lookup, Area riservata, test) 4; manuale e guide 1,5. Tappe: **stasera ~8 h** (online con login e tracciamento), **domani 6-8 h** (sito, manuale, passaggio in `main`), **poi 1-2 h** (account di Christian e prove hardware). Alternativa veloce Tunnel+Access: 3-4 h ma PC sempre acceso e sito da fare. Non stimabili: tempi dei passaggi sul pannello Cloudflare e prove con hardware reale.

### Audit degli appunti (fatto su richiesta dell'utente)
Controllati `docs/MEMORY.md`, `docs/CHATLOG.md` e la memoria di Claude. Trovato e corretto:
- decisioni **superate** ancora scritte come valide (Firebase; login custom nel Worker; "Cloudflare Access scartata"; Tunnel con PC acceso come piano principale) → ora segnate "SUPERATO/A" e rimandano alla nuova sezione **"ONLINE: decisioni e piano VALIDI"** in testa a `docs/MEMORY.md`;
- **mancavano**: stima dei tempi e tappe, email autorizzata e ordine di inserimento di Christian, destino della **Vetrina Usati e del bot Telegram** online (decisione aperta), 19 rami remoti `claude/upbeat-fermi-*` da pulire, cambio orario routine blog del 25 ottobre, indicazione che Cypress non va in `main` → aggiunti;
- memoria di Claude: file `project-online-cloudflare` e `project-gestionale-usati` allineati, aggiunto il profilo dell'utente e dell'ambiente.

## Sessione 2026-10-13 (11) – Punti ESSENZIALI aggiunti: Portale unico per Christian e gestione utenti

### Richiesta dell'utente
1. Cliccando "Area riservata" Christian deve vedere **sia la gestione degli usati sia il gestionale vero**, con una grafica **veloce, responsive e accessibile**: "se non esiste creala ora oppure prendine nota, è un punto essenziale non saltarlo".
2. Creazione utenti: dipende dall'utente (portale Cloudflare) o Christian può essere autonomo? In ogni caso **predisporre 4 utenti**; le email le farà mandare da Christian (configurazione dei login a fine serata).

### Stato oggi (verificato)
- Esistono **due app separate**: Officina (porta 4950) e Vetrina Usati (porta 4848). Non c'era nessuna pagina comune né collegamento.
- Verifica grafica sulla Vetrina Usati con Cypress (`cypress/tools/usati-audit.cy.js`): **stesso difetto delle caselle** (padding 0 per il reset di Tailwind) → **corretto oggi** in `admin/public/index.html` (campi alti 44 px, bordo più visibile, select con freccia, etichette più leggibili). Restano emoji al posto delle icone e nessuna barra inferiore su telefono.
- **Collegamenti reciproci aggiunti**: nel menu dell'Officina la voce "Vetrina usati"; nell'intestazione degli Usati il link "← Officina". È una soluzione ponte, NON il portale.

### PUNTO ESSENZIALE: "Portale unico" (da fare nella serata, non saltare)
**Cosa vede Christian dopo il login** (indirizzo `gestionale.informatixrepair.com`): una pagina **Portale** con
- grandi pulsanti/schede: **Officina** (riparazioni, clienti, magazzino, vendite, fornitori, cassa), **Vetrina usati/nuovi**, **Manuale**;
- azioni rapide in alto: **Nuova riparazione**, **Cerca / scansiona un codice**, contatori cliccabili **Pronte da ritirare**, **Preventivi da approvare**, **In ritardo**;
- nome dell'utente connesso e pulsante **Esci** (logout di Access).
Struttura degli indirizzi: `/` = Portale, `/officina` e `/usati` nella stessa shell grafica (stesso menu, stessa barra inferiore su telefono, stesse icone).
**Requisiti (criteri di accettazione)**
- **Veloce**: nessuna libreria pesante; prima schermata utile in meno di 1 secondo; da qualsiasi pagina al "Nuova riparazione" in 1 tocco.
- **Responsive**: 320, 390, 768, 1280, 1536 px senza scorrimento orizzontale (stesso controllo `ui-review`).
- **Accessibile**: bersagli di tocco ≥ 44 px, contrasto almeno AA, navigazione completa da tastiera, focus sempre visibile, `aria-label` sui pulsanti con sola icona, gerarchia dei titoli, testo ≥ 16 px nei campi, rispetto di `prefers-reduced-motion`, lingua `it`. Test automatici con **cypress-axe** (sul branch `cypress-tests`) oltre a `ui-review`.
- La **Vetrina Usati va portata nello stesso design system** (sec/fgrid/field, icone SVG, barra inferiore, controlli 44 px) e sullo stesso Worker/Access.
**Tecnica per la Vetrina Usati online**: decisione del 27/09 riconfermata per la parte dati: il Worker scrive su GitHub (Contents API) i file `usati.json` e le foto (ridimensionate nel browser, `sharp` non esiste nei Worker), Cloudflare Pages ripubblica il sito. Il bot Telegram userà le stesse API (da decidere se tonight).
**Stima aggiuntiva**: Portale 1,5 h; Vetrina Usati su design system + Worker/GitHub 4-6 h; audit accessibilità 1 h → il totale del piano sale da ~17 h a **~24-28 h (intervallo 20-30 h)**. Da spezzare su più sere se serve; **ordine di priorità**: 1) Access + Worker/D1 + tracciamento pubblico, 2) Portale e utenti, 3) sito (Segui la riparazione, Area riservata), 4) Vetrina Usati integrata.

### Utenti (domanda dell'utente): come funziona e cosa si predispone
- **Per accedere** Christian non ha bisogno di un account Cloudflare né di una password: inserisce la sua email e riceve un **codice** (oppure usa il login Google). 
- **Chi decide chi entra**: la lista di email autorizzate sta nella *policy* di Cloudflare Access, che si modifica **solo dal pannello Cloudflare** (serve l'account dell'utente). Aggiungere un utente = 1 minuto (Zero Trust → Access → Applications → Policy → email).
- **Autonomia di Christian (opzionale, da costruire)**: pagina **"Utenti"** visibile solo agli amministratori, con un elenco in D1 (`users`: email, nome, ruolo, attivo) usato dal Worker come lista di autorizzati. Due modi: (a) Access impostato su "chiunque abbia ricevuto un codice via email" e il Worker accetta solo le email presenti nell'elenco → un amministratore aggiunge/toglie utenti dall'app senza toccare Cloudflare; (b) la pagina aggiorna la policy Access tramite API Cloudflare (richiede un token con permesso ristretto da custodire come segreto). **Consigliato per ora**: policy Access con le email esplicite (più sicura) + tabella `users` già pronta con ruoli; l'autonomia piena (a) si attiva solo se l'utente la vuole.
- **Predisposizione per 4 utenti**: tabella `users` con 4 posti: (1) `marcopeluso99@gmail.com` – amministratore; (2) Christian – operatore (email da ricevere); (3) e (4) da definire. Ruoli proposti: **amministratore** (tutto, incluse Impostazioni, Cassa, Utenti, backup), **operatore** (riparazioni, clienti, magazzino, vendite; senza Impostazioni/Utenti; Cassa da decidere). Il Worker legge l'email dal JWT di Access e applica il ruolo; ogni azione importante può registrare l'utente (extra utile: "chi ha fatto cosa" in cronologia).
- **Passi a fine serata**: l'utente fa mandare da Christian (e dagli altri due) le email → inserimento in Access (pannello) e nella tabella `users`; prova di login di ogni utente da telefono.

### Domande aperte da chiarire con l'utente
- Ruolo di Christian: operatore o amministratore? L'operatore può vedere la Cassa?
- Chi sono gli utenti 3 e 4?
- Vuole l'autonomia piena degli utenti da dentro l'app (opzione a)?

## Sessione 2026-10-13 (12) – Utenti decisi: Christian amministratore, 3 postazioni, gestione utenti solo a Christian

### Decisioni dell'utente
- **Christian = amministratore** ed è **l'unico che può fare le CRUD degli utenti** (aggiungere, modificare, disattivare, eliminare).
- Gli altri **3 utenti sono postazioni di lavoro**: **Cassa**, **Laboratorio**, **Vendite**. Possono avere gli stessi permessi (**nessuna restrizione** sui moduli): l'unica differenza è che **non vedono né usano la gestione utenti**.
- Le email le farà mandare da Christian; i login si configurano a fine serata.

### Modello utenti (da implementare nel Worker/D1)
- Tabella `users`: `id`, `email` (unica, minuscola), `name` (es. "Christian", "Cassa", "Laboratorio", "Vendite"), `role` (`admin` | `staff`), `active`, `protected`, `created_at`, `last_login`.
- **Permessi**: tutti i moduli (Oggi, Riparazioni, Clienti, Magazzino, Vendite, Fornitori, Cassa, Impostazioni, Backup, Vetrina usati) per `admin` e `staff`; **solo `admin` vede la pagina "Utenti" e le API `/api/users*`**. Il controllo è **nel Worker** (risposta 403), non solo nella grafica; test automatici dedicati (staff → 403 su ogni rotta utenti, admin → ok).
- **Regole di sicurezza**: non si può eliminare/disattivare l'ultimo amministratore né se stessi; email duplicate rifiutate; ogni modifica agli utenti viene registrata (chi, cosa, quando); un utente disattivato non entra anche se ha un codice valido.
- **Autonomia vera di Christian** (richiesta implicita: lui crea utenti senza il pannello Cloudflare): si adotta l'opzione **(a)**: Cloudflare Access configurato su "chiunque riceva il codice via email" e **il Worker è l'unico a decidere chi entra** confrontando l'email del JWT di Access con la tabella `users` (middleware globale su **tutte** le rotte, compresi i file statici: `run_worker_first`). Test: email non in elenco → 403 ovunque; utente disattivato → 403; token scaduto/audience errata → 401. (L'alternativa (c), aggiornare la policy Access via API Cloudflare con un token, resta di riserva.)
- **Proprietario/supporto**: da confermare se `marcopeluso99@gmail.com` resta come amministratore **protetto** (non modificabile da Christian, utile per assistenza). Senza conferma: si crea come `admin` con `protected=1`, invisibile nell'elenco ma attivo.
- **Chi ha fatto cosa**: ogni evento della cronologia delle riparazioni, ogni vendita/incasso e ogni modifica registrano il **nome dell'utente** (Cassa, Laboratorio, Vendite, Christian): extra utile per Christian (es. "Consegnata da Cassa", "Diagnosi di Laboratorio"). Si aggiunge `user` alle tabelle `repair_events`, `sales`, `payments`.
- **Email delle postazioni**: ogni postazione ha bisogno di un indirizzo che riceva il codice. Suggerimento: indirizzi dedicati `cassa@`, `laboratorio@`, `vendite@informatixrepair.com` creati con **Cloudflare Email Routing** (gratuito) che **inoltrano a Christian**; in alternativa email personali. Per non dover chiedere il codice ogni volta: **durata della sessione Access lunga** (fino a 1 mese, da verificare nel pannello) e dispositivi fissi "ricordati".
- **Pagina "Utenti" (solo admin)**: elenco con nome, email, ruolo, stato, ultimo accesso; pulsanti Aggiungi, Modifica, Attiva/Disattiva, Elimina; messaggi chiari; stessa grafica del resto (design system, 44 px, accessibile); manuale aggiornato con la sezione "Utenti".

### Ordine di lavoro (aggiornato)
1) Access + Worker/D1 + tracciamento; 2) **Utenti (middleware + pagina) e Portale**; 3) sito; 4) Vetrina Usati integrata. Le **stime** del piano restano 20-30 h; Utenti completo +1,5 h (già compreso nella voce "Portale + utenti").

### Aperto
- Conferma del ruolo del proprietario (`marcopeluso99@gmail.com`): admin protetto?
- Email delle 4 postazioni/utenti (da Christian); se usare gli alias con Email Routing.

## Sessione 2026-10-13 (13) – Utenti per fasi e stima in token

- L'utente non ha ancora le email di Christian: gli appunti sugli utenti restano validi, i profili si creano quando arrivano le email. **Stasera si crea solo il profilo del proprietario** (`marcopeluso99@gmail.com`, admin protetto) per poter entrare a fine lavori.
- Domanda sulla stima in **token**: risposta data in chat (ordine di grandezza 3-6 milioni di token per il piano completo, margine ±50%; il vincolo reale è il tempo e la lunghezza della conversazione, non il budget). Nessuna azione di sviluppo.

## Routine automatica
- 2026-09-28 18:03 – pubblicati 2 articoli: "iPhone 18 Pro, il bug che riavvia il telefono dopo un Face ID fallito" e "WhatsApp sta testando un avviso automatico contro le truffe nei messaggi".
- 2026-09-30 09:03 – pubblicati 2 articoli: "Android, il bollettino di settembre corregge 180 vulnerabilità: il più corposo dell'anno" e "Batterie sostituibili dal 2027, per gli smartphone non ci sarà lo sportellino".
- 2026-09-30 18:03 – pubblicati 2 articoli: "Tre dipendenti su quattro nell'Unione Europea hanno incontrato una minaccia informatica sul lavoro" (sondaggio Eurobarometro Commissione Europea) e "Riconoscimento facciale in tempo reale per la polizia, da oggi la nuova norma è operativa" (decreto legislativo 160/2026, entrato in vigore il 30 settembre).
- 2026-10-01 07:03 – pubblicati 2 articoli: "Digitale terrestre, dal 1 ottobre cambiano le frequenze: cosa fare se la TV perde i canali" e "App Store in Europa, da oggi commissioni più basse e più libertà nei pagamenti" (accordo Apple-Commissione europea, DMA).
- 2026-10-01 18:04 – pubblicati 2 articoli: "Fastweb, rincari sulla rete fissa da novembre: chi può recedere senza penali" (rimodulazioni comunicate da oggi, recesso senza penali entro il 1 gennaio 2027) e "Una falla critica nei sistemi Cisco per reti aziendali è già sotto attacco" (CVE-2026-76504, CVSS 9,8, aggiunta al catalogo KEV di CISA il 30 settembre).
- 2026-10-02 09:04 – pubblicati 2 articoli: "Finti rimborsi dell'Agenzia delle Entrate, torna la truffa via email" (campagna di phishing segnalata il 30 settembre da Fisco Oggi, domini falsi come agenziaentratel.shop) e "Samsung rilascia l'aggiornamento di sicurezza di ottobre per i pieghevoli Z Fold8 e Z Flip8" (rollout partito dalla Corea del Sud, livello patch 5 ottobre 2026).
- 2026-10-02 18:05 – pubblicati 2 articoli: "Quishing, la truffa del QR code che finisce su multe false e colonnine di ricarica" (caso segnalato a Modena da alVolante) e "WhatsApp Business, dal 1° ottobre arrivano i costi per i messaggi di assistenza: chi deve preoccuparsi" (tariffe italiane riportate da WebNews e WA Smart Business, solo per chi usa la Business Platform/API).
- 2026-10-03 09:05 – pubblicati 2 articoli: "Truffa del finto ispettore di polizia, a Genova sottratti 89mila euro con una telefonata" (caso del 2 ottobre a Recco riportato da Ansa) e "Windows 10, gli aggiornamenti di sicurezza gratuiti sono garantiti fino a ottobre 2027" (programma ESU consumer esteso, confermato sulla pagina di supporto Microsoft).
- 2026-10-03 ~15:40 – pubblicati 2 articoli: "Finti assistenti ChatGPT usati per diffondere virus: il trucco del comando da copiare" (campagna ClickFix scoperta da Huntress a fine settembre, GPT personalizzati su chatgpt.com che portano a un falso CAPTCHA e a un comando PowerShell che installa un trojan di accesso remoto) e "Diritto alla riparazione, l'Italia finisce nel mirino di Bruxelles" (fatto nuovo rispetto all'articolo del 24/09: procedura d'infrazione UE apertura il 25 settembre nonostante il Ministero dichiari il recepimento completato il 16 settembre, fonte Il Sole 24 Ore).
- 2026-10-04 09:07 – pubblicati 2 articoli: "Festa delle Offerte Prime di Amazon il 6 e 7 ottobre, come comprare elettronica senza rischi" (date confermate da Amazon, consigli contro i siti clone e le finte offerte che aumentano durante i saldi) e "Mezzo milione di credenziali ancora attive trovate nel codice pubblico usato per addestrare l'IA" (ricerca di Truffle Security sul dataset The Stack v3, segnalata il 1° ottobre da CERT-AGID: 543.699 credenziali ancora valide, età media 784 giorni).
- 2026-10-05 18:04 – pubblicati 2 articoli: "Falso SMS Nexi, la truffa del pagamento da 1.275 euro che chiede di richiamare un numero" (ondata di smishing segnalata il 5 ottobre nel Varesotto da Prealpina, schema già visto nei mesi scorsi in altre città italiane) e "Google Pixel 6 e 6 Pro, il supporto software finisce questo mese" (ultima patch di sicurezza garantita a ottobre 2026, confermata da Smartworld; il Pixel 6a della stessa generazione riceverà aggiornamenti fino a luglio 2027).
- 2026-10-06 09:07 – pubblicati 2 articoli: "Gemini gratuito si restringe dal 9 ottobre, ecco cosa cambia" (annuncio Google ripreso per primo da 9to5Google, confermato da Notebookcheck: dal 9 ottobre gli utenti free perdono Flash e Pro e restano con il solo Flash-Lite) e "iPhone Duo, un falso sito di preordine prende di mira i portafogli crypto" (truffa segnalata a inizio ottobre da Malwarebytes, catena di exploit DarkSword su siti che imitano Apple in vista dell'apertura preordini del 16 ottobre).
- 2026-10-06 18:07 – pubblicati 2 articoli: "Torna la 'truffa della ballerina' su WhatsApp, un finto concorso che ruba l'account" (segnalazione CERT-AGID del 6 ottobre: un codice di verifica richiesto durante un falso voto autorizza in realtà un dispositivo estraneo sull'account della vittima) e "Una settimana di truffe online in Italia, 219 campagne tra finti rimborsi e multe false" (riepilogo CERT-AGID della settimana 26 settembre - 2 ottobre: 1.436 indicatori di compromissione, temi più usati rimborsi fiscali, multe false SEND/PagoPA, banche e finti premi).
- 2026-10-07 09:07 – pubblicati 2 articoli: "Bastano tre secondi di voce per clonarla, cresce il rischio delle truffe con l'audio falso" (dati McAfee ripresi da Ansa il 5 ottobre: costo di circa 30 dollari e tre-cinque secondi di audio per un clone vocale con l'85% di corrispondenza) e "Apple stringe i controlli sull'accesso dei sistemi IA ai dati del Mac" (annuncio Apple del 2 ottobre dopo le polemiche sull'assistente Muse di Meta, che avrebbe letto messaggi privati su Mac senza autorizzazione esplicita).
- 2026-10-08 09:08 – pubblicati 2 articoli: "Bollettino di sicurezza Android di ottobre, corrette 25 vulnerabilità: 7 sono critiche" (bollettino Google datato 5 ottobre 2026, fonte source.android.com, copre Android 14-17) e "Samsung, la patch di sicurezza di ottobre corregge 83 vulnerabilità su Galaxy S26 e pieghevoli" (pacchetto SMR Oct-2026 Release 1 avviato il 6 ottobre, fonte AndroidHeadlines, con il dettaglio tecnico mancante nell'articolo del 2 ottobre sui pieghevoli).
- 2026-10-09 09:06 – pubblicati 2 articoli: "Hacker usano l'intelligenza artificiale per violare banche coreane, esposti i dati di 68mila persone" (Wall Street Journal e analisi CrowdStrike dell'8 ottobre, strumento agentico ARTEX usato contro sette istituti sudcoreani tra cui Shinhan, KB Kookmin e Hana) e "Revolut pagherà i nuovi documenti ai clienti colpiti dalla violazione dei dati di settembre" (dichiarazione del 7 ottobre a BFM TV della responsabile Europa occidentale Beatrice Cossa-Dumurgier, fatto nuovo rispetto alla violazione confermata il 12 settembre legata a una PEC italiana compromessa).
- 2026-10-09 18:06 – pubblicati 2 articoli: "Chrome, aggiornamento critico a inizio ottobre" (aggiornamento del 6 ottobre riportato da Malwarebytes il 7 ottobre: 247 correzioni di sicurezza, quattro critiche, incluse due use-after-free con possibile esecuzione di codice fuori sandbox) e "ChatGPT per adolescenti, uno studio indipendente lo giudica a rischio" (analisi del Youth AI Safety Institute/Common Sense Media su oltre 4.000 conversazioni, riportata da Ansa il 7 ottobre: mancate notifiche ai genitori in caso di crisi e verifica dell'età elusa dagli account adulti).
- 2026-10-10 09:05 – pubblicati 2 articoli: "Apple torna sulla casa connessa, evento 'Welcome Home' il 13 ottobre" (annuncio ufficiale riportato da Ansa il 9 ottobre, nuovo hub domestico con Siri e aggiornamenti attesi di HomePod mini e Apple TV) e "Il Consiglio di Stato conferma il diritto a un operatore umano nei call center delle telecomunicazioni" (sentenza riportata da Agenda Digitale l'8 ottobre, che conferma la delibera Agcom 255/24/Cons contro il blocco permanente su chatbot e risponditori automatici).
- 2026-10-10 18:04 – pubblicati 2 articoli: "Samsung Galaxy S26 violato più volte alla gara di hacking Pwn2Own Ireland" (resoconto ufficiale Zero Day Initiative del 6-7 ottobre e cronaca BleepingComputer: 32 zero-day sfruttati il primo giorno, 388.500 dollari in premi, telefono compromesso da più team) e "Una settimana di phishing in Italia, 178 campagne e malware bancari via SMS" (sintesi CERT-AGID della settimana 3-9 ottobre pubblicata il 9 ottobre: 178 campagne, 1.233 IoC, nuovi trojan Android Herodotus/MidnightMimosa/Novinarya diffusi via SMS).
- 2026-10-11 09:05 – pubblicati 2 articoli: "Due falle critiche nei router ASUS, perché conviene aggiornare il firmware subito" (bollettini ASUS del 1° ottobre riportati da cybernews.com e secnews.gr: CVE-2026-14157, CVSS 9,4, caricamento di un file VPN malevolo nell'interfaccia di gestione; CVE-2026-13313, CVSS 8,9, esecuzione di comandi con privilegi elevati) e "Dai tribunali di Londra alle spiagge norvegesi, gli occhiali smart finiscono nel mirino dei divieti" (articolo Ansa del 10 ottobre: dati IDC su crescita del 167% del mercato nel primo trimestre 2026, divieti o valutazioni in corso in Norvegia, Regno Unito, New York e Australia, sospensione delle vendite dei Ray-Ban Meta da parte di una catena di ottica in Olanda e Belgio).
- 2026-10-11 18:06 – pubblicati 2 articoli: "Malware già installato di fabbrica su telefoni Android economici: cosa sapere su Midnight Mimosa" (campagna scoperta da Bitdefender, riportata l'8-9 ottobre da più fonti tra cui Hackread, Smartworld e Android Authority: codice nella partizione di sistema di telefoni low cost con chip MediaTek come Doogee S200 X e Cubot KINGKONG X, migliaia di dispositivi in oltre 150 paesi, Italia tra i più colpiti; campagna distinta dal trojan bancario "MidnightMimosa" via SMS già citato nel bollettino CERT-AGID dell'articolo del 10/10) e "Vodafone aumenta il canone fisso per i clienti convergenti dal 30 novembre" (avviso pubblicato il 9 ottobre nella sezione Vodafone Informa, ripreso da MondoMobileWeb: rincaro da 0,95 a 3,99 euro al mese, chiamate nazionali illimitate incluse come compenso, diritto di recesso indicato in fattura).
- 2026-10-12 09:26 – pubblicati 2 articoli: "Riparte 'I Navigati', la campagna delle banche contro le truffe che usano l'intelligenza artificiale" (campagna CERTFin/Banca d'Italia/ABI partita il 9 ottobre, verificata sulla pagina ufficiale bancaditalia.it, focus sulle frodi costruite con l'IA, sito inavigati.certfin.it e incontri in filiale) e "Android, parte in quattro paesi la verifica degli sviluppatori per le app installate fuori dal Play Store" (obbligo attivo dal 30 settembre in Brasile, Indonesia, Singapore e Thailandia, confermato dal blog ufficiale Android Developers e da Help Net Security/Notebookcheck, estensione globale annunciata per il 2027).
- 2026-10-12 18:07 – pubblicati 2 articoli: "Windows 11 24H2 Home e Pro, il supporto finisce il 13 ottobre" (scadenza confermata da BleepingComputer, TechRepublic e Pureinfotech: dal 13 ottobre niente più patch di sicurezza per le edizioni Home/Pro, Enterprise ed Education protette fino al 12 ottobre 2027) e "Smartphone e PC sempre più cari, dietro i rincari c'è la corsa alle memorie per l'IA" (analisi Geopop del 9 ottobre con dati IDC/Counterpoint: costo delle memorie cresciuto di oltre il 300% in un anno, prezzo medio smartphone stimato in aumento del 27,6% nel 2026, rincari già visibili sui listini italiani di iPhone 17 e Galaxy S26 Ultra).
- 2026-10-13 09:11 – pubblicati 2 articoli: "Le vendite di PC crollano del 20% nel terzo trimestre, colpa anche delle memorie" (dati IDC riportati l'11 ottobre da Punto Informatico e Notebookcheck: spedizioni mondiali scese a 62,7 milioni di unità, -20,1% annuo, HP e Dell i cali peggiori tra i grandi produttori, legato alla stessa crisi delle memorie dell'articolo del 12/10) e "iPhone Duo, i preordini partono il 16 ottobre: prezzi ufficiali e un'attenzione in più" (fatto nuovo rispetto agli articoli del 25/09 e del 6/10: listino italiano ufficiale confermato da Apple e ripreso da Affaritaliani, da 2.369 a 3.869 euro, con richiamo al rischio di siti falsi di preordine).

## Sessione 2026-10-13 (notte) – Officina ONLINE su Cloudflare
- **Motore unico**: `officina/` ora e' Hono + logica asincrona; `db-node.mjs` (SQLite locale per PC/test) e `db-d1.mjs` (Cloudflare D1) implementano la stessa interfaccia (`dbref.mjs`). Rimossi `api.mjs` e `db.mjs` (Express). `server.mjs` avvia ancora 4950/4951. Date in fuso Europe/Rome (`nowLocal`), niente `datetime('now','localtime')` lato D1: il testo SQL viene sostituito dall'adattatore.
- **Worker** `officina/worker.mjs` + `wrangler.jsonc`: host `gestionale.informatixrepair.com` (Cloudflare Access + tabella `users`, fail-closed) e `riparazioni.informatixrepair.com` (solo tracciamento pubblico). D1 `officina` (id nel wrangler.jsonc), migrazione `officina/migrations/0001_init.sql`. Deploy: `npx wrangler deploy --config officina/wrangler.jsonc` da `informatix-repair`.
- **Access**: team `team-informatix.cloudflareaccess.com`, AUD nel wrangler.jsonc, login One-time PIN, policy "Staff Informatix" = **Everyone** (chi entra davvero lo decide la pagina Utenti del gestionale).
- **Utenti**: pagina Utenti (solo admin), proprietario `marcopeluso99@gmail.com` protetto, Christian `djchri.cp@gmail.com` admin. Il Worker blocca chi non e' in elenco.
- **Ricerca cliente**: `POST /api/lookup` (ricevuta + ultime 4 cifre, limite tentativi, CORS solo per informatixrepair.com).
- **Sito** (branch `sito-segui-riparazione`, NON in main): pagina `segui-riparazione.html`, sezione in home, link "Area riservata" nel footer.
- Test API: 14 verdi. Backup: download JSON da `/api/backup` (D1 non ha VACUUM INTO); backup giornaliero su R2 da fare (R2 non attivo).
- **Da fare**: R2 + cron backup; Vetrina Usati sul Worker (+ decisione bot Telegram); Portale unico + manuale; ripassare Cypress su `cypress-tests` (merge di gestionale-officina); via libera per portare il sito in main; prove hardware di Christian.

## Nuovo sviluppo richiesto (2026-10-13, notte) – Import ordini fornitore e prezzi d'acquisto (da fare in fondo al piano)
Richiesta di Christian: nel magazzino importare un PDF o riepilogo ordine del fornitore.
1. Dal PDF caricare i prodotti acquistati (carico di magazzino).
2. Se il fornitore e' lo stesso, confrontare il prezzo di acquisto con quello precedente.
3. Grafico dell'andamento del prezzo di acquisto per prodotto.
4. Avvisi (sezione Notifiche e/o home): al nuovo ordine, se un pezzo gia' in magazzino dello stesso fornitore ha prezzo diverso dall'ultimo ordine, mostrare il dettaglio (piu' alto / piu' basso della volta scorsa).
5. Le vendite scalano gia' le scorte: aggiungere soglie di scorta minima **personalizzabili da Impostazioni** (globale + per prodotto) e avvisi (anche in home) "il prodotto X sta per esaurire, da riordinare".
Note tecniche: lettura PDF nel browser (pdf.js), schermata di revisione prima di confermare (i PDF dei fornitori sono tutti diversi), PDF scansionati = OCR da valutare; tabella storico prezzi (`price_history`) e tabella `notifications`; D1 + Worker invariati. Serve almeno un PDF di esempio per fornitore.

## Aggiunta (2026-10-13, notte) – Pagamento "non tracciato" e opzione cassa
- Nuovo metodo di pagamento **"non tracciato"** su vendite, saldo/acconto riparazioni. Impostazioni → Cassa: "Conteggiali nella cassa" (default) oppure "Non mostrarli nella cassa" (setting `cash_show_untracked`). I pagamenti restano SEMPRE salvati nel database (magazzino e riparazioni coerenti); se esclusi non entrano in totali, grafico e incasso di oggi, e la Cassa mostra una nota col numero di pagamenti esclusi. Test API: 15 verdi.

## Nuovo sviluppo richiesto (2026-10-13, notte) – Rotazione prodotti e invenduto (in coda, con l'import fornitori)
- Grafico dei prodotti **piu' richiesti / meno richiesti** (pezzi venduti e usati nelle riparazioni nel periodo).
- **Allarme "invenduto"**: se un prodotto in magazzino non si muove da troppo tempo (soglia in Impostazioni, globale e per prodotto) -> avviso in home/Notifiche con suggerimento "crea un'offerta" o "controlla il prezzo di vendita".
- Dati gia' presenti: `sale_items`, `repair_parts`, `stock_moves`; serve solo calcolo "ultimo movimento di uscita" e vendite per periodo. Bozza grafico acquisti di Christian: punti etichettati "Fornitore · prezzo" nel tempo, anche tra fornitori diversi per lo stesso prodotto (da confermare con lui).

## Progetto "Analisi" (2026-10-13, notte) – assorbe le richieste su prezzi fornitori, scorte e rotazione
Sezione unica **Analisi** (solo admin), filtro periodo, 5 schede: Riparazioni (stati, tempi, modelli, guasti, ritardi, preventivi rifiutati); Incassi (giornalieri, confronto periodo, metodi, margine); Vendite (fatturato, scontrino medio, prodotti piu'/meno venduti); Acquisti e prezzi fornitori (**grafico a punti** per prodotto: un punto per acquisto, colore per fornitore, linea tra i punti, minimo evidenziato, variazione su/giu' rispetto all'ordine precedente, etichetta "Fornitore · prezzo" come da bozza di Christian); Magazzino (valore, sotto soglia, invenduto). Avvisi con campanella + riquadro in home: scorta bassa, prodotto fermo (azione: riordina / crea offerta / controlla prezzo), prezzo d'acquisto cambiato, riparazioni in ritardo; soglie in Impostazioni. Calcoli lato Worker; unica tabella nuova: storico prezzi d'acquisto (con l'import PDF). Grafici accessibili (contrasto, valori leggibili senza colore, tastiera), su telefono diventano elenchi/barre.
Ordine: 1) Riparazioni+Incassi+Vendite (~3-4 h), 2) Magazzino+rotazione+avvisi (~2-3 h), 3) Import PDF + grafico prezzi (~6-9 h, servono PDF di esempio).

## Nuovi sviluppi richiesti (2026-10-13, notte) – da fare DOPO tutto il resto
### Buoni sconto e buoni regalo
Sezione "Buoni": creare buoni sconto (importo o %) e buoni regalo (credito) con grafica carina, logo e **template** impostabile (colori, testo, validita', condizioni, logo) salvato in Impostazioni; stampa/PDF del buono con QR/codice a barre. In Cassa/Vendite: campo "Buono" (digitato o letto con la pistola) che detrae dal totale; il buono regalo si usa anche a piu' riprese (saldo residuo). Tabelle: `vouchers` (codice, tipo, valore, saldo, scadenza, stato, cliente opzionale) e `voucher_uses` (storico). Uso atomico con UPDATE condizionato (`saldo >= ?`) perche' D1 non ha transazioni.
### Carte fedelta' per cliente (NFC)
Per ogni cliente: saldo punti (sempre consultabile dal gestionale, anche **senza carta**), CRUD punti (accredito, riscatto, rettifica) con storico; stato "carta creata si/no"; se manca e il cliente la chiede, parte il flusso "associa carta" con il lettore NFC. **Regolamento punti in arrivo da Christian** (per ora solo struttura: `loyalty_accounts` con `card_uid` univoco opzionale + `loyalty_moves` registro movimenti; i punti stanno nel database, MAI sulla carta). Acquisti incrementano i punti, riscatti li detraggono.
Scelta hardware (da validare con prova di Christian): la carta contiene solo l'UID. Lettore USB "emulazione tastiera" (come la pistola codici: riusa `isScanEnter`) oppure telefono Android con Web NFC (https); lettori PC/SC tipo ACR122U NON sono leggibili dal browser senza software locale. Normalizzare il formato dell'UID (esadecimale/decimale, ordine byte) al primo abbinamento. Fallback: codice a barre sulla carta o ricerca per telefono.

## Analisi - prima parte fatta (2026-10-13, notte)
- `GET /api/analytics?from&to` (solo admin) + pagina **Analisi** (`officina/public/analytics.js`, schede Riparazioni / Incassi / Vendite, barre con valori scritti). Test API: 16 verdi. Online (deploy fatto).
- **Manuale aggiornato** (`officina/public/manuale.html`): accesso online, backup nel cloud, pagamento "non tracciato", sezioni nuove 15 Utenti e 16 Analisi. REGOLA: ogni sviluppo aggiorna anche il manuale.
- Da fare: test Cypress per Analisi/Utenti (ui-review e responsive) su `cypress-tests`; scheda Magazzino/rotazione/avvisi/notifiche; schermate del manuale per Analisi e Utenti.

## Dati demo (2026-10-13, notte)
`officina/demo.mjs`: dati dimostrativi completi (3 fornitori, 14 prodotti con scorte basse/esaurite/invenduto, 8 clienti, 14 riparazioni in tutti gli stati, 13 vendite, incassi, anche "non tracciato"). Tutte le righe demo hanno **id negativo** (i dati veri sono positivi): "Elimina demo" cancella solo `id < 0` ed e' sicuro. API `GET/POST/DELETE /api/demo` (admin) e riquadro "Dati demo" in Impostazioni. Codici DEMO-001..014, token demo-token-N (ricerca: DEMO-004 + 0104). Manuale: sezione 17. Test API: 17 verdi.

## Avvisi e scheda Magazzino (2026-10-14)
`logic.alerts()` + `GET /api/alerts`: esaurito, sotto scorta, prodotto fermo (ultima uscita da stock_moves/vendite/ricambi), riparazione in ritardo, preventivo rifiutato, pronta non ritirata. Soglie in Impostazioni → Avvisi (`low_stock_default`, `stale_days`, `ready_days`; 0 = spenta). UI: campanella con badge, riquadro in Oggi, scheda Magazzino in Analisi. Manuale aggiornato. Test API: 18 verdi (corretti 2 test che usavano la data UTC invece di quella di Roma). Da fare: avvisi di variazione prezzo d'acquisto (con import PDF), Cypress per campanella/Analisi, schermate del manuale.

## Precisazione import ordini / DDT (2026-10-14)
Analisi richiesta da Christian: **per prodotto e per fornitore, prezzo d'acquisto dell'ordine precedente vs nuovo** (valore e %, con grafico a punti). Import anche del **DDT**. Nota: il DDT spesso non e' valorizzato (niente prezzi): i prezzi stanno nella **fattura**. Fonti, per affidabilita': 1) fattura elettronica XML (FatturaPA, strutturata) 2) PDF digitale (tarato su esempi per fornitore) 3) foto/scansione (OCR, per ultimo). Flusso: carica -> schermata di revisione -> abbinamento prodotti (codice fornitore, poi nome) -> carico magazzino + storico prezzi (`price_history`) -> avvisi di variazione; DDT e fattura dello stesso ordine si collegano. Servono: esempio di DDT e fattura per fornitore, formato in cui li riceve, possibilita' di avere le fatture XML.

## Cassa rifatta (2026-10-14)
Layout con spaziatura uniforme (stile condiviso con Analisi: `AN_CSS`, `hbars`, `kpi` esportati da `analytics.js`) e analisi a grafici: metodo di pagamento, riparazioni vs vendite, incassi per giorno, giorno della settimana, ora del giorno; KPI incassato/operazioni/media/costi. Periodi 7/30/90 giorni e apertura diretta con `#/cassa?days=30`. Manuale aggiornato. Cypress: nuovo spec `novita.cy.js` (10 test: demo, campanella, Analisi, Utenti, non tracciato) e pagine Analisi/Utenti in ui-review; il test del menu ora aspetta 12 voci.

## Progetto futuro: gestionale vendibile ai clienti (2026-10-14, idea personale di Marco, DOPO il completamento per Christian)
Scelta consigliata: **installazione separata per cliente** (Worker + D1 + R2 propri, stesso codice, provisioning da script) + **pannello centrale** (elenco clienti, versione, stato, creazione con un comando, aggiornamento di tutti). Personalizzazione per cliente: logo, nome, indirizzo, colori, condizioni, moduli on/off (feature flag). Alternativa multi-tenant (un DB con tenant_id) scartata: rischio di mescolare dati e riscrittura estesa.
Punti da decidere: **login centralizzato** (Cloudflare Access gratis ha ~50 utenti per account totali: serve login proprio con codice via email o piano a pagamento); chi paga hosting (account Cloudflare del cliente o rivendita nel canone); contratto/licenza, privacy e accordo sul trattamento dati; gestionale non fiscale; togliere dal codice i riferimenti a Informatix (nome, indirizzo, condizioni) spostandoli in impostazioni per cliente. Domande a Marco: altri settori o solo riparazioni? canone o una tantum? hosting tuo o del cliente? quanti clienti il primo anno?

## Demo con incassi di oggi (2026-10-14)
Dati demo estesi: 6 vendite tra oggi e ieri a orari diversi (grafico "ora del giorno"), 2 acconti di oggi/ieri su riparazioni, orari vari anche nei giorni passati; la Cassa (che si apre su "oggi") mostra subito dati. Test API: la cassa di oggi ha >= 4 incassi. Chi ha gia' caricato i demo: elimina e ricarica.

## Nota spese in PDF e registro spese (2026-10-14)
Richiesta di Marco/Christian: bottone "Genera nota spese (PDF)" nella Cassa. Ricerca: la nota spese e' un documento di USCITE senza modello unico di legge; contenuto formale = intestazione azienda, periodo e numero, chi ha sostenuto le spese, elenco voci (data, causale, categoria, documento tipo+numero, IVA, importo), totali, riepilogo per categoria, giustificativi originali da allegare e conservare, firma di chi ha sostenuto la spesa e approvazione del responsabile. Fonti: money.it, partitaiva.it, studiopizzano.it, ecnews.it, tot.money, qonto.com.
Fatto: tabella `expenses` (migrazione `0002_expenses.sql`), `expenses.mjs` (CRUD + totali per categoria), `notaspese.mjs` (PDF A4 con pdf-lib, piu' pagine, caratteri non latini sostituiti da "?"), API `/api/expenses*` e `/api/expenses-pdf`, UI in Cassa (Nuova spesa, elenco spese del periodo, KPI "Spese" e "Incassi meno spese", finestra "Genera nota spese" con nome e filtro "solo da rimborsare"), 9 spese demo, backup JSON include `expenses`. Test API 19 verdi; PDF verificato con estrazione testo (nessun testo fuori margine o sovrapposto). Manuale aggiornato. Da fare: test Cypress per spese/nota spese; eventuale invio del PDF per email.
Domanda per Christian: la nota spese e' quella che immaginava (uscite del negozio e rimborsi), o voleva un documento diverso (es. nota spese verso un cliente)? Campi da aggiungere?

## Notifiche Telegram (2026-10-14)
Bot **@informatix_repair_bot** (token = segreto del Worker `TELEGRAM_BOT_TOKEN`, impostato con `wrangler secret put`, MAI nel codice/repo/memoria). Il messaggio parte solo verso `TELEGRAM_OWNER_ID` (segreto, da impostare: l'ID Telegram di Marco). Solo invio: nessun comando in ingresso, quindi nessun altro puo' usarlo. `officina/notify.mjs`: `describeEvent` (testi dettagliati in italiano per riparazioni, stati, consegne/incassi, acconti, note, ricambi, vendite, spese, clienti, fornitori, magazzino, utenti, impostazioni, demo, backup, stampe, risposta del cliente al preventivo), accessi (primo uso dopo 6 ore, `users.last_seen_at`, migrazione 0003), accessi NEGATI (email non abilitata), errori 5xx (anti-raffica 5 minuti), errori non gestiti del Worker, esito del backup notturno. PIN dei dispositivi, password e token non vengono mai inviati; telefono mascherato. Test API: 19 verdi. Da fare: ID proprietario; notifiche della Vetrina Usati (quando sara' sul Worker); eventuale riepilogo giornaliero.

## Bot Termux (2026-10-14)
Cartella `termux-bot/` (Python 3, solo libreria standard). Solo invio al proprietario su Telegram, nessun comando in ingresso. Controlla ogni 5 min gestionale (302/200/401/403 = vivo), riparazioni (404 = vivo), sito e usati.json; avviso solo al cambio di stato dopo 2 controlli falliti, con durata del down; riepilogo alle 21:00 Europe/Rome (usati.json ha solo `count`/`items` senza campo venduto: si riporta il totale). Contratto per il Termux Control Center: ~/informatix-bot, `python main.py`, bot.pid, logs/bot.log ruotato, file heartbeat, secondo avvio rifiutato. Script start/stop/restart/status/logs solo per uso senza Control Center. Test: `python -m unittest discover -s termux-bot/tests`.
Test notifiche reali: 41 messaggi inviati, tutti ok=true. Corretti in notify.mjs: nome ricambio mancante, 'non riuscito' -> 'operazione non riuscita', campi impostazioni in italiano, eliminazioni con numero, stampa/backup/PDF solo se riusciti, token mascherato negli errori.

## STATO A FINE GIORNATA 2026-10-14 (notte) – dove siamo arrivati
**Online e funzionante**: gestionale su `gestionale.informatixrepair.com` (Access, utenti, Analisi, Cassa con grafici + spese + nota spese PDF, avvisi/campanella, dati demo, backup R2 notturno, pagamento "non tracciato"); tracciamento pubblico `riparazioni.informatixrepair.com` + ricerca per ricevuta; **sito pubblico in `main`** con "Segui la tua riparazione" e "Area riservata" (via libera dato il 2026-10-14). Notifiche Telegram al proprietario attive (@informatix_repair_bot; segreti del Worker TELEGRAM_BOT_TOKEN/TELEGRAM_OWNER_ID).
**Bot Termux** installato sul Samsung (cartella `~/informatix-bot` con venv e `.env` 600), registrato in `Termux-Launcher/bots.conf` (backup `bots.conf.bak-pre-informatix-2026-10-14`) e avviato dal Control Center (`bot_ctl.sh informatix_repair start|stop|restart`); gli altri 10 bot non toccati. Il bot controlla gestionale/tracciamento/sito/usati ogni 5 minuti e manda il riepilogo alle 21:00.
**Test**: API 20 verdi (branch gestionale-officina); Cypress su `cypress-tests` 221 test (13+43+10+11+10+134) verdi, commit 04f5bc4.
**Agenti ancora aperti alla chiusura** (lavoro nei loro worktree/branch, DA FONDERE in `gestionale-officina` dopo la loro consegna, poi migrazioni + deploy): (1) Vetrina Usati sul Worker + Portale unico (migrazione 0004); (2) Import fatture XML (FatturaPA) + storico prezzi + grafico a punti + avvisi prezzi (migrazione 0005). Le loro sezioni di stato sono nel CHATLOG dei rispettivi branch.
**Da fare dopo**: fondere i due branch (conflitti probabili solo in app.mjs, public/app.js, notify.mjs), `wrangler d1 migrations apply officina --remote`, `wrangler deploy --config officina/wrangler.jsonc`, Cypress aggiornato; DDT/PDF fornitori (servono campioni); buoni sconto/regalo; carte fedelta' NFC; versione vendibile ai clienti. Domande per Christian: docs/DOMANDE-APERTE.md.
**Promemoria sicurezza**: il token del bot e' stato scritto in chat: rigenerarlo da BotFather (/revoke) a fine lavori e aggiornare i segreti (`wrangler secret put TELEGRAM_BOT_TOKEN` e `.env` su Termux).

### Aggiornamento stato (mattina 2026-10-14): due agenti interrotti dal limite di sessione, lavoro salvato
- **Vetrina Usati + Portale**: branch `worktree-agent-acc7fa5f69abbcf69` (worktree `.claude/worktrees/agent-acc7fa5f69abbcf69`). Fatto e committato: API nel Worker, D1 (migrazione `0004_usati.sql`), publisher GitHub/bozza, archivio foto, notifiche Telegram; test `npm run test:officina` 26 verdi. Interfaccia (`usati.js`, `portale.js`, voci di menu) salvata come WIP ma NON finita/verificata. Mancano: rifinitura UI e screenshot a 4 formati, manuale (sezione Vetrina e Portale), CHATLOG/DOMANDE proprie, segreto `GITHUB_TOKEN`, bucket media R2.
- **Import fatture XML + prezzi**: branch `worktree-agent-abb82441c706f929f` (worktree `.claude/worktrees/agent-abb82441c706f929f`). Fatto e committato: parser FatturaPA, import in 2 passi, storico prezzi, avvisi, API, migrazione `0005`; test 32 verdi. Interfaccia `purchases.js` salvata come WIP, NON finita/verificata. Mancano: UI con revisione e grafico a punti, voce di menu, dati demo con acquisti, manuale, CHATLOG.
- Per ripartire: resumere i due agenti oppure rifare la fusione a mano in `gestionale-officina`, poi `wrangler d1 migrations apply officina --remote`, deploy, Cypress.

## Stato Vetrina usati online + Portale (2026-10-14, giornata interrotta)

**Fatto (branch del worktree, test:officina 26/26 verdi):**
- Vetrina usati dentro il Worker: API `/api/usati` (elenco, crea, modifica, venduto/non venduto, elimina solo admin, foto, riordino, pubblica), codice in `officina/usati.mjs`.
- Database: migrazione `officina/migrations/0004_usati.sql` (tabelle usati_items, usati_trash) e `officina/schema.sql`. Dati esistenti: `node officina/tools/seed-usati.mjs` genera `officina/seed/usati.sql` (13 articoli, ripetibile).
- Publisher (`officina/publisher.mjs`): GitHub (Contents API: prima foto, poi JSON, poi cancellazioni; nessun commit se il JSON e' uguale) oppure bozza se manca GITHUB_TOKEN. I test usano un publisher finto.
- Foto: ridimensionate nel browser (canvas), archivio R2 con binding MEDIA (`officina/media.mjs`), errore chiaro se manca; su PC cartella officina/data/media. `scripts/build-usati.mjs` accetta il campo facoltativo `files` (nomi foto).
- Notifiche Telegram per creato/modificato/venduto/eliminato/foto/pubblicazione e errori.
- UI: voce "Vetrina usati" (officina/public/usati.js) con schede, badge, modulo a sezioni a schermo intero su mobile; Portale (portale.js) come home, con collegamento in menu. Controllati screenshot a 1280/500/390.

**Manca / da fare:** manuale (sezioni 19 Vetrina usati e 20 Portale) e screenshot a 320/768 non verificati (u320.png/u768.png generati ma non guardati); prova reale con GitHub e R2; test Cypress da riallineare (la home ora e' #/portale); il vecchio admin/ resta ma non e' piu' linkato.

**Migrazioni/configurazione:** applicare 0004 su D1, poi eseguire officina/seed/usati.sql. Creare bucket `officina-media` e decommentare il binding MEDIA in wrangler.jsonc. Segreto GITHUB_TOKEN (permesso Contents sul repo); variabili GITHUB_REPO, GITHUB_BRANCH, SITE_URL gia' in wrangler.jsonc (BRANCH=main: senza token resta bozza). Opzionale su PC: OFFICINA_USATI_PUBLISH=github.

**Come ripartire:** leggere questa sezione, completare manuale, guardare gli screenshot a 320/768, provare con un branch GitHub di prova (GITHUB_BRANCH) prima di main.

## Agente A: Registro, ruolo Cassa, carico merce (2026-10-14) – branch `agente-a-registro-carico`
**Fatto (test:officina 49/49 verdi, nuovo file `officina/tests/registro.test.mjs`; manuale aggiornato: Magazzino, Utenti/Cassa, nuova sezione 21 Registro):**
1. **Registro** (p.20): tabella `audit_log` (migrazione **0009_audit.sql**, anche in `schema.sql`, inclusa nel backup JSON). Un middleware (`officina/audit.mjs`) annota ogni POST/PUT/PATCH/DELETE andato a buon fine su clienti, riparazioni (stato, consegna/incasso, acconto, ricambi), articoli e movimenti, carichi, fornitori, utenti, spese, servizi, vendite, impostazioni, import acquisti e dati demo: chi (email; "locale" sul PC), azione, tipo, id, nome, quando. Non salva il corpo delle richieste. Pagina **Registro** (`public/audit.js`, voce `admin: true`) con filtri tipo/utente/periodo, ricerca e paginazione; API `GET /api/audit` solo admin.
2. **Ruolo Cassa** (`officina/roles.mjs`): middleware server che toglie dalle risposte `cost, unit_cost, parts_cost, profit_estimate, margin, value_cost...` per `role==='cassa'`, filtra gli avvisi di prezzo, blocca `/api/purchases*`, il backup e il carico merce (403). La cassa non puo' cambiare i costi modificando articoli/servizi (il server conserva quelli veri) e nelle vendite di servizi il costo vero lo rimette il server. Interfaccia: niente colonna/campo Costo, "Valore a costo", costo e guadagno nelle riparazioni, costo ricambi nel report.
3. **Carico merce** (p.4): `📥 Carico merce` in Magazzino (e dentro l'articolo): articolo esistente o nuovo, quantita', fornitore, prezzo d'acquisto, data, codice fornitore, n. documento. API `POST /api/products/:id/load` e `/api/products/load` (`manualLoad` in `purchases.mjs`): scrive `purchases` (source `manuale`), `purchase_lines`, `price_history` (cosi' grafico a punti e avvisi di Acquisti includono i carichi), `stock_moves`, `supplier_codes`; `products.cost` = ultimo costo; il costo medio ponderato e' in `/api/purchases/prices` (`avg_cost`). Stesso n. documento + fornitore + data = stesso documento. **Nessuna migrazione** (0010 non serve).
4. **Bonus**: `📦 Carica a magazzino` su un ricambio a mano di una riparazione (`POST /api/repairs/:id/parts/:partId/stock`): crea (o riusa per SKU/nome) l'articolo, lo collega al ricambio, giacenza invariata (+q/−q in stock_moves, cosi' rimuovere il ricambio ripristina correttamente), prezzo nello storico se il fornitore e' noto.
**Migrazioni da applicare in D1**: solo `0009_audit.sql` (dopo 0008). Nessun deploy fatto.
**Da provare (Christian)**: eliminare/modificare qualcosa e controllare Registro; con un utente Cassa verificare che non compaiano costi/margini e che Acquisti e Carico merce non ci siano; fare due carichi dello stesso articolo a prezzi diversi e guardare grafico/avvisi in Acquisti; "Carica a magazzino" su un ricambio a mano.
**Note per la fusione**: possibili conflitti in `app.mjs` (import + 2 middleware + rotte), `public/app.js` (voce Registro), `public/repair.js`/`stock.js`/`sales.js` (canSeeCosts), `manuale.html`. In `server.mjs` `createApps` accetta ora `{ auth }` (serve ai test del ruolo).


## Agente C: Ordini, Preventivi, Promemoria (2026-10-14)
Ramo `agente-c-ordini-preventivi` (partito da `gestionale-officina`). Migrazione **0013** (`officina/migrations/0013_ordini_preventivi_promemoria.sql`, stesse tabelle in `schema.sql`): `orders`, `order_items`, `quotes`, `quote_items`, `reminders`. Tabelle aggiunte al backup (TABLES in `app.mjs`).

**Fatto (test:officina 49/49 verdi, nuovo `officina/tests/ordini.test.mjs`):**
- **Punto 19 Ordini** (`officina/ordini.mjs`, `public/ordini.js`): ordini per cliente o per il negozio, articoli, fornitore, data prevista, collegamento a riparazione; stati Da ordinare -> Ordinato -> Arrivato -> Consegnato (o Annullato); acconto e saldo registrati come incassi in Cassa (payments kind `order`); lista "Da ordinare" raggruppata per fornitore con testo WhatsApp/email e "segna ordinati"; avviso in campanella quando arriva (con pulsante WhatsApp al cliente) e quando e' in ritardo.
- **Punto 11 Preventivi** (`officina/preventivi.mjs`, `public/preventivi.js`): sezione autonoma (cliente in anagrafica o solo nome), voci e sconto, validita' (default 15 giorni), "scaduto" calcolato, stampa/PDF (`/print/quote/:id`), WhatsApp, stati bozza/inviato/accettato/rifiutato/convertito, conversione in riparazione (approvata se accettato) o in vendita (incassa in cassa), avvisi di scadenza.
- **Punto 10 Promemoria** (`officina/promemoria.mjs`, `public/promemoria.js`): promemoria con data/ora legati a cliente/riparazione/ordine, inserimento veloce con scorciatoie, fatto/rimanda/modifica/elimina, riquadro in **Oggi**, avvisi in campanella, messaggio **Telegram** una sola volta alla scadenza (controllo ogni minuto dalla pagina aperta + a ogni lettura degli avvisi).
- Avvisi: `/api/alerts` ora unisce gli avvisi dei tre moduli (`EXTRA_ALERTS` in `app.mjs`). Selettori condivisi in `public/pickers.js`; icone `inbox`/`bell` aggiunte a `icons.js`. Manuale: sezione 19 "Ordini, preventivi, promemoria".
- Modifiche ai file condivisi (minime): `app.mjs` (import, 3 registrazioni, EXTRA_ALERTS, TABLES), `public/app.js` (import, 3 voci di menu, una riga in `dashboardView` per il riquadro Promemoria di oggi), `public/icons.js`.

**Manca / da fare:** prova reale su D1 (migrazione 0013 da applicare), cron ogni minuto sul Worker per i promemoria a gestionale chiuso (vedi DOMANDE-APERTE 45), schermata Impostazioni per `quote_valid_days`, link online per approvare i preventivi autonomi, carico a magazzino all'arrivo dell'ordine (punto 4), note libere stile Keep (punto 10 esteso). Test Cypress da aggiungere sul ramo `cypress-tests`.
**Come ripartire:** leggere questa sezione e `docs/DOMANDE-APERTE.md` (domande 38-45).

## Agente D: Dispositivi, Buoni e conto diviso, Documenti d'identita', Credenziali fornitori (2026-10-14)
Ramo `agente-d-dispositivi-buoni` (da `gestionale-officina`), migrazione **0014_dispositivi_buoni.sql** (stesse tabelle in `schema.sql`). Test `npm run test:officina`: 53 verdi (10 nuovi in `officina/tests/dispositivi.test.mjs`).
**Fatto**
- **Punto 12 Dispositivi** (`dispositivi.mjs`, `public/dispositivi.js`): registro con seriale/IMEI/IMEI2 (validazione Luhn, doppioni anche scritti con spazi/trattini), sottoclassi Nuovi/Usati/Ricondizionati/Da smaltire/In arrivo, storico per dispositivo (creazione, modifiche, riparazioni con lo stesso seriale, vendite), segnalazione "rubato / da verificare" con motivo e numero di denuncia (toglierla solo admin), **avviso** (finestra rossa + nota interna nella scheda + avviso sotto il campo seriale) quando un seriale segnalato entra in riparazione o in vendita (campo seriale nel carrello), export CSV per la denuncia. **12b "Blacks": NON fatto** (in sospeso, solo domanda aperta).
- **Punto 9 Buoni e conto diviso** (`buoni.mjs`, `public/buoni.js`): buoni regalo (saldo, uso parziale), sconto in euro e in percentuale, scadenza, annullamento, stampa; uso **atomico** con UPDATE condizionato. Pagamento diviso fino a 6 quote (metodo, importo, chi paga) con controllo "quadra", resto contanti a video, buono + diviso insieme; vale per **Vendite** e per il **saldo alla consegna** della riparazione. In `logic.mjs`: `createSale` ristrutturata (prima si legge e si controlla tutto, poi si scrive: con D1 senza transazioni un errore non lascia mezze vendite), `deliverRepair` e `report` (riquadro "Buoni usati" in Cassa). Ogni quota e' una riga di `payments` ("quota 1/2 (Anna)"), il credito del buono entra come metodo "buono": **nulla e' nascosto**; metodi "non tracciato" e "buono" digitato a mano rifiutati. Ricevuta con le quote e il saldo residuo. Carte fedelta'/punti: NON fatti.
- **Punto 17 Documenti d'identita'** (`documenti.mjs`, `vault.mjs`, `public/documenti.js`): dati e foto/PDF **cifrati AES-GCM** (WebCrypto, chiave `VAULT_KEY` dal segreto del Worker o dall'ambiente, mai nel repo; sul PC `officina/data/vault.key` creato da `server.mjs`, cartella ignorata da git). Solo admin (+ ruoli abilitati dall'admin), presa visione dell'informativa obbligatoria (testo = BOZZA E, da far verificare), registro accessi (`sensitive_access_log`: elenco/visione/file/creato/eliminato, mai i contenuti), cancellazione con `confirmDelete` a doppio passaggio + parola ELIMINA + `?confirm=ELIMINA` lato server, file mai in cache, nessuna notifica con contenuti. Dal pulsante "Documenti" nella scheda cliente.
- **Punto 18 Credenziali fornitori** (`credenziali.mjs`, `public/credenziali.js`): solo admin, password cifrata (stessa chiave), mai nell'elenco; "Copia password" (un tocco) e "Mostra" (15 s) passano da `/rivela` e sono registrati; apri sito, copia utente, chiama/WhatsApp l'agente.
- Menu: voci Dispositivi, Buoni, Credenziali (admin); manuale sezioni 21-23; icone nuove in `icons.js`; domande aperte 38-57 in `DOMANDE-APERTE.md`.
**Da fare / non fatto**: blacklist (12b), carte fedelta', template grafico dei buoni, acconto diviso, OCR documenti, promemoria cambio password, Telegram per seriali segnalati.
**Prima del deploy (Marco)**: applicare la migrazione 0014 su D1 e creare il segreto `VAULT_KEY` (`npx wrangler secret put VAULT_KEY --config officina/wrangler.jsonc`); conservarne una copia fuori dal gestionale. Senza il segreto documenti e credenziali rispondono con un errore chiaro e non salvano nulla.
**Cosa deve provare Christian**: nuovo dispositivo con seriale (lettore e fotocamera), segnalarlo "rubato" e provare a registrare una riparazione con lo stesso seriale (deve comparire l'avviso); creare un buono regalo da 50 e usarlo in due vendite; dividere un conto tra carta e contanti e controllare la Cassa; salvare un documento d'identita' con foto da telefono e vedere il registro accessi; salvare una credenziale e provare "Copia password". Verifica grafica fatta con Edge headless a 1280 e 390 px (nessun errore JS).
**Nota ambiente**: la porta 4977/4978 era gia' occupata da un altro agente: ho usato 4987/4988 con un DB temporaneo, poi chiuso.

## Agente B: schede, checklist, firme, preventivo a distanza, non riparabile (2026-10-14)
Ramo `agente-b-schede-firme` (da `gestionale-officina`). Migrazioni **0011** (checklist, firme) e **0012** (opzioni preventivo, destino dispositivo); schema.sql e db-node allineati. `npm run test:officina`: 59 verdi (nuovo file `tests/schede.test.mjs`; aggiornati 4 test di api.test che usavano la vecchia risposta senza firma).
- **Punto 15**: `checklists.mjs` (6 tipi, 3 elenchi: ingresso, ritiro, collaudo), modificabili in Impostazioni; controlli compilati salvati nella riparazione (`checklist.js`, tocco a 3 stati). Etichette IMEI/seriale/PIN per tipo, tipo modificabile nella scheda.
- **Punto 14**: scheda laboratorio sempre 1 pagina (altezza bloccata, testi troncati); controlli compilati stampati con ✔✖–.
- **Punto 13**: scheda cliente = un A4 con due copie; firma disegnata (`sigpad.js`, `sign.js`) salvata come PNG in `repair_signatures` (DB), mostrata su entrambe le copie; firma al banco o a distanza dal link (richiesta + WhatsApp). Testi in `legal.mjs` da docs/TESTI-LEGALI-BOZZE.md, marcati "bozza da far verificare" finche' non si spunta "Testi verificati".
- **Punto 16**: dal link conferma / scelta fra soluzioni / rifiuto con scelta (ritiro o cessione), sempre con firma; registra data, ora, IP, testo firmato; Telegram. Il vecchio `accept:true` senza firma non vale piu'.
- **Punto 2**: "Annullato / non riparabile" chiede dove sta il dispositivo; 15 giorni di giacenza (Impostazioni), avvisi in Oggi/campanella, deposito a pagamento, cessione firmata, promemoria Telegram nel cron notturno. Rifiuto dal link -> stato annullato + giacenza/ceduto.
- Manuale: sezione 19.
**Da provare (Christian)**: stampa su A4 vero delle due schede (una pagina ciascuna, due copie tagliabili); firma col dito su tablet/telefono, anche da link a distanza; prova su telefono del flusso Si/No del preventivo; la pistola/etichette non toccate. **Non fatto**: collaudo che blocca la consegna, caricamento a magazzino dei pezzi recuperati, firma con codice SMS, solleciti automatici al cliente.


## STATO A FINE SESSIONE 2026-10-14 (sera, dopo i 4 agenti)
Vedi `docs/PARTI-DA-QUI.md` sezione "RIPARTENZA NELLA NUOVA CHAT (aggiornata 2026-10-14, sera)". Fatto in questa sessione: lotto A (doppia conferma, tolto "non tracciato", ruolo Cassa, ricambi a mano con guadagno, flag stampa ricevuta, aree magazzino, listino servizi), fusione dei due rami vecchi, Acquisti nel menu, card Vetrina usati ridisegnate, Vetrina Usati online con GitHub+R2 e recupero dei 13 articoli, 4 agenti (registro/carico merce; schede/firme/non riparabile; ordini/preventivi/promemoria; dispositivi/buoni/documenti/credenziali) fusi, migrazioni 0009-0014 applicate, deploy b0570dc9.

## Sessione 2026-10-14 (pomeriggio): barra laterale, Usati online, VAULT_KEY, eliminazioni
- **Barra sinistra** (`officina/public/index.html`): piede fisso con riga di separazione, tasti N e / leggibili su fondo scuro, menu che scorre da solo senza spingere fuori il piede; tolta la scritta "Solo locale · nessun login" (non piu' vera).
- **Usati non comparivano sul sito**: una prova di pubblicazione (12:10) aveva scritto su `main` un `usati.json` quasi vuoto; i 13 articoli erano stati reimportati nel DB ma nessuno ripubblicava (`usati_dirty=0`, e il pulsante "Pubblica ora" compariva solo con modifiche in sospeso). Fix: il pulsante c'e' sempre ("Ripubblica sul sito" se non ci sono modifiche in sospeso), `officina/public/usati.js`. Dopo la ripubblicazione i 13 articoli sono tornati. **Nota**: dopo ogni pubblicazione il sito si rigenera in 1-2 minuti (Pages): sembra "non aggiornato" ma e' solo attesa. Resta in vetrina l'articolo di prova "arrticolo-di-test": da cancellare e ripubblicare.
- **VAULT_KEY**: generata casuale (32 byte) e caricata come segreto del Worker senza passare dalla chat; copia in `C:\1Marco Peluso\Mega\Informatix-Chiavi\VAULT_KEY.txt` (backup Mega, fuori da git). Se persa, i dati cifrati (Documenti d'identita', Credenziali) non si recuperano. Da provare: salvare un documento/credenziale.
- **Eliminazioni** (`officina/app.mjs`, `public/repair.js`, `public/customers.js`): `DELETE /api/repairs/:id` solo se consegnata/annullata (altrimenti 409); `DELETE /api/customers/:id` ora permesso se non ha riparazioni aperte e porta via le sue riparazioni concluse. Conferma scrivendo ELIMINA, registrato nel registro attivita'. Incassi e vendite restano in contabilita'. Non limitato all'admin (il test registro si aspetta che anche lo staff possa). Test: 82 verdi; manuale aggiornato (sezione clienti). Deploy 913e3bd5; commit sul ramo `gestionale-officina`, `main` non toccato.
- **Metodo**: il deploy `wrangler deploy` e' autorizzato dall'utente: lanciarlo direttamente, senza chiedere.
- **Resta** (vedi PARTI-DA-QUI): menu raggruppato, controllo grafico a 4 formati, Cypress, fattura XML vera, cron Telegram, link preventivi autonomi, Impostazioni validita' preventivi, note libere, acconto diviso, rifiuto preventivo, pulizia worktree/rami.
- **Provato da Marco (OK)**: salvataggio Documento d'identita'/Credenziale con la nuova VAULT_KEY, eliminazione clienti e riparazioni concluse, rimozione di "arrticolo-di-test" con ripubblicazione. **Decisione**: la Vetrina Usati si gestisce SOLO dal gestionale online; il vecchio `npm run admin` (porta 4848) non si usa piu' (non lo cancello, ma non va usato: scrive un elenco separato).

## Sessione 2026-10-15 (mattina): bot di controllo v2, notifiche Telegram con i dati veri, numerazione
Richiesta di Marco: aggiornare il bot dei monitoraggi sul Samsung (collegato via adb) con controlli piu' dettagliati; il riepilogo diceva "3" invece di 13; rivedere i testi delle notifiche confrontandoli con i dati veri e le "sezioni del profilo" del bot.
- **Causa del "3 invece di 13"**: il bot leggeva `https://informatixrepair.com/usati.json`, che e' il riassunto della home (`count: 13` ma `items` = solo i 3 articoli in evidenza) e contava `items`. Ora usa `count` e i numeri del gestionale.
- **Bug grave trovato e corretto** (`logic.mjs`, `nextCode`): il codice R-/V- era "conteggio + 1"; dopo aver eliminato una riparazione non ultima, la successiva andava in errore 500 (`UNIQUE constraint failed: repairs.code`). Ora usa il numero piu' alto (come gia' faceva `ordini.mjs`). Online oggi non c'erano riparazioni, quindi nessuno era ancora bloccato.
- **Notifiche Telegram del gestionale** (`officina/notify.mjs`, riscritto): verificate con un banco di prova che esegue tutte le azioni su un DB temporaneo. Errori trovati: carico merce annunciato come "Prodotto creato"; consegna con pagamento diviso/buono annunciata come "(contanti)"; ordini, preventivi, promemoria, buoni, dispositivi, documenti, credenziali, listino servizi e "carica a magazzino" arrivavano come `ℹ️ POST /api/...`; eliminazioni senza nome ("Cliente eliminato: n. 1", "DELETE /api/repairs/2"); impostazioni con l'elenco di TUTTI i campi (il modulo li manda sempre) anche con nomi tecnici; "rif. n. 1" invece del codice; "acconto 0,00 €"; stampe "both/1". Ora: testi per ogni sezione con codice, dispositivo, cliente, importi; quote reali del pagamento diviso e buono; eliminazioni con nome e **incassi tolti dalla cassa con l'importo**; impostazioni solo i campi cambiati (prima → dopo, nessun avviso se nulla cambia); avviso quando si apre un documento d'identita' o si copia/mostra una password (mai i contenuti); 403 = "Operazione non permessa"; stampe, foto, checklist, note, promemoria ed errori di compilazione **senza suono** (`disable_notification`); anteprime di stampa (`?noprint=1`) senza avviso.
- **Nuovo `GET /api/monitor`** (`officina/monitor.mjs`, montato nell'app pubblica): numeri del gestionale per il bot (riparazioni per stato, pronte con giorni, in ritardo, incassi di oggi per metodo/tipo, spese, vendite con articoli, mese, ordini, preventivi, promemoria, magazzino, vetrina usati, utenti/ultimo accesso, attivita', ultimo backup R2). Protetto dal segreto `MONITOR_TOKEN` (min. 24 caratteri, confronto a tempo costante); senza segreto o con chiave sbagliata risponde 404. Niente telefoni/email/PIN. A ogni lettura invia anche i promemoria scaduti (cosi' arrivano anche a gestionale chiuso, finche' il telefono e' acceso).
- **Segreto `MONITOR_TOKEN`**: generato casuale (43 caratteri), caricato con `wrangler secret put` e aggiunto al `.env` del bot sul telefono senza passare dalla chat. Si puo' rigenerare quando si vuole (stessi due posti). Deploy d8d86df2, poi 429eda67 (manuale).
- **Bot Termux v2** (`termux-bot/main.py`): servizi giu'/su/lenti con minuti di fermo del giorno; controlli dati ogni 5 min (Vetrina sul sito diversa dal gestionale per 15 min, errore di pubblicazione, backup notturno mancante dopo le 6, dati non leggibili); **Buongiorno** lun-sab 8:30 (agenda); **riepilogo 21:00** dettagliato (incassi per metodo e tipo, buoni, spese e netto, vendite con articoli, riparazioni, ordini, mese, vetrina, articoli del blog di oggi dalla sitemap, accessi, backup); `--anteprima [--invia]`; un errore in un giro non ferma il bot. Test 31 verdi su PC e sul Samsung (Python 3.14.6). Installato in `~/informatix-bot` (copia della v1: `main.py.bak-v1-20261015-*`), riavviato dal Control Center (`bot_ctl.sh informatix_repair restart`), un solo processo, gli altri bot non toccati. Anteprima inviata su Telegram.
- **Profilo del bot Telegram** (prima vuoto): impostate descrizione e "info" (cosa manda, che non accetta comandi). Il bot puo' ancora essere aggiunto ai gruppi: si toglie solo da BotFather (`/setjoingroups` → Disable), lo deve fare Marco.
- **Test**: `npm run test:officina` 88 verdi (nuovo `officina/tests/notifiche.test.mjs`), bot 31 verdi. Manuale sezione 18 e promemoria aggiornati.
- **Trovato nei dati online (non toccato, da decidere)**: (1) incasso di prova orfano di 34 € ("Saldo R-2026-0001", 14/10) di una riparazione di prova gia' eliminata: e' nel totale del mese; (2) utente **amministratore** "Utente di prova" `utente.archivio@libero.it` ancora attivo; (3) l'eliminazione di una riparazione conclusa cancella anche i suoi incassi (commit bc2a7b5, gia' online): ora almeno l'avviso Telegram dice quanti e per quanto. Vedi DOMANDE-APERTE 58-63.
- **Richiesta di Marco su VAULT_KEY (con un valore scritto in chat)**: annotata da chiarire (DOMANDE-APERTE 58). Il valore NON e' trascritto nei documenti: se e' pensato come chiave e' troppo facile da indovinare, e cambiare la chiave renderebbe illeggibili documenti e credenziali gia' salvati.
- **VAULT_KEY allineata** (15/10, dopo la risposta di Marco): online 0 documenti e 0 credenziali cifrati, quindi nessun rischio: il segreto `VAULT_KEY` del Worker e' stato ricaricato con il valore della copia in Mega (`C:\1Marco Peluso\Mega\Informatix-Chiavi\VAULT_KEY.txt`, nota di allineamento aggiunta nel file). La copia e la chiave attiva coincidono; il valore scritto in chat non e' usato da nessuna parte.
- **Decisioni di Marco (15/10)**: tolto l'incasso di prova da 34 € e disattivato l'utente di prova (correzioni dirette su D1, entrambe scritte nel Registro con ora di Roma); confermato che eliminando una riparazione conclusa se ne vanno anche i suoi incassi; Buongiorno del bot tutti i giorni alle 8:30 (bot aggiornato e riavviato sul Samsung, profilo Telegram aggiornato). Resta solo per Marco: BotFather `/setjoingroups` → Disable (domanda 62).

## Sessione 2026-10-15 (giornata): menu a gruppi, colore, preventivo online, acconto diviso, pulizia
Marco e' via per una visita: lavoro portato avanti da solo, tutto pubblicato; **il database vero non e' stato toccato** (Christian lo sta usando). Unici interventi sul DB online: migrazioni 0015 e 0016 (solo ALTER/CREATE di colonne e tabelle nuove, nessun dato modificato) e, su richiesta di Marco poco prima, la rimozione dell'incasso di prova da 34 € e la disattivazione dell'utente di prova (entrambe nel Registro). Tutte le prove sono state fatte su database temporanei locali.
- **Colore del dispositivo** (richiesta di Marco): colonna `repairs.color` (migrazione **0015**), campo con suggerimenti nel modulo di nuova riparazione e nella modifica, riga "Colore" nel dettaglio, schede cliente e laboratorio, pagina di tracciamento del cliente, ricerca. Facoltativo.
- **Menu a gruppi**: Banco / Magazzino e acquisti / Vetrina e buoni / Gestione; gruppi apribili nella barra laterale (ricordati per postazione); su telefono e tablet il pulsante Altro apre un pannello a griglia per gruppi. Icone mancanti (Acquisti, Utenti, Registro) aggiunte.
- **Controllo grafico automatico** (puppeteer + Edge headless, DB temporaneo con demo): 20 viste x 4 larghezze (1280/768/390/320). Trovati e corretti: Acquisti con scorrimento laterale su telefono (badge "Prezzo piu' basso" troppo largo) e campo di ricerca Promemoria di 29 px a 320 px. Ora nessun problema.
- **Impostazioni**: validita' dei preventivi (giorni).
- **Promemoria a gestionale chiuso**: cron del Worker ogni minuto (`* * * * *`) che invia solo i promemoria scaduti; il cron delle 2:30 resta per il backup. (Oltre ai controlli ogni 5 minuti del bot sul telefono.)
- **Preventivo online** (migrazione **0016**): `POST /api/quotes/:id/link` crea il codice (la bozza diventa "inviato"); il cliente apre `/p/<codice>` (pagina `preventivo.html/js`, host pubblico), vede voci, totale, scadenza e condizioni (niente telefono/email) e accetta o rifiuta con firma disegnata; si registra firma, nome, IP e ora in `quote_signatures`; una sola risposta, mai dopo la scadenza; avviso Telegram; nel gestionale bottone "🔗 Link per il cliente" (copia il link e propone WhatsApp) e riga "Risposta online". Test dedicati.
- **Acconto**: dalla scheda ora si sceglie il metodo (prima finiva sempre "contanti") e si puo' dividere su due metodi (l'API accetta fino a 6 quote); ogni quota e' una riga in cassa; rifiutati "non tracciato" e "buono". Avviso Telegram con le quote.
- **Pulizia**: rimossi i 7 worktree `.claude/worktrees/agent-*`, i rami locali `agente-*` e `worktree-agent-*` e i 4 rami remoti `agente-*` (verificato che fossero contenuti in `gestionale-officina` o `main`). I 19 `claude/upbeat-fermi-*` NON toccati (domanda 27 a Marco).
- **Test**: `npm run test:officina` 93 verdi.
- **Segnalato, non fatto**: "rifiuto preventivo dal link -> annullata" da rivedere con Christian; note libere stile Keep (domanda 44 a Christian); prova con fattura XML vera (serve il file); routine blog il 25/10; BotFather `/setjoingroups` (Marco).
- **Cypress aggiornato** (ramo `cypress-tests`, worktree `../cy-wt`, unito a `gestionale-officina`): i vecchi test non corrispondevano piu' al gestionale (si apre il Portale, menu a gruppi con pulsanti di gruppo, firma obbligatoria nelle risposte del cliente, doppia conferma sulle eliminazioni, niente "non tracciato"). Riallineati officina, novita, responsive, scanner, spese e ui-review.
- **Trovato dai test E2E e corretto**: l'API accettava `method: 'non tracciato'` su vendite singole, acconti, consegne e ordini (il blocco c'era solo nei pagamenti divisi). Ora `assertMethod` (logic.mjs) lo rifiuta ovunque, prima di scrivere qualsiasi cosa. Test dedicato.
- **Trovati dalla rassegna grafica e corretti**: campo Area del magazzino con testo da 13,6 px, pulsante "Carico merce con fornitore" fuori schermo a 320 px, buco di 222 px tra le sezioni di Impostazioni (griglia a 3 colonne).
- **Test**: `npm run test:officina` 94 verdi; Cypress su `cypress-tests`: 221 test verdi (novita 10, officina 13, responsive 43, scanner 10, spese 11, ui-review 134).

## Agente A - lotto E/G (2026-10-15): anagrafiche, IVA, retroattivo, Blacks, rifiuto preventivo
Lavoro nel worktree `agent-aa483f48...` (ramo `worktree-agent-aa483f48a0790b4fc`, ripartito da `gestionale-officina`). Migrazioni usate: 0017-0019. Solo DB temporanei.
- **1. Clienti azienda** (migrazione **0017**, `officina/clienti.mjs` nuovo): `customers` guadagna tipo (privato/azienda), ragione sociale, P.IVA, CF, indirizzo, CAP, citta', provincia, SDI, PEC. Validazione formale: P.IVA (11 cifre + controllo), CF (16 caratteri con carattere di controllo o 11 cifre), CAP, sigla provincia, SDI, email/PEC; normalizzazione (IT e spazi tolti, maiuscole). Form clienti con tipo, ricerca estesa (ragione sociale, P.IVA, CF, citta', PEC), dati fiscali su scheda cliente stampata e ricevuta di vendita. `fatturapa.mjs` non toccato: legge fatture dei fornitori, non c'entra con i clienti. Corretto di passaggio: la ricerca riparazioni passava 6 valori a 7 segnaposto. Test: `officina/tests/anagrafiche.test.mjs`. Manuale: sezione 9.
- **2. IVA su ricambi/acquisti** (migrazione **0018**, `officina/iva.mjs`, `public/iva.js`): `computeVat` ricava imponibile/IVA/totale dal prezzo scritto IVA esclusa o inclusa; flag `vat_apply` = IVA realmente dovuta (estero, reverse charge): il costo registrato e' IVA compresa, altrimenti l'imponibile. Salvati sempre aliquota, imponibile, IVA e flag (`repair_parts.vat_rate/cost_net/cost_vat/vat_applied`, `purchase_lines.vat_amount/vat_applied`, `list_price` = imponibile); evento in cronologia riparazione quando l'IVA e' aggiunta. Aliquota predefinita = impostazione `vat_rate` (22). Nessun dato nascosto. UI: blocco IVA nel Carico merce e nel Ricambio a mano con calcolo in tempo reale. Test `iva.test.mjs`. Manuale sezione 30.
- **3. Inserimento retroattivo** (nessuna migrazione: usa le colonne data gia' presenti; `officina/retro.mjs` nuovo, `public/retro.js`): campo `entry_date` accettato da `POST /api/sales`, `/api/repairs`, `/repairs/:id/deposit|deliver|advance` e `/api/expenses` (queste ultime hanno gia' `spent_on`). Un middleware esegue l'operazione normale e poi data le righe nuove (incassi, vendita, riparazione, cronologia, movimenti magazzino; `delivered_at` per la consegna, quindi la garanzia parte da li'): i report per periodo la rispettano. Date future/non valide rifiutate prima di scrivere. Richieste retroattive serializzate (nessuna confusione con righe di altre richieste). Ogni uso nel Registro, tipo nuovo `retroattivo` (chi, ora vera, data scelta). Ruolo Cassa escluso. `POST /api/retro/date` (solo admin) corregge la data di vendita/riparazione/consegna/incasso con registro "da...a...". UI: riquadro ripiegabile "Operazione di un giorno passato?" in vendita, nuova riparazione, acconto, consegna. Test `retroattivo.test.mjs`. Manuale sezione 30. Limite: nel carrello vendite il campo data si azzera se il carrello viene ridisegnato dopo averlo scelto.
- **4. Blacks** (migrazione **0019**, tabella `blacklist`; `officina/blacks.mjs`, `public/blacks.js`): segnalazioni con motivo, nota, data, chi ha segnalato; collegate a un cliente o a una persona non registrata. `findBlacks` riconosce per cliente, telefono (stesso numero scritto in modi diversi), email o nome identico (il tipo di corrispondenza e' mostrato). API: `GET /api/blacklist[?q&all=1]`, `/check`, `/meta`, `POST`, `PUT /:id` (tutti), `POST /:id/remove` e `/restore` (solo admin; rimozione = archiviazione con motivo obbligatorio, mai cancellata). Avvisi: riquadro rosso in diretta nel modulo nuova riparazione (nome/telefono/email o cliente scelto) e nella vendita; `blacklist_alert` nelle risposte di `POST /api/repairs` e `/api/sales` con finestra "Attenzione"; avviso Telegram con la riga CLIENTE SEGNALATO; distintivo in elenco clienti e riquadro nella scheda cliente con pulsante "Segnala". Registro: tipo `segnalazione`. Voce menu "Blacks" in Gestione (blocco separato in app.js). Aggiunta a TABLES del backup. Test `blacks.test.mjs`. Manuale sezione 30. Nota privacy: elenco solo interno, mai nelle pagine pubbliche (da far verificare per GDPR).
- **5. Rifiuto preventivo dal link `/p/<codice>`**: l'avviso Telegram esisteva gia' ma era generico. Ora il rifiuto ha un messaggio dedicato e con suono ("PREVENTIVO RIFIUTATO dal cliente": codice, cliente, totale, firmatario, motivo, invito a ricontattarlo); la pagina pubblica di rifiuto ha un campo facoltativo "Vuoi dirci il motivo?" salvato in `quote_signatures.reason` (migrazione 0019) e visibile nel dettaglio preventivo del gestionale. L'accettazione resta un messaggio a parte. Test in `blacks.test.mjs`.

## Agente C: chiusure di cassa, archivio fatture, dare/avere (richieste 10-12)
- **Chiusure di cassa** (`closings.mjs`, `public/chiusure.js`, migrazione **0023**): una per giorno, anche passata (marcata retroattiva); atteso = fotografia degli incassi del giorno (contanti/POS/altro) + fondo - spese in contanti della cassa; contato per cassetto, differenza totale e per cassetto evidenziata; note; foto facoltativa nell'archivio media esistente; ricerca per periodo/testo, totali mensili, CSV; blocco e sblocco (solo admin, con motivo); ogni passaggio nel Registro con vecchio -> nuovo valore.
- **Archivio fatture** (`invoices.mjs`, `public/fatture.js`, migrazione **0024**): emesse e ricevute, anche passate; stato calcolato (da pagare, parziale, scaduta, pagata, stornata) con note di credito e "da restituire"; pagamenti con metodo vero (`assertMethod`) e data: l'incasso di una emessa entra in cassa (kind `fattura`) nel giorno indicato, quello di una ricevuta puo' andare anche tra le spese; fattura collegata a vendita/riparazione gia' incassata = solo collegamento, nessun doppio incasso; da acquisto importato e da vendita; filtri, totali, CSV, avvisi in campanella; ruolo Cassa solo emesse.
- **Dare/avere** (`dareavere.mjs`, `public/dareavere.js`, migrazione **0025**): debito, pagamento (in cassa), credito, rimborso (nelle spese), anche passati, per cliente e per riparazione; saldo e abbinamento FIFO; **cattivo pagatore** con soglie in Impostazioni (predefiniti 30 giorni / 100 euro / 2) su elenco clienti, scheda cliente, nuova riparazione, nuova vendita e campanella; un cliente con movimenti non si elimina.
- Manuale sezioni 25-27. Test `officina/tests/archivi.test.mjs` (9), `npm run test:officina` tutti verdi. Rotte con id negativi accettate (dati demo).
## Agente B (15-16/10): catalogo modelli, storico, esterne, muletto, note
- **Migrazioni 0020-0022** (anche in `officina/schema.sql`): `device_models`; `external_repairs` + `loans`; `notes`. Solo tabelle nuove, nessun dato esistente toccato.
- **Catalogo modelli**: ~900 modelli (seed in `officina/seed/modelli.mjs`, caricato da solo al primo uso e mai ricaricato se cancellati; "Rimetti i modelli di partenza" li recupera). Suggerimenti dalla 3a lettera nella nuova riparazione e nella modifica; alla creazione scheda un modello sconosciuto viene aggiunto (`source=auto`), uno noto aumenta l'uso. `repairs.brand_model` resta testo. Sezione "Modelli" con CRUD, filtri, import/export CSV.
- **Storico** (`/api/storico`, vista Storico riparazioni): filtri cliente/marca/modello/tipo/stato/periodo, totali, CSV, scheda riassuntiva. Cassa senza costi/margini (anche nel CSV).
- **Riparazioni esterne** (`esterne.mjs`): collegate alla scheda, laboratorio da anagrafica o a mano, invio/rientro, costo, avviso rientro in ritardo, eventi interni nella cronologia.
- **Muletto** (`prestiti.mjs`, scheda "Prestiti / muletto" in Dispositivi + sezione nella scheda): scadenza = consegna stimata, no doppio prestito dello stesso dispositivo, avvisi (scaduto, riparazione chiusa col muletto fuori).
- **Note stile Keep** (`note.mjs`): rapide, colori, fissate, elenchi con caselle, archivio, ricerca.
- Aggancio unico in `app.mjs` tramite `officina/lottoB.mjs`; frontend in file nuovi + `lottob.css`. Manuale sezioni 30-34. Test: `officina/tests/lottoB.test.mjs`. Controllo grafico con Edge headless a 360/768/1280: nessuno scorrimento orizzontale, nessun errore JS.
## Agente D (lotto E-F-G): compito 1 - Materiali da ordinare
- **Cosa**: nuova voce di menu "Da ordinare" (`#/materiali`, `officina/materiali.mjs` + `public/materiali.js`): unica lista delle righe `da_ordinare` degli ordini e dei ricambi delle riparazioni, raggruppate per fornitore (il ricambio si collega al fornitore dal nome), con "segna ordinato" in blocco, WhatsApp/email/copia testo per fornitore.
- **Ricambi riparazione**: casella "Ancora da ordinare al fornitore" nel ricambio a mano; etichetta cliccabile Da ordinare -> Ordinato -> Arrivato nella scheda (`repair_parts.order_state`, migrazione **0026**).
- **Promemoria giornaliero Telegram**: `notifyMaterialsDue` chiamato dal cron al minuto del Worker (`worker.mjs`) e, come ripiego, da `/api/alerts`; orario (predefinito 12:00), giorni (lun-ven) e interruttore in Impostazioni (riquadro "Promemoria materiali da ordinare"); una volta al giorno (`materials_reminder_last`), solo se c'e' qualcosa, finestra di 2 ore dopo l'orario.
- **Test**: `officina/tests/materiali.test.mjs` (aggregazione, segna ordinato, orari/giorni/una volta al giorno/niente da ordinare).

## Agente D: compito 2 - Preventivo dalla scheda riparazione
- **Cosa**: `officina/preventivo-riparazione.mjs` + `public/preventivo-rip.js`. Bottone "📨 Invia preventivo al cliente" nella scheda riparazione: crea (o ritrova, idempotente) il preventivo online collegato (`quotes.repair_id`), voci ricavate da ricambi con prezzo + intervento (o voce unica), validita' in giorni (default `quote_valid_days`, modificabile 1-365, rinnovabile se scaduto), link `/p/<codice>` esistente. Invio: WhatsApp / email (mailto) / copia link; registra `sent_at` e `sent_via` (migrazione **0026**, colonne su `quotes`).
- **API**: `GET/POST /api/repairs/:id/online-quote`. Rifiuta: riparazione conclusa (409), preventivo gia' accettato (409), niente importo (400), canale/validita' non validi (400, prima di scrivere).
- **Test**: `officina/tests/preventivo-riparazione.test.mjs`. Non toccate accettazione/rifiuto (ambito agente A).

## Agente D: compito 3 - Carta punti NFC protetta
- **Cosa**: `officina/carte.mjs` (server), `public/carte.js` (menu "Carte punti", Vetrina e buoni), `public/nfc.js` (SDK astratto lettori), `tools/nfc-bridge.mjs` (ponte PC/SC, senza dipendenze nel progetto). Migrazione **0027**: `loyalty_cards`, `loyalty_events` (+ indice unico "una vendita/riparazione = punti una volta").
- **Protezione anti-bypass**: i punti vivono solo nel DB; chip = UID + codice firmato `IXC1.<carta>.<contatore>.<HMAC-SHA256 128 bit>` (segreto `NFC_SECRET`, in mancanza `VAULT_KEY`, mai nel client/DB); contatore a rotazione: codice gia' usato = replay/copia -> carta bloccata + evento `sospetta_clonazione`; UID da solo non basta per riscattare (serve PIN, hash HMAC); 5 fallimenti di fila -> blocco; limiti: punti per operazione, riscatto/giorno per carta, 40 operazioni/min e 12 errori/10 min per utente (429); sessione di verifica firmata di 5 minuti; accredito solo da vendita/riparazione consegnata, importo letto dal server, una volta sola; rettifica solo admin con motivo; riscatto = buono regalo (`vouchers`), quindi in cassa come gli altri; registro completo per carta.
- **SDK** `nfc.js`: API unica `createNfc()` (`use/start/stop/onTag/write/submit`), adattatori `webnfc` (Android), `hid` (USB tastiera, formato hex/decimale e byte invertiti), `bridge` (SSE+POST verso `nfc-bridge.mjs`), `manual`. Estendibile con nuove classi.
- **Regole punti provvisorie** (Impostazioni nel riquadro della pagina): 1 punto/euro, 100 punti = 5 €, 12 mesi (domanda 21 a Christian).
- **Test**: `carte.test.mjs` (flusso, replay, forgery, PIN, limiti, sostituzione, segreto mai esposto), `nfc-sdk.test.mjs`. Hardware NON provato: lettura PC/SC reale e scrittura sul chip (lo prova Christian, vedi manuale sez. 27).

## Agente D: compito 4 - Import DDT / fatture PDF (analisi al momento dell'importazione)
- **Cosa**: `officina/ddt.mjs` (lettore euristico a piu' passaggi: celle/colonne -> fornitore con P.IVA validata (cifra di controllo) -> tipo/numero/data -> tabella con formato imparato, poi intestazione di colonna, poi euristiche sui numeri (qta x prezzo = importo, sconto %) -> controlli e fiducia per riga), `public/pdftext.js` (testo del PDF estratto NEL BROWSER con pdf.js da CDN: nessuna libreria pesante nel Worker, il PDF non parte dal PC), `public/ddt-editor.js` (anteprima modificabile: fornitore, P.IVA, tipo, numero, data, totale e righe; righe dubbie in giallo; "Applica le correzioni"; elenco "Formati PDF imparati" con "Dimentica").
- **Flusso riusato**: `purchases.mjs` -> `resolveDocument` (XML come prima; `pdf_text` = testo estratto; `parsed` = anteprima corretta a mano) -> stesso `analyze`/`confirmPurchase`/storico prezzi. Il lettore `ddt_pdf` ora e' `supported: true`. Test `acquisti.test.mjs` aggiornato di conseguenza.
- **Apprendimento**: migrazione **0028** `supplier_formats` (chiave = P.IVA o nome normalizzato; mappa colonne per numero di celle ricavata confrontando le righe CONFERMATE con le celle originali). Alla conferma `learned:true`; dal documento dopo le righe escono `source:'learned'`. API: `GET /api/purchases/formats`, `DELETE /api/purchases/formats/:id`.
- **Estendibile**: `ROLE_WORDS` (dizionario colonne), `FOOTER`/`HEAD_NOISE`, passaggi separati e funzioni esportate. NESSUN modello reale disponibile: i test usano 4 impaginazioni sintetiche (DDT con prezzi, DDT non valorizzato, fattura con sconto/IVA, spazi singoli) + apprendimento. Servono 2-3 PDF veri per fornitore per tarare.
- **Test**: `officina/tests/ddt.test.mjs` (10 test). Non provato con pdf.js reale (serve il browser): lo prova Christian col primo PDF vero.

## Agente D: compito 5 - Testi legali
- Revisione con ricerca online (Codice del Consumo artt. 129/133, art. 59 recesso, art. 2756 c.c., GDPR art. 13/6, Garante sulla copia del documento). Testi aggiornati in `legal.mjs` (consenso, accettazione, rifiuto/ritiro, giacenza) e condizioni di default in `dbref.mjs` (non piu' "60 giorni"). Tabella fonti, cosa e' VERIFICATO e cosa NO in fondo a `docs/TESTI-LEGALI-BOZZE.md`. L'interruttore "Testi verificati" resta su bozza: lo decide Christian. Nessuna migrazione.

## Sessione 2026-10-15/16 notte - Fusione dei 4 agenti (lotti E-F-G) e verifiche
- Unite in `gestionale-officina` le quattro linee di lavoro: A (clienti azienda, IVA, retroattivo, Blacks, rifiuto preventivo; migr. 0017-0019), B (catalogo ~900 modelli, storico, esterne, muletto, note; 0020-0022), C (chiusure cassa, archivio fatture, dare/avere + cattivo pagatore; 0023-0025), D (materiali da ordinare + promemoria, preventivo da riparazione, carta punti NFC protetta con SDK lettore generico, import DDT/PDF con analisi, testi legali rivisti; 0026-0028). Conflitti risolti tenendo entrambe le parti (menu, schema, manuale, CHATLOG, package.json).
- Test officina: 154/154. Corretti: test retroattivo con data locale (falliva dopo mezzanotte), virgola mancante in schema.sql dopo il merge A+D, riquadro Promemoria materiali in Impostazioni (spazio irregolare, giorni troppo vicini), `drawAreas` in stock.js se la pagina cambia.
- E2E su `cypress-tests`: menu ora 31 voci; officina e scanner verdi (il "tailwind is not defined" era il CDN lento); ui-review rilanciato.
- DA FARE: applicare le migrazioni D1 0017-0028 e `wrangler deploy` (bloccato dai permessi della sessione: serve il via libera di Marco). Poi: prove di Christian (elenco nelle relazioni degli agenti), fattura XML vera (attesa), PDF/DDT veri, regolamento punti (domanda 21), conferma testi legali da un professionista.

- **PUBBLICATO 2026-10-16**: migrazioni D1 0017-0028 applicate (dopo un errore 7403 passeggero) e deploy versione 85187afc. Marco ha dato il consenso esplicito a eseguire wrangler. Resta il controllo E2E ui-review (1 test instabile "ricerca globale e codice sconosciuto").

## Agente F: errori parlanti nell interfaccia
- Nuovo officina/public/errori.js (logica pura, testata in tests/errori.test.mjs): classifica 400/401/403/404/409/429/5xx, rete assente, timeout, risposta HTML (login Access); usa code/hint del backend se presenti.
- util.js: api() con timeout 30 s e ApiError; toast con suggerimento e pulsanti; safe() con Riprova; busy() anti doppio click; gestore globale error/unhandledrejection e avvisi offline/online.
- repair.js: avanzamento a "in attesa di approvazione" senza preventivo bloccato prima del server con pulsante "Inserisci ora"; un solo azione alla volta.
- sales.js: data retroattiva, riquadro aperto e spunta stampa non si azzerano piu al ridisegno del carrello.
- Manuale sezione 30. Test officina 161/161. Backend (agente E): aggiungere code/hint ai JSON d errore.
- **Agente E (2026-10-16) - errori parlanti nel backend**: nuovo `officina/errori.mjs` (HttpError con `code`/`hint`, mapper errori SQLite/D1, `toResponse`, codice di riferimento E-xxxx per i 500 loggati con metodo/path/utente/id). JSON d error: `{ok,error,code,hint,ref?}` (status invariati). JSON del corpo non valido ora = 400 (prima ignorato). BUG corretto: acconto su riparazione consegnata/annullata ora rifiutato (409). Test: officina/tests/errori.test.mjs; suite 161/161. Frontend/notify/bot non toccati: vedi relazione per cosa mostrare (`hint`).
## Agente H - Errori parlanti nel bot Termux (2026-10-16)
- **Cosa**: `termux-bot/main.py` riscritto nella parte di rete/errori, `termux-bot/aggiorna-telefono.sh` (backup, copia, riavvio, verifica, ripristino), README, `tests/test_errori.py` (18 test nuovi; totale 49 verdi). Telefono NON toccato, nessun push/deploy.
- **Prima -> dopo**: "Invio Telegram fallito: URLError" -> "Invio Telegram non riuscito (tentativo 2): Telegram non raggiungibile: nessuna risposta in 20 s - riprovo tra 6 s" (e in coda se non va). "Dati del gestionale: rete non raggiungibile" -> "gestionale non raggiungibile (nessuna risposta in 20 s)" + avviso unico "dura da HH:MM, riprovo ogni 5 min" + "ripristinato dopo X min". "<servizio> non risponde" -> con motivo, ora d'inizio, cosa succede nel frattempo.
- **Distinzione**: errori passeggeri (retry, un solo avviso dopo 2 giri, coda messaggi, telefono offline = controlli sospesi) vs veri (401/403/404 su /api/monitor, token Telegram errato: avviso subito con cosa controllare).
- **Bug corretti**: risposta /api/monitor non-dizionario (es. `[]`) mandava in AttributeError il giro; messaggio HTML troncato a meta' tag o con tag non valido veniva perso (ora taglia a-capo e rimanda in testo semplice); messaggi persi se Telegram era giu' (ora coda); traceback poteva contenere il token (ora ripulito); buongiorno/riepilogo che falliva a costruirsi veniva perso in silenzio; heartbeat fermo durante i giri lenti e crash se il disco non e' scrivibile; falsi "4 servizi giu'" a telefono senza rete.
## Agente G: Notifiche Telegram di errore chiare + registro errori
- **Problema**: "Avanzamento: operazione non riuscita (400) Inserisci prima il preventivo" non diceva quale riparazione, quale cliente, cosa fare, e un errore di compilazione pesava come un guasto.
- **Cosa**: `describeFailure`/`renderFailure` in `officina/notify.mjs`: titolo "Riparazione R-0123 (Mario Rossi, iPhone 13): non si puo' avanzare a «Preventivo da approvare»", motivo, stato attuale, azione consigliata (`hint` del JSON d'errore, altrimenti predefinita per codice), chi e quando. Contesto letto dal DB (preload generico per riparazioni, vendite, prodotti, clienti, fornitori, preventivi, ordini) e dal corpo; mai PIN/documenti/token (il token del link cliente e' sostituito con "…").
- **Gravita'**: 400/404/409/422/429 = avviso SENZA suono; 401/403 = permesso negato (suono); 5xx/eccezioni = errore del sistema (suono, codice `E-XXXXX`, percorso, versione da `CF_VERSION_METADATA.id` o `APP_VERSION`).
- **Anti-spam**: stesso utente + stesso tipo di operazione + stesso motivo entro 10 min (5 per i 5xx) = un solo avviso; le ripetizioni aggiornano `count` nel registro e il prossimo avviso dice "ripetuto altre N volte". Basato sul DB (vale tra piu' istanze del Worker).
- **Registro**: migrazione **0031** `error_log` (+ `schema.sql`), modulo `officina/errori.mjs`, `GET /api/errors` (solo admin, sola lettura; filtri severity/user/status/from/to/q/page/size), retention 90 giorni (pulizia automatica oraria + nel cron notturno di `worker.mjs`).
- **Bug trovati nel modulo notifiche**: (1) `sendTelegram` troncava a 3890 caratteri anche in mezzo a tag/entita' HTML: Telegram rifiutava l'intero messaggio (ora `safeTruncate`); (2) importi non numerici stampati come "NaN €"; (3) conversione preventivo senza metodo: "(incassata )"; (4) `lastErr` (anti-raffica) in memoria e mai ripulita, sostituita dal controllo su DB; (5) avviso generico senza contesto per ogni errore.
- **Test**: `notifiche.test.mjs` (+10), `api.test.mjs` aggiornato. `npm run test:officina` 164/164. Manuale sez. 18 aggiornata.

## Sessione 2026-10-16 - Intervento "errori parlanti" (agenti E, F, G, H) e fusione
- **Causa dell'avviso di Christian** ("Avanzamento: operazione non riuscita (400) Inserisci prima il preventivo"): avanzamento a 'Preventivo da approvare' senza preventivo/opzioni; controllo giusto, messaggio povero. Non e' un errore del bot: l'avviso arriva dal Worker (`notify.mjs`).
- **E (backend)**: `officina/errori.mjs` (HttpError con `code`/`hint`, `mapDbError`, `toResponse`, `ref` E-XXXX sui 500), body JSON rotto = 400 (prima ignorato), messaggi riscritti per riparazioni/vendite/utenti/clienti/fornitori/acconti. Bug corretto: acconto accettato su riparazione gia' consegnata/annullata (ora 409).
- **F (interfaccia)**: `public/errori.js` classifica rete/401/403/404/409/429/5xx/pagina di login Access; toast con suggerimento e "Riprova"; controllo PRIMA di avanzare senza preventivo con pulsante "Inserisci ora"; gestore globale errori; la data "giorno passato" del carrello vendite non si azzera piu'. Da fare: pagine pubbliche del cliente e `nfc.js` hanno ancora `alert`; `retro.js` nella scheda riparazione.
- **G (Telegram)**: avvisi con riparazione/cliente/dispositivo/azione/motivo/cosa fare, gravita' (400/404/409 senza suono; 401/403 e 5xx con suono), anti-spam su DB, registro `error_log` (migrazione 0031, retention 90 giorni) con `GET /api/errors` solo admin. Il modulo del registro e' `registro-errori.mjs` (il nome `errori.mjs` e' di E); l'impronta anti-spam ignora numeri e codici riparazione.
- **H (bot Termux)**: retry Telegram, coda messaggi, un solo avviso per episodio di fermo + "ripristinato", sonda offline, heartbeat, traceback ripulito dai segreti, 7 bug corretti; `termux-bot/aggiorna-telefono.sh` con backup e rollback.
- Manuale rinumerato 25-40 (niente duplicati). Test officina 178/178, test bot 49 (1 saltato).

## Agente I (16/10): Data di inserimento della riparazione
- Richiesta di Christian: campo **Data di inserimento** nella nuova riparazione, automatica (adesso, predefinita) o manuale con data + ora.
- UI (`public/retro.js` `entryDateField/Init/Val`, `repair.js`): campo sempre visibile con spunta «Automatica (adesso)»; togliendola compare un `datetime-local` con max = adesso. Futuro rifiutato anche lato interfaccia con messaggio parlante.
- Backend (`retro.mjs`): accetta `AAAA-MM-GG HH:MM`, anche per oggi se c'e' l'ora; errori con `code`/`hint` (DATA_FUTURA, DATA_NON_VALIDA, DATA_TROPPO_VECCHIA). La data diventa `created_at` della riparazione (report, garanzia, ETA coerenti) e finisce nel Registro "retroattivo".
- **Decisione ruolo Cassa** (default prudente): puo' impostare la data di inserimento SOLO di una nuova riparazione e fino a 7 giorni indietro (`CASSA_MAX_DAYS`); vendite, acconti, consegne con data passata e date piu' vecchie restano all'amministratore (senza limiti).
- Mostrata in scheda riparazione, Storico (lista e dettaglio) e stampe di ingresso (print.mjs). Tracciamento cliente: gia' mostra `received_at` = created_at. Nessuna migrazione.
- Test `officina/tests/data-inserimento.test.mjs` (aggiunto a test:officina): 182/182. Manuale: bullet in «Operazioni con data passata».
## Agente J (frontend, 2026-10-16): errori parlanti lato cliente + vista Errori
- **Pagine pubbliche**: nuovo `public/cliente-errori.js` (script semplice, nessun dato riservato, window.ClientErr): classifica rete/timeout/404/409/410/429/5xx in italiano semplice e rassicurante, "Riprova", niente codici. `preventivo.js` e `track.js` non usano piu' `fetch`/`alert`; la firma resta sul riquadro se la rete cade; 409 = "gia' registrato" con "Aggiorna la pagina"; il polling di track.js non cancella piu' la schermata se cade la rete.
- **nfc.js / carte.js / pdftext.js**: messaggi parlanti per ponte NFC e lettore PDF; l'`alert` col PIN della carta sostituita e' ora una finestra del gestionale.
- **retro.js**: `keepRetro()` conserva data e apertura del riquadro "giorno passato" quando la scheda riparazione si ridisegna (repair.js: 3 righe).
- **Vista admin Errori** (`public/errori-vista.js`, menu Gestione): filtri gravita'/utente/stato/periodo/testo o codice E-XXXXX, paginazione, riepilogo per gravita'; logica pura `describeErrorRow`/`errorsQuery` in `errori.js`.
- Test: `cliente-errori.test.mjs`, `errori-vista.test.mjs` (officina 186/186). Manuale sezione 41 (la 40 esisteva gia': nessun duplicato).
## Agente K - Errori parlanti nei moduli secondari (2026-10-16)
- **Cosa**: ogni `HttpError` dei moduli rimasti (ordini, preventivi, preventivo-riparazione, remote, purchases, ddt, invoices, closings, dareavere, carte, buoni, dispositivi, prestiti, esterne, documenti, credenziali, vault, signatures, usati, expenses, iva, checklists, modelli, note, promemoria, materiali, storico, retro [solo messaggi], clienti, blacks) ha ora messaggio con record/motivo, `code` stabile e `hint`. Status HTTP invariati. Circa 255 codici (tabella nel manuale, sezione 40).
- **Bug corretti**: (1) DOPPIO INCASSO: 3 pagamenti simultanei sulla stessa fattura incassavano 300 su 100 (idem 3 acconti su un ordine): ora dopo l'inserimento si ricalcola e passa solo il primo, gli altri 409 `PAGAMENTO_DOPPIO`/`ACCONTO_DOPPIO` (nessun dato esistente toccato); (2) `POST /api/documenti` senza cliente e `GET /api/carte/creditable` senza cliente davano 500 (parametro SQL undefined): ora 400 `CLIENTE_MANCANTE`; (3) dispositivo/prestito con cliente o fornitore inesistente davano 409 generico "dati collegati": ora 404/400 parlanti; (4) acquisti: qualunque vincolo DB in conferma veniva scambiato per "documento gia' importato" (ora solo UNIQUE); (5) tre export CSV e la foto usati rispondevano con il testo grezzo dell'eccezione: ora passano da `toResponse` con `ref`.
- **Non corretti (fuori perimetro, per E)**: `POST /api/products` con `supplier_id` inesistente e `POST /api/sales` con `customer_id` inesistente restituiscono ancora la FK generica 409 `DATI_COLLEGATI`; `db-node.tx` condivide `depth` tra richieste concorrenti (solo ambiente locale).
- **Test**: `officina/tests/errori-moduli.test.mjs` (61 casi code/hint per modulo + 2 gare doppio incasso + scansione di tutte le rotte contro i 500). `acquisti.test.mjs` aggiornato (testo+code). `npm run test:officina` 241/241. Manuale sez. 40 con tabella codici.

- **16/10 sera, chiusura**: giro E2E completo VERDE (novita 10, officina 13, responsive 43, scanner 10, spese 11, ui-review 134). Aggiornati i test ai nuovi messaggi parlanti (menu 32 voci, "non è valido", "manca il nome", "Link non valido"), tabella codici e testi del manuale a capo su telefono, nota del campo "Data di inserimento" distanziata. Deploy finale online. Test officina 253/253.

## Sessione 2026-10-17 - "Pagamento appeso" / Altra attività
- Richiesta di Christian (chiarita da Marco): alcuni pagamenti verranno fatturati da un'ALTRA azienda di Christian. La Cassa li inserisce con la spunta "Pagamento appeso" e poi non li rivede; solo Christian e Marco li vedono, in Analisi e nei documenti, e possono fare CRUD. (La prima formulazione, "non tracciati", era stata rifiutata come incasso occultato: qui e' attribuzione a un'altra azienda, sempre registrata e verificabile.)
- Backend: migrazione 0032 (`payments.entity`, `sales.entity`, 'main'|'altra'); `entityOf` + `addPayment(..., entity)` in logic.mjs (vendita, nuova riparazione con acconto, acconto, consegna); tutte le letture di cassa/report/analitica/dashboard/monitor/chiusure/carte escludono 'altra'; `GET /api/sales/:id` 404 per non-admin; modulo `altra.mjs` (`GET /api/altra`, CRUD `/api/altra/payments`, `/move`) solo admin, tutto nel Registro; `/api/analytics` ha il blocco `other`. Chiusura cassa: il contante/POS appeso entra nel totale atteso (senza dettaglio) per non creare ammanchi.
- Interfaccia: spunta "Pagamento appeso" (retro.js `appesoField/appesoVal`) in vendita, nuova riparazione, acconto, consegna; vista admin `altra-vista.js` (menu Gestione); riquadro in Analisi > Incassi. Manuale sez. 42. Test `altra-attivita.test.mjs`; officina 258/258.
- Limiti noti: ordini (acconti) e fatture non hanno ancora il flag; le fatture generate da una vendita appesa sono ordinarie (un'entita' per le fatture e' un passo successivo); E2E (menu ora 33 voci) da riallineare in cypress-tests.
- **Completamento (17/10)**: migrazione 0033 (`invoices.entity`); spunta "Pagamento appeso" su acconto/saldo ordini (`ordini.mjs`, `ordini.js`); fatture: `entityFor` (eredita da vendita/riparazione appesa, o scelta dell'admin), campo Azienda in `fatture.js`, la Cassa non vede ne' modifica le fatture 'altra', pagamenti di fattura ereditano l'azienda. Test 260/260. DA FARE: applicare 0033 e deploy.
- **17/10 sera - residui, rotazione, note con foto**: 409 generici -> 404 parlanti (vendita con cliente inesistente `CLIENTE_NON_TROVATO`, articolo con fornitore inesistente `FORNITORE_NON_TROVATO`), `DELETE /api/expenses/:id` inesistente 404 `SPESA_NON_TROVATA`, saldo ordine anti doppio incasso (`SALDO_DOPPIO`), dare/avere nella scheda riparazione (`mountRepairLedger`). Rotazione: soglia "fermo" per articolo (migrazione 0034 `products.stale_days`, NULL=generale, 0=mai) + ricambi piu' usati in Analisi > Magazzino. Note con foto (migrazione 0035 `notes.photos`, fino a 6 JPEG su R2, rotte `/api/note/:id/photo`). Manuale sez. 43. Test 266/266. DA FARE alla pubblicazione unica: migrazioni 0034-0035 + deploy.
- **17/10 notte - richieste di Christian sui ricambi**: fornitore con suggerimenti dall'anagrafica e avviso "Gia' a magazzino?" nel ricambio a mano; modifica dei ricambi usati (`PATCH /api/repairs/:id/parts/:partId`, `updatePart`: nome, quantita' con giacenza, prezzo cliente, costo+IVA, fornitore; Cassa non tocca i costi; non dopo consegna/annullamento); `cost_net`/`cost_vat` aggiunti ai campi nascosti alla Cassa. Nuovo `docs/TEST-DI-CHRISTIAN.md` (30 prove + materiale richiesto) e manuale sez. 44. Test 267/267.

## Sessione 2026-10-18 (Fornitori e carico merce)
- Carico merce: **categoria** anche per l'articolo nuovo; **fornitore facoltativo** (senza fornitore: solo giacenza e ultimo costo, niente documento/storico prezzi). Fornitore inesistente -> `FORNITORE_NON_TROVATO`.
- Anagrafica fornitore estesa (migrazione 0036): P.IVA, sede legale, sede di ritiro operativa, agenti di riferimento (elenco JSON con nome/telefono/email/zona), pagamento concordato, ordine minimo, tempi di consegna.
- Bug D1 "LIKE or GLOB pattern too complex" (ricerca Magazzino con testo lungo, es. codice incollato): `db-d1.mjs` accorcia i pattern LIKE oltre 50 byte.
- Test: `officina/tests/fornitori.test.mjs`; officina 270/270.
- Categorie (migrazione 0037): nuova schermata **Magazzino > Categorie** (crea, rinomina/unisci, elimina se vuota; non per il ruolo Cassa). API `/api/categories`. I suggerimenti del campo Categoria (articolo e carico) e il filtro Aree includono ora anche le categorie create. Test officina 271/271.
