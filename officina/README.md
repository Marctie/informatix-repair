# Gestionale Officina – Informatix Repair

Gestionale per il negozio: **riparazioni, clienti, magazzino, vendite, fornitori, cassa**, con tracciamento in tempo reale per il cliente.

## Avvio
Doppio click su `AVVIA-OFFICINA.bat` (nella radice del progetto), oppure da terminale:
```
npm run officina
```
**Manuale per Christian:** `officina/public/manuale.html` (http://localhost:4950/manuale.html, stampabile).
- Gestionale (solo questo PC, nessun login per ora): http://localhost:4950
- Tracciamento clienti (raggiungibile dai telefoni in rete): `http://<IP-PC>:4951/t/<codice>` — l'IP esatto è stampato all'avvio.
- Dati: `officina/data/officina.db` (SQLite, fuori da git). **Fare backup di questo file.**

## Come lavora Christian (pensato per essere veloce)
1. **Nuova riparazione** (pulsante rosso in "Oggi"): cliente (si ritrova scrivendo nome o telefono), dispositivo, problema, accessori e condizioni con un tocco, preventivo e acconto, consegna stimata con un tocco. Un solo pulsante: salva.
2. **🖨️ Salva e stampa**: escono la **scheda cliente** (con QR per seguire la riparazione, condizioni e firme; mai il PIN) e la **scheda laboratorio** (per Christian: PIN, checklist di ingresso e collaudo, diagnosi, ricambi, tempi). Disponibili anche separatamente, con etichetta 62×30 mm e invio del link su WhatsApp.
3. In "Oggi" e in "Riparazioni" ogni riga ha il pulsante **"prossimo stato"** (un click) e il pulsante **WhatsApp** con il messaggio già scritto (pronto per il ritiro, preventivo, ritardo).
4. Il cliente dal link vede: barra di avanzamento, riepilogo del dispositivo, i suoi dati (telefono ed email mascherati), consegna stimata, preventivo/acconto/saldo, cronologia. Può **approvare o rifiutare il preventivo** con un tap.
5. **Consegna e incasso**: calcola il saldo (totale meno acconti), registra l'incasso e fa partire la garanzia.

## Moduli
Oggi · Riparazioni · Clienti (storico) · Magazzino (scorta minima, carico/scarico rapido, "Da ordinare" con messaggio WhatsApp o email per fornitore) · Vendite (cassa veloce con ricevuta) · Fornitori · Cassa (incassi per periodo e metodo) · Impostazioni.

## Note tecniche
- Express 5 + `node:sqlite` (Node 22.13 o superiore). Due server: admin su 127.0.0.1:4950, pubblico (solo `/t/:token` e `/api/track/*`) su 0.0.0.0:4951.
- PIN/schema di sblocco e note interne non sono mai nella vista cliente (verificato dai test).
- Ricambi assegnati a una riparazione e vendite scalano il magazzino.
- Documenti **non fiscali**: scontrino e fattura elettronica restano al registratore telematico o al programma di fatturazione.
- Test API: `npm run test:officina`. Test E2E (Cypress, solo sul branch `cypress-tests`): `npm run test:e2e`.
- Quando il tracciamento andrà online: impostare "Indirizzo pubblico" in Impostazioni (i QR useranno quello) e proteggere il gestionale con l'autenticazione (Firebase, da fare).
