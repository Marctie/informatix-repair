-- Ricambi inseriti a mano: codice fornitore, fornitore e data d'acquisto.
ALTER TABLE repair_parts ADD COLUMN supplier_code TEXT;
ALTER TABLE repair_parts ADD COLUMN supplier_name TEXT;
ALTER TABLE repair_parts ADD COLUMN bought_at TEXT;
