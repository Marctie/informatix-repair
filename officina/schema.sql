CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT, email TEXT, website TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT, name TEXT NOT NULL, category TEXT,
  qty INTEGER NOT NULL DEFAULT 0, min_qty INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0, price REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  location TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL, reason TEXT NOT NULL, ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS repairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  device_type TEXT NOT NULL DEFAULT 'smartphone', brand_model TEXT NOT NULL, serial TEXT,
  problem TEXT NOT NULL, accessories TEXT, condition_notes TEXT, passcode TEXT,
  status TEXT NOT NULL DEFAULT 'received', urgent INTEGER NOT NULL DEFAULT 0,
  quote REAL, deposit REAL NOT NULL DEFAULT 0, final_price REAL,
  eta_date TEXT, warranty_days INTEGER NOT NULL DEFAULT 90,
  quote_decision TEXT, quote_decided_at TEXT,
  tech_notes TEXT, customer_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  delivered_at TEXT
);
CREATE TABLE IF NOT EXISTS repair_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  status TEXT, note TEXT, is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS repair_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0, unit_cost REAL NOT NULL DEFAULT 0,
  supplier_code TEXT, supplier_name TEXT, bought_at TEXT
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  total REAL NOT NULL, discount REAL NOT NULL DEFAULT 0, method TEXT NOT NULL DEFAULT 'contanti', notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL, unit_cost REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, ref_id INTEGER NOT NULL, label TEXT,
  amount REAL NOT NULL, method TEXT NOT NULL DEFAULT 'contanti',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_customer ON repairs(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_repair ON repair_events(repair_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE, name TEXT, role TEXT NOT NULL DEFAULT 'staff',
  protected INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spent_on TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'altro',
  vendor TEXT, amount REAL NOT NULL, vat REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'contanti', doc_type TEXT NOT NULL DEFAULT 'scontrino', doc_number TEXT,
  paid_by TEXT, reimbursable INTEGER NOT NULL DEFAULT 0, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(spent_on);

-- Acquisti dai fornitori (vedi migrations/0005_acquisti.sql)
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
CREATE TABLE IF NOT EXISTS usati_trash (
  path TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  user_email TEXT NOT NULL DEFAULT 'locale',
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  label TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(object_type);


-- Ordini (per clienti e ai fornitori), Preventivi con data di validita', Promemoria con data/ora.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'cliente',            -- cliente | fornitore
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  repair_id INTEGER REFERENCES repairs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'da_ordinare',      -- da_ordinare | ordinato | arrivato | consegnato | annullato
  expected_date TEXT, deposit REAL NOT NULL DEFAULT 0, notes TEXT,
  ordered_at TEXT, arrived_at TEXT, delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT, customer_phone TEXT,          -- per chi non e' ancora in anagrafica (es. assemblaggio PC)
  status TEXT NOT NULL DEFAULT 'bozza',            -- bozza | inviato | accettato | rifiutato | convertito  (scaduto = calcolato dalla data)
  valid_until TEXT NOT NULL, discount REAL NOT NULL DEFAULT 0, notes TEXT, terms TEXT,
  repair_id INTEGER REFERENCES repairs(id) ON DELETE SET NULL,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, body TEXT,
  due_at TEXT NOT NULL,                            -- 'YYYY-MM-DD HH:MM' (ora del negozio)
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  repair_id INTEGER REFERENCES repairs(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  done INTEGER NOT NULL DEFAULT 0, done_at TEXT, notified_at TEXT, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(done, due_at);
