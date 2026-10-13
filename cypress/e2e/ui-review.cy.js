// Rassegna visiva: apre OGNI pagina e OGNI finestra del gestionale su telefono, tablet e desktop e le fotografa.
// Controlla anche in automatico i difetti grafici elementari:
//  - nessuno scorrimento orizzontale della pagina o dei contenuti delle finestre
//  - nessun elemento che esce dal bordo dello schermo
//  - nessun testo o campo che si sovrappone a un altro (rettangoli che si intersecano tra elementi "fratelli")
//  - nessun campo di testo più stretto di 80 px o troppo basso per un dito (44 px sul telefono)
// Uso:  npm run test:e2e -- --spec cypress/e2e/ui-review.cy.js     (le immagini finiscono in cypress/screenshots)
const api = (method, url, body) => cy.request({ method, url, body });
const VIEWPORTS = [['small', 320, 640], ['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1280, 860], ['wide', 1536, 864]];

// Verifiche geometriche sul contenuto visibile di una radice (pagina o finestra)
function checkLayout(rootSel, vpWidth, label) {
  cy.get(rootSel).then(($root) => {
    const win = $root[0].ownerDocument.defaultView;
    const problems = [];
    const rootRect = $root[0].getBoundingClientRect();
    const all = [...$root[0].querySelectorAll('*')].filter((el) => {
      const cs = win.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('.hidden') && !el.closest('svg') && !el.closest('[aria-hidden="true"]');
    });
    // 1) niente esce dal bordo destro dello schermo
    all.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (el.closest('.tbl-wrap, .overflow-x-auto, .overflow-auto, .chips-scroll, .scroll')) return;
      if (r.right > vpWidth + 1) problems.push(`fuori schermo: <${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}> "${(el.textContent || '').trim().slice(0, 30)}" right=${Math.round(r.right)}`);
    });
    // 2) campi: larghezza e altezza minime
    all.filter((el) => el.matches('input:not([type=checkbox]):not([type=radio]),select,textarea')).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 70) problems.push(`campo troppo stretto: #${el.id || el.name || el.placeholder} ${Math.round(r.width)}px`);
      if (vpWidth < 600 && r.height < 38) problems.push(`campo troppo basso per un dito: #${el.id || el.placeholder} ${Math.round(r.height)}px`);
    });
    // 3) sovrapposizioni tra elementi di contenuto fratelli (testi/campi/pulsanti uno sopra l'altro)
    const leafy = all.filter((el) => el.matches('input,select,textarea,button,a,label,p,h1,h2,h3,dt,dd,.badge,.chip,span') && !el.closest('.suggest'));
    const byParent = new Map();
    leafy.forEach((el) => { const p = el.parentElement; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(el); });
    byParent.forEach((els, parent) => {
      const pcs = win.getComputedStyle(parent);
      if (pcs.position === 'absolute' || pcs.display === 'inline') return;
      for (let i = 0; i < els.length; i++) {
        for (let k = i + 1; k < els.length; k++) {
          const a = els[i].getBoundingClientRect();
          const b = els[k].getBoundingClientRect();
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 3 && oy > 3 && !els[i].contains(els[k]) && !els[k].contains(els[i])) {
            const cs = win.getComputedStyle(els[k]);
            if (cs.position === 'absolute' || cs.position === 'fixed') continue;
            problems.push(`sovrapposti: "${(els[i].textContent || els[i].placeholder || els[i].id || '').trim().slice(0, 24)}" e "${(els[k].textContent || els[k].placeholder || els[k].id || '').trim().slice(0, 24)}"`);
          }
        }
      }
    });
    // 4) contenuto che esce dal contenitore a destra (tranne aree scorrevoli)
    all.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (el.closest('.tbl-wrap, .overflow-x-auto, .chips-scroll, .scroll')) return;
      if (r.right > rootRect.right + 2 && rootRect.width > 0) problems.push(`esce dal contenitore: <${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 24)}"`);
    });
    // 5) QUALITÀ DELLO STILE (errori "elementari"): testo attaccato al bordo, caratteri minuscoli, altezze incoerenti, spazi irregolari
    const px = (v) => parseFloat(v) || 0;
    all.filter((el) => el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')).forEach((el) => {
      const cs = win.getComputedStyle(el);
      const name = `#${el.id || el.name || el.placeholder}`;
      if (px(cs.paddingLeft) < 10) problems.push(`testo attaccato al bordo sinistro nel campo ${name} (padding ${cs.paddingLeft})`);
      if (el.tagName !== 'TEXTAREA' && px(cs.paddingTop) < 6) problems.push(`campo ${name} senza spazio sopra/sotto il testo (padding ${cs.paddingTop})`);
      if (px(cs.fontSize) < 14) problems.push(`testo troppo piccolo nel campo ${name} (${cs.fontSize})`);
      if (px(cs.borderTopWidth) < 1) problems.push(`campo ${name} senza bordo`);
      if (el.tagName !== 'TEXTAREA' && el.getBoundingClientRect().height < 40) problems.push(`campo ${name} troppo basso (${Math.round(el.getBoundingClientRect().height)}px)`);
    });
    all.filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).forEach((el) => {
      const fs = px(win.getComputedStyle(el).fontSize);
      if (fs < 10 && !el.closest('kbd')) problems.push(`carattere troppo piccolo (${fs}px): "${el.textContent.trim().slice(0, 24)}"`);
    });
    // righe con campo + pulsante: stessa altezza
    $root[0].querySelectorAll('.row.nowrap').forEach((row) => {
      const hs = [...row.children].filter((c) => c.getBoundingClientRect().height > 0).map((c) => Math.round(c.getBoundingClientRect().height));
      if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 1) problems.push(`altezze diverse nella riga campo+pulsante: ${hs.join(' / ')}`);
    });
    // etichetta -> campo: distanza regolare
    $root[0].querySelectorAll('.field').forEach((f) => {
      const lab = f.querySelector(':scope > label.l');
      const ctl = f.querySelector(':scope > input:not([type=checkbox]),:scope > select,:scope > textarea,:scope > .row,:scope > .check');
      if (!lab || !ctl || lab.getBoundingClientRect().height === 0) return;
      const gap = ctl.getBoundingClientRect().top - lab.getBoundingClientRect().bottom;
      if (gap < 3 || gap > 12) problems.push(`distanza etichetta-campo irregolare (${Math.round(gap)}px): "${lab.textContent.trim().slice(0, 20)}"`);
    });
    // sezioni consecutive: spazio verticale regolare (almeno 20px, non più di 70px)
    $root[0].querySelectorAll('.sec + .sec').forEach((sec) => {
      const prev = sec.previousElementSibling;
      const gap = sec.getBoundingClientRect().top - prev.getBoundingClientRect().bottom;
      if (prev.getBoundingClientRect().height > 0 && sec.getBoundingClientRect().height > 0 && gap >= 0 && (gap < 20 || gap > 70)) problems.push(`spazio tra sezioni irregolare (${Math.round(gap)}px) prima di "${(sec.querySelector('.sec-t') || sec).textContent.trim().slice(0, 24)}"`);
    });
    // gruppi di chip / pulsanti seguiti da un'etichetta o un campo: almeno 10px di distanza
    $root[0].querySelectorAll('.row').forEach((row) => {
      const next = row.nextElementSibling;
      if (!next || row.getBoundingClientRect().height === 0 || next.getBoundingClientRect().height === 0 || row.parentElement.classList.contains('row')) return;
      const gap = next.getBoundingClientRect().top - row.getBoundingClientRect().bottom;
      if (gap >= 0 && gap < 8 && !row.closest('.nowrap')) problems.push(`elementi troppo vicini (${Math.round(gap)}px) dopo "${(row.textContent || '').trim().slice(0, 24)}"`);
    });
    expect(problems, `${label}: ${problems.length} problemi grafici\n${problems.slice(0, 12).join('\n')}`).to.have.length(0);
  });
}

const closeModal = () => cy.get('.modal-bg [data-close]').first().click();
let ids = {};

describe('Rassegna grafica di tutte le schermate', () => {
  before(() => {
    api('POST', '/api/suppliers', { name: 'Ricambi Napoli Srl', phone: '081 555 0101', email: 'ordini@ricambinapoli.example', website: 'ricambinapoli.example', notes: 'Consegna in 24 ore, minimo ordine 50 euro.' }).then((s) => {
      const sid = s.body.id;
      api('POST', '/api/suppliers', { name: 'Tech Parts Salerno', phone: '089 555 0202' });
      api('POST', '/api/products', { name: 'Display iPhone 13 (OLED) qualità originale con cornice', category: 'Ricambi', qty: 1, min_qty: 2, cost: 62, price: 129, supplier_id: sid, location: 'Cassetto A2' });
      api('POST', '/api/products', { name: 'Batteria Samsung A54', category: 'Ricambi', qty: 6, min_qty: 2, cost: 14, price: 49, supplier_id: sid });
      api('POST', '/api/products', { name: 'Cavo USB-C 1 m', category: 'Cavi e caricatori', qty: 12, min_qty: 4, cost: 1.2, price: 9.9 });
    });
    api('POST', '/api/repairs', { customer: { name: 'Marco Esposito', phone: '333 111 2233', email: 'marco.esposito@example.com' }, brand_model: 'iPhone 13 Pro Max', problem: 'Schermo rotto e batteria che dura poco, il telefono si surriscalda quando è in carica', accessories: 'Cover, Caricatore, Cavo', condition_notes: 'Graffi sul retro, angolo ammaccato', passcode: '123456', serial: '356938035643809', quote: 189, deposit: 40, eta_date: '2030-01-10', urgent: true }).then((r) => {
      ids.main = r.body;
      api('POST', `/api/repairs/${r.body.id}/status`, { status: 'repairing' });
      api('POST', `/api/repairs/${r.body.id}/parts`, { name: 'Display OLED iPhone 13 Pro Max', qty: 1, unit_price: 149 });
      api('PATCH', `/api/repairs/${r.body.id}`, { tech_notes: 'Display sostituito, batteria al 71% di salute: proposta sostituzione.', customer_note: 'Display montato, stiamo facendo i test finali.' });
      api('POST', `/api/repairs/${r.body.id}/note`, { note: 'Cliente informato per telefono.', public: false });
    });
    api('POST', '/api/repairs', { customer: { name: 'Anna Greco', phone: '347 222 3344' }, brand_model: 'Samsung Galaxy A54', problem: 'Non carica', quote: 69, eta_date: '2020-01-01' }).then((r) => { ids.late = r.body; api('POST', `/api/repairs/${r.body.id}/advance`); });
    api('POST', '/api/repairs', { customer: { name: 'Luigi Ferrara', phone: '320 333 4455' }, brand_model: 'HP Pavilion 15', problem: 'Lento', quote: 95 }).then((r) => { ids.quote = r.body; api('POST', `/api/repairs/${r.body.id}/status`, { status: 'diagnosing' }); api('POST', `/api/repairs/${r.body.id}/status`, { status: 'quote_pending' }); });
    api('POST', '/api/repairs', { customer: { name: 'Sara Romano', phone: '338 444 5566' }, brand_model: 'iPad Air 4', problem: 'Schermo', quote: 120, deposit: 20, quote_agreed: true }).then((r) => {
      ids.done = r.body;
      api('POST', `/api/repairs/${r.body.id}/status`, { status: 'ready' });
      api('POST', `/api/repairs/${r.body.id}/deliver`, { method: 'carta' });
    });
    api('POST', '/api/repairs', { customer: { name: 'Giovanni Russo', phone: '349 555 6677' }, brand_model: 'PlayStation 5', problem: 'Lettore disco non legge' });
    api('GET', '/api/products?q=Cavo').then((p) => api('POST', '/api/sales', { items: [{ product_id: p.body[0].id, qty: 2 }], method: 'carta' }));
    api('POST', '/api/customers', { name: 'Elena Caputo', phone: '338 777 8899', notes: 'Cliente affezionata, preferisce essere avvisata su WhatsApp.' });
  });

  VIEWPORTS.forEach(([vp, w, h]) => {
    context(`${vp} ${w}×${h}`, () => {
      beforeEach(() => cy.viewport(w, h));

      const page = (name, route, waitFor) => it(`pagina ${name}`, () => {
        cy.visit(`/#/${route}`);
        cy.get('#view').should('contain', waitFor);
        cy.wait(250);
        checkLayout('#view', w, `${vp}/${name}`);
        cy.screenshot(`ui-${vp}-p-${name}`, { capture: 'viewport', overwrite: true });
      });
      page('oggi', 'oggi', 'In lavorazione');
      page('riparazioni', 'riparazioni', 'Samsung Galaxy A54');
      page('clienti', 'clienti', 'Marco Esposito');
      page('magazzino', 'magazzino', 'Display iPhone 13');
      page('da-ordinare', 'magazzino?tab=reorder', 'Ordina su WhatsApp');
      page('fornitori', 'fornitori', 'Ricambi Napoli');
      page('cassa', 'cassa', 'Incassato nel periodo');
      page('impostazioni', 'impostazioni', 'Backup dei dati');

      it('pagina vendite con carrello', () => {
        cy.visit('/#/vendite');
        cy.get('#s-q').type('Cavo');
        cy.contains('[data-add]', 'Cavo USB-C').click();
        cy.get('#s-free').type('Installazione e configurazione');
        cy.get('#s-free-p').type('15');
        cy.get('#s-free-add').click();
        cy.get('#s-total').should('be.visible');
        cy.wait(200);
        checkLayout('#view', w, `${vp}/vendite`);
        cy.screenshot(`ui-${vp}-p-vendite`, { capture: 'viewport', overwrite: true });
      });

      const modal = (name, open, ready) => it(`finestra ${name}`, () => {
        cy.visit('/#/oggi');
        cy.get('#view').should('contain', 'In lavorazione');
        open();
        cy.get('.modal-body').should('contain', ready);
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/${name}`);
        cy.screenshot(`ui-${vp}-m-${name}`, { capture: 'viewport', overwrite: true });
      });
      const openNew = () => (w < 1024 ? cy.get('#nav-new').click() : cy.get('#top-new').click());
      modal('nuova-riparazione', openNew, 'Seriale / IMEI');
      it('finestra nuova-riparazione compilata + suggerimenti cliente', () => {
        cy.visit('/#/oggi');
        cy.get('#view').should('contain', 'In lavorazione');
        openNew();
        cy.get('#rf-search').type('Marco');
        cy.get('#rf-sugg').should('be.visible').and('contain', 'Marco Esposito');
        cy.wait(200);
        cy.screenshot(`ui-${vp}-m-nuova-suggerimenti`, { capture: 'viewport', overwrite: true });
        cy.get('#rf-sugg [data-id]').first().click();
        cy.get('#rf-model').type('Samsung Galaxy S23 Ultra');
        cy.get('#rf-serial').type('R58T123ABCD', { delay: 0 });
        cy.get('#rf-problems .chip').eq(0).click();
        cy.get('#rf-problems .chip').eq(1).click();
        cy.get('#rf-acc .chip').eq(0).click();
        cy.get('#rf-cond .chip').eq(0).click();
        cy.get('#rf-quote').type('120');
        cy.get('#rf-eta .chip').eq(2).click();
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/nuova-compilata`);
        cy.get('.modal-body').scrollTo('bottom');
        cy.screenshot(`ui-${vp}-m-nuova-compilata-fondo`, { capture: 'viewport', overwrite: true });
      });
      it('finestra scheda-creata', () => {
        cy.visit('/#/oggi');
        cy.get('#view').should('contain', 'In lavorazione');
        openNew();
        cy.get('#rf-name').type('Test Grafica');
        cy.get('#rf-model').type('Modello Prova');
        cy.get('#rf-problems .chip').first().click();
        cy.get('#rf-save').click();
        cy.get('img[alt="QR tracciamento"]').should('be.visible');
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/scheda-creata`);
        cy.screenshot(`ui-${vp}-m-scheda-creata`, { capture: 'viewport', overwrite: true });
      });
      it('finestra dettaglio riparazione (in corso)', () => {
        cy.visit('/#/riparazioni');
        cy.contains('[data-open]', 'iPhone 13 Pro Max').click();
        cy.get('.modal-body').should('contain', 'Cronologia');
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/dettaglio`);
        cy.screenshot(`ui-${vp}-m-dettaglio-alto`, { capture: 'viewport', overwrite: true });
        cy.get('.modal-body').scrollTo('bottom');
        cy.wait(150);
        cy.screenshot(`ui-${vp}-m-dettaglio-fondo`, { capture: 'viewport', overwrite: true });
      });
      it('finestra dettaglio riparazione consegnata', () => {
        cy.visit('/#/riparazioni?all=1');
        cy.get('#chips').contains('Tutte').click();
        cy.contains('[data-open]', 'iPad Air 4').click();
        cy.get('.modal-body').should('contain', 'Cronologia');
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/dettaglio-consegnata`);
        cy.screenshot(`ui-${vp}-m-dettaglio-consegnata`, { capture: 'viewport', overwrite: true });
      });
      it('finestra modifica dati e consegna', () => {
        cy.visit('/#/riparazioni');
        cy.contains('[data-open]', 'iPhone 13 Pro Max').click();
        cy.contains('button', 'Modifica').click();
        cy.get('#ed-ok').should('be.visible');
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/modifica-dati`);
        cy.screenshot(`ui-${vp}-m-modifica-dati`, { capture: 'viewport', overwrite: true });
        cy.get('.modal-bg [data-close]').last().click();
        cy.contains('button', 'Consegna e incassa').click();
        cy.get('#dl-ok').should('be.visible');
        cy.wait(300);
        checkLayout('.modal-panel', w, `${vp}/consegna`);
        cy.screenshot(`ui-${vp}-m-consegna`, { capture: 'viewport', overwrite: true });
      });
      it('finestre cliente: nuovo e dettaglio', () => {
        cy.visit('/#/clienti');
        cy.contains('button', 'Nuovo cliente').click();
        cy.get('#ce-name').should('be.visible');
        cy.wait(250);
        checkLayout('.modal-panel', w, `${vp}/nuovo-cliente`);
        cy.screenshot(`ui-${vp}-m-nuovo-cliente`, { capture: 'viewport', overwrite: true });
        closeModal();
        cy.contains('[data-id]', 'Marco Esposito').click();
        cy.get('.modal-body').should('contain', 'Riparazioni (');
        cy.wait(250);
        checkLayout('.modal-panel', w, `${vp}/cliente`);
        cy.screenshot(`ui-${vp}-m-cliente`, { capture: 'viewport', overwrite: true });
      });
      it('finestre magazzino e fornitori', () => {
        cy.visit('/#/magazzino');
        cy.contains('[data-id]:visible', 'Display iPhone 13').click();
        cy.get('#pf-ok').should('be.visible');
        cy.wait(250);
        checkLayout('.modal-panel', w, `${vp}/articolo`);
        cy.screenshot(`ui-${vp}-m-articolo`, { capture: 'viewport', overwrite: true });
        closeModal();
        cy.visit('/#/fornitori');
        cy.contains('[data-id]', 'Ricambi Napoli').click();
        cy.get('#sf-ok').should('be.visible');
        cy.wait(250);
        checkLayout('.modal-panel', w, `${vp}/fornitore`);
        cy.screenshot(`ui-${vp}-m-fornitore`, { capture: 'viewport', overwrite: true });
      });
      it('ricerca globale e codice sconosciuto', () => {
        cy.visit('/#/oggi');
        cy.get('#view').should('contain', 'In lavorazione');
        cy.get('#gsearch').type('Esposito');
        cy.get('#gsearch-res').should('be.visible');
        cy.wait(200);
        cy.screenshot(`ui-${vp}-m-ricerca`, { capture: 'viewport', overwrite: true });
        cy.get('#gsearch').clear();
        cy.get('body').type('ZZ12345678', { delay: 0 }).type('{enter}');
        cy.contains('Nessuna riparazione con il codice');
        cy.wait(200);
        checkLayout('.modal-panel', w, `${vp}/codice-sconosciuto`);
        cy.screenshot(`ui-${vp}-m-codice-sconosciuto`, { capture: 'viewport', overwrite: true });
      });
      it('pagina del cliente (tracciamento)', () => {
        cy.visit(`/t/${ids.main.token}`);
        cy.get('.status').should('be.visible');
        cy.wait(900);
        checkLayout('main', w, `${vp}/tracciamento`);
        cy.screenshot(`ui-${vp}-t-lavori`, { capture: 'viewport', overwrite: true });
        cy.visit(`/t/${ids.quote.token}`);
        cy.contains('Serve la tua conferma');
        cy.wait(900);
        checkLayout('main', w, `${vp}/tracciamento-approva`);
        cy.screenshot(`ui-${vp}-t-approva`, { capture: 'viewport', overwrite: true });
      });
      it('pagina del cliente: riparazione consegnata', () => {
        cy.visit(`/t/${ids.done.token}`);
        cy.get('.status').should('contain', 'Consegnato');
        cy.wait(900);
        checkLayout('main', w, `${vp}/tracciamento-consegnata`);
        cy.screenshot(`ui-${vp}-t-consegnata`, { capture: 'viewport', overwrite: true });
      });
      if (vp === 'desktop') {
        it('documenti di stampa (cliente, laboratorio, etichetta, vendita)', () => {
          cy.viewport(860, 1220);
          const shots = (url, name, ready) => { cy.visit(url); cy.get(ready).should(($i) => expect($i[0].naturalWidth).to.be.greaterThan(0)); cy.screenshot(name, { capture: 'fullPage', overwrite: true }); };
          shots(`/print/customer/${ids.main.id}?noprint=1`, 'ui-print-cliente', 'img[alt="QR"]');
          shots(`/print/lab/${ids.main.id}?noprint=1`, 'ui-print-laboratorio', 'img[alt="QR"]');
          cy.viewport(420, 220);
          shots(`/print/label/${ids.main.id}?noprint=1`, 'ui-print-etichetta', 'img[alt="QR"]');
        });
      }
      it('manuale', () => {
        cy.visit('/manuale.html');
        cy.contains('h2', 'Foglio rapido');
        checkLayout('main', w, `${vp}/manuale`);
        cy.screenshot(`ui-${vp}-manuale-1`, { capture: 'viewport', overwrite: true });
        cy.get('#accettazione').scrollIntoView();
        cy.wait(300);
        cy.screenshot(`ui-${vp}-manuale-2`, { capture: 'viewport', overwrite: true });
      });
      if (w < 1024) {
        it('menu "Altro" del telefono', () => {
          cy.visit('/#/oggi');
          cy.get('#more-btn').click();
          cy.get('#more-menu').should('be.visible');
          cy.screenshot(`ui-${vp}-m-menu-altro`, { capture: 'viewport', overwrite: true });
        });
      }
    });
  });
});
