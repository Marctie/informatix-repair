# PARTI DA QUI – foglio di ripartenza (aggiornato 2026-10-13, sera)

Questo file serve a riprendere il lavoro in una **sessione nuova e leggera**. Il dettaglio completo sta in `docs/MEMORY.md` (sezione **"ONLINE: decisioni e piano VALIDI"**) e in `docs/CHATLOG.md` (ultime sezioni "Sessione 2026-10-13 …"). La memoria di Claude contiene gli stessi punti.

## Dove sta il codice
- Repo: `informatix-repair` (GitHub `Marctie/informatix-repair`).
- Branch di lavoro: **`gestionale-officina`** (app) e **`cypress-tests`** (test; contiene Cypress, **mai in `main`**). Flusso: si sviluppa su `gestionale-officina`, poi `git merge gestionale-officina` dentro `cypress-tests`.
- `main` = sito pubblico (Cloudflare Pages). **Via libera a toccarlo solo a lavoro finito e testato.**
- Cartelle: `officina/` (gestionale riparazioni, Express + `node:sqlite`, da portare su Workers+D1), `admin/` (Vetrina Usati), `bot/` (bot Telegram, non installato), `cypress/` (solo su `cypress-tests`).

## Come si avvia / si prova
- Officina: doppio click su `AVVIA-OFFICINA.bat` oppure `npm run officina` → http://localhost:4950 (pubblico tracciamento 4951). Vetrina Usati: `npm run admin` → http://localhost:4848.
- Test API: `npm run test:officina` (11). Test E2E (solo su `cypress-tests`): `npm run test:e2e` (175 test, DB temporaneo per file; da VS Code serve togliere `ELECTRON_RUN_AS_NODE`, già fatto in `cypress/run.mjs`).
- Controllo grafico automatico: `cypress/e2e/ui-review.cy.js`.

## Regole dell'utente (non negoziabili)
1. **Test, commit e push a ogni funzionalità completata**; aggiornare CHATLOG e MEMORY.
2. **Grafica pulita e responsive**: solo il sistema di spaziatura di `officina/public/index.html` (`sec`, `fgrid`, `field`, `row`, `kv`, `panel`…), mai margini a caso; guardare gli screenshot a 320/390/768/1280 e far girare `ui-review`. Non togliere il prefisso `html body input…` (reset di Tailwind).
3. **Veloce e pratico per Christian** (pochi click). Extra utili e veloci si possono aggiungere, registrandoli.
4. Le **prove con l'hardware** (pistola, stampante, etichette, fotocamera) le fa Christian: dire cosa provare.
5. Nessun merge in `main` finché non è tutto finito e testato; poi via libera già dato.

## Piano della serata (ordine di priorità)
1. **Cloudflare**: Zero Trust/Access, `wrangler login` (segnalati scope mancanti `k2.read`/`k2.write`), Worker + D1 + R2. Host `gestionale.informatixrepair.com` (Access) e `riparazioni.informatixrepair.com` (pubblico). Piano B: Tunnel + Access con PC acceso.
2. **Portare l'officina su Workers + D1** (Hono, logica asincrona, `db.batch` al posto delle transazioni, QR compatibile coi Worker, backup giornaliero su R2), test API e Cypress riportati e verdi.
3. **Utenti e Portale unico**: Access su "chiunque con codice email", il Worker decide chi entra dalla tabella `users`; Christian admin e **unico** a fare CRUD utenti; postazioni Cassa/Laboratorio/Vendite = `staff` senza restrizioni; stasera si crea **solo** `marcopeluso99@gmail.com` (admin protetto); gli altri quando arrivano le email. Portale dopo "Area riservata" con Officina + Vetrina usati + Manuale: veloce, responsive, **accessibile** (cypress-axe).
4. **Sito pubblico** (ramo a parte, poi `main`): sezione "Segui la tua riparazione" molto semplice per anziani (QR, oppure numero ricevuta + ultime 4 cifre del telefono, chiama/WhatsApp, endpoint `POST /api/lookup`) + link "Area riservata" nel piede di pagina verso `gestionale.informatixrepair.com`.
5. **Vetrina Usati** integrata nello stesso design system e sullo stesso Worker (scrive su GitHub; foto ridimensionate nel browser).
6. Manuale e guide aggiornati (`docs/ONLINE.md`), CHATLOG/MEMORY, commit e push.

Stima 90%: **20-30 ore di lavoro** totali; la serata copre i punti 1-2 e, se possibile, 3.

## Domande ancora aperte
- Email di Christian e delle 3 postazioni (arrivano da Christian); alias con Cloudflare Email Routing per le postazioni?
- Ruolo del proprietario: admin protetto (default).
- Destino del bot Telegram online.
- Pulizia dei 19 rami remoti `claude/upbeat-fermi-*` (residui della routine blog); cambio orario UTC della routine blog il 25 ottobre (`0 8,17 * * *`).

## Frase per iniziare la nuova sessione
> Leggi `docs/PARTI-DA-QUI.md`, poi `docs/MEMORY.md` (sezione ONLINE) e riprendi dal punto 1 del piano della serata. Rispetta le regole dell'utente: test, commit e push a ogni funzionalità.
