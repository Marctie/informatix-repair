-- Listini multipli: prezzo amico e prezzo rivenditore per articolo (IVA inclusa come il prezzo al pubblico). NULL = non impostato: vale il prezzo al pubblico. Additivo.
ALTER TABLE products ADD COLUMN price_friend REAL;
ALTER TABLE products ADD COLUMN price_reseller REAL;
