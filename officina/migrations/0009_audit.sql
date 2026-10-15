-- Registro delle eliminazioni e modifiche importanti: chi, cosa, quando. Solo gli amministratori lo vedono.
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
