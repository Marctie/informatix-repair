// Etichette prodotto e codici a barre: lettura in cassa e in magazzino (pistola simulata), editor del template,
// finestra di stampa. La pistola USB e' una tastiera velocissima che chiude con Invio: type({ delay: 0 }) + {enter}.
const FAST = { delay: 0 };
const EAN = '4006381333931';

const product = (extra) => cy.request('POST', '/api/products', { qty: 10, cost: 2, price: 9.9, ...extra }).its('body');

describe('Etichette e codici a barre', () => {
  let cavo; let vetro;
  before(() => {
    product({ name: 'Cavo USB-C Etichetta', category: 'Cavi e caricatori', price: 9.9, barcode: EAN }).then((p) => { cavo = p; });
    product({ name: 'Vetro Etichetta con un nome molto lungo per vedere come si adatta', category: 'Accessori', price: 14.5, qty: 3 }).then((p) => { vetro = p; });
  });
  beforeEach(() => cy.viewport(1280, 900));

  it('cassa: il codice letto mette l\'articolo nel carrello, la seconda lettura aumenta la quantita\'', () => {
    cy.visit('/#/vendite');
    cy.get('#s-q').should('be.focused'); // sul PC il cursore e' gia' pronto per la pistola
    cy.get('#s-q').type(EAN, FAST).type('{enter}');
    cy.get('.cart-item .name').should('contain', 'Cavo USB-C Etichetta');
    cy.get('#s-q').should('have.value', '').and('be.focused');
    cy.get('#s-cart').should('contain', 'In magazzino 10 pz → dopo la vendita 9');
    cy.get('#s-q').type(EAN, FAST).type('{enter}');
    cy.get('.cart-item .qty b').should('have.text', '2');
    cy.get('#s-cart').should('contain', 'dopo la vendita 8');
  });

  it('cassa: codice sconosciuto = avviso chiaro, nessun articolo inventato', () => {
    cy.visit('/#/vendite');
    cy.get('#s-q').type('9999999999999', FAST).type('{enter}');
    cy.get('#toast').should('contain', 'non è in magazzino');
    cy.get('.cart-item').should('not.exist');
    cy.get('#s-sugg').should('have.class', 'hidden');
  });

  it('cassa: un nome scritto a mano resta una ricerca normale (non un codice)', () => {
    cy.visit('/#/vendite');
    cy.get('#s-q').type('Cavo USB').type('{enter}');
    cy.get('.cart-item').should('not.exist');
    cy.get('#s-sugg').should('contain', 'Cavo USB-C Etichetta');
    cy.get('#s-sugg [data-add]').first().click();
    cy.get('.cart-item .name').should('contain', 'Cavo USB-C Etichetta');
  });

  it('cassa: all\'incasso la giacenza scende (lettura del codice -> vendita)', () => {
    cy.visit('/#/vendite');
    cy.get('#s-q').type(EAN, FAST).type('{enter}');
    cy.get('.cart-item .name').should('contain', 'Cavo USB-C Etichetta');
    cy.get('#s-pay').click();
    cy.get('#s-recent').should('contain', 'V-');
    cy.request('/api/products?q=Cavo USB-C Etichetta').its('body.0.qty').should('eq', 9);
  });

  it('magazzino: la pistola nella ricerca apre l\'articolo; codice nuovo = propone di crearlo', () => {
    cy.visit('/#/magazzino');
    cy.get('#p-q').type(EAN, FAST).type('{enter}');
    cy.get('#pf-name').should('have.value', 'Cavo USB-C Etichetta');
    cy.get('#pf-bc').should('have.value', EAN);
    cy.get('#pf-bc-hint').should('contain', 'EAN-13 valido');
    cy.get('.modal-bg [data-close]').first().click();
    cy.get('#p-q').type('8001234567892', FAST).type('{enter}');
    cy.get('#toast').should('contain', 'Nessun articolo ha il codice').contains('Crea l’articolo con questo codice').click();
    cy.get('#pf-bc').should('have.value', '8001234567892');
    cy.get('#pf-name').type('Articolo nato dal codice');
    cy.get('#pf-price').type('5');
    cy.get('#pf-ok').click();
    cy.request('/api/products/by-code/8001234567892').its('body.name').should('eq', 'Articolo nato dal codice');
  });

  it('scheda articolo: il codice a barre gia\' usato da un altro articolo viene rifiutato con il nome', () => {
    cy.visit('/#/magazzino');
    cy.get('#p-q').type('Vetro Etichetta');
    cy.contains('.row-h, .pcard', 'Vetro Etichetta').click();
    cy.get('#pf-bc').clear().type(EAN);
    cy.get('#pf-ok').click();
    cy.get('#toast').should('contain', 'Cavo USB-C Etichetta');
    cy.get('#pf-bc').clear().type('4006381333930'); // 13 cifre con la cifra di controllo sbagliata (quella giusta e' 1)
    cy.get('#pf-bc-hint').should('contain', 'cifra di controllo');
  });

  it('impostazioni: il template di partenza ha logo, nome, prezzo e codice a barre; l\'editor mostra l\'anteprima', () => {
    cy.visit('/#/impostazioni');
    cy.get('#st-labels').should('contain', 'Etichette prodotto e codici a barre');
    cy.get('#lb-list').should('contain', 'predefinito').and('contain', '62 × 30 mm');
    cy.get('#lb-list [data-act="edit"]').click();
    cy.get('#le-paper .lab .e[data-el="barcode"] svg').should('exist');
    cy.get('#le-paper .lab').should('contain', 'Cavo USB-C intrecciato 1 m').and('contain', '€ 9,90');
    cy.get('#le-paper .lab .e[data-el="logo"] img').should('have.attr', 'src').and('contain', '/api/labels/logo/word');
    // si sceglie un articolo vero e si vede il suo nome e il suo codice
    cy.get('#le-prod').select('Cavo USB-C Etichetta');
    cy.get('#le-paper .lab').should('contain', 'Cavo USB-C Etichetta').and('contain', EAN);
    // un elemento spento sparisce dall'etichetta
    cy.contains('#le-els .lb-el', 'Prezzo').find('input').uncheck();
    cy.get('#le-paper .lab .e[data-el="price"]').should('not.exist');
    cy.contains('#le-els .lb-el', 'Prezzo').find('input').check();
    cy.get('#le-paper .lab .e[data-el="price"]').should('exist');
  });

  it('editor: cambiando misura gli elementi si adattano; salvando nasce un template; si puo\' eliminare', () => {
    cy.visit('/#/impostazioni');
    cy.get('#lb-list [data-act="dup"]').first().click();
    cy.get('#le-name').clear().type('Piccola 54 × 17');
    cy.get('#le-preset').select('54x17');
    cy.get('#le-w').should('have.value', '54');
    cy.get('#le-paper .lab').should('have.css', 'width');
    cy.get('#le-warn .lb-w').should('not.exist');
    cy.get('#le-save').click();
    cy.get('#lb-list').should('contain', 'Piccola 54 × 17').and('contain', '54 × 17 mm');
    cy.request('/api/labels/templates').its('body.templates').should('have.length', 2);
    cy.contains('#lb-list .lb-tpl', 'Piccola 54 × 17').find('[data-act="del"]').click();
    cy.get('#cd-go').click(); // 1) Continua
    cy.get('#cd-go').click(); // 2) Confermo l'eliminazione
    cy.request('/api/labels/templates').its('body.templates').should('have.length', 1);
  });

  it('editor: un codice a barre troppo stretto da\' un avviso', () => {
    cy.visit('/#/impostazioni');
    cy.get('#lb-list [data-act="edit"]').first().click();
    cy.contains('#le-els .lb-el', 'Codice a barre').click();
    cy.get('#ep-w').clear().type('18');
    cy.get('#le-warn').should('contain', 'troppo stretto');
    cy.get('#ep-w').clear().type('52');
    cy.get('#le-warn .lb-w').should('not.exist');
  });

  it('editor su telefono: nessuno scorrimento orizzontale', () => {
    cy.viewport(390, 844);
    cy.visit('/#/impostazioni');
    cy.get('#lb-list [data-act="edit"]').first().click();
    cy.get('#le-paper .lab').should('exist');
    cy.document().then((d) => expect(d.documentElement.scrollWidth, 'larghezza pagina').to.be.at.most(392));
  });

  it('magazzino: finestra Etichette con quantita\', riepilogo e pagina di stampa corretta', () => {
    cy.visit('/#/magazzino');
    cy.get('#p-labels').click();
    cy.get('#lp-list [data-id]').should('have.length.gte', 2);
    cy.get('#lp-sum').should('contain', 'Nessuna etichetta');
    cy.get('#lp-print').should('be.disabled');
    cy.get('#lp-q').type('Etichetta');
    cy.contains('#lp-list [data-id]', 'Cavo USB-C Etichetta').find('.lp-qty').clear().type('3');
    cy.contains('#lp-list [data-id]', 'Vetro Etichetta').find('.lp-qty').clear().type('2');
    cy.get('#lp-sum').should('contain', '5 etichette').and('contain', '2 articoli');
    cy.window().then((win) => {
      const fake = { location: { href: '' }, close: () => {} };
      cy.stub(win, 'open').as('open').returns(fake);
      cy.wrap(fake).as('fake');
    });
    cy.get('#lp-prev').click();
    cy.get('@fake').should((f) => expect(f.location.href).to.contain('/print/labels?items='));
    cy.get('@fake').then((f) => {
      expect(f.location.href).to.contain('noprint=1');
      cy.request(f.location.href).then((r) => {
        expect((r.body.match(/class="lab/g) || []).length).to.eq(5);
        expect(r.body).to.contain('Cavo USB-C Etichetta').and.contain('Vetro Etichetta');
        expect(r.body).to.contain(EAN);
        expect(r.body).to.contain('@page{size:62mm 30mm;margin:0}');
      });
    });
    // il vetro non aveva codice: ora ce l'ha (assegnato alla stampa)
    cy.request('/api/products?q=Vetro Etichetta').its('body.0.barcode').should('match', /^2\d{12}$/);
  });

  it('scheda articolo: stampa un\'etichetta dall\'articolo', () => {
    cy.visit('/#/magazzino');
    cy.get('#p-q').type('Cavo USB-C Etichetta');
    cy.contains('.row-h, .pcard', 'Cavo USB-C Etichetta').click();
    cy.window().then((win) => {
      const fake = { location: { href: '' }, close: () => {} };
      cy.stub(win, 'open').as('open2').returns(fake);
      cy.wrap(fake).as('fake2');
    });
    cy.get('#pf-lq').clear().type('4');
    cy.get('#pf-lprint').click();
    cy.get('@fake2').should((f) => expect(f.location.href).to.contain(`items=${cavo.id}%3A4`));
  });

  it('carico merce: dopo il carico compare il pulsante per stampare le etichette dei pezzi arrivati', () => {
    cy.visit('/#/magazzino');
    cy.get('#p-load').click();
    cy.get('#cl-q').type('Cavo USB-C Etichetta');
    cy.get('#cl-res [data-pick]').first().click();
    cy.get('#cl-qty').clear().type('6');
    cy.get('#cl-cost').clear().type('2');
    cy.get('#cl-ok').click();
    cy.get('#toast').should('contain', 'Caricati 6 pz').and('contain', 'Stampa 6 etichette');
  });
});
