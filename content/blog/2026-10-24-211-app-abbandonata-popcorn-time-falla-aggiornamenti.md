---
title: Un'app di streaming abbandonata ha lasciato una porta aperta su milioni di computer
date: 2026-10-24
description: Una falla nel sistema di aggiornamento di Time4Popcorn, erede abbandonato di Popcorn Time, permetteva di eseguire codice con i massimi privilegi su Windows e Mac.
---

Si chiama CVE-2026-30612 e riguarda Time4Popcorn, un fork di Popcorn Time ormai senza sviluppo attivo ma ancora installato su molti computer. Secondo quanto riportato il 23 ottobre da BleepingComputer, il meccanismo di aggiornamento automatico dell'app contattava un dominio abbandonato, popcorntimeupd.xyz, usando una connessione non cifrata e senza controllare la firma digitale dei file ricevuti. Chi fosse riuscito a controllare quel dominio avrebbe potuto far eseguire codice con i privilegi più alti del sistema, SYSTEM su Windows e root su Mac.

## Quanto era diffuso il problema

I ricercatori della società di sicurezza Eye Security hanno registrato loro stessi il dominio abbandonato per studiare il fenomeno, osservando fino a 3 milioni di connessioni da client Windows e 350mila da client Mac, provenienti sia da reti domestiche che da reti aziendali e governative. La maggior parte di questi computer, secondo Eye Security, non usava più l'app attivamente: era semplicemente rimasta installata e dimenticata.

## Come è stata risolta, e cosa resta aperto

Tra novembre 2025 e marzo 2026 Eye Security ha usato lo stesso sistema di aggiornamento vulnerabile per inviare un comando che disattivava l'updater, senza raccogliere dati dagli utenti né cancellare file, fino a far scendere le richieste al dominio del 98 per cento. La proprietà del dominio è poi passata alla Shadowserver Foundation, organizzazione non profit che si occupa di sicurezza informatica. Resta invece scoperto Android, dove l'aggiornamento richiede un'azione manuale dell'utente e non è stato possibile disattivarlo da remoto: l'app, tra l'altro, si basa su un motore Chrome del 2014 privo delle protezioni introdotte negli anni successivi.

Chi ha installato Popcorn Time o un suo derivato anni fa, magari senza più usarlo, fa bene a controllare l'elenco dei programmi sul proprio computer e a disinstallarlo. Vale anche per altre app di streaming poco conosciute scaricate fuori dagli store ufficiali: se non si usano più, il modo più semplice per evitare rischi è rimuoverle, non lasciarle lì in attesa di un aggiornamento che nessuno controlla più.
