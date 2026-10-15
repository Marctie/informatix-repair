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
