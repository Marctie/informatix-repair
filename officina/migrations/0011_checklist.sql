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
