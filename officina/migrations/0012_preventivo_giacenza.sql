-- Preventivo a distanza (opzioni fra cui scegliere) e destino del dispositivo non riparato (giacenza di 15 giorni, deposito).
CREATE TABLE IF NOT EXISTS quote_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  label TEXT NOT NULL, amount REAL NOT NULL, description TEXT, sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quote_options_repair ON quote_options(repair_id);
ALTER TABLE repairs ADD COLUMN quote_option_id INTEGER;
-- device_fate: giacenza | ritirato | ceduto | deposito | smaltito  (solo per riparazioni annullate / non riparabili)
ALTER TABLE repairs ADD COLUMN device_fate TEXT;
ALTER TABLE repairs ADD COLUMN fate_since TEXT;   -- da quando decorrono i giorni di giacenza
ALTER TABLE repairs ADD COLUMN fate_note TEXT;
