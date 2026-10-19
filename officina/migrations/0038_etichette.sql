-- Etichette prodotto con codice a barre. Additivo: una colonna nuova (vuota per gli articoli esistenti) e due tabelle nuove.
-- Il template di partenza non e' inserito qui: lo crea il gestionale la prima volta che si aprono le etichette.
ALTER TABLE products ADD COLUMN barcode TEXT;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE TABLE IF NOT EXISTS label_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  width_mm REAL NOT NULL, height_mm REAL NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS label_assets (
  key TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
