# Versione vendibile ai clienti - proposta (17/10/2026)

Stato: SOLO PROPOSTA, non sviluppata. Servono decisioni di Marco prima di scrivere codice (vedi "Da decidere").

## Due strade
**A. Installazioni separate (una per cliente) + pannello centrale** - CONSIGLIATA per partire
- Ogni cliente ha il proprio Worker, database D1, bucket R2 e dominio (es. `officina.<cliente>.it`), creati da uno script (`wrangler` con parametri) a partire da questo stesso codice.
- Dati isolati per costruzione (nessun rischio di mescolarli), backup e cancellazione per cliente semplici, prezzo/abbonamento per installazione.
- Pannello centrale (solo Marco): elenco clienti, versione installata, ultimo contatto (`/api/monitor` esiste gia'), pulsante "aggiorna tutti" (deploy a catena + migrazioni), stato abbonamento.
- Costo: ogni installazione sta nei piani gratuiti/bassi Cloudflare; lavoro: script di provisioning + pannello (stima 12-18 h).

**B. Multi-tenant (un solo Worker, tutti i clienti nello stesso DB)**
- Una colonna `tenant_id` su ogni tabella e su ogni query; rischio alto di fughe di dati tra clienti, migrazioni piu' delicate, backup per cliente complicato.
- Stima 40+ h e revisione di sicurezza. Da considerare solo oltre ~20-30 clienti.

## Cosa serve in ogni caso (prima di vendere)
1. **Marchio e testi neutri**: nome negozio, logo, colori, testi legali e modelli stampe in Impostazioni (oggi in parte fissi "Informatix Repair"); le bozze legali vanno riviste da un professionista.
2. **Primo avvio guidato**: creazione amministratore, dati del negozio, import clienti/prodotti da CSV.
3. **Accesso**: Cloudflare Access per cliente (o login proprio con email + codice) - da scegliere.
4. **Licenza/abbonamento**: scadenza, sospensione con avviso, esportazione dati.
5. **Contratto, privacy (DPA), assistenza**: documenti, non codice.
6. **"Altra attivita'"**: e' una funzione specifica di Christian: va dietro un'opzione (spenta di default).

## Da decidere (Marco)
- Strada A o B? (consiglio A)
- Chi e' il cliente tipo (laboratori come il vostro? negozi?) e prezzo/abbonamento previsto.
- Hosting: tutto su account Cloudflare di Marco (consigliato) o su quello del cliente?
- Quanto assistenza inclusa.

## Prossimo passo (dopo la decisione)
Script `provisioning` (crea D1/R2/Worker/dominio, applica migrazioni, crea l'amministratore) + pagina Impostazioni "Negozio e marchio" + pannello centrale minimo.
