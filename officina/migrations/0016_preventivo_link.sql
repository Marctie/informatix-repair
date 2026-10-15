-- Link online dei preventivi autonomi: codice segreto + firma del cliente (solo aggiunte, i dati esistenti non cambiano)
ALTER TABLE quotes ADD COLUMN token TEXT;
CREATE TABLE IF NOT EXISTS quote_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- accept | decline
  image TEXT NOT NULL, signer_name TEXT, text_shown TEXT,
  ip TEXT, user_agent TEXT,
  signed_at TEXT NOT NULL
);
