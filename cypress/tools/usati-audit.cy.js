// Fotografa il gestionale Vetrina Usati (server locale su 4848) a telefono/tablet/desktop per verificarne grafica e accessibilità.
// Uso (con `npm run admin` acceso):  npx cypress run --spec cypress/tools/usati-audit.cy.js
const URL = 'http://127.0.0.1:4848/';
[['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1280, 860]].forEach(([vp, w, h]) => {
  describe(`Vetrina Usati ${vp}`, () => {
    beforeEach(() => cy.viewport(w, h));
    it('elenco', () => {
      cy.visit(URL);
      cy.get('body').should('be.visible');
      cy.wait(800);
      cy.screenshot(`usati-${vp}-elenco`, { capture: 'viewport', overwrite: true });
    });
    it('nuovo articolo', () => {
      cy.visit(URL);
      cy.get('#btn-new').click();
      cy.wait(400);
      cy.screenshot(`usati-${vp}-nuovo`, { capture: 'viewport', overwrite: true });
      cy.get('#item-form').then(($f) => {
        const pads = [...$f[0].querySelectorAll('input:not([type=checkbox]):not([type=file]),select,textarea')].map((e) => parseFloat(getComputedStyle(e).paddingLeft));
        cy.log(`padding sinistro minimo dei campi: ${Math.min(...pads)}px`);
        expect(Math.min(...pads), 'padding dei campi').to.be.at.least(8);
      });
    });
  });
});
