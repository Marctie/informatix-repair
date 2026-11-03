---
title: Falle critiche in PHP, NSA e CISA chiedono di scollegare i siti che non si aggiornano in tempo
date: 2026-10-25
description: Le agenzie statunitensi per la sicurezza hanno diffuso un avviso congiunto su due vulnerabilità che riguardano la maggior parte dei siti web, con la raccomandazione estrema di portare offline i sistemi non aggiornabili subito.
---

A metà ottobre il progetto PHP aveva già corretto due vulnerabilità critiche, identificate come CVE-2026-109618 e CVE-2026-109619, con un punteggio di gravità di 9,2 su 10. Nei giorni successivi la vicenda si è allargata: secondo quanto riportato da Nextgov e Defense One, le agenzie statunitensi NSA, FBI e CISA hanno diffuso un avviso congiunto che chiede di aggiornare con urgenza i sistemi coinvolti, arrivando a consigliare di scollegare dalla rete quelli che non possono essere corretti subito.

## Perché riguarda quasi tutti i siti

PHP è il linguaggio usato lato server da circa il 70 per cento dei siti web il cui linguaggio è identificabile, secondo le stime di settore citate dalle stesse agenzie. La società di sicurezza Palo Alto Networks ha individuato oltre 22,6 milioni di istanze potenzialmente esposte, una cifra che indica i sistemi raggiungibili online e non il numero di violazioni effettivamente avvenute. Le due falle permettono di eseguire codice sul server con una semplice richiesta web, senza bisogno di credenziali, e colpiscono anche i siti costruiti con CMS molto diffusi come WordPress, Drupal e Joomla.

## Un aggiornamento di plugin non basta

Le versioni corrette sono PHP 8.5.12, 8.4.27, 8.3.36 e 8.2.35, con correzioni minime anche per alcune versioni più vecchie non più supportate ufficialmente. Aggiornare solo il CMS o i plugin non risolve il problema, perché la falla riguarda l'interprete PHP stesso installato sul server. Le agenzie segnalano inoltre che i dettagli della vulnerabilità sono circolati online con un giorno di anticipo sulla pubblicazione prevista, accelerando la corsa a correggerla prima che diventasse di dominio pubblico.

Chi gestisce un sito aziendale o un negozio online, anche affidandosi a un hosting esterno, dovrebbe chiedere per iscritto al proprio fornitore conferma che l'aggiornamento sia stato applicato, citando i due codici CVE. Non è un controllo che si possa fare da soli guardando semplicemente il sito: va richiesto esplicitamente a chi lo gestisce dal lato tecnico.
