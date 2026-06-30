# Informatix Repair

Sito vetrina per Informatix Repair, negozio di riparazioni informatiche a Nocera Superiore (SA).

## Stack

- [Vite](https://vitejs.dev/) (multi-pagina, vanilla JS)
- [Tailwind CSS](https://tailwindcss.com/)
- Deploy automatico su GitHub Pages via GitHub Actions

## Sviluppo locale

```bash
npm install
npm run dev
```

## Build di produzione

```bash
npm run build
npm run preview
```

L'output statico viene generato in `dist/`.

## Deploy

Ad ogni push su `main`, il workflow `.github/workflows/deploy.yml` builda il sito e lo pubblica su GitHub Pages.

Per abilitare GitHub Pages la prima volta:
1. Vai su **Settings → Pages** del repository
2. In **Source** seleziona **GitHub Actions**

URL pubblicazione: `https://<username>.github.io/informatix-repair/`

## App Android (APK) con Capacitor

Il progetto include già la piattaforma Android generata da [Capacitor](https://capacitorjs.com/) nella cartella `android/`.

Requisiti: [Android Studio](https://developer.android.com/studio) installato in locale (con Android SDK).

```bash
npm run cap:sync   # builda il sito e sincronizza dist/ dentro android/
npm run cap:open   # apre il progetto in Android Studio
```

Da Android Studio:
- **Run** per testare su emulatore/dispositivo
- **Build → Generate Signed Bundle / APK** per generare l'APK firmato da distribuire

Configurazione app: `capacitor.config.ts` (`appId: it.informatixrepair.app`, `appName: Informatix Repair`).

**Importante**: l'app NON bundla i file statici di `dist/` — `server.url` in `capacitor.config.ts` punta al sito live su GitHub Pages (`https://marctie.github.io/informatix-repair/`). L'APK è quindi un wrapper WebView che mostra sempre la versione pubblicata, senza bisogno di ricompilare l'app a ogni modifica del sito. Richiede connessione internet per funzionare.

Se in futuro si preferisce un APK realmente offline (contenuti bundlati), basta rimuovere la chiave `url` da `server` in `capacitor.config.ts` e rilanciare `npm run cap:sync`.

Nota: prima della pubblicazione su Play Store conviene:
- sostituire i contenuti placeholder (vedi TODO sotto)
- valutare l'aggiunta di funzionalità native (notifiche push, fotocamera, geolocalizzazione) per rispettare le policy anti "wrapper senza valore aggiunto" di Google Play
- generare le icone/splash screen dell'app (es. con `@capacitor/assets`)

## Struttura

```
index.html          Home
chi-siamo.html       Chi Siamo
servizi.html         Servizi
portfolio.html        Portfolio lavori
contatti.html         Contatti
src/main.js           Navbar/footer condivisi, menu mobile, filtro portfolio
src/styles/main.css   Stili Tailwind + custom
public/images/        Logo e immagini statiche
```

## TODO contenuti da confermare con il cliente

- Numero di telefono e WhatsApp
- Indirizzo completo (via, civico)
- Orari di apertura esatti
- Logo reale già inserito (`public/images/Informatix-logo.png`)
- Foto reali del negozio, del team e dei lavori completati (al momento `portfolio.html` usa foto stock Unsplash a tema, da sostituire con foto reali dei lavori quando disponibili)
- Social media (Facebook, Instagram)
- Eventuale integrazione di un servizio di invio form reale (es. Formspree) al posto del `mailto:` in `contatti.html`
