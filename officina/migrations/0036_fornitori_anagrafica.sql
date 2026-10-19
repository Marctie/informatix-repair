-- Fornitori: sede legale, sede di ritiro, P.IVA, pagamento, ordine minimo, consegna e agenti di riferimento (JSON). Additivo.
ALTER TABLE suppliers ADD COLUMN legal_address TEXT;
ALTER TABLE suppliers ADD COLUMN pickup_address TEXT;
ALTER TABLE suppliers ADD COLUMN vat_number TEXT;
ALTER TABLE suppliers ADD COLUMN payment_terms TEXT;
ALTER TABLE suppliers ADD COLUMN min_order TEXT;
ALTER TABLE suppliers ADD COLUMN delivery_days TEXT;
ALTER TABLE suppliers ADD COLUMN agents TEXT;
