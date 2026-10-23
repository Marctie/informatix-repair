# Confronto con altri gestionali (spunti per le richieste di Christian)

Scopo: se Christian chiede una modifica, partire da qui per vedere come l'hanno risolta gli altri e integrare. Fonti: solo pagine pubbliche (nessuna demo, nessun prezzo noto).

## 1. Fix-Book (confronto del 19/10 mattina)
Spunti emersi: lavagna a colonne con stati personalizzabili, messaggi WhatsApp per ogni stato, calendario appuntamenti, export Excel, ruoli con permessi personalizzabili, IVA sul margine per l'usato, assistente AI su Telegram. Dal confronto sono nate le etichette con codice a barre + cassa con pistola (CHATLOG 19/10). Il resto: da decidere con Marco.

## 2. e-Share (www.e-share.me, confronto del 19/10) - e-Pol SRL, Piacenza
Prodotto per riparatori (telefonia), anche multi-negozio / rete di negozi. Messaggio: "Quanto guadagni davvero?". Schede: Riparazioni, Prodotti, Documenti, Statistiche, Andamento. Sito = vetrina commerciale, richiesta demo, nessun prezzo. Il testo e' in gran parte immagini: dettagli sotto la superficie non verificabili.

### Funzioni dichiarate e confronto con il nostro
| e-Share | Nostro gestionale | Esito |
|---|---|---|
| Riparazioni check-in -> riconsegna, preventivo firmato, scheda per dispositivo | Presente (preventivo approvabile dal cliente, firme con prova, scheda ingresso, checklist, tracciamento QR) | Pari |
| Accettazione con IMEI + difetto + etichetta QR | Presente (IMEI/seriale con Luhn, QR, Code128, stampa rapida) | Pari |
| Firma OTP sulla scheda (codice via SMS/WhatsApp) | Firma disegnata con IP, data, testo mostrato (non OTP) | Possibile: OTP come alternativa a distanza |
| Scontrino/ricevuta inviata via WhatsApp o SMS | WhatsApp precompilato per avvisi; non invio del documento | Possibile: invio ricevuta/PDF |
| Magazzino con ubicazione, EAN, etichette | Presente (categorie, EAN/codice interno, etichette, pistola) | Pari; ubicazione da verificare |
| Proposta d'ordine calcolata + riordino automatico | Avvisi scorta bassa / fermo, "Da ordinare", ordini fornitore | Parziale: manca la proposta d'ordine con quantita' calcolate |
| Ordine al fornitore via API | Ordini manuali, import PDF/fatture con apprendimento formati | Fuori portata (serve accordo coi fornitori) |
| Arrivi merce con controllo delle sole differenze | Carico merce, DDT, storico prezzi e variazioni | Parziale: controllo differenze ordine/arrivo da valutare |
| Usato: IVA a margine, IMEI tracciati, ritiro in permuta | Usati con vetrina e IMEI; IVA a margine non presente; permuta non presente | Da fare: IVA a margine + permuta (anche dal confronto Fix-Book) |
| Documenti fiscali generati dal flusso (fatture, DDT) | Fattura XML FatturaPA, DDT, documenti non fiscali | Pari/da validare con XML vero di Christian |
| Cassa: controllo contante, chiusura guidata | Presente (chiusure, totale atteso, dare/avere) | Pari |
| Lavorazione con codice dell'operatore | Utenti e ruoli, registro attivita' | Parziale: tecnico assegnato per lavoro da verificare |
| Statistiche per categoria e punto vendita | Analisi (riparazioni, incassi, vendite, acquisti, magazzino) | Pari su singolo negozio |
| Multi-negozio, listini e permessi condivisi | Un solo negozio (vedi VERSIONE-VENDIBILE.md) | Non coperto: collegato alla scelta A/B |
| E-Race: classifica tra negozi a obiettivo incassi | Nessuno | Idea di marketing/gamification, solo se piu' negozi |

### Nostri punti di forza (che il sito e-Share non cita)
Avvisi Telegram + bot di controllo, registro attivita', backup R2, online su Cloudflare (Workers/D1/Access) senza PC, analisi prezzi fornitori con grafico a punti, import fatture con apprendimento, tracciamento cliente "facile per anziani", manuale e test automatici.

### Idee ordinate per utilita' (da proporre a Marco, non ancora decise)
1. IVA a margine + ritiro in permuta (usato).
2. Proposta d'ordine calcolata dalle soglie di scorta.
3. Invio ricevuta/preventivo via WhatsApp (e firma OTP a distanza).
4. Controllo differenze tra ordine e arrivo merce.
5. Tecnico assegnato alla lavorazione + statistiche per tecnico.
6. Multi-negozio / classifica: solo se si sceglie la versione vendibile.

Regola: ogni funzione ripresa da qui va riportata anche in avvisi Telegram, bot Termux (se tocca controlli) e documentazione.

## 3. Fixh IT (https://fixh.it, confronto del 19/10 sera) - Albano Laziale (RM)
Gestionale cloud (OVHcloud, server europei, backup giornaliero) per riparatori di smartphone, tablet e PC, venduto ad abbonamento, anche tramite rivenditori. Prova gratuita 30 giorni, nessun vincolo, nessun rinnovo automatico (dopo la scadenza i dati restano scaricabili 60 giorni). Fonte: home, /features, /pricing e FAQ pubbliche; nessuna demo.

### Piani (IVA esclusa, prezzo mensile / annuale)
| Piano | Prezzo | Limiti | Note |
|---|---|---|---|
| Individual | 9,99 / 95,90 EUR | 1 negozio, 2 admin, 5.000 clienti, 1.000 prodotti | magazzino, IMEI, portale cliente, QR, etichette, listino online, vetrina e-commerce |
| Business | 24,99 / 239,90 EUR | 3 negozi, 15 admin, 30.000 clienti, 15.000 prodotti | + documenti, cassa (POS), ricevuta online, valutazione permuta, estensioni di garanzia, assicurazione dispositivo, report finanziari |
| Enterprise | 59,99 / 575,90 EUR | 10 negozi, 100 admin, illimitati | + carta fedelta' |
Fattura elettronica: 0,15 EUR a invio (ricarica del conto). Moduli acquistabili singolarmente. Utile come riferimento di prezzo per la versione vendibile (VERSIONE-VENDIBILE.md).

### Funzioni dichiarate e confronto con il nostro
| Fixh IT | Nostro gestionale | Esito |
|---|---|---|
| Ticket riparazione, tracciamento, QR, portale self-service (stato, preventivi, fatture, ricevute, certificati di garanzia) | Presente (link/QR, numero + ultime 4 cifre, approva/rifiuta preventivo); documenti scaricabili dal cliente da verificare | Pari; possibile: scarico documenti dal portale |
| IMEI riconosciuto in automatico + seriali per ricambio | IMEI/seriale con Luhn e avviso doppioni; lettura automatica del modello no | Pari; "IMEI Verify Pro" (controllo blacklist) = nostro `blacks.mjs`, da confrontare |
| Riparazione inviata a laboratori esterni / ricevuta da altri negozi ("Repair Hub") | Riparazioni esterne verso laboratori terzi (`esterne.mjs`) | Pari in uscita; manca il ricevere lavori da altri |
| Marketplace tra negozi (annunci, ricambi, ordini, messaggi) | Vetrina usati pubblica; nessun marketplace | Fuori portata (serve una rete di negozi) |
| Listino online e vetrina e-commerce | Vetrina usati sul sito | Possibile: listino prezzi riparazioni pubblico |
| Valutazione permuta (trade-in) | Non presente | Da fare (insieme a IVA a margine, gia' in lista) |
| Estensioni di garanzia e assicurazione dispositivo | Garanzia sulla riparazione; niente estensioni/assicurazione | Possibile: estensione garanzia a pagamento |
| Cassa, ricevuta online, report incassi giorno/mese/anno | Presente (cassa, chiusure, Analisi) | Pari |
| Fattura elettronica via SdI + import fatture di altri software | XML FatturaPA generato; import PDF/fatture fornitore con apprendimento; invio al SdI non diretto | Parziale: invio automatico al SdI da valutare (costo/accreditamento) |
| Carta fedelta' a punti + buoni sconto | Carta punti NFC protetta, buoni (`carte.mjs`, `buoni.mjs`) | Pari, la nostra e' piu' sicura (NFC) |
| Print Agent: stampa ricevute ed etichette in rete senza driver | Stampa da browser (etichette in mm, schede) | Possibile: stampa diretta senza finestra del browser |
| Chiavi API REST per collegare altri sistemi | Nessuna API pubblica con chiavi (solo `/api/monitor` col segreto) | Idea futura, per la versione vendibile |
| Multi-negozio con cruscotto unico, abbonamento con licenze e rivenditori | Un solo negozio | Collegato alla scelta A/B di VERSIONE-VENDIBILE.md |
| Statistiche in tempo reale, report personalizzati, previsioni | Analisi per periodo (5 schede), avvisi | Parziale: previsioni e report salvabili |
| Pagamenti online (PayPal/Stripe) dal cliente | Non presente | Possibile: link di pagamento acconto/saldo |
| Sicurezza dichiarata (TLS 1.3, AES-256, ISO 27001, uptime 99,9%) | Cloudflare Access + Workers/D1, backup R2, registro attivita' | Pari; da citare nei testi se si vende |

### Punti nostri che Fixh IT non dichiara
Avvisi Telegram e bot di controllo, registro attivita' completo, analisi prezzi fornitori con grafico a punti, apprendimento dei formati fattura, scheda di ingresso con firma e prova, errori parlanti con codice, manuale e test automatici.

### Idee nuove emerse (da proporre a Marco, non decise)
1. Estensione di garanzia / assicurazione dispositivo come servizio a pagamento.
2. Listino pubblico delle riparazioni sul sito (con prezzo "da").
3. Link di pagamento online per acconto e saldo.
4. Scarico di preventivo/ricevuta/certificato di garanzia dal portale cliente.
5. Stampa diretta (agente di stampa) senza finestra del browser.
6. Chiavi API e invio diretto al SdI: solo per la versione vendibile.
Si sommano alle idee dei punti 1 e 2 (IVA a margine + permuta, proposta d'ordine, ricevuta/OTP WhatsApp, differenze ordine/arrivo, tecnico assegnato).
