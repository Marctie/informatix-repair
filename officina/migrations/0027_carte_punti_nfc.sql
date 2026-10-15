-- Agente D / compito 3: carta punti NFC protetta (UID + codice firmato HMAC a contatore, PIN, registro di tutte le operazioni).
-- Il segreto per le firme NON sta nel database: e' il segreto del Worker NFC_SECRET (in mancanza, VAULT_KEY).
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_no TEXT NOT NULL UNIQUE,                    -- numero stampabile, es. C-000012
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  uid TEXT NOT NULL,                               -- UID del chip, esadecimale maiuscolo
  status TEXT NOT NULL DEFAULT 'attiva',           -- attiva | bloccata | persa | annullata
  points INTEGER NOT NULL DEFAULT 0,               -- saldo punti: vive SOLO qui (sul chip non c'e' mai saldo)
  counter INTEGER NOT NULL DEFAULT 0,              -- contatore del codice a rotazione scritto sul chip
  pin_hash TEXT,                                   -- HMAC del PIN (mai il PIN)
  fail_count INTEGER NOT NULL DEFAULT 0,           -- tentativi falliti di fila
  locked_reason TEXT,
  notes TEXT, created_by TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_used_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_uid_live ON loyalty_cards(uid) WHERE status IN ('attiva','bloccata');
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_cards(customer_id);
CREATE TABLE IF NOT EXISTS loyalty_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER REFERENCES loyalty_cards(id) ON DELETE CASCADE,   -- NULL = carta sconosciuta
  kind TEXT NOT NULL,                              -- emissione | verifica | accredito | riscatto | rettifica | riemissione | blocco | sblocco | sostituzione | tentativo_fallito | sospetta_clonazione
  points INTEGER NOT NULL DEFAULT 0,               -- variazione del saldo (+/-)
  ref_kind TEXT, ref_id INTEGER,                   -- vendita/riparazione che ha generato i punti
  voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  by_user TEXT, ip TEXT, detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_card ON loyalty_events(card_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_who ON loyalty_events(by_user, created_at);
-- una vendita o riparazione puo' dare punti UNA volta sola, su una sola carta
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_accrual_once ON loyalty_events(ref_kind, ref_id) WHERE kind = 'accredito' AND ref_id IS NOT NULL;
