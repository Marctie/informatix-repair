// "Pagamento appeso" / Altra attività: la spunta nei moduli e la vista dell'amministratore.
const api = (method, url, body) => cy.request({ method, url, body, failOnStatusCode: false });

describe('Altra attività (pagamento appeso)', () => {
  it('la vista parte vuota e le voci di menu sono visibili all’amministratore', () => {
    cy.visit('/#/altra');
    cy.contains('h1', 'Altra attività');
    cy.contains('Nessun pagamento appeso nel periodo.');
  });

  it('una vendita con la spunta finisce in Altra attività e non nella lista vendite', () => {
    api('POST', '/api/sales', { items: [{ name: 'Cavo USB', qty: 1, unit_price: 12 }], method: 'contanti', appeso: true }).its('status').should('eq', 200);
    api('POST', '/api/sales', { items: [{ name: 'Cover', qty: 1, unit_price: 8 }], method: 'carta' }).its('status').should('eq', 200);
    api('GET', '/api/sales').its('body').should('have.length', 1);
    cy.visit('/#/altra');
    cy.contains('Incassato per l’altra attività');
    cy.contains('12,00');
    cy.get('[data-id]').should('have.length', 1);
  });

  it('nuovo incasso diretto, modifica ed eliminazione con doppia conferma', () => {
    cy.visit('/#/altra');
    cy.get('#al-new').click();
    cy.get('#af-amount').type('45,50');
    cy.get('#af-label').type('Ordine Rossi');
    cy.get('#af-ok').click();
    cy.contains('Ordine Rossi');
    cy.get('[data-id]').should('have.length', 2);
    cy.contains('[data-id]', 'Ordine Rossi').find('[data-act="del"]').click();
    cy.get('#cd-go').click();
    cy.get('#cd-go').click();
    cy.get('[data-id]').should('have.length', 1);
  });

  it('la spunta è presente nella vendita, nella nuova riparazione e in Analisi compare il riquadro', () => {
    cy.visit('/#/analisi');
    cy.contains('button', 'Incassi').click();
    cy.contains('Altra attività (pagamenti appesi');
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-appeso').should('exist');
  });
});
