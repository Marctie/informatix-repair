// Lettore di codici a barre. La pistola USB si comporta come una tastiera velocissima che chiude con Invio:
// qui la simuliamo con type({ delay: 0 }) (tutti i caratteri a raffica, poi {enter}).
const FAST = { delay: 0 };
const IMEI_OK = '356938035643809'; // 15 cifre, Luhn valido
const IMEI_BAD = '356938035643808';

describe('Lettore codici a barre', () => {
  before(() => {
    cy.request('POST', '/api/repairs', { customer: { name: 'Carla Scanner', phone: '3331110000' }, brand_model: 'iPhone 14', problem: 'Batteria', serial: 'F2LXK1ABCD99' });
  });
  beforeEach(() => cy.viewport(1280, 800));

  it('seriale: la lettura chiude con Invio, passa al campo successivo e verifica l’IMEI', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-serial').type(IMEI_OK, FAST).type('{enter}');
    cy.get('#rf-serial').should('have.value', IMEI_OK);
    cy.focused().should('have.id', 'rf-problem');
    cy.get('#rf-serial-hint').should('contain', 'IMEI valido');
    cy.get('#rf-serial').clear().type(IMEI_BAD, FAST);
    cy.get('#rf-serial-hint').should('contain', 'IMEI non valido');
    cy.get('#rf-name').should('exist'); // Invio non ha mandato avanti né chiuso il modulo
  });

  it('seriale già in archivio: avvisa e permette di aprire la riparazione precedente', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-serial').type('F2LXK1ABCD99', FAST);
    cy.get('#rf-serial-hint').should('contain', 'Già in archivio').and('contain', 'Carla Scanner');
    cy.get('#rf-serial-hint [data-prev]').click();
    cy.contains('Cronologia');
  });

  it('la lettura arrivata nella casella cliente (selezionata di default) finisce nel seriale', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-search').should('be.focused').type('SN8877665544', FAST).type('{enter}');
    cy.get('#rf-serial').should('have.value', 'SN8877665544');
    cy.get('#rf-search').should('have.value', '');
    cy.focused().should('have.id', 'rf-problem');
  });

  it('lettura con la pagina "libera": apre la riparazione che ha quel seriale', () => {
    cy.visit('/#/oggi');
    cy.get('#view').should('contain', 'Carla Scanner');
    cy.get('body').type('F2LXK1ABCD99', FAST).type('{enter}');
    cy.get('.modal-body').should('contain', 'iPhone 14').and('contain', 'Cronologia');
  });

  it('lettura del codice stampato sull’etichetta (R-AAAA-NNNN) apre la riparazione', () => {
    cy.request('/api/repairs?q=Carla').then((r) => {
      const code = r.body[0].code;
      cy.visit('/#/oggi');
      cy.get('#view').should('contain', 'Carla Scanner');
      cy.get('body').type(code, FAST).type('{enter}');
      cy.get('.modal-bg').should('contain', code).and('contain', 'Cronologia');
    });
  });

  it('codice sconosciuto: propone di aprire una nuova riparazione con quel seriale', () => {
    cy.visit('/#/oggi');
    cy.get('#view').should('contain', 'Carla Scanner');
    cy.get('body').type('ZZ99887766', FAST).type('{enter}');
    cy.contains('Nessuna riparazione con il codice');
    cy.get('#scan-new').click();
    cy.get('#rf-serial').should('have.value', 'ZZ99887766');
  });

  it('nella ricerca in alto: Invio con un solo risultato apre la scheda', () => {
    cy.visit('/#/oggi');
    cy.get('#gsearch').type('F2LXK1ABCD99', FAST).type('{enter}');
    cy.get('.modal-body').should('contain', 'Carla Scanner');
  });

  it('le scorciatoie da tastiera funzionano ancora (un tasto solo ≠ lettura)', () => {
    cy.visit('/#/oggi');
    cy.get('#view').should('contain', 'Carla Scanner');
    cy.get('body').type('n');
    cy.get('#rf-name').should('be.visible');
  });

  it('etichetta e scheda laboratorio stampano il codice a barre della riparazione', () => {
    cy.request('/api/repairs?q=Carla').then((r) => {
      const id = r.body[0].id;
      cy.visit(`/print/label/${id}?noprint=1`);
      cy.get('img[alt^="codice a barre"]').should(($i) => expect($i[0].naturalWidth).to.be.greaterThan(0));
      cy.visit(`/print/lab/${id}?noprint=1`);
      cy.get('img[alt^="codice a barre"]').should(($i) => expect($i[0].naturalWidth).to.be.greaterThan(0));
    });
  });

  it('fotocamera: pulsante presente; senza connessione sicura spiega cosa fare', () => {
    cy.visit('/', { onBeforeLoad(win) { Object.defineProperty(win.navigator, 'mediaDevices', { value: undefined }); } });
    cy.get('#top-new').click();
    cy.get('#rf-cam').should('be.visible').click();
    cy.get('#toast').should('contain', 'connessione sicura').and('contain', 'pistola');
    cy.viewport('iphone-6');
    cy.get('.modal-bg [data-close]').first().click();
    cy.get('#scan-btn').should('be.visible');
  });
});
