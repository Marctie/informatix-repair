-- Soglia "prodotto fermo" per singolo articolo (giorni). NULL = vale quella generale delle Impostazioni; 0 = non avvisare mai per questo articolo. Additivo.
ALTER TABLE products ADD COLUMN stale_days INTEGER;
