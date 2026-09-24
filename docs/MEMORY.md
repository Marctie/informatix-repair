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
