-- "Altra attivita'": incassi che appartengono a un'altra azienda di Christian (verranno fatturati da quella).
-- entity = 'main' (Informatix Repair, default) oppure 'altra'. L'operazione resta SEMPRE registrata (anche nel Registro);
-- solo amministratori la vedono e la gestiscono (sezione "Altra attivita'" + Analisi). Additivo: nessun dato esistente cambia.
ALTER TABLE payments ADD COLUMN entity TEXT NOT NULL DEFAULT 'main';
ALTER TABLE sales ADD COLUMN entity TEXT NOT NULL DEFAULT 'main';
CREATE INDEX IF NOT EXISTS idx_payments_entity ON payments(entity);
