// File statici che le pagine pubbliche del cliente (/t/ e /p/) caricano dal dominio pubblico.
// Se ne manca uno la pagina resta in caricamento: tests/pagine-pubbliche.test.mjs controlla che l'elenco sia completo.
export const PUBLIC_PAGES = ['track.html', 'preventivo.html'];
export const PUBLIC_ASSETS = new Set(['/track.js', '/sigpad.js', '/preventivo.js', '/cliente-errori.js']);
