# Cosa deve provare Christian (elenco unico)

Come usarlo: una prova alla volta, segna ✅ se va, ❌ se no e scrivi a Marco **cosa hai visto** (meglio con una foto dello schermo). Usa dati di prova (cliente "Prova Prova") e poi eliminali; non servono dati veri. Dove serve il ruolo Cassa, entra con l'utente Cassa (info@informatixrepair.it).

## A. Pagamento appeso (altra attività) - ruolo Cassa + amministratore
1. [ ] **Cassa - vendita:** fai una vendita da 10 € e metti la spunta *Pagamento appeso* → incassa. La vendita NON deve comparire nell'elenco vendite, nella Cassa (incassi del giorno) né nei report della Cassa.
2. [ ] **Cassa - riparazione:** nuova riparazione di prova con acconto 20 € e spunta *Pagamento appeso*. La scheda esiste, il versato è 20 €, ma l'acconto non compare tra gli incassi della Cassa.
3. [ ] **Cassa - acconto e consegna:** sulla stessa riparazione aggiungi un acconto con la spunta, poi *Consegna e incassa* con la spunta. Il saldo deve tornare giusto (da saldare 0).
4. [ ] **Cassa - ordine:** nuovo ordine per un cliente con acconto e spunta; poi consegna con incasso e spunta.
5. [ ] **Amministratore:** menu Gestione → **Altra attività**: devono esserci tutti i pagamenti appesi di prima (vendita, acconti, saldo, ordine) con importi, metodo, cliente.
6. [ ] **Amministratore - correzioni:** su un pagamento prova *Modifica* (cambia importo), *Riporta su Informatix* (poi deve comparire nella Cassa normale), *Elimina* (chiede due conferme). Prova anche *＋ Nuovo incasso*.
7. [ ] **Analisi → Incassi:** sotto i grafici c'è il riquadro *Altra attività* separato (non sommato agli incassi di Informatix).
8. [ ] **Registro:** ogni passo di sopra compare nel Registro (Gestione → Registro).
9. [ ] **Fatture:** da una vendita appesa crea la fattura: deve risultare dell'*Altra attività*; con l'utente Cassa quella fattura NON si vede. Cambia *Azienda* dal modulo fattura e controlla.
10. [ ] **Chiusura cassa:** con Cassa fai la chiusura del giorno: il contante appeso deve essere incluso nel "contante atteso" (altrimenti il cassetto sembrerebbe in eccesso).

## B. Ricambi nelle riparazioni (richieste del 17/10)
11. [ ] **Fornitore:** in *Ricambio non a magazzino* il campo Fornitore propone i fornitori già in anagrafica mentre scrivi (puoi scriverne uno nuovo).
12. [ ] **Doppioni:** scrivendo il nome del ricambio (almeno 3 lettere) compare "Già a magazzino?" con gli articoli simili: toccandone uno viene aggiunto dal magazzino e la giacenza scala.
13. [ ] **Modifica ricambio:** accanto a ogni ricambio usato c'è ✎: correggi il prezzo al cliente, il prezzo d'acquisto (IVA esclusa/inclusa), la quantità, il fornitore. Per un articolo di magazzino cambiando la quantità la giacenza si aggiusta.
14. [ ] Dopo la consegna i ricambi non si modificano più (messaggio chiaro).

## C. Riparazioni e preventivi
15. [ ] **Data di inserimento:** nuova riparazione con "Automatica (adesso)" → ok. Togli la spunta e scegli un momento passato: con Cassa fino a 3 giorni indietro va, 10 giorni viene rifiutato con spiegazione.
16. [ ] **Avanza senza preventivo:** su una riparazione senza preventivo prova "Avanza" a *In attesa di approvazione*: deve comparire "Inserisci ora", non un errore.
17. [ ] **Preventivo dal link:** invia il link a un telefono; spegni internet e firma: la firma resta sul riquadro con "Riprova"; riaccendi e riprova.
18. [ ] **Colore dispositivo** sulle schede stampate; **stampa A4** scheda cliente (due copie) e scheda laboratorio (una pagina).
19. [ ] **Dare/avere in scheda:** nella scheda riparazione il riquadro *Dare/avere di questa riparazione*: aggiungi un movimento e controllalo anche nella scheda cliente.

## D. Magazzino, note, avvisi
20. [ ] **Articolo fermo:** nella scheda articolo il campo *Fermo dopo (giorni)*: metti 1 su un articolo con giacenza e controlla l'avviso (campanella / Analisi → Magazzino). Con 0 non deve avvisare mai.
21. [ ] **Note con foto:** Note → nota completa → *📷 Aggiungi foto* (da telefono la fotocamera), fino a 6; togli una foto; controlla che compaiano sulla nota.
22. [ ] **Analisi → Magazzino:** più/meno richiesti e ricambi più usati nelle riparazioni.

## E. Cassa e documenti
23. [ ] **Chiusura cassa con foto:** crea la chiusura, allega la foto dello scontrino/cassetto, poi blocca; prova la ricerca per periodo e i totali mensili.
24. [ ] **Archivio fatture:** nuova fattura emessa e ricevuta, pagamento parziale, nota di credito, filtri per stato.
25. [ ] **Dare/avere (menu):** movimenti per cliente e avviso "cattivo pagatore" (soglia in Impostazioni).
26. [ ] **Errori:** Gestione → Errori: l'elenco degli errori recenti con la spiegazione; i messaggi a video devono dire cosa fare.

## F. Hardware (solo tu)
27. [ ] **Pistola/fotocamera** per seriali e codici (anche in carico merce).
28. [ ] **Carta punti NFC** con il lettore (crea carta, accredita, prova il PIN).
29. [ ] **Stampante etichette / ricevute** dal gestionale.
30. [ ] **Firma col dito** su tablet/telefono (ingresso e consegna).

## G. Materiale che mi serve da te
- Una **fattura XML vera** di un fornitore (per provare *Acquisti → Importa*).
- Un **DDT/PDF di esempio** per fornitore (per tarare l'import automatico).
- Il **regolamento dei punti** (quanti punti per euro, premi, scadenza).
- Dire se il ruolo Cassa può impostare la data di inserimento oltre i 7 giorni (oggi: no).

## H. Etichette e cassa con la pistola (richiesta del 19/10)
31. [ ] **Template:** Impostazioni → *Etichette prodotto* → *Modifica*: l'anteprima mostra logo, nome, prezzo e codice a barre. Sposta il prezzo trascinandolo, rimettilo a posto, salva.
32. [ ] **Stampa di prova** (tasto 🖨️ del template): esce un'etichetta 62 × 30 dalla stampante delle etichette? Nella finestra di stampa: margini "nessuno", scala 100%. Logo e barre sono nitidi?
33. [ ] **Lettura con la pistola:** attacca l'etichetta a un pezzo e spara: legge tutto il numero? Se no, allarga il riquadro del codice a barre nel template (compare anche un avviso giallo).
34. [ ] **Magazzino → 🏷️ Etichette:** scegli 2 articoli (3 + 1 etichette), premi *Anteprima* e poi *Stampa*.
35. [ ] **Cassa:** in Vendite spara l'etichetta: l'articolo entra nel carrello col "bip"; spara ancora (quantità 2); incassa; in Magazzino la giacenza è scesa di 2.
36. [ ] **Codice del produttore:** su un articolo con il codice sulla confezione, spara nel campo *Codice a barre* della scheda e salva; stampa l'etichetta. In cassa devono funzionare sia l'etichetta nuova sia la confezione.
37. [ ] **Carico merce:** dopo il carico compare *Stampa N etichette* (una per pezzo arrivato).
38. [ ] **Foglio A4 adesivo** (solo se lo usi): crea un template "Foglio A4 adesivo", stampa e controlla che le etichette cadano giuste sul foglio.

## Se qualcosa non va
Scrivi: *che schermata*, *cosa hai premuto*, *cosa ti aspettavi*, *cosa è successo* e, se c'è, il **codice in rosso** (tipo E-7K3QX). Quel codice permette a Marco di trovare l'errore in un attimo (Gestione → Errori).
