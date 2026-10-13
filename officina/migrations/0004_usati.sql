-- Vetrina Usati: gli articoli stanno nel database e vengono pubblicati sul sito (content/usati/usati.json) tramite il "publisher".
-- slug = identificativo pubblico (coincide con la cartella delle foto e con content/usati/usati.json).
-- data  = l'articolo completo in JSON (stessi campi del sito); photo_list = elenco foto [{name, legacy, pub}].
CREATE TABLE IF NOT EXISTS usati_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price REAL,
  sold INTEGER NOT NULL DEFAULT 0,
  sold_at TEXT,
  data TEXT NOT NULL,
  photo_list TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
-- File da cancellare dal sito alla prossima pubblicazione (foto tolte, articoli eliminati)
CREATE TABLE IF NOT EXISTS usati_trash (
  path TEXT PRIMARY KEY
);
