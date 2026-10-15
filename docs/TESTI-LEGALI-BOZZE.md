# Bozze dei testi (conferme, firme, informativa) — DA FORMALIZZARE

Bozze di lavoro scritte per far funzionare il gestionale. **Non sono consulenza legale.** Ogni testo finisce con la nota: *(testo da formalizzare con Christian)*; prima dell'uso vanno riletti da lui e, per clausole e informativa privacy, da un professionista. Le parti tra [parentesi quadre] sono dati da compilare o decidere.

## A. Conferma di accettazione del preventivo (pulsante SI, dal link del cliente)
**Titolo**: Confermi il preventivo?
**Testo**: Stai accettando il preventivo n. [codice] di **[importo] €** per la riparazione di **[dispositivo]**, con consegna stimata il [data]. Con la conferma autorizzi il laboratorio a eseguire i lavori descritti. Se non vengono eseguiti, o se vengono eseguiti solo in parte, hai diritto al ritiro del dispositivo. Una volta iniziati i lavori non e' possibile annullare l'incarico senza il pagamento delle attivita' gia' svolte e dei ricambi gia' acquistati o montati ([condizioni da definire]). Il preventivo e' valido fino al [data di validita'].
**Pulsanti**: Conferma · Torna indietro
*(testo da formalizzare con Christian)*

## B. Rifiuto del preventivo e destino del dispositivo (pulsante NO)
**Titolo**: Rifiuti il preventivo?
**Testo**: Stai rifiutando il preventivo n. [codice]. Il dispositivo **non verra' riparato**. Scegli cosa fare:
- **( ) Passero' a ritirarlo.** Il dispositivo resta in negozio **[15] giorni** dalla data di questa scelta. Dopo tale termine potra' essere custodito in **deposito a pagamento** ([tariffa]) oppure, previo avviso, essere trattato come indicato nelle condizioni di servizio.
- **( ) Cedo il dispositivo al negozio.** Dichiaro di essere il proprietario del dispositivo e **cedo la proprieta' al laboratorio**, che potra' **smaltirlo oppure recuperarne e riutilizzarne i componenti**, senza nulla dovere al cliente. Ho gia' effettuato o rinuncio al backup dei miei dati e ho rimosso o autorizzo la rimozione di codici di sblocco e account.
**Pulsanti**: Conferma la scelta · Torna indietro
*(testo da formalizzare con Christian)*

## C. Firma di conferma (sotto la scelta A o B)
**Testo**: Firmando confermo di avere letto e compreso quanto sopra e che la scelta e' mia. Data e ora della firma: [automatica]. Nome: [cliente]. Riferimento riparazione: [codice]. Copia firmata inviata a: [email/WhatsApp del cliente].
**Nota tecnica**: si registrano firma disegnata, data/ora e identificativo della richiesta, con conferma opzionale tramite codice inviato al cliente.
*(testo da formalizzare con Christian)*

## D. Consenso alla presa in carico (scheda di ingresso firmata, anche a distanza)
**Testo**: Affido a Informatix Repair il dispositivo descritto in scheda per diagnosi e riparazione. Dichiaro di avere letto le condizioni riportate (preventivo indicativo fino all'approvazione, termini di ritiro, garanzia di [90] giorni sulla riparazione, responsabilita' sui dati: **ho effettuato o rinuncio al backup**) e di essere informato sul trattamento dei miei dati come da informativa [link]. Autorizzo il laboratorio ad accedere al dispositivo per i soli controlli necessari alla riparazione.
*(testo da formalizzare con Christian)*

## E. Informativa breve e consenso per la copia del documento d'identita'
**Testo**: Informatix Repair, titolare del trattamento ([indirizzo], [contatto]), conserva copia del tuo documento d'identita' per **[finalita': es. identificazione di chi cede o vende dispositivi usati, adempimenti di legge, tutela in caso di denuncia o querela]**. Il documento e' conservato in archivio riservato, accessibile solo al titolare, per **[periodo di conservazione]**, e non viene ceduto a terzi se non per obbligo di legge o su richiesta dell'autorita'. Hai diritto di accesso, rettifica e cancellazione nei limiti di legge, scrivendo a [contatto]. Informativa completa: [link].
**Consenso/presa visione**: ( ) Ho letto l'informativa e acconsento alla conservazione della copia del mio documento per le finalita' indicate.
**Nota operativa**: richiedere il documento solo dove serve (minimizzazione); per le semplici riparazioni non e' di norma necessario.
*(testo da formalizzare con Christian)*

## F. Avviso di giacenza e deposito (scadenza dei [15] giorni)
**Testo (messaggio al cliente)**: Ciao [nome], il tuo [dispositivo] (rif. [codice]) non e' stato riparato e ti aspetta in negozio dal [data]. Dal [data + 15 giorni] sara' custodito in **deposito a pagamento** ([tariffa]) oppure potra' essere smaltito/ceduto secondo le condizioni che hai firmato. Passa a ritirarlo o scrivici per accordarci: [telefono].
*(testo da formalizzare con Christian)*

---

# REVISIONE (Agente D, 2026-10-16) - cosa e' stato controllato

**Attenzione**: ho riletto i testi e li ho allineati a fonti normative trovate online; NON sono un avvocato e questa non e' consulenza legale. Per questo l'interruttore "Testi verificati" in Impostazioni resta su **bozza**: lo accende Christian dopo aver riletto (e, per i punti segnati "da far confermare", sentito un professionista). I testi usati dall'app sono in `officina/legal.mjs` (gia' aggiornati).

## Verificato con fonti (ricerca online)
| Punto | Cosa risulta | Fonte |
|---|---|---|
| Garanzia legale sui BENI venduti | Il venditore risponde dei difetti di conformita' presenti alla consegna che si manifestano entro **due anni** (art. 133 Codice del Consumo, come modificato dal D.Lgs. 170/2021, dal 1/1/2022). L'obbligo di denunciare il difetto entro 2 mesi **non c'e' piu'** nel testo vigente (resta nei vecchi documenti dei produttori). | [Brocardi art. 133](https://www.brocardi.it/codice-del-consumo/parte-iv/titolo-iii/capo-i/art133.html), [art. 129](https://www.brocardi.it/codice-del-consumo/parte-iv/titolo-iii/capo-i/art129.html) |
| Presunzione di esistenza del difetto | Indicata a 12 mesi dalla consegna (prima 6): verificata solo in una presentazione, **da far confermare** | [slide CCIAA Torino](https://www.lab-to.camcom.it/media/events/attachment/Slide_Grippo.pdf) |
| Ritenzione del dispositivo fino al pagamento | Art. 2756 c.c.: privilegio sul bene riparato finche' resta presso chi ha lavorato; si puo' trattenere fino al pagamento e, in alternativa, vendere con le regole del pegno. Cassazione ammette di trattenerlo senza usarlo. | [art. 2756](https://brocardi.it/codice-civile/libro-sesto/titolo-iii/capo-ii/sezione-ii/art2756.html), [leggioggi](https://www.leggioggi.it/consumatori-chi-non-paga-una-riparazione-ha-diritto-restituzione-bene/) |
| Recesso | Il recesso (artt. 52 e ss. Codice del Consumo) riguarda contratti a distanza e fuori dai locali commerciali; esclusi i beni su misura (art. 59 lett. c) e le visite per lavori urgenti di riparazione a domicilio (lett. h). Una riparazione portata **in negozio** non ha recesso di questo tipo (da confermare; vale se si inizia a vendere online). | [art. 59](https://brocardi.it/codice-del-consumo/parte-iii/titolo-iii/capo-i/sezione-ii/art59.html) |
| Informativa privacy | Va data al momento della raccolta (art. 13 GDPR), chiara e concisa, con periodo di conservazione, diritti (accesso, rettifica, cancellazione, limitazione, opposizione) e reclamo al Garante. Basi di liceita' (art. 6): per la riparazione basta l'**esecuzione del contratto**, non serve un "consenso" generico (il Garante ha censurato formule come "autorizzo il trattamento"). | [Garante](https://garanteprivacy.it/garante/doc.jsp?ID=1049413), [legiscope](https://www.legiscope.com/blog/informativa-privacy-modello-sito.html) |
| Copia del documento d'identita' | Il Garante la ritiene eccedente senza una norma o una necessita' precisa e senza un termine di conservazione. Quindi: chiederla solo dove serve (es. acquisto di usato) e con tempo di conservazione scritto. | [filodiritto](https://www.filodiritto.com/garante-privacy-la-richiesta-e-conservazione-dei-documenti-di-identita-deve-essere-giustificata) |

## Modifiche fatte ai testi (legal.mjs / dbref.mjs)
- **D (consenso alla presa in carico)**: citato l'art. 13 GDPR, i dati servono a eseguire la riparazione e agli obblighi di legge (non si chiede un consenso generico); garanzia "non limita i diritti di legge"; backup e non responsabilita' sui dati; accesso solo ai controlli necessari.
- **A (accettazione preventivo)**: tolto "condizioni da definire": ora dice che in caso di rinuncia a lavori iniziati si pagano solo attivita' svolte e ricambi acquistati/montati, e che l'importo cambia solo con nuovo avviso e nuova conferma.
- **B (rifiuto, ritiro)** e **F (avviso di giacenza)**: tolto il passaggio vago "trattato come indicato"; ora: deposito a pagamento, il cliente puo' sempre ritirare pagando quanto dovuto, **ulteriore avviso scritto** prima di smaltire/cedere.
- **Condizioni sulla scheda** (`terms`, dbref.mjs): non piu' "60 giorni" (in contrasto con i 15 giorni di giacenza): ora ritenzione fino al pagamento, deposito a pagamento, avviso scritto, garanzia che non limita i diritti di legge. Vale per le installazioni NUOVE; per quella online va incollato il nuovo testo in Impostazioni.
- **Cessione (B, "cedo al negozio")**: confermata com'era (il cliente dichiara di essere proprietario, cede, backup, rimozione account).

## Da far confermare a un professionista (NON verificato)
1. Se la garanzia legale di 24 mesi si applichi anche ai lavori di riparazione (contratto d'opera, art. 1667 c.c. sui vizi) oltre che ai ricambi **venduti**; e per gli **usati** la possibile riduzione a 1 anno concordata: non verificati.
2. Procedura per **vendere o smaltire** un dispositivo non ritirato (art. 2756 + pegno, art. 2797 c.c. e 502 c.p.c.): non verificata. Lo smaltimento senza consenso e' rischioso: finche' non c'e' un parere, i testi parlano di "ulteriore avviso scritto" e il cliente puo' sempre ritirare.
3. Tariffa del deposito e tempi (15 giorni): decisione di Christian, da scrivere chiara in negozio.
4. Informativa privacy completa (titolare, finalita', conservazione, diritti, reclamo), conservazione dei documenti d'identita' (periodo), trattamento dei codici di sblocco: va redatta e pubblicata (c'e' `privacy.html` sul sito da allineare).
5. Valore probatorio della firma disegnata: e' una firma elettronica semplice (non avanzata): serve a provare cosa/quando, non e' equivalente a firma autografa in ogni caso.
