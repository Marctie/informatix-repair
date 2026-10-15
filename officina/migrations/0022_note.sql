-- Agente B: note libere stile Keep (condivise tra gli utenti): colore, fissate, caselle da spuntare.
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, body TEXT,
  items TEXT,                                        -- elenco con caselle: JSON [{"t":"testo","d":0|1}]
  color TEXT NOT NULL DEFAULT 'giallo',
  pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned, archived);
