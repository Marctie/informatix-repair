-- Listino servizi (es. Ripristino Windows 11): senza giacenza, vendibili con un tocco.
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
