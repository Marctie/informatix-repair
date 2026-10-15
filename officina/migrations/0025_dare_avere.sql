-- Dare/avere: movimenti per cliente (anche passati), collegabili a una riparazione o a una vendita.
--  entry_type: debito (il cliente ci deve) | incasso (il cliente paga: entra in cassa) | credito (noi dobbiamo al cliente) | rimborso (noi paghiamo il cliente: esce tra le spese)
--  direction:  dare (aumenta quanto il cliente ci deve) | avere (lo riduce)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  entry_type TEXT NOT NULL, direction TEXT NOT NULL,
  amount REAL NOT NULL, method TEXT, description TEXT NOT NULL,
  repair_id INTEGER, sale_id INTEGER,
  payment_id INTEGER, expense_id INTEGER,
  retro INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ledger_customer ON ledger_entries(customer_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_repair ON ledger_entries(repair_id);
