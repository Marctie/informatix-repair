-- Agente D / compiti 1-2: materiali da ordinare (anche dalle riparazioni) e invio del preventivo dalla scheda riparazione.
-- Solo aggiunte: i dati esistenti non cambiano.
ALTER TABLE repair_parts ADD COLUMN order_state TEXT;   -- NULL = non da ordinare | da_ordinare | ordinato | arrivato
ALTER TABLE repair_parts ADD COLUMN ordered_at TEXT;
ALTER TABLE quotes ADD COLUMN sent_at TEXT;             -- ultimo invio al cliente
ALTER TABLE quotes ADD COLUMN sent_via TEXT;            -- whatsapp | email | link
