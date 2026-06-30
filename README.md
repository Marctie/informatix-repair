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
- Logo definitivo in PNG/SVG ad alta risoluzione (sostituire `public/images/logo.svg`, attualmente un placeholder testuale)
- Foto reali del negozio, del team e dei lavori completati (sostituire i placeholder in `portfolio.html`)
- Social media (Facebook, Instagram)
- Eventuale integrazione di un servizio di invio form reale (es. Formspree) al posto del `mailto:` in `contatti.html`
