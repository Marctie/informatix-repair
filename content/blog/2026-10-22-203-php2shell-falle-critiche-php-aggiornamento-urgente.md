---
title: PHP2Shell, due falle critiche in PHP mettono a rischio migliaia di siti web
date: 2026-10-22
description: Il team di PHP ha rilasciato patch d'emergenza per due vulnerabilità gravissime, con un tentativo di attacco registrato prima ancora dell'annuncio pubblico.
---

Il progetto PHP ha pubblicato aggiornamenti d'emergenza per due vulnerabilità identificate come CVE-2026-109618 e CVE-2026-109619, ribattezzate informalmente "PHP2Shell". Secondo Help Net Security, un ricercatore della società Wiz le ha descritte come tra le più gravi mai scoperte nel linguaggio, perché permettono di eseguire codice sul server con una semplice richiesta web, senza bisogno di credenziali.

## Cosa interessa davvero i siti italiani

Le versioni corrette sono PHP 8.5.12, 8.4.27, 8.3.36 e 8.2.35, con backport minimi anche per 7.4, 8.0 e 8.1, ormai fuori supporto ufficiale. Il problema riguarda ogni configurazione che usa PHP per gestire richieste web, quindi anche i tantissimi siti costruiti con WordPress o altri CMS che si appoggiano a questo linguaggio, tipicamente su hosting condiviso. Chi gestisce un sito aziendale o un negozio online dovrebbe verificare con il proprio fornitore di hosting se l'aggiornamento è già stato applicato, invece di aspettare che arrivi in automatico.

## Un dettaglio che preoccupa gli esperti

Amazon Threat Intelligence ha rilevato, tramite la propria rete di sensori MadPot, un tentativo di sfruttamento già il 17 ottobre, quattro giorni prima della divulgazione ufficiale della falla. Il traffico proveniva da un indirizzo collegato a un servizio di anonimizzazione, segno che qualcuno conosceva i dettagli del problema prima che diventassero pubblici. Non è chiaro come le informazioni siano uscite in anticipo. Il centro di sicurezza informatica britannico NCSC ha consigliato, nei casi più critici, di scollegare temporaneamente dalla rete i sistemi che non possono essere aggiornati subito.

Chi usa pacchetti PHP di terze parti meno conosciuti, segnalati come più lenti nel distribuire la correzione, farebbe meglio a passare temporaneamente ai pacchetti ufficiali della propria distribuzione Linux. Per chi non gestisce direttamente un server ma si affida a un hosting o a un'agenzia web, la cosa più semplice resta chiedere per iscritto conferma che l'aggiornamento sia stato installato, magari allegando i numeri delle due vulnerabilità.
