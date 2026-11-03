# Assistente sul PC di Marco

Collega il gestionale online (gestionale.informatixrepair.com) all'LLM che gira in locale con Ollama.

**Come funziona:** questo programma non apre nessuna porta e non è raggiungibile da internet. È lui che chiama il gestionale ogni 5 secondi e chiede «c'è una richiesta da leggere?». Se la trova la fa leggere a Ollama e rimanda la risposta. Il gestionale controlla tutto e chiede sempre la conferma a chi ha scritto.

**Per usarlo**
1. Ollama deve essere acceso con i modelli `gemma3:12b` (testo) e `qwen2.5vl:7b` (foto dei documenti).
2. Doppio clic su `AVVIA-ASSISTENTE.bat` (nella cartella del progetto) e lascia la finestra aperta.
3. Nel gestionale: menu Portale › **Assistente**. In alto dice se il PC è collegato.

**Se il PC è spento:** le richieste di Christian restano «in coda» nel gestionale e partono da sole appena riaccendi il PC e avvii il programma. Dopo 10 minuti senza PC ti arriva un avviso su Telegram.

**Configurazione:** file `assistente-pc/.env` (non va mai su GitHub). La chiave `ASSISTANT_TOKEN` è la stessa salvata come segreto sul Worker; se la perdi si rigenera con `npx wrangler secret put ASSISTANT_TOKEN --config officina/wrangler.jsonc` e si aggiorna il `.env`.
**Cambiare modello:** `ASSISTANT_MODEL` / `ASSISTANT_VISION_MODEL` nel `.env`.
