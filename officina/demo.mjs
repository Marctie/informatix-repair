// Dati dimostrativi completi (clienti, magazzino, riparazioni in ogni stato, vendite, incassi).
// Regola di sicurezza: ogni riga demo ha un id NEGATIVO (i dati veri hanno id positivi), quindi "elimina demo" non può toccare i dati reali.
import { db, nowLocal } from './dbref.mjs';
import { demoPurchaseStatements, DEMO_PURCHASE_DELETES } from './purchases.mjs';

const DAY = 86400000;
/** Data/ora "da negozio" di N giorni fa, con orario scelto. */
const ts = (daysAgo, hhmm = '10:30') => `${nowLocal(new Date(Date.now() - daysAgo * DAY)).slice(0, 10)} ${hhmm}:00`;
const ymd = (daysAhead) => nowLocal(new Date(Date.now() + daysAhead * DAY)).slice(0, 10);
const money = (n) => Math.round(n * 100) / 100;

export async function demoStatus() {
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM customers WHERE id < 0').get()).n;
  const r = (await db.prepare('SELECT COUNT(*) AS n FROM repairs WHERE id < 0').get()).n;
  const s = (await db.prepare('SELECT COUNT(*) AS n FROM sales WHERE id < 0').get()).n;
  return { loaded: n > 0 || r > 0 || s > 0, customers: n, repairs: r, sales: s };
}

export async function loadDemo() {
  if ((await demoStatus()).loaded) return { ok: false, already: true };
  const S = [];
  let ev = 0, pt = 0, pay = 0, si = 0, mv = 0;
  const add = (sql, ...a) => S.push([sql, a]);

  // ---- Fornitori
  const SUP = [
    [-1, 'Ricambi Napoli Srl (DEMO)', '081 555 0101', 'ordini@ricambinapoli.example', 'Consegna in 24-48 ore, minimo ordine 50 €'],
    [-2, 'TechParts Italia (DEMO)', '02 555 0102', 'vendite@techparts.example', 'Ottimi prezzi su display e batterie'],
    [-3, 'Cavi&Co Distribuzione (DEMO)', '06 555 0103', 'info@caviandco.example', 'Accessori e cavetteria'],
  ];
  for (const [id, name, phone, email, notes] of SUP) add("INSERT INTO suppliers (id,name,phone,email,notes,created_at) VALUES (?,?,?,?,?,?)", id, name, phone, email, notes, ts(120));

  // ---- Prodotti: id, sku, nome, categoria, qty, min, costo, prezzo, fornitore, posizione
  const P = [
    [-1, 'DSP-IP13', 'Display iPhone 13 (DEMO)', 'ricambi', 3, 2, 62, 129, -1, 'A1'],
    [-2, 'BAT-IP11', 'Batteria iPhone 11 (DEMO)', 'ricambi', 1, 3, 14, 49, -1, 'A2'],
    [-3, 'DSP-SA54', 'Display Samsung A54 (DEMO)', 'ricambi', 2, 2, 55, 119, -2, 'A3'],
    [-4, 'BAT-SA', 'Batteria Samsung A series (DEMO)', 'ricambi', 5, 2, 11, 39, -2, 'A4'],
    [-5, 'CON-USBC', 'Connettore ricarica USB-C (DEMO)', 'ricambi', 0, 3, 3.5, 25, -2, 'A5'],
    [-6, 'CAV-USBC1', 'Cavo USB-C 1 m (DEMO)', 'accessori', 24, 8, 1.8, 9.9, -3, 'B1'],
    [-7, 'COV-SIL', 'Cover silicone universale (DEMO)', 'accessori', 15, 5, 1.2, 9.9, -3, 'B2'],
    [-8, 'PEL-VET', 'Pellicola vetro temperato (DEMO)', 'accessori', 30, 10, 0.9, 12, -3, 'B3'],
    [-9, 'CAR-20W', 'Caricabatterie 20W USB-C (DEMO)', 'accessori', 9, 4, 5.5, 19.9, -3, 'B4'],
    [-10, 'SSD-512', 'SSD 512 GB SATA (DEMO)', 'componenti', 4, 2, 32, 59, -2, 'C1'],
    [-11, 'RAM-8', 'RAM 8 GB DDR4 SODIMM (DEMO)', 'componenti', 6, 2, 16, 35, -2, 'C2'],
    [-12, 'PAS-TERM', 'Pasta termica (DEMO)', 'componenti', 12, 3, 2.2, 9, -2, 'C3'],
    [-13, 'ALI-UNI', 'Alimentatore portatile universale (DEMO)', 'componenti', 3, 2, 14, 39, -2, 'C4'],
    [-14, 'TAS-ASUS', 'Tastiera portatile ASUS (DEMO)', 'componenti', 4, 1, 12, 34, -2, 'C5'], // invenduta da mesi
  ];
  for (const [id, sku, name, cat, qty, min, cost, price, sup, loc] of P) {
    add('INSERT INTO products (id,sku,name,category,qty,min_qty,cost,price,supplier_id,location,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, sku, name, cat, qty, min, cost, price, sup, loc, ts(id === -14 ? 150 : 100));
    add('INSERT INTO stock_moves (id,product_id,delta,reason,ref,created_at) VALUES (?,?,?,?,?,?)', --mv - 0, id, qty + 6, 'carico iniziale', null, ts(id === -14 ? 150 : 100));
  }
  const prod = Object.fromEntries(P.map((p) => [p[0], { name: p[2], cost: p[6], price: p[7] }]));

  // ---- Clienti
  const C = [
    [-1, 'Giulia Esposito', '3330000101', 'giulia.esposito@example.com', 'Cliente storica'],
    [-2, 'Antonio Ferrara', '3330000102', null, null],
    [-3, 'Laura Bianchi', '3330000103', 'laura.bianchi@example.com', 'Preferisce WhatsApp'],
    [-4, 'Salvatore De Luca', '3330000104', null, 'Avvisare prima delle 18'],
    [-5, 'Chiara Romano', '3330000105', 'chiara.romano@example.com', null],
    [-6, 'Pasquale Russo', '3330000106', null, null],
    [-7, 'Elena Greco', '3330000107', 'elena.greco@example.com', 'Studentessa'],
    [-8, 'Studio Rossi & Associati', '3330000108', 'amministrazione@studiorossi.example', 'Azienda: PC dell’ufficio'],
  ];
  for (const [id, name, phone, email, notes] of C) add('INSERT INTO customers (id,name,phone,email,notes,created_at) VALUES (?,?,?,?,?,?)', id, name, phone, email, notes, ts(70));

  // ---- Riparazioni
  const E = (s) => ({ received: 'Dispositivo ricevuto in laboratorio.', diagnosing: 'Stiamo controllando il guasto.', quote_pending: 'Ti abbiamo inviato il preventivo: attendiamo la tua conferma.', approved: 'Preventivo approvato: si procede con la riparazione.', waiting_parts: 'Stiamo aspettando il ricambio necessario.', repairing: 'Il tecnico sta lavorando sul tuo dispositivo.', ready: 'Puoi passare a ritirare il tuo dispositivo.', delivered: 'Dispositivo consegnato. Grazie per averci scelto!', cancelled: 'La riparazione non è stata eseguita.' }[s]);
  const R = [
    { id: -1, c: -1, type: 'smartphone', model: 'iPhone 13', serial: '356789012345671', problem: 'Schermo rotto dopo una caduta', acc: 'Cover, SIM', cond: 'Vetro posteriore graffiato', pass: '1234', status: 'received', quote: 120, dep: 30, d: 0, eta: 3, urgent: 1, path: ['received'] },
    { id: -2, c: -2, type: 'portatile', model: 'Lenovo ThinkPad E15', serial: 'PF2ABC12', problem: 'Si surriscalda e si spegne', acc: 'Alimentatore', cond: 'Buone', pass: '', status: 'received', quote: 70, dep: 20, d: 1, eta: 5, path: ['received'] },
    { id: -3, c: -3, type: 'smartphone', model: 'Samsung Galaxy A54', serial: '351234567890123', problem: 'La batteria dura poche ore', acc: 'Nessuno', cond: 'Ottime', pass: '0000', status: 'diagnosing', quote: null, dep: 0, d: 2, eta: 4, path: ['received', 'diagnosing'] },
    { id: -4, c: -4, type: 'console', model: 'PlayStation 5', serial: 'PS5-98765', problem: 'Non legge i dischi', acc: 'Cavo alimentazione', cond: 'Polvere interna', pass: '', status: 'quote_pending', quote: 89, dep: 0, d: 3, eta: 7, path: ['received', 'diagnosing', 'quote_pending'] },
    { id: -5, c: -5, type: 'smartphone', model: 'iPhone 11', serial: '353456789012345', problem: 'Batteria gonfia', acc: 'Cover', cond: 'Display con graffi', pass: '4321', status: 'approved', quote: 69, dep: 20, d: 4, eta: 2, path: ['received', 'diagnosing', 'quote_pending', 'approved'], decision: 'accepted', parts: [[-2, 1]] },
    { id: -6, c: -6, type: 'smartphone', model: 'Huawei P30', serial: '861234567890123', problem: 'Non si carica', acc: 'Nessuno', cond: 'Usurato', pass: '', status: 'waiting_parts', quote: 45, dep: 10, d: 6, eta: 6, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'waiting_parts'], decision: 'accepted' },
    { id: -7, c: -7, type: 'portatile', model: 'MacBook Air M1', serial: 'C02XYZ12', problem: 'Tastiera con tasti che non rispondono', acc: 'Alimentatore', cond: 'Ottime', pass: '2580', status: 'repairing', quote: 140, dep: 50, d: 5, eta: 1, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing'], decision: 'accepted' },
    { id: -8, c: -8, type: 'pc', model: 'PC fisso Dell OptiPlex', serial: 'DELL-7788', problem: 'Lentissimo, serve un SSD', acc: 'Nessuno', cond: 'Buone', pass: '', status: 'repairing', quote: 95, dep: 0, d: 2, eta: 0, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing'], decision: 'accepted', parts: [[-10, 1]] },
    { id: -9, c: -1, type: 'tablet', model: 'iPad 9ª gen', serial: 'DMPXYZ9', problem: 'Display con linee verticali', acc: 'Cover', cond: 'Buone', pass: '', status: 'ready', quote: 120, dep: 40, d: 9, eta: -1, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing', 'ready'], decision: 'accepted' },
    { id: -10, c: -2, type: 'smartphone', model: 'Samsung Galaxy S21', serial: '357890123456789', problem: 'Fotocamera sfocata', acc: 'Cover', cond: 'Buone', pass: '1111', status: 'ready', quote: 79, dep: 0, d: 8, eta: -2, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing', 'ready'], decision: 'accepted' },
    { id: -11, c: -3, type: 'smartphone', model: 'iPhone 12', serial: '354567890123456', problem: 'Sostituzione display', acc: 'Cover', cond: 'Buone', pass: '', status: 'delivered', quote: 139, dep: 40, d: 25, deliv: 21, final: 139, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing', 'ready', 'delivered'], decision: 'accepted', parts: [[-1, 1]] },
    { id: -12, c: -5, type: 'smartphone', model: 'Samsung Galaxy A52', serial: '352345678901234', problem: 'Sostituzione batteria', acc: 'Nessuno', cond: 'Ottime', pass: '', status: 'delivered', quote: 55, dep: 0, d: 18, deliv: 16, final: 55, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing', 'ready', 'delivered'], decision: 'accepted', parts: [[-4, 1]] },
    { id: -13, c: -6, type: 'portatile', model: 'HP Pavilion 15', serial: 'HP-5544', problem: 'Reinstallazione sistema e pulizia', acc: 'Alimentatore', cond: 'Buone', pass: '', status: 'delivered', quote: 60, dep: 20, d: 40, deliv: 36, final: 60, path: ['received', 'diagnosing', 'quote_pending', 'approved', 'repairing', 'ready', 'delivered'], decision: 'accepted', parts: [[-12, 1]] },
    { id: -14, c: -4, type: 'smartphone', model: 'Xiaomi Redmi Note 10', serial: '865432109876543', problem: 'Danni da liquido', acc: 'Nessuno', cond: 'Ossidazione', pass: '', status: 'cancelled', quote: 110, dep: 0, d: 15, path: ['received', 'diagnosing', 'quote_pending', 'cancelled'], decision: 'declined', fate: 'giacenza' },
  ];
  let rc = 0;
  for (const r of R) {
    const created = ts(r.d, '09:15');
    const last = r.path.length - 1;
    const evDay = (i) => Math.max(0, r.d - Math.round((i * (r.d - (r.deliv ?? Math.max(0, r.d - 5)))) / Math.max(1, last)));
    const updated = ts(r.deliv ?? evDay(last), '17:40');
    add(`INSERT INTO repairs (id,code,token,customer_id,device_type,brand_model,serial,problem,accessories,condition_notes,passcode,status,urgent,quote,deposit,final_price,eta_date,warranty_days,quote_decision,quote_decided_at,created_at,updated_at,delivered_at,device_fate,fate_since)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    r.id, `DEMO-${String(++rc).padStart(3, '0')}`, `demo-token-${rc}`, r.c, r.type, r.model, r.serial, r.problem, r.acc, r.cond, r.pass || null, r.status, r.urgent || 0,
    r.quote, r.dep, r.final ?? null, r.eta == null ? null : ymd(r.eta), 90, r.decision || null, r.decision ? ts(Math.max(0, r.d - 2)) : null, created, updated, r.deliv != null ? ts(r.deliv, '16:20') : null, r.fate || null, r.fate ? ts(r.d) : null);
    r.path.forEach((s, i) => add('INSERT INTO repair_events (id,repair_id,status,note,is_public,created_at) VALUES (?,?,?,?,?,?)', --ev, r.id, s, E(s), 1, ts(s === 'delivered' ? r.deliv : evDay(i), `${9 + i}:20`.padStart(5, '0'))));
    for (const [pid, q] of r.parts || []) add('INSERT INTO repair_parts (id,repair_id,product_id,name,qty,unit_price,unit_cost) VALUES (?,?,?,?,?,?,?)', --pt, r.id, pid, prod[pid].name, q, prod[pid].price, prod[pid].cost);
    if (r.dep) add("INSERT INTO payments (id,kind,ref_id,label,amount,method,created_at) VALUES (?,?,?,?,?,?,?)", --pay, 'repair', r.id, `Acconto DEMO-${String(rc).padStart(3, '0')}`, r.dep, rc % 2 ? 'contanti' : 'carta', created);
    if (r.status === 'delivered') add("INSERT INTO payments (id,kind,ref_id,label,amount,method,created_at) VALUES (?,?,?,?,?,?,?)", --pay, 'repair', r.id, `Saldo DEMO-${String(rc).padStart(3, '0')}`, money(r.final - r.dep), rc % 3 ? 'carta' : 'contanti', ts(r.deliv, '16:20'));
  }

  // ---- Vendite: giorni fa, cliente, metodo, sconto, articoli [prodotto, qta] oppure [null, nome, qta, prezzo]
  const V = [
    [28, -1, 'contanti', 0, [[-6, 2], [-9, 1]]], [26, null, 'carta', 0, [[-8, 1], [-7, 1]]], [24, -2, 'carta', 0, [[-6, 1]]],
    [21, null, 'contanti', 0, [[-9, 1], [-6, 1]]], [19, -3, 'carta', 5, [[-11, 1], [-12, 1], [null, 'Installazione RAM', 1, 15]]],
    [16, null, 'contanti', 0, [[-8, 2]]], [13, -5, 'carta', 0, [[-10, 1], [null, 'Clonazione disco', 1, 25]]], [11, null, 'contanti', 0, [[-7, 1], [-8, 1]]],
    [9, -7, 'carta', 0, [[-9, 1]]], [6, null, 'bonifico', 0, [[-6, 1]]], [4, -4, 'carta', 0, [[-13, 1]]], [2, null, 'contanti', 0, [[-8, 1], [-6, 1], [-7, 1]]],
    [1, -8, 'bonifico', 0, [[-11, 2], [-10, 2]]],
    [1, null, 'carta', 0, [[-9, 2], [-8, 1]]], [1, -1, 'contanti', 0, [[-6, 3], [-7, 2]]],
    [0, null, 'contanti', 0, [[-6, 2], [-8, 1]]], [0, -6, 'carta', 0, [[-9, 1], [-6, 1]]],
    [0, null, 'contanti', 0, [[-7, 2], [null, 'Configurazione WhatsApp', 1, 10]]], [0, -2, 'carta', 0, [[-3, 1]]],
  ];
  const HOURS = ['09:40', '11:45', '13:10', '16:30', '18:05', '10:20', '17:25'];
  let sc = 0;
  for (const [d, cust, method, disc, items] of V) {
    const sid = --sc;
    const hh = HOURS[-sid % HOURS.length];
    const code = `V-DEMO-${String(-sid).padStart(3, '0')}`;
    let total = 0;
    const rows = items.map((it) => (it[0] == null ? { pid: null, name: it[1], qty: it[2], price: it[3], cost: 0 } : { pid: it[0], name: prod[it[0]].name, qty: it[1], price: prod[it[0]].price, cost: prod[it[0]].cost }));
    rows.forEach((x) => { total += x.qty * x.price; });
    total = money(total - disc);
    add('INSERT INTO sales (id,code,customer_id,total,discount,method,created_at) VALUES (?,?,?,?,?,?,?)', sid, code, cust, total, disc, method, ts(d, hh));
    rows.forEach((x) => add('INSERT INTO sale_items (id,sale_id,product_id,name,qty,unit_price,unit_cost) VALUES (?,?,?,?,?,?,?)', --si, sid, x.pid, x.name, x.qty, x.price, x.cost));
    add("INSERT INTO payments (id,kind,ref_id,label,amount,method,created_at) VALUES (?,?,?,?,?,?,?)", --pay, 'sale', sid, `Vendita ${code}`, total, method, ts(d, hh));
  }

  // ---- Spese (per la nota spese): giorni fa, descrizione, categoria, fornitore, importo, IVA, metodo, documento, numero, chi ha pagato, da rimborsare
  const X = [
    [26, 'Ordine display e batterie', 'ricambi e merce', 'TechParts Italia', 366, 66, 'bonifico', 'fattura', '2026/118', 'Christian', 0],
    [22, 'Bolletta energia elettrica', 'utenze', 'Energia Sud', 118.4, 21.35, 'bonifico', 'fattura', 'E-55821', 'Christian', 0],
    [19, 'Carburante per ritiro merce', 'trasporti e carburante', 'Distributore Q8', 45, 8.11, 'contanti', 'scontrino', null, 'Christian', 1],
    [15, 'Cacciaviti di precisione e stazione saldante', 'attrezzatura', 'Ferramenta Rossi', 89.9, 16.21, 'carta', 'scontrino', null, 'Christian', 0],
    [12, 'Pranzo con fornitore', 'pasti e trasferte', 'Ristorante Da Gigi', 38, 3.45, 'contanti', 'ricevuta', 'R-204', 'Christian', 1],
    [9, 'Affitto locale (mese)', 'affitto', 'Immobiliare Esposito', 650, 0, 'bonifico', 'ricevuta', 'AFF-10', 'Christian', 0],
    [6, 'Consulenza commercialista (trimestre)', 'consulenze', 'Studio Verdi', 183, 33, 'bonifico', 'fattura', '48/2026', 'Christian', 0],
    [3, 'Cavi e accessori per il negozio', 'ricambi e merce', 'Cavi&Co Distribuzione', 74.2, 13.38, 'carta', 'fattura', 'CC-9921', 'Christian', 0],
    [1, 'Volantini promozionali', 'marketing', 'Tipografia Nocera', 52, 9.38, 'contanti', 'senza', null, 'Christian', 1],
  ];
  let xc = 0;
  for (const [d, desc, cat, vendor, amount, vat, method, doc, num, by, reimb] of X) {
    add("INSERT INTO expenses (id,spent_on,description,category,vendor,amount,vat,method,doc_type,doc_number,paid_by,reimbursable,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      --xc, ts(d, '12:00').slice(0, 10), `${desc} (DEMO)`, cat, vendor, amount, vat, method, doc === 'senza' ? 'nessuno' : doc, num, by, reimb, ts(d, '12:00'));
  }
  S.push(...demoPurchaseStatements(ts)); // acquisti demo con prezzi che variano tra fornitori
  for (let i = 0; i < S.length; i += 80) await db.batch(S.slice(i, i + 80));
  return { ok: true, ...(await demoStatus()) };
}

export async function deleteDemo() {
  // Clienti e fornitori demo usati da dati VERI (una riparazione o una vendita vera, un prodotto vero):
  // invece di bloccare l'eliminazione li "adotta", cioe' li copia come anagrafica vera (id positivo)
  // e sposta i riferimenti veri sulla copia. Cosi' i dati veri non si perdono e la cancellazione riesce sempre.
  const adopt = async (table, cols, refs) => {
    const ids = new Set();
    for (const [rt, rc] of refs) {
      for (const r of await db.prepare(`SELECT DISTINCT ${rc} AS id FROM ${rt} WHERE id > 0 AND ${rc} < 0`).all()) ids.add(r.id);
    }
    for (const id of ids) {
      const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
      if (!row) continue;
      const res = await db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => row[c]));
      for (const [rt, rc] of refs) await db.prepare(`UPDATE ${rt} SET ${rc} = ? WHERE ${rc} = ? AND id > 0`).run(res.lastInsertRowid, id);
    }
    return ids.size;
  };
  await adopt('customers', ['name', 'phone', 'email', 'notes', 'created_at'], [['repairs', 'customer_id'], ['sales', 'customer_id']]);
  await adopt('suppliers', ['name', 'phone', 'email', 'website', 'notes', 'created_at'], [['products', 'supplier_id']]);
  const D = [
    ...DEMO_PURCHASE_DELETES,
    'DELETE FROM payments WHERE id < 0',
    'DELETE FROM expenses WHERE id < 0',
    'DELETE FROM sale_items WHERE id < 0 OR sale_id < 0',
    'DELETE FROM sales WHERE id < 0',
    'DELETE FROM repair_parts WHERE id < 0 OR repair_id < 0',
    'DELETE FROM repair_events WHERE id < 0 OR repair_id < 0',
    'DELETE FROM repairs WHERE id < 0',
    'DELETE FROM stock_moves WHERE id < 0 OR product_id < 0',
    'DELETE FROM products WHERE id < 0',
    'DELETE FROM suppliers WHERE id < 0',
    'DELETE FROM customers WHERE id < 0',
  ];
  await db.batch(D.map((sql) => [sql, []]));
  return { ok: true, loaded: false };
}
