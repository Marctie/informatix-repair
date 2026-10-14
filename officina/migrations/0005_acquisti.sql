-- Acquisti dai fornitori: fatture importate, righe, storico prezzi e codici articolo dei fornitori.
-- Le stesse tabelle stanno in schema.sql (motore SQLite locale).
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  doc_type TEXT NOT NULL DEFAULT 'TD01', doc_number TEXT NOT NULL, doc_date TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'fatturapa', notes TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
-- impedisce di importare due volte lo stesso documento (anche con due richieste ravvicinate)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_doc ON purchases(supplier_id, doc_number, doc_date);
CREATE TABLE IF NOT EXISTS purchase_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  supplier_code TEXT, description TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1, unit TEXT,
  list_price REAL NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0, loaded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_product ON purchase_lines(product_id);
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price REAL NOT NULL, qty REAL NOT NULL DEFAULT 1, doc_date TEXT NOT NULL,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_price_history_ps ON price_history(product_id, supplier_id, doc_date);
-- codice articolo che il fornitore usa per un nostro prodotto (serve ad abbinare le righe delle fatture successive)
CREATE TABLE IF NOT EXISTS supplier_codes (
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_code TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, supplier_code)
);
-- dati fiscali del fornitore letti dalle fatture (partita IVA per riconoscerlo)
CREATE TABLE IF NOT EXISTS supplier_info (
  supplier_id INTEGER PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  vat TEXT, fiscal_code TEXT, address TEXT
);
