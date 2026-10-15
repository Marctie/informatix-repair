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
  status TEXT NOT NULL DEFAULT 'received', urgent INTEGER NOT NULL DEFAULT 0, color TEXT,
  quote REAL, deposit REAL NOT NULL DEFAULT 0, final_price REAL,
  eta_date TEXT, warranty_days INTEGER NOT NULL DEFAULT 90,
  quote_decision TEXT, quote_decided_at TEXT,
  tech_notes TEXT, customer_note TEXT,
  checklist_in TEXT, checklist_pre TEXT, checklist_out TEXT, sign_requested INTEGER NOT NULL DEFAULT 0,
  quote_option_id INTEGER, device_fate TEXT, fate_since TEXT, fate_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  delivered_at TEXT
);
CREATE TABLE IF NOT EXISTS checklist_templates (
  device_type TEXT NOT NULL, phase TEXT NOT NULL, items TEXT NOT NULL,
  PRIMARY KEY (device_type, phase)
);
CREATE TABLE IF NOT EXISTS repair_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  image TEXT NOT NULL,
  signer_name TEXT, choice TEXT, option_id INTEGER,
  text_shown TEXT,
  via TEXT NOT NULL DEFAULT 'banco',
  ip TEXT, user_agent TEXT, by_user TEXT,
  signed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signatures_repair ON repair_signatures(repair_id);
CREATE TABLE IF NOT EXISTS quote_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  label TEXT NOT NULL, amount REAL NOT NULL, description TEXT, sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quote_options_repair ON quote_options(repair_id);
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
CREATE TABLE IF NOT EXISTS quote_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- accept | decline
  image TEXT NOT NULL, signer_name TEXT, text_shown TEXT,
  ip TEXT, user_agent TEXT,
  signed_at TEXT NOT NULL
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

-- 0023 Chiusure di cassa, 0024 Archivio fatture, 0025 Dare/avere (agente C)
-- Archivio chiusure di cassa (una per giorno). Gli "attesi" sono una fotografia degli incassi del giorno al momento del salvataggio.
-- La foto (facoltativa) sta nell'archivio media (R2 / cartella), qui solo la chiave. Le modifiche sono nel Registro (audit_log).
CREATE TABLE IF NOT EXISTS cash_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL UNIQUE,
  operator TEXT NOT NULL,
  float_amount REAL NOT NULL DEFAULT 0,
  exp_cash REAL NOT NULL DEFAULT 0, exp_pos REAL NOT NULL DEFAULT 0, exp_other REAL NOT NULL DEFAULT 0,
  cash_out REAL NOT NULL DEFAULT 0,
  cnt_cash REAL NOT NULL DEFAULT 0, cnt_pos REAL NOT NULL DEFAULT 0, cnt_other REAL NOT NULL DEFAULT 0,
  expected_total REAL NOT NULL DEFAULT 0, counted_total REAL NOT NULL DEFAULT 0, difference REAL NOT NULL DEFAULT 0,
  notes TEXT, photo_key TEXT,
  retro INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0, locked_at TEXT, locked_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), created_by TEXT,
  updated_at TEXT, updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_cash_closings_day ON cash_closings(day);
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
