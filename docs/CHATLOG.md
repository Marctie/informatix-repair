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
