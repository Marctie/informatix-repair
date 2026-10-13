// Se il gestionale apre una scheda di stampa, non aprirla davvero: la registriamo in win.__opened.
// window.open('about:blank') restituisce un finto "popup" il cui location.href viene registrato (come fa la stampa rapida).
Cypress.on('window:before:load', (win) => {
  win.__opened = [];
  win.open = (url) => {
    if (url && url !== 'about:blank') win.__opened.push(url);
    const popup = { closed: false, close() { this.closed = true; }, location: {} };
    Object.defineProperty(popup.location, 'href', { set: (v) => win.__opened.push(v), get: () => '' });
    return popup;
  };
});
