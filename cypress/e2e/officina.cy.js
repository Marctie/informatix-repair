// Flusso completo del gestionale officina, dal punto di vista di Christian e del cliente.
// I test sono in sequenza: ognuno usa i dati creati dai precedenti (DB isolato, vedi cypress/run.mjs).
let token;

describe('Gestionale officina', () => {
  it('mostra la dashboard vuota con il pulsante di accettazione', () => {
    cy.visit('/#/oggi');
    cy.contains('h1', 'Oggi');
    cy.contains('Nessuna riparazione aperta');
    cy.get('#top-new').should('be.visible');
    cy.get('#nav a').should('have.length', 34); // 33 sezioni (menu a gruppi, amministratore, con Categorie) + Manuale
  });

  it('crea un fornitore e un articolo di magazzino', () => {
    cy.visit('/#/fornitori');
    cy.contains('button', 'Nuovo fornitore').click();
    cy.get('#sf-name').type('Ricambi Napoli');
    cy.get('#sf-phone').type('0811234567');
    cy.get('#sf-ok').click();
    cy.contains('Ricambi Napoli');

    cy.visit('/#/magazzino');
    cy.contains('button', 'Nuovo articolo').click();
    cy.get('#pf-name').type('Display iPhone 13');
    cy.get('#pf-cat').type('Ricambi');
    cy.get('#pf-qty').clear().type('3');
    cy.get('#pf-min').clear().type('2');
    cy.get('#pf-cost').type('60');
    cy.get('#pf-price').type('129');
    cy.get('#pf-sup').select('Ricambi Napoli');
    cy.get('#pf-ok').click();
    cy.contains('tr', 'Display iPhone 13').should('contain', '3 pz');
  });

  it('accettazione veloce: scheda, QR e link di tracciamento', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-name').type('Mario Rossi');
    cy.get('#rf-phone').type('3331234567');
    cy.get('#rf-types .chip').contains('Smartphone').should('have.class', 'on');
    cy.get('#rf-model').type('iPhone 13');
    cy.get('#rf-problems .chip').contains('Schermo rotto').click();
    cy.get('#rf-problem').should('have.value', 'Schermo rotto');
    cy.get('#rf-acc .chip').contains('Cover').click();
    cy.get('#rf-cond .chip').contains('Graffi').click();
    cy.get('#rf-pass').type('4321');
    cy.get('#rf-quote').type('129');
    cy.get('#rf-deposit').type('30');
    cy.get('#rf-eta .chip').contains('+3 giorni').click();
    cy.get('#rf-etadate').invoke('val').should('match', /^\d{4}-\d{2}-\d{2}$/);
    cy.get('#rf-save').click();

    cy.contains('Riparazione registrata');
    cy.contains(/R-\d{4}-0001/);
    cy.get('img[alt="QR tracciamento"]').should('be.visible').and(($img) => expect($img[0].naturalWidth).to.be.greaterThan(0));
    cy.contains('Stampa scheda cliente + laboratorio').should('have.attr', 'href').and('match', /\/print\/both\/\d+/);
    cy.contains('Solo scheda cliente').should('have.attr', 'href').and('match', /\/print\/customer\/\d+/);
    cy.contains('Solo scheda laboratorio').should('have.attr', 'href').and('match', /\/print\/lab\/\d+/);
    cy.get('.break-all').invoke('text').then((t) => {
      expect(t).to.match(/\/t\/[\w-]{12}$/);
      token = t.trim().split('/t/')[1];
    });
    cy.contains('button', 'Fatto').click();
    cy.contains('Mario Rossi');
  });

  it('validazione: senza nome, modello e problema non salva', () => {
    cy.visit('/#/oggi');
    cy.get('#top-new').click();
    cy.get('#rf-save').click();
    cy.get('#toast').should('be.visible').and('contain', 'manca il nome');
    cy.get('.modal-bg [data-close]').first().click();
  });

  it('il cliente vede il tracciamento senza dati riservati', () => {
    cy.visit(`/t/${token}`);
    cy.contains('.status', 'Ricevuto');
    cy.get('.bar > i').should('have.attr', 'style').and('include', 'width:0%');
    cy.contains('iPhone 13');
    cy.contains('Schermo rotto');
    cy.contains('129,00').should('exist');
    cy.contains('Consegna stimata');
    cy.contains('Mario Rossi');
    cy.get('body').should('not.contain', '4321').and('not.contain', '3331234567');
    cy.contains('Aggiornamento automatico');
    cy.visit('/t/codice-finto');
    cy.contains('Link non valido');
  });

  it('flusso: avanza, il cliente approva il preventivo dal link', () => {
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'iPhone 13').within(() => {
      cy.contains('button', 'In diagnosi →').click();
    });
    cy.contains('[data-open]', 'iPhone 13').within(() => {
      cy.contains('button', 'Preventivo da approvare →').click();
    });
    cy.contains('[data-open]', 'iPhone 13').should('contain', 'Preventivo da approvare');

    // lato cliente
    cy.visit(`/t/${token}`);
    cy.contains('Serve la tua conferma');
    cy.contains('button', 'Sì, procedi').click();
    cy.get('#sh-next').click();
    // la risposta del cliente si firma col dito: si disegna un tratto nel riquadro
    cy.get('#sg-canvas').then(($c) => {
      const r = $c[0].getBoundingClientRect();
      cy.wrap($c).trigger('pointerdown', { pointerId: 1, button: 0, clientX: r.left + 20, clientY: r.top + 60, force: true });
      for (let i = 1; i <= 8; i++) cy.wrap($c).trigger('pointermove', { pointerId: 1, clientX: r.left + 20 + i * 14, clientY: r.top + 40 + (i % 3) * 25, force: true });
      cy.wrap($c).trigger('pointerup', { pointerId: 1, force: true });
    });
    cy.get('#sh-go').should('not.be.disabled').click();
    cy.contains('Preventivo confermato');
    cy.get('#sh-ok').click();
    cy.contains('.status', 'Preventivo approvato');
    cy.get('.ask').should('not.exist');

    // lato negozio: stato aggiornato e visibile nella cronologia
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'iPhone 13').should('contain', 'Preventivo approvato').click();
    cy.contains('Preventivo approvato dal cliente online');
  });

  it('ricambio dal magazzino: scala la giacenza; nota pubblica visibile al cliente', () => {
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'iPhone 13').click();
    cy.get('#d-part').type('Display');
    cy.contains('[data-pid]', 'Display iPhone 13').click();
    cy.contains('Ricambio usato');
    cy.get('#d-cnote').type('Display montato, stiamo testando');
    cy.get('[data-act="savecnote"]').click();
    cy.get('#toast').should('contain', 'Messaggio aggiornato');
    cy.get('.modal-bg [data-close]').first().click();

    cy.visit('/#/magazzino');
    cy.contains('tr', 'Display iPhone 13').should('contain', '2 pz').and('contain', 'basso');
    cy.contains('[data-t]', 'Da ordinare').click();
    cy.contains('Ricambi Napoli');
    cy.contains('Ordina su WhatsApp').should('have.attr', 'href').and('include', 'wa.me');

    cy.visit(`/t/${token}`);
    cy.contains('Display montato, stiamo testando');
  });

  it('consegna e incasso: saldo = preventivo - acconto, compare in cassa con la garanzia', () => {
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'iPhone 13').within(() => {
      cy.contains('button', 'In riparazione →').click();
    });
    cy.contains('[data-open]', 'iPhone 13').within(() => {
      cy.contains('button', 'Pronto per il ritiro →').click();
    });
    // pronta: appare tra "Pronte: avvisa il cliente" con WhatsApp
    cy.visit('/#/oggi');
    cy.contains('section', 'Pronte').within(() => {
      cy.get('a[href*="wa.me"]').should('have.attr', 'href').and('include', 'pronto');
    });
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'iPhone 13').within(() => {
      cy.contains('button', 'Consegnato →').click();
    });
    cy.get('#dl-final').should('have.value', '129');
    cy.get('#dl-ok').click();
    cy.get('#toast').should('contain', '99,00');
    cy.visit('/#/cassa');
    cy.contains('129,00');
    cy.contains('Acconto R-');
    cy.contains('Saldo R-');
    cy.visit(`/t/${token}`);
    cy.contains('.status', 'Consegnato');
    cy.contains('garanzia di 90 giorni');
    cy.get('.bar').should('have.class', 'done');
  });

  it('vendita al banco: cerca articolo, sconto, incasso e stampa', () => {
    cy.visit('/#/magazzino');
    cy.contains('button', 'Nuovo articolo').click();
    cy.get('#pf-name').type('Cavo USB-C');
    cy.get('#pf-qty').clear().type('5');
    cy.get('#pf-price').type('9,90');
    cy.get('#pf-ok').click();

    cy.visit('/#/vendite');
    cy.get('#s-q').type('Cavo');
    cy.contains('[data-add]', 'Cavo USB-C').click();
    cy.contains('[data-q]', '+').click();
    cy.get('#s-free').type('Pulizia software');
    cy.get('#s-free-p').type('15');
    cy.get('#s-free-add').click();
    cy.get('#s-disc').clear().type('4,80');
    cy.get('#s-total').should('contain', '30,00');
    cy.get('#s-method').select('carta');
    cy.get('#s-pay').click();
    cy.get('#toast').should('contain', 'Venduto');
    cy.window().its('__opened.0').should('match', /\/print\/sale\/\d+/);
    cy.contains('#s-recent', /V-\d{4}-0001/);

    cy.visit('/#/magazzino');
    cy.contains('tr', 'Cavo USB-C').should('contain', '3 pz');
    cy.visit('/#/cassa');
    cy.contains('carta');
  });

  it('clienti: ricerca e storico', () => {
    cy.visit('/#/clienti');
    cy.get('#c-q').type('Rossi');
    cy.contains('[data-id]', 'Mario Rossi').should('contain', '1 riparazione').click();
    cy.contains('Riparazioni (1)');
    cy.contains('iPhone 13');
  });

  it('impostazioni: salva l’indirizzo pubblico e lo usa nei link', () => {
    cy.visit('/#/impostazioni');
    cy.get('[data-k="public_base_url"]').type('https://riparazioni.example.it');
    cy.get('#st-save').click();
    cy.get('#toast').should('contain', 'salvate');
    cy.request('/api/meta').its('body.track_base').should('eq', 'https://riparazioni.example.it');
  });

  it('il server pubblico non espone il gestionale', () => {
    cy.request({ url: 'http://127.0.0.1:4961/api/customers', failOnStatusCode: false }).its('status').should('eq', 404);
    cy.request({ url: `http://127.0.0.1:4961/api/track/${token}` }).its('body.code').should('match', /^R-/);
    cy.request({ url: 'http://127.0.0.1:4961/', failOnStatusCode: false }).its('status').should('eq', 404);
  });

  it('mobile: la pagina cliente è leggibile senza scorrimento orizzontale', () => {
    cy.viewport('iphone-6');
    cy.visit(`/t/${token}`);
    cy.contains('.status', 'Consegnato');
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(d.documentElement.clientWidth));
  });
});
