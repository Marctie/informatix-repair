-- Segnalazioni e richieste: chi usa il gestionale apre un task (errore, miglioria, nuova funzione, domanda) con testo, percorso fatto e foto.
-- Solo tabelle nuove: nulla di esistente viene toccato.
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'errore',        -- errore | miglioria | nuova | domanda
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page TEXT,                                  -- sezione del gestionale (es. riparazioni)
  path_text TEXT,                             -- percorso fatto / passaggi per ripetere il problema
  expected TEXT,                              -- come dovrebbe funzionare / cosa si vorrebbe
  priority TEXT NOT NULL DEFAULT 'normale',   -- bassa | normale | alta | urgente
  status TEXT NOT NULL DEFAULT 'nuova',       -- nuova | in_corso | in_attesa | da_verificare | risolta | rifiutata
  photos TEXT,                                -- chiavi dell'archivio foto (JSON)
  context TEXT,                               -- dati automatici (pagina, dispositivo, errori recenti) in JSON
  created_by TEXT NOT NULL DEFAULT 'locale',
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE TABLE IF NOT EXISTS ticket_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'commento',      -- commento | stato
  body TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'locale',
  author_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
