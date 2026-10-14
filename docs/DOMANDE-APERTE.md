# Domande aperte (aggiornato 2026-10-14)

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

## Risolte
- (2026-10-13) Email di Christian: `djchri.cp@gmail.com`, amministratore.
- (2026-10-13) Policy Cloudflare Access: "Everyone"; chi entra lo decide la pagina Utenti.
- (2026-10-13) R2 attivato per il backup automatico.
