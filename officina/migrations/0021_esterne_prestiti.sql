-- Agente B: riparazioni esterne (laboratorio terzo) e dispositivi in prestito / muletto.
CREATE TABLE IF NOT EXISTS external_repairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,   -- laboratorio in anagrafica fornitori
  lab_name TEXT,                                                     -- oppure scritto a mano
  work TEXT,                                                         -- cosa fa il laboratorio
  status TEXT NOT NULL DEFAULT 'da_inviare',                         -- da_inviare | inviata | rientrata | annullata
  sent_at TEXT, expected_back TEXT, returned_at TEXT,
  cost REAL, tracking TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_external_repairs_repair ON external_repairs(repair_id);
CREATE INDEX IF NOT EXISTS idx_external_repairs_status ON external_repairs(status);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,       -- il muletto, se e' nel registro Dispositivi
  label TEXT NOT NULL,                                               -- descrizione del muletto (es. "Samsung A13 nero")
  repair_id INTEGER REFERENCES repairs(id) ON DELETE SET NULL,       -- riparazione del cliente per cui lo presta
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  lent_at TEXT NOT NULL, due_at TEXT, returned_at TEXT,
  status TEXT NOT NULL DEFAULT 'prestato',                           -- prestato | rientrato
  condition_out TEXT, condition_back TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_repair ON loans(repair_id);
