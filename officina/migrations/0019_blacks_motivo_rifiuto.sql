-- "Blacks" (clienti segnalati) e motivo facoltativo del rifiuto di un preventivo dal link online (solo aggiunte)
CREATE TABLE IF NOT EXISTS blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL, phone TEXT, email TEXT,
  reason TEXT NOT NULL, note TEXT,
  reported_on TEXT NOT NULL, reported_by TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  removed_at TEXT, removed_by TEXT, removed_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON blacklist(active);
ALTER TABLE quote_signatures ADD COLUMN reason TEXT;
