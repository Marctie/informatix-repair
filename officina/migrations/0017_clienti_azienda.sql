-- Clienti azienda: tipo, ragione sociale, dati fiscali e indirizzo (solo aggiunte, i clienti esistenti restano "privato")
ALTER TABLE customers ADD COLUMN kind TEXT NOT NULL DEFAULT 'privato';
ALTER TABLE customers ADD COLUMN company_name TEXT;
ALTER TABLE customers ADD COLUMN vat_number TEXT;
ALTER TABLE customers ADD COLUMN fiscal_code TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN zip TEXT;
ALTER TABLE customers ADD COLUMN city TEXT;
ALTER TABLE customers ADD COLUMN province TEXT;
ALTER TABLE customers ADD COLUMN sdi_code TEXT;
ALTER TABLE customers ADD COLUMN pec TEXT;
