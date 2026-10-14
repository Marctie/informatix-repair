-- Checklist per tipo di dispositivo (modificabili) e controlli compilati salvati nella riparazione.
-- Le voci predefinite stanno nel codice (checklists.mjs): qui restano solo le personalizzazioni.
CREATE TABLE IF NOT EXISTS checklist_templates (
  device_type TEXT NOT NULL, phase TEXT NOT NULL, items TEXT NOT NULL,
  PRIMARY KEY (device_type, phase)
);
-- Controlli compilati (JSON: {items:[{l,s}], by, at}); s = ok | ko | na
ALTER TABLE repairs ADD COLUMN checklist_in TEXT;
ALTER TABLE repairs ADD COLUMN checklist_pre TEXT;
ALTER TABLE repairs ADD COLUMN checklist_out TEXT;

-- Firme digitali (scheda di ingresso al banco o da link, conferma/rifiuto preventivo): immagine PNG + data, ora, IP e testo firmato.
ALTER TABLE repairs ADD COLUMN sign_requested INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS repair_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,            -- intake | quote_accept | quote_decline | disposal
  image TEXT NOT NULL,           -- PNG come data URL
  signer_name TEXT, choice TEXT, option_id INTEGER,
  text_shown TEXT,               -- testo che il cliente aveva davanti quando ha firmato
  via TEXT NOT NULL DEFAULT 'banco',   -- banco | link
  ip TEXT, user_agent TEXT, by_user TEXT,
  signed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signatures_repair ON repair_signatures(repair_id);
