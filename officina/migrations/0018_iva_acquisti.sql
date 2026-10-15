-- IVA su ricambi e acquisti: aliquota, imponibile, IVA e se l'IVA e' stata aggiunta davvero al costo (solo aggiunte)
ALTER TABLE repair_parts ADD COLUMN vat_rate REAL;
ALTER TABLE repair_parts ADD COLUMN cost_net REAL;
ALTER TABLE repair_parts ADD COLUMN cost_vat REAL;
ALTER TABLE repair_parts ADD COLUMN vat_applied INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_lines ADD COLUMN vat_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE purchase_lines ADD COLUMN vat_applied INTEGER NOT NULL DEFAULT 0;
