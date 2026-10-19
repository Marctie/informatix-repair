-- Categorie del magazzino gestibili da schermata (le 6 standard + quelle create). Additivo.
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
INSERT OR IGNORE INTO categories (name) VALUES ('Ricambi'),('Accessori'),('Cavi e caricatori'),('Usato / ricondizionato'),('Software e servizi'),('Altro');
