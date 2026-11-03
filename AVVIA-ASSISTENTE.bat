@echo off
chcp 65001 >nul
title Assistente Informatix (lascia aperta questa finestra)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js non e' installato su questo PC. & pause & exit /b 1)
if not exist "assistente-pc\.env" (echo Manca assistente-pc\.env: vedi assistente-pc\LEGGIMI.md & pause & exit /b 1)
echo Assistente Informatix: collega il gestionale online all'LLM di questo PC.
echo Tieni aperta questa finestra e Ollama acceso. Per fermarlo: chiudi la finestra.
echo.
:giro
node assistente-pc\agente.mjs
echo.
echo Il programma si e' fermato. Riparto fra 10 secondi (chiudi la finestra per uscire)...
timeout /t 10 >nul
goto giro
