-- Agente D / compito 4: import DDT e fatture PDF con apprendimento del formato di ogni fornitore.
-- pattern = JSON con la mappa delle colonne (quale cella e' codice, descrizione, quantita', prezzo...) corretta dall'utente.
CREATE TABLE IF NOT EXISTS supplier_formats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_key TEXT NOT NULL UNIQUE,               -- vat:<partita IVA> oppure name:<nome normalizzato>
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  label TEXT,
  pattern TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
