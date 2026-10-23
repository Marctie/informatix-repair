-- Preventivi con prezzi IVA inclusa o esclusa. Additivo: i preventivi esistenti restano "IVA inclusa" (come sono sempre stati).
-- Gli importi che pagano il cliente restano in quote/amount (sempre IVA compresa): cosi' incassi, acconti e saldi non cambiano.
-- Qui si aggiunge solo come e' stato scritto il prezzo (imponibile esatto) e l'aliquota, per mostrare imponibile + IVA + totale.
ALTER TABLE quotes ADD COLUMN vat_mode TEXT NOT NULL DEFAULT 'gross';       -- 'gross' = prezzi IVA inclusa | 'net' = prezzi IVA esclusa (l'IVA si somma nel totale)
ALTER TABLE quotes ADD COLUMN vat_rate REAL NOT NULL DEFAULT 22;
ALTER TABLE repairs ADD COLUMN quote_vat_mode TEXT NOT NULL DEFAULT 'gross';
ALTER TABLE repairs ADD COLUMN quote_vat_rate REAL NOT NULL DEFAULT 22;
ALTER TABLE repairs ADD COLUMN quote_net REAL;                                -- imponibile scritto da Christian (solo se il preventivo e' stato scritto IVA esclusa)
ALTER TABLE quote_options ADD COLUMN amount_net REAL;                         -- idem per le soluzioni alternative
ALTER TABLE quote_options ADD COLUMN vat_rate REAL;
-- Permuta sul preventivo: cosa si ritira e quanto vale. Il valore si scala dal totale (IVA compresa): "da pagare" = totale - permuta.
ALTER TABLE quotes ADD COLUMN tradein_desc TEXT;
ALTER TABLE quotes ADD COLUMN tradein_value REAL NOT NULL DEFAULT 0;
