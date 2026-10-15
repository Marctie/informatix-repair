// Spese in Cassa, nota spese PDF e dati demo con spese.
const api = (method, url, body) => cy.request({ method, url, body, failOnStatusCode: false });
const today = () => new Date().toLocaleDateString('sv-SE');
const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kpiOf = (label) => cy.contains(label).parent();

describe('Spese in Cassa', () => {
  it('senza spese: KPI e elenco vuoto', () => {
    cy.visit('/#/cassa');
    cy.contains('Spese del periodo (0)');
    cy.contains('Nessuna spesa registrata nel periodo.');
    cy.contains('Spese nel periodo');
  });

  it('importo non valido: messaggio di errore e la finestra resta aperta', () => {
    cy.visit('/#/cassa');
    cy.get('#c-newexp').click();
    cy.get('#ex-desc').type('Prova importo');
    cy.get('#ex-amt').type('abc');
    cy.get('#ex-ok').click();
    cy.get('#toast').should('contain', 'Importo non valido');
    cy.get('#ex-ok').should('be.visible');
    cy.get('#ex-amt').clear();
    cy.get('#ex-ok').click();
    cy.get('#toast').should('contain', 'Importo non valido');
  });

  it('nuova spesa compilata: compare nell\'elenco e nei KPI', () => {
    cy.visit('/#/cassa');
    cy.get('#c-newexp').click();
    cy.get('#ex-date').should('have.value', today());
    cy.get('#ex-amt').type('45,50');
    cy.get('#ex-desc').type('Cartucce per la stampante');
    cy.get('#ex-cat').select('attrezzatura');
    cy.get('#ex-vendor').type('Cartoleria Bianchi');
    cy.get('#ex-doc').select('fattura');
    cy.get('#ex-num').type('F-2026/77');
    cy.get('#ex-vat').type('8,20');
    cy.get('#ex-method').select('carta');
    cy.get('#ex-by').type('Christian');
    cy.get('#ex-reimb').check();
    cy.get('#ex-ok').click();
    cy.get('#toast').should('contain', 'Spesa salvata');
    cy.contains('Spese del periodo (1)');
    cy.contains('[data-exp]', 'Cartucce per la stampante').within(() => {
      cy.contains('Cartoleria Bianchi');
      cy.contains('da rimborsare');
      cy.contains('45,50');
    });
    kpiOf('Spese nel periodo').should('contain', '45,50');
    api('GET', `/api/expenses?from=${today()}&to=${today()}`).its('body').should((b) => {
      expect(b.rows).to.have.length(1);
      expect(b.rows[0]).to.include({ amount: 45.5, vat: 8.2, doc_type: 'fattura', doc_number: 'F-2026/77', method: 'carta', paid_by: 'Christian', category: 'attrezzatura' });
      expect(b.rows[0].reimbursable).to.be.oneOf([1, true]);
    });
  });

  it('"Incassi meno spese" cambia in modo coerente', () => {
    api('POST', '/api/sales', { items: [{ name: 'Servizio', qty: 1, unit_price: 100 }], method: 'contanti' }).its('status').should('eq', 200);
    api('GET', `/api/report?from=${today()}&to=${today()}`).its('body.total').then((tot) => {
      api('GET', `/api/expenses?from=${today()}&to=${today()}`).its('body.total').then((sp) => {
        cy.visit('/#/cassa');
        kpiOf('Incassi meno spese').should('contain', fmt(tot - sp));
        api('POST', '/api/expenses', { spent_on: today(), description: 'Spesa extra', amount: '10,00', category: 'altro', doc_type: 'scontrino', method: 'contanti' });
        cy.reload();
        cy.contains('Spese del periodo (2)');
        kpiOf('Spese nel periodo').should('contain', fmt(sp + 10));
        kpiOf('Incassi meno spese').should('contain', fmt(tot - sp - 10));
      });
    });
  });

  it('modifica una spesa dalla riga', () => {
    cy.visit('/#/cassa');
    cy.contains('[data-exp]', 'Spesa extra').click();
    cy.get('#ex-desc').should('have.value', 'Spesa extra');
    cy.get('#ex-amt').clear().type('12,00');
    cy.get('#ex-desc').clear().type('Spesa extra modificata');
    cy.get('#ex-ok').click();
    cy.get('#toast').should('contain', 'Spesa salvata');
    cy.contains('[data-exp]', 'Spesa extra modificata').should('contain', '12,00');
  });

  it('eliminazione rifiutata dalla conferma: la spesa resta', () => {
    cy.visit('/#/cassa');
    cy.contains('[data-exp]', 'Spesa extra modificata').click();
    cy.get('#ex-del').click();
    cy.get('#cd-go').should('be.visible');
    cy.get('.modal-bg [data-close]').last().click(); // Annulla nella doppia conferma
    cy.get('#ex-ok').should('be.visible');
    cy.get('.modal-bg [data-close]').first().click();
    cy.contains('Spese del periodo (2)');
  });

  it('elimina una spesa con conferma', () => {
    cy.visit('/#/cassa');
    cy.contains('[data-exp]', 'Spesa extra modificata').click();
    cy.get('#ex-del').click();
    cy.get('#cd-go').click();
    cy.get('body').then(($b) => { if ($b.find('#cd-typed').length) cy.get('#cd-typed').type('ELIMINA'); });
    cy.get('#cd-go').click();
    cy.get('#toast').should('contain', 'Spesa eliminata');
    cy.contains('Spese del periodo (1)');
    cy.contains('Spesa extra modificata').should('not.exist');
  });
});

describe('Nota spese PDF', () => {
  it('la finestra apre /api/expenses-pdf con periodo, nome e filtro rimborsi', () => {
    cy.visit('/#/cassa');
    cy.contains('button', 'Genera nota spese (PDF)').click();
    cy.get('#nt-who').should('exist');
    cy.get('#nt-reimb').should('not.be.checked');
    cy.get('#nt-who').clear().type('Christian Pecoraro');
    cy.get('#nt-ok').click();
    cy.window().its('__opened').should('have.length', 1).then((o) => {
      const u = new URL(o[0], 'http://x');
      expect(u.pathname).to.eq('/api/expenses-pdf');
      expect(u.searchParams.get('from')).to.eq(today());
      expect(u.searchParams.get('to')).to.eq(today());
      expect(u.searchParams.get('who')).to.eq('Christian Pecoraro');
      expect(u.searchParams.has('reimbursable')).to.eq(false);
    });
    cy.contains('button', 'Genera nota spese (PDF)').click();
    cy.get('#nt-reimb').check();
    cy.get('#nt-ok').click();
    cy.window().its('__opened').should('have.length', 2).then((o) => {
      const u = new URL(o[1], 'http://x');
      expect(u.searchParams.get('reimbursable')).to.eq('1');
      expect(u.searchParams.get('who')).to.eq('Christian Pecoraro');
    });
  });

  it('l\'endpoint restituisce un vero PDF', () => {
    [`/api/expenses-pdf?from=${today()}&to=${today()}&who=Christian`, `/api/expenses-pdf?from=${today()}&to=${today()}&reimbursable=1`].forEach((url) => {
      cy.request({ url, encoding: 'binary' }).then((r) => {
        expect(r.status).to.eq(200);
        expect(r.headers['content-type']).to.contain('application/pdf');
        expect(r.body.slice(0, 5)).to.eq('%PDF-');
      });
    });
  });
});

describe('Dati demo e spese', () => {
  it('con i demo la Cassa a 30 giorni mostra le spese e il PDF si genera', () => {
    cy.visit('/#/impostazioni');
    cy.contains('button', 'Carica i dati demo').click();
    cy.contains('button', 'Elimina i dati demo');
    cy.visit('/#/cassa?days=30');
    cy.contains('Bolletta energia elettrica (DEMO)');
    cy.contains('Ordine display e batterie (DEMO)');
    cy.contains('Spese del periodo (').invoke('text').then((t) => expect(Number(/\((\d+)\)/.exec(t)[1])).to.be.greaterThan(5));
    cy.contains('button', 'Genera nota spese (PDF)').click();
    cy.get('#nt-ok').click();
    cy.window().its('__opened').should('have.length', 1).then((o) => {
      const u = new URL(o[0], 'http://x');
      cy.request({ url: u.pathname + u.search, encoding: 'binary' }).then((r) => {
        expect(r.status).to.eq(200);
        expect(r.headers['content-type']).to.contain('application/pdf');
        expect(r.body.slice(0, 5)).to.eq('%PDF-');
      });
    });
  });

  it('eliminando i demo spariscono anche le spese demo, non le vere', () => {
    cy.visit('/#/impostazioni');
    cy.get('#view').contains('button', 'Elimina i dati demo').click();
    cy.get('#cd-go').click();
    cy.get('body').then(($b) => { if ($b.find('#cd-typed').length) cy.get('#cd-typed').type('ELIMINA'); });
    cy.get('#cd-go').click();
    cy.contains('button', 'Carica i dati demo');
    cy.visit('/#/cassa?days=30');
    cy.contains('Cartucce per la stampante');
    cy.contains('(DEMO)').should('not.exist');
    cy.contains('Spese del periodo (1)');
  });
});
