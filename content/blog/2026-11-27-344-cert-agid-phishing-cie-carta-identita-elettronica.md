---
title: Allarme CERT-AgID per il phishing sulla Carta d'identità elettronica, come riconoscere il sito falso
date: 2026-11-27
description: Il CERT-AgID ha bloccato una campagna che imita l'accesso con la CIE usando un pannello che adatta le domande in tempo reale per rubare credenziali e codici di verifica.
---

Il 26 novembre il CERT-AgID, il centro per la sicurezza informatica dell'Agenzia per l'Italia Digitale, ha segnalato di aver individuato e bloccato una campagna di phishing che usa il nome dell'Agenzia delle Entrate come esca per rubare le credenziali della Carta d'identità elettronica (CIE). Il sito falso riproduce la schermata di autenticazione CIE di livello 2, con i loghi del Ministero dell'Interno, ed è ospitato su un dominio compromesso, cioè un sito legittimo violato e usato senza che il proprietario se ne accorga.

## Un phishing che si adatta alle risposte della vittima

La pagina chiede il numero della CIE, il codice fiscale o l'indirizzo email, insieme alla password. Dietro c'è un pannello di controllo in italiano che permette a chi gestisce la truffa di seguire ogni sessione in tempo reale, chiedere ulteriori dati personali, simulare errori e porre domande pensate apposta per convincere la vittima a proseguire. Il CERT-AgID lo definisce un approccio interattivo, costruito per tentare di superare anche l'autenticazione a più fattori: più la vittima collabora, più aumentano le informazioni che i criminali riescono a ottenere, compresi eventuali codici di verifica temporanei. L'agenzia collega questa campagna ad altre già osservate contro lo SPID.

## Perché conviene prestare attenzione

Le credenziali della CIE non servono solo per i servizi dell'Agenzia delle Entrate: aprono l'accesso a una lunga serie di servizi della pubblica amministrazione e di operatori privati, quindi un furto di questo tipo può portare a frodi successive difficili da collegare subito all'episodio iniziale. Il CERT-AgID ha chiesto la rimozione del sito e ha diffuso gli indicatori della campagna agli enti accreditati, ma nuovi domini con lo stesso schema possono comparire in qualsiasi momento.

La difesa più efficace resta controllare l'indirizzo del sito prima di inserire qualsiasi credenziale, evitando di seguire link ricevuti per email o SMS: meglio digitare a mano l'indirizzo ufficiale o usare un segnalibro salvato in precedenza. Nessun ente pubblico chiede mai, in una pagina di accesso, di comunicare un codice temporaneo appena ricevuto o di autorizzare un accesso che non si è richiesto personalmente.
