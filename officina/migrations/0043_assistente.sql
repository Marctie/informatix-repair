-- Assistente: richieste in linguaggio normale, coda per il PC con l'LLM, riepilogo da confermare e cronologia (30 giorni).
-- Solo tabelle nuove: nulla di esistente viene toccato.
CREATE TABLE IF NOT EXISTS assistant_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',      -- queued | processing | awaiting_confirm | done | cancelled | error
  user_email TEXT NOT NULL DEFAULT 'locale',
  user_name TEXT,
  user_role TEXT,
  context TEXT,                               -- istantanea dei dati vista dall'LLM (senza costi per il ruolo cassa)
  attachment_name TEXT,
  attachment_kind TEXT,                       -- image | pdf | text
  attachment_key TEXT,                        -- chiave nell'archivio R2 (immagini e PDF)
  doc_text TEXT,                              -- testo di un allegato TXT/CSV
  reply TEXT,
  suggestions TEXT,                           -- JSON
  raw_actions TEXT,                           -- JSON: azioni proposte dall'LLM, come le ha scritte
  actions TEXT,                               -- JSON: azioni verificate dal server (riepilogo mostrato)
  signature TEXT,                             -- impronta dei dati su cui il riepilogo e' stato verificato
  results TEXT,                               -- JSON: esito di ogni operazione dopo la conferma
  error TEXT,
  note TEXT,
  model TEXT,
  duration_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_assistant_status ON assistant_requests(status);
CREATE INDEX IF NOT EXISTS idx_assistant_user ON assistant_requests(user_email, id);
-- Ultimo segnale del programma sul PC (mostra "PC collegato" / "PC spento")
CREATE TABLE IF NOT EXISTS assistant_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
