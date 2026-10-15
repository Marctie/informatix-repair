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

## Stato (2026-10-14, fine giornata)
Leggi PRIMA la sezione "STATO A FINE GIORNATA 2026-10-14" in `docs/CHATLOG.md`: elenca cosa e' online, il bot Termux installato sul Samsung, i test e i due branch degli agenti ancora da fondere (Vetrina Usati + Portale; import fatture). Deploy: `npx wrangler deploy --config officina/wrangler.jsonc` da `informatix-repair`. Sito pubblico gia' in `main`.

## Da fare (ordine)
1. Attivare R2 (dashboard) e backup giornaliero (cron) sul Worker.
2. Ripassare Cypress: merge di `gestionale-officina` in `cypress-tests`, riportare i test sul nuovo motore (Hono/async).
3. Vetrina Usati sullo stesso Worker (foto ridimensionate nel browser) e Portale unico dopo "Area riservata"; manuale/`docs/ONLINE.md`.
4. Via libera dell'utente -> sito in `main` (branch `sito-segui-riparazione`).
5. Prove hardware di Christian (pistola, stampante, etichette, fotocamera in https).
6. **Import ordini fornitore (PDF) + storico prezzi + avvisi scorte** (richiesta di Christian, dettagli in CHATLOG "Nuovo sviluppo richiesto"): servono PDF di esempio.
7. **Rotazione prodotti**: grafico piu'/meno richiesti e allarme invenduto con suggerimento offerta/controllo prezzo (CHATLOG "Rotazione prodotti e invenduto").
8. **Progetto Analisi** (CHATLOG "Progetto Analisi") e, per ultimi, **Buoni sconto/regalo** e **Carte fedelta' NFC** (CHATLOG "Nuovi sviluppi richiesti ... Buoni"): il regolamento punti arriva da Christian.

9. **Dopo tutto**: versione vendibile ai clienti (installazioni separate + pannello centrale; CHATLOG "gestionale vendibile ai clienti").

## Domande ancora aperte
**L'elenco completo e aggiornato e' in `docs/DOMANDE-APERTE.md`** (da mandare a Christian tutte insieme). Sotto, il riepilogo storico:
- Email di Christian e delle 3 postazioni (arrivano da Christian); alias con Cloudflare Email Routing per le postazioni?
- Ruolo del proprietario: admin protetto (default).
- Destino del bot Telegram online.
- Pulizia dei 19 rami remoti `claude/upbeat-fermi-*` (residui della routine blog); cambio orario UTC della routine blog il 25 ottobre (`0 8,17 * * *`).

## Frase per iniziare la nuova sessione
> Leggi `docs/PARTI-DA-QUI.md`, poi `docs/MEMORY.md` (sezione ONLINE) e riprendi dal punto 1 del piano della serata. Rispetta le regole dell'utente: test, commit e push a ogni funzionalità.

## RIPARTENZA NELLA NUOVA CHAT (2026-10-14, fine sessione)
Leggi in quest'ordine: 1) `docs/CHATLOG.md` sezione "STATO A FINE GIORNATA 2026-10-14" e il suo aggiornamento di mattina; 2) `docs/DIRETTIVE-CHRISTIAN.md` (20 direttive + piano a lotti A-D in fondo + aggiornamenti); 3) `docs/TESTI-LEGALI-BOZZE.md`; 4) `docs/DOMANDE-APERTE.md`.
**Prossimo passo**: lotto A (partire dalla doppia conferma sulle eliminazioni, p.20), poi p.3 (togliere "non tracciato" + ruolo Cassa per info@informatixrepair.it), p.5, p.8, p.6, p.7. Poi lotto B: fondere i rami `worktree-agent-acc7fa5f69abbcf69` (Vetrina Usati online + Portale, migrazione 0004) e `worktree-agent-abb82441c706f929f` (import fatture XML, migrazione 0005) in `gestionale-officina`.
**Regole**: test+commit+push a ogni funzione; aggiorna SEMPRE manuale (`officina/public/manuale.html`) e CHATLOG; grafica pulita e responsive; veloce al banco; Cypress solo su `cypress-tests` (worktree `../cy-wt`), `main` solo con via libera. NON costruire incassi o dati nascosti ai controlli (decisione ferma, vedi punto 3). Non aggirare i blocchi di sicurezza: spiegare e far decidere.
**Comandi**: test `npm run test:officina`; deploy `npx wrangler deploy --config officina/wrangler.jsonc`; migrazioni `npx wrangler d1 migrations apply officina --remote --config officina/wrangler.jsonc`; adb in `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (in Git Bash con MSYS_NO_PATHCONV=1; per Termux: script via `adb push` in /data/local/tmp e `adb shell run-as com.termux sh script`). Bot Termux sul Samsung gestito dal Control Center (`~/bots/Termux-Launcher/bot_ctl.sh informatix_repair start|stop|restart`).
**Frase per iniziare**: "Leggi docs/PARTI-DA-QUI.md (sezione RIPARTENZA NELLA NUOVA CHAT) e riparti dal lotto A."

## RIPARTENZA NELLA NUOVA CHAT (aggiornata 2026-10-14, sera) – SOSTITUISCE LA PRECEDENTE
**Stato**: lotti A, B (fusione), C e D FATTI e ONLINE (deploy b0570dc9; migrazioni D1 0001-0014 applicate, la 0010 non esiste). Branch `gestionale-officina` = tutto fuso e pushato (ultimo commit eae2b03 + eventuali). Test `npm run test:officina`: 81 verdi. Non rifare i punti 2-20 delle direttive: sono implementati (vedi manuale sezioni 1-24 e CHATLOG sezioni Agente A-D).
**Vetrina Usati**: online sul gestionale, pubblica su GitHub (`content/usati/usati.json` in `main`); segreto GITHUB_TOKEN e bucket R2 `officina-media` creati; i 13 articoli di Christian reimportati (seed `officina/seed/usati.sql`) dopo che una prova li aveva sovrascritti. Il vecchio gestionale locale `npm run admin` (porta 4848) esiste ancora ma scrive un elenco separato: DECISO (2026-10-14): si usa SOLO il gestionale online; il locale non va usato.
**FATTO (VAULT_KEY creata e provata, copia su Mega)**: creare il segreto `npx wrangler secret put VAULT_KEY --config officina/wrangler.jsonc` (cifra Documenti d'identita' e Credenziali; senza, quelle due sezioni rifiutano di salvare) e conservarne una copia fuori dal gestionale.
**Da fare poi (io)**: 1) raggruppare il menu (21 voci: troppe) 2) controllo grafico a 4 formati (320/390/768/1280) di tutte le viste nuove, anche a telefono (Edge headless sotto ~500 px non e' affidabile) e `ui-review` 3) riportare i test Cypress sul nuovo motore (branch `cypress-tests`, worktree `../cy-wt`: fondere gestionale-officina e rifare i test per le nuove viste) 4) provare online con una fattura XML vera (Acquisti) 5) Cron Worker per i promemoria Telegram a gestionale chiuso 6) link online per approvare i preventivi autonomi 7) schermata Impostazioni per validita' preventivi 8) note libere del punto 10 9) acconto diviso 10) rivedere: rifiuto del preventivo dal link ora porta a "annullata" 11) pulizia worktree `.claude/worktrees/agent-*` e rami `agente-*`, `worktree-agent-*` dopo la verifica.
**In attesa di Christian** (`docs/DOMANDE-APERTE.md`, domande 38-57 con i default scelti dagli agenti): aree magazzino fisse o personalizzabili, "Blacks" (p.12b), regolamento punti/carte NFC e template buoni, email delle 3 postazioni, seconda parte del p.8, testi legali da far verificare (bozze in `docs/TESTI-LEGALI-BOZZE.md`), PDF/DDT di esempio dei fornitori.
**Prove di Christian (hardware)**: stampa A4 della scheda cliente (due copie) e della scheda laboratorio (una pagina), firma col dito su tablet/telefono anche da link, pistola/fotocamera per seriali, carico merce, buoni.
**Ambiente/autorizzazioni**: regole Bash gia' aggiunte dall'utente per `wrangler deploy`, `d1 migrations apply`, `d1 execute`, `git merge`. Un errore D1 7403 al primo tentativo e' passeggero: riprovare. Token del bot Telegram: l'utente ha deciso di NON revocarlo.
**Metodo che funziona**: agenti in worktree isolati su rami `agente-*`, migrazioni numerate a parte, fusione fatta da me con script che tiene entrambe le parti (attenzione: le righe di chiusura condivise `);`/`});`/`</section>` si perdono nei conflitti: controllare schema.sql e manuale dopo ogni fusione, poi `npm run test:officina`).
**Preferenze dell'utente**: una cosa per volta quando chiede cosa serve da lui; passi da fare al terminale spiegati semplici; mai incollare segreti in chat (ma lui lo ha fatto una volta: spiegare e far rigenerare).

## RIPARTENZA NELLA NUOVA CHAT (aggiornata 2026-10-15) – SOSTITUISCE LE PRECEDENTI
**Stato**: tutto il lavoro del 14/10 e' online; il 15/10 mattina: notifiche Telegram riscritte con i dati veri, bug della numerazione dopo un'eliminazione corretto, `/api/monitor` + segreto `MONITOR_TOKEN`, bot Termux v2 installato sul Samsung (buongiorno 8:30, riepilogo 21:00, controlli Vetrina/backup/lentezza). Test 88 + 31 verdi. Dettagli: CHATLOG "Sessione 2026-10-15 (mattina)".
**Cosa resta (in ordine)**:
1. Domande per Marco (DOMANDE-APERTE 58-63): VAULT_KEY "da chiarire", incasso di prova da 34 €, utente di prova amministratore, incassi cancellati con l'eliminazione delle riparazioni, BotFather `/setjoingroups`, orari del buongiorno.
2. **25 ottobre**: routine del blog all'ora solare `0 8,17 * * *`.
3. Raggruppare il menu (21 voci).
4. Controllo grafico a 4 formati (320/390/768/1280) di tutte le viste nuove + `ui-review`.
5. Cypress sul nuovo motore: `cypress-tests` (worktree `../cy-wt`) e' molto indietro: fondere `gestionale-officina` e rifare i test delle viste nuove.
6. Prova con una fattura XML vera (Acquisti).
7. Promemoria a gestionale chiuso: ora li fa partire il bot ogni 5 min; resta da valutare un cron sul Worker per quando il telefono e' spento.
8. Link online per approvare i preventivi autonomi; schermata Impostazioni per la validita' dei preventivi; note libere stile Keep; acconto diviso; rifiuto del preventivo dal link → "annullata" da rivedere.
9. Pulizia: worktree `.claude/worktrees/agent-*`, rami `agente-*`, `worktree-agent-*`, i 19 `claude/upbeat-fermi-*` remoti.
10. Prove hardware e risposte di Christian (DOMANDE-APERTE 1-57).
11. Dopo: import DDT/PDF fornitori, rotazione prodotti, carte NFC, versione vendibile.
**Bot sul telefono**: `~/informatix-bot` (v2), `.env` con TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, MONITOR_TOKEN. Aggiornamento: `adb push` in `/data/local/tmp/...` + `adb shell run-as com.termux sh script` (lo script imposta PREFIX/HOME/PATH di Termux), riavvio `bash ~/bots/Termux-Launcher/bot_ctl.sh informatix_repair restart`. Prova: `python main.py --anteprima`.
