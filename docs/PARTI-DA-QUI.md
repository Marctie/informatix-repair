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
6. **Ogni modifica o aggiunta al gestionale va riportata anche in tre posti**: (a) avvisi Telegram del Worker (`officina/notify.mjs` + test in `notifiche.test.mjs`), (b) bot di controllo Termux (`/api/monitor`, solo se la funzione tocca controlli/riepiloghi/Buongiorno), (c) documentazione: `officina/public/manuale.html`, `docs/CHATLOG.md`, `docs/MEMORY.md`, questo file. Poi test, commit, push, migrazioni D1 e deploy.
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
1. Domande 58-63: tutte risolte il 15/10 tranne la 62 (BotFather `/setjoingroups`, la fa Marco).
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

## RIPARTENZA NELLA NUOVA CHAT (aggiornata 2026-10-15, sera) – SOSTITUISCE LE PRECEDENTI
**Fatto il 15/10** (tutto online, deploy fino a 6a0a017f+; migrazioni 0015 colore, 0016 preventivo online): notifiche Telegram con dati veri, bot Termux v2, /api/monitor, colore del dispositivo, menu a gruppi, preventivo online con firma (`/p/<codice>`), validita' preventivi in Impostazioni, cron al minuto per i promemoria, acconto con metodo e diviso, pagamenti sempre tracciati ovunque, pulizia dei rami `agente-*` e dei worktree, controllo grafico 20 viste x 4 formati, Cypress riallineato. Dettagli: CHATLOG "Sessione 2026-10-15".
**Cosa resta**:
1. Prove di Marco e Christian su quanto sopra (colore sulle schede stampate, link preventivo dal telefono, acconto diviso, nuovo menu, Buongiorno 8:30 e riepilogo 21:00 del bot).
2. Domande per Marco: 62 (BotFather `/setjoingroups` -> Disable), 27 (cancellare i 19 rami `claude/upbeat-fermi-*`?). **25 ottobre**: routine blog `0 8,17 * * *`.
3. Prova con una fattura XML vera (Acquisti): serve un file reale da Christian.
4. Da decidere con Christian: rifiuto del preventivo dal link -> "annullata"? (resta cosi'), note libere stile Keep (domanda 44), blacklist "Blacks" (12b), carte NFC/punti, DDT/PDF fornitori, testi legali da far verificare.
5. Poi: rotazione prodotti, import DDT, versione vendibile.
**Metodo**: i test E2E si lanciano da `../cy-wt` (`npm run test:e2e`, anche `-- --spec cypress/e2e/<file>.cy.js`), prima `git merge gestionale-officina` li'. Mai Cypress in `main`.

## NUOVO BLOCCO RICHIESTE (2026-10-15, Marco + Christian) – DA SVILUPPARE, in questo ordine
Stato di partenza verificato: preventivi autonomi con validita' + link online `/p/<codice>` GIA' ESISTONO; `orders` (da_ordinare/ordinato/arrivato) e `reminders` GIA' ESISTONO; `devices` esiste; `customers` ha solo nome/telefono/email/note; `repairs.brand_model` e' testo libero.
**Lotto E – base dati e anagrafiche**
1. Clienti azienda: tipo privato/azienda, ragione sociale, P.IVA, CF, indirizzo, SDI/PEC (migrazione 0017).
2. IVA sui ricambi: prezzo IVA esclusa -> calcolo automatico IVA inclusa; flag "applica IVA realmente" (acquisto estero/reverse charge: IVA da aggiungere; "a nero" = nessun incasso/dato nascosto, vedi decisioni ferme: il flag riguarda solo l'IVA di un acquisto, resta tutto registrato).
3. Catalogo marche/modelli (`device_models`): ricerca dalla 3a lettera, popolato con i piu' diffusi (analisi di mercato: smartphone, tablet, PC), auto-aggiunta del modello nuovo alla creazione scheda, sezione CRUD nel gestionale.
**Lotto F – riparazioni**
4. Storico riparazioni completo (cliente, marca, modello, ecc., filtri, ricerca).
5. Riparazioni esterne collegate alla riparazione (laboratorio esterno, costo, date, stato).
6. Dispositivi in prestito / muletto in attesa del proprio (sezione in Dispositivi, legato alla riparazione).
7. Preventivo inviabile al cliente dalla riparazione (link/WhatsApp/email) con validita' X giorni (il link c'e', va collegato alla riparazione).
8. Sezione "Materiali da ordinare" (tutte le righe da_ordinare raggruppate per fornitore) + promemoria giornaliero schedulato (es. ore 12) via Telegram.
**Lotto G – contabilita'**
9. Inserimento retroattivo di vendite/riparazioni/incassi con data passata (entrate, uscite, debiti, dare/avere).
10. Archivio chiusure di cassa: data, contanti/POS/altro, fondo cassa, differenza, note, foto facoltativa, ricerca per periodo, totali mensili.
11. Archivio fatture completo: da pagare/pagate/non pagate/stornate (note di credito), scadenze, filtri.
12. Dare/avere raggruppato per cliente + alert "cattivo pagatore" (debiti non saldati / credito ricorrente), soglia configurabile.
**Regole**: una funzionalita' per volta (test + commit + push + manuale.html + CHATLOG), DB temporanei, mai toccare i dati di Christian, Cypress solo su `cypress-tests`.

### Risposte di Marco (15/10, dopo il blocco richieste)
Prove OK; 62 fatto; 27: NON cancellare i rami `claude/upbeat-fermi-*` (riferimenti); 25/10 routine blog libera; fattura XML vera: ATTESA da Christian (non ancora inviata). Decisioni: rifiuto preventivo -> notifica a Christian; note libere stile Keep: SI; blacklist "Blacks": SI, da fare; carta punti NFC: protetta anti-bypass + SDK lettore generico; DDT/PDF: analisi al momento dell'import (modelli di esempio non ancora disponibili); testi legali: li conferma Claude (essenziale, con ricerca online).
Sviluppo affidato a 4 agenti (A anagrafiche/IVA/retroattivo/blacklist/notifica rifiuto; B modelli/storico/esterne/muletto/note Keep; C chiusure cassa/fatture/dare-avere; D materiali da ordinare/preventivo da riparazione/NFC/import DDT-PDF/testi legali).

### Nuova richiesta di Christian (16/10): data di inserimento della riparazione
Alla creazione di una riparazione deve esserci un campo **Data di inserimento**: automatica (data/ora attuali, predefinita) oppure manuale. Stato: l'agente A ha gia' aggiunto `entry_date` (backend `retro.mjs`: rifiuta futuro e date non valide, scrive nel Registro) ma in UI e' nascosto in "Operazione di un giorno passato?" (`public/retro.js` `retroField`, usato in `repair.js` come `rf-retro`), solo data senza ora, e invisibile al ruolo Cassa. Da fare: campo sempre visibile nel form "Nuova riparazione" con "Oggi" preimpostato e modifica manuale (data + ora), mostrare la data di inserimento nella scheda/storico/stampe, test, manuale, chatlog. Decidere con Christian se il ruolo Cassa puo' modificarla.

### Intervento "errori parlanti" (16/10) - in corso
Causa dell'avviso visto da Marco ("Avanzamento: operazione non riuscita (400) Inserisci prima il preventivo"): Christian ha avanzato una riparazione a 'in attesa di approvazione' senza preventivo/opzioni (`logic.mjs` ~281). Controllo giusto, messaggio povero. L'avviso NON arriva dal bot Termux ma dal Worker (`notify.mjs` righe ~88/317). Il bot (log letti da adb, sola lettura) e' sano: solo "Invio Telegram fallito: URLError" il 14/10 e "rete non raggiungibile" il 16/10 08:36.
Agenti: E backend (errori tipizzati con `code`/`hint`, bug), F frontend (prevenzione e messaggi, perdita rete, gestore globale), G notify.mjs (avvisi con contesto, gravita', anti-spam, tabella `error_log` 0031), H bot Termux (messaggi, retry, aggiornamento del telefono) - H non ancora lanciato: scrittura sul telefono bloccata dai permessi della sessione.

## RIPARTENZA (aggiornata 2026-10-16, pomeriggio) - SOSTITUISCE LE PRECEDENTI
**Online**: gestionale (deploy d45687fd, D1 migrazioni fino a 0031) con lotti E-G, "errori parlanti" (E backend, F interfaccia, G avvisi Telegram + registro `error_log` / `GET /api/errors`), bot Termux aggiornato sul Samsung (backup `main.py.bak-20261016-175307`, altri bot intatti). Test: officina 178/178, bot 49. Branch `gestionale-officina` e `cypress-tests` pushati.
**Cosa resta**: (1) rilanciare da SOLO `npm run test:e2e -- --spec cypress/e2e/ui-review.cy.js` da `../cy-wt` (mai due giri insieme: usano la stessa porta 4960 e lo stesso DB; il "Spese del periodo (2)" fallito era un giro sovrapposto, non un bug); test instabile noto "ricerca globale e codice sconosciuto"; (2) NUOVA RICHIESTA Christian: campo "Data di inserimento" sempre visibile nella nuova riparazione (oggi automatica, o manuale con ora); (3) pagine pubbliche del cliente (`preventivo.js`, `track.js`) e `nfc.js` con messaggi parlanti, `retro.js` nella scheda riparazione; pagina admin per `/api/errors`; (4) messaggi parlanti solo parziali nei moduli ordini/preventivi/fatture/acquisti/carte/closings/ddt; (5) prove di Christian (NFC con lettore, chiusura cassa con foto, PDF fornitori, preventivo senza prezzo -> "Inserisci ora", rete assente), fattura XML vera, DDT d'esempio, regolamento punti (domanda 21), conferma legale dei testi.
**Trucchi nuovi**: `bot_ctl.sh` si lancia con `bash`, non `sh`; per adb push da Git Bash usare `cygpath -w` per i file in /tmp; i merge dei rami agenti generano conflitti ripetuti in CHATLOG/manuale/schema.sql/package.json (script di risoluzione "tieni entrambe le parti"); i worktree degli agenti partono da `main`: serve `git reset --hard gestionale-officina`.

## RIPARTENZA (aggiornata 2026-10-16, sera) - SOSTITUISCE LA PRECEDENTE
**Fatto e ONLINE (deploy 6e0ca38b, nessuna migrazione nuova dopo 0031)**: data di inserimento della riparazione (automatica o manuale con ora; Cassa max 7 giorni indietro, admin/staff senza limiti; agente I), pagine pubbliche del cliente con errori rassicuranti e Riprova (preventivo/track), vista admin "Errori" (Gestione), data "giorno passato" conservata nelle schede (agente J), messaggi parlanti + codici in TUTTI i moduli backend (~255 codici, tabella nel manuale sez. 40), bug corretti: doppio incasso su fatture e acconti ordini, 500 su documenti/carte senza cliente, export con errore grezzo (agente K). Test: officina 253/253; ui-review E2E 134/134 (giro da solo).
**Cosa resta**: (1) ultimo giro E2E completo su `cypress-tests` (lanciato la sera 16/10; mai due giri insieme); (2) prove di Christian: data di inserimento (anche Cassa 3 vs 10 giorni), firma preventivo con rete spenta + Riprova, vista Errori, NFC con lettore, chiusura cassa con foto, PDF fornitori; (3) NON corretti (app.mjs/logic.mjs): `POST /api/products` con supplier_id inesistente e `POST /api/sales` con customer_id inesistente danno ancora 409 generico "dati collegati"; saldo alla consegna ordini (`collect`) possibile gara teorica; `DELETE /api/expenses/:id` su id inesistente risponde 200; (4) fattura XML vera, DDT d'esempio, regolamento punti (domanda 21), conferma legale dei testi; (5) poi: rotazione prodotti, versione vendibile.

## RIPARTENZA (aggiornata 2026-10-16, notte) - SOSTITUISCE LA PRECEDENTE
**Online** (deploy 2fc39882, D1 fino a 0031): tutto quanto elencato nelle ripartenze del 16/10 + data di inserimento riparazione, errori parlanti ovunque (~255 codici), vista admin "Errori", pagine cliente con Riprova, bot Termux aggiornato. Test: officina 253/253, E2E tutti verdi (novita 10, officina 13, responsive 43, scanner 10, spese 11, ui-review 134). Rami `gestionale-officina` e `cypress-tests` pushati.
**COSA MANCA (da fare / da ricevere)**
1. Prove di Christian: data di inserimento (Cassa 3 giorni ok, 10 rifiutato), firma preventivo con rete spenta + Riprova, vista Errori, "Avanza" senza preventivo ("Inserisci ora"), carta NFC con lettore, chiusura cassa con foto, stampe, PDF dei fornitori.
2. Da Christian: fattura XML vera (Acquisti), DDT/PDF d'esempio per tarare l'import, regolamento punti (domanda 21).
3. Da Marco: far confermare i testi legali da un professionista (bozze verificate online, non consulenza); routine blog 25/10 (libera).
4. Piccoli residui: `POST /api/sales` con customer_id inesistente e `POST /api/products` con supplier_id inesistente danno ancora il 409 generico; gara teorica nel saldo alla consegna ordini (`collect`); `DELETE /api/expenses/:id` su id inesistente risponde 200; dare/avere per riparazione non visibile nella scheda riparazione (solo scheda cliente).
5. Poi: rotazione prodotti, versione vendibile. Note libere con foto (domanda 44) non incluse.
**Regole**: un giro E2E alla volta (porta 4960); `wrangler` e aggiornamento bot sul Samsung li posso eseguire io (consenso di Marco); mai toccare i dati di Christian.

## RIPARTENZA (aggiornata 2026-10-17, notte) - SOSTITUISCE LE PRECEDENTI
**Online** (deploy e91a7bb2, D1 fino a 0035): tutto il lavoro di Christian/Marco del 17/10: **Pagamento appeso / Altra attivita'** (spunta su vendita, nuova riparazione, acconto, consegna, ordini; fatture con campo Azienda; vista admin Gestione > Altra attivita'; riquadro in Analisi; Cassa non rivede l'operazione ma il contante entra nel totale atteso della chiusura; tutto nel Registro; migrazioni 0032-0033), residui corretti (404 parlanti, spesa inesistente, saldo ordini anti doppio incasso), dare/avere nella scheda riparazione, soglia "fermo" per articolo (0034), note con foto (0035), ricambi: fornitore con suggerimenti, avviso "Gia' a magazzino?", modifica dei ricambi usati (PATCH parts). Test: officina 267/267; E2E tutti verdi (`cypress-tests` fuso e pushato).
**Documenti nuovi**: `docs/TEST-DI-CHRISTIAN.md` (30 prove, anche manuale sez. 44), `docs/VERSIONE-VENDIBILE.md` (proposta A installazioni separate / B multi-tenant, in attesa di decisione di Marco).
**Cosa resta (non dipende da Claude)**: prove di Christian; da Christian: fattura XML vera, DDT/PDF d'esempio, regolamento punti (domanda 21); da Marco: testi legali da far confermare, scelta versione vendibile, routine blog 25/10 (libera).
**Decisione sul "pagamento appeso"**: accettato perche' e' attribuzione a un'ALTRA azienda di Christian (sempre registrato, visibile agli admin, nel Registro, nel totale cassa); la prima formulazione "non tracciato" resta rifiutata. Non costruire mai incassi senza traccia.
**Regole**: un giro E2E alla volta (porta 4960); wrangler (migrazioni + deploy) li esegue Claude dopo il via libera di Marco ("lancia/pubblica"); mai toccare i dati di Christian; test+commit+push+manuale+CHATLOG a ogni funzione; pubblicazione unica a fine blocco.

## RIPARTENZA (aggiornata 2026-10-19) - SOSTITUISCE LE PRECEDENTI
**Fatto il 19/10**: **etichette prodotto con codice a barre** + **cassa che riconosce il codice letto** (migrazione D1 0038; template da Impostazioni; stampa da Magazzino/scheda articolo/carico merce; Telegram, Registro, backup e manuale aggiornati). Test: officina 289/289, E2E `etichette.cy.js` 13/13. Dettagli: CHATLOG "Sessione 2026-10-19", manuale sez. 45.
**Cosa resta (non dipende da Claude)**: prove hardware di Christian su etichette e pistola (TEST-DI-CHRISTIAN sez. H, prove 31-38) oltre alle 30 precedenti; fattura XML vera, DDT/PDF d'esempio, regolamento punti; testi legali da far confermare; scelta versione vendibile.
**Possibili sviluppi (dal confronto con Fix-Book, 19/10)**: lavagna a colonne con stati personalizzabili, messaggi WhatsApp per ogni stato, calendario appuntamenti, export Excel, ruoli con permessi personalizzabili, IVA sul margine per l'usato, assistente AI su Telegram: decidere con Marco.
**Regole**: invariate (test, commit, push, migrazioni, deploy e documentazione a ogni funzione; un giro E2E alla volta; mai toccare i dati di Christian).

**Confronto e-Share (19/10, sera)**: report in `docs/CONFRONTO-GESTIONALI.md` (con Fix-Book). Spunti da decidere con Marco: IVA a margine + permuta, proposta d'ordine, invio ricevuta/OTP WhatsApp, differenze ordine/arrivo, tecnico assegnato, multi-negozio. Nessuna modifica al codice.

**Confronto Fixh IT (19/10, sera)**: sez. 3 di `docs/CONFRONTO-GESTIONALI.md` (piani e prezzi inclusi). Spunti da decidere con Marco: estensione garanzia/assicurazione, listino pubblico riparazioni, pagamento online acconto/saldo, scarico documenti dal portale, stampa diretta, API e invio SdI (versione vendibile). Nessuna modifica al codice.

## DA FARE - sicurezza (2026-10-23)
1. Marco, pannello Cloudflare: WAF managed rules + Bot Fight Mode; regola WAF che blocca `/.env*`, `/.git*`, `/wp-*`, `/xmlrpc.php`, `*.php`, `/.aws*`; controllare la politica di Cloudflare Access del gestionale.
2. Claude: verificare con `curl -I` gli header online dopo il deploy; valutare CSP (attenzione alla mappa Google in contatti); header di sicurezza anche sul Worker del gestionale.

## RISOLTO (2026-10-23, deploy 201ff162): link cliente bloccati in caricamento
Link `/t/` e `/p/` bloccati in caricamento (manca `/cliente-errori.js` nell'elenco dell'host pubblico). Correzione fatta e testata in `officina/public-assets.mjs`; manca il deploy (`npx wrangler deploy --config officina/wrangler.jsonc`). Poi verificare: `curl -I https://riparazioni.informatixrepair.com/cliente-errori.js` deve dare 200.
