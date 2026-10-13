// Genera le schermate del manuale per Christian con dati di esempio realistici (DB isolato).
// Uso:  npm run test:e2e -- --spec cypress/tools/manuale-screens.cy.js
// Poi copiare cypress/screenshots/manuale-screens.cy.js/*.png in officina/public/manuale/.
const api = (method, url, body) => cy.request({ method, url, body });
const ids = {};
let tokenApprova;

const advanceTo = (id, steps) => { for (let i = 0; i < steps; i++) api('POST', `/api/repairs/${id}/advance`); };
const make = (key, data) => api('POST', '/api/repairs', { deposit: 0, ...data }).then((r) => { ids[key] = r.body; return r.body; });

describe('Schermate per il manuale', () => {
  before(() => {
    // magazzino e fornitori
    api('POST', '/api/suppliers', { name: 'Ricambi Napoli Srl', phone: '081 555 0101', email: 'ordini@ricambinapoli.example' }).then((s) => {
      const sid = s.body.id;
      api('POST', '/api/suppliers', { name: 'Tech Parts Salerno', phone: '089 555 0202' });
      api('POST', '/api/products', { name: 'Display iPhone 13 (OLED)', category: 'Ricambi', qty: 1, min_qty: 2, cost: 62, price: 129, supplier_id: sid, location: 'Cassetto A2' });
      api('POST', '/api/products', { name: 'Batteria Samsung A54', category: 'Ricambi', qty: 6, min_qty: 2, cost: 14, price: 49, supplier_id: sid });
      api('POST', '/api/products', { name: 'Connettore di carica USB-C', category: 'Ricambi', qty: 0, min_qty: 3, cost: 3, price: 25, supplier_id: sid });
      api('POST', '/api/products', { name: 'Cavo USB-C 1 m', category: 'Cavi e caricatori', qty: 12, min_qty: 4, cost: 1.2, price: 9.9 });
      api('POST', '/api/products', { name: 'Caricatore rapido 20W', category: 'Cavi e caricatori', qty: 8, min_qty: 3, cost: 5, price: 19.9 });
    });

    // riparazioni in stati diversi
    make('pronta', { customer: { name: 'Marco Esposito', phone: '333 111 2233' }, brand_model: 'iPhone 13', problem: 'Schermo rotto', accessories: 'Cover', quote: 129, deposit: 30, eta_date: '2030-01-10' })
      .then((r) => { api('POST', `/api/repairs/${r.id}/status`, { status: 'diagnosing' }); api('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' }); api('POST', `/api/repairs/${r.id}/status`, { status: 'repairing' }); api('POST', `/api/repairs/${r.id}/status`, { status: 'ready' }); });
    make('lavori', { customer: { name: 'Anna Greco', phone: '347 222 3344' }, brand_model: 'Samsung Galaxy A54', problem: 'Batteria che dura poco', accessories: 'Caricatore', quote: 69, deposit: 20, eta_date: '2030-01-12', quote_agreed: true })
      .then((r) => { api('POST', `/api/repairs/${r.id}/status`, { status: 'repairing' }); api('POST', `/api/repairs/${r.id}/note`, { note: 'Batteria nuova montata, stiamo facendo i test di carica.', public: true }); });
    make('approva', { customer: { name: 'Luigi Ferrara', phone: '320 333 4455', email: 'luigi.ferrara@example.com' }, brand_model: 'HP Pavilion 15', problem: 'Lento e rumoroso: pulizia e SSD', accessories: 'Alimentatore, borsa', condition_notes: 'Graffi sul coperchio', quote: 95, deposit: 0, eta_date: '2030-01-15' })
      .then((r) => { tokenApprova = r.token; api('POST', `/api/repairs/${r.id}/status`, { status: 'diagnosing' }); api('POST', `/api/repairs/${r.id}/status`, { status: 'quote_pending' }); });
    make('ritardo', { customer: { name: 'Sara Romano', phone: '338 444 5566' }, brand_model: 'iPad Air 4', problem: 'Non si accende', quote: 85, eta_date: '2020-01-01' })
      .then((r) => api('POST', `/api/repairs/${r.id}/status`, { status: 'waiting_parts', note: 'Attendiamo il ricambio dal fornitore.' }));
    make('nuova', { customer: { name: 'Giovanni Russo', phone: '349 555 6677' }, brand_model: 'PlayStation 5', problem: 'Lettore disco non legge' });

    // una vendita per la cassa
    api('GET', '/api/products?q=Cavo').then((p) => api('POST', '/api/sales', { items: [{ product_id: p.body[0].id, qty: 2 }, { name: 'Pulizia software', unit_price: 15 }], method: 'carta' }));
  });

  it('desktop: oggi, riparazioni, magazzino, cassa', () => {
    cy.viewport(1280, 860);
    cy.visit('/#/oggi');
    cy.get('#view').should('contain', 'Pronte: avvisa il cliente');
    cy.screenshot('01-oggi', { capture: 'viewport' });
    cy.visit('/#/riparazioni');
    cy.get('#view').should('contain', 'iPad Air 4');
    cy.screenshot('02-riparazioni', { capture: 'viewport' });
    cy.visit('/#/magazzino?tab=reorder');
    cy.get('#view').should('contain', 'Ordina su WhatsApp');
    cy.screenshot('03-da-ordinare', { capture: 'viewport' });
    cy.visit('/#/cassa');
    cy.get('#view').should('contain', 'Incassato nel periodo');
    cy.screenshot('04-cassa', { capture: 'viewport' });
  });

  it('desktop: accettazione, scheda creata, dettaglio', () => {
    cy.viewport(1280, 860);
    cy.visit('/');
    cy.get('#top-new').click();
    cy.get('#rf-name').type('Elena Caputo');
    cy.get('#rf-phone').type('338 777 8899');
    cy.get('#rf-model').type('iPhone 12');
    cy.get('#rf-problems .chip').contains('Schermo rotto').click();
    cy.get('#rf-problems .chip').contains('Batteria').click();
    cy.get('#rf-acc .chip').contains('Cover').click();
    cy.get('#rf-cond .chip').contains('Graffi').click();
    cy.get('#rf-quote').type('119');
    cy.get('#rf-deposit').type('30');
    cy.get('#rf-eta .chip').contains('+3 giorni').click();
    cy.screenshot('05-nuova-riparazione', { capture: 'viewport' });
    cy.get('#rf-save').click();
    cy.get('img[alt="QR tracciamento"]').should('be.visible');
    cy.wait(300);
    cy.screenshot('06-scheda-creata', { capture: 'viewport' });
    cy.contains('button', 'Fatto').click();
    cy.visit('/#/riparazioni');
    cy.contains('[data-open]', 'Samsung Galaxy A54').click();
    cy.contains('Cronologia');
    cy.screenshot('07-dettaglio', { capture: 'viewport' });
  });

  it('schede di stampa: cliente e laboratorio', () => {
    cy.viewport(860, 1220);
    cy.request('/api/repairs?q=Anna').then((r) => {
      const id = r.body[0].id;
      cy.request('POST', `/api/repairs/${id}/parts`, { name: 'Batteria Samsung A54', qty: 1, unit_price: 49 });
      cy.request('PATCH', `/api/repairs/${id}`, { passcode: '4821', tech_notes: 'Batteria gonfia, rimossa. Test di carica ok.', urgent: true });
      cy.visit(`/print/customer/${id}?noprint=1`);
      cy.get('img[alt="QR"]').should(($i) => expect($i[0].naturalWidth).to.be.greaterThan(0));
      cy.screenshot('12-scheda-cliente', { capture: 'fullPage' });
      cy.visit(`/print/lab/${id}?noprint=1`);
      cy.get('img[alt="QR"]').should(($i) => expect($i[0].naturalWidth).to.be.greaterThan(0));
      cy.screenshot('13-scheda-laboratorio', { capture: 'fullPage' });
    });
  });

  it('desktop: vendita al banco', () => {
    cy.viewport(1280, 860);
    cy.visit('/#/vendite');
    cy.get('#s-q').type('Caricatore');
    cy.contains('[data-add]', 'Caricatore rapido 20W').click();
    cy.get('#s-q').type('Cavo');
    cy.contains('[data-add]', 'Cavo USB-C').click();
    cy.get('#s-free').type('Installazione e configurazione');
    cy.get('#s-free-p').type('10');
    cy.get('#s-free-add').click();
    cy.get('#s-total').should('be.visible');
    cy.screenshot('08-vendite', { capture: 'viewport' });
  });

  it('telefono: vista del cliente e vista del negozio', () => {
    cy.viewport(390, 844);
    cy.request('/api/repairs?q=Anna').then((r) => cy.visit(`/t/${r.body[0].token}`));
    cy.get('.status').should('contain', 'In riparazione');
    cy.wait(900);
    cy.screenshot('09-cliente-lavori', { capture: 'viewport' });
    cy.visit(`/t/${tokenApprova}`);
    cy.contains('Serve la tua conferma');
    cy.screenshot('10-cliente-approva', { capture: 'viewport' });
    cy.visit('/#/oggi');
    cy.get('#view').should('contain', 'Pronte: avvisa il cliente');
    cy.screenshot('11-telefono-oggi', { capture: 'viewport' });
  });
});
