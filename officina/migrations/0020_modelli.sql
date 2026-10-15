-- Agente B: catalogo marche/modelli dei dispositivi (suggerimenti nella scheda riparazione). repairs.brand_model resta testo libero.
CREATE TABLE IF NOT EXISTS device_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'smartphone',          -- smartphone | tablet | portatile | pc | console | altro
  brand TEXT NOT NULL COLLATE NOCASE,
  model TEXT NOT NULL COLLATE NOCASE,
  keywords TEXT,                                    -- parole alternative per la ricerca (es. "galaxy", "iphone")
  source TEXT NOT NULL DEFAULT 'catalogo',          -- catalogo (di partenza) | auto (aggiunto da una scheda) | manuale
  uses INTEGER NOT NULL DEFAULT 0,                  -- quante volte e' stato scelto: i piu' usati salgono nei suggerimenti
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (kind, brand, model)
);
CREATE INDEX IF NOT EXISTS idx_device_models_brand ON device_models(brand);
