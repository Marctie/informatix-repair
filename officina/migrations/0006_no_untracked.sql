-- Il metodo di pagamento "non tracciato" non esiste più: i pagamenti già registrati diventano contanti, visibili nei totali.
UPDATE payments SET method = 'contanti' WHERE method = 'non tracciato';
UPDATE sales SET method = 'contanti' WHERE method = 'non tracciato';
DELETE FROM settings WHERE key = 'cash_show_untracked';
