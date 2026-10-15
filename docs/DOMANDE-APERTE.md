# Domande aperte (aggiornato 2026-10-15)

> **Direttive di Christian (19 punti)**: ogni punto ha le sue domande in `docs/DIRETTIVE-CHRISTIAN.md`, con il piano proposto in fondo. Da mandare a Christian insieme a questo elenco.

Qui si raccolgono tutte le domande in sospeso, divise per chi deve rispondere. Quando arriva una risposta, si sposta in fondo nella sezione "Risolte" con la data.

## Per Christian

### Prove con il gestionale e con l'hardware
1. Com'è andata la prova del gestionale online? Cosa non torna, cosa è lento, cosa manca?
2. Pistola codici a barre: legge bene i codici delle schede e delle etichette? Va aggiunto il "suffisso Invio" sulla pistola?
3. Stampante: le schede cliente e laboratorio escono ben impaginate? E le etichette 62×30 mm?
4. Fotocamera del telefono: ora che il sito è in https, legge i QR e i codici?
5. Dati demo (Impostazioni → Dati demo): sono abbastanza realistici? Qualcosa da cambiare prima di cancellarli?

### Utenti e postazioni
6. Email delle tre postazioni (Cassa, Laboratorio, Vendite): quali indirizzi usiamo? Meglio indirizzi veri o alias che arrivano a te?

### Import ordini, DDT e fatture dei fornitori
7. Il DDT che ricevi dai fornitori com'è: carta, PDF per email, altro?
8. Quali sono i fornitori che usi di più? Mi serve **un esempio di DDT e uno di fattura per ciascuno** (anche con i dati personali cancellati).
9. Puoi farti mandare le **fatture elettroniche in formato XML** (dal commercialista o dal cassetto fiscale)? Sono molto più affidabili dei PDF.
10. I PDF dei fornitori sono "digitali" (il testo si seleziona con il mouse) oppure sono scansioni/foto?
11. Il DDT riporta i prezzi o è "non valorizzato" (solo quantità)? In molti casi i prezzi sono solo in fattura.

### Grafico dei prezzi d'acquisto (la tua bozza)
12. Ho letto bene i nomi e i prezzi della bozza (Genovese 6,00 · Polistech 5,00 · un terzo punto più basso)? Puoi rimandarmi la foto raddrizzata?
13. Il grafico è per **un singolo prodotto** (scelto dal magazzino) oppure per tutti i prodotti di un fornitore?
14. L'asse orizzontale è il tempo (le date degli ordini)?

### Scorte, invenduto e notifiche
15. Dopo quanti giorni senza vendite un prodotto va segnalato come "fermo"? Ora è 90 giorni (si cambia in Impostazioni → Avvisi).
16. Qual è una scorta minima generale sensata? Ora è spenta; ogni prodotto può avere la sua.
17. Dopo quanti giorni una riparazione pronta e non ritirata va ricordata? Ora 7 giorni.

### Buoni sconto e buoni regalo
18. Che tipi di buono servono: sconto in importo, sconto in percentuale, buono regalo con credito residuo?
19. Il buono ha una scadenza? Va stampato su carta, su PDF, o mandato su WhatsApp?
20. Grafica del buono: logo, colori e testo (condizioni d'uso). Mi manda un esempio che gli piace?

### Carta fedeltà
21. **Regolamento dei punti** (quanti punti per euro, come si riscattano, scadenze): mi serve per costruire le regole.
22. Che **lettore NFC** vuole usare (modello)? Va bene un lettore USB che "scrive come una tastiera", oppure il telefono Android?
23. Che carte compra (tipo e modello)? Servono carte che contengano solo un codice identificativo: i punti restano nel gestionale, non sulla carta.

### Pagamento "non tracciato"
24. Il funzionamento attuale va bene? (Il pagamento resta salvato; in Impostazioni → Cassa scegli se conteggiarlo nei totali o no.)

### Nota spese (PDF)
34. La nota spese che ho creato (spese del negozio e rimborsi, con firme) e' quella che immaginavi, o ti serve un documento diverso (per esempio una nota spese verso un cliente)?
35. Mancano campi o categorie di spesa? Vuoi inviarla anche per email al commercialista?

## Per Marco

25. **Sito pubblico in `main`**: via libera esplicito a mettere online "Segui la tua riparazione" e il link "Area riservata" (branch `sito-segui-riparazione`)?
26. **Vetrina Usati e bot Telegram**: portarli online sullo stesso Worker dietro l'accesso, oppure lasciarli come sono?
27. Pulizia dei 19 rami remoti `claude/upbeat-fermi-*` (residui della routine del blog): si possono eliminare?
28. Cambio orario UTC della routine del blog il 25 ottobre (`0 8,17 * * *`): da sistemare.
29. Ruolo del proprietario nel gestionale: va bene come "amministratore protetto"?
30. **Versione vendibile ai clienti**: pensi solo ad altri negozi di riparazioni o anche ad altri settori?
31. Canone mensile o vendita una tantum?
32. L'hosting lo gestisci tu (account tuo) o ogni cliente ha il suo account Cloudflare?
33. Quanti clienti ipotizzi nel primo anno? (serve per scegliere il login e i piani Cloudflare)

### Aggiunte 2026-10-15 (bot e notifiche)
58. **VAULT_KEY: richiesta del 15/10 con un valore scritto in chat (non trascritto qui)**: cosa vuoi fare esattamente? Se e' un nome con cui salvarla, ok. Se e' il **valore** della chiave: e' troppo facile da indovinare (e ora e' scritto in chat) e cambiarla renderebbe **illeggibili** documenti d'identita' e credenziali gia' salvati (andrebbero rifatti). La chiave attuale e' casuale, copia in Mega `Informatix-Chiavi`.
59. **Incasso di prova da 34 €** ("Saldo R-2026-0001" del 14/10) rimasto in cassa dopo l'eliminazione della riparazione di prova: lo togliamo? (Non c'e' un pulsante: si fa con una correzione sul database, registrata nel CHATLOG.)
60. **Utente "Utente di prova"** `utente.archivio@libero.it` e' ancora **amministratore attivo**: disattivarlo o eliminarlo dalla pagina Utenti?
61. **Eliminando una riparazione conclusa si cancellano anche i suoi incassi** (scelta del 14/10 pomeriggio): va bene cosi' o preferisci che gli incassi restino in cassa (o diventino uno "storno" visibile)? Ora almeno l'avviso Telegram dice quanti incassi e per quanto.
62. **BotFather**: il bot puo' ancora essere aggiunto ai gruppi. Per chiuderlo: BotFather → `/setjoingroups` → @informatix_repair_bot → Disable (solo tu puoi farlo).
63. Buongiorno del bot: va bene **lun-sab alle 8:30**? Il riepilogo resta ogni sera alle 21:00.

## Default scelti dall'agente B (da confermare con Christian)
- Giacenza: 15 giorni dal rifiuto del cliente (o dall'annullamento); alla scadenza solo avviso, nessun cambio di stato automatico; deposito a pagamento = solo tariffa testuale, nessun incasso registrato.
- Pezzi di ricambio da dispositivo ceduto: non caricati a magazzino in automatico.
- Firma semplice (disegno + data/ora + IP + testo firmato), senza codice SMS/email; il cliente vede testo e condizioni prima di firmare.
- Dopo il NO firmato il cliente non puo' cambiare idea dal link (il negozio puo' riaprire lo stato).
- Collaudo di uscita non blocca la consegna; voci checklist predefinite proposte, modificabili.
- Testi legali: bozze marcate "da far verificare"; validita' del preventivo e condizioni di recesso ancora "da definire".

## Risolte
- (2026-10-13) Email di Christian: `djchri.cp@gmail.com`, amministratore.
- (2026-10-13) Policy Cloudflare Access: "Everyone"; chi entra lo decide la pagina Utenti.
- (2026-10-13) R2 attivato per il backup automatico.

## Vetrina usati online (aggiunte 2026-10-14)
34. (Marco) Creare il bucket R2 `officina-media` e il GITHUB_TOKEN (solo permesso Contents sul repo)?
35. (Marco) La pubblicazione degli usati deve scrivere direttamente su `main` o su un branch di prova prima?
36. (Christian) Le foto dei telefoni: quante di solito per articolo? Il massimo e' 10.
37. (Christian) Dopo il login vuoi vedere il Portale o direttamente "Oggi"?

## Ordini, Preventivi, Promemoria (Agente C, 2026-10-14) - default scelti, da confermare
38. (Christian) **Ordini** - gli ordini per i clienti e le scorte basse restano in due liste separate (Ordini / Magazzino "Da ordinare"). Va bene o li vuoi nella stessa lista con un'etichetta?
39. (Christian) **Ordini** - all'arrivo c'e' l'avviso nella campanella e il pulsante "Avvisa" che apre WhatsApp con testo gia' pronto (non parte da solo). Il testo ti piace? Il pezzo arrivato resta "dell'ordine" (non viene caricato a magazzino): se vuoi il carico automatico va collegato al carico merce (punto 4).
40. (Christian) **Ordini** - l'acconto e' un incasso normale in Cassa (metodo a scelta) e il saldo si incassa alla consegna. Se l'ordine ha incassi non si elimina, si annulla. Va bene?
41. (Christian) **Preventivi** - validita' standard 15 giorni (impostabile con la chiave `quote_valid_days`, per ora senza schermata in Impostazioni) e condizioni di default sul foglio: "valido fino alla data indicata... importi IVA inclusa...". Quali condizioni vuoi stampare?
42. (Christian) **Preventivi** - restano separati dal "preventivo" della riparazione (che resta com'e'); si convertono in riparazione/vendita con un click. Vuoi che diventino la stessa cosa (storico preventivi per riparazione)?
43. (Christian) **Preventivi** - numerazione P-AAAA-NNNN e intestazione come le schede. Il cliente non ha ancora un link online per approvare i preventivi autonomi (solo stampa/WhatsApp, accettazione registrata al banco); dopo la scadenza non si puo' accettare senza prolungare la data. Serve il link online?
44. (Christian) **Promemoria** - sono condivisi tra tutti gli utenti (non personali). Servono anche note libere stile Keep (colori, caselle da spuntare, foto)? Per ora solo promemoria con data/ora.
45. (Marco) **Promemoria Telegram** - l'avviso parte quando una postazione ha il gestionale aperto (controllo ogni minuto). Per avvisare anche a gestionale chiuso serve un cron ogni minuto sul Worker (`scheduled` in `officina/worker.mjs`): lo aggiungo al prossimo deploy?

## Agente D: Dispositivi, Buoni/conto diviso, Documenti d'identita', Credenziali (aggiunte 2026-10-14)
Per ognuna e' indicato il **default prudente** gia' scelto nel codice.
**Dispositivi (p.12)**
- **12b "Blacks" (IN SOSPESO, non implementato)**: blacklist di IMEI (si fa) o registro nascosto (non si fa)? Finche' non risponde non c'e' nessuna blacklist; esiste solo la segnalazione "rubato / da verificare".
- 38. (Christian) Da smaltire e Ricondizionati: ciclo di vita (checklist, garanzia, costo di ricondizionamento)? Per ora sono solo sottoclassi del registro.
- 39. (Christian) "In arrivo": collegarlo agli ordini al fornitore con carico automatico? Per ora e' solo una sottoclasse.
- 40. (Marco) Se un seriale segnalato entra in riparazione/vendita l'operazione NON viene bloccata: compare un avviso e una nota interna (default prudente = avvisare, non bloccare). Vuole il blocco?
- 41. (Christian) Mandare anche un messaggio Telegram quando un seriale segnalato compare? (non fatto)
**Conto diviso e buoni (p.9)**
- 42. Quote del conto diviso: impostato il massimo a **6** (default). Bastano 2-3?
- 43. Resto in contanti: calcolato e mostrato a video (contanti ricevuti -> resto), ma NON registrato (in cassa entra solo l'importo dovuto).
- 44. Il buono si puo' usare insieme al conto diviso: **si** (default).
- 45. Buono regalo usato in parte: resta il saldo, stampato sulla ricevuta: **si**.
- 46. Tipi di buono fatti: regalo (credito), sconto in euro, sconto in percentuale (uso unico). Mancano grafica/template personalizzabile (logo, colori, condizioni): il buono stampabile e' una versione semplice. Mandare un esempio che piace.
- 47. (Christian) Vendere un buono regalo e' un incasso? Default: la **creazione del buono non registra incassi**; il credito entra in cassa quando viene usato (metodo "buono"). Se si vuole contare l'incasso alla vendita del buono, va registrato un pagamento a parte.
- 48. Acconto riparazione diviso su piu' metodi: non fatto (si registrano piu' acconti); il **saldo** alla consegna invece si puo' dividere e usare il buono.
- Punti/carte fedelta' NFC: NON fatti (manca il regolamento).
**Documenti d'identita' (p.17)**
- 49. Chi puo' vedere i documenti: default **solo amministratore**; l'admin puo' abilitare Cassa e/o postazioni (Permessi e registro accessi).
- 50. Conservazione: nessuna scadenza automatica (cancellazione manuale con doppia conferma). Per quanto tempo vanno tenuti?
- 51. Le immagini sono salvate cifrate nel database (max 1 MB l'una, ridimensionate nel browser), non in R2. Il backup JSON include i dati ma sempre cifrati. Preferisce escluderli dal backup?
- 52. Il testo dell'informativa e' la BOZZA E di `docs/TESTI-LEGALI-BOZZE.md`, con le parti tra [parentesi] da compilare: da far verificare a un professionista prima dell'uso reale.
- 53. Estrazione automatica dei dati dalla foto (OCR): non fatta, si scrivono a mano.
- 54. Eliminando un **cliente** si eliminano anche i suoi documenti (cascata). Preferisce bloccare la cancellazione del cliente se ha documenti?
**Credenziali fornitori (p.18)**
- 55. Piu' accessi per lo stesso fornitore: **si** (un fornitore puo' avere piu' portali). Apertura automatica/compilazione del sito: non fatta.
- 56. Visibili solo all'admin (default). Promemoria di cambio password: non fatto (c'e' solo "password cambiata il ...").
**Chiave VAULT_KEY (per Marco)**
- 57. Online: `npx wrangler secret put VAULT_KEY --config officina/wrangler.jsonc` (almeno 16 caratteri casuali, es. 32 byte esadecimali). Sul PC la chiave si crea da sola in `officina/data/vault.key`. **Conservare una copia fuori dal gestionale**: senza chiave documenti e password non si recuperano. La chiave locale e quella online sono diverse: i dati cifrati di un ambiente non si leggono nell'altro.
