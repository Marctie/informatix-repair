-- Agente D: Dispositivi (seriali/IMEI), Buoni sconto/regalo + pagamento diviso, Documenti d'identita' (cifrati), Credenziali fornitori (cifrate).

-- Registro dispositivi (telefoni, portatili, console...): una riga per dispositivo, storico in device_events.
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'usato',          -- sottoclasse: nuovo | usato | ricondizionato | da_smaltire | in_arrivo
  kind TEXT NOT NULL DEFAULT 'smartphone',
  brand_model TEXT NOT NULL,
  serial TEXT, imei2 TEXT,
  serial_key TEXT, imei2_key TEXT,                 -- versione normalizzata (minuscole, solo lettere/cifre) per cercare e trovare i doppioni
  condition_notes TEXT, source TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date TEXT, cost REAL, price REAL, notes TEXT,
  flag TEXT NOT NULL DEFAULT 'ok',                 -- ok | stolen (rubato/smarrito) | check (da verificare)
  flag_note TEXT, flag_report_no TEXT, flag_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_key);
CREATE INDEX IF NOT EXISTS idx_devices_imei2 ON devices(imei2_key);
CREATE TABLE IF NOT EXISTS device_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, note TEXT, by_user TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_device_events_dev ON device_events(device_id);

-- Buoni sconto (importo / percentuale) e buoni regalo (credito con saldo residuo)
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'regalo',             -- regalo | sconto_importo | sconto_percentuale
  value REAL NOT NULL,                             -- importo in euro, oppure percentuale
  balance REAL NOT NULL DEFAULT 0,                 -- credito residuo (per la percentuale: 1 = ancora da usare, 0 = usato)
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'attivo',           -- attivo | annullato
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS voucher_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, ref_id INTEGER NOT NULL, label TEXT,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_voucher_uses_v ON voucher_uses(voucher_id);

-- Documenti d'identita' dei clienti: i dati e le immagini stanno SOLO cifrati (AES-GCM, chiave VAULT_KEY del Worker)
CREATE TABLE IF NOT EXISTS id_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'carta_identita', -- carta_identita | patente | passaporto | altro
  purpose TEXT,                                    -- perche' lo conserviamo (acquisto usato, ritiro, ...)
  data_enc TEXT NOT NULL,                          -- JSON cifrato: numero, scadenza, ente, note
  consent INTEGER NOT NULL DEFAULT 0, consent_at TEXT,
  captured_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS id_document_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES id_documents(id) ON DELETE CASCADE,
  side TEXT NOT NULL DEFAULT 'fronte',             -- fronte | retro
  mime TEXT, file_enc TEXT NOT NULL
);
-- Registro degli accessi ai dati sensibili (documenti e credenziali): chi, quando, cosa
CREATE TABLE IF NOT EXISTS sensitive_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area TEXT NOT NULL, action TEXT NOT NULL, target_id INTEGER, detail TEXT, by_user TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Credenziali dei portali dei fornitori (password cifrata)
CREATE TABLE IF NOT EXISTS supplier_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  label TEXT, url TEXT, username TEXT,
  password_enc TEXT,
  agent_name TEXT, agent_phone TEXT, notes TEXT,
  pw_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_supcred_sup ON supplier_credentials(supplier_id);
