// Se il gestionale apre una scheda di stampa, non aprirla davvero: la registriamo.
Cypress.on('window:before:load', (win) => {
  win.__opened = [];
  win.open = (url) => { win.__opened.push(url); return null; };
});
