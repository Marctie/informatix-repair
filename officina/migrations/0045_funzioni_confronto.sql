-- Funzioni prese dal confronto con Fix-Book, e-Share e Fixh IT (2026-11-04). Solo aggiunte: nessun dato esistente cambia.
-- Tecnico assegnato e fase personalizzata della riparazione
ALTER TABLE repairs ADD COLUMN tech_email TEXT;
ALTER TABLE repairs ADD COLUMN substatus TEXT;
-- Permessi personalizzati per utente (sezioni negate, JSON)
ALTER TABLE users ADD COLUMN deny TEXT;
-- Ordini al fornitore: articolo di magazzino collegato e quantita' arrivata (controllo differenze)
ALTER TABLE order_items ADD COLUMN product_id INTEGER;
ALTER TABLE order_items ADD COLUMN qty_received INTEGER;
ALTER TABLE orders ADD COLUMN received_note TEXT;
-- Vendite: link pubblico della ricevuta e permuta
ALTER TABLE sales ADD COLUMN token TEXT;
ALTER TABLE sales ADD COLUMN tradein_value REAL NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN tradein_desc TEXT;
ALTER TABLE sale_items ADD COLUMN margin_id INTEGER;
-- Listino pubblico delle riparazioni
ALTER TABLE services ADD COLUMN public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN price_from INTEGER NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN device_type TEXT;
ALTER TABLE services ADD COLUMN public_note TEXT;
-- Registro dell'usato in regime del margine (art. 36 DL 41/1995)
CREATE TABLE IF NOT EXISTS margin_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL, serial TEXT,
  origin TEXT NOT NULL DEFAULT 'acquisto',
  seller_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  seller_name TEXT, seller_doc TEXT,
  cost REAL NOT NULL DEFAULT 0, price REAL,
  acquired_at TEXT NOT NULL,
  sold_at TEXT, sale_id INTEGER, sale_price REAL,
  usati_slug TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_margin_sold ON margin_items(sold_at);
-- Estensioni di garanzia vendute (con certificato pubblico)
CREATE TABLE IF NOT EXISTS warranty_ext (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  description TEXT NOT NULL, months INTEGER NOT NULL, price REAL NOT NULL,
  starts_on TEXT NOT NULL, ends_on TEXT NOT NULL,
  sale_id INTEGER, cancelled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_warranty_ref ON warranty_ext(kind, ref_id);
