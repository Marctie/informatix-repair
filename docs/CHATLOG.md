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
