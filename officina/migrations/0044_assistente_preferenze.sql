-- Assistente: preferenze di Christian (frasi che l'assistente rispetta sempre). Solo una tabella nuova.
CREATE TABLE IF NOT EXISTS assistant_prefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'locale',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  active INTEGER NOT NULL DEFAULT 1
);
