---
title: Un'app del Microsoft Store nascondeva il trojan Vinci RAT dietro un falso Snipping Tool
date: 2026-11-27
description: Un'applicazione pubblicata sul Microsoft Store installava una backdoor che scaricava il trojan di accesso remoto Vinci RAT, sfruttando la fiducia riposta nello store ufficiale e in un installer firmato Microsoft.
---

Il 27 novembre la società di sicurezza eSentire ha descritto una campagna che usa un'app del Microsoft Store per distribuire Vinci RAT, un trojan capace di controllare da remoto il computer infetto. L'app, chiamata Setup Assistant e pubblicata da un editore con il nome ETPS Ltd, risultava disponibile dal 1° giugno e al momento della scoperta non era più raggiungibile sullo store, senza che fosse chiaro se la rimozione fosse arrivata da Microsoft o da chi gestiva la truffa.

## Come funziona la trappola

Secondo eSentire, la vittima arriva a un sito falso che promette un programma per fare screenshot, dopo una ricerca web. Da lì scarica un file chiamato Snipping-Tool.exe, firmato digitalmente con un certificato Microsoft, che installa Setup Assistant. L'app non è uno strumento utile: è una backdoor che contatta un server esterno e riceve comandi in PowerShell o JavaScript, con cui disattiva i controlli antimalware di Windows, crea un'attività pianificata che si ripete ogni dieci minuti e scarica il vero e proprio Vinci RAT. Una volta installato, il trojan può raccogliere informazioni sul sistema, elencare gli antivirus presenti, aprire shell remote e trasferire o eseguire altri file. eSentire ha segnalato l'app a Microsoft il 10 novembre, ricevendo come risposta che non violava le condizioni dello store.

## Cosa fare per restare al sicuro

Il punto delicato di questa vicenda è che la minaccia passa attraverso canali che sembrano affidabili, uno store ufficiale e un file firmato digitalmente, quindi la prudenza non può basarsi solo su "viene da una fonte conosciuta". Conviene scaricare programmi di utilità come lo strumento di cattura schermo direttamente dalle impostazioni di Windows, senza passare da risultati di ricerca sponsorizzati o siti di terze parti, e controllare periodicamente l'elenco delle app installate per individuare nomi sospetti come Setup Assistant. Chi sospetta di aver eseguito un installer di questo tipo dovrebbe far analizzare il computer con un antivirus aggiornato e, in caso di dubbio, con una scansione più approfondita.
