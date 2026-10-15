-- Archivio fatture emesse e ricevute (anche passate), con pagamenti parziali, scadenze e note di credito.
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,                  -- emessa | ricevuta
  doc_type TEXT NOT NULL DEFAULT 'fattura', -- fattura | nota_credito
  number TEXT NOT NULL, issue_date TEXT NOT NULL, due_date TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  party_name TEXT,
  total REAL NOT NULL, vat REAL NOT NULL DEFAULT 0,
  credit_for_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  sale_id INTEGER, repair_id INTEGER, purchase_id INTEGER,
  notes TEXT, retro INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), created_by TEXT,
  updated_at TEXT, updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_dir_date ON invoices(direction, issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_credit ON invoices(credit_for_id);
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  paid_on TEXT NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL, note TEXT,
  payment_id INTEGER,  -- riga in cassa (payments) quando e' un incasso di fattura emessa
  expense_id INTEGER,  -- riga tra le spese quando una fattura ricevuta pagata viene registrata anche come spesa
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv ON invoice_payments(invoice_id);
