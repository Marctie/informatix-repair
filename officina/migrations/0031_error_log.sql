-- Registro errori consultabile (solo amministratore, GET /api/errors). Additivo: non tocca nessun altro dato.
-- Una riga per errore; gli errori identici dello stesso utente entro pochi minuti aggiornano `count` invece di creare righe nuove.
-- Retention automatica: le righe piu' vecchie di 90 giorni vengono cancellate.
CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  severity TEXT NOT NULL,
  status INTEGER NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  section TEXT,
  action TEXT,
  entity TEXT,
  title TEXT,
  reason TEXT,
  hint TEXT,
  error_code TEXT,
  ref TEXT,
  version TEXT,
  user_email TEXT NOT NULL DEFAULT 'visitatore',
  user_name TEXT,
  ip TEXT,
  country TEXT,
  fingerprint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  notified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_error_log_at ON error_log(at);
CREATE INDEX IF NOT EXISTS idx_error_log_fp ON error_log(fingerprint, last_at);
