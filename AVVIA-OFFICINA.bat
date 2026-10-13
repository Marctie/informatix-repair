@echo off
REM Avvia il Gestionale Officina Informatix Repair e apre il browser.
REM Lasciare aperta questa finestra nera finche si lavora: chiudendola il gestionale si spegne.
cd /d "%~dp0"
title Gestionale Officina - Informatix Repair
if not exist node_modules (
  echo Prima installazione: scarico i componenti, attendere...
  call npm install
)
start "" /min cmd /c "timeout /t 3 >/dev/null & start http://localhost:4950"
call npm run officina
pause
