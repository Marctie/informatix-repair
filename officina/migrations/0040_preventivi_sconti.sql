-- Sconti nei preventivi (in euro o in percentuale). Additivo: i preventivi esistenti non hanno sconto.
-- Il totale che paga il cliente resta in quote/amount (IVA compresa, gia' scontato): qui si conserva solo come e' stato scritto lo sconto.
ALTER TABLE quotes ADD COLUMN discount_pct REAL;                                  -- sconto in % (se NULL lo sconto e' in euro, colonna discount)
ALTER TABLE repairs ADD COLUMN quote_list REAL;                                   -- prezzo prima dello sconto, come scritto (solo se c'e' uno sconto)
ALTER TABLE repairs ADD COLUMN quote_discount REAL NOT NULL DEFAULT 0;            -- sconto in euro, nella stessa base del prezzo scritto (IVA inclusa/esclusa)
ALTER TABLE repairs ADD COLUMN quote_discount_pct REAL;
ALTER TABLE quote_options ADD COLUMN list_amount REAL;
ALTER TABLE quote_options ADD COLUMN discount REAL NOT NULL DEFAULT 0;
ALTER TABLE quote_options ADD COLUMN discount_pct REAL;
