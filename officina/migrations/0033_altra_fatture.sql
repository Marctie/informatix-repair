-- Completa "Altra attivita'" (0032): anche le fatture possono appartenere all'altra azienda. Additivo.
ALTER TABLE invoices ADD COLUMN entity TEXT NOT NULL DEFAULT 'main';
