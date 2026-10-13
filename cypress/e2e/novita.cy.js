// Novità del 2026-10-13/14: dati demo, avvisi (campanella), Analisi, Utenti, pagamento "non tracciato".
const api = (method, url, body) => cy.request({ method, url, body, failOnStatusCode: false });

describe('Dati demo', () => {
  it('si caricano dalle Impostazioni e riempiono tutto il gestionale', () => {
    cy.visit('/#/impostazioni');
    cy.contains('h2', 'Dati demo');
    cy.contains('button', 'Carica i dati demo').click();
    cy.contains('button', 'Elimina i dati demo');
    cy.contains('Presenti: 8 clienti, 14 riparazioni, 13 vendite');
    cy.visit('/#/riparazioni?all=1');
    cy.contains('iPhone 13');
    cy.visit('/#/clienti');
    cy.contains('Giulia Esposito');
    cy.visit('/#/magazzino');
    cy.contains('Display iPhone 13 (DEMO)');
  });
});

describe('Avvisi e campanella', () => {
  it('la campanella mostra il numero e l’elenco degli avvisi', () => {
    cy.visit('/#/oggi');
    cy.get('#bell-n').should('be.visible').invoke('text').then((t) => expect(Number(t)).to.be.greaterThan(0));
    cy.contains('h3', 'Avvisi');
    cy.get('#bell').click();
    cy.get('#modal-root').within(() => {
      cy.contains('Connettore ricarica USB-C (DEMO): esaurito');
      cy.contains('Tastiera portatile ASUS (DEMO): fermo da');
    });
  });

  it('cliccando un avviso si apre la pagina giusta e la finestra si chiude', () => {
    cy.visit('/#/oggi');
    cy.get('#bell').click();
    cy.get('#modal-root').contains('a', 'esaurito').click();
    cy.location('hash').should('contain', '#/magazzino');
    cy.get('#modal-root').children().should('have.length', 0);
  });

  it('le soglie si cambiano da Impostazioni → Avvisi e spengono gli avvisi', () => {
    cy.visit('/#/impostazioni');
    cy.contains('h2', 'Avvisi');
    cy.get('#st-sd').clear().type('0');
    cy.get('#st-save').click();
    cy.contains('Impostazioni salvate');
    api('GET', '/api/alerts').its('body.items').should((items) => expect(items.some((i) => i.type === 'stale')).to.equal(false));
    cy.get('#st-sd').clear().type('90');
    cy.get('#st-save').click();
    api('GET', '/api/alerts').its('body.items').should((items) => expect(items.some((i) => i.type === 'stale')).to.equal(true));
  });
});

describe('Analisi', () => {
  it('ha le quattro schede con dati veri', () => {
    cy.visit('/#/analisi');
    cy.contains('h1', 'Analisi');
    cy.contains('Riparazioni accettate');
    cy.contains('Modelli più riparati');
    cy.contains('button', 'Incassi').click();
    cy.contains('Incassato nel periodo');
    cy.contains('Margine');
    cy.contains('Per metodo di pagamento');
    cy.contains('button', 'Vendite').click();
    cy.contains('Scontrino medio');
    cy.contains('Prodotti più venduti');
    cy.contains('button', 'Magazzino').click();
    cy.contains('Valore a costo');
    cy.contains('Fermi da troppo tempo');
  });

  it('il periodo si cambia con le scorciatoie e con le date', () => {
    cy.visit('/#/analisi?tab=incassi');
    cy.contains('.chip', 'Oggi').click();
    cy.get('#an-from').should('not.have.value', '');
    cy.get('#an-to').should('not.have.value', '');
    cy.contains('.chip', 'Anno').click();
    cy.contains('Incassato nel periodo');
  });
});

describe('Utenti', () => {
  it('l’amministratore aggiunge, modifica ed elimina un utente', () => {
    cy.visit('/#/utenti');
    cy.contains('Proprietario').should('not.exist'); // in locale il proprietario non c'è finché non lo crea il Worker
    cy.contains('button', 'Nuovo utente').click();
    cy.get('#ue-email').type('cassa@example.com');
    cy.get('#ue-name').type('Cassa');
    cy.get('#ue-ok').click();
    cy.contains('cassa@example.com');
    cy.contains('[data-id]', 'cassa@example.com').find('[data-edit]').click();
    cy.get('#ue-role').select('admin');
    cy.get('#ue-ok').click();
    cy.contains('[data-id]', 'cassa@example.com').should('contain', 'Amministratore');
    cy.on('window:confirm', () => true);
    cy.contains('[data-id]', 'cassa@example.com').find('[data-edit]').click();
    cy.get('#ue-del').click();
    cy.contains('cassa@example.com').should('not.exist');
  });

  it('rifiuta email non valide', () => {
    cy.visit('/#/utenti');
    cy.contains('button', 'Nuovo utente').click();
    cy.get('#ue-email').type('non-valida');
    cy.get('#ue-ok').click();
    cy.contains('Email non valida');
  });
});

describe('Pagamento "non tracciato"', () => {
  it('si sceglie su vendite e consegne; l’impostazione lo esclude dalla cassa', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-method').find('option').then((o) => expect([...o].map((x) => x.textContent)).to.include('non tracciato'));
    cy.get('#modal-root [data-close]').first().click({ force: true });
    api('POST', '/api/sales', { items: [{ name: 'Prova', unit_price: 100 }], method: 'non tracciato' });
    cy.visit('/#/cassa');
    cy.contains('non tracciato');
    cy.visit('/#/impostazioni');
    cy.get('#st-untr').select('0');
    cy.get('#st-save').click();
    cy.contains('Impostazioni salvate');
    cy.visit('/#/cassa');
    cy.contains('non è conteggiato');
  });

  it('ripristino: i dati demo si eliminano senza toccare i dati veri', () => {
    api('POST', '/api/customers', { name: 'Cliente Vero', phone: '3330001234' });
    cy.visit('/#/impostazioni');
    cy.get('#st-untr').select('1');
    cy.get('#st-save').click();
    cy.on('window:confirm', () => true);
    cy.contains('button', 'Elimina i dati demo').click();
    cy.contains('button', 'Carica i dati demo');
    cy.visit('/#/clienti');
    cy.contains('Cliente Vero');
    cy.contains('Giulia Esposito').should('not.exist');
  });
});
