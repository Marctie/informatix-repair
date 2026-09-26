---
title: Falso rimborso INPS, PEC compromesse e il malware MintsLoader
date: 2026-09-26
description: Il bollettino CERT-AGID del 20-26 settembre segnala una campagna di phishing a nome INPS e un malware diffuso tramite caselle PEC violate.
---
Il bollettino settimanale del CERT-AGID, relativo al periodo dal 20 al 26 settembre, descrive due campagne che vale la pena conoscere perché sfruttano canali molto diffusi: la posta elettronica certificata e le comunicazioni previdenziali.

## Il falso rimborso INPS

Una campagna di phishing usa nome, logo e grafica dell'INPS per proporre un presunto credito di 730 euro, derivante da un fantomatico "ricalcolo automatico" della posizione contributiva e fiscale. L'email ha un oggetto simile a "INPS/2026/00489 - Pratica di rimborso approvata" e porta a un sito che riproduce il portale dell'ente. La procedura chiede prima i dati anagrafici, poi quelli della carta di pagamento, e infine mostra una finta schermata di autorizzazione bancaria 3D Secure, invitando la vittima ad approvare entro sessanta secondi una notifica push arrivata dalla sua banca: un modo per far convalidare un pagamento reale mentre si crede di incassare un rimborso.

## PEC compromesse e il malware MintsLoader

La sera del 23 settembre diverse caselle di posta elettronica certificata compromesse hanno inviato falsi solleciti di pagamento verso altri indirizzi PEC, con in allegato un file ZIP contenente un HTML che scarica il malware MintsLoader. Gli indirizzi da cui viene recuperato il codice cambiano di continuo grazie a tecniche di generazione automatica dei domini e restano inattivi nelle prime ore per poi attivarsi al mattino successivo, un accorgimento pensato per rallentare i sistemi di analisi automatica. Il CERT-AGID ricorda che la PEC certifica la trasmissione del messaggio, non la sicurezza di chi lo invia: una casella compromessa resta uno dei modi più efficaci per far circolare malware in Italia.

## Come proteggersi

Non aprire allegati compressi arrivati da caselle PEC che non ti aspettavi, anche se il tono sembra professionale o urgente, e verifica sempre un annuncio di rimborso accedendo al sito ufficiale digitando l'indirizzo a mano, senza passare da link ricevuti via email. Un antivirus aggiornato aiuta a bloccare l'esecuzione del file, ma la prudenza nell'aprire allegati resta la difesa più efficace contro questo tipo di truffe.
