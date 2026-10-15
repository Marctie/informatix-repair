// Layout su telefono, tablet e desktop + funzioni di comodità (ricerca globale, modifica dati, backup).
// Parte da un DB vuoto: nel before() crea i dati di esempio (fornitore, articolo, clienti, riparazioni).
// pagina -> testo che compare solo quando i dati sono stati caricati
const ROUTES = { oggi: 'Preventivo da approvare', riparazioni: 'Samsung Galaxy S23', clienti: 'Mario Rossi', magazzino: 'Display iPhone 13', vendite: 'Ultime vendite', fornitori: 'Ricambi Napoli', cassa: 'Incassato nel periodo', impostazioni: 'Backup dei dati' };
const SCREENS = [
  ['telefono', 375, 667],
  ['tablet', 768, 1024],
  ['desktop', 1280, 800],
];
let tokens = [];

const noHorizontalScroll = () =>
  cy.document().then((d) => {
    expect(d.documentElement.scrollWidth, 'nessuno scorrimento orizzontale').to.be.at.most(d.documentElement.clientWidth);
  });

describe('Responsive e comodità', () => {
  before(() => {
    cy.request('POST', '/api/suppliers', { name: 'Ricambi Napoli', phone: '0811234567' }).then((sup) =>
      cy.request('POST', '/api/products', { name: 'Display iPhone 13', category: 'Ricambi', qty: 3, min_qty: 2, cost: 60, price: 129, supplier_id: sup.body.id }));
    cy.request('POST', '/api/customers', { name: 'Mario Rossi', phone: '3331234567' });
    const mk = (name, phone, model, problem, quote, eta) =>
      cy.request('POST', '/api/repairs', { customer: { name, phone }, brand_model: model, problem, quote, eta_date: eta, deposit: 20, accessories: 'Caricatore, Cover', condition_notes: 'Graffi' })
        .then((r) => { tokens.push(r.body.token); return r.body; });
    mk('Giulia Esposito', '3355550001', 'Samsung Galaxy S23', 'Schermo rotto', 149, '2030-02-01').then((r) => cy.request('POST', `/api/repairs/${r.id}/advance`));
    mk('Paolo De Luca', '3355550002', 'MacBook Air M1', 'Non si accende', 220, '2020-01-01'); // in ritardo
    mk('Chiara Marino', '3355550003', 'PlayStation 5', 'Lettore disco', 90, '2030-03-01').then((r) => {
      cy.request('POST', `/api/repairs/${r.id}/advance`);
      cy.request('POST', `/api/repairs/${r.id}/advance`); // preventivo da approvare
    });
  });

  SCREENS.forEach(([name, w, h]) => {
    context(`${name} (${w}×${h})`, () => {
      beforeEach(() => cy.viewport(w, h));

      Object.entries(ROUTES).forEach(([route, text]) => {
        it(`pagina ${route} senza scorrimento orizzontale`, () => {
          cy.visit(`/#/${route}`);
          cy.get('#view').should('contain', text);
          noHorizontalScroll();
          cy.screenshot(`${name}-${route}`, { capture: 'viewport', overwrite: true });
        });
      });

      it('navigazione e azione rapida adatte al dispositivo', () => {
        cy.visit('/#/oggi');
        cy.get('#view').should('not.contain', 'Caricamento…');
        if (w < 1024) {
          cy.get('#bottom-nav').should('be.visible');
          cy.get('#nav-new').should('be.visible');
          cy.get('#side').should('not.be.visible');
          cy.get('#more-btn').click();
          cy.get('#more-menu').should('be.visible').and('contain', 'Vendite').and('contain', 'Manuale');
        } else {
          cy.get('#side').should('be.visible');
          cy.get('#bottom-nav').should('not.be.visible');
          cy.get('#top-new').should('be.visible');
        }
      });

      it('accettazione veloce usabile (modulo e QR)', () => {
        cy.visit('/#/oggi');
        (w < 1024 ? cy.get('#nav-new') : cy.get('#top-new')).click();
        cy.get('#rf-name').should('be.visible');
        cy.get('#rf-save').should('be.visible');
        noHorizontalScroll();
        cy.screenshot(`${name}-nuova-riparazione`, { capture: 'viewport', overwrite: true });
        cy.get('#rf-name').type(`Test ${name}`);
        cy.get('#rf-model').type('Modello prova');
        cy.get('#rf-problems .chip').first().click();
        cy.get('#rf-quote').type('50');
        cy.get('#rf-save').click();
        cy.get('img[alt="QR tracciamento"]').should('be.visible');
        cy.screenshot(`${name}-scheda-creata`, { capture: 'viewport', overwrite: true });
        cy.contains('button', 'Fatto').click();
      });

      it('dettaglio riparazione e pagina cliente', () => {
        cy.visit('/#/riparazioni');
        cy.contains('[data-open]', 'Samsung Galaxy S23').click();
        cy.contains('Cronologia');
        noHorizontalScroll();
        cy.screenshot(`${name}-dettaglio`, { capture: 'viewport', overwrite: true });
        cy.get('.modal-bg [data-close]').first().click();
        cy.visit(`/t/${tokens[0]}`);
        cy.get('.status').should('be.visible');
        noHorizontalScroll();
        cy.screenshot(`${name}-cliente`, { capture: 'viewport', overwrite: true });
      });
    });
  });
});

describe('Comodità', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('stampa rapida: "Salva e stampa" apre cliente + laboratorio senza passaggi in più', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-name').type('Fabio Stampa');
    cy.get('#rf-phone').type('3200009999');
    cy.get('#rf-model').type('Pixel 8');
    cy.get('#rf-problems .chip').contains('Non carica').click();
    cy.get('#rf-pass').type('2468');
    cy.get('#rf-urgent').check({ force: true });
    cy.get('#rf-save-print').click();
    cy.contains('Riparazione registrata');
    cy.window().its('__opened').should('have.length', 1).its(0).should('match', /\/print\/both\/\d+$/);
    cy.contains('button', 'Fatto').click();
    cy.contains('[data-open]', 'Pixel 8').should('contain', 'Urgente');
  });

  it('schede di stampa: cliente senza PIN, laboratorio con PIN e checklist', () => {
    cy.request('/api/repairs?q=Pixel 8').then((r) => {
      const id = r.body[0].id;
      cy.visit(`/print/customer/${id}?noprint=1`);
      cy.contains('Scheda di ingresso');
      cy.contains('Fabio Stampa');
      cy.get('img[alt="QR"]').should('be.visible');
      cy.get('body').should('not.contain', '2468');
      cy.visit(`/print/lab/${id}?noprint=1`);
      cy.contains('Scheda laboratorio');
      cy.get('.pass').should('contain', '2468');
      cy.contains('Collaudo finale');
      cy.contains('URGENTE');
    });
  });

  it('dettaglio: pulsanti di stampa, note del tecnico e priorità', () => {
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'Pixel 8').click();
    cy.contains('a', 'Stampa tutto').should('have.attr', 'href').and('match', /\/print\/both\//);
    cy.contains('a', 'Scheda cliente').should('have.attr', 'href').and('match', /\/print\/customer\//);
    cy.contains('a', 'Scheda laboratorio').should('have.attr', 'href').and('match', /\/print\/lab\//);
    cy.get('#d-tech').type('Connettore ossidato, pulizia con alcool isopropilico.');
    cy.get('[data-act="savetech"]').click();
    cy.get('#toast').should('contain', 'Note del tecnico salvate');
    cy.get('[data-act="urgent"]').should('have.class', 'on').click();
    cy.get('#toast').should('contain', 'Priorità aggiornata');
    cy.get('[data-act="urgent"]').should('not.have.class', 'on');
    cy.get('.modal-bg [data-close]').first().click();
    cy.request('/api/repairs?q=Pixel 8').then((r) => {
      cy.request(`/print/lab/${r.body[0].id}?noprint=1`).its('body').should('include', 'Connettore ossidato');
    });
  });

  it('ricerca globale: trova riparazioni e clienti e apre la scheda', () => {
    cy.visit('/#/oggi');
    cy.get('#gsearch').type('Esposito');
    cy.get('#gsearch-res').should('be.visible').and('contain', 'Samsung Galaxy S23').and('contain', 'Giulia Esposito');
    cy.get('#gsearch-res [data-rid]').first().click();
    cy.contains('Cronologia');
    cy.get('.modal-bg [data-close]').first().click();
  });

  it('scorciatoie da tastiera: N apre la nuova riparazione, / la ricerca', () => {
    cy.visit('/#/oggi');
    cy.get('#view').should('not.contain', 'Caricamento…');
    cy.get('body').type('n');
    cy.get('#rf-name').should('be.visible');
    cy.get('.modal-bg [data-close]').first().click();
    cy.get('body').type('/');
    cy.focused().should('have.id', 'gsearch');
  });

  it('modifica dei dati di ingresso', () => {
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'MacBook Air M1').click();
    cy.contains('button', 'Modifica').click();
    cy.get('[data-k="brand_model"]').clear().type('MacBook Air M2');
    cy.get('[data-k="c_phone"]').clear().type('3355559999');
    cy.get('#ed-ok').click();
    cy.get('#toast').should('contain', 'Dati aggiornati');
    cy.contains('MacBook Air M2');
    cy.contains('3355559999');
    cy.get('.modal-bg [data-close]').first().click();
  });

  it('dashboard: sezioni in ritardo e preventivo da approvare', () => {
    cy.visit('/#/oggi');
    cy.contains('section', 'In ritardo').should('contain', 'MacBook');
    cy.contains('section', 'Preventivo da approvare').should('contain', 'PlayStation 5');
    cy.contains('section', 'In lavorazione');
  });

  it('cassa: grafico e backup scaricabile', () => {
    cy.visit('/#/impostazioni');
    cy.contains('Backup dei dati');
    cy.request('/api/backup').its('headers.content-disposition').should('include', 'officina-backup-');
    cy.visit('/#/cassa');
    cy.contains('7 giorni').click();
    cy.contains('Incassato nel periodo');
  });

  it('vendita collegata a un cliente compare nello storico', () => {
    cy.visit('/#/vendite');
    cy.get('#s-cust').type('Esposito');
    cy.contains('[data-cust]', 'Giulia Esposito').click();
    cy.get('#s-free').type('Pellicola');
    cy.get('#s-free-p').type('12');
    cy.get('#s-free-add').click();
    cy.get('#s-pay').click();
    cy.get('#toast').should('contain', 'Venduto');
    cy.visit('/#/clienti');
    cy.contains('[data-id]', 'Giulia Esposito').click();
    cy.contains('Acquisti (1)');
    cy.get('.modal-bg [data-close]').first().click();
  });

  it('il manuale è raggiungibile, con immagini caricate e leggibile su ogni schermo', () => {
    SCREENS.forEach(([name, w, h]) => {
      cy.viewport(w, h);
      cy.visit('/manuale.html');
      cy.contains('h2', 'Foglio rapido');
      cy.get('main section').should('have.length.at.least', 14);
      cy.get('figure img').each(($img) => {
        $img[0].loading = 'eager'; // le immagini "lazy" fuori schermo non si caricano da sole
        cy.wrap($img).should(($i) => expect($i[0].naturalWidth, `immagine ${$i[0].getAttribute('src')}`).to.be.greaterThan(0));
      });
      noHorizontalScroll();
      cy.scrollTo('top');
      cy.screenshot(`manuale-${name}`, { capture: 'viewport', overwrite: true });
    });
    cy.viewport(1280, 800);
    cy.visit('/#/oggi');
    cy.get('#nav a[href="/manuale.html"]').should('have.attr', 'target', '_blank');
  });
});
