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

## Stato (2026-10-13, notte) – ONLINE
Fatto: Officina su Cloudflare Workers + D1, Access (One-time PIN, policy Everyone), pagina Utenti, `/api/lookup`, sito sul branch `sito-segui-riparazione` (non in main). Dettagli: `docs/CHATLOG.md`, sezione "Officina ONLINE su Cloudflare".
Deploy: `npx wrangler deploy --config officina/wrangler.jsonc` (da `informatix-repair`).

## Da fare (ordine)
1. Attivare R2 (dashboard) e backup giornaliero (cron) sul Worker.
2. Ripassare Cypress: merge di `gestionale-officina` in `cypress-tests`, riportare i test sul nuovo motore (Hono/async).
3. Vetrina Usati sullo stesso Worker (foto ridimensionate nel browser) e Portale unico dopo "Area riservata"; manuale/`docs/ONLINE.md`.
4. Via libera dell'utente -> sito in `main` (branch `sito-segui-riparazione`).
5. Prove hardware di Christian (pistola, stampante, etichette, fotocamera in https).
6. **Import ordini fornitore (PDF) + storico prezzi + avvisi scorte** (richiesta di Christian, dettagli in CHATLOG "Nuovo sviluppo richiesto"): servono PDF di esempio.
7. **Rotazione prodotti**: grafico piu'/meno richiesti e allarme invenduto con suggerimento offerta/controllo prezzo (CHATLOG "Rotazione prodotti e invenduto").
8. **Progetto Analisi** (CHATLOG "Progetto Analisi") e, per ultimi, **Buoni sconto/regalo** e **Carte fedelta' NFC** (CHATLOG "Nuovi sviluppi richiesti ... Buoni"): il regolamento punti arriva da Christian.

## Domande ancora aperte
- Email di Christian e delle 3 postazioni (arrivano da Christian); alias con Cloudflare Email Routing per le postazioni?
- Ruolo del proprietario: admin protetto (default).
- Destino del bot Telegram online.
- Pulizia dei 19 rami remoti `claude/upbeat-fermi-*` (residui della routine blog); cambio orario UTC della routine blog il 25 ottobre (`0 8,17 * * *`).

## Frase per iniziare la nuova sessione
> Leggi `docs/PARTI-DA-QUI.md`, poi `docs/MEMORY.md` (sezione ONLINE) e riprendi dal punto 1 del piano della serata. Rispetta le regole dell'utente: test, commit e push a ogni funzionalità.
